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
};

export type AdminIntegrity = {
  observedAt: number;
  sqlite: 'passed' | 'failed';
  foreignKeys: 'passed' | 'failed';
};

const ownerAuthority = `SELECT a.role FROM admin_sessions s JOIN admin_accounts a ON a.id=s.admin_id
  WHERE s.token_hash=? AND a.id=? AND a.enabled=1 AND a.role='owner'
  AND s.revoked_at IS NULL AND s.expires_at>? AND s.generation=a.session_generation`;

type Counts = Omit<AdminOperations, 'observedAt'>;

/** Aggregate only operational counters, never serialized game or private backup rows. */
export async function readAdminOperations(database: D1Database, identity: AdminIdentity, now = Date.now()): Promise<AdminOperations> {
  const row = await database.prepare(`SELECT
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
    (SELECT COUNT(*) FROM admin_room_backup_downloads) backupDownloads
    WHERE EXISTS (${ownerAuthority})`)
    .bind(identity.sessionHash, identity.id, now).first<Counts>();
  if (!row) throw new AdminError('Owner sign-in required.', 403);
  return { observedAt: now, ...row };
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
