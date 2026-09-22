'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ClientRequestError, requestJson, requestMayHaveCompleted } from '@/lib/client-request';
import { retainAdminRoomRequest } from '@/lib/admin-room-control-client';
import { adminClosureResponse, adminClosureConfirmation, clearAdminClosureRequest, newAdminClosureRequest, readAdminClosureRequest, saveAdminClosureRequest } from '@/lib/admin-closure-client';
import type { AdminClosureInput, AdminClosureView } from '@/lib/admin-closure';

type Props = {
  accountId: string; code: string; canManage: boolean; onClose: () => void;
  onUpdated: () => void; onDenied: () => void; onBusyChange: (busy: boolean) => void;
};
const message = (error: unknown) => error instanceof Error ? error.message : 'Room availability could not be loaded.';

export function AdminRoomClosure({ accountId, code, canManage, onClose, onUpdated, onDenied, onBusyChange }: Props) {
  const [room, setRoom] = useState<AdminClosureView | null>(null);
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [confirmationCode, setConfirmationCode] = useState('');
  const [pending, setPending] = useState<AdminClosureInput | null>(null);
  const [storageProblem, setStorageProblem] = useState(false);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const alive = useRef(false), inFlight = useRef(false);
  const title = useRef<HTMLHeadingElement>(null);
  const url = `/api/admin/rooms/${code}/closure`;

  useEffect(() => {
    alive.current = true; title.current?.focus();
    let canceled = false;
    try {
      const saved = readAdminClosureRequest(window.sessionStorage, accountId, code);
      // oxlint-disable-next-line react/react-compiler -- Restore the account/room's tab-scoped request after SSR.
      setPending(saved);
      if (saved) setNotice('A saved closure or reopening request needs confirmation. Review it below, then retry the same request.');
    } catch (error) { setStorageProblem(true); setNotice(message(error)); }
    requestJson<unknown>(url, { cache: 'no-store', headers: { 'X-Dune-Admin-Id': accountId } })
      .then(result => { const current = adminClosureResponse(result, code); if (!canceled) setRoom(current); })
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
      const current = adminClosureResponse(await requestJson<unknown>(url, { cache: 'no-store', headers: { 'X-Dune-Admin-Id': accountId } }), code);
      if (alive.current) { setRoom(current); setConfirmed(false); setConfirmationCode(''); }
    } catch (error) {
      if (alive.current) {
        setNotice(message(error));
        if (error instanceof ClientRequestError && [401, 403].includes(error.status ?? 0)) onDenied();
      }
    } finally { inFlight.current = false; onBusyChange(false); if (alive.current) setBusy(false); }
  }

  async function submit(saved?: AdminClosureInput) {
    if (inFlight.current || loading || !canManage || storageProblem ||
        (!saved && (!room || room.removed || pending || !confirmed || (!room.closed && confirmationCode !== code)))) return;
    let input: AdminClosureInput;
    try {
      input = saved ?? newAdminClosureRequest(room!, !room!.closed, reason);
      saveAdminClosureRequest(window.sessionStorage, accountId, code, input);
    } catch (error) { setNotice(message(error)); return; }
    inFlight.current = true; setBusy(true); onBusyChange(true); setPending(input); setNotice(input.closed ? 'Closing room…' : 'Reopening room…');
    try {
      const result = adminClosureConfirmation(await requestJson<unknown>(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Dune-Admin-Id': accountId }, body: JSON.stringify(input),
      }), code, input);
      clearAdminClosureRequest(window.sessionStorage, accountId, code);
      if (alive.current) {
        setPending(null); setRoom(result.room); setConfirmed(false); setConfirmationCode(''); setReason('');
        setNotice(result.replayed ? 'The original request was already recorded. Current room availability is shown below.' :
          input.closed ? 'Room closed to further play. Existing players can still read their saved table and discussion.' : 'Room reopened with its saved game, seats and previous pause and joining settings.');
        onUpdated();
      }
    } catch (error) {
      let cleared = false;
      if (!retainAdminRoomRequest(error)) {
        try { clearAdminClosureRequest(window.sessionStorage, accountId, code); cleared = true; } catch { /* Keep the exact retry after storage failure. */ }
      }
      if (alive.current) {
        if (cleared) setPending(null);
        setConfirmed(false); setConfirmationCode('');
        setNotice(requestMayHaveCompleted(error) ? `${message(error)} The change may have been saved. Use Retry saved request to confirm.` : message(error));
        if (error instanceof ClientRequestError && [401, 403].includes(error.status ?? 0)) onDenied();
        else try {
          const current = adminClosureResponse(await requestJson<unknown>(url, { cache: 'no-store', headers: { 'X-Dune-Admin-Id': accountId } }), code);
          if (alive.current) setRoom(current);
        } catch { /* Preserve the original outcome and saved retry. */ }
      }
    } finally { inFlight.current = false; onBusyChange(false); if (alive.current) setBusy(false); }
  }

  function discardUnreadableRecord() {
    if (!canManage || !room || !confirmed || busy) return;
    try {
      clearAdminClosureRequest(window.sessionStorage, accountId, code); setStorageProblem(false); setConfirmed(false);
      setNotice('Local retry record removed. This did not undo any server change. Review current room availability before continuing.');
    } catch (error) { setNotice(message(error)); }
  }

  return <section className="admin-room-control" aria-labelledby="admin-closure-title" aria-busy={loading || busy}>
    <div className="admin-section-heading"><h2 id="admin-closure-title" ref={title} tabIndex={-1}>Close or reopen · {code}</h2><Button variant="outline" disabled={busy} onClick={onClose}>Close room availability controls</Button></div>
    {notice && <output className="admin-notice">{notice}</output>}
    {loading ? <output>Loading room availability…</output> : <>
      {room ? <>
        <p>Current availability: <strong>{room.closed ? 'Closed' : 'Open'}</strong>. Saved pause setting: <strong>{room.paused ? 'Paused' : 'Running'}</strong> · New joins <strong>{room.joinLocked ? 'locked' : 'open'}</strong>.</p>
        {room.closed && <p>The table and discussion history remain readable to existing players. New play, messages and seat changes are stopped.</p>}
        {room.closedAt !== null && <p className="admin-secondary">Closed at: <time dateTime={new Date(room.closedAt).toISOString()}>{new Date(room.closedAt).toLocaleString()}</time>.</p>}
        <Button variant="outline" disabled={busy} onClick={() => void refresh()}>Refresh room availability</Button>
      </> : <Button disabled={busy} onClick={() => void refresh()}>Retry loading room availability</Button>}
      {!canManage ? <p>Your viewer role can inspect room availability. An owner or operator can close or reopen rooms.</p> : storageProblem ? <div className="admin-confirm">
        <p>No new changes can be sent until this tab’s unreadable retry record is resolved. Discarding the record does not cancel a change already saved on the server.</p>
        <label className="admin-check"><input type="checkbox" checked={confirmed} disabled={busy || !room} onChange={e => setConfirmed(e.target.checked)} />I have inspected room {code} and want to remove its local retry record.</label>
        <Button disabled={busy || !room || !confirmed} onClick={discardUnreadableRecord}>Discard unreadable local record</Button>
      </div> : pending ? <div className="admin-confirm">
        <p>Saved request: <strong>{pending.closed ? 'Close' : 'Reopen'} room {code}</strong>.</p><p>Reason: {pending.reason}</p>
        <p>The exact request stays in this tab across refresh and reopening these controls. Retrying confirms a completed change without applying it again. Current availability can differ if another administrator changed the room afterward.</p>
        <p>After refreshing the page or signing in again, choose All rooms in the Directory filter to find this room and reopen these controls.</p>
        <Button disabled={busy} onClick={() => void submit(pending)}>Retry saved request</Button>
      </div> : room?.removed ? <p>Restore this removed room before changing its closure. Any saved close/reopen request can still be confirmed above.</p> : room && <form onSubmit={event => { event.preventDefault(); void submit(); }}>
        <label htmlFor="admin-closure-reason">Reason for the audit history<Input id="admin-closure-reason" value={reason} maxLength={300} required disabled={busy} onChange={e => { setReason(e.target.value); setConfirmed(false); }} /></label>
        <p className="admin-secondary">Use a short operational reason. Do not include credentials or private game information.</p>
        <div className="admin-confirm">
          {room.closed ? <>
            <p>Reopen play in room <strong>{code}</strong>. Saved progress and seats are retained, and current credentials and access revocations remain in effect.</p>
            <p>Reopening preserves the previous pause and joining settings. {room.paused ? 'This room will remain paused.' : 'This room will resume with the existing AI pace.'} New joins will remain {room.joinLocked ? 'locked' : 'open'}.</p>
          </> : <>
            <p>Close room <strong>{code}</strong> to further play. This stops joining, game decisions, AI, new messages and seat security changes. Existing players can still read their own table and discussion history.</p>
            <p>Warn active players before interrupting their game. Closing preserves the exact pending game and seats. It does not award a winner. An administrator can reopen it later.</p>
            <label htmlFor="admin-closure-code">Type {code} to confirm this room<Input id="admin-closure-code" value={confirmationCode} maxLength={8} autoComplete="off" autoCapitalize="characters" spellCheck={false} disabled={busy} onChange={e => { setConfirmationCode(e.target.value); setConfirmed(false); }} /></label>
          </>}
          <label className="admin-check"><input type="checkbox" checked={confirmed} disabled={busy} onChange={e => setConfirmed(e.target.checked)} />{room.closed ? `I have reviewed room ${code} and its saved pause setting and am ready to reopen it.` : `I have checked room ${code}, warned active players, and am ready to close it.`}</label>
          <Button type="submit" disabled={busy || !confirmed || !reason.trim() || (!room.closed && confirmationCode !== code)}>{room.closed ? 'Reopen room' : 'Close room'}</Button>
        </div>
      </form>}
    </>}
  </section>;
}
