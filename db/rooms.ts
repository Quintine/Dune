import { env } from 'cloudflare:workers';
import {
  applyAction,
  normalizeAutomaticGame,
  createGame,
  joinGame,
  newPlayer,
  viewGame,
  RuleError,
  type Action,
  type Game,
} from '@/game/engine';
import type { FactionId } from '@/game/catalog';
import { runBots } from '@/game/bots';
export const ONLINE_BOT_INTERVAL_MS = 1500;
/** Internal trusted dependency; never accepted from HTTP inputs. */
export type RoomsClock = {
  now(): number;
  sleep(ms: number): Promise<void>;
};
const roomsClock: RoomsClock = {
  now: () => Date.now(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};
function queueRoomBots(next: Game, current: Game, now: number) {
  next.botsPending =
    (next.status === 'setup' || next.status === 'playing') &&
    next.players.some((p) => p.bot ?? p.autopilot);
  if (next.botsPending)
    next.botNextActionAt =
      current.botsPending && Number.isFinite(current.botNextActionAt)
        ? current.botNextActionAt
        : now + ONLINE_BOT_INTERVAL_MS;
  else delete next.botNextActionAt;
}
function db() {
  if (!env.DB) throw new Error('Game storage is unavailable.');
  return env.DB;
}
async function hash(value: string) {
  const bytes = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(bytes), (n) =>
    n.toString(16).padStart(2, '0'),
  ).join('');
}
export class RoomEntryError extends RuleError {
  constructor(
    message: string,
    readonly code: string,
    readonly status = 409,
  ) {
    super(message);
  }
}
type PreparedEntry = {
  operationId: string;
  operationHash: string;
  sessionToken: string;
  sessionHash: string;
  requestHash: string;
};
type EntryResult = {
  token?: string;
  view: ReturnType<typeof viewGame>;
  entryReceipt?: { operationId: string; replayed: boolean };
  alreadySeated?: true;
};
async function prepareEntry(
  input: unknown,
  identity: unknown,
): Promise<PreparedEntry | null> {
  if (input === undefined) return null;
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new RoomEntryError(
      'Provide a valid room-entry receipt.',
      'INVALID_ENTRY_REQUEST',
      400,
    );
  const entry = input as Record<string, unknown>;
  if (
    Object.keys(entry).some(
      (key) => !['operationId', 'sessionToken'].includes(key),
    ) ||
    typeof entry.operationId !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
      entry.operationId,
    ) ||
    typeof entry.sessionToken !== 'string' ||
    !/^[0-9a-f]{64}$/.test(entry.sessionToken)
  )
    throw new RoomEntryError(
      'Generate a room-entry operation and private 256-bit session token.',
      'INVALID_ENTRY_REQUEST',
      400,
    );
  return {
    operationId: entry.operationId,
    operationHash: await hash(entry.operationId),
    sessionToken: entry.sessionToken,
    sessionHash: await hash(entry.sessionToken),
    requestHash: await hash(JSON.stringify(identity)),
  };
}
async function replayEntry(
  entry: PreparedEntry | null,
): Promise<(EntryResult & { token: string }) | null> {
  if (!entry) return null;
  const row = await db()
    .prepare(
      'SELECT request_hash,session_hash,room_code,player_id FROM room_entry_receipts WHERE operation_hash = ?',
    )
    .bind(entry.operationHash)
    .first<{
      request_hash: string;
      session_hash: string;
      room_code: string;
      player_id: string;
    }>();
  if (!row) return null;
  if (
    row.request_hash !== entry.requestHash ||
    row.session_hash !== entry.sessionHash
  )
    throw new RoomEntryError(
      'This room-entry receipt does not match the original request.',
      'ENTRY_RECEIPT_INVALID',
    );
  try {
    const view = await readSeatView(row.room_code, {
      playerId: row.player_id,
      tokenHash: row.session_hash,
    });
    return {
      view,
      token: entry.sessionToken,
      entryReceipt: { operationId: entry.operationId, replayed: true },
    };
  } catch (error) {
    if (!(error instanceof RuleError)) throw error;
    throw new RoomEntryError(
      'This room-entry session is no longer active. Use the saved seat recovery kit.',
      'ENTRY_RECEIPT_INVALID',
    );
  }
}
async function requireUnusedEntryToken(entry: PreparedEntry | null) {
  if (
    entry &&
    (await db()
      .prepare('SELECT 1 AS present FROM seats WHERE token_hash = ?')
      .bind(entry.sessionHash)
      .first())
  )
    throw new RoomEntryError(
      'This room-entry session token has already been used.',
      'ENTRY_TOKEN_USED',
    );
}
export async function createRoom(
  name: string,
  f: FactionId,
  advanced: boolean,
  expansions: string[],
  entryInput?: unknown,
): Promise<EntryResult & { token: string }> {
  const code = Array.from(
    crypto.getRandomValues(new Uint8Array(8)),
    (n) => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[n % 31],
  ).join('');
  const id = crypto.randomUUID();
  const g = createGame(code, newPlayer(id, name, f), advanced, expansions);
  const entry = await prepareEntry(entryInput, {
    kind: 'create',
    name: g.players[0].name,
    faction: f,
    advanced,
    expansions: [...g.expansions].sort(),
  });
  try {
    const replay = await replayEntry(entry);
    if (replay) return replay;
    await requireUnusedEntryToken(entry);
    const token =
      entry?.sessionToken ?? crypto.randomUUID() + crypto.randomUUID();
    const tokenHash = entry?.sessionHash ?? (await hash(token));
    await db().batch([
      db()
        .prepare(
          'INSERT INTO rooms(code,state,version,updated_at) VALUES(?,?,0,?)',
        )
        .bind(code, JSON.stringify(g), Date.now()),
      db()
        .prepare(
          'INSERT INTO seats(token_hash,room_code,player_id) VALUES(?,?,?)',
        )
        .bind(tokenHash, code, id),
      ...(entry
        ? [
            db()
              .prepare(
                'INSERT INTO room_entry_receipts(operation_hash,request_hash,session_hash,room_code,player_id) VALUES(?,?,?,?,?)',
              )
              .bind(
                entry.operationHash,
                entry.requestHash,
                entry.sessionHash,
                code,
                id,
              ),
          ]
        : []),
    ]);
    return {
      token,
      view: await readSeatView(code, { playerId: id, tokenHash }),
      ...(entry
        ? { entryReceipt: { operationId: entry.operationId, replayed: false } }
        : {}),
    };
  } catch (error) {
    // The competing identical transaction may have won a unique token/operation constraint.
    const replay = await replayEntry(entry);
    if (replay) return replay;
    await requireUnusedEntryToken(entry);
    throw error;
  }
}
export async function readRoom(code: string) {
  const row = await db()
    .prepare('SELECT state,version FROM rooms WHERE code = ?')
    .bind(code)
    .first<{ state: string; version: number }>();
  if (!row) throw new RuleError('Room not found. Check your invite code.');
  const g: Game = JSON.parse(row.state);
  g.version = row.version;
  return g;
}
export type SeatAuth = { playerId: string; tokenHash: string };
export async function authenticate(
  code: string,
  token: string,
): Promise<SeatAuth> {
  if (!token) throw new RuleError('Join this room first.');
  const tokenHash = await hash(token);
  const seat = await db()
    .prepare(
      'SELECT player_id FROM seats WHERE token_hash = ? AND room_code = ? AND revoked = 0',
    )
    .bind(tokenHash, code)
    .first<{ player_id: string }>();
  if (!seat) throw new RuleError('Your seat could not be verified.');
  return { playerId: seat.player_id, tokenHash };
}
export async function joinRoom(
  code: string,
  name: string,
  f: FactionId,
  entryInput?: unknown,
  existingAuth?: SeatAuth | null,
): Promise<EntryResult> {
  const id = crypto.randomUUID();
  const player = newPlayer(id, name, f);
  const entry = await prepareEntry(entryInput, {
    kind: 'join',
    room: code,
    name: player.name,
    faction: f,
  });
  try {
    // Receipt possession must identify the original seat before considering a different browser cookie.
    const replay = await replayEntry(entry);
    if (replay) return replay;
    if (existingAuth) {
      try {
        return {
          view: await readSeatView(code, existingAuth),
          alreadySeated: true,
        };
      } catch (error) {
        if (!(error instanceof RuleError)) throw error;
      }
    }
    await requireUnusedEntryToken(entry);
    const g = await readRoom(code);
    joinGame(g, player);
    const old = g.version;
    g.version++;
    const token =
      entry?.sessionToken ?? crypto.randomUUID() + crypto.randomUUID();
    const tokenHash = entry?.sessionHash ?? (await hash(token));
    const results = await db().batch([
      db()
        .prepare(
          'UPDATE rooms SET state = ?, version = version + 1, updated_at = ? WHERE code = ? AND version = ?',
        )
        .bind(JSON.stringify(g), Date.now(), code, old),
      db()
        .prepare(
          'INSERT INTO seats(token_hash,room_code,player_id) SELECT ?,?,? WHERE changes() = 1',
        )
        .bind(tokenHash, code, id),
      ...(entry
        ? [
            db()
              .prepare(
                'INSERT INTO room_entry_receipts(operation_hash,request_hash,session_hash,room_code,player_id) SELECT ?,?,?,?,? WHERE changes() = 1',
              )
              .bind(
                entry.operationHash,
                entry.requestHash,
                entry.sessionHash,
                code,
                id,
              ),
          ]
        : []),
    ]);
    if (results[0].meta.changes !== 1)
      throw new RoomEntryError(
        'The table changed. Retry the same room-entry request.',
        'ENTRY_CONFLICT',
      );
    return {
      token,
      view: await readSeatView(code, { playerId: id, tokenHash }),
      ...(entry
        ? { entryReceipt: { operationId: entry.operationId, replayed: false } }
        : {}),
    };
  } catch (error) {
    const replay = await replayEntry(entry);
    if (replay) return replay;
    await requireUnusedEntryToken(entry);
    throw error;
  }
}
export async function act(
  code: string,
  auth: SeatAuth,
  version: number,
  action: Action,
  clock: RoomsClock = roomsClock,
) {
  const current = await readRoom(code);
  if (current.version !== version)
    throw new RuleError(
      'The table changed. Your view has refreshed; try again.',
    );
  const id = auth.playerId;
  if (
    current.players.find((p) => p.id === id)?.autopilot &&
    action.type !== 'setAutopilot' &&
    action.type !== 'advanceBots'
  )
    throw new RuleError('Take back control before making a game decision.');
  // This is a wake-up request, not another game action. The route schedules the
  // persisted worker; repeated or early wake-ups cannot bypass its deadline.
  if (action.type === 'advanceBots') return readSeatView(code, auth);
  const next = applyAction(current, id, action);
  queueRoomBots(next, current, clock.now());
  next.version++;
  const result = await db()
    .prepare(
      'UPDATE rooms SET state = ?, version = version + 1, updated_at = ? WHERE code = ? AND version = ? AND EXISTS (SELECT 1 FROM seats WHERE room_code = ? AND player_id = ? AND token_hash = ? AND revoked = 0)',
    )
    .bind(
      JSON.stringify(next),
      clock.now(),
      code,
      version,
      code,
      auth.playerId,
      auth.tokenHash,
    )
    .run();
  if (result.meta.changes !== 1)
    throw new RuleError(
      'Another action arrived first. Your view has refreshed; try again.',
    );
  return viewGame(next, id);
}

/** Check the credential and load its private state in one database statement. */
export async function readSeatView(code: string, auth: SeatAuth) {
  const row = await db()
    .prepare(
      'SELECT rooms.state, rooms.version FROM rooms JOIN seats ON seats.room_code = rooms.code WHERE rooms.code = ? AND seats.player_id = ? AND seats.token_hash = ? AND seats.revoked = 0',
    )
    .bind(code, auth.playerId, auth.tokenHash)
    .first<{ state: string; version: number }>();
  if (!row) throw new RuleError('Your seat could not be verified.');
  const g: Game = JSON.parse(row.state);
  g.version = row.version;
  return viewGame(g, auth.playerId);
}

/** Scheduling hint only; the engine remains the authority on whether a choice exists. */
export function needsAutomaticRoomRecovery(
  state: Pick<Game, 'response' | 'decision' | 'pendingTreacheryDiscard'> & {
    richeseAuction?: unknown;
    battle?: { revealed: boolean; territory: string } | null;
    automaticContinuationPending?: boolean;
    grummanCollection?: { event: string; stage?: string } | null;
  },
) {
  return (
    state.automaticContinuationPending === true ||
    state.grummanCollection?.stage === 'waiting' ||
    !!state.pendingTreacheryDiscard ||
    !!state.response ||
    !!state.richeseAuction ||
    (!state.decision && !state.response && state.battle?.revealed === true && state.battle.territory.startsWith('homeworld:')) ||
    state.decision?.kind === 'choamMarket' ||
    state.decision?.kind === 'choamAudit' ||
    state.decision?.kind === 'choamAuditPayment' ||
    state.decision?.kind === 'ecazAmbassador' ||
    state.decision?.kind === 'homeworldShipmentGuild' ||
    state.decision?.kind === 'fullPlanRead' ||
    state.decision?.kind === 'auctionPayment'
  );
}

/** Persist an old automatic continuation through the same version fence as current actions. */
export async function continueRoomAutomatic(
  code: string,
  clock: RoomsClock = roomsClock,
) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const current = await readRoom(code);
    if (
      !needsAutomaticRoomRecovery(current) ||
      (!current.pendingTreacheryDiscard &&
        (current.truthtrance ||
          current.phaseOpening ||
          current.status === 'finished'))
    )
      return;
    const next = normalizeAutomaticGame(current);
    if (JSON.stringify(next) === JSON.stringify(current)) return;
    queueRoomBots(next, current, clock.now());
    next.version = current.version + 1;
    const result = await db()
      .prepare(
        'UPDATE rooms SET state = ?, version = version + 1, updated_at = ? WHERE code = ? AND version = ?',
      )
      .bind(JSON.stringify(next), clock.now(), code, current.version)
      .run();
    if (result.meta.changes === 1) return;
  }
}

/** Resume only persisted AI control; every step is fenced against human control
 * changes. This bounded worker is best-effort, not a durable alarm: if its host
 * stops it, the persisted deadline remains for the next authenticated request.
 */
export async function continueRoomBots(
  code: string,
  batches = 16,
  clock: RoomsClock = roomsClock,
) {
  for (let batch = 0; batch < batches; batch++) {
    let current = await readRoom(code);
    if (!current.botsPending || current.status === 'finished') return;
    const delay = (current.botNextActionAt ?? clock.now()) - clock.now();
    if (delay > 0) {
      await clock.sleep(Math.min(delay, ONLINE_BOT_INTERVAL_MS));
      // A human may have taken control or another worker committed while asleep.
      current = await readRoom(code);
      if (!current.botsPending || current.status === 'finished') return;
      if ((current.botNextActionAt ?? 0) > clock.now()) continue;
    }
    // Offline simulations retain runBots' fast default. Online persistence makes
    // at most one AI decision visible per successful compare-and-swap.
    const next = runBots(current, 1);
    if (next.botsPending)
      next.botNextActionAt = clock.now() + ONLINE_BOT_INTERVAL_MS;
    else delete next.botNextActionAt;
    next.version = current.version + 1;
    const result = await db()
      .prepare(
        'UPDATE rooms SET state = ?, version = version + 1, updated_at = ? WHERE code = ? AND version = ?',
      )
      .bind(JSON.stringify(next), clock.now(), code, current.version)
      .run();
    // A different worker, seat recovery, or Take back control won. Re-read its authority.
    if (result.meta.changes !== 1) continue;
    if (!next.botsPending) return;
  }
}

export class SeatControlError extends RuleError {
  constructor(
    message: string,
    readonly code: string,
    readonly status = 409,
  ) {
    super(message);
  }
}
function secretHash(value: unknown) {
  if (typeof value !== 'string' || !/^[0-9a-f]{64}$/.test(value))
    throw new SeatControlError(
      'Use a private 256-bit key generated by the recovery tool.',
      'INVALID_CONTROL_REQUEST',
      400,
    );
  return hash(value);
}
function controlVersion(value: unknown): asserts value is number {
  if (!Number.isSafeInteger(value) || (value as number) < 0)
    throw new SeatControlError(
      'Provide the current room version.',
      'INVALID_CONTROL_REQUEST',
      400,
    );
}

export async function setRecoveryKey(
  code: string,
  auth: SeatAuth,
  version: unknown,
  secret: unknown,
) {
  controlVersion(version);
  const recoveryHash = await secretHash(secret);
  if (recoveryHash === auth.tokenHash)
    throw new SeatControlError(
      'The recovery key must differ from the session credential.',
      'INVALID_CONTROL_REQUEST',
      400,
    );
  const results = await db().batch([
    db()
      .prepare(
        'UPDATE rooms SET version = version + 1, updated_at = ? WHERE code = ? AND version = ? AND EXISTS (SELECT 1 FROM seats WHERE room_code = ? AND player_id = ? AND token_hash = ? AND revoked = 0)',
      )
      .bind(Date.now(), code, version, code, auth.playerId, auth.tokenHash),
    db()
      .prepare(
        'INSERT INTO seat_recovery_keys(room_code,player_id,recovery_hash) SELECT ?,?,? WHERE changes() = 1 ON CONFLICT(room_code,player_id) DO UPDATE SET recovery_hash = excluded.recovery_hash, current_operation_hash = NULL',
      )
      .bind(code, auth.playerId, recoveryHash),
  ]);
  if (results[0].meta.changes !== 1)
    throw new SeatControlError(
      'The table or seat changed. Reconnect before saving the recovery key.',
      'STALE_VERSION',
    );
  return {
    view: await readSeatView(code, auth),
    recoveryConfigured: true as const,
  };
}

export async function recoverSeat(
  code: string,
  input: {
    playerId: unknown;
    recoverySecret: unknown;
    operationId: unknown;
    newSessionToken: unknown;
  },
) {
  if (
    typeof input.playerId !== 'string' ||
    !input.playerId ||
    input.playerId.length > 100 ||
    typeof input.operationId !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
      input.operationId,
    )
  )
    throw new SeatControlError(
      'Provide the player ID and a recovery operation ID.',
      'INVALID_CONTROL_REQUEST',
      400,
    );
  const playerId = input.playerId;
  const recoveryHash = await secretHash(input.recoverySecret);
  const sessionHash = await secretHash(input.newSessionToken);
  if (sessionHash === recoveryHash)
    throw new SeatControlError(
      'The new session credential must differ from the recovery key.',
      'INVALID_SESSION_TOKEN',
    );
  const operationHash = await hash(input.operationId);
  const key = await db()
    .prepare(
      'SELECT recovery_hash FROM seat_recovery_keys WHERE room_code = ? AND player_id = ?',
    )
    .bind(code, playerId)
    .first<{ recovery_hash: string }>();
  if (!key || key.recovery_hash !== recoveryHash)
    throw new SeatControlError(
      'The recovery proof could not be verified.',
      'INVALID_RECOVERY_PROOF',
    );
  const receipt = await db()
    .prepare(
      'SELECT recovery_hash, session_hash FROM seat_recovery_receipts WHERE room_code = ? AND player_id = ? AND operation_hash = ?',
    )
    .bind(code, playerId, operationHash)
    .first<{ recovery_hash: string; session_hash: string }>();
  if (receipt) {
    if (
      receipt.recovery_hash !== recoveryHash ||
      receipt.session_hash !== sessionHash
    )
      throw new SeatControlError(
        'This recovery operation cannot be reused with a different proof or credential.',
        'RECOVERY_RECEIPT_INVALID',
      );
    // A replaced key or later rotation invalidates the receipt, including races after the first lookup.
    const row = await db()
      .prepare(
        'SELECT rooms.state, rooms.version FROM rooms JOIN seats ON seats.room_code = rooms.code JOIN seat_recovery_keys AS keys ON keys.room_code = seats.room_code AND keys.player_id = seats.player_id WHERE rooms.code = ? AND seats.player_id = ? AND seats.token_hash = ? AND seats.revoked = 0 AND keys.recovery_hash = ? AND keys.current_operation_hash = ?',
      )
      .bind(code, playerId, sessionHash, recoveryHash, operationHash)
      .first<{ state: string; version: number }>();
    if (!row)
      throw new SeatControlError(
        'This recovery receipt is no longer active.',
        'RECOVERY_RECEIPT_INVALID',
      );
    const g: Game = JSON.parse(row.state);
    g.version = row.version;
    return {
      view: viewGame(g, playerId),
      token: input.newSessionToken as string,
      recovered: true as const,
      replayed: true,
    };
  }
  if (
    await db()
      .prepare('SELECT 1 AS present FROM seats WHERE token_hash = ?')
      .bind(sessionHash)
      .first()
  )
    throw new SeatControlError(
      'Generate a new session credential; this token has already been used.',
      'INVALID_SESSION_TOKEN',
    );
  const current = await readRoom(code);
  const results = await db().batch([
    db()
      .prepare(
        'UPDATE rooms SET version = version + 1, updated_at = ? WHERE code = ? AND version = ? AND EXISTS (SELECT 1 FROM seat_recovery_keys WHERE room_code = ? AND player_id = ? AND recovery_hash = ?) AND EXISTS (SELECT 1 FROM seats WHERE room_code = ? AND player_id = ? AND revoked = 0) AND NOT EXISTS (SELECT 1 FROM seat_recovery_receipts WHERE room_code = ? AND player_id = ? AND operation_hash = ?) AND NOT EXISTS (SELECT 1 FROM seats WHERE token_hash = ?)',
      )
      .bind(
        Date.now(),
        code,
        current.version,
        code,
        playerId,
        recoveryHash,
        code,
        playerId,
        code,
        playerId,
        operationHash,
        sessionHash,
      ),
    db()
      .prepare(
        'INSERT INTO seat_recovery_receipts(room_code,player_id,operation_hash,recovery_hash,session_hash) SELECT ?,?,?,?,? WHERE changes() = 1',
      )
      .bind(code, playerId, operationHash, recoveryHash, sessionHash),
    db()
      .prepare(
        'UPDATE seats SET revoked = 1 WHERE room_code = ? AND player_id = ? AND revoked = 0 AND changes() = 1',
      )
      .bind(code, playerId),
    db()
      .prepare(
        'INSERT INTO seats(token_hash,room_code,player_id) SELECT ?,?,? WHERE changes() > 0',
      )
      .bind(sessionHash, code, playerId),
    db()
      .prepare(
        'UPDATE seat_recovery_keys SET current_operation_hash = ? WHERE room_code = ? AND player_id = ? AND changes() = 1',
      )
      .bind(operationHash, code, playerId),
  ]);
  if (results[0].meta.changes !== 1) {
    // A concurrent exact request may have completed: retrying the same proof is safe.
    throw new SeatControlError(
      'The table or recovery operation changed. Retry the exact recovery request.',
      'STALE_VERSION',
    );
  }
  return {
    view: await readSeatView(code, { playerId, tokenHash: sessionHash }),
    token: input.newSessionToken as string,
    recovered: true as const,
    replayed: false,
  };
}
