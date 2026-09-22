'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ClientRequestError, requestJson, requestMayHaveCompleted } from '@/lib/client-request';
import { retainAdminRoomRequest } from '@/lib/admin-room-control-client';
import { adminRemovalResponse, adminRemovalConfirmation, clearAdminRemovalRequest, newAdminRemovalRequest, readAdminRemovalRequest, saveAdminRemovalRequest } from '@/lib/admin-removal-client';
import type { AdminRemovalInput, AdminRemovalView } from '@/lib/admin-removal';

type Props = {
  accountId: string; code: string; canManage: boolean; onClose: () => void;
  onUpdated: () => void; onDenied: () => void; onBusyChange: (busy: boolean) => void;
};
const message = (error: unknown) => error instanceof Error ? error.message : 'Room availability could not be loaded.';

export function AdminRoomRemoval({ accountId, code, canManage, onClose, onUpdated, onDenied, onBusyChange }: Props) {
  const [room, setRoom] = useState<AdminRemovalView | null>(null);
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [confirmationCode, setConfirmationCode] = useState('');
  const [pending, setPending] = useState<AdminRemovalInput | null>(null);
  const [storageProblem, setStorageProblem] = useState(false);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const alive = useRef(false), inFlight = useRef(false);
  const title = useRef<HTMLHeadingElement>(null);
  const url = `/api/admin/rooms/${code}/removal`;

  useEffect(() => {
    alive.current = true; title.current?.focus();
    let canceled = false;
    try {
      const saved = readAdminRemovalRequest(window.sessionStorage, accountId, code);
      // oxlint-disable-next-line react/react-compiler -- Restore the account/room's tab-scoped request after SSR.
      setPending(saved);
      if (saved) setNotice('A saved removal or restoration request needs confirmation. Review it below, then retry the same request.');
    } catch (error) { setStorageProblem(true); setNotice(message(error)); }
    requestJson<unknown>(url, { cache: 'no-store', headers: { 'X-Dune-Admin-Id': accountId } })
      .then(result => { const current = adminRemovalResponse(result, code); if (!canceled) setRoom(current); })
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
      const current = adminRemovalResponse(await requestJson<unknown>(url, { cache: 'no-store', headers: { 'X-Dune-Admin-Id': accountId } }), code);
      if (alive.current) { setRoom(current); setConfirmed(false); setConfirmationCode(''); }
    } catch (error) {
      if (alive.current) {
        setNotice(message(error));
        if (error instanceof ClientRequestError && [401, 403].includes(error.status ?? 0)) onDenied();
      }
    } finally { inFlight.current = false; onBusyChange(false); if (alive.current) setBusy(false); }
  }

  async function submit(saved?: AdminRemovalInput) {
    if (inFlight.current || loading || !canManage || storageProblem ||
        (!saved && (!room || pending || !confirmed || (!room.removed && confirmationCode !== code)))) return;
    let input: AdminRemovalInput;
    try {
      input = saved ?? newAdminRemovalRequest(room!, !room!.removed, reason);
      saveAdminRemovalRequest(window.sessionStorage, accountId, code, input);
    } catch (error) { setNotice(message(error)); return; }
    inFlight.current = true; setBusy(true); onBusyChange(true); setPending(input); setNotice(input.removed ? 'Removing room…' : 'Restoring room…');
    try {
      const result = adminRemovalConfirmation(await requestJson<unknown>(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Dune-Admin-Id': accountId }, body: JSON.stringify(input),
      }), code, input);
      clearAdminRemovalRequest(window.sessionStorage, accountId, code);
      if (alive.current) {
        setPending(null); setRoom(result.room); setConfirmed(false); setConfirmationCode(''); setReason('');
        setNotice(result.replayed ? 'The original request was already recorded. Current room availability is shown below.' :
          input.removed ? 'Room removed from ordinary access. Its saved game and seats are preserved for restoration.' : 'Room restored with its saved game, seats and previous pause and joining settings.');
        onUpdated();
      }
    } catch (error) {
      let cleared = false;
      if (!retainAdminRoomRequest(error)) {
        try { clearAdminRemovalRequest(window.sessionStorage, accountId, code); cleared = true; } catch { /* Keep the exact retry after storage failure. */ }
      }
      if (alive.current) {
        if (cleared) setPending(null);
        setConfirmed(false); setConfirmationCode('');
        setNotice(requestMayHaveCompleted(error) ? `${message(error)} The change may have been saved. Use Retry saved request to confirm.` : message(error));
        if (error instanceof ClientRequestError && [401, 403].includes(error.status ?? 0)) onDenied();
        else try {
          const current = adminRemovalResponse(await requestJson<unknown>(url, { cache: 'no-store', headers: { 'X-Dune-Admin-Id': accountId } }), code);
          if (alive.current) setRoom(current);
        } catch { /* Preserve the original outcome and saved retry. */ }
      }
    } finally { inFlight.current = false; onBusyChange(false); if (alive.current) setBusy(false); }
  }

  function discardUnreadableRecord() {
    if (!canManage || !room || !confirmed || busy) return;
    try {
      clearAdminRemovalRequest(window.sessionStorage, accountId, code); setStorageProblem(false); setConfirmed(false);
      setNotice('Local retry record removed. This did not undo any server change. Review current room availability before continuing.');
    } catch (error) { setNotice(message(error)); }
  }

  return <section className="admin-room-control" aria-labelledby="admin-removal-title" aria-busy={loading || busy}>
    <div className="admin-section-heading"><h2 id="admin-removal-title" ref={title} tabIndex={-1}>Remove or restore · {code}</h2><Button variant="outline" disabled={busy} onClick={onClose}>Close removal controls</Button></div>
    {notice && <output className="admin-notice">{notice}</output>}
    {loading ? <output>Loading room availability…</output> : <>
      {room ? <>
        <p>Current availability: <strong>{room.removed ? 'Removed' : 'Active'}</strong>. Saved pause setting: <strong>{room.paused ? 'Paused' : 'Running'}</strong> · New joins <strong>{room.joinLocked ? 'locked' : 'open'}</strong>.</p>
        {room.removed && <p>Ordinary room access is unavailable. The game, seats and messages remain saved.</p>}
        {room.removedAt !== null && <p className="admin-secondary">Last removal: <time dateTime={new Date(room.removedAt).toISOString()}>{new Date(room.removedAt).toLocaleString()}</time>.</p>}
        <Button variant="outline" disabled={busy} onClick={() => void refresh()}>Refresh room availability</Button>
      </> : <Button disabled={busy} onClick={() => void refresh()}>Retry loading room availability</Button>}
      {!canManage ? <p>Your viewer role can inspect room availability. An owner or operator can remove or restore rooms.</p> : storageProblem ? <div className="admin-confirm">
        <p>No new changes can be sent until this tab’s unreadable retry record is resolved. Removing the record does not cancel a change already saved on the server.</p>
        <label className="admin-check"><input type="checkbox" checked={confirmed} disabled={busy || !room} onChange={e => setConfirmed(e.target.checked)} />I have inspected room {code} and want to remove its local retry record.</label>
        <Button disabled={busy || !room || !confirmed} onClick={discardUnreadableRecord}>Discard unreadable local record</Button>
      </div> : pending ? <div className="admin-confirm">
        <p>Saved request: <strong>{pending.removed ? 'Remove' : 'Restore'} room {code}</strong>.</p><p>Reason: {pending.reason}</p>
        <p>The exact request stays in this tab across refresh and reopening these controls. Retrying confirms a completed change without applying it again. Current availability can differ if another administrator changed the room afterward.</p>
        <p>After refreshing the page or signing in again, choose All rooms in the Directory filter to find this room and reopen these controls.</p>
        <Button disabled={busy} onClick={() => void submit(pending)}>Retry saved request</Button>
      </div> : room && <form onSubmit={event => { event.preventDefault(); void submit(); }}>
        <label htmlFor="admin-removal-reason">Reason for the audit history<Input id="admin-removal-reason" value={reason} maxLength={300} required disabled={busy} onChange={e => { setReason(e.target.value); setConfirmed(false); }} /></label>
        <p className="admin-secondary">Use a short operational reason. Do not include credentials or private game information.</p>
        <div className="admin-confirm">
          {room.removed ? <>
            <p>Restore ordinary access to room <strong>{code}</strong>. Saved progress and seats are retained, and current credentials and access revocations remain in effect.</p>
            <p>Restoration preserves the previous pause and joining settings. {room.closed && 'This room is also closed: restoration keeps it closed to further play until reopened.'} {room.closed ? 'AI remains stopped while closed.' : room.paused ? 'This room will remain paused.' : 'This room will resume with the existing AI pace.'} New joins will remain {room.joinLocked ? 'locked' : 'open'}.</p>
          </> : <>
            <p>Remove room <strong>{code}</strong> from ordinary access. This interrupts every player: private room access, joining, game actions, AI play, seat security changes and messages stop until restoration.</p>
            <p>Warn active players before interrupting their game. This recoverable removal keeps the saved game and seats for restoration.</p>
            <label htmlFor="admin-removal-code">Type {code} to confirm this room<Input id="admin-removal-code" value={confirmationCode} maxLength={8} autoComplete="off" autoCapitalize="characters" spellCheck={false} disabled={busy} onChange={e => { setConfirmationCode(e.target.value); setConfirmed(false); }} /></label>
          </>}
          <label className="admin-check"><input type="checkbox" checked={confirmed} disabled={busy} onChange={e => setConfirmed(e.target.checked)} />{room.removed ? `I have reviewed room ${code} and its saved pause setting and am ready to restore it.` : `I have checked room ${code}, warned active players, and am ready to remove it.`}</label>
          <Button type="submit" disabled={busy || !confirmed || !reason.trim() || (!room.removed && confirmationCode !== code)}>{room.removed ? 'Restore room' : 'Remove room'}</Button>
        </div>
      </form>}
    </>}
  </section>;
}
