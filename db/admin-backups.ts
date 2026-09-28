import { AdminError, type AdminIdentity } from './admin-access';

export type BackupMetadata = { id: string; roomCode: string; roomVersion: number; createdAt: number; sizeBytes: number; digest: string };
export type BackupInput = { roomCode: string; operationId: string; expectedVersion: number; reason: string };
export const MAX_BACKUP_BYTES = 1_800_000;
export const MAX_ROOM_BACKUP_BYTES = 16 * 1024 * 1024;
export const MAX_TOTAL_BACKUP_BYTES = 64 * 1024 * 1024;
export const MAX_ROOM_BACKUPS = 32;
export const MAX_BACKUP_DOWNLOADS = 32_768;
const roomCodePattern = /^[A-Z2-9]{8}$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const authority = `SELECT 1 FROM admin_sessions s JOIN admin_accounts a ON a.id=s.admin_id
  WHERE s.token_hash=? AND a.id=? AND a.enabled=1 AND s.revoked_at IS NULL
  AND s.expires_at>? AND s.generation=a.session_generation AND a.role='owner'`;
const authArgs = (identity: AdminIdentity, now: number) => [identity.sessionHash, identity.id, now] as const;

// Explicit, versioned allowlist of all room-owned persistence. No admin access keys,
// admin sessions or other rooms enter the backup. Add new room-owned tables here when introduced.
const roomTables = {
  seats: ['token_hash', 'revoked', 'room_code', 'player_id'],
  room_controls: ['room_code', 'paused', 'join_locked', 'revision', 'updated_at'],
  room_removals: ['room_code', 'removed', 'revision', 'removed_at', 'updated_at'],
  room_closures: ['room_code', 'closed', 'revision', 'closed_at', 'updated_at'],
  room_archives: ['room_code', 'archived', 'revision', 'archived_at', 'updated_at'],
  seat_recovery_keys: ['room_code', 'player_id', 'recovery_hash', 'current_operation_hash'],
  seat_recovery_receipts: ['room_code', 'player_id', 'operation_hash', 'recovery_hash', 'session_hash'],
  seat_handover_offers: ['room_code', 'player_id', 'offer_hash', 'secret_hash', 'issuer_session_hash', 'expires_at', 'claim_operation_hash', 'session_hash', 'claimed_at'],
  seat_handover_claim_receipts: ['room_code', 'player_id', 'operation_hash', 'offer_hash', 'secret_hash', 'session_hash', 'claim_fence', 'claimed_at'],
  seat_ai_delegations: ['room_code', 'owner_id', 'grant_id', 'delegate_id', 'difficulty', 'owner_session_hash', 'delegate_session_hash', 'expires_at', 'used_at', 'revoked_at'],
  room_entry_receipts: ['operation_hash', 'request_hash', 'session_hash', 'room_code', 'player_id'],
  seat_discussion_controls: ['room_code', 'player_id', 'muted', 'revision', 'updated_at'],
  room_messages: ['sequence', 'room_code', 'id', 'sender_id', 'sender_session_hash', 'sender_name', 'sender_faction', 'recipient_id', 'recipient_name', 'body', 'created_at'],
} as const;
const entries = Object.entries(roomTables);
const tableJson = entries.map(([table, columns]) =>
  `'${table}',json((SELECT json_group_array(json_object(${columns.map(column => `'${column}',${column}`).join(',')})) FROM (SELECT ${columns.join(',')} FROM ${table} WHERE room_code=r.code ORDER BY rowid)))`,
).join(',');
// Counting encoded JSON rows plus one separator each is a conservative upper
// bound on the eventual payload. Guard BEFORE constructing any >2MB D1 cell.
const skeleton = `json_object('format',1,'room',json_object('code',r.code,'state','','version',r.version,'updated_at',r.updated_at),'tables',json_object(${entries.map(([table]) => `'${table}',json('[]')`).join(',')}))`;
// Quote at most 100,000 characters at a time: escaping a near-2MB saved
// state in a single json_object/json_quote would itself exceed D1's cell limit.
const stateBytes = `(WITH RECURSIVE chunks(pos) AS (
  SELECT 1 UNION ALL SELECT pos+100000 FROM chunks WHERE pos+100000 <= length(r.state)
) SELECT COALESCE(SUM(length(CAST(json_quote(substr(r.state,pos,100000)) AS BLOB))-2),0) FROM chunks)`;
const estimate = `length(CAST(${skeleton} AS BLOB)) + ${stateBytes} + ${entries.map(([table, columns]) =>
  `(SELECT COALESCE(SUM(length(CAST(json_object(${columns.map(column => `'${column}',${column}`).join(',')}) AS BLOB))+1),0) FROM ${table} WHERE room_code=r.code)`,
).join(' + ')}`;
const snapshot = `SELECT r.code,r.version,CASE WHEN (${estimate}) <= ${MAX_BACKUP_BYTES} THEN json_object('format',1,'room',json_object('code',r.code,'state',r.state,'version',r.version,'updated_at',r.updated_at),'tables',json_object(${tableJson})) ELSE NULL END payload FROM rooms r WHERE r.code=? AND EXISTS (${authority})`;

type RawMetadata = { operation_id: string; room_code: string; room_version: number; created_at: number; size_bytes: number; digest: string };
type RawBackup = RawMetadata & { payload: string };
const metadata = (row: RawMetadata): BackupMetadata => ({ id: row.operation_id, roomCode: row.room_code, roomVersion: row.room_version, createdAt: row.created_at, sizeBytes: row.size_bytes, digest: row.digest });
const digestOf = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), byte => byte.toString(16).padStart(2, '0')).join('');
const owner = (result: D1Result) => {
  if (!result.results.length) throw new AdminError('Owner access required. Sign in again.', 403);
};
type Receipt = RawMetadata & { actor_admin_id: string; request_hash: string };
const receiptQuery = `SELECT operation_id,actor_admin_id,room_code,request_hash,room_version,created_at,size_bytes,digest FROM admin_room_backups WHERE operation_id=? AND EXISTS (${authority})`;
function replay(receipt: Receipt, identity: AdminIdentity, roomCode: string, requestHash: string): BackupMetadata {
  if (receipt.actor_admin_id !== identity.id || receipt.room_code !== roomCode || receipt.request_hash !== requestHash)
    throw new AdminError('This backup operation belongs to another administrator or request.', 409);
  return metadata(receipt);
}
export function validBackupInput(value: unknown): value is BackupInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const input = value as Record<string, unknown>;
  return Object.keys(input).length === 4 && Object.keys(input).every(key => ['roomCode', 'operationId', 'expectedVersion', 'reason'].includes(key)) &&
    typeof input.roomCode === 'string' && roomCodePattern.test(input.roomCode) &&
    typeof input.operationId === 'string' && uuidPattern.test(input.operationId) &&
    typeof input.expectedVersion === 'number' && Number.isSafeInteger(input.expectedVersion) && input.expectedVersion >= 0 &&
    typeof input.reason === 'string' && input.reason.trim().length >= 1 && input.reason.length <= 300 && !/\p{Cc}/u.test(input.reason);
}

/** Metadata-only directory, gated by current database authorization in the read. */
export async function listAdminBackups(database: D1Database, identity: AdminIdentity, code: string, now = Date.now()): Promise<BackupMetadata[]> {
  if (!roomCodePattern.test(code)) throw new AdminError('Enter the eight-character room code.', 400);
  const results = await database.batch([
    database.prepare(authority).bind(...authArgs(identity, now)),
    database.prepare(`SELECT operation_id,room_code,room_version,created_at,size_bytes,digest FROM admin_room_backups WHERE room_code=? AND EXISTS (${authority}) ORDER BY created_at DESC,operation_id DESC LIMIT 100`).bind(code, ...authArgs(identity, now)),
  ]);
  owner(results[0]);
  return (results[1].results as RawMetadata[]).map(metadata);
}

/** An immutable room snapshot; staged read is compared byte-for-byte to a fresh
 * snapshot inside the atomic insert transaction, including unversioned room tables. */
export async function captureAdminBackup(database: D1Database, identity: AdminIdentity, input: BackupInput, now = Date.now()): Promise<{ backup: BackupMetadata; replayed: boolean }> {
  if (!validBackupInput(input)) throw new AdminError('Provide a room, current version, operation identifier and operational reason.', 400);
  const { roomCode, operationId, expectedVersion } = input;
  const reason = input.reason.trim();
  const requestHash = await digestOf(JSON.stringify({ roomCode, expectedVersion, reason }));
  const existing = await database.prepare(receiptQuery).bind(operationId, ...authArgs(identity, now)).first<Receipt>();
  // Read candidate only when no receipt exists. Authorization is in the SQL.
  const candidate = existing ? null : await database.prepare(snapshot).bind(roomCode, ...authArgs(identity, now)).first<{ version: number; payload: string | null }>();
  const oversized = candidate?.version === expectedVersion && (candidate.payload === null || new TextEncoder().encode(candidate.payload).byteLength > MAX_BACKUP_BYTES);
  if (oversized) {
    // A competing request may have committed the very same ID after the staged read.
    const checked = await database.batch([
      database.prepare(authority).bind(...authArgs(identity, now)),
      database.prepare(receiptQuery).bind(operationId, ...authArgs(identity, now)),
      database.prepare(`SELECT r.version,(${estimate}) estimated_bytes FROM rooms r WHERE r.code=? AND EXISTS (${authority})`).bind(roomCode, ...authArgs(identity, now)),
    ]);
    owner(checked[0]);
    const receipt = checked[1].results[0] as Receipt | undefined;
    if (receipt) return { backup: replay(receipt, identity, roomCode, requestHash), replayed: true };
    const state = checked[2].results[0] as { version: number; estimated_bytes: number } | undefined;
    if (!state) throw new AdminError('Room not found.', 404);
    if (state.version !== expectedVersion || state.estimated_bytes <= MAX_BACKUP_BYTES)
      throw new AdminError('Room or room-owned data changed. Refresh and retry with a new operation identifier.', 409);
    throw new AdminError('Room backup exceeds the 1,800,000-byte capture limit; nothing was saved.', 413);
  }
  const payload = candidate?.version === expectedVersion ? (candidate.payload ?? '') : '';
  const sizeBytes = new TextEncoder().encode(payload).byteLength;
  const digest = await digestOf(payload);
  const results = await database.batch([
    database.prepare(authority).bind(...authArgs(identity, now)),
    database.prepare(`INSERT INTO admin_room_backups (operation_id,actor_admin_id,room_code,request_hash,room_version,created_at,size_bytes,digest,payload,reason)
      SELECT ?,?,r.code,?,r.version,?,?,?,?,? FROM (${snapshot}) r
      WHERE r.version=? AND r.payload=? AND r.payload IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM admin_room_backups WHERE operation_id=?)
      AND NOT EXISTS (SELECT 1 FROM admin_room_backups WHERE room_code=r.code AND room_version=r.version AND payload=r.payload)
      AND (SELECT COUNT(*) FROM admin_room_backups WHERE room_code=r.code) < ?
      AND (SELECT COALESCE(SUM(size_bytes),0) FROM admin_room_backups WHERE room_code=r.code) + ? <= ?
      AND (SELECT COALESCE(SUM(size_bytes),0) FROM admin_room_backups) + ? <= ?`).bind(
      operationId, identity.id, requestHash, now, sizeBytes, digest, payload, reason,
      roomCode, ...authArgs(identity, now), expectedVersion, payload, operationId,
      MAX_ROOM_BACKUPS, sizeBytes, MAX_ROOM_BACKUP_BYTES, sizeBytes, MAX_TOTAL_BACKUP_BYTES,
    ),
    database.prepare(receiptQuery).bind(operationId, ...authArgs(identity, now)),
    database.prepare(`SELECT r.version,(${estimate}) estimated_bytes,
      (SELECT COUNT(*) FROM admin_room_backups WHERE room_code=r.code) room_count,
      (SELECT COALESCE(SUM(size_bytes),0) FROM admin_room_backups WHERE room_code=r.code) room_bytes,
      (SELECT COALESCE(SUM(size_bytes),0) FROM admin_room_backups) total_bytes,
      EXISTS (SELECT 1 FROM admin_room_backups WHERE room_code=r.code AND room_version=r.version AND payload=?) duplicate
      FROM rooms r WHERE r.code=? AND EXISTS (${authority})`).bind(payload, roomCode, ...authArgs(identity, now)),
  ]);
  owner(results[0]);
  const receipt = results[2].results[0] as Receipt | undefined;
  if (receipt) return { backup: replay(receipt, identity, roomCode, requestHash), replayed: results[1].meta.changes !== 1 };
  const state = results[3].results[0] as { version: number; estimated_bytes: number; room_count: number; room_bytes: number; total_bytes: number; duplicate: number } | undefined;
  if (!state) throw new AdminError('Room not found.', 404);
  if (state.version !== expectedVersion) throw new AdminError('Room changed. Refresh before creating another backup.', 409);
  if (state.estimated_bytes > MAX_BACKUP_BYTES) throw new AdminError('Room backup exceeds the 1,800,000-byte capture limit; nothing was saved.', 413);
  if (state.duplicate) throw new AdminError('This exact room version and snapshot was already backed up.', 409);
  if (state.room_count >= MAX_ROOM_BACKUPS || state.room_bytes + sizeBytes > MAX_ROOM_BACKUP_BYTES || state.total_bytes + sizeBytes > MAX_TOTAL_BACKUP_BYTES)
    throw new AdminError('Backup storage quota reached; no snapshot was saved.', 507);
  throw new AdminError('Room-owned data changed. Refresh and retry with a new operation identifier.', 409);
}

/** A private payload is returned only if its owner-only export audit commits. */
export async function downloadAdminBackup(database: D1Database, identity: AdminIdentity, id: string, now = Date.now()): Promise<{ backup: BackupMetadata; payload: string }> {
  if (!uuidPattern.test(id)) throw new AdminError('Invalid backup identifier.', 400);
  const downloadId = crypto.randomUUID();
  const results = await database.batch([
    database.prepare(authority).bind(...authArgs(identity, now)),
    database.prepare(`INSERT INTO admin_room_backup_downloads(download_id,operation_id,actor_admin_id,room_code,created_at)
      SELECT ?,b.operation_id,?,b.room_code,? FROM admin_room_backups b
      WHERE b.operation_id=? AND EXISTS (${authority})
      AND (SELECT COUNT(*) FROM admin_room_backup_downloads) < ?`).bind(downloadId, identity.id, now, id, ...authArgs(identity, now), MAX_BACKUP_DOWNLOADS),
    database.prepare(`SELECT operation_id,room_code,room_version,created_at,size_bytes,digest,payload FROM admin_room_backups
      WHERE operation_id=? AND EXISTS (SELECT 1 FROM admin_room_backup_downloads WHERE download_id=? AND actor_admin_id=?)
      AND EXISTS (${authority})`).bind(id, downloadId, identity.id, ...authArgs(identity, now)),
    database.prepare(`SELECT (SELECT COUNT(*) FROM admin_room_backup_downloads) count,
      EXISTS (SELECT 1 FROM admin_room_backups WHERE operation_id=?) present
      WHERE EXISTS (${authority})`).bind(id, ...authArgs(identity, now)),
  ]);
  owner(results[0]);
  if (results[1].meta.changes !== 1) {
    const status = results[3].results[0] as { count: number; present: number } | undefined;
    if (status?.present && status.count >= MAX_BACKUP_DOWNLOADS)
      throw new AdminError('Backup download audit capacity reached; no private bytes were exported.', 507);
    throw new AdminError('Backup not found.', 404);
  }
  const row = results[2].results[0] as RawBackup | undefined;
  if (!row) throw new AdminError('Backup download could not be recorded.', 503);
  return { backup: metadata(row), payload: row.payload };
}
