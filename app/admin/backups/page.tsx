'use client';

import { useEffect, useState } from 'react';
import { AdminBackups } from '@/components/admin-backups';
import { Button } from '@/components/ui/button';
import { ClientRequestError, requestJson } from '@/lib/client-request';
import '../admin.css';

type Account = { id: string; role: 'owner' | 'operator' | 'viewer' };
const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Administrator access could not be checked.';

export default function BackupsPage() {
  const [owner, setOwner] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let canceled = false;
    requestJson<{ admin: Account }>('/api/admin/session', { cache: 'no-store' })
      .then(result => {
        if (canceled) return;
        if (result.admin?.role !== 'owner' || !result.admin.id) {
          setOwner(null);
          setNotice('Room backups are available only to an owner. Sign in with an owner account to continue.');
        } else { setOwner(result.admin); setNotice(''); }
      })
      .catch(error => { if (!canceled) {
        setOwner(null);
        setNotice(error instanceof ClientRequestError && error.status === 401
          ? 'Administrator sign-in required. Sign in to administration with an owner account.' : errorMessage(error));
      } })
      .finally(() => { if (!canceled) setLoading(false); });
    return () => { canceled = true; };
  }, [revision]);

  return <main className="admin-shell">
    <header className="admin-header"><div><a className="admin-return" href="/admin">Administration</a><h1>Room backups</h1></div>
      <Button variant="outline" disabled={loading} onClick={() => { setOwner(null); setLoading(true); setRevision(value => value + 1); }}>Check access again</Button></header>
    <p>Owner-only snapshots preserve a room without changing live play. Backups cannot be restored from this page.</p>
    <p role="note" className="admin-notice">Privacy: downloaded snapshots contain private game state and may contain access credentials. Keep files secure; do not share them with players or upload them to public storage. This page shows metadata only, never the snapshot contents.</p>
    {notice && <p role="alert" className="admin-notice">{notice}</p>}
    {loading ? <output>Checking owner access…</output> : owner ?
      <AdminBackups key={owner.id} accountId={owner.id} onDenied={() => {
        setOwner(null); setNotice('Owner access changed or expired. Sign in again before using room backups.');
      }} /> : <p><a className="admin-room-link" href="/admin">Sign in to administration</a></p>}
  </main>;
}
