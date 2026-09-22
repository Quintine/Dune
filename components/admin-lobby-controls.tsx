'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ClientRequestError, requestJson, requestMayHaveCompleted } from '@/lib/client-request';
import { retainAdminRoomRequest } from '@/lib/admin-room-control-client';
import { adminLobbyResponse, adminLobbyConfirmation, clearAdminLobbyRequest, describeAdminLobbyAction, newAdminLobbyRequest, readAdminLobbyRequest, saveAdminLobbyRequest } from '@/lib/admin-lobby-client';
import type { AdminLobbyAction, AdminLobbyInput, AdminLobbyView } from '@/lib/admin-lobby-configuration';
import { FACTIONS, type FactionId } from '@/game/catalog';
import { DIFFICULTIES, type Difficulty } from '@/game/bot-profiles';

type Props = {
  accountId: string; code: string; canManage: boolean; onClose: () => void;
  onUpdated: () => void; onDenied: () => void; onBusyChange: (busy: boolean) => void;
};
const message = (error: unknown) => error instanceof Error ? error.message : 'The lobby could not be loaded.';
const baseFactions = FACTIONS.filter(faction => faction.expansion === 'base');

export function AdminLobbyControls({ accountId, code, canManage, onClose, onUpdated, onDenied, onBusyChange }: Props) {
  const [lobby, setLobby] = useState<AdminLobbyView | null>(null);
  const [kind, setKind] = useState<AdminLobbyAction['type']>('rules');
  const [enabled, setEnabled] = useState(false);
  const [target, setTarget] = useState('');
  const [faction, setFaction] = useState<FactionId>('atreides');
  const [difficulty, setDifficulty] = useState<Difficulty>('Easy');
  const [position, setPosition] = useState(1);
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [pending, setPending] = useState<AdminLobbyInput | null>(null);
  const [storageProblem, setStorageProblem] = useState(false);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const alive = useRef(false), inFlight = useRef(false);
  const title = useRef<HTMLHeadingElement>(null);
  const url = `/api/admin/rooms/${code}/lobby`;

  useEffect(() => {
    alive.current = true; title.current?.focus();
    let canceled = false;
    try {
      const saved = readAdminLobbyRequest(window.sessionStorage, accountId, code);
      // oxlint-disable-next-line react/react-compiler -- Restore the account/room's tab-scoped request after SSR.
      setPending(saved);
      if (saved) setNotice('A saved lobby request needs confirmation. Review it below, then retry the same request.');
    } catch (error) { setStorageProblem(true); setNotice(message(error)); }
    requestJson<unknown>(url, { cache: 'no-store', headers: { 'X-Dune-Admin-Id': accountId } })
      .then(result => { const current = adminLobbyResponse(result, code); if (!canceled) { setLobby(current); setEnabled(current.advanced); } })
      .catch(error => { if (!canceled) {
        setNotice(message(error));
        if (error instanceof ClientRequestError && [401, 403].includes(error.status ?? 0)) onDenied();
      } })
      .finally(() => { if (!canceled) setLoading(false); });
    return () => { canceled = true; alive.current = false; };
  }, [accountId, code, url, onDenied]);

  async function refresh() {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); onBusyChange(true);
    try {
      const current = adminLobbyResponse(await requestJson<unknown>(url, { cache: 'no-store', headers: { 'X-Dune-Admin-Id': accountId } }), code);
      if (alive.current) { setLobby(current); setConfirmed(false); }
    } catch (error) {
      if (alive.current) {
        setNotice(message(error));
        if (error instanceof ClientRequestError && [401, 403].includes(error.status ?? 0)) onDenied();
      }
    } finally { inFlight.current = false; onBusyChange(false); if (alive.current) setBusy(false); }
  }

  function selectTarget(id: string) {
    setTarget(id); setConfirmed(false);
    const player = lobby?.players.find(player => player.id === id);
    if (player?.bot) { setFaction(player.faction as FactionId); setDifficulty(player.bot); setPosition(player.position); }
  }
  function selectKind(next: AdminLobbyAction['type']) {
    setKind(next); setConfirmed(false); setTarget('');
    setEnabled(next === 'rules' ? lobby?.advanced ?? false : next === 'techTokens' ? lobby?.techTokens ?? false : lobby?.strongholdCards ?? false);
    if (next === 'addBot') setFaction(baseFactions.find(item => !lobby?.players.some(player => player.faction === item.id))?.id ?? 'atreides');
    if (next === 'removeBot' || next === 'configureBot') selectTarget(lobby?.players.find(player => player.bot)?.id ?? '');
    if (next === 'assignHost') setTarget(lobby?.players.find(player => player.hostEligible && player.id !== lobby.host)?.id ?? '');
  }
  const action: AdminLobbyAction = kind === 'rules' ? { type: kind, advanced: enabled } :
    kind === 'techTokens' || kind === 'strongholdCards' ? { type: kind, enabled } :
    kind === 'addBot' ? { type: kind, faction, difficulty } :
    kind === 'configureBot' ? { type: kind, target, faction, difficulty, position } : { type: kind, target };
  const selectedPlayer = lobby?.players.find(player => player.id === target);
  const availableFactions = baseFactions.filter(item => !lobby?.players.some(player => player.faction === item.id && (kind !== 'configureBot' || player.id !== target)));
  const actionable = lobby?.editable && (kind === 'rules' ? enabled !== lobby.advanced :
    kind === 'techTokens' ? enabled !== lobby.techTokens : kind === 'strongholdCards' ? enabled !== lobby.strongholdCards && (!enabled || lobby.advanced) :
    kind === 'addBot' ? lobby.players.length < 6 && availableFactions.some(item => item.id === faction) :
    kind === 'assignHost' ? selectedPlayer?.hostEligible && target !== lobby.host :
    kind === 'removeBot' ? !!selectedPlayer?.bot : !!selectedPlayer?.bot && availableFactions.some(item => item.id === faction) &&
      (selectedPlayer.faction !== faction || selectedPlayer.bot !== difficulty || selectedPlayer.position !== position));

  async function submit(saved?: AdminLobbyInput) {
    if (inFlight.current || !lobby || !canManage || storageProblem || (!saved && (!confirmed || !actionable))) return;
    let input: AdminLobbyInput;
    try {
      input = saved ?? newAdminLobbyRequest(lobby, action, reason);
      saveAdminLobbyRequest(window.sessionStorage, accountId, code, input);
    } catch (error) { setNotice(message(error)); return; }
    inFlight.current = true; setBusy(true); onBusyChange(true); setPending(input); setNotice('Saving lobby change…');
    try {
      const result = adminLobbyConfirmation(await requestJson<unknown>(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Dune-Admin-Id': accountId }, body: JSON.stringify(input),
      }), code, input);
      clearAdminLobbyRequest(window.sessionStorage, accountId, code);
      if (alive.current) {
        setPending(null); setLobby(result.lobby); setConfirmed(false); setReason('');
        setNotice(result.replayed ? 'The original lobby change was already recorded. Current settings are shown below.' : 'Lobby change saved. Current settings are shown below.');
        onUpdated();
      }
    } catch (error) {
      let cleared = false;
      if (!retainAdminRoomRequest(error)) {
        try { clearAdminLobbyRequest(window.sessionStorage, accountId, code); cleared = true; } catch { /* Keep the exact retry after storage failure. */ }
      }
      if (alive.current) {
        if (cleared) setPending(null);
        setConfirmed(false);
        setNotice(requestMayHaveCompleted(error) ? `${message(error)} The change may have been saved. Use Retry saved lobby request to confirm.` : message(error));
        if (error instanceof ClientRequestError && [401, 403].includes(error.status ?? 0)) onDenied();
        else try {
          const current = adminLobbyResponse(await requestJson<unknown>(url, { cache: 'no-store', headers: { 'X-Dune-Admin-Id': accountId } }), code);
          if (alive.current) setLobby(current);
        } catch { /* Preserve the original outcome and retry instructions. */ }
      }
    } finally { inFlight.current = false; onBusyChange(false); if (alive.current) setBusy(false); }
  }
  function discardUnreadableRecord() {
    if (!confirmed || busy) return;
    try {
      clearAdminLobbyRequest(window.sessionStorage, accountId, code); setStorageProblem(false); setConfirmed(false);
      setNotice('Local retry record removed. This did not undo any server change. Review the current lobby before continuing.');
    } catch (error) { setNotice(message(error)); }
  }

  return <section className="admin-room-control" aria-labelledby="admin-lobby-title" aria-busy={loading || busy}>
    <div className="admin-section-heading"><h2 id="admin-lobby-title" ref={title} tabIndex={-1}>Lobby configuration · {code}</h2><Button variant="outline" disabled={busy} onClick={onClose}>Close lobby configuration</Button></div>
    {notice && <output className="admin-notice">{notice}</output>}
    {loading ? <output>Loading lobby configuration…</output> : !lobby ? <Button disabled={busy} onClick={() => void refresh()}>Retry loading lobby</Button> : <>
      <p>Current rules: <strong>{lobby.advanced ? 'Advanced preview' : 'Basic'}</strong> · Tech Tokens {lobby.techTokens ? 'on' : 'off'} · Stronghold Cards {lobby.strongholdCards ? 'on' : 'off'}.</p>
      <p>Advanced preview is unfinished. Players must review the warning and the host must explicitly start the preview.</p>
      <ul className="admin-lobby-roster">{lobby.players.map(player => <li key={player.id}>
        <strong>{player.name}</strong>{player.id === lobby.host ? ' · Host' : ''} · {FACTIONS.find(item => item.id === player.faction)?.name ?? player.faction} · {player.bot ? `AI: ${player.bot}` : 'Human'} · Circle {player.position} · {player.ready ? 'Ready' : 'Not ready'}
      </li>)}</ul>
      <Button variant="outline" disabled={busy} onClick={() => void refresh()}>Refresh current lobby</Button>
      {!lobby.editable && <p>{lobby.blockedReason ?? 'This lobby cannot currently be changed.'}</p>}
      {!canManage ? <p>Your viewer role can inspect this lobby. An owner or operator can change it.</p> : storageProblem ? <div className="admin-confirm">
        <p>No new changes can be sent until this tab’s unreadable retry record is resolved. Removing it does not cancel a change already saved on the server.</p>
        <label className="admin-check"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />I have inspected the current lobby and want to remove the local retry record.</label>
        <Button disabled={busy || !confirmed} onClick={discardUnreadableRecord}>Discard unreadable local record</Button>
      </div> : pending ? <div className="admin-confirm">
        <p>Saved request for {code}: {describeAdminLobbyAction(pending.action, lobby)}.</p><p>Reason: {pending.reason}</p>
        <p>The exact request stays in this tab across refresh. Retrying confirms an already completed change without applying it again, including after the game has started.</p>
        <Button disabled={busy} onClick={() => void submit(pending)}>Retry saved lobby request</Button>
      </div> : lobby.editable && <form onSubmit={event => { event.preventDefault(); void submit(); }}>
        <label>Change<select value={kind} disabled={busy} onChange={e => selectKind(e.target.value as AdminLobbyAction['type'])}>
          <option value="rules">Rules mode</option><option value="techTokens">Tech Tokens</option><option value="strongholdCards">Stronghold Cards</option>
          <option value="addBot">Add AI player</option><option value="configureBot">Configure AI player</option><option value="removeBot">Remove AI player</option><option value="assignHost">Assign host</option>
        </select></label>
        {(kind === 'rules' || kind === 'techTokens' || kind === 'strongholdCards') && <label>{kind === 'rules' ? 'Rules mode' : kind === 'techTokens' ? 'Tech Tokens' : 'Stronghold Cards'}<select value={String(enabled)} disabled={busy} onChange={e => { setEnabled(e.target.value === 'true'); setConfirmed(false); }}>
          <option value="false">{kind === 'rules' ? 'Basic' : 'Off'}</option><option value="true" disabled={kind === 'strongholdCards' && !lobby.advanced}>{kind === 'rules' ? 'Advanced preview' : 'On'}</option>
        </select></label>}
        {kind === 'rules' && !enabled && lobby.strongholdCards && <p>Switching to Basic also turns off Stronghold Cards.</p>}
        {kind === 'techTokens' && <p>Tech Tokens require at least three players before the game can start.</p>}
        {(kind === 'configureBot' || kind === 'removeBot' || kind === 'assignHost') && <label>{kind === 'assignHost' ? 'New host' : 'AI player'}<select value={target} disabled={busy} onChange={e => selectTarget(e.target.value)}>
          <option value="">Choose a player</option>{lobby.players.filter(player => kind === 'assignHost' ? player.hostEligible && player.id !== lobby.host : player.bot).map(player => <option key={player.id} value={player.id}>{player.name}</option>)}
        </select></label>}
        {(kind === 'addBot' || kind === 'configureBot') && <div className="admin-create-grid">
          <label>AI faction<select value={faction} disabled={busy} onChange={e => { setFaction(e.target.value as FactionId); setConfirmed(false); }}>{availableFactions.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label>AI difficulty<select value={difficulty} disabled={busy} onChange={e => { setDifficulty(e.target.value as Difficulty); setConfirmed(false); }}>{DIFFICULTIES.map(item => <option key={item}>{item}</option>)}</select></label>
          {kind === 'configureBot' && <label>Player circle<select value={position} disabled={busy} onChange={e => { setPosition(Number(e.target.value)); setConfirmed(false); }}>{[1, 2, 3, 4, 5, 6].map(item => <option key={item} disabled={lobby.players.some(player => player.id !== target && player.position === item)}>{item}</option>)}</select></label>}
        </div>}
        {kind === 'assignHost' && <p>The selected human gains host controls. The previous host keeps their seat. Existing seat credentials remain unchanged, and all humans must ready again.</p>}
        <label htmlFor="admin-lobby-reason">Reason for the audit history<Input id="admin-lobby-reason" value={reason} maxLength={300} required disabled={busy} onChange={e => { setReason(e.target.value); setConfirmed(false); }} /></label>
        <p className="admin-secondary">Use a short operational reason. Do not include credentials or private game information.</p>
        <div className="admin-confirm">
          <p>{describeAdminLobbyAction(action, lobby)} in room <strong>{code}</strong>. Settings affect everyone in this lobby and may clear readiness. This action gives the administrator no private seat access.</p>
          <label className="admin-check"><input type="checkbox" checked={confirmed} disabled={busy || !actionable} onChange={e => setConfirmed(e.target.checked)} />I have reviewed this change and am ready to apply it.</label>
          <Button type="submit" disabled={busy || !actionable || !confirmed || !reason.trim()}>Apply lobby change</Button>
        </div>
      </form>}
    </>}
  </section>;
}
