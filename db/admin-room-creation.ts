import { applyAction, createGame, newPlayer } from '../game/engine';
import { AdminError, type AdminIdentity } from './admin-access';
import {
  validAdminRoomCreationInput,
  type AdminRoomCreationInput,
  type AdminRoomCreationResult,
} from '../lib/admin-room-creation';

const authority = `SELECT a.role FROM admin_sessions s JOIN admin_accounts a ON a.id = s.admin_id
  WHERE s.token_hash = ? AND a.id = ? AND a.enabled = 1 AND s.revoked_at IS NULL
  AND s.expires_at > ? AND s.generation = a.session_generation
  AND a.role IN ('owner','operator','viewer')`;
const mutationAuthority = authority + " AND a.role IN ('owner','operator')";
const MAX_CODE_ATTEMPTS = 5;

async function hash(value: string) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}
function roomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from(
    crypto.getRandomValues(new Uint8Array(8)),
    (byte) => alphabet[byte % alphabet.length],
  ).join('');
}
function configuration(input: AdminRoomCreationInput) {
  return {
    name: input.name.trim(),
    faction: input.faction,
    advanced: input.advanced,
    techTokens: input.techTokens,
    strongholdCards: input.strongholdCards,
    bots: input.bots.map((bot) => ({
      faction: bot.faction,
      difficulty: bot.difficulty,
    })),
  };
}
function createLobby(
  code: string,
  hostId: string,
  input: ReturnType<typeof configuration>,
) {
  let game = createGame(
    code,
    newPlayer(hostId, input.name, input.faction),
    input.advanced,
    [],
  );
  for (const bot of input.bots)
    game = applyAction(game, hostId, { type: 'addBot', ...bot });
  if (input.techTokens)
    game = applyAction(game, hostId, { type: 'techTokens', enabled: true });
  if (input.strongholdCards)
    game = applyAction(game, hostId, {
      type: 'strongholdCards',
      enabled: true,
    });
  return game;
}

/** Creation and its receipt are one live-authorized transaction. Replays never restore revoked access. */
export async function createAdminRoom(
  database: D1Database,
  identity: AdminIdentity,
  input: AdminRoomCreationInput,
  now = Date.now(),
): Promise<AdminRoomCreationResult> {
  if (
    !identity ||
    typeof identity.id !== 'string' ||
    typeof identity.sessionHash !== 'string' ||
    identity.sessionHash.length !== 64 ||
    !/^[0-9a-f]{64}$/.test(identity.sessionHash)
  )
    throw new AdminError('Administrator sign-in required.', 401);
  if (!validAdminRoomCreationInput(input))
    throw new AdminError(
      'Choose a host name, unique base factions, valid AI difficulties and supported lobby rules, with a fresh private retry proof and a reason of 1–300 characters.',
      400,
    );
  const requestedConfiguration = configuration(input);
  const publicConfiguration = JSON.stringify(requestedConfiguration);
  const operationId = input.operationId;
  const reason = input.reason.trim();
  const [sessionHash, requestHash] = await Promise.all([
    hash(input.sessionToken),
    hash(JSON.stringify({ configuration: requestedConfiguration, reason })),
  ]);
  const args = [identity.sessionHash, identity.id, now];
  const hostId = crypto.randomUUID();
  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
    const code = roomCode();
    const game = createLobby(code, hostId, requestedConfiguration);
    const results = await database.batch([
      database.prepare(authority).bind(...args),
      database
        .prepare(`INSERT INTO rooms(code,state,version,updated_at)
        SELECT ?,?,0,? WHERE EXISTS (${mutationAuthority})
        AND NOT EXISTS (SELECT 1 FROM admin_room_creations WHERE operation_id = ? OR session_hash = ?)
        AND NOT EXISTS (SELECT 1 FROM seats WHERE token_hash = ?)
        AND NOT EXISTS (SELECT 1 FROM rooms WHERE code = ?)`)
        .bind(
          code,
          JSON.stringify(game),
          now,
          ...args,
          operationId,
          sessionHash,
          sessionHash,
          code,
        ),
      database
        .prepare(`INSERT INTO seats(token_hash,room_code,player_id)
        SELECT ?,?,? WHERE changes() = 1`)
        .bind(sessionHash, code, hostId),
      database
        .prepare(`INSERT INTO admin_room_creations
        (operation_id,actor_admin_id,room_code,host_id,request_hash,session_hash,configuration,reason,created_at)
        SELECT ?,?,?,?,?,?,?,?,? WHERE changes() = 1`)
        .bind(
          operationId,
          identity.id,
          code,
          hostId,
          requestHash,
          sessionHash,
          publicConfiguration,
          reason,
          now,
        ),
      database
        .prepare(`SELECT c.operation_id,c.actor_admin_id,c.room_code,c.host_id,c.request_hash,c.session_hash,
        EXISTS (SELECT 1 FROM room_removals WHERE room_code = c.room_code AND removed = 1) AS room_removed,
        EXISTS (SELECT 1 FROM seats s JOIN rooms r ON r.code = s.room_code
          WHERE s.token_hash = c.session_hash AND s.room_code = c.room_code AND s.player_id = c.host_id AND s.revoked = 0
          AND NOT EXISTS (SELECT 1 FROM room_removals WHERE room_code = r.code AND removed = 1)
          AND CASE WHEN json_valid(r.state) THEN EXISTS (
            SELECT 1 FROM json_each(CASE WHEN json_type(r.state, '$.players') = 'array' THEN json_extract(r.state, '$.players') ELSE '[]' END) p
            WHERE json_extract(CASE WHEN p.type = 'object' THEN p.value ELSE '{}' END, '$.id') = c.host_id
          ) ELSE 0 END) AS host_access
        FROM admin_room_creations c WHERE c.operation_id = ? AND EXISTS (${mutationAuthority})`)
        .bind(operationId, ...args),
      database
        .prepare(`SELECT
        EXISTS (SELECT 1 FROM seats WHERE token_hash = ?) OR EXISTS (SELECT 1 FROM admin_room_creations WHERE session_hash = ?) AS token_used,
        EXISTS (SELECT 1 FROM rooms WHERE code = ?) AS code_used
        WHERE EXISTS (${mutationAuthority})`)
        .bind(sessionHash, sessionHash, code, ...args),
    ]);
    const role = (results[0].results[0] as { role: string } | undefined)?.role;
    if (!role) throw new AdminError('Administrator sign-in required.', 401);
    if (role === 'viewer')
      throw new AdminError(
        'Your administrator role does not permit this action.',
        403,
      );
    const receipt = results[4].results[0] as
      | {
          operation_id: string;
          actor_admin_id: string;
          room_code: string;
          host_id: string;
          request_hash: string;
          session_hash: string;
          host_access: number;
          room_removed: number;
        }
      | undefined;
    if (receipt) {
      if (
        receipt.actor_admin_id !== identity.id ||
        receipt.request_hash !== requestHash ||
        receipt.session_hash !== sessionHash
      )
        throw new AdminError(
          'This creation operation is bound to different settings, private proof or administrator.',
          409,
        );
      return {
        operationId: receipt.operation_id,
        code: receipt.room_code,
        hostId: receipt.host_id,
        replayed: results[1].meta.changes !== 1,
        hostAccess: receipt.host_access === 1,
        ...(receipt.room_removed === 1 ? { roomRemoved: true as const } : {}),
      };
    }
    const conflict = results[5].results[0] as {
      token_used: number;
      code_used: number;
    };
    if (conflict.token_used)
      throw new AdminError(
        'This host session proof has already been used. Start a new creation request with a fresh private proof.',
        409,
      );
    if (!conflict.code_used)
      throw new AdminError(
        'Room creation could not be confirmed. Retry the exact saved request.',
        409,
      );
  }
  throw new AdminError(
    'No unused room invitation could be reserved. Retry the exact saved request.',
    409,
  );
}
