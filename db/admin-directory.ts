import type { Game } from '../game/engine';
import type { AdminDirectory, AdminRoom } from '../lib/admin-directory';
import { AdminError, type AdminIdentity } from './admin-access';

const phases = ['Storm', 'Spice Blow', 'CHOAM Charity', 'Bidding', 'Revival', 'Shipment & Movement', 'Battle', 'Spice Collection', 'Mentat Pause'];
const statuses = ['lobby', 'setup', 'playing', 'finished'] as const;
const expansionIds = ['ix', 'choam', 'ecaz'];
const text = (value: unknown, max = 80) => typeof value === 'string' ? value.slice(0, max) : '';
const integer = (value: unknown) => Number.isSafeInteger(value) && Number(value) >= 0 ? Number(value) : null;

/** Only emit allowlisted fields. Never call viewGame with an administrator's or host's seat. */
type DirectoryRow = { code: string; version: number; updated_at: number; state: string; removed?: number; archived?: number; control_closed?: number; control_paused?: number; control_join_locked?: number; control_revision?: number; control_updated_at?: number | null };
export function projectAdminRoom(row: DirectoryRow): AdminRoom {
  const base: AdminRoom = {
    code: row.code, version: row.version, updatedAt: row.updated_at,
    removed: row.removed === 1, archived: row.archived === 1,
    status: 'unreadable', host: null, players: [], advanced: false, preview: false,
    expansions: [], modules: [], turn: null, phase: 'Unavailable',
    pending: { label: 'Saved room needs inspection', owners: [] },
    control: { ...(row.control_closed === 1 ? { closed: true as const } : {}), paused: row.control_paused === 1, joinLocked: row.control_join_locked === 1, revision: row.control_revision ?? 0, updatedAt: row.control_updated_at ?? null },
  };
  try {
    const g = JSON.parse(row.state) as Game;
    if (!g || !statuses.includes(g.status) || !Array.isArray(g.players) ||
      g.players.length > 6 || g.players.some(p => !p || typeof p.id !== 'string' || p.id.length > 80 || typeof p.name !== 'string')) return base;
    const players: AdminRoom['players'] = g.players.map(p => ({
      id: text(p.id), name: text(p.name), faction: text(p.faction, 30),
      control: p.bot ? 'ai' : p.autopilot ? 'autopilot' : 'human',
    }));
    const seated = (id: unknown): id is string => typeof id === 'string' && players.some(p => p.id === id);
    let pending: AdminRoom['pending'] = { label: 'Table decision', owners: [] };
    if (g.status === 'finished') pending = { label: 'Game finished', owners: [] };
    else if (g.status === 'lobby') pending = { label: 'Lobby readiness', owners: g.players.filter(p => !p.ready).map(p => p.id) };
    else if (g.status === 'setup') pending = { label: 'Starting choices', owners: [] };
    else if (g.pendingTreacheryDiscard) pending = { label: 'Automatic continuation', owners: [] };
    else if (g.response || g.phaseOpening) pending = { label: 'Shared response window', owners: [] };
    else if (g.truthtrance) pending = { label: 'Truthtrance window', owners: [] };
    else if (g.decision) pending = { label: 'Special decision', owners: seated(g.decision.player) ? [g.decision.player] : [] };
    else if (g.battle) pending = { label: 'Battle decisions', owners: [g.battle.attacker, g.battle.defender].filter(seated) };
    else if (g.nexus) pending = { label: 'Nexus negotiations', owners: [] };
    else if (g.phase === 0 && g.stormDialers?.length) pending = { label: 'Storm dials', owners: g.stormDialers.filter(id => g.stormDials?.[id] === undefined).filter(seated) };
    else if (g.auction) pending = { label: 'Auction decision', owners: seated(g.auction.active) ? [g.auction.active] : [] };
    else if (seated(g.active)) pending = { label: 'Turn decision', owners: [g.active] };
    return { ...base, status: g.status, host: seated(g.host) ? g.host : null, players,
      advanced: g.advanced === true, preview: g.advancedPreview === true,
      expansions: expansionIds.filter(id => Array.isArray(g.expansions) && g.expansions.includes(id)),
      modules: [g.techTokens && 'Tech Tokens', g.strongholdCards && 'Stronghold Cards', g.leaderSkills && 'Leader Skills', g.homeworlds && 'Homeworlds', g.nexusCards && 'Nexus Cards', g.discoveryEnabled && 'Discoveries', g.ecazTreachery && 'Ecaz Treachery'].filter((s): s is string => typeof s === 'string'),
      turn: integer(g.turn), phase: g.status === 'lobby' ? 'Lobby' : g.status === 'setup' ? 'Setup' : phases[g.phase] ?? 'Unknown phase', pending };
  } catch { return base; }
}

export async function readAdminDirectory(database: D1Database, identity: AdminIdentity, search: URLSearchParams, now = Date.now()): Promise<AdminDirectory> {
  const allowed = ['q', 'status', 'rules', 'sort', 'page', 'availability', 'removal', 'archive'];
  if ([...search.keys()].some(k => !allowed.includes(k) || search.getAll(k).length !== 1)) throw new AdminError('Invalid room filters.', 400);
  const q = (search.get('q') ?? '').trim();
  const status = search.get('status') ?? 'all';
  const rules = search.get('rules') ?? 'all';
  const sort = search.get('sort') ?? 'recent';
  const rawPage = search.get('page') ?? '1';
  const availability = search.get('availability') ?? 'all';
  const removal = search.get('removal') ?? 'active';
  const archive = search.get('archive') ?? 'unarchived';
  if (q.length > 80 || !['all', ...statuses].includes(status) || !['all', 'basic', 'advanced'].includes(rules) ||
      !['recent', 'oldest', 'code'].includes(sort) || !['all', 'running', 'paused', 'locked', 'closed'].includes(availability) || !['active', 'removed', 'all'].includes(removal) || !['unarchived', 'archived', 'all'].includes(archive) || !/^[1-9][0-9]{0,5}$/.test(rawPage)) throw new AdminError('Invalid room filters.', 400);
  const page = Number(rawPage), pageSize = 25;
  // json_valid protects the rest of the directory if a legacy save is malformed.
  const state = "CASE WHEN json_valid(state) THEN state ELSE '{}' END";
  // Each read is fenced again inside the transaction: prior authentication is
  // not authority to read after another browser revokes this session.
  const authority = `SELECT 1 FROM admin_sessions s JOIN admin_accounts a ON a.id = s.admin_id
    WHERE s.token_hash = ? AND a.id = ? AND a.enabled = 1 AND s.revoked_at IS NULL
    AND s.expires_at > ? AND s.generation = a.session_generation
    AND a.role IN ('owner','operator','viewer')`;
  const credentials = [identity.sessionHash, identity.id, now];
  const where: string[] = [`EXISTS (${authority})`];
  const args: (string | number)[] = [...credentials];
  if (q) {
    const players = `CASE WHEN json_type(${state}, '$.players') = 'array' THEN json_extract(${state}, '$.players') ELSE '[]' END`;
    where.push(`(code LIKE ? ESCAPE '\\' OR EXISTS (SELECT 1 FROM json_each(${players}) p WHERE json_extract(CASE WHEN p.type = 'object' THEN p.value ELSE '{}' END, '$.name') LIKE ? ESCAPE '\\'))`);
    const pattern = `%${q.replace(/[\\%_]/g, '\\$&')}%`;
    args.push(pattern, pattern);
  }
  if (status !== 'all') { where.push(`json_extract(${state}, '$.status') = ?`); args.push(status); }
  if (rules !== 'all') { where.push(`json_extract(${state}, '$.advanced') = ?`); args.push(rules === 'advanced' ? 1 : 0); }
  if (availability === 'paused') where.push('c.paused = 1');
  if (availability === 'running') where.push('COALESCE(c.paused, 0) = 0 AND COALESCE(cl.closed, 0) = 0 AND COALESCE(m.removed, 0) = 0');
  if (availability === 'closed') where.push('cl.closed = 1');
  if (availability === 'locked') where.push('c.join_locked = 1');
  if (removal !== 'all') { where.push('COALESCE(m.removed,0) = ?'); args.push(removal === 'removed' ? 1 : 0); }
  if (archive !== 'all') { where.push('COALESCE(ar.archived,0) = ?'); args.push(archive === 'archived' ? 1 : 0); }
  const predicate = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const order = sort === 'code' ? 'r.code ASC' : `r.updated_at ${sort === 'oldest' ? 'ASC' : 'DESC'}, r.code ASC`;
  const source = 'FROM rooms r LEFT JOIN room_controls c ON c.room_code = r.code LEFT JOIN room_removals m ON m.room_code = r.code LEFT JOIN room_closures cl ON cl.room_code = r.code LEFT JOIN room_archives ar ON ar.room_code = r.code';
  const results = await database.batch([
    database.prepare(authority).bind(...credentials),
    database.prepare(`SELECT COUNT(*) AS total ${source} ${predicate}`).bind(...args),
    database.prepare(`SELECT r.code,r.version,r.updated_at,r.state,COALESCE(ar.archived,0) AS archived,COALESCE(m.removed,0) AS removed,COALESCE(cl.closed,0) AS control_closed,COALESCE(c.paused,0) AS control_paused,COALESCE(c.join_locked,0) AS control_join_locked,COALESCE(c.revision,0) AS control_revision,c.updated_at AS control_updated_at ${source} ${predicate} ORDER BY ${order} LIMIT ? OFFSET ?`).bind(...args, pageSize, (page - 1) * pageSize),
  ]);
  if (!results[0].results.length) throw new AdminError('Administrator sign-in required.', 401);
  const total = Number((results[1].results[0] as { total: number }).total);
  const rows = results[2].results as DirectoryRow[];
  return { rooms: rows.map(projectAdminRoom), total, page, pageSize };
}
