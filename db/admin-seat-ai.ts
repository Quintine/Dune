import { AdminError, type AdminIdentity } from './admin-access';
import { validAdminSeatAiInput, type AdminSeatAiInput, type AdminSeatAiView, type AdminSeatAiResult } from '../lib/admin-seat-ai';
import { enableAdminSeatAi, projectAdminSeatAi, seatAiUnavailable } from '../game/admin-seat-ai';
import type { Game } from '../game/engine';

const authority = `SELECT a.role FROM admin_sessions s JOIN admin_accounts a ON a.id = s.admin_id
  WHERE s.token_hash = ? AND a.id = ? AND a.enabled = 1 AND s.revoked_at IS NULL
  AND s.expires_at > ? AND s.generation = a.session_generation AND a.role IN ('owner','operator','viewer')`;
const mutationAuthority = authority + " AND a.role IN ('owner','operator')";
const roomSelect = `SELECT r.code,r.state,r.version,COALESCE(c.paused,0) AS paused,COALESCE(c.revision,0) AS control_revision,
  EXISTS (SELECT 1 FROM room_closures WHERE room_code = r.code AND closed = 1) AS closed,
  EXISTS (SELECT 1 FROM room_removals WHERE room_code = r.code AND removed = 1) AS removed,
  EXISTS (SELECT 1 FROM room_archives WHERE room_code = r.code AND archived = 1) AS archived,
  (SELECT json_group_array(DISTINCT s.player_id) FROM seats s WHERE s.room_code = r.code AND s.revoked = 0) AS active_humans
  FROM rooms r LEFT JOIN room_controls c ON c.room_code = r.code WHERE r.code = ? AND EXISTS (${authority})`;
const receiptSelect = `SELECT operation_id,actor_admin_id,room_code,request_hash,applied_version
  FROM admin_seat_ai_operations WHERE operation_id = ? AND EXISTS (${mutationAuthority})`;
type Row = { code: string; state: string; version: number; paused: number; control_revision: number; closed: number; removed: number; archived: number; active_humans: string };
type Receipt = { operation_id: string; actor_admin_id: string; room_code: string; request_hash: string; applied_version: number };
function credentials(identity: AdminIdentity, code: string, now: number) {
  if (!identity || typeof identity.id !== 'string' || typeof identity.sessionHash !== 'string' || identity.sessionHash.length !== 64 || !/^[0-9a-f]{64}$/.test(identity.sessionHash)) throw new AdminError('Administrator sign-in required.', 401);
  if (typeof code !== 'string' || code.length !== 8 || !/^[A-Z0-9]{8}$/.test(code)) throw new AdminError('Use an eight-character room code.', 400);
  return [identity.sessionHash, identity.id, now];
}
function authorize(result: D1Result, mutation = false) {
  const role = (result.results[0] as { role: string } | undefined)?.role;
  if (!role) throw new AdminError('Administrator sign-in required.', 401);
  if (mutation && role === 'viewer') throw new AdminError('Your administrator role does not permit this action.', 403);
}
function decode(row: Row) {
  let game: unknown = null;
  try { game = JSON.parse(row.state); } catch { /* Keep malformed state private. */ }
  // Historical administrative actions can increment the row fence without rewriting JSON.
  if (game && typeof game === 'object' && !Array.isArray(game)) (game as Game).version = row.version;
  const view = projectAdminSeatAi({ code: row.code, version: row.version, controlRevision: row.control_revision,
    paused: row.paused === 1, closed: row.closed === 1, removed: row.removed === 1, archived: row.archived === 1 }, game, new Set(JSON.parse(row.active_humans)));
  return { game: game as Game, view };
}
function replay(receipt: Receipt | undefined, row: Row | undefined, identity: AdminIdentity, code: string, requestHash: string, replayed: boolean): AdminSeatAiResult | null {
  if (!receipt) return null;
  if (receipt.actor_admin_id !== identity.id || receipt.room_code !== code || receipt.request_hash !== requestHash) throw new AdminError('This participant operation is bound to a different administrator or request.', 409);
  const room: AdminSeatAiView = row ? decode(row).view : { code, version: receipt.applied_version, controlRevision: 0, status: 'unreadable',
    paused: false, closed: false, removed: false, archived: false, editable: false, blockedReason: 'The room is no longer available.', players: [] };
  return { operationId: receipt.operation_id, appliedVersion: receipt.applied_version, replayed, room };
}
export async function readAdminSeatAi(database: D1Database, identity: AdminIdentity, code: string, now = Date.now()): Promise<AdminSeatAiView> {
  const args = credentials(identity, code, now);
  const result = await database.batch([database.prepare(authority).bind(...args), database.prepare(roomSelect).bind(code, ...args)]);
  authorize(result[0]); const row = result[1].results[0] as Row | undefined;
  if (!row) throw new AdminError('Room not found.', 404);
  return decode(row).view;
}
export async function applyAdminSeatAi(database: D1Database, identity: AdminIdentity, code: string, input: AdminSeatAiInput, now = Date.now()): Promise<AdminSeatAiResult> {
  const args = credentials(identity, code, now);
  if (!validAdminSeatAiInput(input)) throw new AdminError('Choose a human participant, difficulty, current room and pause versions, a fresh operation identifier and an operational reason.', 400);
  const { operationId, expectedVersion, expectedControlRevision, target, difficulty } = input, reason = input.reason.trim();
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify({ expectedVersion, expectedControlRevision, target, difficulty, reason })));
  const requestHash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  const before = await database.batch([database.prepare(authority).bind(...args), database.prepare(receiptSelect).bind(operationId, ...args), database.prepare(roomSelect).bind(code, ...args)]);
  authorize(before[0], true);
  const row = before[2].results[0] as Row | undefined, previous = replay(before[1].results[0] as Receipt | undefined, row, identity, code, requestHash, true);
  if (previous) return previous;
  if (!row) throw new AdminError('Room not found.', 404);
  const snapshot = decode(row);
  if (!snapshot.view.editable) throw new AdminError(snapshot.view.blockedReason ?? seatAiUnavailable, 409);
  if (row.version !== expectedVersion || row.control_revision !== expectedControlRevision) throw new AdminError('The room or pause settings changed. Refresh before choosing a new operation.', 409);
  if (!snapshot.view.players.some(player => player.id === target && player.eligible)) throw new AdminError('Choose a human participant with current seat access and no active AI controller.', 409);
  let next: Game;
  try { next = enableAdminSeatAi(snapshot.game, target, difficulty); } catch { throw new AdminError(seatAiUnavailable, 409); }
  next.version = row.version + 1;
  const result = await database.batch([
    database.prepare(authority).bind(...args),
    database.prepare(`UPDATE rooms SET state = ?,version = version + 1,updated_at = ? WHERE code = ? AND version = ?
      AND EXISTS (${mutationAuthority})
      AND EXISTS (SELECT 1 FROM room_controls WHERE room_code = rooms.code AND paused = 1 AND revision = ?)
      AND NOT EXISTS (SELECT 1 FROM room_removals WHERE room_code = rooms.code AND removed = 1)
      AND NOT EXISTS (SELECT 1 FROM room_closures WHERE room_code = rooms.code AND closed = 1)
      AND NOT EXISTS (SELECT 1 FROM room_archives WHERE room_code = rooms.code AND archived = 1)
      AND EXISTS (SELECT 1 FROM seats WHERE room_code = rooms.code AND player_id = ? AND revoked = 0)
      AND NOT EXISTS (SELECT 1 FROM admin_seat_ai_operations WHERE operation_id = ?)`)
      .bind(JSON.stringify(next), now, code, expectedVersion, ...args, expectedControlRevision, target, operationId),
    database.prepare(`INSERT INTO admin_seat_ai_operations(operation_id,actor_admin_id,room_code,request_hash,expected_version,expected_control_revision,applied_version,target,difficulty,reason,created_at)
      SELECT ?,?,?,?,?,?,?,?,?,?,? WHERE changes() = 1`).bind(operationId, identity.id, code, requestHash, expectedVersion, expectedControlRevision, next.version, target, difficulty, reason, now),
    // Zero grants is valid; write the audit before this variable-size revocation.
    database.prepare(`UPDATE seat_ai_delegations SET revoked_at = ? WHERE room_code = ? AND owner_id = ? AND used_at IS NULL AND revoked_at IS NULL AND changes() = 1`).bind(now, code, target),
    database.prepare(receiptSelect).bind(operationId, ...args), database.prepare(roomSelect).bind(code, ...args),
  ]);
  authorize(result[0], true);
  const committed = replay(result[4].results[0] as Receipt | undefined, result[5].results[0] as Row | undefined, identity, code, requestHash, result[1].meta.changes !== 1);
  if (committed) return committed;
  throw new AdminError('The room, participant access, pause setting or administrator access changed. Refresh before choosing a new operation.', 409);
}
