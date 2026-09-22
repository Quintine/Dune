import { AdminError, type AdminIdentity } from './admin-access';
import {
  validAdminRoomControlInput,
  type AdminRoomControlInput,
  type RoomControl,
} from '../lib/room-control';

const authority = `SELECT a.role FROM admin_sessions s JOIN admin_accounts a ON a.id = s.admin_id
  WHERE s.token_hash = ? AND a.id = ? AND a.enabled = 1 AND s.revoked_at IS NULL
  AND s.expires_at > ? AND s.generation = a.session_generation
  AND a.role IN ('owner','operator','viewer')`;
const mutationAuthority = authority + " AND a.role IN ('owner','operator')";
const fields = `COALESCE(c.paused, 0) AS paused, COALESCE(c.join_locked, 0) AS join_locked,
  COALESCE(c.revision, 0) AS revision, c.updated_at`;
type ControlRow = {
  paused: number;
  join_locked: number;
  revision: number;
  updated_at: number | null;
};
const project = (row: ControlRow): RoomControl => ({
  paused: row.paused === 1,
  joinLocked: row.join_locked === 1,
  revision: row.revision,
  updatedAt: row.updated_at,
});
function credentials(identity: AdminIdentity, now: number) {
  if (
    !identity ||
    typeof identity.id !== 'string' ||
    typeof identity.sessionHash !== 'string' ||
    !/^[0-9a-f]{64}$/.test(identity.sessionHash)
  )
    throw new AdminError('Administrator sign-in required.', 401);
  return [identity.sessionHash, identity.id, now];
}
function checkCode(code: string) {
  if (
    typeof code !== 'string' ||
    code.length !== 8 ||
    !/^[A-Z0-9]{8}$/.test(code)
  )
    throw new AdminError('Use an eight-character room code.', 400);
}

/** Read live room operations in the same transaction as administrator authority. */
export async function readAdminRoomControl(
  database: D1Database,
  identity: AdminIdentity,
  code: string,
  now = Date.now(),
): Promise<RoomControl> {
  const args = credentials(identity, now);
  checkCode(code);
  const results = await database.batch([
    database.prepare(authority).bind(...args),
    database
      .prepare(`SELECT ${fields} FROM rooms r LEFT JOIN room_controls c ON c.room_code = r.code
      WHERE r.code = ? AND EXISTS (${authority})`)
      .bind(code, ...args),
  ]);
  if (!results[0].results.length)
    throw new AdminError('Administrator sign-in required.', 401);
  const row = results[1].results[0] as ControlRow | undefined;
  if (!row) throw new AdminError('Room not found.', 404);
  return project(row);
}

/** Receipt, audit, game-version fence and room flags commit or roll back together. */
export async function applyAdminRoomControl(
  database: D1Database,
  identity: AdminIdentity,
  code: string,
  input: AdminRoomControlInput,
  now = Date.now(),
): Promise<RoomControl & { replayed: boolean }> {
  const args = credentials(identity, now);
  checkCode(code);
  if (!validAdminRoomControlInput(input))
    throw new AdminError(
      'Provide room settings, a revision, a fresh operation identifier and a reason of 1–300 characters.',
      400,
    );
  const reason = input.reason.trim();
  const paused = Number(input.paused),
    joinLocked = Number(input.joinLocked);
  const results = await database.batch([
    database.prepare(authority).bind(...args),
    database
      .prepare(`INSERT INTO admin_room_audit
      (operation_id,actor_admin_id,room_code,reason,expected_revision,before_paused,before_join_locked,after_paused,after_join_locked,created_at)
      SELECT ?,?,r.code,?,?,COALESCE(c.paused,0),COALESCE(c.join_locked,0),?,?,?
      FROM rooms r LEFT JOIN room_controls c ON c.room_code = r.code
      WHERE r.code = ? AND COALESCE(c.revision,0) = ? AND EXISTS (${mutationAuthority})
      AND NOT EXISTS (SELECT 1 FROM admin_room_audit WHERE operation_id = ?)`)
      .bind(
        input.operationId,
        identity.id,
        reason,
        input.expectedRevision,
        paused,
        joinLocked,
        now,
        code,
        input.expectedRevision,
        ...args,
        input.operationId,
      ),
    // Pausing and join locks leave saved game JSON untouched. Resume only refreshes
    // pacing for existing AI-controlled seats; it executes no game action.
    database
      .prepare(`UPDATE rooms SET version = version + 1,
      state = CASE WHEN ? = 0 AND EXISTS (
        SELECT 1 FROM admin_room_audit WHERE operation_id = ? AND before_paused = 1
      ) THEN CASE WHEN json_valid(state) THEN CASE WHEN
        json_extract(state, '$.status') IN ('setup','playing') AND
        EXISTS (SELECT 1 FROM json_each(CASE WHEN json_type(state, '$.players') = 'array' THEN json_extract(state, '$.players') ELSE '[]' END) p
          WHERE json_extract(CASE WHEN p.type = 'object' THEN p.value ELSE '{}' END, '$.bot') IS NOT NULL OR json_extract(CASE WHEN p.type = 'object' THEN p.value ELSE '{}' END, '$.autopilot') IS NOT NULL)
        THEN json_set(state, '$.botsPending', json('true'), '$.botNextActionAt', ?)
        ELSE state END ELSE state END ELSE state END
      WHERE code = ? AND changes() = 1`)
      .bind(paused, input.operationId, now + 1500, code),
    database
      .prepare(`INSERT INTO room_controls(room_code,paused,join_locked,revision,updated_at)
      SELECT room_code,after_paused,after_join_locked,expected_revision + 1,created_at
      FROM admin_room_audit WHERE operation_id = ? AND changes() = 1
      ON CONFLICT(room_code) DO UPDATE SET paused = excluded.paused, join_locked = excluded.join_locked,
      revision = excluded.revision, updated_at = excluded.updated_at`)
      .bind(input.operationId),
    database
      .prepare(`SELECT ${fields}, a.room_code, a.expected_revision, a.after_paused, a.after_join_locked, a.reason
      FROM admin_room_audit a JOIN rooms r ON r.code = a.room_code
      LEFT JOIN room_controls c ON c.room_code = r.code
      WHERE a.operation_id = ? AND a.actor_admin_id = ? AND EXISTS (${mutationAuthority})`)
      .bind(input.operationId, identity.id, ...args),
    database
      .prepare(
        `SELECT 1 FROM rooms WHERE code = ? AND EXISTS (${mutationAuthority})`,
      )
      .bind(code, ...args),
  ]);
  const role = (results[0].results[0] as { role: string } | undefined)?.role;
  if (!role) throw new AdminError('Administrator sign-in required.', 401);
  if (role === 'viewer')
    throw new AdminError(
      'Your administrator role does not permit this action.',
      403,
    );
  const row = results[4].results[0] as
    | (ControlRow & {
        room_code: string;
        expected_revision: number;
        after_paused: number;
        after_join_locked: number;
        reason: string;
      })
    | undefined;
  if (row) {
    if (
      row.room_code !== code ||
      row.expected_revision !== input.expectedRevision ||
      row.after_paused !== paused ||
      row.after_join_locked !== joinLocked ||
      row.reason !== reason
    )
      throw new AdminError(
        'This operation identifier is bound to different room settings.',
        409,
      );
    return { ...project(row), replayed: results[1].meta.changes !== 1 };
  }
  if (!results[5].results.length) throw new AdminError('Room not found.', 404);
  throw new AdminError(
    'Room settings changed or the operation identifier was already used. Refresh before a new request.',
    409,
  );
}
