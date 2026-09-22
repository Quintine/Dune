import { AdminError, type AdminIdentity } from './admin-access';
import {
  applyAdminLobbyAction,
  projectAdminLobby,
  AdminLobbyRuleError,
} from '../game/admin-lobby-configuration';
import {
  validAdminLobbyInput,
  type AdminLobbyInput,
  type AdminLobbyResult,
  type AdminLobbyView,
} from '../lib/admin-lobby-configuration';
import type { Game } from '../game/engine';

const authority = `SELECT a.role FROM admin_sessions s JOIN admin_accounts a ON a.id = s.admin_id
  WHERE s.token_hash = ? AND a.id = ? AND a.enabled = 1 AND s.revoked_at IS NULL
  AND s.expires_at > ? AND s.generation = a.session_generation
  AND a.role IN ('owner','operator','viewer')`;
const mutationAuthority = authority + " AND a.role IN ('owner','operator')";
const roomSelect = `SELECT r.code,r.state,r.version,COALESCE(c.paused,0) AS paused,
  COALESCE(c.join_locked,0) AS join_locked,COALESCE(c.revision,0) AS control_revision,c.updated_at AS control_updated_at,
  (SELECT json_group_array(DISTINCT s.player_id) FROM seats s WHERE s.room_code = r.code AND s.revoked = 0) AS active_humans
  FROM rooms r LEFT JOIN room_controls c ON c.room_code = r.code WHERE r.code = ? AND EXISTS (${authority})`;
const receiptSelect = `SELECT operation_id,actor_admin_id,room_code,request_hash,applied_version
  FROM admin_lobby_operations WHERE operation_id = ? AND EXISTS (${mutationAuthority})`;
type Row = {
  code: string;
  state: string;
  version: number;
  paused: number;
  join_locked: number;
  control_revision: number;
  control_updated_at: number | null;
  active_humans: string;
};
type Receipt = {
  operation_id: string;
  actor_admin_id: string;
  room_code: string;
  request_hash: string;
  applied_version: number;
};
function credentials(identity: AdminIdentity, code: string, now: number) {
  if (
    !identity ||
    typeof identity.id !== 'string' ||
    typeof identity.sessionHash !== 'string' ||
    identity.sessionHash.length !== 64 ||
    !/^[0-9a-f]{64}$/.test(identity.sessionHash)
  )
    throw new AdminError('Administrator sign-in required.', 401);
  if (
    typeof code !== 'string' ||
    code.length !== 8 ||
    !/^[A-Z0-9]{8}$/.test(code)
  )
    throw new AdminError('Use an eight-character room code.', 400);
  return [identity.sessionHash, identity.id, now];
}
function authorize(result: D1Result, mutation = false) {
  const role = (result.results[0] as { role: string } | undefined)?.role;
  if (!role) throw new AdminError('Administrator sign-in required.', 401);
  if (mutation && role === 'viewer')
    throw new AdminError(
      'Your administrator role does not permit this action.',
      403,
    );
}
function decode(row: Row) {
  let game: unknown = null;
  try {
    game = JSON.parse(row.state);
  } catch {
    /* Unreadable saves get an allowlisted, non-editable projection. */
  }
  const activeHumans = new Set<string>(JSON.parse(row.active_humans));
  const control = {
    paused: row.paused === 1,
    joinLocked: row.join_locked === 1,
    revision: row.control_revision,
    updatedAt: row.control_updated_at,
  };
  return {
    game: game as Game,
    activeHumans,
    view: projectAdminLobby(row.code, row.version, game, activeHumans, control),
  };
}
function missing(code: string, version: number): AdminLobbyView {
  return {
    code,
    version,
    status: 'unreadable',
    editable: false,
    blockedReason: 'The room is no longer available.',
    host: null,
    advanced: false,
    techTokens: false,
    strongholdCards: false,
    players: [],
    control: { paused: false, joinLocked: false, revision: 0, updatedAt: null },
  };
}
function replay(
  receipt: Receipt | undefined,
  row: Row | undefined,
  identity: AdminIdentity,
  code: string,
  requestHash: string,
  replayed: boolean,
): AdminLobbyResult | null {
  if (!receipt) return null;
  if (
    receipt.actor_admin_id !== identity.id ||
    receipt.room_code !== code ||
    receipt.request_hash !== requestHash
  )
    throw new AdminError(
      'This lobby operation is bound to a different administrator or request.',
      409,
    );
  return {
    operationId: receipt.operation_id,
    appliedVersion: receipt.applied_version,
    replayed,
    lobby: row ? decode(row).view : missing(code, receipt.applied_version),
  };
}
const auditConfiguration = (view: AdminLobbyView) =>
  JSON.stringify({
    host: view.host,
    advanced: view.advanced,
    techTokens: view.techTokens,
    strongholdCards: view.strongholdCards,
    players: view.players.map(
      ({ id, name, faction, bot, position, ready }) => ({
        id,
        name,
        faction,
        bot,
        position,
        ready,
      }),
    ),
  });

export async function readAdminLobby(
  database: D1Database,
  identity: AdminIdentity,
  code: string,
  now = Date.now(),
): Promise<AdminLobbyView> {
  const args = credentials(identity, code, now);
  const results = await database.batch([
    database.prepare(authority).bind(...args),
    database.prepare(roomSelect).bind(code, ...args),
  ]);
  authorize(results[0]);
  const row = results[1].results[0] as Row | undefined;
  if (!row) throw new AdminError('Room not found.', 404);
  return decode(row).view;
}

export async function configureAdminLobby(
  database: D1Database,
  identity: AdminIdentity,
  code: string,
  input: AdminLobbyInput,
  now = Date.now(),
): Promise<AdminLobbyResult> {
  const args = credentials(identity, code, now);
  if (!validAdminLobbyInput(input))
    throw new AdminError(
      'Choose one supported lobby change, its current version, a fresh operation identifier and an operational reason.',
      400,
    );
  const operationId = input.operationId,
    expectedVersion = input.expectedVersion,
    reason = input.reason.trim();
  // Canonicalize keys so equivalent JSON requests bind the same exact intent.
  const action = Object.fromEntries(
    Object.entries(input.action).sort(([a], [b]) => a.localeCompare(b)),
  ) as AdminLobbyInput['action'];
  const actionText = JSON.stringify(action);
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(
      JSON.stringify({ expectedVersion, action, reason }),
    ),
  );
  const requestHash = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
  const before = await database.batch([
    database.prepare(authority).bind(...args),
    database.prepare(receiptSelect).bind(operationId, ...args),
    database.prepare(roomSelect).bind(code, ...args),
  ]);
  authorize(before[0], true);
  const row = before[2].results[0] as Row | undefined;
  const previous = replay(
    before[1].results[0] as Receipt | undefined,
    row,
    identity,
    code,
    requestHash,
    true,
  );
  if (previous) return previous;
  if (!row) throw new AdminError('Room not found.', 404);
  const snapshot = decode(row);
  if (!snapshot.view.editable)
    throw new AdminError(
      snapshot.view.blockedReason ?? 'This lobby cannot be configured.',
      409,
    );
  if (row.version !== expectedVersion)
    throw new AdminError(
      'The room changed. Refresh before choosing a new lobby operation.',
      409,
    );
  snapshot.game.version = row.version;
  let next: Game;
  try {
    next = applyAdminLobbyAction(snapshot.game, action, snapshot.activeHumans);
  } catch (error) {
    throw new AdminError(
      error instanceof AdminLobbyRuleError
        ? error.message
        : 'This saved lobby cannot be configured.',
      409,
    );
  }
  next.version = row.version + 1;
  const afterView = projectAdminLobby(
    code,
    next.version,
    next,
    snapshot.activeHumans,
    snapshot.view.control,
  );
  const hostTarget = action.type === 'assignHost' ? action.target : '';
  const results = await database.batch([
    database.prepare(authority).bind(...args),
    database
      .prepare(`UPDATE rooms SET state = ?, version = version + 1, updated_at = ? WHERE code = ? AND version = ?
      AND json_extract(state, '$.status') = 'lobby' AND EXISTS (${mutationAuthority})
      AND NOT EXISTS (SELECT 1 FROM room_controls WHERE room_code = rooms.code AND paused = 1)
      AND NOT EXISTS (SELECT 1 FROM admin_lobby_operations WHERE operation_id = ?)
      AND (? = '' OR EXISTS (SELECT 1 FROM seats WHERE room_code = rooms.code AND player_id = ? AND revoked = 0))`)
      .bind(
        JSON.stringify(next),
        now,
        code,
        expectedVersion,
        ...args,
        operationId,
        hostTarget,
        hostTarget,
      ),
    database
      .prepare(`INSERT INTO admin_lobby_operations(operation_id,actor_admin_id,room_code,request_hash,expected_version,applied_version,action,reason,before_configuration,after_configuration,created_at)
      SELECT ?,?,?,?,?,?,?,?,?,?,? WHERE changes() = 1`)
      .bind(
        operationId,
        identity.id,
        code,
        requestHash,
        expectedVersion,
        next.version,
        actionText,
        reason,
        auditConfiguration(snapshot.view),
        auditConfiguration(afterView),
        now,
      ),
    database.prepare(receiptSelect).bind(operationId, ...args),
    database.prepare(roomSelect).bind(code, ...args),
  ]);
  authorize(results[0], true);
  const committed = replay(
    results[3].results[0] as Receipt | undefined,
    results[4].results[0] as Row | undefined,
    identity,
    code,
    requestHash,
    results[1].meta.changes !== 1,
  );
  if (committed) return committed;
  throw new AdminError(
    'The room, pause setting, host recipient or administrator access changed. Refresh before choosing a new lobby operation.',
    409,
  );
}
