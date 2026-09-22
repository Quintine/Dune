'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Shield, RefreshCw, LogOut } from 'lucide-react';
import { ClientRequestError, requestJson } from '@/lib/client-request';
import type { AdminDirectory } from '@/lib/admin-directory';
import { FACTIONS } from '@/game/catalog';
import { AdminRoomControls } from '@/components/admin-room-controls';
import { AdminRoomCreation } from '@/components/admin-room-creation';
import './admin.css';

type Account = { id: string; name: string; role: 'owner' | 'operator' | 'viewer' };
type Filters = { q: string; status: string; rules: string; sort: string; availability: string };
const initialFilters: Filters = { q: '', status: 'all', rules: 'all', sort: 'recent', availability: 'all' };
const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'The request could not be completed.';

export default function Administration() {
  const [account, setAccount] = useState<Account | null>(null);
  const [restoring, setRestoring] = useState(true);
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [directory, setDirectory] = useState<AdminDirectory | null>(null);
  const [filters, setFilters] = useState(initialFilters);
  const [applied, setApplied] = useState(initialFilters);
  const [confirmAll, setConfirmAll] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [operationBusy, setOperationBusy] = useState(false);
  const controlsBusy = busy || operationBusy;
  const epoch = useRef(0);
  const clearSession = useCallback(() => {
    epoch.current++;
    setAccount(null); setDirectory(null); setConfirmAll(false);
    setBusy(false); setSelectedRoom(null); setCreatingRoom(false);
  }, []);
  const accessChanged = useCallback(() => {
    clearSession();
    setNotice('Administrator access changed. Sign in again to confirm any saved room request.');
  }, [clearSession]);
  const load = useCallback(async (next: Filters, page = 1) => {
    const current = ++epoch.current;
    setBusy(true); setNotice('');
    try {
      const query = new URLSearchParams({ ...next, page: String(page) });
      const result = await requestJson<AdminDirectory>('/api/admin/rooms?' + query, { cache: 'no-store' });
      if (current === epoch.current) { setDirectory(result); setApplied(next); }
    } catch (error) {
      if (current === epoch.current) {
        if (error instanceof ClientRequestError && [401, 403].includes(error.status ?? 0)) clearSession();
        setNotice(errorMessage(error));
      }
    } finally { if (current === epoch.current) setBusy(false); }
  }, [clearSession]);
  useEffect(() => {
    let canceled = false;
    requestJson<{ admin: Account }>('/api/admin/session', { cache: 'no-store' })
      .then(async result => { if (!canceled) { setAccount(result.admin); await load(initialFilters); } })
      .catch(error => { if (!canceled && !(error instanceof ClientRequestError && error.status === 401)) setNotice(errorMessage(error)); })
      .finally(() => { if (!canceled) setRestoring(false); });
    return () => { canceled = true; };
  }, [load]);

  async function sessionAction(action: 'login' | 'logout' | 'logoutAll') {
    if (controlsBusy) return;
    setBusy(true); setNotice('');
    const submittedKey = key.trim();
    setKey('');
    try {
      const result = await requestJson<{ admin?: Account }>('/api/admin/session', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...(action === 'login' ? { key: submittedKey } : {}) }),
      });
      if (result.admin) { setAccount(result.admin); await load(initialFilters); }
      else { clearSession(); setNotice(action === 'logoutAll' ? 'All your administrator sessions are signed out.' : 'Signed out.'); }
    } catch (error) {
      // Reconcile an uncertain response with a read; never repeat a mutation automatically.
      try {
        const result = await requestJson<{ admin: Account }>('/api/admin/session', { cache: 'no-store' });
        setAccount(result.admin);
        await load(initialFilters);
        setNotice(action === 'login' ? '' : 'You are still signed in. Retry the sign-out action.');
      } catch (readError) {
        if (readError instanceof ClientRequestError && readError.status === 401) clearSession();
        setNotice(errorMessage(error));
      }
    } finally { setBusy(false); }
  }

  return <main className="admin-shell">
    <header className="admin-header">
      <div><a className="admin-return" href="/">Arrakis Table</a><h1><Shield aria-hidden="true" /> Administration</h1></div>
      {account && <div className="admin-session"><span>{account.name} <span className="admin-tag">{account.role}</span></span>
        <Button variant="outline" disabled={controlsBusy} onClick={() => void sessionAction('logout')}><LogOut aria-hidden="true" /> Sign out</Button></div>}
    </header>
    {notice && <output className="admin-notice">{notice}</output>}
    {restoring ? <output>Checking administrator access…</output> : !account ?
      <section className="admin-login" aria-labelledby="admin-sign-in">
        <h2 id="admin-sign-in">Administrator sign-in</h2>
        <p>Use your personal administrator access key. Room invitations and saved-seat recovery kits cannot sign in here.</p>
        <form onSubmit={event => { event.preventDefault(); void sessionAction('login'); }}>
          <label htmlFor="admin-key">Access key</label>
          <Input id="admin-key" type="password" autoComplete="current-password" autoCapitalize="none" spellCheck={false}
            maxLength={130} value={key} onChange={event => setKey(event.target.value)} required disabled={controlsBusy} />
          <Button type="submit" disabled={controlsBusy || !key.trim()}>{busy ? 'Signing in…' : 'Sign in'}</Button>
        </form>
        <p className="admin-secondary">First setup: the server owner creates a personal key using the installation instructions. Access is closed until an administrator is provisioned.</p>
      </section> : <>
      <section aria-labelledby="admin-rooms-title">
        <div className="admin-section-heading"><div><h2 id="admin-rooms-title">Rooms</h2><p className="admin-secondary">Public room details. Cards, sealed choices and private discussion stay hidden.</p></div>
          <div className="admin-room-actions">{account.role !== 'viewer' && <Button disabled={controlsBusy} onClick={() => { setSelectedRoom(null); setCreatingRoom(true); }}>Create a room</Button>}
            <Button variant="outline" disabled={controlsBusy} onClick={() => void load(applied, directory?.page ?? 1)}><RefreshCw aria-hidden="true" /> Refresh</Button></div></div>
        {creatingRoom && account.role !== 'viewer' && <AdminRoomCreation key={account.id} accountId={account.id}
          onClose={() => setCreatingRoom(false)} onDenied={accessChanged} onBusyChange={setOperationBusy}
          onCreated={code => { const next = { ...initialFilters, q: code }; setFilters(next); void load(next); }} />}
        <form className="admin-filters" onSubmit={event => { event.preventDefault(); void load(filters); }}>
          <label className="admin-search" htmlFor="admin-search">Room code or player name<Input id="admin-search" value={filters.q} maxLength={80} disabled={controlsBusy} onChange={e => setFilters({ ...filters, q: e.target.value })} /></label>
          <label>Status<select disabled={controlsBusy} value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })}>
            <option value="all">All statuses</option><option value="lobby">Lobby</option><option value="setup">Setup</option><option value="playing">Playing</option><option value="finished">Finished</option>
          </select></label>
          <label>Rules<select disabled={controlsBusy} value={filters.rules} onChange={e => setFilters({ ...filters, rules: e.target.value })}>
            <option value="all">All rules</option><option value="basic">Basic</option><option value="advanced">Advanced</option>
          </select></label>
          <label>Availability<select disabled={controlsBusy} value={filters.availability} onChange={e => setFilters({ ...filters, availability: e.target.value })}>
            <option value="all">All rooms</option><option value="running">Running</option><option value="paused">Paused</option><option value="locked">New joins locked</option>
          </select></label>
          <label>Sort<select disabled={controlsBusy} value={filters.sort} onChange={e => setFilters({ ...filters, sort: e.target.value })}>
            <option value="recent">Recently changed</option><option value="oldest">Oldest change</option><option value="code">Room code</option>
          </select></label>
          <Button type="submit" disabled={controlsBusy}>Apply filters</Button>
        </form>
        {selectedRoom && <AdminRoomControls key={`${account.id}:${selectedRoom}`} accountId={account.id} code={selectedRoom}
          canManage={account.role !== 'viewer'} onClose={() => setSelectedRoom(null)} onDenied={accessChanged}
          onUpdated={() => void load(applied, directory?.page ?? 1)} onBusyChange={setOperationBusy} />}
        <div aria-busy={busy}>
          {!directory ? <output>{busy ? 'Loading rooms…' : 'Use Refresh to load rooms.'}</output> : <>
            <p className="admin-results">{directory.total.toLocaleString()} {directory.total === 1 ? 'room' : 'rooms'} match</p>
            {directory.rooms.length === 0 ? <p>No rooms on this page. Change the filters or return to the first page.</p> :
              <Table className="admin-room-table"><TableHeader><TableRow>
                <TableHead>Room & players</TableHead><TableHead>Rules</TableHead><TableHead>Progress</TableHead><TableHead>Last game change</TableHead>
              </TableRow></TableHeader><TableBody>{directory.rooms.map(room => <TableRow key={room.code}>
                <TableCell><strong className="admin-code">{room.code}</strong> <span className="admin-tag">{room.status}</span>
                  {room.control.paused && <span className="admin-tag">Paused</span>}
                  {room.control.joinLocked && <span className="admin-tag">Joins locked</span>}
                  <p>Host: {room.players.find(p => p.id === room.host)?.name ?? 'Unavailable'}</p>
                  <details><summary>{room.players.length} {room.players.length === 1 ? 'player' : 'players'}</summary><ul>{room.players.map(player => <li key={player.id}>{player.name} · {FACTIONS.find(f => f.id === player.faction)?.name ?? player.faction} · {player.control === 'ai' ? 'AI' : player.control === 'autopilot' ? 'Human seat on AI' : 'Human'}</li>)}</ul></details>
                </TableCell>
                <TableCell>{room.advanced ? room.preview ? 'Advanced preview' : 'Advanced development' : 'Basic'}
                  {room.expansions.length > 0 && <p>Expansions: {room.expansions.map(id => id === 'ix' ? 'Ixians & Tleilaxu' : id === 'choam' ? 'CHOAM & Richese' : 'Ecaz & Moritani').join(', ')}</p>}
                  <p className="admin-secondary">{room.modules.join(', ') || 'No optional modules'}</p>
                </TableCell>
                <TableCell>{room.turn !== null && room.status !== 'lobby' ? `Turn ${room.turn} · ` : ''}{room.phase}
                  <p>{room.pending.label}{room.pending.owners.length > 0 ? ': ' + room.pending.owners.map(id => room.players.find(p => p.id === id)?.name).filter(Boolean).join(', ') : ''}</p>
                </TableCell>
                <TableCell><Button variant="outline" disabled={controlsBusy} onClick={() => { setCreatingRoom(false); setSelectedRoom(room.code); }}>Room controls · {room.code}</Button><p><time dateTime={new Date(room.updatedAt).toISOString()}>{new Date(room.updatedAt).toLocaleString()}</time></p><p className="admin-secondary">Version {room.version}</p></TableCell>
              </TableRow>)}</TableBody></Table>}
            <nav className="admin-pagination" aria-label="Room pages">
              <Button variant="outline" disabled={controlsBusy || directory.page <= 1} onClick={() => void load(applied, 1)}>First</Button>
              <Button variant="outline" disabled={controlsBusy || directory.page <= 1} onClick={() => void load(applied, directory.page - 1)}>Previous</Button>
              <span>Page {directory.page} of {Math.max(1, Math.ceil(directory.total / directory.pageSize))}</span>
              <Button variant="outline" disabled={controlsBusy || directory.page * directory.pageSize >= directory.total} onClick={() => void load(applied, directory.page + 1)}>Next</Button>
            </nav>
          </>}
        </div>
      </section>
      <section className="admin-session-control" aria-labelledby="admin-access-title"><h2 id="admin-access-title">Your access</h2>
        <p>Sessions expire after eight hours. Sign out everywhere to end all your current administrator sessions, including this browser. Your personal access key remains valid.</p>
        {!confirmAll ? <Button variant="outline" disabled={controlsBusy} onClick={() => setConfirmAll(true)}>Sign out everywhere…</Button> :
          <div className="admin-confirm"><p>End all your administrator sessions now?</p><Button disabled={controlsBusy} onClick={() => void sessionAction('logoutAll')}>Confirm sign out everywhere</Button><Button variant="outline" disabled={controlsBusy} onClick={() => setConfirmAll(false)}>Cancel</Button></div>}
      </section>
      <p className="admin-secondary admin-development">Administration preview: create a lobby with a new host seat, pause/resume rooms and manage joining locks. Archive/removal, participant support and backup tools are still being implemented.</p>
    </>}
  </main>;
}
