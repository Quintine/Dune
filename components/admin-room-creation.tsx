'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { FACTIONS, type FactionId } from '@/game/catalog';
import { ClientRequestError, requestJson, requestMayHaveCompleted } from '@/lib/client-request';
import { retainAdminRoomRequest } from '@/lib/admin-room-control-client';
import { clearAdminRoomCreation, completeAdminRoomCreation, newAdminRoomCreationRequest, readAdminRoomCreation, saveAdminRoomCreation, validAdminRoomCreationResult, type AdminRoomCreationRecord } from '@/lib/admin-room-creation-client';
import type { AdminRoomCreationInput, AdminRoomCreationResult } from '@/lib/admin-room-creation';

type Props = { accountId: string; onClose: () => void; onCreated: (code: string) => void; onDenied: () => void; onBusyChange: (busy: boolean) => void };
const factions = FACTIONS.filter(faction => faction.expansion === 'base');
const difficulties = ['Easy', 'Medium', 'Hard', 'Brutal'] as const;
const message = (error: unknown) => error instanceof Error ? error.message : 'The room could not be created.';

export function AdminRoomCreation({ accountId, onClose, onCreated, onDenied, onBusyChange }: Props) {
  const [name, setName] = useState('');
  const [faction, setFaction] = useState<FactionId>('atreides');
  const [advanced, setAdvanced] = useState(false);
  const [techTokens, setTechTokens] = useState(false);
  const [strongholdCards, setStrongholdCards] = useState(false);
  const [bots, setBots] = useState<AdminRoomCreationInput['bots']>([]);
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [record, setRecord] = useState<AdminRoomCreationRecord | null>(null);
  const [storageProblem, setStorageProblem] = useState(false);
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [initialRequestPending, setInitialRequestPending] = useState(false);
  const alive = useRef(false), inFlight = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    alive.current = true;
    heading.current?.focus();
    try {
      const saved = readAdminRoomCreation(window.sessionStorage, accountId);
      // oxlint-disable-next-line react/react-compiler -- Restore tab-scoped creation proof after SSR.
      setRecord(saved);
      if (saved?.kind === 'pending') setNotice('This tab has an unconfirmed room request. Retry it to find the original room.');
    } catch (error) { setStorageProblem(true); setNotice(message(error)); }
    setLoading(false);
    return () => { alive.current = false; };
  }, [accountId]);

  async function submit(saved?: AdminRoomCreationInput) {
    if (inFlight.current || storageProblem || (!saved && (!confirmed || record))) return;
    let input: AdminRoomCreationInput;
    try {
      input = saved ?? newAdminRoomCreationRequest({ name, faction, advanced, techTokens, strongholdCards, bots, reason });
      saveAdminRoomCreation(window.sessionStorage, accountId, input);
    } catch (error) { setNotice(message(error)); return; }
    inFlight.current = true; setInitialRequestPending(!saved); setBusy(true); onBusyChange(true);
    setRecord({ kind: 'pending', input }); setNotice('Creating your room…');
    try {
      const result = await requestJson<AdminRoomCreationResult>('/api/admin/rooms', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Dune-Admin-Id': accountId }, body: JSON.stringify(input),
      });
      if (validAdminRoomCreationResult(result) && result.operationId === input.operationId && result.roomRemoved) {
        if (alive.current) {
          setNotice(`Room ${result.code} exists but has been removed. Its exact creation proof is still saved in this tab. Restore the room in Administration, then retry this same request to confirm host access.`);
          setConfirmed(false);
          onCreated(result.code);
        }
        return;
      }
      completeAdminRoomCreation(window.sessionStorage, accountId, input, result);
      if (alive.current) {
        setRecord({ kind: 'completed', result }); setConfirmed(false);
        setNotice(result.replayed ? 'The original room has been found. No duplicate room was created.' : 'Room created. The lobby is ready to configure and invite players.');
        onCreated(result.code);
      }
    } catch (error) {
      let cleared = false;
      if (!retainAdminRoomRequest(error)) {
        try { clearAdminRoomCreation(window.sessionStorage, accountId); cleared = true; } catch { /* Preserve exact retry if storage is unavailable. */ }
      }
      if (alive.current) {
        if (cleared) setRecord(null);
        setConfirmed(false);
        setNotice(requestMayHaveCompleted(error) ? `${message(error)} The room may already exist. Retry the saved request to confirm it.` : message(error));
        if (error instanceof ClientRequestError && [401, 403].includes(error.status ?? 0)) onDenied();
      }
    } finally { inFlight.current = false; onBusyChange(false); if (alive.current) { setInitialRequestPending(false); setBusy(false); } }
  }

  function clearRecord() {
    if (busy || (storageProblem && !confirmed)) return;
    try {
      clearAdminRoomCreation(window.sessionStorage, accountId);
      setRecord(null); setStorageProblem(false); setConfirmed(false);
      setNotice('Local creation record cleared. Existing rooms and saved seats are unchanged.');
    } catch (error) { setNotice(message(error)); }
  }

  function addBot() {
    const next = factions.find(item => item.id !== faction && !bots.some(bot => bot.faction === item.id));
    if (next) { setBots([...bots, { faction: next.id, difficulty: 'Medium' }]); setConfirmed(false); }
  }

  const result = record?.kind === 'completed' ? record.result : null;
  return <section className="admin-room-control admin-room-creation" aria-labelledby="admin-create-title" aria-busy={busy || loading}>
    <div className="admin-section-heading"><h2 id="admin-create-title" ref={heading} tabIndex={-1}>Create a room</h2><Button variant="outline" disabled={busy} onClick={onClose}>Close room creation</Button></div>
    {notice && <output className="admin-notice">{notice}</output>}
    {loading ? <output>Checking this tab’s saved creation request…</output> : storageProblem ? <div className="admin-confirm">
      <p>A room may already have been created. Check the directory before removing this unreadable record. Removing it cannot cancel creation and may lose this tab’s host-seat retry proof.</p>
      <label className="admin-check"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />I checked the directory and want to discard this local record.</label>
      <Button disabled={!confirmed} onClick={clearRecord}>Discard unreadable local record</Button>
    </div> : initialRequestPending ? null : record?.kind === 'pending' ? <div className="admin-confirm">
      <p>Unconfirmed room: host <strong>{record.input.name}</strong> · {record.input.advanced ? 'Advanced preview' : 'Basic'} · {record.input.bots.length} AI players.</p>
      <p>The exact request is kept privately in this tab across refresh. Keep the tab and its storage until the result is confirmed. Retrying finds the same room.</p>
      <Button disabled={busy} onClick={() => void submit(record.input)}>Retry saved room creation</Button>
    </div> : result ? <div className="admin-created-result">
      <h3>Room <span className="admin-code">{result.code}</span></h3>
      <p>Share invitation code <strong>{result.code}</strong>. Players can enter it on the home page to join an available faction.</p>
      {result.hostAccess ? <><p>When creation was confirmed, this browser received the host seat. Open the lobby to change settings, invite human players, or use <strong>Pass your seat to another player</strong> to give someone else the host seat.</p><a className="admin-room-link" href={`/?room=${result.code}`}>Open your host seat</a></> : <p>The original host seat has since been transferred or its access revoked. This confirmation does not restore old seat access.</p>}
      <Button variant="outline" onClick={clearRecord}>Create another room</Button>
    </div> : <form onSubmit={event => { event.preventDefault(); void submit(); }}>
      <p>Create a lobby with a new human host seat in this browser. Players join by invitation; AI seats can be included below. Nothing starts until the host and players complete normal readiness.</p>
      <div className="admin-create-grid">
        <label htmlFor="admin-host-name">Host player name<Input id="admin-host-name" value={name} maxLength={32} required disabled={busy} onChange={event => { setName(event.target.value); setConfirmed(false); }} /></label>
        <label htmlFor="admin-host-faction">Host faction<select id="admin-host-faction" value={faction} disabled={busy} onChange={event => { setFaction(event.target.value as FactionId); setConfirmed(false); }}>
          {factions.map(item => <option key={item.id} value={item.id} disabled={bots.some(bot => bot.faction === item.id)}>{item.name}</option>)}
        </select></label>
        <label htmlFor="admin-create-rules">Rules<select id="admin-create-rules" value={advanced ? 'advanced' : 'basic'} disabled={busy} onChange={event => { setAdvanced(event.target.value === 'advanced'); if (event.target.value === 'basic') setStrongholdCards(false); setConfirmed(false); }}>
          <option value="basic">Basic</option><option value="advanced">Advanced preview</option>
        </select></label>
      </div>
      {advanced && <p className="admin-notice">Advanced preview is unfinished. Only the six classic factions are available, and starting requires the existing preview confirmation.</p>}
      <label className="admin-check"><input type="checkbox" checked={techTokens} disabled={busy} onChange={event => { setTechTokens(event.target.checked); setConfirmed(false); }} />Tech Tokens · at least three players required to start</label>
      <label className="admin-check"><input type="checkbox" checked={strongholdCards} disabled={busy || !advanced} onChange={event => { setStrongholdCards(event.target.checked); setConfirmed(false); }} />Stronghold Cards · Advanced rules required</label>
      <fieldset disabled={busy}><legend>Initial AI players</legend>
        <p className="admin-secondary">The other seats remain available for human players. AI strategy tuning is still in development.</p>
        {bots.map((bot, index) => <div className="admin-create-bot" key={index}>
          <label htmlFor={`admin-bot-faction-${index}`}>AI {index + 1} faction<select id={`admin-bot-faction-${index}`} value={bot.faction} onChange={event => { setBots(bots.map((item, at) => at === index ? { ...item, faction: event.target.value as FactionId } : item)); setConfirmed(false); }}>
            {factions.map(item => <option key={item.id} value={item.id} disabled={item.id === faction || bots.some((other, at) => at !== index && other.faction === item.id)}>{item.name}</option>)}
          </select></label>
          <label htmlFor={`admin-bot-difficulty-${index}`}>Difficulty<select id={`admin-bot-difficulty-${index}`} value={bot.difficulty} onChange={event => { const difficulty = difficulties.find(value => value === event.target.value); if (difficulty) setBots(bots.map((item, at) => at === index ? { ...item, difficulty } : item)); setConfirmed(false); }}>
            {difficulties.map(value => <option key={value}>{value}</option>)}
          </select></label>
          <Button type="button" variant="outline" onClick={() => { setBots(bots.filter((_, at) => at !== index)); setConfirmed(false); }}>Remove AI {index + 1}</Button>
        </div>)}
        <Button type="button" variant="outline" disabled={bots.length >= 5} onClick={addBot}>Add an AI player</Button>
      </fieldset>
      <label htmlFor="admin-create-reason">Reason for the audit history<Input id="admin-create-reason" value={reason} maxLength={300} required disabled={busy} onChange={event => { setReason(event.target.value); setConfirmed(false); }} /></label>
      <p className="admin-secondary">Use an operational reason; leave out credentials and private game information.</p>
      <div className="admin-confirm"><label className="admin-check"><input type="checkbox" checked={confirmed} disabled={busy} onChange={event => setConfirmed(event.target.checked)} />This browser will own the new host seat. I have checked these settings.</label>
        <Button type="submit" disabled={busy || !confirmed || !name.trim() || !reason.trim()}>Create room with host seat</Button>
      </div>
    </form>}
  </section>;
}
