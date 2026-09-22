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
  type GameView,
} from '@/game/engine';
import type { FactionId } from '@/game/catalog';
import type { Difficulty } from '@/game/bot-profiles';
import { runBots } from '@/game/bots';
import type { RoomControl } from '@/lib/room-control';
import {
  validSeatAiGrantId,
  validSetSeatAiDelegateInput,
  validUseSeatAiDelegateInput,
  type SeatAiDelegationView,
  type SetSeatAiDelegateInput,
  type UseSeatAiDelegateInput,
} from '@/lib/seat-ai-delegation';
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
/** Temporary room unavailability must never invalidate a saved seat or retry proof. */
export class RoomRemovedError extends RoomEntryError {
  constructor() {
    super(
      'An administrator recoverably removed this room. Keep your saved seat and retry details; access returns if the room is restored.',
      'ROOM_REMOVED',
      410,
    );
  }
}
async function requireRoomNotRemoved(code: string) {
  const removed = await db()
    .prepare(
      'SELECT 1 AS removed FROM room_removals WHERE room_code = ? AND removed = 1',
    )
    .bind(code)
    .first();
  if (removed) throw new RoomRemovedError();
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
  view: GameView;
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
    if (error instanceof RoomRemovedError || !(error instanceof RuleError))
      throw error;
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
type RoomControlRow = { room_control: string };
// SQLite constructs an explicit public allowlist, consistent with delegation views.
const roomControlProjection = `json_object(
  'paused', json(CASE WHEN c.paused = 1 THEN 'true' ELSE 'false' END),
  'joinLocked', json(CASE WHEN c.join_locked = 1 THEN 'true' ELSE 'false' END),
  'revision', COALESCE(c.revision, 0), 'updatedAt', c.updated_at
) AS room_control`;
function publicRoomControl(row: RoomControlRow): RoomControl {
  return JSON.parse(row.room_control) as RoomControl;
}
function attachRoomControl(view: GameView, row: RoomControlRow) {
  const control = publicRoomControl(row);
  // Untouched rooms retain the ordinary game-view shape. Once an administrator
  // changes controls, keep the revision visible even after both flags are cleared.
  if (control.revision > 0) view.roomControl = control;
}
async function readRoomSnapshot(code: string) {
  const row = await db()
    .prepare(`SELECT rooms.state, rooms.version, ${roomControlProjection}
      FROM rooms LEFT JOIN room_controls c ON c.room_code = rooms.code WHERE rooms.code = ? AND NOT EXISTS (SELECT 1 FROM room_removals WHERE room_code = rooms.code AND removed = 1)`)
    .bind(code)
    .first<{ state: string; version: number } & RoomControlRow>();
  if (!row) {
    await requireRoomNotRemoved(code);
    throw new RuleError('Room not found. Check your invite code.');
  }
  const g: Game = JSON.parse(row.state);
  g.version = row.version;
  return { game: g, control: publicRoomControl(row) };
}
export async function readRoom(code: string) {
  const row = await db()
    .prepare(
      'SELECT state,version FROM rooms WHERE code = ? AND NOT EXISTS (SELECT 1 FROM room_removals WHERE room_code = rooms.code AND removed = 1)',
    )
    .bind(code)
    .first<{ state: string; version: number }>();
  if (!row) {
    await requireRoomNotRemoved(code);
    throw new RuleError('Room not found. Check your invite code.');
  }
  const game: Game = JSON.parse(row.state);
  game.version = row.version;
  return game;
}
function requireUnpaused(control: RoomControl) {
  if (control.paused)
    throw new RuleError(
      'An administrator paused this room. Game decisions and AI will continue after it resumes.',
    );
}
export type SeatAuth = { playerId: string; tokenHash: string };
export async function authenticate(
  code: string,
  token: string,
): Promise<SeatAuth> {
  if (!token) {
    await requireRoomNotRemoved(code);
    throw new RuleError('Join this room first.');
  }
  const tokenHash = await hash(token);
  const seat = await db()
    .prepare(
      'SELECT player_id FROM seats WHERE token_hash = ? AND room_code = ? AND revoked = 0 AND NOT EXISTS (SELECT 1 FROM room_removals WHERE room_code = seats.room_code AND removed = 1)',
    )
    .bind(tokenHash, code)
    .first<{ player_id: string }>();
  if (!seat) {
    await requireRoomNotRemoved(code);
    throw new RuleError('Your seat could not be verified.');
  }
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
        if (error instanceof RoomRemovedError || !(error instanceof RuleError))
          throw error;
      }
    }
    await requireUnusedEntryToken(entry);
    const { game: g, control } = await readRoomSnapshot(code);
    if (control.paused || control.joinLocked)
      throw new RoomEntryError(
        control.paused
          ? 'An administrator paused this room. New players may join after it resumes.'
          : 'New joins are locked by an administrator.',
        control.paused ? 'ROOM_PAUSED' : 'ROOM_JOIN_LOCKED',
      );
    joinGame(g, player);
    const old = g.version;
    g.version++;
    const token =
      entry?.sessionToken ?? crypto.randomUUID() + crypto.randomUUID();
    const tokenHash = entry?.sessionHash ?? (await hash(token));
    const results = await db().batch([
      db()
        .prepare(
          'UPDATE rooms SET state = ?, version = version + 1, updated_at = ? WHERE code = ? AND version = ? AND NOT EXISTS (SELECT 1 FROM room_removals WHERE room_code = rooms.code AND removed = 1) AND NOT EXISTS (SELECT 1 FROM room_controls WHERE room_code = rooms.code AND (paused = 1 OR join_locked = 1))',
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
    if (results[0].meta.changes !== 1) {
      await requireRoomNotRemoved(code);
      throw new RoomEntryError(
        'The table changed. Retry the same room-entry request.',
        'ENTRY_CONFLICT',
      );
    }
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
  const { game: current, control } = await readRoomSnapshot(code);
  const takingBackControl =
    action?.type === 'setAutopilot' && action.difficulty === null;
  if (!takingBackControl) requireUnpaused(control);
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
  const now = clock.now();
  const update = db()
    .prepare(
      'UPDATE rooms SET state = ?, version = version + 1, updated_at = ? WHERE code = ? AND version = ? AND NOT EXISTS (SELECT 1 FROM room_removals WHERE room_code = rooms.code AND removed = 1) AND (? = 1 OR NOT EXISTS (SELECT 1 FROM room_controls WHERE room_code = rooms.code AND paused = 1)) AND EXISTS (SELECT 1 FROM seats WHERE room_code = ? AND player_id = ? AND token_hash = ? AND revoked = 0)',
    )
    .bind(
      JSON.stringify(next),
      now,
      code,
      version,
      Number(takingBackControl),
      code,
      auth.playerId,
      auth.tokenHash,
    );
  const results =
    action.type === 'setAutopilot'
      ? await db().batch([
          update,
          db()
            .prepare(
              'UPDATE seat_ai_delegations SET revoked_at = ? WHERE room_code = ? AND owner_id = ? AND owner_session_hash = ? AND used_at IS NULL AND revoked_at IS NULL AND changes() = 1',
            )
            .bind(now, code, auth.playerId, auth.tokenHash),
        ])
      : [await update.run()];
  if (results[0].meta.changes !== 1) {
    await requireRoomNotRemoved(code);
    throw new RuleError(
      'Another action arrived first. Your view has refreshed; try again.',
    );
  }
  return readSeatView(code, auth);
}

/** Check the credential and load its private state in one database statement. */
export async function readSeatView(code: string, auth: SeatAuth) {
  const row = await db()
    .prepare(
      `SELECT rooms.state, rooms.version, ${roomControlProjection},
        CASE WHEN COUNT(delegations.grant_id) = 0 THEN NULL ELSE
          json_group_array(json_object(
            'grantId', delegations.grant_id,
            'ownerId', delegations.owner_id,
            'delegateId', delegations.delegate_id,
            'difficulty', delegations.difficulty,
            'expiresAt', delegations.expires_at,
            'usedAt', delegations.used_at
          )) END AS seat_ai_delegations
       FROM rooms
       LEFT JOIN room_controls c ON c.room_code = rooms.code
       JOIN seats AS viewer ON viewer.room_code = rooms.code
       LEFT JOIN seat_ai_delegations AS delegations
         ON delegations.room_code = rooms.code
        AND (delegations.owner_id = viewer.player_id OR delegations.delegate_id = viewer.player_id)
        AND delegations.revoked_at IS NULL
        AND EXISTS (
          SELECT 1 FROM seats AS owner_session
          WHERE owner_session.room_code = delegations.room_code
            AND owner_session.player_id = delegations.owner_id
            AND owner_session.token_hash = delegations.owner_session_hash
            AND owner_session.revoked = 0
        )
        AND EXISTS (
          SELECT 1 FROM seats AS delegate_session
          WHERE delegate_session.room_code = delegations.room_code
            AND delegate_session.player_id = delegations.delegate_id
            AND delegate_session.token_hash = delegations.delegate_session_hash
            AND delegate_session.revoked = 0
        )
       WHERE rooms.code = ? AND NOT EXISTS (SELECT 1 FROM room_removals WHERE room_code = rooms.code AND removed = 1) AND viewer.player_id = ?
         AND viewer.token_hash = ? AND viewer.revoked = 0
       GROUP BY rooms.code, rooms.state, rooms.version`,
    )
    .bind(code, auth.playerId, auth.tokenHash)
    .first<
      RoomControlRow & {
        state: string;
        version: number;
        seat_ai_delegations: string | null;
      }
    >();
  if (!row) {
    await requireRoomNotRemoved(code);
    throw new RuleError('Your seat could not be verified.');
  }
  const g: Game = JSON.parse(row.state);
  g.version = row.version;
  const view = viewGame(g, auth.playerId) as GameView;
  attachRoomControl(view, row);
  if (row.seat_ai_delegations) {
    const delegations = JSON.parse(
      row.seat_ai_delegations,
    ) as SeatAiDelegationView[];
    if (delegations.length) view.seatAiDelegations = delegations;
  }
  return view;
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
    (!state.decision &&
      !state.response &&
      state.battle?.revealed === true &&
      state.battle.territory.startsWith('homeworld:')) ||
    state.decision?.kind === 'choamMarket' ||
    state.decision?.kind === 'choamAudit' ||
    state.decision?.kind === 'choamAuditPayment' ||
    state.decision?.kind === 'ecazAmbassador' ||
    state.decision?.kind === 'homeworldShipmentGuild' ||
    state.decision?.kind === 'fullPlanRead' ||
    state.decision?.kind === 'handExchange' ||
    state.decision?.kind === 'auctionPayment'
  );
}

async function readWorkerRoomSnapshot(code: string) {
  try {
    return await readRoomSnapshot(code);
  } catch (error) {
    if (error instanceof RoomRemovedError) return null;
    throw error;
  }
}

/** Persist an old automatic continuation through the same version fence as current actions. */
export async function continueRoomAutomatic(
  code: string,
  clock: RoomsClock = roomsClock,
) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const snapshot = await readWorkerRoomSnapshot(code);
    if (!snapshot) return;
    const { game: current, control } = snapshot;
    if (control.paused) return;
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
        'UPDATE rooms SET state = ?, version = version + 1, updated_at = ? WHERE code = ? AND version = ? AND NOT EXISTS (SELECT 1 FROM room_removals WHERE room_code = rooms.code AND removed = 1) AND NOT EXISTS (SELECT 1 FROM room_controls WHERE room_code = rooms.code AND paused = 1)',
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
    let snapshot = await readWorkerRoomSnapshot(code);
    if (!snapshot) return;
    let current = snapshot.game;
    if (
      snapshot.control.paused ||
      !current.botsPending ||
      current.status === 'finished'
    )
      return;
    const delay = (current.botNextActionAt ?? clock.now()) - clock.now();
    if (delay > 0) {
      await clock.sleep(Math.min(delay, ONLINE_BOT_INTERVAL_MS));
      // A human may have taken control or another worker committed while asleep.
      snapshot = await readWorkerRoomSnapshot(code);
      if (!snapshot) return;
      current = snapshot.game;
      if (
        snapshot.control.paused ||
        !current.botsPending ||
        current.status === 'finished'
      )
        return;
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
        'UPDATE rooms SET state = ?, version = version + 1, updated_at = ? WHERE code = ? AND version = ? AND NOT EXISTS (SELECT 1 FROM room_removals WHERE room_code = rooms.code AND removed = 1) AND NOT EXISTS (SELECT 1 FROM room_controls WHERE room_code = rooms.code AND paused = 1)',
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

export const SEAT_AI_DELEGATION_TTL_MS = 24 * 60 * 60 * 1000;
type ControlClock = Pick<RoomsClock, 'now'>;
type SeatAiDelegationRow = Readonly<{
  room_code: string;
  owner_id: string;
  grant_id: string;
  delegate_id: string;
  difficulty: string;
  owner_session_hash: string;
  delegate_session_hash: string;
  expires_at: number;
  used_at: number | null;
  revoked_at: number | null;
}>;
const invalidDelegation = (message: string, code = 'INVALID_AI_DELEGATION') =>
  new SeatControlError(
    message,
    code,
    code === 'AI_DELEGATION_EXPIRED' ? 410 : 409,
  );
async function seatAiDelegation(grantId: string) {
  return db()
    .prepare(
      'SELECT room_code,owner_id,grant_id,delegate_id,difficulty,owner_session_hash,delegate_session_hash,expires_at,used_at,revoked_at FROM seat_ai_delegations WHERE grant_id = ?',
    )
    .bind(grantId)
    .first<SeatAiDelegationRow>();
}
async function delegationSessionsActive(row: SeatAiDelegationRow) {
  return !!(await db()
    .prepare(
      `SELECT 1 AS present
       FROM seats AS owner_session
       JOIN seats AS delegate_session ON delegate_session.room_code = owner_session.room_code
       WHERE owner_session.room_code = ?
         AND owner_session.player_id = ? AND owner_session.token_hash = ? AND owner_session.revoked = 0
         AND delegate_session.player_id = ? AND delegate_session.token_hash = ? AND delegate_session.revoked = 0`,
    )
    .bind(
      row.room_code,
      row.owner_id,
      row.owner_session_hash,
      row.delegate_id,
      row.delegate_session_hash,
    )
    .first());
}

export async function setSeatAiDelegate(
  code: string,
  auth: SeatAuth,
  version: unknown,
  input: SetSeatAiDelegateInput,
  clock: ControlClock = roomsClock,
) {
  await requireRoomNotRemoved(code);
  controlVersion(version);
  if (!validSetSeatAiDelegateInput(input))
    throw invalidDelegation(
      'Choose one human seat, an AI difficulty and a fresh delegation identifier.',
    );
  const existing = await seatAiDelegation(input.grantId);
  if (existing) {
    const same =
      existing.room_code === code &&
      existing.owner_id === auth.playerId &&
      existing.delegate_id === input.delegateId &&
      existing.difficulty === input.difficulty &&
      existing.owner_session_hash === auth.tokenHash;
    if (!same)
      throw invalidDelegation(
        'This delegation identifier is already bound to different consent.',
        'AI_DELEGATION_CHANGED',
      );
    if (!(await delegationSessionsActive(existing)))
      throw invalidDelegation(
        'A seat credential changed after this delegation was created.',
        'AI_DELEGATION_INVALIDATED',
      );
    return { view: await readSeatView(code, auth), replayed: true };
  }
  const { game: current, control } = await readRoomSnapshot(code);
  requireUnpaused(control);
  if (current.version !== version)
    throw invalidDelegation(
      'The table changed. Reconnect before saving this consent.',
      'STALE_VERSION',
    );
  const owner = current.players.find((player) => player.id === auth.playerId);
  const delegate = current.players.find(
    (player) => player.id === input.delegateId,
  );
  if (
    (current.status !== 'setup' && current.status !== 'playing') ||
    !owner ||
    owner.bot ||
    owner.autopilot ||
    !delegate ||
    delegate.id === owner.id ||
    delegate.bot
  )
    throw invalidDelegation(
      'A started human seat without active AI may authorize one different human seat.',
      'AI_DELEGATION_UNAVAILABLE',
    );
  const delegateSession = await db()
    .prepare(
      'SELECT MIN(token_hash) AS token_hash, COUNT(*) AS count FROM seats WHERE room_code = ? AND player_id = ? AND revoked = 0',
    )
    .bind(code, delegate.id)
    .first<{ token_hash: string | null; count: number }>();
  if (!delegateSession?.token_hash || delegateSession.count !== 1)
    throw invalidDelegation(
      'The delegate must have one current authenticated session.',
      'AI_DELEGATION_UNAVAILABLE',
    );
  const now = clock.now();
  const expiresAt = now + SEAT_AI_DELEGATION_TTL_MS;
  const results = await db().batch([
    db()
      .prepare(
        `UPDATE rooms SET version = version + 1, updated_at = ?
         WHERE code = ? AND version = ? AND NOT EXISTS (SELECT 1 FROM room_removals WHERE room_code = rooms.code AND removed = 1)
           AND NOT EXISTS (SELECT 1 FROM room_controls WHERE room_code = rooms.code AND paused = 1)
           AND EXISTS (SELECT 1 FROM seats WHERE room_code = ? AND player_id = ? AND token_hash = ? AND revoked = 0)
           AND EXISTS (SELECT 1 FROM seats WHERE room_code = ? AND player_id = ? AND token_hash = ? AND revoked = 0)
           AND NOT EXISTS (SELECT 1 FROM seat_ai_delegations WHERE grant_id = ?)`,
      )
      .bind(
        now,
        code,
        version,
        code,
        owner.id,
        auth.tokenHash,
        code,
        delegate.id,
        delegateSession.token_hash,
        input.grantId,
      ),
    db()
      .prepare(
        `INSERT INTO seat_ai_delegations(
           room_code,owner_id,grant_id,delegate_id,difficulty,
           owner_session_hash,delegate_session_hash,expires_at,used_at,revoked_at
         )
         SELECT ?,?,?,?,?,?,?,?,NULL,NULL WHERE changes() = 1`,
      )
      .bind(
        code,
        owner.id,
        input.grantId,
        delegate.id,
        input.difficulty,
        auth.tokenHash,
        delegateSession.token_hash,
        expiresAt,
      ),
    db()
      .prepare(
        `UPDATE seat_ai_delegations SET revoked_at = ?
         WHERE room_code = ? AND owner_id = ? AND grant_id != ?
           AND revoked_at IS NULL
           AND changes() = 1
           AND EXISTS (
             SELECT 1 FROM seat_ai_delegations AS current_grant
             WHERE current_grant.room_code = ? AND current_grant.owner_id = ?
               AND current_grant.grant_id = ?
           )`,
      )
      .bind(now, code, owner.id, input.grantId, code, owner.id, input.grantId),
  ]);
  if (results[0].meta.changes !== 1 || results[1].meta.changes !== 1) {
    await requireRoomNotRemoved(code);
    const won = await seatAiDelegation(input.grantId);
    if (
      won &&
      won.room_code === code &&
      won.owner_id === owner.id &&
      won.delegate_id === delegate.id &&
      won.difficulty === input.difficulty &&
      won.owner_session_hash === auth.tokenHash &&
      won.delegate_session_hash === delegateSession.token_hash &&
      (await delegationSessionsActive(won))
    )
      return { view: await readSeatView(code, auth), replayed: true };
    throw invalidDelegation(
      'The table, owner or delegate changed. Reconnect before saving this consent.',
      'STALE_VERSION',
    );
  }
  return { view: await readSeatView(code, auth), replayed: false };
}

export async function revokeSeatAiDelegate(
  code: string,
  auth: SeatAuth,
  version: unknown,
  grantId: unknown,
  clock: ControlClock = roomsClock,
) {
  await requireRoomNotRemoved(code);
  controlVersion(version);
  if (!validSeatAiGrantId(grantId))
    throw invalidDelegation('Choose the current AI delegation identifier.');
  const existing = await seatAiDelegation(grantId);
  if (
    existing?.room_code === code &&
    existing.owner_id === auth.playerId &&
    existing.owner_session_hash === auth.tokenHash &&
    (existing.revoked_at !== null || existing.used_at !== null)
  )
    return { view: await readSeatView(code, auth), replayed: true };
  if (
    !existing ||
    existing.room_code !== code ||
    existing.owner_id !== auth.playerId
  )
    throw invalidDelegation(
      'This AI delegation is no longer current for your seat.',
      'AI_DELEGATION_CHANGED',
    );
  const current = await readRoom(code);
  if (current.version !== version)
    throw invalidDelegation(
      'The table changed. Reconnect before revoking this consent.',
      'STALE_VERSION',
    );
  const now = clock.now();
  const results = await db().batch([
    db()
      .prepare(
        `UPDATE rooms SET version = version + 1, updated_at = ?
         WHERE code = ? AND version = ? AND NOT EXISTS (SELECT 1 FROM room_removals WHERE room_code = rooms.code AND removed = 1)
           AND EXISTS (SELECT 1 FROM seats WHERE room_code = ? AND player_id = ? AND token_hash = ? AND revoked = 0)
           AND EXISTS (
             SELECT 1 FROM seat_ai_delegations AS consent
             JOIN seats AS delegate_session
               ON delegate_session.room_code = consent.room_code
              AND delegate_session.player_id = consent.delegate_id
              AND delegate_session.token_hash = consent.delegate_session_hash
              AND delegate_session.revoked = 0
             WHERE consent.room_code = ? AND consent.owner_id = ? AND consent.grant_id = ?
               AND consent.owner_session_hash = ?
               AND consent.used_at IS NULL AND consent.revoked_at IS NULL
           )`,
      )
      .bind(
        now,
        code,
        version,
        code,
        auth.playerId,
        auth.tokenHash,
        code,
        auth.playerId,
        grantId,
        auth.tokenHash,
      ),
    db()
      .prepare(
        `UPDATE seat_ai_delegations SET revoked_at = ?
         WHERE room_code = ? AND owner_id = ? AND grant_id = ?
           AND owner_session_hash = ? AND used_at IS NULL AND revoked_at IS NULL
           AND changes() = 1`,
      )
      .bind(now, code, auth.playerId, grantId, auth.tokenHash),
  ]);
  if (results[0].meta.changes !== 1 || results[1].meta.changes !== 1) {
    await requireRoomNotRemoved(code);
    throw invalidDelegation(
      'The table, owner, delegate or consent changed. Reconnect before revoking it.',
      'STALE_VERSION',
    );
  }
  return { view: await readSeatView(code, auth), replayed: false };
}

export async function useSeatAiDelegate(
  code: string,
  auth: SeatAuth,
  version: unknown,
  input: UseSeatAiDelegateInput,
  clock: RoomsClock = roomsClock,
): Promise<{ view: GameView; replayed?: boolean }> {
  await requireRoomNotRemoved(code);
  controlVersion(version);
  if (!validUseSeatAiDelegateInput(input))
    throw invalidDelegation('Choose the current owner and AI delegation.');
  const consent = await seatAiDelegation(input.grantId);
  if (
    !consent ||
    consent.room_code !== code ||
    consent.owner_id !== input.ownerId ||
    consent.delegate_id !== auth.playerId ||
    consent.delegate_session_hash !== auth.tokenHash
  )
    throw invalidDelegation(
      'This AI delegation is not available to this seat.',
      'AI_DELEGATION_CHANGED',
    );
  if (!(await delegationSessionsActive(consent)))
    throw invalidDelegation(
      'A seat credential changed after this delegation was created.',
      'AI_DELEGATION_INVALIDATED',
    );
  if (consent.used_at !== null)
    return { view: await readSeatView(code, auth), replayed: true };
  if (consent.revoked_at !== null)
    throw invalidDelegation(
      'This AI delegation was revoked or replaced.',
      'AI_DELEGATION_CHANGED',
    );
  const now = clock.now();
  if (consent.expires_at <= now)
    throw invalidDelegation(
      'This AI delegation has expired.',
      'AI_DELEGATION_EXPIRED',
    );
  const { game: current, control } = await readRoomSnapshot(code);
  requireUnpaused(control);
  if (current.version !== version)
    throw invalidDelegation(
      'The table changed. Reconnect before activating this consent.',
      'STALE_VERSION',
    );
  const owner = current.players.find(
    (player) => player.id === consent.owner_id,
  );
  const delegate = current.players.find(
    (player) => player.id === consent.delegate_id,
  );
  if (
    (current.status !== 'setup' && current.status !== 'playing') ||
    !owner ||
    owner.bot ||
    owner.autopilot ||
    !delegate ||
    delegate.bot
  )
    throw invalidDelegation(
      'The owner is no longer available for this delegated AI activation.',
      'AI_DELEGATION_UNAVAILABLE',
    );
  const next = applyAction(current, owner.id, {
    type: 'setAutopilot',
    difficulty: consent.difficulty as Difficulty,
  });
  const entry = next.log.at(-1);
  if (entry)
    entry.text = `${delegate.name} activated ${consent.difficulty} AI for ${owner.name} using their one-use delegation.`;
  queueRoomBots(next, current, now);
  next.version = current.version + 1;
  const results = await db().batch([
    db()
      .prepare(
        `UPDATE rooms SET state = ?, version = version + 1, updated_at = ?
         WHERE code = ? AND version = ? AND NOT EXISTS (SELECT 1 FROM room_removals WHERE room_code = rooms.code AND removed = 1)
           AND NOT EXISTS (SELECT 1 FROM room_controls WHERE room_code = rooms.code AND paused = 1)
           AND EXISTS (
             SELECT 1 FROM seat_ai_delegations AS consent
             JOIN seats AS owner_session
               ON owner_session.room_code = consent.room_code
              AND owner_session.player_id = consent.owner_id
              AND owner_session.token_hash = consent.owner_session_hash
              AND owner_session.revoked = 0
             JOIN seats AS delegate_session
               ON delegate_session.room_code = consent.room_code
              AND delegate_session.player_id = consent.delegate_id
              AND delegate_session.token_hash = consent.delegate_session_hash
              AND delegate_session.revoked = 0
             WHERE consent.room_code = ? AND consent.owner_id = ?
               AND consent.delegate_id = ? AND consent.grant_id = ?
               AND consent.owner_session_hash = ? AND consent.delegate_session_hash = ?
               AND consent.expires_at > ? AND consent.used_at IS NULL
               AND consent.revoked_at IS NULL
           )`,
      )
      .bind(
        JSON.stringify(next),
        now,
        code,
        version,
        code,
        consent.owner_id,
        consent.delegate_id,
        consent.grant_id,
        consent.owner_session_hash,
        consent.delegate_session_hash,
        now,
      ),
    db()
      .prepare(
        `UPDATE seat_ai_delegations SET used_at = ?
         WHERE room_code = ? AND owner_id = ? AND delegate_id = ? AND grant_id = ?
           AND owner_session_hash = ? AND delegate_session_hash = ?
           AND expires_at > ? AND used_at IS NULL AND revoked_at IS NULL
           AND changes() = 1`,
      )
      .bind(
        now,
        code,
        consent.owner_id,
        consent.delegate_id,
        consent.grant_id,
        consent.owner_session_hash,
        consent.delegate_session_hash,
        now,
      ),
  ]);
  if (results[0].meta.changes !== 1 || results[1].meta.changes !== 1) {
    await requireRoomNotRemoved(code);
    const won = await seatAiDelegation(input.grantId);
    if (
      won?.used_at !== null &&
      won?.room_code === code &&
      won?.owner_id === input.ownerId &&
      won?.delegate_id === auth.playerId &&
      won?.delegate_session_hash === auth.tokenHash &&
      (await delegationSessionsActive(won))
    )
      return { view: await readSeatView(code, auth), replayed: true };
    throw invalidDelegation(
      'The table, owner, delegate or consent changed. Retry the exact activation after reconnecting.',
      'STALE_VERSION',
    );
  }
  return { view: await readSeatView(code, auth), replayed: false };
}

export async function setRecoveryKey(
  code: string,
  auth: SeatAuth,
  version: unknown,
  secret: unknown,
) {
  await requireRoomNotRemoved(code);
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
        'UPDATE rooms SET version = version + 1, updated_at = ? WHERE code = ? AND version = ? AND NOT EXISTS (SELECT 1 FROM room_removals WHERE room_code = rooms.code AND removed = 1) AND EXISTS (SELECT 1 FROM seats WHERE room_code = ? AND player_id = ? AND token_hash = ? AND revoked = 0)',
      )
      .bind(Date.now(), code, version, code, auth.playerId, auth.tokenHash),
    db()
      .prepare(
        'INSERT INTO seat_recovery_keys(room_code,player_id,recovery_hash) SELECT ?,?,? WHERE changes() = 1 ON CONFLICT(room_code,player_id) DO UPDATE SET recovery_hash = excluded.recovery_hash, current_operation_hash = NULL',
      )
      .bind(code, auth.playerId, recoveryHash),
  ]);
  if (results[0].meta.changes !== 1) {
    await requireRoomNotRemoved(code);
    throw new SeatControlError(
      'The table or seat changed. Reconnect before saving the recovery key.',
      'STALE_VERSION',
    );
  }
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
  await requireRoomNotRemoved(code);
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
        `SELECT rooms.state, rooms.version, ${roomControlProjection} FROM rooms LEFT JOIN room_controls c ON c.room_code = rooms.code JOIN seats ON seats.room_code = rooms.code JOIN seat_recovery_keys AS keys ON keys.room_code = seats.room_code AND keys.player_id = seats.player_id WHERE rooms.code = ? AND NOT EXISTS (SELECT 1 FROM room_removals WHERE room_code = rooms.code AND removed = 1) AND seats.player_id = ? AND seats.token_hash = ? AND seats.revoked = 0 AND keys.recovery_hash = ? AND keys.current_operation_hash = ?`,
      )
      .bind(code, playerId, sessionHash, recoveryHash, operationHash)
      .first<{ state: string; version: number } & RoomControlRow>();
    if (!row) {
      await requireRoomNotRemoved(code);
      throw new SeatControlError(
        'This recovery receipt is no longer active.',
        'RECOVERY_RECEIPT_INVALID',
      );
    }
    const g: Game = JSON.parse(row.state);
    g.version = row.version;
    const view = viewGame(g, playerId) as GameView;
    attachRoomControl(view, row);
    return {
      view,
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
        'UPDATE rooms SET version = version + 1, updated_at = ? WHERE code = ? AND version = ? AND NOT EXISTS (SELECT 1 FROM room_removals WHERE room_code = rooms.code AND removed = 1) AND EXISTS (SELECT 1 FROM seat_recovery_keys WHERE room_code = ? AND player_id = ? AND recovery_hash = ?) AND EXISTS (SELECT 1 FROM seats WHERE room_code = ? AND player_id = ? AND revoked = 0) AND NOT EXISTS (SELECT 1 FROM seat_recovery_receipts WHERE room_code = ? AND player_id = ? AND operation_hash = ?) AND NOT EXISTS (SELECT 1 FROM seats WHERE token_hash = ?)',
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
    await requireRoomNotRemoved(code);
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

export const SEAT_HANDOVER_TTL_MS = 24 * 60 * 60 * 1000;
const controlUuid = (value: unknown, message: string) => {
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
      value,
    )
  )
    throw new SeatControlError(message, 'INVALID_HANDOVER_REQUEST', 400);
  return value;
};
type HandoverClock = Pick<RoomsClock, 'now'>;
type HandoverOfferRow = Readonly<{
  offer_hash: string;
  secret_hash: string;
  issuer_session_hash: string;
  expires_at: number;
  claim_operation_hash: string | null;
  session_hash: string | null;
  claimed_at: number | null;
}>;
async function handoverOffer(code: string, playerId: string) {
  return db()
    .prepare(
      'SELECT offer_hash,secret_hash,issuer_session_hash,expires_at,claim_operation_hash,session_hash,claimed_at FROM seat_handover_offers WHERE room_code = ? AND player_id = ?',
    )
    .bind(code, playerId)
    .first<HandoverOfferRow>();
}
async function replayCreatedHandover(
  code: string,
  auth: SeatAuth,
  offerHash: string,
  secretHashValue: string,
  now: number,
) {
  const row = await db()
    .prepare(
      'SELECT offers.expires_at FROM seat_handover_offers AS offers JOIN seats ON seats.room_code = offers.room_code AND seats.player_id = offers.player_id AND seats.token_hash = offers.issuer_session_hash WHERE offers.room_code = ? AND offers.player_id = ? AND offers.offer_hash = ? AND offers.secret_hash = ? AND offers.issuer_session_hash = ? AND offers.claim_operation_hash IS NULL AND seats.revoked = 0',
    )
    .bind(code, auth.playerId, offerHash, secretHashValue, auth.tokenHash)
    .first<{ expires_at: number }>();
  if (!row) return null;
  if (row.expires_at <= now)
    throw new SeatControlError(
      'This handover offer has expired. Create a new private offer.',
      'HANDOVER_EXPIRED',
      410,
    );
  return {
    view: await readSeatView(code, auth),
    expiresAt: row.expires_at,
    replayed: true,
  };
}

export async function createSeatHandover(
  code: string,
  auth: SeatAuth,
  version: unknown,
  input: { offerId: unknown; handoverSecret: unknown },
  clock: HandoverClock = roomsClock,
) {
  await requireRoomNotRemoved(code);
  controlVersion(version);
  const offerId = controlUuid(
    input.offerId,
    'Generate a new handover offer identifier.',
  );
  const [offerHash, handoverHash] = await Promise.all([
    hash(offerId),
    secretHash(input.handoverSecret),
  ]);
  if (handoverHash === auth.tokenHash)
    throw new SeatControlError(
      'The handover secret must differ from the current session credential.',
      'INVALID_HANDOVER_REQUEST',
      400,
    );
  const now = clock.now();
  const replay = await replayCreatedHandover(
    code,
    auth,
    offerHash,
    handoverHash,
    now,
  );
  if (replay) return replay;
  const expiresAt = now + SEAT_HANDOVER_TTL_MS;
  try {
    const results = await db().batch([
      db()
        .prepare(
          'UPDATE rooms SET version = version + 1, updated_at = ? WHERE code = ? AND version = ? AND NOT EXISTS (SELECT 1 FROM room_removals WHERE room_code = rooms.code AND removed = 1) AND EXISTS (SELECT 1 FROM seats WHERE room_code = ? AND player_id = ? AND token_hash = ? AND revoked = 0) AND NOT EXISTS (SELECT 1 FROM seat_handover_offers WHERE offer_hash = ? AND (room_code != ? OR player_id != ?))',
        )
        .bind(
          now,
          code,
          version,
          code,
          auth.playerId,
          auth.tokenHash,
          offerHash,
          code,
          auth.playerId,
        ),
      db()
        .prepare(
          'INSERT INTO seat_handover_offers(room_code,player_id,offer_hash,secret_hash,issuer_session_hash,expires_at,claim_operation_hash,session_hash,claimed_at) SELECT ?,?,?,?,?,?,NULL,NULL,NULL WHERE changes() = 1 ON CONFLICT(room_code,player_id) DO UPDATE SET offer_hash = excluded.offer_hash, secret_hash = excluded.secret_hash, issuer_session_hash = excluded.issuer_session_hash, expires_at = excluded.expires_at, claim_operation_hash = NULL, session_hash = NULL, claimed_at = NULL',
        )
        .bind(
          code,
          auth.playerId,
          offerHash,
          handoverHash,
          auth.tokenHash,
          expiresAt,
        ),
    ]);
    if (results[0].meta.changes !== 1) {
      await requireRoomNotRemoved(code);
      const won = await replayCreatedHandover(
        code,
        auth,
        offerHash,
        handoverHash,
        now,
      );
      if (won) return won;
      throw new SeatControlError(
        'The table, seat, or handover offer changed. Reconnect before creating the offer.',
        'STALE_VERSION',
      );
    }
  } catch (error) {
    const won = await replayCreatedHandover(
      code,
      auth,
      offerHash,
      handoverHash,
      now,
    );
    if (won) return won;
    throw error;
  }
  return {
    view: await readSeatView(code, auth),
    expiresAt,
    replayed: false,
  };
}

export async function revokeSeatHandover(
  code: string,
  auth: SeatAuth,
  version: unknown,
  offerIdValue: unknown,
  clock: HandoverClock = roomsClock,
) {
  await requireRoomNotRemoved(code);
  controlVersion(version);
  const offerHash = await hash(
    controlUuid(offerIdValue, 'Choose the handover offer to revoke.'),
  );
  const existing = await handoverOffer(code, auth.playerId);
  if (!existing || existing.claim_operation_hash !== null) {
    return {
      view: await readSeatView(code, auth),
      revoked: true as const,
      replayed: true,
    };
  }
  if (existing.offer_hash !== offerHash)
    throw new SeatControlError(
      'A different handover offer is now current for this seat.',
      'HANDOVER_CHANGED',
    );
  const results = await db().batch([
    db()
      .prepare(
        'UPDATE rooms SET version = version + 1, updated_at = ? WHERE code = ? AND version = ? AND NOT EXISTS (SELECT 1 FROM room_removals WHERE room_code = rooms.code AND removed = 1) AND EXISTS (SELECT 1 FROM seats WHERE room_code = ? AND player_id = ? AND token_hash = ? AND revoked = 0) AND EXISTS (SELECT 1 FROM seat_handover_offers WHERE room_code = ? AND player_id = ? AND offer_hash = ? AND claim_operation_hash IS NULL)',
      )
      .bind(
        clock.now(),
        code,
        version,
        code,
        auth.playerId,
        auth.tokenHash,
        code,
        auth.playerId,
        offerHash,
      ),
    db()
      .prepare(
        'DELETE FROM seat_handover_offers WHERE room_code = ? AND player_id = ? AND offer_hash = ? AND claim_operation_hash IS NULL AND changes() = 1',
      )
      .bind(code, auth.playerId, offerHash),
  ]);
  if (results[0].meta.changes !== 1) {
    await requireRoomNotRemoved(code);
    const current = await handoverOffer(code, auth.playerId);
    if (!current)
      return {
        view: await readSeatView(code, auth),
        revoked: true as const,
        replayed: true,
      };
    throw new SeatControlError(
      'The table, seat, or handover offer changed. Reconnect before revoking it.',
      current.offer_hash === offerHash ? 'STALE_VERSION' : 'HANDOVER_CHANGED',
    );
  }
  return {
    view: await readSeatView(code, auth),
    revoked: true as const,
    replayed: false,
  };
}

type HandoverClaimReceiptRow = Readonly<{
  offer_hash: string;
  secret_hash: string;
  session_hash: string;
}>;
async function handoverClaimReceipt(
  code: string,
  playerId: string,
  operationHash: string,
) {
  return db()
    .prepare(
      'SELECT offer_hash,secret_hash,session_hash FROM seat_handover_claim_receipts WHERE room_code = ? AND player_id = ? AND operation_hash = ?',
    )
    .bind(code, playerId, operationHash)
    .first<HandoverClaimReceiptRow>();
}
async function replayClaimedHandover(
  code: string,
  playerId: string,
  offerHash: string,
  secretHashValue: string,
  operationHash: string,
  sessionHash: string,
  newSessionToken: unknown,
) {
  const row = await db()
    .prepare(
      `SELECT rooms.state,rooms.version, ${roomControlProjection} FROM rooms LEFT JOIN room_controls c ON c.room_code = rooms.code JOIN seat_handover_claim_receipts AS receipts ON receipts.room_code = rooms.code JOIN seats ON seats.room_code = receipts.room_code AND seats.player_id = receipts.player_id WHERE rooms.code = ? AND NOT EXISTS (SELECT 1 FROM room_removals WHERE room_code = rooms.code AND removed = 1) AND receipts.player_id = ? AND receipts.offer_hash = ? AND receipts.secret_hash = ? AND receipts.operation_hash = ? AND receipts.session_hash = ? AND seats.token_hash = ? AND seats.revoked = 0`,
    )
    .bind(
      code,
      playerId,
      offerHash,
      secretHashValue,
      operationHash,
      sessionHash,
      sessionHash,
    )
    .first<{ state: string; version: number } & RoomControlRow>();
  if (!row) {
    await requireRoomNotRemoved(code);
    return null;
  }
  const game: Game = JSON.parse(row.state);
  game.version = row.version;
  const view = viewGame(game, playerId) as GameView;
  attachRoomControl(view, row);
  return {
    view,
    token: newSessionToken as string,
    transferred: true as const,
    replayed: true,
  };
}

export async function claimSeatHandover(
  code: string,
  input: {
    playerId: unknown;
    offerId: unknown;
    handoverSecret: unknown;
    operationId: unknown;
    newSessionToken: unknown;
  },
  clock: HandoverClock = roomsClock,
) {
  await requireRoomNotRemoved(code);
  if (
    typeof input.playerId !== 'string' ||
    !input.playerId ||
    input.playerId.length > 100
  )
    throw new SeatControlError(
      'Provide a valid private handover kit.',
      'INVALID_HANDOVER_REQUEST',
      400,
    );
  const playerId = input.playerId;
  const offerId = controlUuid(
    input.offerId,
    'Provide a valid private handover kit.',
  );
  const operationId = controlUuid(
    input.operationId,
    'Generate a handover claim operation identifier.',
  );
  const [offerHash, handoverHash, operationHash, sessionHash] =
    await Promise.all([
      hash(offerId),
      secretHash(input.handoverSecret),
      hash(operationId),
      secretHash(input.newSessionToken),
    ]);
  if (sessionHash === handoverHash)
    throw new SeatControlError(
      'The recipient session credential must differ from the handover secret.',
      'INVALID_SESSION_TOKEN',
      400,
    );
  const replay = await replayClaimedHandover(
    code,
    playerId,
    offerHash,
    handoverHash,
    operationHash,
    sessionHash,
    input.newSessionToken,
  );
  if (replay) return replay;
  if (await handoverClaimReceipt(code, playerId, operationHash))
    throw new SeatControlError(
      'This handover claim operation is no longer active or was reused with different details.',
      'HANDOVER_RECEIPT_INVALID',
    );
  const offer = await handoverOffer(code, playerId);
  if (
    !offer ||
    offer.offer_hash !== offerHash ||
    offer.secret_hash !== handoverHash
  ) {
    const claimed = await db()
      .prepare(
        'SELECT 1 AS present FROM seat_handover_claim_receipts WHERE room_code = ? AND player_id = ? AND offer_hash = ? AND secret_hash = ?',
      )
      .bind(code, playerId, offerHash, handoverHash)
      .first();
    throw new SeatControlError(
      claimed
        ? 'This handover offer has already been claimed.'
        : 'The handover proof could not be verified.',
      claimed ? 'HANDOVER_ALREADY_CLAIMED' : 'INVALID_HANDOVER_PROOF',
    );
  }
  if (offer.claim_operation_hash !== null)
    throw new SeatControlError(
      'This handover offer has already been claimed.',
      'HANDOVER_ALREADY_CLAIMED',
    );
  const now = clock.now();
  if (offer.expires_at <= now)
    throw new SeatControlError(
      'This handover offer has expired.',
      'HANDOVER_EXPIRED',
      410,
    );
  const issuer = await db()
    .prepare(
      'SELECT 1 AS present FROM seats WHERE room_code = ? AND player_id = ? AND token_hash = ? AND revoked = 0',
    )
    .bind(code, playerId, offer.issuer_session_hash)
    .first();
  if (!issuer)
    throw new SeatControlError(
      'The handover proof could not be verified.',
      'INVALID_HANDOVER_PROOF',
    );
  if (
    await db()
      .prepare('SELECT 1 AS present FROM seats WHERE token_hash = ?')
      .bind(sessionHash)
      .first()
  )
    throw new SeatControlError(
      'Generate a new recipient session credential; this token has already been used.',
      'INVALID_SESSION_TOKEN',
    );
  const current = await readRoom(code);
  const claimFence = await hash(crypto.randomUUID());
  const results = await db().batch([
    db()
      .prepare(
        'UPDATE rooms SET version = version + 1, updated_at = ? WHERE code = ? AND version = ? AND NOT EXISTS (SELECT 1 FROM room_removals WHERE room_code = rooms.code AND removed = 1) AND EXISTS (SELECT 1 FROM seat_handover_offers WHERE room_code = ? AND player_id = ? AND offer_hash = ? AND secret_hash = ? AND issuer_session_hash = ? AND expires_at > ? AND claim_operation_hash IS NULL) AND EXISTS (SELECT 1 FROM seats WHERE room_code = ? AND player_id = ? AND token_hash = ? AND revoked = 0) AND NOT EXISTS (SELECT 1 FROM seats WHERE token_hash = ?) AND NOT EXISTS (SELECT 1 FROM seat_handover_claim_receipts WHERE room_code = ? AND player_id = ? AND operation_hash = ?)',
      )
      .bind(
        now,
        code,
        current.version,
        code,
        playerId,
        offerHash,
        handoverHash,
        offer.issuer_session_hash,
        now,
        code,
        playerId,
        offer.issuer_session_hash,
        sessionHash,
        code,
        playerId,
        operationHash,
      ),
    db()
      .prepare(
        'INSERT INTO seat_handover_claim_receipts(room_code,player_id,operation_hash,offer_hash,secret_hash,session_hash,claim_fence,claimed_at) SELECT ?,?,?,?,?,?,?,? WHERE changes() = 1',
      )
      .bind(
        code,
        playerId,
        operationHash,
        offerHash,
        handoverHash,
        sessionHash,
        claimFence,
        now,
      ),
    db()
      .prepare(
        'DELETE FROM seat_handover_offers WHERE room_code = ? AND player_id = ? AND offer_hash = ? AND secret_hash = ? AND EXISTS (SELECT 1 FROM seat_handover_claim_receipts WHERE room_code = ? AND player_id = ? AND claim_fence = ?)',
      )
      .bind(
        code,
        playerId,
        offerHash,
        handoverHash,
        code,
        playerId,
        claimFence,
      ),
    db()
      .prepare(
        'UPDATE seats SET revoked = 1 WHERE room_code = ? AND player_id = ? AND revoked = 0 AND EXISTS (SELECT 1 FROM seat_handover_claim_receipts WHERE room_code = ? AND player_id = ? AND claim_fence = ?)',
      )
      .bind(code, playerId, code, playerId, claimFence),
    db()
      .prepare(
        'INSERT INTO seats(token_hash,room_code,player_id) SELECT ?,?,? WHERE EXISTS (SELECT 1 FROM seat_handover_claim_receipts WHERE room_code = ? AND player_id = ? AND claim_fence = ?)',
      )
      .bind(sessionHash, code, playerId, code, playerId, claimFence),
    db()
      .prepare(
        'DELETE FROM seat_recovery_receipts WHERE room_code = ? AND player_id = ? AND EXISTS (SELECT 1 FROM seat_handover_claim_receipts WHERE room_code = ? AND player_id = ? AND claim_fence = ?)',
      )
      .bind(code, playerId, code, playerId, claimFence),
    db()
      .prepare(
        'DELETE FROM seat_recovery_keys WHERE room_code = ? AND player_id = ? AND EXISTS (SELECT 1 FROM seat_handover_claim_receipts WHERE room_code = ? AND player_id = ? AND claim_fence = ?)',
      )
      .bind(code, playerId, code, playerId, claimFence),
  ]);
  if (results[0].meta.changes !== 1) {
    await requireRoomNotRemoved(code);
    const won = await replayClaimedHandover(
      code,
      playerId,
      offerHash,
      handoverHash,
      operationHash,
      sessionHash,
      input.newSessionToken,
    );
    if (won) return won;
    const claimed = await db()
      .prepare(
        'SELECT 1 AS present FROM seat_handover_claim_receipts WHERE room_code = ? AND player_id = ? AND offer_hash = ? AND secret_hash = ?',
      )
      .bind(code, playerId, offerHash, handoverHash)
      .first();
    throw new SeatControlError(
      claimed
        ? 'This handover offer has already been claimed.'
        : 'The table or handover offer changed. Retry the exact claim request.',
      claimed ? 'HANDOVER_ALREADY_CLAIMED' : 'STALE_VERSION',
    );
  }
  return {
    view: await readSeatView(code, { playerId, tokenHash: sessionHash }),
    token: input.newSessionToken as string,
    transferred: true as const,
    replayed: false,
  };
}
