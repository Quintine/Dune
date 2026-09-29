'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ClientRequestError, requestJson, requestMayHaveCompleted } from '@/lib/client-request';
import type { AdminAccountInput, AdminAccountRow, AdminAccountsDirectory, AdminAccountResult } from '@/lib/admin-accounts';
import { clearAdminAccountRecord, completeAdminAccountRequest, newAdminAccountRequest, readAdminAccountRecord, saveAdminAccountRequest, validAdminAccountResult, type AdminAccountRecord } from '@/lib/admin-accounts-client';
import '../admin.css';
import './accounts.css';

type SessionAccount = { id: string; name: string; role: 'owner' | 'operator' | 'viewer' };
type Mutation = 'provision' | 'role' | 'disable';
const message = (error: unknown) => error instanceof Error ? error.message : 'The account request could not be completed.';
const denied = (error: unknown) => error instanceof ClientRequestError && [401, 403].includes(error.status ?? 0);

export default function AccountsPage() {
  const [owner, setOwner] = useState<SessionAccount | null>(null);
  const [directory, setDirectory] = useState<AdminAccountsDirectory | null>(null);
  const [record, setRecord] = useState<AdminAccountRecord | null>(null);
  const [name, setName] = useState('');
  const [role, setRole] = useState<AdminAccountRow['role']>('viewer');
  const [reason, setReason] = useState('');
  const [action, setAction] = useState<Mutation>('provision');
  const [target, setTarget] = useState<AdminAccountRow | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [storageProblem, setStorageProblem] = useState(false);
  const [stale, setStale] = useState(false);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const inFlight = useRef(false);
  const mounted = useRef(false);

  const loseAccess = useCallback(() => {
    setOwner(null); setDirectory(null); setRecord(null); setTarget(null); setConfirmed(false);
    setNotice('Owner access changed or expired. Sign in to administration again. Any saved request remains in this tab for its original owner.');
  }, []);

  const loadDirectory = useCallback(async (account: SessionAccount, page = 1) => {
    const data = await requestJson<AdminAccountsDirectory>(`/api/admin/accounts?page=${page}`, {
      cache: 'no-store', headers: { 'X-Dune-Admin-Id': account.id },
    });
    if (mounted.current) setDirectory(data);
    return data;
  }, []);

  useEffect(() => {
    mounted.current = true;
    let canceled = false;
    requestJson<{ admin: SessionAccount }>('/api/admin/session', { cache: 'no-store' })
      .then(async ({ admin }) => {
        if (canceled) return;
        if (admin.role !== 'owner') { loseAccess(); setNotice('Only an owner can manage administrator accounts.'); return; }
        await loadDirectory(admin);
        if (canceled) return;
        let saved: AdminAccountRecord | null;
        try { saved = readAdminAccountRecord(window.sessionStorage, admin.id); }
        catch (error) { setOwner(admin); setStorageProblem(true); setNotice(message(error)); return; }
        setOwner(admin); setRecord(saved); setStorageProblem(false); setStale(false); setConfirmed(false);
        setNotice(saved?.kind === 'pending' ? 'This tab has an unconfirmed account request. Review and retry the exact saved request; do not generate another.' : '');
      })
      .catch(error => {
        if (canceled) return;
        setRecord(null); setOwner(null); setDirectory(null);
        setNotice(denied(error) ? 'Owner access changed or expired. Sign in to administration again.' : message(error));
      })
      .finally(() => { if (!canceled) setLoading(false); });
    return () => { canceled = true; mounted.current = false; };
  }, [refresh, loadDirectory, loseAccess]);
  useEffect(() => {
    const revalidate = () => {
      if (document.visibilityState === 'hidden') return;
      setLoading(true); setOwner(null); setDirectory(null); setRecord(null); setConfirmed(false);
      setRefresh(value => value + 1);
    };
    window.addEventListener('focus', revalidate);
    window.addEventListener('pageshow', revalidate);
    document.addEventListener('visibilitychange', revalidate);
    return () => {
      window.removeEventListener('focus', revalidate);
      window.removeEventListener('pageshow', revalidate);
      document.removeEventListener('visibilitychange', revalidate);
    };
  }, []);

  async function refreshAccounts(page = directory?.page ?? 1) {
    if (!owner || inFlight.current) return;
    setBusy(true);
    try {
      await loadDirectory(owner, page);
      setTarget(null); setConfirmed(false); if (!record) setStale(false); setNotice('Account directory refreshed. Review current values before making another change.');
    } catch (error) { if (denied(error)) loseAccess(); else setNotice(message(error)); }
    finally { setBusy(false); }
  }

  function startReview(event: React.SyntheticEvent<HTMLFormElement, SubmitEvent>) {
    event.preventDefault();
    if (!owner || !directory || storageProblem || record || inFlight.current || busy) return;
    try {
      const input = action === 'provision'
        ? newAdminAccountRequest({ action, name, role, reason })
        : target && target.enabled && target.id !== owner.id
          ? action === 'role'
            ? newAdminAccountRequest({ action, target: target.id, expectedUpdatedAt: target.updatedAt, role, reason })
            : newAdminAccountRequest({ action, target: target.id, expectedUpdatedAt: target.updatedAt, reason })
          : null;
      if (!input) throw new Error('Choose a current, enabled account other than your own.');
      saveAdminAccountRequest(window.sessionStorage, owner.id, input);
      setRecord({ kind: 'pending', input }); setConfirmed(false); setStale(false);
      setNotice('Review the exact request below. No account change has been sent yet.');
    } catch (error) { setNotice(message(error)); }
  }

  async function submit(input: AdminAccountInput) {
    if (!owner || inFlight.current || !confirmed || storageProblem || stale || record?.kind !== 'pending' ||
      (input.action !== 'provision' && !directory?.accounts.some(row => row.id === input.target))) return;
    inFlight.current = true; setBusy(true); setConfirmed(false);
    try {
      // A restored tab must not submit under another or a demoted account.
      const session = await requestJson<{ admin: SessionAccount }>('/api/admin/session', { cache: 'no-store' });
      if (session.admin.id !== owner.id || session.admin.role !== 'owner') { loseAccess(); return; }
      saveAdminAccountRequest(window.sessionStorage, owner.id, input);
      const result = await requestJson<AdminAccountResult>('/api/admin/accounts', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Dune-Admin-Id': owner.id }, body: JSON.stringify(input),
      });
      if (!validAdminAccountResult(result, input)) throw new Error('The server did not confirm the exact account request. Keep the saved retry.');
      completeAdminAccountRequest(window.sessionStorage, owner.id, input, result);
      if (!mounted.current) return;
      setRecord(input.action === 'provision' ? { kind: 'completed', input, account: result.account } : null);
      setTarget(null); setReason(''); setName(''); setStale(false);
      setNotice(result.replayed ? 'The original account operation was confirmed; no duplicate change was made.' : 'Account operation confirmed.');
      try { await loadDirectory(owner, 1); }
      catch (error) { if (denied(error)) loseAccess(); else setNotice(`Account operation confirmed, but refresh failed: ${message(error)}`); }
    } catch (error) {
      if (!mounted.current) return;
      if (denied(error)) { loseAccess(); return; }
      if (error instanceof ClientRequestError && error.status === 409) {
        setStale(true); setTarget(null);
        try { await loadDirectory(owner, directory?.page ?? 1); }
        catch (readError) { if (denied(readError)) { loseAccess(); return; } }
        setNotice('The account request conflicted with current access or a newer account version. Review the refreshed directory before discarding the saved request; no new request can be sent yet.');
      } else setNotice(requestMayHaveCompleted(error)
        ? `${message(error)} The change may have completed. Confirm the exact saved request by retrying; do not make a new one.` : message(error));
    } finally { inFlight.current = false; if (mounted.current) setBusy(false); }
  }

  function discard() {
    if (!owner || busy || !directory || !confirmed) return;
    try {
      clearAdminAccountRecord(window.sessionStorage, owner.id);
      setRecord(null); setStorageProblem(false); setStale(false); setConfirmed(false);
      setNotice('This tab’s local record was cleared. No existing account was changed by clearing it.');
    } catch (error) { setNotice(message(error)); }
  }

  function select(row: AdminAccountRow, next: Mutation) {
    if (!owner || row.id === owner.id || !row.enabled || record || busy) return;
    setTarget(row); setAction(next); setRole(row.role); setReason(''); setConfirmed(false); setNotice('');
  }

  const pending = record?.kind === 'pending' ? record.input : null;
  const pendingTarget = pending?.action !== 'provision' && pending ? directory?.accounts.find(row => row.id === pending.target) : null;
  const completed = record?.kind === 'completed' ? record : null;
  const selected = target && directory?.accounts.find(item => item.id === target.id && item.updatedAt === target.updatedAt && item.enabled);
  const totalPages = directory ? Math.max(1, Math.ceil(directory.total / directory.pageSize)) : 1;

  return <main className="admin-shell admin-accounts">
    <header className="admin-header"><div><a className="admin-return" href="/admin">Administration</a><h1>Administrator accounts</h1></div>
      {owner && <span>{owner.name} <span className="admin-tag">owner</span></span>}</header>
    <p>Only an owner can provision accounts, change roles or disable account access. Account changes do not change games or seats.</p>
    {notice && <p role="alert" className="admin-notice">{notice}</p>}
    {loading ? <output>Checking owner access and account directory…</output> : !owner ?
      <p><a className="admin-room-link" href="/admin">Return to administrator sign-in</a></p> : <>
      {storageProblem ? <section className="admin-room-control" aria-labelledby="accounts-storage"><h2 id="accounts-storage">Unreadable local request</h2>
        <p>Account changes are blocked. Inspect the account directory before discarding the unreadable record. A previously submitted operation may have committed, and a provisioned key may be lost if you discard it.</p>
        <label className="admin-check"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />I checked the directory and understand this tab’s saved retry or key may be lost.</label>
        <Button disabled={!confirmed || busy || !directory} onClick={discard}>Discard unreadable local record</Button>
      </section> : pending ? <section className="admin-room-control" aria-labelledby="accounts-pending"><h2 id="accounts-pending">Saved account request</h2>
        <p>{stale ? 'This request conflicted. Inspect the refreshed directory and explicitly discard it to prepare another request.' : 'The exact operation is saved in this tab. A previous attempt may have succeeded. Retry only this request to confirm its outcome.'}</p>
        <dl className="accounts-review"><dt>Action</dt><dd>{pending.action}</dd><dt>Account name</dt><dd>{pending.action === 'provision' ? pending.name : pendingTarget?.name ?? 'Find this account in the directory before sending'}</dd>
          <dt>Account ID</dt><dd>{pending.action === 'provision' ? pending.id : pending.target}</dd>
          {pending.action !== 'provision' && <><dt>Current role</dt><dd>{pendingTarget?.role ?? 'Unavailable'}</dd><dt>Reviewed version</dt><dd>{new Date(pending.expectedUpdatedAt).toLocaleString()}</dd></>}
          {pending.action !== 'disable' && <><dt>Desired role</dt><dd>{pending.role}</dd></>}
          <dt>Reason</dt><dd>{pending.reason}</dd><dt>Operation ID</dt><dd>{pending.operationId}</dd></dl>
        {pending.action === 'disable' && <p role="alert">Disabling {pendingTarget?.name ?? pending.target} blocks the existing access key and permanently revokes every current session. This page cannot re-enable the account. Check its current role and exact ID before proceeding.</p>}
        <p className="admin-secondary">Provisioning key stays hidden until the exact operation is confirmed. Do not enter credentials in the reason. Discarding an uncertain provision request can permanently lose the only copy of its key.</p>
        <label className="admin-check"><input type="checkbox" checked={confirmed} disabled={busy} onChange={event => setConfirmed(event.target.checked)} />{pending.action === 'disable' ? `I confirm disabling ${pendingTarget?.name ?? pending.target} (${pending.target}) and revoking its sessions for the recorded reason.` : 'I verified this exact account ID, name, action, desired role and reason before changing administrator access.'}</label>
        <div className="accounts-actions"><Button disabled={busy || !confirmed || stale || (pending.action !== 'provision' && !pendingTarget)} onClick={() => void submit(pending)}>{busy ? 'Checking request…' : 'Confirm and send exact saved request'}</Button>
          <Button variant="outline" disabled={busy || !confirmed || !directory} onClick={discard}>Discard saved request after checking directory</Button></div>
      </section> : completed ? <section className="admin-room-control" aria-labelledby="accounts-key"><h2 id="accounts-key">Save this account key now</h2>
        <p>Account <strong>{completed.account.name}</strong> ({completed.account.id}) is provisioned. This key is available only in this tab until you explicitly clear its local record. It is not returned by the server. Give it privately to its owner; it cannot be recovered after clearing.</p>
        <label htmlFor="accounts-private-key">One-time account access key</label>
        <Input id="accounts-private-key" readOnly value={completed.input.key} autoComplete="off" spellCheck={false} onFocus={event => event.currentTarget.select()} />
        <label className="admin-check"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />I saved this key securely and understand clearing this record cannot recover it.</label>
        <Button disabled={!confirmed || busy} onClick={discard}>Clear saved key and start another request</Button>
      </section> : <section className="admin-room-control" aria-labelledby="accounts-new"><h2 id="accounts-new">{action === 'provision' ? 'Provision an account' : action === 'role' ? 'Change account role' : 'Disable an account'}</h2>
        <form onSubmit={startReview}>
          {action === 'provision' ? <><label htmlFor="accounts-name">Account name<Input id="accounts-name" required maxLength={80} value={name} disabled={busy} onChange={event => setName(event.target.value)} /></label>
            <label htmlFor="accounts-role">Initial role<select id="accounts-role" value={role} disabled={busy} onChange={event => setRole(event.target.value as AdminAccountRow['role'])}><option value="viewer">Viewer</option><option value="operator">Operator</option><option value="owner">Owner</option></select></label></> : selected ? <><p>Target: <strong>{selected.name}</strong> ({selected.id}) · current role {selected.role}</p>
            {action === 'role' && <label htmlFor="accounts-role">Desired role<select id="accounts-role" value={role} disabled={busy} onChange={event => setRole(event.target.value as AdminAccountRow['role'])}><option value="viewer">Viewer</option><option value="operator">Operator</option><option value="owner">Owner</option></select></label>}
            {action === 'disable' && <p>Disabling blocks this account’s existing key and permanently revokes its current sessions. It cannot be re-enabled here.</p>}</> : <p>The selected account changed. Refresh and choose it again.</p>}
          <label htmlFor="accounts-reason">Reason for action history<Input id="accounts-reason" required maxLength={300} value={reason} disabled={busy} onChange={event => setReason(event.target.value)} /></label>
          <p className="admin-secondary">Use an operational reason without access keys, credentials or private game information. The next screen shows the exact request for confirmation before anything is sent.</p>
          <Button type="submit" disabled={busy || !directory || !reason.trim() || (action === 'provision' ? !name.trim() : !selected || action === 'role' && role === selected.role)}>Review exact account request</Button>
        </form>
      </section>}
      <section aria-labelledby="accounts-directory"><div className="admin-section-heading"><h2 id="accounts-directory">Account directory</h2><div className="accounts-actions"><Button variant="outline" disabled={busy || !!record || storageProblem} onClick={() => { setAction('provision'); setTarget(null); setRole('viewer'); setReason(''); setConfirmed(false); }}>Provision account</Button><Button variant="outline" disabled={busy} onClick={() => void refreshAccounts()}>Refresh accounts</Button></div></div>
        {directory ? <><p>{directory.total.toLocaleString()} accounts · page {directory.page} of {totalPages}</p>
          <ul className="accounts-list">{directory.accounts.map(row => <li key={row.id}><div><strong>{row.name}</strong> <span className="admin-tag">{row.role}</span> <span className="admin-tag">{row.enabled ? 'Enabled' : 'Disabled'}</span>
            <p className="accounts-id">{row.id}</p><p>Updated {new Date(row.updatedAt).toLocaleString()}</p></div>
            {row.enabled && row.id !== owner.id && !record && !storageProblem && <div className="accounts-actions"><Button variant="outline" disabled={busy} onClick={() => select(row, 'role')}>Change role · {row.name}</Button>
              <Button variant="outline" disabled={busy} onClick={() => select(row, 'disable')}>Disable · {row.name}</Button></div>}</li>)}</ul>
          {directory.accounts.length === 0 && <p>No accounts on this page.</p>}
          <nav className="admin-pagination" aria-label="Account pages"><Button variant="outline" disabled={busy || directory.page <= 1} onClick={() => void refreshAccounts(directory.page - 1)}>Previous</Button>
            <span>Page {directory.page} of {totalPages}</span><Button variant="outline" disabled={busy || directory.page >= totalPages} onClick={() => void refreshAccounts(directory.page + 1)}>Next</Button></nav></> : <p>Account directory unavailable. Changes are blocked until it loads.</p>}
      </section>
    </>}
  </main>;
}
