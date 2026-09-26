'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ClientRequestError, requestJson, requestMayHaveCompleted } from '@/lib/client-request';
import { retainAdminRoomRequest } from '@/lib/admin-room-control-client';
import { adminSeatAiResponse, adminSeatAiConfirmation, clearAdminSeatAiRequest, newAdminSeatAiRequest, readAdminSeatAiRequest, saveAdminSeatAiRequest } from '@/lib/admin-seat-ai-client';
import type { AdminSeatAiInput, AdminSeatAiView } from '@/lib/admin-seat-ai';
import { DIFFICULTIES, type Difficulty } from '@/game/bot-profiles';
import { FACTIONS } from '@/game/catalog';

type Props = {
  accountId: string; code: string; canManage: boolean; onClose: () => void;
  onUpdated: () => void; onDenied: () => void; onBusyChange: (busy: boolean) => void;
};
const message = (error: unknown) => error instanceof Error ? error.message : 'Participant availability could not be loaded.';
const label = (difficulty: Difficulty) => difficulty[0].toUpperCase() + difficulty.slice(1);

export function AdminSeatAi({ accountId, code, canManage, onClose, onUpdated, onDenied, onBusyChange }: Props) {
  const [room, setRoom] = useState<AdminSeatAiView | null>(null);
  const [target, setTarget] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>('Easy');
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [confirmationCode, setConfirmationCode] = useState('');
  const [pending, setPending] = useState<AdminSeatAiInput | null>(null);
  const [storageProblem, setStorageProblem] = useState(false);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [initialRequestPending, setInitialRequestPending] = useState(false);
  const [loading, setLoading] = useState(true);
  const alive = useRef(false), inFlight = useRef(false);
  const title = useRef<HTMLHeadingElement>(null);
  const url = `/api/admin/rooms/${code}/seat-ai`;
  const selected = room?.players.find(player => player.id === target && player.eligible);

  useEffect(() => {
    alive.current = true; title.current?.focus();
    let canceled = false;
    try {
      const saved = readAdminSeatAiRequest(window.sessionStorage, accountId, code);
      // oxlint-disable-next-line react/react-compiler -- Restore this account/room's tab-scoped request after SSR.
      setPending(saved);
      if (saved) setNotice('A saved participant AI request needs confirmation. Review it below, then retry the same request.');
    } catch (error) { setStorageProblem(true); setNotice(message(error)); }
    requestJson<unknown>(url, { cache: 'no-store', headers: { 'X-Dune-Admin-Id': accountId } })
      .then(result => { const current = adminSeatAiResponse(result, code); if (!canceled) setRoom(current); })
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
      const current = adminSeatAiResponse(await requestJson<unknown>(url, { cache: 'no-store', headers: { 'X-Dune-Admin-Id': accountId } }), code);
      if (alive.current) { setRoom(current); setTarget(''); setConfirmed(false); setConfirmationCode(''); }
    } catch (error) {
      if (alive.current) {
        setNotice(message(error));
        if (error instanceof ClientRequestError && [401, 403].includes(error.status ?? 0)) onDenied();
      }
    } finally { inFlight.current = false; onBusyChange(false); if (alive.current) setBusy(false); }
  }

  async function submit(saved?: AdminSeatAiInput) {
    if (inFlight.current || loading || !canManage || storageProblem ||
        (!saved && (!room?.editable || !selected || pending || !confirmed || confirmationCode !== code))) return;
    let input: AdminSeatAiInput;
    try {
      input = saved ?? newAdminSeatAiRequest(room!, target, difficulty, reason);
      saveAdminSeatAiRequest(window.sessionStorage, accountId, code, input);
    } catch (error) { setNotice(message(error)); return; }
    inFlight.current = true; setInitialRequestPending(!saved); setBusy(true); onBusyChange(true); setPending(input); setNotice('Enabling participant AI…');
    try {
      const result = adminSeatAiConfirmation(await requestJson<unknown>(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Dune-Admin-Id': accountId }, body: JSON.stringify(input),
      }), code, input);
      clearAdminSeatAiRequest(window.sessionStorage, accountId, code);
      if (alive.current) {
        setPending(null); setRoom(result.room); setTarget(''); setConfirmed(false); setConfirmationCode(''); setReason('');
        setNotice(result.replayed ? 'The original request was already recorded. Current participant control is shown below; later changes have been preserved.' :
          'Participant AI enabled. The room remains paused. The player keeps their seat and can take back control. Resume separately through Room controls when everyone is ready.');
        onUpdated();
      }
    } catch (error) {
      let cleared = false;
      if (!retainAdminRoomRequest(error)) {
        try { clearAdminSeatAiRequest(window.sessionStorage, accountId, code); cleared = true; } catch { /* Preserve exact retry after storage failure. */ }
      }
      if (alive.current) {
        if (cleared) setPending(null);
        setConfirmed(false); setConfirmationCode('');
        setNotice(requestMayHaveCompleted(error) ? `${message(error)} The change may have been saved. Use Retry saved request to confirm.` : message(error));
        if (error instanceof ClientRequestError && [401, 403].includes(error.status ?? 0)) onDenied();
        else try {
          const current = adminSeatAiResponse(await requestJson<unknown>(url, { cache: 'no-store', headers: { 'X-Dune-Admin-Id': accountId } }), code);
          if (alive.current) setRoom(current);
        } catch (readError) {
          // Keep the exact retry proof, but never leave stale privileged controls visible.
          if (alive.current && readError instanceof ClientRequestError && [401, 403].includes(readError.status ?? 0)) onDenied();
        }
      }
    } finally { inFlight.current = false; onBusyChange(false); if (alive.current) { setInitialRequestPending(false); setBusy(false); } }
  }

  function discardUnreadableRecord() {
    if (!canManage || !room || !confirmed || busy) return;
    try {
      clearAdminSeatAiRequest(window.sessionStorage, accountId, code); setStorageProblem(false); setConfirmed(false);
      setNotice('Local retry record removed. This did not undo any server change. Review current participant control before continuing.');
    } catch (error) { setNotice(message(error)); }
  }

  return <section className="admin-room-control" aria-labelledby="admin-seat-ai-title" aria-busy={loading || busy}>
    <div className="admin-section-heading"><h2 id="admin-seat-ai-title" ref={title} tabIndex={-1}>Participant AI · {code}</h2><Button variant="outline" disabled={busy} onClick={onClose}>Close participant controls</Button></div>
    {notice && <output className="admin-notice">{notice}</output>}
    {loading ? <output>Loading participant availability…</output> : <>
      {room ? <>
        <p>Room: <strong>{room.removed ? 'Removed' : room.archived ? 'Archived' : room.closed ? 'Closed' : room.paused ? 'Paused' : 'Running'}</strong>. Game: <strong>{room.status}</strong>.</p>
        <p>Use AI to support an absent player in a paused game. They keep their cards, forces and access, and can take back control. No private seat access is given to the administrator.</p>
        {room.players.length > 0 && <ul>{room.players.map(player => <li key={player.id}>{player.name} · {FACTIONS.find(faction => faction.id === player.faction)?.name ?? player.faction} · {player.control === 'human' ? 'Human' : `${player.difficulty ? label(player.difficulty) : ''} AI${player.control === 'autopilot' ? ' on human seat' : ''}`}</li>)}</ul>}
        <Button variant="outline" disabled={busy} onClick={() => void refresh()}>Refresh participants</Button>
      </> : <Button disabled={busy} onClick={() => void refresh()}>Retry loading participants</Button>}
      {!canManage ? <p>Your viewer role can inspect participants. An owner or operator can enable participant AI.</p> : storageProblem ? <div className="admin-confirm">
        <p>No new changes can be sent until this tab’s unreadable retry record is resolved. Discarding the record does not cancel a server change.</p>
        <label className="admin-check"><input type="checkbox" checked={confirmed} disabled={busy || !room} onChange={e => setConfirmed(e.target.checked)} />I have inspected room {code} and want to remove its local retry record.</label>
        <Button disabled={busy || !room || !confirmed} onClick={discardUnreadableRecord}>Discard unreadable local record</Button>
      </div> : initialRequestPending ? null : pending ? <div className="admin-confirm">
        <p>Saved request: enable <strong>{label(pending.difficulty)} AI</strong> for <strong>{room?.players.find(player => player.id === pending.target)?.name ?? pending.target}</strong> in room <strong>{code}</strong>.</p><p>Reason: {pending.reason}</p>
        <p>The exact request stays in this tab across refresh. Retrying confirms the original change without applying it again, including after the player takes back control or the room resumes.</p>
        <p>After refresh or sign-in, use All rooms in both Directory and Archive filters to find the room and reopen Participant AI.</p>
        <Button disabled={busy} onClick={() => void submit(pending)}>Retry saved request</Button>
      </div> : room && !room.editable ? <p>{room.blockedReason}</p> : room && !room.players.some(player => player.eligible) ? <p>No human participant is eligible. A participant needs current seat access and must not already be controlled by AI.</p> : room && <form onSubmit={event => { event.preventDefault(); void submit(); }}>
        <label htmlFor="admin-seat-ai-target">Participant<select id="admin-seat-ai-target" required value={target} disabled={busy} onChange={e => { setTarget(e.target.value); setConfirmed(false); }}>
          <option value="">Choose a human participant</option>{room.players.filter(player => player.eligible).map(player => <option key={player.id} value={player.id}>{player.name} · {FACTIONS.find(faction => faction.id === player.faction)?.name ?? player.faction}</option>)}
        </select></label>
        <label htmlFor="admin-seat-ai-difficulty">AI difficulty<select id="admin-seat-ai-difficulty" value={difficulty} disabled={busy} onChange={e => { setDifficulty(e.target.value as Difficulty); setConfirmed(false); }}>
          {DIFFICULTIES.map(value => <option key={value} value={value}>{label(value)}</option>)}
        </select></label>
        <label htmlFor="admin-seat-ai-reason">Reason for the audit history<Input id="admin-seat-ai-reason" value={reason} maxLength={300} required disabled={busy} onChange={e => { setReason(e.target.value); setConfirmed(false); }} /></label>
        <p className="admin-secondary">Use a short operational reason. Do not include credentials or private game information.</p>
        <div className="admin-confirm">
          <p>{selected ? `Enable ${label(difficulty)} AI for ${selected.name}.` : 'Choose the participant above.'} The room will remain paused. Unused permissions this player gave others to start AI will be revoked; their seat and recovery access remain.</p>
          <p>Resume separately through Room controls when play should continue. This does not remove or restrict a participant.</p>
          <label htmlFor="admin-seat-ai-code">Type {code} to confirm this room<Input id="admin-seat-ai-code" value={confirmationCode} maxLength={8} autoComplete="off" autoCapitalize="characters" spellCheck={false} disabled={busy} onChange={e => { setConfirmationCode(e.target.value); setConfirmed(false); }} /></label>
          <label className="admin-check"><input type="checkbox" checked={confirmed} disabled={busy || !selected} onChange={e => setConfirmed(e.target.checked)} />I have reviewed this participant and understand that they retain their seat access and can take back control.</label>
          <Button type="submit" disabled={busy || !selected || !confirmed || !reason.trim() || confirmationCode !== code}>Enable participant AI</Button>
        </div>
      </form>}
    </>}
  </section>;
}
