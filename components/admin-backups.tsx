'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ClientRequestError, requestJson, requestMayHaveCompleted } from '@/lib/client-request';
import { randomId } from '@/lib/random-id';

type Backup = { id: string; roomCode: string; roomVersion: number; createdAt: number; sizeBytes: number; digest: string };
type Pending = { roomCode: string; operationId: string; expectedVersion: number; reason: string };
type Room = { code: string; version: number };
const codePattern = /^[A-Z2-9]{8}$/;
const idPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const message = (error: unknown) => error instanceof Error ? error.message : 'The backup request could not be completed.';
const storageKey = (accountId: string, code: string) => `dune.admin-backup-request.v1:${accountId}:${code}`;

function parsePending(raw: string | null, code: string): Pending | null {
  if (raw === null) return null;
  let value: unknown;
  try { value = raw.length <= 1024 ? JSON.parse(raw) : null; } catch { value = null; }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('This tab’s saved backup request is unreadable. Resolve the local record before creating another backup.');
  const record = value as Record<string, unknown>;
  if (Object.keys(record).length !== 4 || record.roomCode !== code || typeof record.operationId !== 'string' || !idPattern.test(record.operationId) ||
    !Number.isSafeInteger(record.expectedVersion) || Number(record.expectedVersion) < 0 || typeof record.reason !== 'string' ||
    record.reason.length > 300 || !record.reason.trim() || /\p{Cc}/u.test(record.reason))
    throw new Error('This tab’s saved backup request is unreadable. Resolve the local record before creating another backup.');
  return record as Pending;
}

function readBackups(value: unknown, code: string): Backup[] {
  if (!value || typeof value !== 'object' || !('backups' in value) || !Array.isArray(value.backups)) throw new Error('The server returned an unreadable backup list.');
  const backups: unknown[] = value.backups;
  if (!backups.every(item => !!item && typeof item === 'object' &&
    'id' in item && typeof item.id === 'string' && idPattern.test(item.id) &&
    'roomCode' in item && item.roomCode === code &&
    'roomVersion' in item && Number.isSafeInteger(item.roomVersion) && Number(item.roomVersion) >= 0 &&
    'createdAt' in item && Number.isSafeInteger(item.createdAt) && Number(item.createdAt) >= 0 && Number(item.createdAt) <= 8_640_000_000_000_000 &&
    'sizeBytes' in item && Number.isSafeInteger(item.sizeBytes) && Number(item.sizeBytes) >= 0 &&
    'digest' in item && typeof item.digest === 'string' && /^[a-f0-9]{64}$/.test(item.digest)))
    throw new Error('The server returned unreadable backup metadata.');
  return backups as Backup[];
}

export function AdminBackups({ accountId, onDenied }: { accountId: string; onDenied: () => void }) {
  const [entry, setEntry] = useState('');
  const [code, setCode] = useState('');
  const [room, setRoom] = useState<Room | null>(null);
  const [backups, setBackups] = useState<Backup[] | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [storageProblem, setStorageProblem] = useState(false);
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const inFlight = useRef(false);
  const generation = useRef(0);
  const alive = useRef(true);
  useEffect(() => {
    const mounted = alive;
    const currentGeneration = generation;
    mounted.current = true;
    return () => { mounted.current = false; currentGeneration.current++; };
  }, []);
  const headers = { 'X-Dune-Admin-Id': accountId };

  async function readRoomAndList(selected: string): Promise<{ view: Room | null; list: Backup[] }> {
    const [view, response] = await Promise.all([
      requestJson<Room>(`/api/admin/rooms/${selected}/removal`, { cache: 'no-store', headers })
        .catch(error => {
          if (error instanceof ClientRequestError && error.status === 404) return null;
          throw error;
        }),
      requestJson<unknown>(`/api/admin/backups?room=${selected}`, { cache: 'no-store', headers }),
    ]);
    if (view && (view.code !== selected || !Number.isSafeInteger(view.version) || view.version < 0))
      throw new Error('The server returned an unreadable room version.');
    return { view, list: readBackups(response, selected) };
  }

  function reconcile(saved: Pending | null, list: Backup[]) {
    if (!saved) return false;
    const found = list.find(item => item.id === saved.operationId);
    if (!found) return false;
    if (found.roomVersion !== saved.expectedVersion) throw new Error('The saved operation has conflicting backup metadata. Do not retry it.');
    window.sessionStorage.removeItem(storageKey(accountId, saved.roomCode));
    setPending(null);
    setNotice('The saved operation is present in the backup list. No second snapshot was requested.');
    return true;
  }

  async function load(selected: string) {
    if (inFlight.current) return;
    inFlight.current = true; setLoading(true); setNotice('');
    const epoch = ++generation.current;
    setCode(selected); setRoom(null); setBackups(null); setPending(null); setStorageProblem(false); setConfirmed(false);
    try {
      let saved: Pending | null = null;
      let savedError: unknown = null;
      try { saved = parsePending(window.sessionStorage.getItem(storageKey(accountId, selected)), selected); }
      catch (error) { savedError = error; setStorageProblem(true); }
      const { view, list } = await readRoomAndList(selected);
      if (epoch !== generation.current || !alive.current) return;
      setRoom(view); setBackups(list); setPending(saved);
      if (savedError) setNotice(message(savedError));
      else if (saved && !reconcile(saved, list)) setNotice('The saved operation is not in the current list. Review the available room and list before manually retrying the exact request.');
    } catch (error) {
      if (epoch !== generation.current || !alive.current) return;
      if (error instanceof ClientRequestError && [401, 403].includes(error.status ?? 0)) onDenied();
      else {
        setNotice(message(error));
      }
    } finally { inFlight.current = false; if (epoch === generation.current && alive.current) setLoading(false); }
  }

  async function refresh() {
    if (inFlight.current || !code) return;
    inFlight.current = true; setBusy(true); setNotice('');
    try {
      const { view, list } = await readRoomAndList(code);
      if (alive.current) {
        setRoom(view); setBackups(list); setConfirmed(false);
        if (!reconcile(pending, list)) setNotice(pending ? 'The saved operation is not in the current list. Review it before a manual retry.' :
          view ? 'Current room version and backup list refreshed.' : 'Backup list refreshed. The live room is no longer available.');
      }
    } catch (error) {
      if (alive.current) {
        setRoom(null); setBackups(null);
        setNotice(message(error));
        if (error instanceof ClientRequestError && [401, 403].includes(error.status ?? 0)) onDenied();
      }
    } finally { inFlight.current = false; if (alive.current) setBusy(false); }
  }

  async function create(saved?: Pending) {
    if (inFlight.current || !backups || storageProblem || (!saved && (!room || pending || !confirmed || !reason.trim())) ||
        (saved && (!pending || saved.operationId !== pending.operationId || !confirmed))) return;
    inFlight.current = true; setBusy(true); setConfirmed(false);
    let input: Pending | null = null;
    let sent = false;
    try {
      // A fresh authoritative read precedes every POST. A changed version needs new explicit review.
      const latest = await readRoomAndList(code);
      if (!alive.current) return;
      setRoom(latest.view); setBackups(latest.list);
      if (saved && reconcile(saved, latest.list)) return;
      if (!saved && (!latest.view || latest.view.version !== room?.version)) {
        setNotice(latest.view ? 'The live room advanced since your review. Review the new version and confirm again; no snapshot was requested.' :
          'The live room is no longer available. Its existing snapshots can still be downloaded; no snapshot was requested.');
        return;
      }
      input = saved ?? { roomCode: code, operationId: randomId(), expectedVersion: latest.view!.version, reason: reason.trim() };
      if (input.roomCode !== code || input.reason.length > 300 || /\p{Cc}/u.test(input.reason)) {
        setNotice('Enter a one-line reason of 1–300 characters.'); return;
      }
      const key = storageKey(accountId, code);
      const existing = parsePending(window.sessionStorage.getItem(key), code);
      if (existing && JSON.stringify(existing) !== JSON.stringify(input)) throw new Error('Resolve the saved backup request before starting another.');
      window.sessionStorage.setItem(key, JSON.stringify(input));
      if (window.sessionStorage.getItem(key) !== JSON.stringify(input)) throw new Error('The backup request could not be preserved in this tab. Nothing was sent.');
      setPending(input); setNotice('Requesting an immutable snapshot…');
      sent = true;
      const result = await requestJson<unknown>('/api/admin/backups', {
        method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(input),
      });
      if (!result || typeof result !== 'object' || !('replayed' in result) || typeof result.replayed !== 'boolean' || !('backup' in result))
        throw new Error('The server did not confirm the backup operation.');
      const receipt = readBackups({ backups: [result.backup] }, code)[0];
      if (receipt.id !== input.operationId || receipt.roomVersion !== input.expectedVersion)
        throw new Error('The server returned conflicting backup confirmation.');
      // The authenticated exact-operation receipt is authoritative even when this
      // backup has fallen outside the newest 100 metadata rows.
      let storageCleared = true;
      try { window.sessionStorage.removeItem(storageKey(accountId, code)); }
      catch {
        storageCleared = false;
        if (alive.current) setStorageProblem(true);
      }
      if (alive.current) {
        setPending(null); setReason('');
        const storageWarning = storageCleared ? '' : ' This tab could not clear its saved retry record; do not retry this confirmed operation.';
        setNotice((result.replayed ? 'The existing snapshot was confirmed; no second snapshot was created.' : 'Snapshot created. The live room was not changed.') + storageWarning);
        try {
          const after = await readRoomAndList(code);
          if (alive.current) {
            setRoom(after.view); setBackups(after.list);
            if (!after.list.some(item => item.id === receipt.id))
              setNotice('The snapshot was confirmed by its operation receipt, but is not among the currently listed snapshots. No retry is needed.' + storageWarning);
          }
        } catch (readError) {
          if (!alive.current) return;
          setRoom(null); setBackups(null);
          setNotice('The snapshot was confirmed, but the current list could not be refreshed. Use Refresh room and backups; do not retry capture.' + storageWarning);
          if (readError instanceof ClientRequestError && [401, 403].includes(readError.status ?? 0)) onDenied();
        }
      }
    } catch (error) {
      if (!alive.current) return;
      if (error instanceof ClientRequestError && [401, 403].includes(error.status ?? 0)) { onDenied(); return; }
      if (!sent || !input) {
        setNotice(`${message(error)} No snapshot request was sent.`);
        return;
      }
      const uncertain = requestMayHaveCompleted(error);
      if (!uncertain) {
        try { window.sessionStorage.removeItem(storageKey(accountId, code)); setPending(null); }
        catch { setStorageProblem(true); }
      }
      setNotice(uncertain ? `${message(error)} The request may have completed. Checking the current room and backup list before any retry…` : message(error));
      try {
        const after = await readRoomAndList(code);
        if (alive.current) {
          setRoom(after.view); setBackups(after.list);
          if (uncertain && !reconcile(input, after.list)) setNotice(`${message(error)} No matching snapshot appears in the current list. Review the saved request before manually retrying it; no automatic retry was sent.`);
        }
      } catch (readError) {
        if (alive.current) {
          setRoom(null); setBackups(null);
          setNotice(`${message(error)} The outcome could not be checked. Refresh the current room and backup list before retrying.`);
          if (readError instanceof ClientRequestError && [401, 403].includes(readError.status ?? 0)) onDenied();
        }
      }
    } finally { inFlight.current = false; if (alive.current) setBusy(false); }
  }

  async function download(backup: Backup) {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setNotice('');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);
    try {
      const response = await fetch(`/api/admin/backups/${encodeURIComponent(backup.id)}/download`, {
        method: 'GET', cache: 'no-store', credentials: 'same-origin', headers, signal: controller.signal,
      });
      if (!response.ok) {
        if ([401, 403].includes(response.status)) { onDenied(); return; }
        throw new Error(`The snapshot could not be downloaded (${response.status}).`);
      }
      if (!response.headers.get('content-type')?.toLowerCase().includes('application/json')) throw new Error('The server returned an unexpected download type.');
      const blob = await response.blob();
      if (!alive.current) return;
      const url = URL.createObjectURL(blob);
      try {
        const link = document.createElement('a');
        link.href = url;
        link.download = `dune-room-${backup.roomCode}-backup-${backup.id}.json`;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        link.remove();
        setNotice('Snapshot download started. Store the private file securely.');
      } finally { setTimeout(() => URL.revokeObjectURL(url), 60_000); }
    } catch (error) { if (alive.current) setNotice(error instanceof DOMException && error.name === 'AbortError' ? 'Download timed out. Try again.' : message(error)); }
    finally { clearTimeout(timeout); inFlight.current = false; if (alive.current) setBusy(false); }
  }

  return <section aria-labelledby="admin-backups-title" aria-busy={busy || loading}>
    <h2 id="admin-backups-title">Find a room</h2>
    <form className="admin-filters" onSubmit={event => { event.preventDefault(); if (codePattern.test(entry.trim().toUpperCase())) void load(entry.trim().toUpperCase()); else setNotice('Enter the eight-character room code using A–Z and 2–9.'); }}>
      <label className="admin-search" htmlFor="backup-room-code">Room code<Input id="backup-room-code" value={entry} maxLength={8} autoComplete="off" autoCapitalize="characters" spellCheck={false} disabled={busy || loading} onChange={event => setEntry(event.target.value.toUpperCase())} required /></label>
      <Button type="submit" disabled={busy || loading || !codePattern.test(entry.trim())}>Show room backups</Button>
    </form>
    {notice && <p role="alert" className="admin-notice">{notice}</p>}
    {loading && <output>Reading current room version and snapshots…</output>}
    {code && !loading && <section className="admin-room-control" aria-labelledby="backup-current-room">
      <div className="admin-section-heading"><h2 id="backup-current-room">Room {code}</h2><Button variant="outline" disabled={busy} onClick={() => void refresh()}>Refresh room and backups</Button></div>
      {backups ? <>
        {room ? <p>Current live room version: <strong>{room.version}</strong>. Snapshot creation reads the saved room; it does not pause, modify, or restore live play.</p> :
          <p>The live room no longer exists. Existing snapshots remain available to download, but a new snapshot cannot be created.</p>}
        <h3>Saved snapshots ({backups.length})</h3>
        {backups.length === 0 ? <p>No snapshots recorded for this room.</p> : <ol>{backups.map(backup => <li key={backup.id}>
          <article><p>Version {backup.roomVersion} · <time dateTime={new Date(backup.createdAt).toISOString()}>{new Date(backup.createdAt).toLocaleString()}</time> · {backup.sizeBytes.toLocaleString()} bytes</p>
            <p>Snapshot ID: <code>{backup.id}</code><br />SHA-256: <code>{backup.digest}</code></p>
            <Button variant="outline" disabled={busy} onClick={() => void download(backup)}>Download snapshot for room {code}, version {backup.roomVersion}</Button>
          </article>
        </li>)}</ol>}
        {storageProblem ? <div className="admin-confirm"><p>A saved request cannot be read or preserved in this tab. No new snapshot can be requested until the local record is resolved. This does not remove any server snapshot.</p>
          <label className="admin-check"><input type="checkbox" checked={confirmed} disabled={busy} onChange={event => setConfirmed(event.target.checked)} />I reviewed the current backup list and want to clear this tab’s unreadable retry record.</label>
          <Button variant="outline" disabled={busy || !confirmed} onClick={() => {
            try {
              window.sessionStorage.removeItem(storageKey(accountId, code));
              if (window.sessionStorage.getItem(storageKey(accountId, code)) !== null) throw new Error('The local record could not be cleared.');
              setStorageProblem(false); setPending(null); setConfirmed(false); setRoom(null); setBackups(null);
              setNotice('Local retry record cleared. This did not change any server snapshot. Refresh the room and list before creating a new one.');
            } catch (error) { setNotice(message(error)); }
          }}>Clear unreadable local record</Button></div> : pending ? <div className="admin-confirm">
          <h3>Saved request needs review</h3><p>Room {pending.roomCode}, version {pending.expectedVersion}; reason: {pending.reason}</p>
          <p>This exact request is preserved in this tab. It is not in the current list; a confirmed older snapshot may also be outside the list window. Retry uses the same operation ID and cannot create a second snapshot for this operation. The live room may have changed or no longer exist.</p>
          <label className="admin-check"><input type="checkbox" checked={confirmed} disabled={busy} onChange={event => setConfirmed(event.target.checked)} />I reviewed the available room, list and saved request before retrying.</label>
          <Button disabled={busy || !confirmed} onClick={() => void create(pending)}>Retry saved request</Button>
        </div> : room ? <form onSubmit={event => { event.preventDefault(); void create(); }}>
          <label htmlFor="backup-reason">Operational reason<Input id="backup-reason" value={reason} maxLength={300} required disabled={busy} onChange={event => { setReason(event.target.value); setConfirmed(false); }} /></label>
          <p className="admin-secondary">Use a short one-line reason. Do not include credentials or private game details.</p>
          <div className="admin-confirm"><p>Create one immutable snapshot of <strong>room {code}</strong> at live version <strong>{room.version}</strong>. This captures private game state and access material, but does not change the game. If the version changes, refresh and review again.</p>
            <label className="admin-check"><input type="checkbox" checked={confirmed} disabled={busy} onChange={event => setConfirmed(event.target.checked)} />I reviewed the room, version, privacy warning and reason, and want to create this snapshot.</label>
            <Button type="submit" disabled={busy || !confirmed || !reason.trim() || /\p{Cc}/u.test(reason)}>Create snapshot</Button>
          </div>
        </form> : null}
      </> : <p>The current room or backup list is unavailable. Refresh before creating or retrying any snapshot.</p>}
    </section>}
  </section>;
}
