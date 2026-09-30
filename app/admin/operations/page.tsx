'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ClientRequestError, requestJson } from '@/lib/client-request';
import type { AdminIntegrity, AdminOperations } from '@/db/admin-operations';
import '../admin.css';
import './operations.css';

type Account = { id: string; role: 'owner' | 'operator' | 'viewer' };
type Snapshot = AdminOperations & { revision: string };
const message = (error: unknown) => error instanceof Error ? error.message : 'Operational status is unavailable.';

export default function OperationsPage() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [integrity, setIntegrity] = useState<AdminIntegrity | null>(null);
  const [integrityNotice, setIntegrityNotice] = useState('');
  const [checking, setChecking] = useState(false);
  const integrityEpoch = useRef(0);
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

  return <main className="admin-shell">
    <header className="admin-header"><div><a className="admin-return" href="/admin">Administration</a><h1>Operations</h1></div>
      <Button variant="outline" disabled={loading} onClick={() => {
        integrityEpoch.current++;
        setIntegrity(null); setIntegrityNotice(''); setChecking(false);
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
      </dl>
      <p>These counters do not check SQLite integrity, disk free space, backup recoverability, stalled decisions or server health outside this request. The invalid JSON count detects syntax only, not rule-level save validity; this page cannot repair a room.</p>
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
