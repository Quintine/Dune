import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID, webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { adminStore } from './admin-access-fixture';
import { adminLogin, requireAdmin } from '../db/admin-access';
import { applyAdminRemoval, readAdminRemoval } from '../db/admin-removal';
import * as engine from '../game/engine';
import * as bots from '../game/bots';
import { baseDeck } from '../game/cards';
import * as delegation from '../lib/seat-ai-delegation';
import * as talkContract from '../lib/table-talk';
import type * as Rooms from '../db/rooms';
import type * as Talk from '../db/table-talk';

const secret = () => randomBytes(32).toString('hex');
const entry = () => ({ operationId: randomUUID(), sessionToken: secret() });
const removed = (error: unknown) =>
  !!error &&
  typeof error === 'object' &&
  'code' in error &&
  error.code === 'ROOM_REMOVED' &&
  'status' in error &&
  error.status === 410;
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
    'Removal owner',
    'atreides',
    false,
    [],
    ownerEntry,
  );
  const code = owner.view.code;
  const guest = await rooms.joinRoom(
    code,
    'Removal guest',
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
  const transition = async (removed: boolean, roomCode = code) => {
    const view = await readAdminRemoval(database, identity, roomCode, now);
    return applyAdminRemoval(
      database,
      identity,
      roomCode,
      {
        operationId: randomUUID(),
        expectedVersion: view.version,
        expectedRevision: view.revision,
        removed,
        reason: 'Dedicated recoverable removal runtime QA',
      },
      now,
    );
  };
  // Deliberately retain the old game version to prove the SQL removal predicate itself,
  // independently of the additional version bump made by the real admin transaction.
  const flagRemoved = (roomCode = code) =>
    store.sqlite
      .prepare(
        'INSERT INTO room_removals(room_code,removed,revision,removed_at,updated_at) VALUES (?,1,1,10000,10000)',
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
        'room_removals',
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
    flagRemoved,
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

void test('an invitation without a saved cookie reports removal and retains the ordinary active-room join error', async () => {
  const f = await fixture();
  try {
    await assert.rejects(
      f.rooms.authenticate(f.code, ''),
      /Join this room first\./,
    );
    await f.transition(true);
    const before = f.snapshot(),
      calls = { ...f.calls };
    await assert.rejects(f.rooms.authenticate(f.code, ''), removed);
    assert.deepEqual(f.snapshot(), before);
    assert.deepEqual(f.calls, calls);
    await f.transition(false);
    await assert.rejects(
      f.rooms.authenticate(f.code, ''),
      /Join this room first\./,
    );
  } finally {
    f.sqlite.close();
  }
});

void test('removed rooms deny private access, entry receipts, every seat control and discussion without invalidating proofs', async () => {
  const f = await fixture(true);
  try {
    const consent = grant(f),
      handover = offer(),
      recoverySecret = secret();
    await f.rooms.setSeatAiDelegate(
      f.code,
      f.auth,
      f.version(),
      consent,
      f.clock,
    );
    await f.rooms.setRecoveryKey(f.code, f.auth, f.version(), recoverySecret);
    await f.rooms.createSeatHandover(
      f.code,
      f.auth,
      f.version(),
      handover,
      f.clock,
    );
    const message = draft(f.guestAuth.playerId);
    await f.talk.sendTableTalk(f.code, f.auth, message, 1000);
    await f.transition(true);
    const before = f.snapshot(),
      views = f.calls.views;
    const attempts = [
      () => f.rooms.authenticate(f.code, f.owner.token),
      () => f.rooms.readRoom(f.code),
      () => f.rooms.readSeatView(f.code, f.auth),
      () =>
        f.rooms.createRoom(
          'Removal owner',
          'atreides',
          false,
          [],
          f.ownerEntry,
        ),
      () => f.rooms.joinRoom(f.code, 'Removal guest', 'emperor', f.guestEntry),
      () => f.rooms.joinRoom(f.code, 'New name', 'guild', undefined, f.auth),
      () => f.rooms.joinRoom(f.code, 'New guest', 'guild', entry()),
      () =>
        f.rooms.act(
          f.code,
          f.auth,
          f.version(),
          { type: 'setAutopilot', difficulty: null },
          f.clock,
        ),
      () =>
        f.rooms.act(
          f.code,
          f.auth,
          f.version(),
          { type: 'advanceBots' },
          f.clock,
        ),
      () =>
        f.rooms.setSeatAiDelegate(
          f.code,
          f.auth,
          f.version(),
          consent,
          f.clock,
        ),
      () =>
        f.rooms.revokeSeatAiDelegate(
          f.code,
          f.auth,
          f.version(),
          consent.grantId,
          f.clock,
        ),
      () =>
        f.rooms.useSeatAiDelegate(
          f.code,
          f.guestAuth,
          f.version(),
          { ownerId: f.auth.playerId, grantId: consent.grantId },
          f.clock,
        ),
      () => f.rooms.setRecoveryKey(f.code, f.auth, f.version(), secret()),
      () => f.rooms.recoverSeat(f.code, recovery(f, recoverySecret)),
      () =>
        f.rooms.createSeatHandover(
          f.code,
          f.auth,
          f.version(),
          handover,
          f.clock,
        ),
      () =>
        f.rooms.revokeSeatHandover(
          f.code,
          f.auth,
          f.version(),
          handover.offerId,
          f.clock,
        ),
      () =>
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
      () => f.talk.readTableTalk(f.code, f.auth, f.guestAuth.playerId),
      () => f.talk.sendTableTalk(f.code, f.auth, message, 1000),
      () => f.talk.sendTableTalk(f.code, f.auth, draft(), 3000),
    ];
    for (const attempt of attempts) await assert.rejects(attempt(), removed);
    assert.deepEqual(f.snapshot(), before);
    assert.equal(f.calls.views, views);
    await f.transition(false);
    assert.equal(
      (
        await f.rooms.createRoom(
          'Removal owner',
          'atreides',
          false,
          [],
          f.ownerEntry,
        )
      ).entryReceipt?.replayed,
      true,
    );
    assert.equal(
      (await f.rooms.joinRoom(f.code, 'Removal guest', 'emperor', f.guestEntry))
        .entryReceipt?.replayed,
      true,
    );
    assert.equal(
      (
        await f.rooms.createSeatHandover(
          f.code,
          f.auth,
          f.version(),
          handover,
          f.clock,
        )
      ).replayed,
      true,
    );
    assert.equal(
      (await f.talk.sendTableTalk(f.code, f.auth, message, 1000)).replayed,
      true,
    );
    assert.equal(
      (await f.talk.readTableTalk(f.code, f.auth, f.guestAuth.playerId))
        .messages[0].text,
      message.text,
    );
  } finally {
    f.sqlite.close();
  }
});

void test('removed malformed game JSON is never parsed or computed by private reads and restarted workers', async () => {
  const f = await fixture();
  try {
    await f.transition(true);
    f.sqlite
      .prepare('UPDATE rooms SET state = ? WHERE code = ?')
      .run('not game JSON', f.code);
    const before = f.snapshot(),
      calls = { ...f.calls };
    for (const operation of [
      () => f.rooms.readRoom(f.code),
      () => f.rooms.readSeatView(f.code, f.auth),
      () => f.talk.readTableTalk(f.code, f.auth, null),
      () => f.talk.sendTableTalk(f.code, f.auth, draft(), 1000),
    ])
      await assert.rejects(operation(), removed);
    const noSleep = {
      now: f.clock.now,
      sleep: async () => {
        assert.fail('A removed room must not sleep.');
      },
    };
    await f.restart().continueRoomBots(f.code, 4, noSleep);
    await f.restart().continueRoomAutomatic(f.code, noSleep);
    assert.deepEqual(f.snapshot(), before);
    assert.deepEqual(f.calls, calls);
  } finally {
    f.sqlite.close();
  }
});

for (const kind of [
  'authentication',
  'raw state',
  'seat view',
  'discussion read',
  'discussion receipt',
] as const) {
  void test(`${kind} SQL excludes a removal racing the last private query`, async () => {
    const f = await fixture();
    try {
      const message = draft();
      await f.talk.sendTableTalk(f.code, f.auth, message, 1000);
      const match = {
        authentication: 'SELECT player_id FROM seats',
        'raw state': 'SELECT state,version',
        'seat view': 'SELECT rooms.state',
        'discussion read': 'SELECT (',
        'discussion receipt': 'SELECT 1 AS accepted',
      }[kind];
      let expected: ReturnType<typeof f.snapshot> | undefined;
      f.hooks.beforeFirst = (sql) => {
        if (!sql.startsWith(match)) return;
        delete f.hooks.beforeFirst;
        f.flagRemoved();
        expected = f.snapshot();
      };
      const operations = {
        authentication: () => f.rooms.authenticate(f.code, f.owner.token),
        'raw state': () => f.rooms.readRoom(f.code),
        'seat view': () => f.rooms.readSeatView(f.code, f.auth),
        'discussion read': () => f.talk.readTableTalk(f.code, f.auth, null),
        'discussion receipt': () =>
          f.talk.sendTableTalk(f.code, f.auth, message, 1000),
      };
      const views = f.calls.views;
      await assert.rejects(operations[kind](), removed);
      assert.ok(expected);
      assert.deepEqual(f.snapshot(), expected);
      assert.equal(f.calls.views, views);
    } finally {
      f.sqlite.close();
    }
  });
}

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
  void test(`${kind} commit fence rejects removal without changing state, credentials or receipts`, async () => {
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
        f.flagRemoved();
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
      await assert.rejects(operations[kind](), removed);
      assert.ok(expected);
      assert.deepEqual(f.snapshot(), expected);
    } finally {
      f.sqlite.close();
    }
  });
}

void test('completed recovery and handover receipts survive removal, but restore never revives revoked sessions or keys', async () => {
  const f = await fixture(true);
  try {
    const consent = grant(f),
      ownerKey = secret(),
      guestKey = secret(),
      handover = offer();
    await f.rooms.setSeatAiDelegate(
      f.code,
      f.auth,
      f.version(),
      consent,
      f.clock,
    );
    await f.rooms.setRecoveryKey(f.code, f.auth, f.version(), ownerKey);
    await f.rooms.setRecoveryKey(f.code, f.guestAuth, f.version(), guestKey);
    const recovering = {
      ...recovery(f, guestKey),
      playerId: f.guestAuth.playerId,
    };
    const recovered = await f.rooms.recoverSeat(f.code, recovering);
    await f.rooms.createSeatHandover(
      f.code,
      f.auth,
      f.version(),
      handover,
      f.clock,
    );
    const claiming = {
      playerId: f.auth.playerId,
      ...handover,
      operationId: randomUUID(),
      newSessionToken: secret(),
    };
    const claimed = await f.rooms.claimSeatHandover(f.code, claiming, f.clock);
    const ownerAuth = await f.rooms.authenticate(f.code, claimed.token);
    const guestAuth = await f.rooms.authenticate(f.code, recovered.token);
    const message = draft(guestAuth.playerId);
    await f.talk.sendTableTalk(f.code, ownerAuth, message, 1000);
    const baseline = f.snapshot();
    await f.transition(true);
    for (const operation of [
      () => f.rooms.recoverSeat(f.code, recovering),
      () => f.rooms.claimSeatHandover(f.code, claiming, f.clock),
    ])
      await assert.rejects(operation(), removed);
    await f.transition(false);
    const after = f.snapshot();
    for (const key of Object.keys(baseline).filter(
      (key) => key !== 'rooms' && key !== 'room_removals',
    ))
      assert.deepEqual(after[key], baseline[key]);
    assert.equal(
      (await f.rooms.recoverSeat(f.code, recovering)).replayed,
      true,
    );
    assert.equal(
      (await f.rooms.claimSeatHandover(f.code, claiming, f.clock)).replayed,
      true,
    );
    assert.equal(
      (await f.talk.sendTableTalk(f.code, ownerAuth, message, 1000)).replayed,
      true,
    );
    for (const old of [f.owner, f.guest])
      await assert.rejects(
        f.rooms.authenticate(f.code, old.token!),
        /could not be verified/,
      );
    await assert.rejects(
      f.rooms.recoverSeat(f.code, recovery(f, ownerKey)),
      /proof could not be verified/,
    );
    await assert.rejects(
      f.rooms.useSeatAiDelegate(
        f.code,
        guestAuth,
        f.version(),
        { ownerId: ownerAuth.playerId, grantId: consent.grantId },
        f.clock,
      ),
    );
    assert.equal(
      (await f.rooms.readSeatView(f.code, ownerAuth)).seatAiDelegations,
      undefined,
    );
  } finally {
    f.sqlite.close();
  }
});

for (const kind of ['recovery', 'handover'] as const) {
  void test(`${kind} exact receipt query fences removal after its preliminary proof checks`, async () => {
    const f = await fixture();
    try {
      const recoverySecret = secret(),
        handover = offer();
      await f.rooms.setRecoveryKey(f.code, f.auth, f.version(), recoverySecret);
      const recovering = recovery(f, recoverySecret);
      const claiming = {
        playerId: f.auth.playerId,
        ...handover,
        operationId: randomUUID(),
        newSessionToken: secret(),
      };
      if (kind === 'recovery') await f.rooms.recoverSeat(f.code, recovering);
      else {
        await f.rooms.createSeatHandover(
          f.code,
          f.auth,
          f.version(),
          handover,
          f.clock,
        );
        await f.rooms.claimSeatHandover(f.code, claiming, f.clock);
      }
      let expected: ReturnType<typeof f.snapshot> | undefined;
      f.hooks.beforeFirst = (sql) => {
        if (!sql.startsWith('SELECT rooms.state')) return;
        delete f.hooks.beforeFirst;
        f.flagRemoved();
        expected = f.snapshot();
      };
      const views = f.calls.views;
      await assert.rejects(
        kind === 'recovery'
          ? f.rooms.recoverSeat(f.code, recovering)
          : f.rooms.claimSeatHandover(f.code, claiming, f.clock),
        removed,
      );
      assert.ok(expected);
      assert.deepEqual(f.snapshot(), expected);
      assert.equal(f.calls.views, views);
    } finally {
      f.sqlite.close();
    }
  });
}

void test('entry committed before removal keeps its exact retry proof through temporary rejection and restoration', async () => {
  const f = await fixture();
  try {
    const pendingEntry = entry();
    let code: string | undefined;
    f.hooks.beforeFirst = (sql, values) => {
      if (!sql.startsWith('SELECT rooms.state')) return;
      delete f.hooks.beforeFirst;
      code = String(values[0]);
      f.flagRemoved(code);
    };
    await assert.rejects(
      f.rooms.createRoom(
        'Uncertain creation',
        'guild',
        false,
        [],
        pendingEntry,
      ),
      removed,
    );
    assert.ok(code);
    assert.equal(
      f.sqlite.prepare('SELECT COUNT(*) AS n FROM room_entry_receipts').get()!
        .n,
      3,
    );
    await f.transition(false, code);
    const replay = await f.rooms.createRoom(
      'Uncertain creation',
      'guild',
      false,
      [],
      pendingEntry,
    );
    assert.equal(replay.view.code, code);
    assert.equal(replay.entryReceipt?.replayed, true);
    assert.equal(
      f.sqlite.prepare('SELECT COUNT(*) AS n FROM rooms').get()!.n,
      2,
    );
  } finally {
    f.sqlite.close();
  }
});

void test('sleeping AI rechecks removal before computing and restored AI retains normal pacing', async () => {
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
  void test(`${kind} discards computed work when removal wins its final SQL fence`, async () => {
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
        f.flagRemoved();
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
