import { AdminError, type AdminIdentity } from './admin-access';

export type AdminOperations = {
  observedAt: number;
  rooms: number;
  removedRooms: number;
  archivedRooms: number;
  pausedRooms: number;
  closedRooms: number;
  activeSeats: number;
  unreadableRooms: number;
  lastRoomChange: number | null;
  backupSnapshots: number;
  backupBytes: number;
  backupDownloads: number;
  stalledRooms: number;
  oldestStalledChange: number | null;
  databasePages: number;
  databaseBytes: number;
};

export type AdminIntegrity = {
  observedAt: number;
  sqlite: 'passed' | 'failed';
  foreignKeys: 'passed' | 'failed';
};

/** A room whose public pending interaction has been idle for this long. */
export const ADMIN_STALL_MS = 6 * 60 * 60 * 1000;
/** Bounded diagnosis sample; the page never lists every stalled room. */
export const ADMIN_STALL_LIMIT = 10;

/** Public coordination facts only: the room code, the pending interaction kind and its age. */
export type AdminStalledDecision = {
  code: string;
  idleMs: number;
  kind: string;
  turn: number | null;
  phase: number | null;
};

const ownerAuthority = `SELECT a.role FROM admin_sessions s JOIN admin_accounts a ON a.id=s.admin_id
  WHERE s.token_hash=? AND a.id=? AND a.enabled=1 AND a.role='owner'
  AND s.revoked_at IS NULL AND s.expires_at>? AND s.generation=a.session_generation`;

/** A readable, started, live room that is waiting on a public interaction. */
const stalledRoom = `json_valid(r.state)=1
  AND COALESCE(m.removed,0)=0 AND COALESCE(c.closed,0)=0 AND COALESCE(a.archived,0)=0
  AND COALESCE(k.paused,0)=0
  AND json_extract(r.state,'$.status')='playing'
  AND (json_extract(r.state,'$.decision') IS NOT NULL
    OR json_extract(r.state,'$.response') IS NOT NULL
    OR json_extract(r.state,'$.truthtrance') IS NOT NULL
    OR json_extract(r.state,'$.phaseOpening') IS NOT NULL)`;
const stalledJoins = `FROM rooms r
  LEFT JOIN room_removals m ON m.room_code=r.code
  LEFT JOIN room_closures c ON c.room_code=r.code
  LEFT JOIN room_archives a ON a.room_code=r.code
  LEFT JOIN room_controls k ON k.room_code=r.code`;

type Counts = Omit<AdminOperations, 'observedAt' | 'databasePages' | 'databaseBytes'>;

/** Aggregate only operational counters, never serialized game or private backup rows. */
export async function readAdminOperations(database: D1Database, identity: AdminIdentity, now = Date.now()): Promise<AdminOperations> {
  const [counters, pages, pageSize] = await database.batch([
    database.prepare(`SELECT
    (SELECT COUNT(*) FROM rooms) rooms,
    (SELECT COUNT(*) FROM rooms r JOIN room_removals m ON m.room_code=r.code WHERE m.removed=1) removedRooms,
    (SELECT COUNT(*) FROM rooms r JOIN room_archives a ON a.room_code=r.code WHERE a.archived=1) archivedRooms,
    (SELECT COUNT(*) FROM rooms r JOIN room_controls c ON c.room_code=r.code WHERE c.paused=1) pausedRooms,
    (SELECT COUNT(*) FROM rooms r JOIN room_closures c ON c.room_code=r.code WHERE c.closed=1) closedRooms,
    (SELECT COUNT(*) FROM seats WHERE revoked=0) activeSeats,
    (SELECT COUNT(*) FROM rooms WHERE json_valid(state)=0) unreadableRooms,
    (SELECT MAX(updated_at) FROM rooms) lastRoomChange,
    (SELECT COUNT(*) FROM admin_room_backups) backupSnapshots,
    (SELECT COALESCE(SUM(size_bytes),0) FROM admin_room_backups) backupBytes,
    (SELECT COUNT(*) FROM admin_room_backup_downloads) backupDownloads,
    (SELECT COUNT(*) ${stalledJoins} WHERE ${stalledRoom} AND r.updated_at<?) stalledRooms,
    (SELECT MIN(r.updated_at) ${stalledJoins} WHERE ${stalledRoom} AND r.updated_at<?) oldestStalledChange
    WHERE EXISTS (${ownerAuthority})`)
      .bind(now - ADMIN_STALL_MS, now - ADMIN_STALL_MS, identity.sessionHash, identity.id, now),
    database.prepare('PRAGMA page_count'),
    database.prepare('PRAGMA page_size'),
  ]);
  const row = counters.results[0] as Counts | undefined;
  if (!row) throw new AdminError('Owner sign-in required.', 403);
  const count = (result: D1Result, column: string): number => {
    const value = (result.results[0] as Record<string, unknown> | undefined)?.[column];
    return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0;
  };
  const databasePages = count(pages, 'page_count');
  return {
    observedAt: now,
    ...row,
    databasePages,
    databaseBytes: databasePages * count(pageSize, 'page_size'),
  };
}

/** Bounded, read-only stalled-decision sample for the owner operations page. */
export async function readAdminStalledDecisions(database: D1Database, identity: AdminIdentity, now = Date.now()): Promise<AdminStalledDecision[]> {
  const result = await database.prepare(`SELECT r.code code, r.updated_at updatedAt,
    COALESCE(json_extract(r.state,'$.decision.kind'), json_extract(r.state,'$.response.kind'),
      CASE WHEN json_extract(r.state,'$.truthtrance') IS NOT NULL THEN 'truthtrance'
           WHEN json_extract(r.state,'$.phaseOpening') IS NOT NULL THEN 'phaseOpening' END) kind,
    json_extract(r.state,'$.turn') turn, json_extract(r.state,'$.phase') phase
    ${stalledJoins}
    WHERE (EXISTS (${ownerAuthority})) AND ${stalledRoom} AND r.updated_at<?
    ORDER BY r.updated_at ASC LIMIT ?`)
    .bind(identity.sessionHash, identity.id, now, now - ADMIN_STALL_MS, ADMIN_STALL_LIMIT)
    .all<{ code: string; updatedAt: number; kind: string; turn: number | null; phase: number | null }>();
  if (!result.results.length) {
    const authority = await database.prepare(ownerAuthority)
      .bind(identity.sessionHash, identity.id, now).first();
    if (!authority) throw new AdminError('Owner sign-in required.', 403);
  }
  return result.results.map(row => ({ code: row.code, idleMs: now - row.updatedAt,
    kind: row.kind, turn: row.turn, phase: row.phase }));
}

/** Explicit owner request; report only pass/fail, never SQLite diagnostics or row IDs. */
export async function readAdminIntegrity(database: D1Database, identity: AdminIdentity, now = Date.now()): Promise<AdminIntegrity> {
  const results = await database.batch([
    database.prepare(ownerAuthority).bind(identity.sessionHash, identity.id, now),
    database.prepare('PRAGMA quick_check(1)'),
    database.prepare('SELECT EXISTS(SELECT 1 FROM pragma_foreign_key_check LIMIT 1) AS violation'),
  ]);
  if (!results[0].results.length) throw new AdminError('Owner sign-in required.', 403);
  const quick = (results[1].results[0] as { quick_check?: unknown } | undefined)?.quick_check;
  const foreign = (results[2].results[0] as { violation?: unknown } | undefined)?.violation;
  if (typeof quick !== 'string' || foreign !== 0 && foreign !== 1)
    throw new AdminError('Database integrity check unavailable.', 503);
  return { observedAt: now, sqlite: quick === 'ok' ? 'passed' : 'failed',
    foreignKeys: foreign === 0 ? 'passed' : 'failed' };
}
