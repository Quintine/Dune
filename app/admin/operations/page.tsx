'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ClientRequestError, requestJson } from '@/lib/client-request';
import type { AdminAttempt, AdminAttemptReason } from '@/db/admin-attempts';
import type { AdminIntegrity, AdminOperations, AdminStalledDecision } from '@/db/admin-operations';
import '../admin.css';
import './operations.css';

type Account = { id: string; role: 'owner' | 'operator' | 'viewer' };
type Snapshot = AdminOperations & { revision: string };
type Stalled = { observedAt: number; stallMs: number; stalled: AdminStalledDecision[] };
type Attempts = {
  observedAt: number;
  windowMs: number;
  total: number;
  byReason: { reason: AdminAttemptReason; count: number }[];
  recent: AdminAttempt[];
};
const ATTEMPT_LABELS: Record<AdminAttemptReason, string> = {
  invalid_key_format: 'Malformed access key',
  unknown_or_disabled_key: 'Unknown or disabled access key',
  missing_session: 'Missing or malformed session',
  unknown_or_expired_session: 'Unknown, expired or revoked session',
  role_denied: 'Role does not permit the action',
};
const message = (error: unknown) => error instanceof Error ? error.message : 'Operational status is unavailable.';
const idle = (idleMs: number) => `${Math.floor(idleMs / 3_600_000)}h ${Math.floor(idleMs % 3_600_000 / 60_000)}m`;

export default function OperationsPage() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [integrity, setIntegrity] = useState<AdminIntegrity | null>(null);
  const [integrityNotice, setIntegrityNotice] = useState('');
  const [checking, setChecking] = useState(false);
  const integrityEpoch = useRef(0);
  const [stalled, setStalled] = useState<Stalled | null>(null);
  const [stalledNotice, setStalledNotice] = useState('');
  const [loadingStalled, setLoadingStalled] = useState(false);
  const stalledEpoch = useRef(0);
  const [attempts, setAttempts] = useState<Attempts | null>(null);
  const [attemptsNotice, setAttemptsNotice] = useState('');
  const [loadingAttempts, setLoadingAttempts] = useState(false);
  const attemptsEpoch = useRef(0);
  useEffect(() => {
    let canceled = false;
    const epoch = integrityEpoch;
    requestJson<{ admin: Account }>('/api/admin/session', { cache: 'no-store' })
      .then(async ({ admin }) => {
        if (admin.role !== 'owner') throw new Error('Operations are available only to an owner.');
        const result = await requestJson<Snapshot>('/api/admin/operations', {
          cache: 'no-store', headers: { 'X-Dune-Admin-Id': admin.id },
        });
        if (!canceled) { setSnapshot(result); setNotice(''); }
      })
      .catch(error => {
        if (canceled) return;
        setSnapshot(null);
        setNotice(error instanceof ClientRequestError && [401, 403].includes(error.status ?? 0)
          ? 'Owner access changed or expired. Sign in to administration again.' : message(error));
      })
      .finally(() => { if (!canceled) setLoading(false); });
    return () => { canceled = true; epoch.current++; };
  }, [refresh]);

  async function checkIntegrity() {
    const epoch = ++integrityEpoch.current;
    setChecking(true);
    setIntegrity(null);
    setIntegrityNotice('');
    try {
      const { admin } = await requestJson<{ admin: Account }>('/api/admin/session', { cache: 'no-store' });
      if (admin.role !== 'owner') throw new Error('Operations are available only to an owner.');
      const result = await requestJson<AdminIntegrity>('/api/admin/operations?integrity=1', {
        cache: 'no-store', headers: { 'X-Dune-Admin-Id': admin.id },
      });
      if (epoch === integrityEpoch.current) setIntegrity(result);
    } catch (error) {
      if (epoch === integrityEpoch.current)
        setIntegrityNotice(error instanceof ClientRequestError && [401, 403].includes(error.status ?? 0)
          ? 'Owner access changed or expired. Sign in to administration again.' : message(error));
    } finally {
      if (epoch === integrityEpoch.current) setChecking(false);
    }
  }

  async function checkStalled() {
    const epoch = ++stalledEpoch.current;
    setLoadingStalled(true);
    setStalled(null);
    setStalledNotice('');
    try {
      const { admin } = await requestJson<{ admin: Account }>('/api/admin/session', { cache: 'no-store' });
      if (admin.role !== 'owner') throw new Error('Operations are available only to an owner.');
      const result = await requestJson<Stalled>('/api/admin/operations?stalled=1', {
        cache: 'no-store', headers: { 'X-Dune-Admin-Id': admin.id },
      });
      if (epoch === stalledEpoch.current) setStalled(result);
    } catch (error) {
      if (epoch === stalledEpoch.current)
        setStalledNotice(error instanceof ClientRequestError && [401, 403].includes(error.status ?? 0)
          ? 'Owner access changed or expired. Sign in to administration again.' : message(error));
    } finally {
      if (epoch === stalledEpoch.current) setLoadingStalled(false);
    }
  }

  async function checkAttempts() {
    const epoch = ++attemptsEpoch.current;
    setLoadingAttempts(true);
    setAttempts(null);
    setAttemptsNotice('');
    try {
      const { admin } = await requestJson<{ admin: Account }>('/api/admin/session', { cache: 'no-store' });
      if (admin.role !== 'owner') throw new Error('Operations are available only to an owner.');
      const result = await requestJson<Attempts>('/api/admin/operations?attempts=1', {
        cache: 'no-store', headers: { 'X-Dune-Admin-Id': admin.id },
      });
      if (epoch === attemptsEpoch.current) setAttempts(result);
    } catch (error) {
      if (epoch === attemptsEpoch.current)
        setAttemptsNotice(error instanceof ClientRequestError && [401, 403].includes(error.status ?? 0)
          ? 'Owner access changed or expired. Sign in to administration again.' : message(error));
    } finally {
      if (epoch === attemptsEpoch.current) setLoadingAttempts(false);
    }
  }

  return <main className="admin-shell">
    <header className="admin-header"><div><a className="admin-return" href="/admin">Administration</a><h1>Operations</h1></div>
      <Button variant="outline" disabled={loading} onClick={() => {
        integrityEpoch.current++;
        stalledEpoch.current++;
        attemptsEpoch.current++;
        setAttempts(null); setAttemptsNotice(''); setLoadingAttempts(false);
        setIntegrity(null); setIntegrityNotice(''); setChecking(false);
        setStalled(null); setStalledNotice(''); setLoadingStalled(false);
        setSnapshot(null); setLoading(true); setRefresh(value => value + 1);
      }}>Refresh status</Button></header>
    <p>Owner-only, read-only counts from the current database and the revision baked into this server build. Refresh to take a new sample; no monitoring or automatic repair runs here.</p>
    {notice && <p role="alert" className="admin-notice">{notice}</p>}
    {loading ? <output>Checking owner access and database…</output> : snapshot ? <section aria-labelledby="operations-sample">
      <h2 id="operations-sample">Sample at {new Date(snapshot.observedAt).toLocaleString()}</h2>
      <dl className="admin-operations-grid">
        <div><dt>Server build revision</dt><dd>{snapshot.revision}</dd></div>
        <div><dt>Saved rooms (including removed/archived)</dt><dd>{snapshot.rooms}</dd></div>
        <div><dt>Removed rooms</dt><dd>{snapshot.removedRooms}</dd></div>
        <div><dt>Archived rooms</dt><dd>{snapshot.archivedRooms}</dd></div>
        <div><dt>Paused rooms</dt><dd>{snapshot.pausedRooms}</dd></div>
        <div><dt>Closed rooms</dt><dd>{snapshot.closedRooms}</dd></div>
        <div><dt>Active seat credentials</dt><dd>{snapshot.activeSeats}</dd></div>
        <div><dt>Invalid JSON room states</dt><dd>{snapshot.unreadableRooms}</dd></div>
        <div><dt>Latest room write</dt><dd>{snapshot.lastRoomChange === null ? 'No rooms' : new Date(snapshot.lastRoomChange).toLocaleString()}</dd></div>
        <div><dt>Room backup snapshots</dt><dd>{snapshot.backupSnapshots}</dd></div>
        <div><dt>Backup snapshot payload bytes</dt><dd>{snapshot.backupBytes.toLocaleString()}</dd></div>
        <div><dt>Recorded private exports</dt><dd>{snapshot.backupDownloads}</dd></div>
        <div><dt>Rooms waiting on a stalled interaction</dt><dd>{snapshot.stalledRooms}</dd></div>
        <div><dt>Oldest stalled room write</dt><dd>{snapshot.oldestStalledChange === null ? 'None stalled' : new Date(snapshot.oldestStalledChange).toLocaleString()}</dd></div>
        <div><dt>Database size</dt><dd>{(snapshot.databaseBytes / 1048576).toFixed(1)} MB</dd></div>
        <div><dt>Database pages</dt><dd>{snapshot.databasePages.toLocaleString()}</dd></div>
      </dl>
      <p>These counters do not check SQLite integrity, disk free space, backup recoverability or server health outside this request. The invalid JSON count detects syntax only, not rule-level save validity; this page cannot repair a room.</p>
      <Button variant="outline" disabled={loadingStalled} onClick={() => void checkStalled()}>List stalled decisions</Button>
      <p>Read-only sample of up to ten live rooms whose public pending interaction has been idle longest. It excludes paused, closed, removed and archived rooms and shows no private game contents.</p>
      {loadingStalled && <output>Sampling stalled rooms…</output>}
      {stalledNotice && <p role="alert" className="admin-notice">{stalledNotice}</p>}
      {stalled && <section aria-label="Stalled decisions">
        <p>Sampled {new Date(stalled.observedAt).toLocaleString()}; idle means no room write for {Math.round(stalled.stallMs / 3_600_000)} hours.</p>
        {stalled.stalled.length === 0 ? <p>No live room is waiting on a stalled interaction.</p>
          : <table className="admin-stalled-table">
            <caption>Stalled rooms, longest idle first</caption>
            <thead><tr><th scope="col">Room</th><th scope="col">Waiting on</th><th scope="col">Turn</th><th scope="col">Phase</th><th scope="col">Idle</th></tr></thead>
            <tbody>{stalled.stalled.map(room => <tr key={room.code}>
              <th scope="row">{room.code}</th>
              <td>{room.kind}</td>
              <td>{room.turn ?? '—'}</td>
              <td>{room.phase ?? '—'}</td>
              <td>{idle(room.idleMs)}</td>
            </tr>)}</tbody>
          </table>}
        <p>This sample changes nothing. Pause, resume, close or remove a room only through its own controls and audit.</p>
      </section>}
      <Button variant="outline" disabled={loadingAttempts} onClick={() => void checkAttempts()}>List failed attempts</Button>
      <p>Read-only counters and the twenty most recent rejected administrator requests. Only a fixed reason, the attempted role and an already-known account id are stored: never a key, session token, request body or address.</p>
      {loadingAttempts && <output>Sampling rejected requests…</output>}
      {attemptsNotice && <p role="alert" className="admin-notice">{attemptsNotice}</p>}
      {attempts && <section aria-label="Failed administrator attempts">
        <p>Sampled {new Date(attempts.observedAt).toLocaleString()}; counters cover the last {Math.round(attempts.windowMs / 86_400_000)} days ({attempts.total} rejected requests).</p>
        {attempts.byReason.length === 0 ? <p>No rejected administrator request was recorded in the window.</p>
          : <ul>{attempts.byReason.map(row => <li key={row.reason}>{ATTEMPT_LABELS[row.reason]}: <strong>{row.count}</strong></li>)}</ul>}
        {attempts.recent.length === 0 ? null
          : <table className="admin-stalled-table">
            <caption>Most recent rejected requests, newest first</caption>
            <thead><tr><th scope="col">When</th><th scope="col">Kind</th><th scope="col">Reason</th><th scope="col">Role</th><th scope="col">Account</th></tr></thead>
            <tbody>{attempts.recent.map((row, index) => <tr key={`${row.createdAt}-${index}`}>
              <td>{new Date(row.createdAt).toLocaleString()}</td>
              <td>{row.kind}</td>
              <td>{ATTEMPT_LABELS[row.reason]}</td>
              <td>{row.role ?? '—'}</td>
              <td>{row.accountId ? `${row.accountId.slice(0, 8)}…` : '—'}</td>
            </tr>)}</tbody>
          </table>}
        <p>This sample changes nothing and identifies no credential. Use it to notice repeated failures, not to lock out a seat or account automatically.</p>
      </section>}
      <Button variant="outline" disabled={checking} onClick={() => void checkIntegrity()}>Run integrity check</Button>
      <p>This manual, read-only SQLite quick check and foreign-key check may take time. It reports pass/fail only: not disk capacity, backup recoverability or game-rule validity.</p>
      {checking && <output>Checking database structure and references…</output>}
      {integrityNotice && <p role="alert" className="admin-notice">{integrityNotice}</p>}
      {integrity && <section aria-label="Database integrity result">
        <p>Checked {new Date(integrity.observedAt).toLocaleString()}.</p>
        <p>SQLite structure: <strong>{integrity.sqlite === 'passed' ? 'Passed' : 'Failed'}</strong>.
          Foreign keys: <strong>{integrity.foreignKeys === 'passed' ? 'Passed' : 'Failed'}</strong>.</p>
        {integrity.sqlite === 'failed' || integrity.foreignKeys === 'failed'
          ? <p role="alert">Do not repair or restore this database automatically. Preserve a protected snapshot and investigate privately.</p> : null}
      </section>}
    </section> : <p><a className="admin-room-link" href="/admin">Sign in to administration</a></p>}
  </main>;
}
