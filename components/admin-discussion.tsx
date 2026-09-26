'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ClientRequestError, requestJson, requestMayHaveCompleted } from '@/lib/client-request';
import { retainAdminRoomRequest } from '@/lib/admin-room-control-client';
import { adminDiscussionResponse, adminDiscussionConfirmation, clearAdminDiscussionRequest, newAdminDiscussionRequest, readAdminDiscussionRequest, saveAdminDiscussionRequest } from '@/lib/admin-discussion-client';
import type { AdminDiscussionInput, AdminDiscussionView } from '@/lib/admin-discussion';
import { FACTIONS } from '@/game/catalog';

type Props = {
  accountId: string; code: string; canManage: boolean; onClose: () => void;
  onUpdated: () => void; onDenied: () => void; onBusyChange: (busy: boolean) => void;
};
const message = (error: unknown) => error instanceof Error ? error.message : 'Participant availability could not be loaded.';

export function AdminDiscussion({ accountId, code, canManage, onClose, onUpdated, onDenied, onBusyChange }: Props) {
  const [room, setRoom] = useState<AdminDiscussionView | null>(null);
  const [target, setTarget] = useState('');
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [confirmationCode, setConfirmationCode] = useState('');
  const [pending, setPending] = useState<AdminDiscussionInput | null>(null);
  const [storageProblem, setStorageProblem] = useState(false);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [initialRequestPending, setInitialRequestPending] = useState(false);
  const [loading, setLoading] = useState(true);
  const alive = useRef(false), inFlight = useRef(false);
  const title = useRef<HTMLHeadingElement>(null);
  const url = `/api/admin/rooms/${code}/discussion`;
  const selected = room?.players.find(player => player.id === target && player.control !== 'ai');

  useEffect(() => {
    alive.current = true; title.current?.focus();
    let canceled = false;
    try {
      const saved = readAdminDiscussionRequest(window.sessionStorage, accountId, code);
      // oxlint-disable-next-line react/react-compiler -- Restore this account/room's tab-scoped request after SSR.
      setPending(saved);
      if (saved) setNotice('A saved discussion request needs confirmation. Review it below, then retry the same request.');
    } catch (error) { setStorageProblem(true); setNotice(message(error)); }
    requestJson<unknown>(url, { cache: 'no-store', headers: { 'X-Dune-Admin-Id': accountId } })
      .then(result => { const current = adminDiscussionResponse(result, code); if (!canceled) setRoom(current); })
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
      const current = adminDiscussionResponse(await requestJson<unknown>(url, { cache: 'no-store', headers: { 'X-Dune-Admin-Id': accountId } }), code);
      if (alive.current) { setRoom(current); setTarget(''); setConfirmed(false); setConfirmationCode(''); }
    } catch (error) {
      if (alive.current) {
        setNotice(message(error));
        if (error instanceof ClientRequestError && [401, 403].includes(error.status ?? 0)) onDenied();
      }
    } finally { inFlight.current = false; onBusyChange(false); if (alive.current) setBusy(false); }
  }

  async function submit(saved?: AdminDiscussionInput) {
    if (inFlight.current || loading || !canManage || storageProblem ||
        (!saved && (!room?.editable || !selected || pending || !confirmed || confirmationCode !== code))) return;
    let input: AdminDiscussionInput;
    try {
      input = saved ?? newAdminDiscussionRequest(room!, target, !selected!.muted, reason);
      saveAdminDiscussionRequest(window.sessionStorage, accountId, code, input);
    } catch (error) { setNotice(message(error)); return; }
    inFlight.current = true; setInitialRequestPending(!saved); setBusy(true); onBusyChange(true); setPending(input); setNotice('Saving discussion setting…');
    try {
      const result = adminDiscussionConfirmation(await requestJson<unknown>(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Dune-Admin-Id': accountId }, body: JSON.stringify(input),
      }), code, input);
      clearAdminDiscussionRequest(window.sessionStorage, accountId, code);
      if (alive.current) {
        setPending(null); setRoom(result.room); setTarget(''); setConfirmed(false); setConfirmationCode(''); setReason('');
        setNotice(result.replayed ? 'The original request was already recorded. Current discussion settings are shown below; later changes have been preserved.' :
          input.muted ? 'Discussion muted for this seat. The player can still read messages and play. Saved-message retries can confirm earlier sends.' : 'Discussion unmuted for this seat. New messages are available again when the room is open.');
        onUpdated();
      }
    } catch (error) {
      let cleared = false;
      if (!retainAdminRoomRequest(error)) {
        try { clearAdminDiscussionRequest(window.sessionStorage, accountId, code); cleared = true; } catch { /* Preserve exact retry after storage failure. */ }
      }
      if (alive.current) {
        if (cleared) setPending(null);
        setConfirmed(false); setConfirmationCode('');
        setNotice(requestMayHaveCompleted(error) ? `${message(error)} The change may have been saved. Use Retry saved request to confirm.` : message(error));
        if (error instanceof ClientRequestError && [401, 403].includes(error.status ?? 0)) onDenied();
        else try {
          const current = adminDiscussionResponse(await requestJson<unknown>(url, { cache: 'no-store', headers: { 'X-Dune-Admin-Id': accountId } }), code);
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
      clearAdminDiscussionRequest(window.sessionStorage, accountId, code); setStorageProblem(false); setConfirmed(false);
      setNotice('Local retry record removed. This did not undo any server change. Review current discussion settings before continuing.');
    } catch (error) { setNotice(message(error)); }
  }

  return <section className="admin-room-control" aria-labelledby="admin-discussion-title" aria-busy={loading || busy}>
    <div className="admin-section-heading"><h2 id="admin-discussion-title" ref={title} tabIndex={-1}>Discussion controls · {code}</h2><Button variant="outline" disabled={busy} onClick={onClose}>Close discussion controls</Button></div>
    {notice && <output className="admin-notice">{notice}</output>}
    {loading ? <output>Loading participant discussion…</output> : <>
      {room ? <>
        <p>Room: <strong>{room.removed ? 'Removed' : room.archived ? 'Archived' : room.closed ? 'Closed' : 'Open'}</strong>. Game: <strong>{room.status}</strong>.</p>
        <p>Mute blocks new public and private messages from a seat. Its owner can still read discussion, receive messages and play. Existing messages stay saved; this panel cannot read them.</p>
        {room.closed && <p>The room is closed to all new messages. These settings also apply when it reopens.</p>}
        {room.players.length > 0 && <ul>{room.players.map(player => <li key={player.id}>{player.name} · {FACTIONS.find(faction => faction.id === player.faction)?.name ?? player.faction} · {player.control === 'ai' ? 'AI seat — no discussion' : player.muted ? 'Discussion muted' : 'Discussion allowed'}</li>)}</ul>}
        <Button variant="outline" disabled={busy} onClick={() => void refresh()}>Refresh discussion settings</Button>
      </> : <Button disabled={busy} onClick={() => void refresh()}>Retry loading discussion settings</Button>}
      {!canManage ? <p>Your viewer role can inspect these settings. An owner or operator can mute or unmute a seat.</p> : storageProblem ? <div className="admin-confirm">
        <p>No new changes can be sent until this tab’s unreadable retry record is resolved. Discarding the record does not cancel a server change.</p>
        <label className="admin-check"><input type="checkbox" checked={confirmed} disabled={busy || !room} onChange={event => setConfirmed(event.target.checked)} />I have inspected room {code} and want to remove its local retry record.</label>
        <Button disabled={busy || !room || !confirmed} onClick={discardUnreadableRecord}>Discard unreadable local record</Button>
      </div> : initialRequestPending ? null : pending ? <div className="admin-confirm">
        <p>Saved request: <strong>{pending.muted ? 'Mute' : 'Unmute'} discussion</strong> for <strong>{room?.players.find(player => player.id === pending.target)?.name ?? pending.target}</strong> in room <strong>{code}</strong>.</p><p>Reason: {pending.reason}</p>
        <p>The exact request stays in this tab across refresh. Retrying confirms the original change without applying it again, even if another administrator changed the setting afterward.</p>
        <p>After refresh or sign-in, use All rooms in both directory filters to find later removed or archived rooms and reopen Discussion controls.</p>
        <Button disabled={busy} onClick={() => void submit(pending)}>Retry saved request</Button>
      </div> : room && !room.editable ? <p>{room.blockedReason}</p> : room && !room.players.some(player => player.control !== 'ai') ? <p>No human seats are available for discussion moderation.</p> : room && <form onSubmit={event => { event.preventDefault(); void submit(); }}>
        <label htmlFor="admin-discussion-target">Participant<select id="admin-discussion-target" required value={target} disabled={busy} onChange={event => { setTarget(event.target.value); setConfirmed(false); }}>
          <option value="">Choose a human seat</option>{room.players.filter(player => player.control !== 'ai').map(player => <option key={player.id} value={player.id}>{player.name} · {FACTIONS.find(faction => faction.id === player.faction)?.name ?? player.faction} · {player.muted ? 'Muted' : 'Allowed'}</option>)}
        </select></label>
        <label htmlFor="admin-discussion-reason">Reason for the audit history<Input id="admin-discussion-reason" value={reason} maxLength={300} required disabled={busy} onChange={event => { setReason(event.target.value); setConfirmed(false); }} /></label>
        <p className="admin-secondary">Use a short operational reason. Do not copy private messages, credentials or private game information.</p>
        <div className="admin-confirm">
          <p>{selected ? `${selected.muted ? 'Unmute' : 'Mute'} discussion for ${selected.name}.` : 'Choose a participant above.'} The setting follows this game seat through recovery and handover. A later owner inherits it until an administrator changes it.</p>
          <p>Game decisions, AI control, seat access, recovery and saved messages remain unchanged. Previously saved sends can still be confirmed.</p>
          <label htmlFor="admin-discussion-code">Type {code} to confirm this room<Input id="admin-discussion-code" value={confirmationCode} maxLength={8} autoComplete="off" autoCapitalize="characters" spellCheck={false} disabled={busy} onChange={event => { setConfirmationCode(event.target.value); setConfirmed(false); }} /></label>
          <label className="admin-check"><input type="checkbox" checked={confirmed} disabled={busy || !selected} onChange={event => setConfirmed(event.target.checked)} />I have reviewed this seat and understand how its discussion setting affects current and future owners.</label>
          <Button type="submit" disabled={busy || !selected || !confirmed || !reason.trim() || confirmationCode !== code}>{selected?.muted ? 'Unmute discussion' : 'Mute discussion'}</Button>
        </div>
      </form>}
    </>}
  </section>;
}
