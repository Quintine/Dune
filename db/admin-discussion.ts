import { AdminError, type AdminIdentity } from './admin-access';
import { FACTIONS } from '../game/catalog';
import { DIFFICULTIES } from '../game/bot-profiles';
import { validAdminDiscussionInput, type AdminDiscussionInput, type AdminDiscussionView, type AdminDiscussionResult } from '../lib/admin-discussion';

const authority = `SELECT a.role FROM admin_sessions s JOIN admin_accounts a ON a.id=s.admin_id
  WHERE s.token_hash=? AND a.id=? AND a.enabled=1 AND s.revoked_at IS NULL
  AND s.expires_at>? AND s.generation=a.session_generation AND a.role IN ('owner','operator','viewer')`;
const mutationAuthority = authority + " AND a.role IN ('owner','operator')";
const roomSelect = `SELECT r.code,r.version,r.state,
  EXISTS (SELECT 1 FROM room_removals WHERE room_code=r.code AND removed=1) AS removed,
  EXISTS (SELECT 1 FROM room_closures WHERE room_code=r.code AND closed=1) AS closed,
  EXISTS (SELECT 1 FROM room_archives WHERE room_code=r.code AND archived=1) AS archived,
  (SELECT json_group_array(json_object('id',player_id,'muted',muted,'revision',revision)) FROM seat_discussion_controls WHERE room_code=r.code) AS controls
  FROM rooms r WHERE r.code=? AND EXISTS (${authority})`;
const receiptSelect = `SELECT operation_id,actor_admin_id,room_code,request_hash,expected_version,applied_revision
  FROM admin_discussion_operations WHERE operation_id=? AND EXISTS (${mutationAuthority})`;
type Row = { code: string; version: number; state: string; removed: number; closed: number; archived: number; controls: string };
type Receipt = { operation_id: string; actor_admin_id: string; room_code: string; request_hash: string; expected_version: number; applied_revision: number };
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const counter = (value: unknown) => Number.isSafeInteger(value) && Number(value) >= 0 && Number(value) < Number.MAX_SAFE_INTEGER;
function argsFor(identity: AdminIdentity, code: string, now: number) {
  if (!identity || typeof identity.id !== 'string' || typeof identity.sessionHash !== 'string' || !/^[0-9a-f]{64}$/.test(identity.sessionHash)) throw new AdminError('Administrator sign-in required.', 401);
  if (typeof code !== 'string' || code.length !== 8 || !/^[A-Z2-9]{8}$/.test(code)) throw new AdminError('Enter the eight-character room code.', 400);
  return [identity.sessionHash, identity.id, now];
}
function authorize(result: D1Result, mutation = false) {
  const role = (result.results[0] as { role: string } | undefined)?.role;
  if (!role) throw new AdminError('Administrator sign-in required.', 401);
  if (mutation && role === 'viewer') throw new AdminError('Your administrator role does not permit this action.', 403);
}
export function projectAdminDiscussion(row: Row): AdminDiscussionView {
  const base: AdminDiscussionView = { code: row.code, version: row.version, removed: row.removed === 1, closed: row.closed === 1, archived: row.archived === 1,
    status: 'unreadable', editable: false, blockedReason: 'This room needs inspection before changing participant discussion.', players: [] };
  try {
    const game: unknown = JSON.parse(row.state), controls: unknown = JSON.parse(row.controls);
    if (!object(game) || !['lobby','setup','playing','finished'].includes(String(game.status)) || !Array.isArray(game.players) || game.players.length < 1 || game.players.length > 6 ||
        !game.players.every(player => object(player) && typeof player.id === 'string' && !!player.id.trim() && player.id.length <= 80 && typeof player.name === 'string' && player.name.length <= 80 &&
          FACTIONS.some(faction => faction.id === player.faction) && [player.bot, player.autopilot].every(value => value === undefined || DIFFICULTIES.some(difficulty => difficulty === value))) ||
        new Set(game.players.map(player => player.id)).size !== game.players.length || !Array.isArray(controls) || !controls.every(control => object(control) && typeof control.id === 'string' && [0,1].includes(Number(control.muted)) && counter(control.revision))) return base;
    const players = game.players.map(player => {
      const control = controls.find(control => control.id === player.id);
      return { id: player.id as string, name: player.name as string, faction: player.faction as string,
        control: player.bot ? 'ai' as const : player.autopilot ? 'autopilot' as const : 'human' as const, muted: control?.muted === 1, revision: control?.revision ?? 0 };
    });
    return { ...base, status: game.status as AdminDiscussionView['status'], editable: !base.removed, blockedReason: base.removed ? 'Restore this removed room before changing participant discussion.' : null, players };
  } catch { return base; }
}
function replay(receipt: Receipt | undefined, row: Row | undefined, identity: AdminIdentity, code: string, hash: string, replayed: boolean): AdminDiscussionResult | null {
  if (!receipt) return null;
  if (receipt.actor_admin_id !== identity.id || receipt.room_code !== code || receipt.request_hash !== hash) throw new AdminError('This discussion operation belongs to a different administrator or request.', 409);
  const room = row ? projectAdminDiscussion(row) : { code, version: receipt.expected_version, removed: true, closed: false, archived: false, status: 'unreadable' as const,
    editable: false, blockedReason: 'The room is no longer available.', players: [] };
  return { operationId: receipt.operation_id, appliedRevision: receipt.applied_revision, replayed, room };
}
export async function readAdminDiscussion(database: D1Database, identity: AdminIdentity, code: string, now = Date.now()): Promise<AdminDiscussionView> {
  const args = argsFor(identity, code, now);
  const result = await database.batch([database.prepare(authority).bind(...args), database.prepare(roomSelect).bind(code, ...args)]);
  authorize(result[0]); const row = result[1].results[0] as Row | undefined;
  if (!row) throw new AdminError('Room not found.', 404);
  return projectAdminDiscussion(row);
}
export async function applyAdminDiscussion(database: D1Database, identity: AdminIdentity, code: string, input: AdminDiscussionInput, now = Date.now()): Promise<AdminDiscussionResult> {
  const args = argsFor(identity, code, now);
  if (!validAdminDiscussionInput(input)) throw new AdminError('Choose a human participant, discussion setting, current versions and a short operational reason.', 400);
  const { operationId, expectedVersion, expectedRevision, target, muted } = input, reason = input.reason.trim();
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify({ expectedVersion, expectedRevision, target, muted, reason })));
  const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  const before = await database.batch([database.prepare(authority).bind(...args), database.prepare(receiptSelect).bind(operationId, ...args), database.prepare(roomSelect).bind(code, ...args)]);
  authorize(before[0], true);
  const row = before[2].results[0] as Row | undefined, previous = replay(before[1].results[0] as Receipt | undefined, row, identity, code, hash, true);
  if (previous) return previous;
  if (!row) throw new AdminError('Room not found.', 404);
  const view = projectAdminDiscussion(row), player = view.players.find(player => player.id === target && player.control !== 'ai');
  if (!view.editable) throw new AdminError(view.blockedReason ?? 'Refresh participant availability.', 409);
  if (view.version !== expectedVersion || !player || player.revision !== expectedRevision || player.muted === muted) throw new AdminError('The room or participant discussion setting changed. Refresh before choosing a new operation.', 409);
  const result = await database.batch([
    database.prepare(authority).bind(...args),
    database.prepare(`INSERT INTO seat_discussion_controls(room_code,player_id,muted,revision,updated_at)
      SELECT r.code,?,?,?,? FROM rooms r WHERE r.code=? AND r.version=? AND EXISTS (${mutationAuthority})
      AND NOT EXISTS (SELECT 1 FROM room_removals WHERE room_code=r.code AND removed=1)
      AND EXISTS (SELECT 1 FROM json_each(r.state,'$.players') p WHERE json_extract(p.value,'$.id')=? AND json_extract(p.value,'$.bot') IS NULL)
      AND COALESCE((SELECT revision FROM seat_discussion_controls WHERE room_code=r.code AND player_id=?),0)=?
      AND COALESCE((SELECT muted FROM seat_discussion_controls WHERE room_code=r.code AND player_id=?),0)<>?
      AND NOT EXISTS (SELECT 1 FROM admin_discussion_operations WHERE operation_id=?)
      ON CONFLICT(room_code,player_id) DO UPDATE SET muted=excluded.muted,revision=excluded.revision,updated_at=excluded.updated_at
      WHERE seat_discussion_controls.revision=?`)
      .bind(target, Number(muted), expectedRevision + 1, now, code, expectedVersion, ...args, target, target, expectedRevision, target, Number(muted), operationId, expectedRevision),
    database.prepare(`INSERT INTO admin_discussion_operations(operation_id,actor_admin_id,room_code,request_hash,expected_version,expected_revision,applied_revision,target,muted,reason,created_at)
      SELECT ?,?,?,?,?,?,?,?,?,?,? WHERE changes()=1`).bind(operationId, identity.id, code, hash, expectedVersion, expectedRevision, expectedRevision + 1, target, Number(muted), reason, now),
    database.prepare(receiptSelect).bind(operationId, ...args), database.prepare(roomSelect).bind(code, ...args),
  ]);
  authorize(result[0], true);
  const committed = replay(result[3].results[0] as Receipt | undefined, result[4].results[0] as Row | undefined, identity, code, hash, result[1].meta.changes !== 1);
  if (committed) return committed;
  throw new AdminError('The room, participant setting or administrator access changed. Refresh before choosing a new operation.', 409);
}
