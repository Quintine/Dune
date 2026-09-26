'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ClientRequestError, requestJson, requestMayHaveCompleted } from '@/lib/client-request';
import { clearAdminRoomRequest, newAdminRoomRequest, readAdminRoomRequest, retainAdminRoomRequest, saveAdminRoomRequest } from '@/lib/admin-room-control-client';
import type { AdminRoomControlInput, RoomControl } from '@/lib/room-control';

type Props = {
  accountId: string;
  code: string;
  canManage: boolean;
  onClose: () => void;
  onUpdated: () => void;
  onDenied: () => void;
  onBusyChange: (busy: boolean) => void;
};
const message = (error: unknown) => error instanceof Error ? error.message : 'The room settings could not be loaded.';
function controlResponse(value: RoomControl): RoomControl {
  if (!value || typeof value.paused !== 'boolean' || typeof value.joinLocked !== 'boolean' ||
      !Number.isSafeInteger(value.revision) || value.revision < 0 ||
      !(value.updatedAt === null || Number.isSafeInteger(value.updatedAt))) throw new Error('The server returned unreadable room settings.');
  return value;
}

export function AdminRoomControls({ accountId, code, canManage, onClose, onUpdated, onDenied, onBusyChange }: Props) {
  const [control, setControl] = useState<RoomControl | null>(null);
  const [paused, setPaused] = useState(false);
  const [joinLocked, setJoinLocked] = useState(false);
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [pending, setPending] = useState<AdminRoomControlInput | null>(null);
  const [storageProblem, setStorageProblem] = useState(false);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [initialRequestPending, setInitialRequestPending] = useState(false);
  const [loading, setLoading] = useState(true);
  const alive = useRef(false);
  const title = useRef<HTMLHeadingElement>(null);
  const inFlight = useRef(false);
  const url = `/api/admin/rooms/${code}/control`;

  useEffect(() => {
    alive.current = true;
    title.current?.focus();
    let canceled = false;
    try {
      const saved = readAdminRoomRequest(window.sessionStorage, accountId, code);
      // oxlint-disable-next-line react/react-compiler -- Restore this account/room's tab-scoped request after SSR.
      setPending(saved);
      if (saved) setNotice('A saved request needs confirmation. Review the current settings, then retry the same request.');
    } catch (error) { setStorageProblem(true); setNotice(message(error)); }
    requestJson<RoomControl>(url, { cache: 'no-store', headers: { 'X-Dune-Admin-Id': accountId } })
      .then(result => {
        const current = controlResponse(result);
        if (!canceled) { setControl(current); setPaused(current.paused); setJoinLocked(current.joinLocked); }
      })
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
      const current = controlResponse(await requestJson<RoomControl>(url, { cache: 'no-store', headers: { 'X-Dune-Admin-Id': accountId } }));
      if (alive.current) { setControl(current); setPaused(current.paused); setJoinLocked(current.joinLocked); setConfirmed(false); }
    } catch (error) {
      if (alive.current) {
        setNotice(message(error));
        if (error instanceof ClientRequestError && [401, 403].includes(error.status ?? 0)) onDenied();
      }
    } finally { inFlight.current = false; onBusyChange(false); if (alive.current) setBusy(false); }
  }

  async function submit(saved?: AdminRoomControlInput) {
    if (inFlight.current || !control || !canManage || storageProblem || (!saved && !confirmed)) return;
    let input: AdminRoomControlInput;
    try {
      input = saved ?? newAdminRoomRequest(control, paused, joinLocked, reason);
      saveAdminRoomRequest(window.sessionStorage, accountId, code, input);
    } catch (error) { setNotice(message(error)); return; }
    inFlight.current = true; setInitialRequestPending(!saved); setBusy(true); onBusyChange(true); setPending(input); setNotice('Saving room settings…');
    try {
      const result = await requestJson<RoomControl & { replayed: boolean }>(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Dune-Admin-Id': accountId }, body: JSON.stringify(input),
      });
      const current = controlResponse(result);
      if (typeof result.replayed !== 'boolean') throw new Error('The server did not confirm this operation.');
      clearAdminRoomRequest(window.sessionStorage, accountId, code);
      if (alive.current) {
        setPending(null); setControl(current); setPaused(current.paused); setJoinLocked(current.joinLocked);
        setConfirmed(false); setReason('');
        setNotice(result.replayed ? 'The original request was already recorded. Current settings are shown below.' : 'Room settings saved.');
        onUpdated();
      }
    } catch (error) {
      const uncertain = requestMayHaveCompleted(error);
      let cleared = false;
      if (!retainAdminRoomRequest(error)) {
        try { clearAdminRoomRequest(window.sessionStorage, accountId, code); cleared = true; } catch { /* Keep exact retry after storage failure. */ }
      }
      if (alive.current) {
        if (cleared) setPending(null);
        setConfirmed(false);
        setNotice(uncertain ? `${message(error)} The change may have been saved. Use Retry saved request to confirm; no new request has been sent.` : message(error));
        if (error instanceof ClientRequestError && [401, 403].includes(error.status ?? 0)) onDenied();
        else {
          try {
            const current = controlResponse(await requestJson<RoomControl>(url, { cache: 'no-store', headers: { 'X-Dune-Admin-Id': accountId } }));
            if (alive.current) { setControl(current); setPaused(current.paused); setJoinLocked(current.joinLocked); }
          } catch { /* Preserve the original outcome and retry instructions. */ }
        }
      }
    } finally { inFlight.current = false; onBusyChange(false); if (alive.current) { setInitialRequestPending(false); setBusy(false); } }
  }

  function discardUnreadableRecord() {
    if (!confirmed || busy) return;
    try {
      clearAdminRoomRequest(window.sessionStorage, accountId, code);
      setStorageProblem(false); setConfirmed(false);
      setNotice('Local retry record removed. This did not undo any server change. Review the current settings before continuing.');
    } catch (error) { setNotice(message(error)); }
  }

  const changed = control && (control.paused !== paused || control.joinLocked !== joinLocked);
  return <section className="admin-room-control" aria-labelledby="admin-room-control-title" aria-busy={loading || busy}>
    <div className="admin-section-heading"><h2 id="admin-room-control-title" ref={title} tabIndex={-1}>Room {code}</h2><Button variant="outline" disabled={busy} onClick={onClose}>Close room controls</Button></div>
    {notice && <output className="admin-notice">{notice}</output>}
    {loading ? <output>Loading current room settings…</output> : !control ? <Button disabled={busy} onClick={() => void refresh()}>Retry loading settings</Button> : <>
      <p>Current status: <strong>{control.closed ? 'Closed' : control.paused ? 'Paused' : 'Running'}</strong> · New joins <strong>{control.joinLocked ? 'locked' : 'open'}</strong>.</p>
      <p>Pause stops player decisions, automatic effects and AI play. The pending game stays saved. Discussion, seat recovery and taking back control remain available.</p>
      <p>A joining lock blocks new players. Existing players can reconnect or recover their seats.</p>
      <Button variant="outline" disabled={busy} onClick={() => void refresh()}>Refresh current settings</Button>
      {!canManage ? <p>Your viewer role can inspect settings. An owner or operator can change them.</p> : storageProblem ? <div className="admin-confirm">
        <p>No new changes can be sent until this tab’s unreadable retry record is resolved. Removing it does not cancel a change already saved on the server.</p>
        <label className="admin-check"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />I have inspected the current settings and want to remove the local retry record.</label>
        <Button disabled={busy || !confirmed} onClick={discardUnreadableRecord}>Discard unreadable local record</Button>
      </div> : initialRequestPending ? null : pending ? <div className="admin-confirm">
        <p>Saved request: {pending.paused ? 'pause' : 'resume'} room {code}; {pending.joinLocked ? 'lock' : 'open'} new joins.</p>
        <p>Reason: {pending.reason}</p>
        <p>The exact request is kept in this tab across refresh. Retrying confirms an already completed operation without applying it again.</p>
        <Button disabled={busy} onClick={() => void submit(pending)}>Retry saved request</Button>
      </div> : control.closed ? <p>Reopen this room before changing pause or joining settings. Existing settings are preserved while closed.</p> : <form onSubmit={event => { event.preventDefault(); void submit(); }}>
        <label className="admin-check"><input type="checkbox" checked={paused} disabled={busy} onChange={e => { setPaused(e.target.checked); setConfirmed(false); }} />Pause this room</label>
        <label className="admin-check"><input type="checkbox" checked={joinLocked} disabled={busy} onChange={e => { setJoinLocked(e.target.checked); setConfirmed(false); }} />Lock new joins</label>
        <label htmlFor="admin-room-reason">Reason for the audit history<Input id="admin-room-reason" value={reason} maxLength={300} required disabled={busy} onChange={e => setReason(e.target.value)} /></label>
        <p className="admin-secondary">Use a short operational reason. Do not include credentials or private game information.</p>
        <div className="admin-confirm">
          <p>This affects every player in room <strong>{code}</strong>. Warn active players before interrupting their game. Resuming keeps the pending choices and restarts AI pacing.</p>
          <label className="admin-check"><input type="checkbox" checked={confirmed} disabled={busy || !changed} onChange={e => setConfirmed(e.target.checked)} />I have checked this room and am ready to apply these settings.</label>
          <Button type="submit" disabled={busy || !changed || !confirmed || !reason.trim()}>Apply room settings</Button>
        </div>
      </form>}
    </>}
  </section>;
}
