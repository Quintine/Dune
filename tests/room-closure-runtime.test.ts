import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID, webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { adminStore } from './admin-access-fixture';
import { adminLogin, requireAdmin } from '../db/admin-access';
import { applyAdminClosure, readAdminClosure } from '../db/admin-closure';
import { baseDeck } from '../game/cards';
import * as engine from '../game/engine';
import * as bots from '../game/bots';
import * as delegation from '../lib/seat-ai-delegation';
import { requestOrigin } from '../lib/request-origin';
import * as talkContract from '../lib/table-talk';
import type * as Rooms from '../db/rooms';
import type * as Talk from '../db/table-talk';

const secret = () => randomBytes(32).toString('hex');
const entry = () => ({ operationId: randomUUID(), sessionToken: secret() });
const closed = (error: unknown) =>
  !!error &&
  typeof error === 'object' &&
  'code' in error &&
  error.code === 'ROOM_CLOSED' &&
  'status' in error &&
  error.status === 409;
const draft = (recipientId: string | null = null) => ({
  id: randomUUID(),
  recipientId,
  text: 'Retained discussion for the same saved seat.',
});

type Values = (string | number | null)[];
async function fixture(started = false) {
  const store = adminStore();
  assert.ok(store.sqlite instanceof DatabaseSync);
  const account = store.provision('operator');
  const login = await adminLogin(store.database, account.key);
  const identity = await requireAdmin(store.database, login.token);
  const calls = { bots: 0, normalization: 0, views: 0 };
  const hooks: {
    beforeFirst?: (sql: string, values: Values) => void;
    beforeRun?: (sql: string, values: Values) => void;
  } = {};
  const database = {
    batch: (statements: D1PreparedStatement[]) =>
      store.database.batch(statements),
    prepare(sql: string) {
      const statement = store.database.prepare(sql);
      const first = statement.first.bind(statement);
      const run = statement.run.bind(statement);
      const bind = statement.bind.bind(statement);
      let values: Values = [];
      statement.bind = (...input: Values) => {
        values = input;
        return bind(...input);
      };
      statement.first = async <T>() => {
        hooks.beforeFirst?.(sql, values);
        return first<T>();
      };
      statement.run = async <T>() => {
        hooks.beforeRun?.(sql, values);
        return run<T>();
      };
      return statement;
    },
  } as D1Database;
  function load<T>(file: string) {
    const exports = {};
    runInNewContext(
      ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
        },
      }).outputText,
      {
        exports,
        crypto: webcrypto,
        TextEncoder,
        structuredClone,
        JSON,
        require: (name: string) => {
          if (name === 'cloudflare:workers') return { env: { DB: database } };
          if (name === '@/game/engine')
            return {
              ...engine,
              viewGame: (...args: Parameters<typeof engine.viewGame>) => {
                calls.views++;
                return engine.viewGame(...args);
              },
              normalizeAutomaticGame: (
                ...args: Parameters<typeof engine.normalizeAutomaticGame>
              ) => {
                calls.normalization++;
                return engine.normalizeAutomaticGame(...args);
              },
            };
          if (name === '@/game/bots')
            return {
              ...bots,
              runBots: (...args: Parameters<typeof bots.runBots>) => {
                calls.bots++;
                return bots.runBots(...args);
              },
            };
          if (name === '@/lib/seat-ai-delegation') return delegation;
          if (name === '../lib/table-talk') return talkContract;
          throw new Error('Unexpected dependency ' + name);
        },
      },
    );
    return exports as T;
  }
  const rooms = load<typeof Rooms>('../db/rooms.ts');
  const talk = load<typeof Talk>('../db/table-talk.ts');
  const ownerEntry = entry(),
    guestEntry = entry();
  const owner = await rooms.createRoom(
    'Closure owner',
    'atreides',
    false,
    [],
    ownerEntry,
  );
  const code = owner.view.code;
  const guest = await rooms.joinRoom(
    code,
    'Closure guest',
    'emperor',
    guestEntry,
  );
  const auth = await rooms.authenticate(code, owner.token);
  const guestAuth = await rooms.authenticate(code, guest.token!);
  let now = 10000;
  const clock = {
    now: () => now,
    advance: (ms: number) => {
      now += ms;
    },
    sleep: async (ms: number) => {
      now += ms;
    },
  };
  const version = () =>
    Number(
      store.sqlite
        .prepare('SELECT version FROM rooms WHERE code = ?')
        .get(code)!.version,
    );
  if (started) {
    for (const seat of [auth, guestAuth])
      await rooms.act(code, seat, version(), { type: 'ready' }, clock);
    await rooms.act(code, auth, version(), { type: 'start' }, clock);
  }
  const transition = async (closed: boolean, roomCode = code) => {
    const view = await readAdminClosure(database, identity, roomCode, now);
    return applyAdminClosure(
      database,
      identity,
      roomCode,
      {
        operationId: randomUUID(),
        expectedVersion: view.version,
        expectedRevision: view.revision,
        closed,
        reason: 'Dedicated recoverable closure runtime QA',
      },
      now,
    );
  };
  // Deliberately retain the old game version to prove the SQL closure predicate itself,
  // independently of the additional version bump made by the real admin transaction.
  const flagClosed = (roomCode = code) =>
    store.sqlite
      .prepare(
        'INSERT INTO room_closures(room_code,closed,revision,closed_at,updated_at) VALUES (?,1,1,10000,10000)',
      )
      .run(roomCode);
  const snapshot = () =>
    Object.fromEntries(
      [
        'rooms',
        'seats',
        'room_entry_receipts',
        'seat_recovery_keys',
        'seat_recovery_receipts',
        'seat_handover_offers',
        'seat_handover_claim_receipts',
        'seat_ai_delegations',
        'room_messages',
        'room_controls',
        'room_closures',
      ].map((table) => [
        table,
        store.sqlite
          .prepare('SELECT * FROM ' + table + ' ORDER BY rowid')
          .all(),
      ]),
    );
  return {
    ...store,
    rooms,
    talk,
    hooks,
    calls,
    code,
    owner,
    ownerEntry,
    guest,
    guestEntry,
    auth,
    guestAuth,
    clock,
    version,
    transition,
    flagClosed,
    snapshot,
    restart: () => load<typeof Rooms>('../db/rooms.ts'),
  };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
const grant = (f: Fixture) => ({
  grantId: randomUUID(),
  delegateId: f.guestAuth.playerId,
  difficulty: 'Hard' as const,
});
const offer = () => ({ offerId: randomUUID(), handoverSecret: secret() });
const recovery = (f: Fixture, recoverySecret: string) => ({
  playerId: f.auth.playerId,
  recoverySecret,
  operationId: randomUUID(),
  newSessionToken: secret(),
});

for (const kind of [
  'join',
  'action',
  'takeback',
  'grant',
  'revoke grant',
  'activate grant',
  'recovery key',
  'recovery',
  'create handover',
  'revoke handover',
  'claim handover',
  'discussion send',
] as const) {
  void test(`${kind} commit fence rejects closure without changing state, credentials or receipts`, async () => {
    const f = await fixture(kind !== 'join' && kind !== 'action');
    try {
      const consent = grant(f),
        handover = offer(),
        recoverySecret = secret();
      if (kind === 'revoke grant' || kind === 'activate grant')
        await f.rooms.setSeatAiDelegate(
          f.code,
          f.auth,
          f.version(),
          consent,
          f.clock,
        );
      if (kind === 'recovery')
        await f.rooms.setRecoveryKey(
          f.code,
          f.auth,
          f.version(),
          recoverySecret,
        );
      if (kind === 'revoke handover' || kind === 'claim handover')
        await f.rooms.createSeatHandover(
          f.code,
          f.auth,
          f.version(),
          handover,
          f.clock,
        );
      if (kind === 'takeback')
        await f.rooms.act(
          f.code,
          f.auth,
          f.version(),
          { type: 'setAutopilot', difficulty: 'Hard' },
          f.clock,
        );
      let expected: ReturnType<typeof f.snapshot> | undefined;
      f.hooks.beforeRun = (sql) => {
        if (
          !sql.startsWith(
            kind === 'discussion send'
              ? 'INSERT INTO room_messages'
              : 'UPDATE rooms',
          )
        )
          return;
        delete f.hooks.beforeRun;
        f.flagClosed();
        expected = f.snapshot();
      };
      const operations = {
        join: () => f.rooms.joinRoom(f.code, 'Racing guest', 'guild', entry()),
        action: () =>
          f.rooms.act(f.code, f.auth, f.version(), { type: 'ready' }, f.clock),
        takeback: () =>
          f.rooms.act(
            f.code,
            f.auth,
            f.version(),
            { type: 'setAutopilot', difficulty: null },
            f.clock,
          ),
        grant: () =>
          f.rooms.setSeatAiDelegate(
            f.code,
            f.auth,
            f.version(),
            consent,
            f.clock,
          ),
        'revoke grant': () =>
          f.rooms.revokeSeatAiDelegate(
            f.code,
            f.auth,
            f.version(),
            consent.grantId,
            f.clock,
          ),
        'activate grant': () =>
          f.rooms.useSeatAiDelegate(
            f.code,
            f.guestAuth,
            f.version(),
            { ownerId: f.auth.playerId, grantId: consent.grantId },
            f.clock,
          ),
        'recovery key': () =>
          f.rooms.setRecoveryKey(f.code, f.auth, f.version(), recoverySecret),
        recovery: () =>
          f.rooms.recoverSeat(f.code, recovery(f, recoverySecret)),
        'create handover': () =>
          f.rooms.createSeatHandover(
            f.code,
            f.auth,
            f.version(),
            handover,
            f.clock,
          ),
        'revoke handover': () =>
          f.rooms.revokeSeatHandover(
            f.code,
            f.auth,
            f.version(),
            handover.offerId,
            f.clock,
          ),
        'claim handover': () =>
          f.rooms.claimSeatHandover(
            f.code,
            {
              playerId: f.auth.playerId,
              ...handover,
              operationId: randomUUID(),
              newSessionToken: secret(),
            },
            f.clock,
          ),
        'discussion send': () =>
          f.talk.sendTableTalk(f.code, f.auth, draft(), 1000),
      };
      await assert.rejects(operations[kind](), closed);
      assert.ok(expected);
      assert.deepEqual(f.snapshot(), expected);
    } finally {
      f.sqlite.close();
    }
  });
}

void test('sleeping AI rechecks closure before computing and reopened AI retains normal pacing', async () => {
  const f = await fixture(true);
  try {
    await f.rooms.act(
      f.code,
      f.auth,
      f.version(),
      { type: 'setAutopilot', difficulty: 'Hard' },
      f.clock,
    );
    const clock = {
      now: f.clock.now,
      sleep: async (ms: number) => {
        await f.transition(true);
        f.clock.advance(ms);
      },
    };
    await f.rooms.continueRoomBots(f.code, 1, clock);
    assert.equal(f.calls.bots, 0);
    const before = f.snapshot();
    await f.rooms.continueRoomAutomatic(f.code, f.clock);
    await f.restart().continueRoomBots(f.code, 4, f.clock);
    assert.deepEqual(f.snapshot(), before);
    f.clock.advance(50000);
    await f.transition(false);
    assert.equal(
      (await f.rooms.readRoom(f.code)).botNextActionAt,
      f.clock.now() + 1500,
    );
    await f.rooms.continueRoomBots(f.code, 1, f.clock);
    assert.equal(f.calls.bots, 1);
  } finally {
    f.sqlite.close();
  }
});

for (const kind of ['AI', 'automatic normalization'] as const) {
  void test(`${kind} discards computed work when closure wins its final SQL fence`, async () => {
    const f = await fixture(kind === 'AI');
    try {
      if (kind === 'AI') {
        await f.rooms.act(
          f.code,
          f.auth,
          f.version(),
          { type: 'setAutopilot', difficulty: 'Hard' },
          f.clock,
        );
        f.clock.advance(1500);
      } else {
        const game = await f.rooms.readRoom(f.code);
        game.players[0] = engine.newPlayer(f.auth.playerId, 'CHOAM', 'choam');
        game.players.push(engine.newPlayer('guild', 'Guild', 'guild'));
        Object.assign(game, {
          status: 'playing',
          phase: 3,
          turn: 2,
          order: game.players.map((p) => p.id),
          active: f.auth.playerId,
          auction: null,
          response: null,
          deck: baseDeck(),
          discard: [],
          choamMarket: { owner: f.auth.playerId, resume: 'phase', blocked: [] },
          decision: { kind: 'choamMarket', player: f.auth.playerId },
          aid: { [f.auth.playerId]: { recipient: 'emperor', amount: 2 } },
        });
        for (const player of game.players) {
          player.hand = [];
          player.spice = 10;
        }
        f.sqlite
          .prepare('UPDATE rooms SET state = ? WHERE code = ?')
          .run(JSON.stringify(game), f.code);
      }
      let expected: ReturnType<typeof f.snapshot> | undefined;
      f.hooks.beforeRun = (sql) => {
        if (!sql.startsWith('UPDATE rooms')) return;
        delete f.hooks.beforeRun;
        f.flagClosed();
        expected = f.snapshot();
      };
      if (kind === 'AI') await f.rooms.continueRoomBots(f.code, 4, f.clock);
      else await f.rooms.continueRoomAutomatic(f.code, f.clock);
      assert.ok(expected);
      assert.deepEqual(f.snapshot(), expected);
      assert.equal(kind === 'AI' ? f.calls.bots : f.calls.normalization, 1);
    } finally {
      f.sqlite.close();
    }
  });
}

void test('closed rooms retain private views, history and committed entry/offer/message receipts while all new mutations stop', async () => {
  const f = await fixture(true);
  try {
    const consent = grant(f), handover = offer(), recoverySecret = secret();
    await f.rooms.setSeatAiDelegate(f.code, f.auth, f.version(), consent, f.clock);
    await f.rooms.setRecoveryKey(f.code, f.auth, f.version(), recoverySecret);
    await f.rooms.createSeatHandover(f.code, f.auth, f.version(), handover, f.clock);
    const message = draft(f.guestAuth.playerId);
    await f.talk.sendTableTalk(f.code, f.auth, message, 1000);
    const original = await f.rooms.readSeatView(f.code, f.auth);
    assert.equal(original.roomControl, undefined);
    await f.transition(true);
    const before = f.snapshot();
    assert.deepEqual(await f.rooms.authenticate(f.code, f.owner.token), f.auth);
    const view = await f.rooms.readSeatView(f.code, f.auth);
    assert.deepEqual(view.roomControl, { paused: false, joinLocked: false, closed: true, revision: 0, updatedAt: null });
    const { roomControl: _control, ...rest } = view;
    assert.deepEqual({ ...rest, version: original.version }, original);
    assert.equal((await f.talk.readTableTalk(f.code, f.auth, f.guestAuth.playerId)).messages[0].text, message.text);
    assert.equal((await f.talk.sendTableTalk(f.code, f.auth, message, 1000)).replayed, true);
    assert.equal((await f.rooms.createRoom('Closure owner', 'atreides', false, [], f.ownerEntry)).entryReceipt?.replayed, true);
    assert.equal((await f.rooms.joinRoom(f.code, 'Closure guest', 'emperor', f.guestEntry)).entryReceipt?.replayed, true);
    assert.equal((await f.rooms.joinRoom(f.code, 'Any name', 'guild', undefined, f.auth)).view.me, f.auth.playerId);
    assert.equal((await f.rooms.createSeatHandover(f.code, f.auth, f.version(), handover, f.clock)).replayed, true);
    assert.equal((await f.rooms.setSeatAiDelegate(f.code, f.auth, f.version(), consent, f.clock)).replayed, true);
    for (const action of [
      () => f.rooms.joinRoom(f.code, 'New guest', 'guild', entry()),
      () => f.rooms.act(f.code, f.auth, f.version(), { type: 'advanceBots' }, f.clock),
      () => f.rooms.act(f.code, f.auth, f.version(), { type: 'setAutopilot', difficulty: null }, f.clock),
      () => f.rooms.setSeatAiDelegate(f.code, f.auth, f.version(), grant(f), f.clock),
      () => f.rooms.revokeSeatAiDelegate(f.code, f.auth, f.version(), consent.grantId, f.clock),
      () => f.rooms.useSeatAiDelegate(f.code, f.guestAuth, f.version(), { ownerId: f.auth.playerId, grantId: consent.grantId }, f.clock),
      () => f.rooms.setRecoveryKey(f.code, f.auth, f.version(), secret()),
      () => f.rooms.recoverSeat(f.code, recovery(f, recoverySecret)),
      () => f.rooms.createSeatHandover(f.code, f.auth, f.version(), offer(), f.clock),
      () => f.rooms.revokeSeatHandover(f.code, f.auth, f.version(), handover.offerId, f.clock),
      () => f.rooms.claimSeatHandover(f.code, { playerId: f.auth.playerId, ...handover, operationId: randomUUID(), newSessionToken: secret() }, f.clock),
      () => f.talk.sendTableTalk(f.code, f.auth, draft(), 3000),
    ]) await assert.rejects(action(), closed);
    assert.deepEqual(f.snapshot(), before);
    await f.transition(false);
    assert.deepEqual({ ...await f.rooms.readSeatView(f.code, f.auth), version: original.version }, original);
  } finally { f.sqlite.close(); }
});

void test('completed recovery and handover confirm while closed without rotating again or reviving old credentials', async () => {
  const f = await fixture();
  try {
    const recoverySecret = secret();
    await f.rooms.setRecoveryKey(f.code, f.guestAuth, f.version(), recoverySecret);
    const recovering = { ...recovery(f, recoverySecret), playerId: f.guestAuth.playerId };
    const recovered = await f.rooms.recoverSeat(f.code, recovering);
    const handover = offer();
    await f.rooms.createSeatHandover(f.code, f.auth, f.version(), handover, f.clock);
    const claiming = { playerId: f.auth.playerId, ...handover, operationId: randomUUID(), newSessionToken: secret() };
    const claimed = await f.rooms.claimSeatHandover(f.code, claiming, f.clock);
    await f.transition(true);
    const before = f.snapshot();
    const recoveredAgain = await f.restart().recoverSeat(f.code, recovering);
    const claimedAgain = await f.restart().claimSeatHandover(f.code, claiming, f.clock);
    assert.equal(recoveredAgain.replayed, true); assert.equal(recoveredAgain.token, recovered.token);
    assert.equal(claimedAgain.replayed, true); assert.equal(claimedAgain.token, claimed.token);
    assert.equal(recoveredAgain.view.roomControl?.closed, true); assert.equal(claimedAgain.view.roomControl?.closed, true);
    for (const token of [f.owner.token, f.guest.token!]) await assert.rejects(f.rooms.authenticate(f.code, token), /could not be verified/);
    assert.deepEqual(f.snapshot(), before);
    await f.transition(false);
    for (const token of [f.owner.token, f.guest.token!]) await assert.rejects(f.rooms.authenticate(f.code, token), /could not be verified/);
  } finally { f.sqlite.close(); }
});

void test('an already used AI grant remains a read-only receipt while closure blocks taking control back', async () => {
  const f = await fixture(true);
  try {
    const consent = grant(f);
    await f.rooms.setSeatAiDelegate(f.code, f.auth, f.version(), consent, f.clock);
    const activate = { ownerId: f.auth.playerId, grantId: consent.grantId };
    await f.rooms.useSeatAiDelegate(f.code, f.guestAuth, f.version(), activate, f.clock);
    await f.transition(true);
    const before = f.snapshot();
    assert.equal((await f.rooms.useSeatAiDelegate(f.code, f.guestAuth, f.version(), activate, f.clock)).replayed, true);
    await assert.rejects(f.rooms.act(f.code, f.auth, f.version(), { type: 'setAutopilot', difficulty: null }, f.clock), closed);
    assert.deepEqual(f.snapshot(), before);
  } finally { f.sqlite.close(); }
});

void test('closed HTTP reads and exact delegation receipts do not schedule automatic or AI workers', async () => {
  const f = await fixture(true);
  try {
    const consent = grant(f), activation = { ownerId: f.auth.playerId, grantId: '' };
    await f.rooms.setSeatAiDelegate(f.code, f.auth, f.version(), consent, f.clock);
    activation.grantId = consent.grantId;
    await f.rooms.useSeatAiDelegate(f.code, f.guestAuth, f.version(), activation, f.clock);
    await f.transition(true);
    const before = f.snapshot();
    let scheduled = 0;
    function route(control: boolean) {
      const exports: Record<string, (req: Request) => Promise<Response>> = {};
      runInNewContext(ts.transpileModule(readFileSync(new URL(control ? '../app/api/rooms/[code]/control/route.ts' : '../app/api/rooms/[code]/route.ts', import.meta.url), 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
      }).outputText, { exports, URL, Response, JSON, require: (name: string) => {
        if (name === '@/db/rooms') return f.rooms;
        if (name === '@/db/room-continuation') return { resumeRoom: async () => { assert.fail('Closed room scheduled a worker.'); } };
        if (name === '@/game/engine') return engine;
        if (name === '@/lib/request-origin') return { requestOrigin };
        if (name === '@/lib/seat-ai-delegation') return delegation;
        if (name === 'cloudflare:workers') return { env: {}, waitUntil: () => { scheduled++; } };
        throw new Error('Unexpected route dependency ' + name);
      } });
      return exports;
    }
    const path = `http://localhost/api/rooms/${f.code}`;
    const headers = { cookie: `dune_${f.code}=${f.guest.token}`, origin: 'http://localhost', 'content-type': 'application/json' };
    const read = await route(false).GET(new Request(path, { headers }));
    assert.equal(read.status, 200);
    assert.equal((await read.json() as { roomControl: { closed: boolean } }).roomControl.closed, true);
    const replay = await route(true).POST(new Request(path + '/control', { method: 'POST', headers, body: JSON.stringify({ type: 'useSeatAiDelegate', version: f.version(), ...activation }) }));
    assert.equal(replay.status, 200);
    assert.equal((await replay.json() as { replayed: boolean }).replayed, true);
    const blocked = await route(false).POST(new Request(path, { method: 'POST', headers, body: JSON.stringify({ version: f.version(), action: { type: 'advanceBots' } }) }));
    assert.equal(blocked.status, 409);
    assert.equal(scheduled, 0); assert.deepEqual(f.snapshot(), before);
  } finally { f.sqlite.close(); }
});
