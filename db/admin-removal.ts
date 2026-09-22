import { AdminError, type AdminIdentity } from './admin-access';
import {
  validAdminRemovalInput,
  type AdminRemovalInput,
  type AdminRemovalResult,
  type AdminRemovalView,
} from '../lib/admin-removal';

const authority = `SELECT a.role FROM admin_sessions s JOIN admin_accounts a ON a.id = s.admin_id
  WHERE s.token_hash = ? AND a.id = ? AND a.enabled = 1 AND s.revoked_at IS NULL
  AND s.expires_at > ? AND s.generation = a.session_generation
  AND a.role IN ('owner','operator','viewer')`;
const mutationAuthority = authority + " AND a.role IN ('owner','operator')";
const roomSelect = `SELECT r.code,r.version,COALESCE(m.removed,0) AS removed,
  COALESCE(m.revision,0) AS revision,m.removed_at,m.updated_at,
  COALESCE(c.paused,0) AS paused,COALESCE(c.join_locked,0) AS join_locked
  FROM rooms r LEFT JOIN room_removals m ON m.room_code = r.code
  LEFT JOIN room_controls c ON c.room_code = r.code
  WHERE r.code = ? AND EXISTS (${authority})`;
type Row = {
  code: string;
  version: number;
  removed: number;
  revision: number;
  removed_at: number | null;
  updated_at: number | null;
  paused: number;
  join_locked: number;
};
type Receipt = {
  operation_id: string;
  actor_admin_id: string;
  room_code: string;
  request_hash: string;
  applied_version: number;
  applied_revision: number;
};
const project = (row: Row): AdminRemovalView => ({
  code: row.code,
  version: row.version,
  removed: row.removed === 1,
  revision: row.revision,
  removedAt: row.removed_at,
  updatedAt: row.updated_at,
  paused: row.paused === 1,
  joinLocked: row.join_locked === 1,
});
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

/** Public operational metadata remains available for removed and unreadable saves. */
export async function readAdminRemoval(
  database: D1Database,
  identity: AdminIdentity,
  code: string,
  now = Date.now(),
): Promise<AdminRemovalView> {
  const args = credentials(identity, code, now);
  const results = await database.batch([
    database.prepare(authority).bind(...args),
    database.prepare(roomSelect).bind(code, ...args),
  ]);
  authorize(results[0]);
  const row = results[1].results[0] as Row | undefined;
  if (!row) throw new AdminError('Room not found.', 404);
  return project(row);
}

/** An exact receipt, room-version fence and removal transition commit together.
 * Neither transition replaces state or credentials; restore only refreshes AI pacing. */
export async function applyAdminRemoval(
  database: D1Database,
  identity: AdminIdentity,
  code: string,
  input: AdminRemovalInput,
  now = Date.now(),
): Promise<AdminRemovalResult> {
  const args = credentials(identity, code, now);
  if (!validAdminRemovalInput(input))
    throw new AdminError(
      'Provide the room version, removal revision, requested state, a fresh operation identifier and a reason of 1–300 characters.',
      400,
    );
  const { operationId, expectedVersion, expectedRevision, removed } = input;
  const actorId = identity.id,
    reason = input.reason.trim();
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(
      JSON.stringify({ expectedVersion, expectedRevision, removed, reason }),
    ),
  );
  const requestHash = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
  const results = await database.batch([
    database.prepare(authority).bind(...args),
    // Existing receipt IDs cannot enter this write, regardless of later room state.
    database
      .prepare(`INSERT INTO admin_room_removals
      (operation_id,actor_admin_id,room_code,request_hash,expected_version,expected_revision,
       applied_version,applied_revision,removed,reason,before_metadata,after_metadata,created_at)
      SELECT ?,?,r.code,?,?,?,r.version + 1,COALESCE(m.revision,0) + 1,?,?,
        json_object('code',r.code,'version',r.version,'removed',json(CASE WHEN m.removed = 1 THEN 'true' ELSE 'false' END),
          'revision',COALESCE(m.revision,0),'removedAt',m.removed_at,'updatedAt',m.updated_at,
          'paused',json(CASE WHEN c.paused = 1 THEN 'true' ELSE 'false' END),
          'joinLocked',json(CASE WHEN c.join_locked = 1 THEN 'true' ELSE 'false' END)),
        json_object('code',r.code,'version',r.version + 1,'removed',json(CASE WHEN ? = 1 THEN 'true' ELSE 'false' END),
          'revision',COALESCE(m.revision,0) + 1,'removedAt',?,'updatedAt',?,
          'paused',json(CASE WHEN c.paused = 1 THEN 'true' ELSE 'false' END),
          'joinLocked',json(CASE WHEN c.join_locked = 1 THEN 'true' ELSE 'false' END)),?
      FROM rooms r LEFT JOIN room_removals m ON m.room_code = r.code
      LEFT JOIN room_controls c ON c.room_code = r.code
      WHERE r.code = ? AND r.version = ? AND COALESCE(m.revision,0) = ? AND COALESCE(m.removed,0) != ?
      AND EXISTS (${mutationAuthority})
      AND NOT EXISTS (SELECT 1 FROM admin_room_removals WHERE operation_id = ?)`)
      .bind(
        operationId,
        actorId,
        requestHash,
        expectedVersion,
        expectedRevision,
        Number(removed),
        reason,
        Number(removed),
        removed ? now : null,
        now,
        now,
        code,
        expectedVersion,
        expectedRevision,
        Number(removed),
        ...args,
        operationId,
      ),
    // Removing never parses or changes JSON. Restore tolerates malformed saved state.
    database
      .prepare(`UPDATE rooms SET version = version + 1,
      state = CASE WHEN ? = 0 AND NOT EXISTS (
        SELECT 1 FROM room_controls WHERE room_code = rooms.code AND paused = 1
      ) THEN CASE WHEN json_valid(state) THEN CASE WHEN
        json_extract(state, '$.status') IN ('setup','playing') AND
        EXISTS (SELECT 1 FROM json_each(CASE WHEN json_type(state, '$.players') = 'array' THEN json_extract(state, '$.players') ELSE '[]' END) p
          WHERE json_extract(CASE WHEN p.type = 'object' THEN p.value ELSE '{}' END, '$.bot') IS NOT NULL
          OR json_extract(CASE WHEN p.type = 'object' THEN p.value ELSE '{}' END, '$.autopilot') IS NOT NULL)
        THEN json_set(state, '$.botsPending', json('true'), '$.botNextActionAt', ?)
        ELSE state END ELSE state END ELSE state END
      WHERE code = ? AND changes() = 1`)
      .bind(Number(removed), now + 1500, code),
    database
      .prepare(`INSERT INTO room_removals(room_code,removed,revision,removed_at,updated_at)
      SELECT room_code,removed,applied_revision,CASE WHEN removed = 1 THEN created_at ELSE NULL END,created_at
      FROM admin_room_removals WHERE operation_id = ? AND changes() = 1
      ON CONFLICT(room_code) DO UPDATE SET removed = excluded.removed,revision = excluded.revision,
        removed_at = excluded.removed_at,updated_at = excluded.updated_at`)
      .bind(operationId),
    database
      .prepare(`SELECT operation_id,actor_admin_id,room_code,request_hash,applied_version,applied_revision
      FROM admin_room_removals WHERE operation_id = ? AND EXISTS (${mutationAuthority})`)
      .bind(operationId, ...args),
    database.prepare(roomSelect).bind(code, ...args),
  ]);
  authorize(results[0], true);
  const receipt = results[4].results[0] as Receipt | undefined;
  const row = results[5].results[0] as Row | undefined;
  if (receipt) {
    if (
      receipt.actor_admin_id !== actorId ||
      receipt.room_code !== code ||
      receipt.request_hash !== requestHash
    )
      throw new AdminError(
        'This removal operation is bound to a different administrator or request.',
        409,
      );
    if (!row) throw new AdminError('Room not found.', 404);
    return {
      operationId,
      replayed: results[1].meta.changes !== 1,
      appliedRevision: receipt.applied_revision,
      appliedVersion: receipt.applied_version,
      room: project(row),
    };
  }
  if (!row) throw new AdminError('Room not found.', 404);
  if (row.version !== expectedVersion || row.revision !== expectedRevision)
    throw new AdminError(
      'The room or removal settings changed. Refresh before choosing a new operation.',
      409,
    );
  throw new AdminError(
    removed
      ? 'This room is already removed.'
      : 'This room is already available.',
    409,
  );
}
