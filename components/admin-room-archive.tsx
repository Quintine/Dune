'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ClientRequestError, requestJson, requestMayHaveCompleted } from '@/lib/client-request';
import { retainAdminRoomRequest } from '@/lib/admin-room-control-client';
import { adminArchiveResponse, adminArchiveConfirmation, clearAdminArchiveRequest, newAdminArchiveRequest, readAdminArchiveRequest, saveAdminArchiveRequest } from '@/lib/admin-archive-client';
import type { AdminArchiveInput, AdminArchiveView } from '@/lib/admin-archive';

type Props = {
  accountId: string; code: string; canManage: boolean; onClose: () => void;
  onUpdated: () => void; onDenied: () => void; onBusyChange: (busy: boolean) => void;
};
const message = (error: unknown) => error instanceof Error ? error.message : 'Room availability could not be loaded.';

export function AdminRoomArchive({ accountId, code, canManage, onClose, onUpdated, onDenied, onBusyChange }: Props) {
  const [room, setRoom] = useState<AdminArchiveView | null>(null);
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [confirmationCode, setConfirmationCode] = useState('');
  const [pending, setPending] = useState<AdminArchiveInput | null>(null);
  const [storageProblem, setStorageProblem] = useState(false);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const alive = useRef(false), inFlight = useRef(false);
  const title = useRef<HTMLHeadingElement>(null);
  const url = `/api/admin/rooms/${code}/archive`;

  useEffect(() => {
    alive.current = true; title.current?.focus();
    let canceled = false;
    try {
      const saved = readAdminArchiveRequest(window.sessionStorage, accountId, code);
      // oxlint-disable-next-line react/react-compiler -- Restore the account/room's tab-scoped request after SSR.
      setPending(saved);
      if (saved) setNotice('A saved archive or unarchive request needs confirmation. Review it below, then retry the same request.');
    } catch (error) { setStorageProblem(true); setNotice(message(error)); }
    requestJson<unknown>(url, { cache: 'no-store', headers: { 'X-Dune-Admin-Id': accountId } })
      .then(result => { const current = adminArchiveResponse(result, code); if (!canceled) setRoom(current); })
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
      const current = adminArchiveResponse(await requestJson<unknown>(url, { cache: 'no-store', headers: { 'X-Dune-Admin-Id': accountId } }), code);
      if (alive.current) { setRoom(current); setConfirmed(false); setConfirmationCode(''); }
    } catch (error) {
      if (alive.current) {
        setNotice(message(error));
        if (error instanceof ClientRequestError && [401, 403].includes(error.status ?? 0)) onDenied();
      }
    } finally { inFlight.current = false; onBusyChange(false); if (alive.current) setBusy(false); }
  }

  async function submit(saved?: AdminArchiveInput) {
    if (inFlight.current || loading || !canManage || storageProblem ||
        (!saved && (!room || room.removed || !room.closed || pending || !confirmed || (!room.archived && confirmationCode !== code)))) return;
    let input: AdminArchiveInput;
    try {
      input = saved ?? newAdminArchiveRequest(room!, !room!.archived, reason);
      saveAdminArchiveRequest(window.sessionStorage, accountId, code, input);
    } catch (error) { setNotice(message(error)); return; }
    inFlight.current = true; setBusy(true); onBusyChange(true); setPending(input); setNotice(input.archived ? 'Archiving room…' : 'Unarchiving room…');
    try {
      const result = adminArchiveConfirmation(await requestJson<unknown>(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Dune-Admin-Id': accountId }, body: JSON.stringify(input),
      }), code, input);
      clearAdminArchiveRequest(window.sessionStorage, accountId, code);
      if (alive.current) {
        setPending(null); setRoom(result.room); setConfirmed(false); setConfirmationCode(''); setReason('');
        setNotice(result.replayed ? 'The original request was already recorded. Current room availability is shown below.' :
          input.archived ? 'Room archived. It remains closed and readable to existing players. Find it with the Archive filter.' : 'Room unarchived. It remains closed until an administrator separately reopens it.');
        onUpdated();
      }
    } catch (error) {
      let cleared = false;
      if (!retainAdminRoomRequest(error)) {
        try { clearAdminArchiveRequest(window.sessionStorage, accountId, code); cleared = true; } catch { /* Keep the exact retry after storage failure. */ }
      }
      if (alive.current) {
        if (cleared) setPending(null);
        setConfirmed(false); setConfirmationCode('');
        setNotice(requestMayHaveCompleted(error) ? `${message(error)} The change may have been saved. Use Retry saved request to confirm.` : message(error));
        if (error instanceof ClientRequestError && [401, 403].includes(error.status ?? 0)) onDenied();
        else try {
          const current = adminArchiveResponse(await requestJson<unknown>(url, { cache: 'no-store', headers: { 'X-Dune-Admin-Id': accountId } }), code);
          if (alive.current) setRoom(current);
        } catch { /* Preserve the original outcome and saved retry. */ }
      }
    } finally { inFlight.current = false; onBusyChange(false); if (alive.current) setBusy(false); }
  }

  function discardUnreadableRecord() {
    if (!canManage || !room || !confirmed || busy) return;
    try {
      clearAdminArchiveRequest(window.sessionStorage, accountId, code); setStorageProblem(false); setConfirmed(false);
      setNotice('Local retry record removed. This did not undo any server change. Review current room availability before continuing.');
    } catch (error) { setNotice(message(error)); }
  }

  return <section className="admin-room-control" aria-labelledby="admin-archive-title" aria-busy={loading || busy}>
    <div className="admin-section-heading"><h2 id="admin-archive-title" ref={title} tabIndex={-1}>Archive or unarchive · {code}</h2><Button variant="outline" disabled={busy} onClick={onClose}>Close archive controls</Button></div>
    {notice && <output className="admin-notice">{notice}</output>}
    {loading ? <output>Loading room archive…</output> : <>
      {room ? <>
        <p>Archive status: <strong>{room.archived ? 'Archived' : 'Unarchived'}</strong>. Room availability: <strong>{room.removed ? 'Removed' : room.closed ? 'Closed' : 'Open'}</strong>.</p>
        <p>Archiving organizes a closed room without changing its saved game, credentials or discussion. Existing players keep their readable table and history.</p>
        {room.archivedAt !== null && <p className="admin-secondary">Archived at: <time dateTime={new Date(room.archivedAt).toISOString()}>{new Date(room.archivedAt).toLocaleString()}</time>.</p>}
        <Button variant="outline" disabled={busy} onClick={() => void refresh()}>Refresh archive status</Button>
      </> : <Button disabled={busy} onClick={() => void refresh()}>Retry loading archive status</Button>}
      {!canManage ? <p>Your viewer role can inspect archive status. An owner or operator can archive or unarchive rooms.</p> : storageProblem ? <div className="admin-confirm">
        <p>No new changes can be sent until this tab’s unreadable retry record is resolved. Discarding the record does not cancel a server change.</p>
        <label className="admin-check"><input type="checkbox" checked={confirmed} disabled={busy || !room} onChange={e => setConfirmed(e.target.checked)} />I have inspected room {code} and want to remove its local retry record.</label>
        <Button disabled={busy || !room || !confirmed} onClick={discardUnreadableRecord}>Discard unreadable local record</Button>
      </div> : pending ? <div className="admin-confirm">
        <p>Saved request: <strong>{pending.archived ? 'Archive' : 'Unarchive'} room {code}</strong>.</p><p>Reason: {pending.reason}</p>
        <p>The exact request stays in this tab across refresh. Retrying confirms the original change without applying it again; the current archive status may differ after another administrator’s action.</p>
        <p>After refresh or sign-in, choose All rooms in both the Directory and Archive filters to find the room and reopen these controls.</p>
        <Button disabled={busy} onClick={() => void submit(pending)}>Retry saved request</Button>
      </div> : room?.removed ? <p>Restore this removed room before changing its archive status. Any saved archive request can still be confirmed above.</p> : room && !room.closed ? <p>Use Close or reopen to close this room before archiving it. Archiving does not interrupt play or assign an outcome.</p> : room && <form onSubmit={event => { event.preventDefault(); void submit(); }}>
        <label htmlFor="admin-archive-reason">Reason for the audit history<Input id="admin-archive-reason" value={reason} maxLength={300} required disabled={busy} onChange={e => { setReason(e.target.value); setConfirmed(false); }} /></label>
        <p className="admin-secondary">Use a short operational reason. Do not include credentials or private game information.</p>
        <div className="admin-confirm">
          {room.archived ? <>
            <p>Return room <strong>{code}</strong> to the unarchived directory. Its game, seats, history, pause and joining settings remain saved.</p>
            <p>Unarchiving leaves the room closed. Reopen it separately when play should resume.</p>
          </> : <>
            <p>Archive closed room <strong>{code}</strong>. It leaves the default administrator list and remains available under Archived rooms or All rooms in the Archive filter.</p>
            <p>Players can still read their saved table and history. The room stays closed to further play; archiving does not delete it or change its winner.</p>
            <label htmlFor="admin-archive-code">Type {code} to confirm this room<Input id="admin-archive-code" value={confirmationCode} maxLength={8} autoComplete="off" autoCapitalize="characters" spellCheck={false} disabled={busy} onChange={e => { setConfirmationCode(e.target.value); setConfirmed(false); }} /></label>
          </>}
          <label className="admin-check"><input type="checkbox" checked={confirmed} disabled={busy} onChange={e => setConfirmed(e.target.checked)} />{room.archived ? `I have reviewed room ${code} and understand that unarchiving leaves it closed.` : `I have reviewed closed room ${code} and want to archive it.`}</label>
          <Button type="submit" disabled={busy || !confirmed || !reason.trim() || (!room.archived && confirmationCode !== code)}>{room.archived ? 'Unarchive room' : 'Archive room'}</Button>
        </div>
      </form>}
    </>}
  </section>;
}
