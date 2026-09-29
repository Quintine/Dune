'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ClientRequestError, requestJson } from '@/lib/client-request';
import { AUDIT_ACTIONS, AUDIT_CATEGORIES, adminAuditResponse, type AdminAuditPage } from '@/lib/admin-audit';
import '../admin.css';

type Filters = { q: string; category: string; from: string; to: string };
const empty: Filters = { q:'',category:'all',from:'',to:'' };
export default function ActionHistory() {
  const [filters,setFilters] = useState(empty);
  const [applied,setApplied] = useState(empty);
  const [result,setResult] = useState<AdminAuditPage | null>(null);
  const [loading,setLoading] = useState(true);
  const [denied,setDenied] = useState(false);
  const [notice,setNotice] = useState('');
  const [reload,setReload] = useState(0);
  useEffect(() => {
    let canceled = false;
    const query = new URLSearchParams(window.location.search);
    const selected = { q:query.get('q') ?? '',category:query.get('category') || 'all',from:query.get('from') ?? '',to:query.get('to') ?? '' };
    // oxlint-disable-next-line react/react-compiler -- Restore shareable, non-secret history filters after SSR.
    setFilters(selected); setApplied(selected); setLoading(true); setResult(null); setDenied(false); setNotice('');
    requestJson<{ admin: { id: string } }>('/api/admin/session',{cache:'no-store'})
      .then(async session => adminAuditResponse(await requestJson<unknown>('/api/admin/audit?'+query,{cache:'no-store',headers:{'X-Dune-Admin-Id':session.admin.id}})))
      .then(page => { if (!canceled) setResult(page); })
      .catch(error => { if (!canceled) {
        setDenied(error instanceof ClientRequestError && [401,403].includes(error.status ?? 0));
        setNotice(error instanceof Error ? error.message : 'Action history could not be loaded.');
      } })
      .finally(() => { if (!canceled) setLoading(false); });
    return () => { canceled = true; };
  },[reload]);
  useEffect(() => {
    const refresh = () => { if (document.visibilityState !== 'hidden') { setResult(null); setReload(value => value+1); } };
    window.addEventListener('focus',refresh); window.addEventListener('pageshow',refresh); document.addEventListener('visibilitychange',refresh);
    return () => { window.removeEventListener('focus',refresh); window.removeEventListener('pageshow',refresh); document.removeEventListener('visibilitychange',refresh); };
  },[]);
  const link = (page: number) => '/admin/audit?'+new URLSearchParams({...applied,page:String(page)});
  return <main className="admin-shell">
    <header className="admin-header"><div><a className="admin-return" href="/admin">Administration</a><h1>Action history</h1></div>
      <Button variant="outline" disabled={loading} onClick={() => setReload(value => value+1)}>Refresh history</Button></header>
    <p>Recorded administrator actions, newest first. This history describes what was applied; later actions may have changed the room again.</p>
    {notice && <p role="alert" className="admin-notice">{notice}</p>}
    {denied ? <p><a className="admin-room-link" href="/admin">Sign in to administration</a></p> : <>
      <form method="get" action="/admin/audit" className="admin-filters" aria-label="Filter action history">
        <label className="admin-search" htmlFor="audit-query">Room, seat or administrator<Input id="audit-query" name="q" maxLength={80} value={filters.q} onChange={event => setFilters({...filters,q:event.target.value})} /></label>
        <label htmlFor="audit-category">Action group<select id="audit-category" name="category" value={filters.category} onChange={event => setFilters({...filters,category:event.target.value})}>
          <option value="all">All actions</option>{Object.entries(AUDIT_CATEGORIES).map(([id,label]) => <option key={id} value={id}>{label}</option>)}
        </select></label>
        <label htmlFor="audit-from">From date (UTC)<Input id="audit-from" name="from" type="date" value={filters.from} onChange={event => setFilters({...filters,from:event.target.value})} /></label>
        <label htmlFor="audit-to">Through date (UTC)<Input id="audit-to" name="to" type="date" value={filters.to} onChange={event => setFilters({...filters,to:event.target.value})} /></label>
        <Button type="submit" disabled={loading}>Apply history filters</Button><a className="admin-room-link" href="/admin/audit">Clear filters</a>
      </form>
      {loading && <output>Loading action history…</output>}
      {result && <section aria-labelledby="audit-results-title">
        <h2 id="audit-results-title" className="admin-results">{result.total.toLocaleString()} recorded {result.total === 1 ? 'action' : 'actions'}</h2>
        <p className="admin-secondary">{result.reasonsVisible ? 'Operational reasons are visible to owners and operators.' : 'Your viewer role hides operational reasons.'} Search matches room/seat/account identifiers and current administrator names; it does not search reasons or private game contents.</p>
        {result.events.length === 0 ? <p>No records on this page. Adjust the filters or return to the first page.</p> : <ol className="admin-audit-list">{result.events.map(event => <li key={event.id}>
          <article aria-labelledby={'event-'+event.id}>
            <div className="admin-section-heading"><h3 id={'event-'+event.id}>{AUDIT_ACTIONS[event.action]}</h3>{event.createdAt === null ? <span>Time unavailable</span> : <time dateTime={new Date(event.createdAt).toISOString()}>{new Date(event.createdAt).toLocaleString()}</time>}</div>
            <p><span className="admin-tag">Recorded</span> {AUDIT_CATEGORIES[event.category]}{event.roomCode && <> · Room <strong className="admin-code">{event.roomCode}</strong></>}</p>
            <dl className="admin-audit-envelope">
              <dt>Administrator</dt><dd>{event.actorId ? <>{event.actorName ?? 'Account no longer available'} <span className="admin-secondary">({event.actorId})</span></> : 'External account operation; no administrator attribution was recorded'}</dd>
              {event.targetAdminId && <><dt>Account affected</dt><dd>{event.targetAdminName ?? 'Account no longer available'} <span className="admin-secondary">({event.targetAdminId})</span></dd></>}
              {event.targetSeatId && <><dt>Seat affected</dt><dd>{event.targetSeatId}</dd></>}
              {event.reason !== null && <><dt>Reason</dt><dd>{event.reason}</dd></>}
            </dl>
            {event.changes.length > 0 && <details><summary>Recorded settings</summary><dl className="admin-audit-changes">{event.changes.map(change => <div key={change.field}>
              <dt>{change.field}</dt><dd>{change.before !== null ? <><span className="admin-secondary">Before:</span> {change.before}<br /></> : null}{change.after !== null ? <><span className="admin-secondary">After:</span> {change.after}</> : null}</dd>
            </div>)}</dl></details>}
          </article>
        </li>)}</ol>}
        <nav className="admin-pagination" aria-label="Action history pages">
          {result.page > 1 && <><a className="admin-room-link" href={link(1)}>First page</a><a className="admin-room-link" href={link(result.page-1)}>Previous page</a></>}
          <span>Page {result.page} of {Math.max(1,Math.ceil(result.total/result.pageSize))}</span>
          {result.page*result.pageSize < result.total && <a className="admin-room-link" href={link(result.page+1)}>Next page</a>}
        </nav>
        <p className="admin-secondary">Times use your device’s time zone; date filters use UTC. Names reflect current administrator accounts. External provisioning and revocation records do not identify the person who ran the database operation. Rejected attempts are not yet recorded here. New actions may move records between pages.</p>
      </section>}
    </>}
  </main>;
}
