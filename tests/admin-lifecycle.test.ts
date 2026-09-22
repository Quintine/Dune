import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID, webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { adminStore, pauseAdminBatch } from './admin-access-fixture';
import {
  adminLogin,
  requireAdmin,
  adminLogoutAll,
  AdminError,
  type AdminRole,
} from '../db/admin-access';
import {
  applyAdminRoomControl,
  readAdminRoomControl,
} from '../db/admin-lifecycle';
import {
  DEFAULT_ROOM_CONTROL,
  validAdminRoomControlInput,
  type AdminRoomControlInput,
} from '../lib/room-control';
import * as engine from '../game/engine';
import * as bots from '../game/bots';
import { baseDeck } from '../game/cards';
import * as seatAiDelegation from '../lib/seat-ai-delegation';
import type * as Rooms from '../db/rooms';

const secret = () => randomBytes(32).toString('hex');
const entry = () => ({ operationId: randomUUID(), sessionToken: secret() });
const change = (
  expectedRevision = 0,
  paused = true,
  joinLocked = false,
): AdminRoomControlInput => ({
  operationId: randomUUID(),
  expectedRevision,
  paused,
  joinLocked,
  reason: 'Dedicated QA room maintenance',
});
const status = (wanted: number) => (error: unknown) =>
  error instanceof AdminError && error.status === wanted;
const fakeClock = (start = 10000) => {
  let now = start;
  const sleeps: number[] = [];
  return {
    now: () => now,
    advance: (ms: number) => {
      now += ms;
    },
    sleeps,
    sleep: async (ms: number) => {
      sleeps.push(ms);
      now += ms;
    },
  };
};

async function fixture(role: AdminRole = 'operator', started = false) {
  const store = adminStore();
  assert.ok(store.sqlite instanceof DatabaseSync);
  const account = store.provision(role);
  const login = await adminLogin(store.database, account.key);
  const identity = await requireAdmin(store.database, login.token);
  const calls = { bots: 0, normalization: 0 };
  const hooks: { beforeRun?: (sql: string) => Promise<void> } = {};
  const database = {
    batch: (statements: D1PreparedStatement[]) =>
      store.database.batch(statements),
    prepare(sql: string) {
      const statement = store.database.prepare(sql);
      const original = statement.run.bind(statement);
      statement.run = async <T>() => {
        await hooks.beforeRun?.(sql);
        return original<T>();
      };
      return statement;
    },
  } as D1Database;
  function loadRooms() {
    const exports = {};
    runInNewContext(
      ts.transpileModule(
        readFileSync(new URL('../db/rooms.ts', import.meta.url), 'utf8'),
        {
          compilerOptions: {
            module: ts.ModuleKind.CommonJS,
            target: ts.ScriptTarget.ES2022,
          },
        },
      ).outputText,
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
          if (name === '@/lib/seat-ai-delegation') return seatAiDelegation;
          throw new Error('Unexpected dependency ' + name);
        },
      },
    );
    return exports as typeof Rooms;
  }
  const rooms = loadRooms();
  const ownerEntry = entry();
  const owner = await rooms.createRoom(
    'Lifecycle QA owner',
    'atreides',
    false,
    [],
    ownerEntry,
  );
  const code = owner.view.code;
  const auth = await rooms.authenticate(code, owner.token);
  const guestEntry = entry();
  const guest = await rooms.joinRoom(
    code,
    'Lifecycle QA guest',
    'emperor',
    guestEntry,
  );
  const guestAuth = await rooms.authenticate(code, guest.token!);
  const clock = fakeClock();
  if (started) {
    for (const seat of [auth, guestAuth])
      await rooms.act(
        code,
        seat,
        (await rooms.readRoom(code)).version,
        { type: 'ready' },
        clock,
      );
    await rooms.act(
      code,
      auth,
      (await rooms.readRoom(code)).version,
      { type: 'start' },
      clock,
    );
  }
  const apply = (input = change(), now = clock.now()) =>
    applyAdminRoomControl(database, identity, code, input, now);
  const read = () =>
    readAdminRoomControl(database, identity, code, clock.now());
  const row = () =>
    store.sqlite.prepare('SELECT * FROM rooms WHERE code = ?').get(code)!;
  const version = () => Number(row().version);
  return {
    ...store,
    database,
    account,
    login,
    identity,
    calls,
    runHooks: hooks,
    rooms,
    restart: loadRooms,
    ownerEntry,
    owner,
    guestEntry,
    guest,
    auth,
    guestAuth,
    code,
    clock,
    apply,
    read,
    row,
    version,
  };
}

function pauseRun(
  f: Awaited<ReturnType<typeof fixture>>,
  match = (sql: string) => sql.startsWith('UPDATE rooms SET state'),
) {
  let enter!: () => void, release!: () => void;
  const waiting = new Promise<void>((resolve) => {
    enter = resolve;
  });
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  f.runHooks.beforeRun = async (sql) => {
    if (!match(sql)) return;
    delete f.runHooks.beforeRun;
    enter();
    await gate;
  };
  return { waiting, release };
}
const count = (f: Awaited<ReturnType<typeof fixture>>, table: string) =>
  Number(f.sqlite.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get()!.n);

void test('room controls default for existing/new rooms and stay outside saved Game and private views', async () => {
  const f = await fixture();
  try {
    assert.deepEqual(await f.read(), DEFAULT_ROOM_CONTROL);
    assert.equal(Object.hasOwn(f.owner.view, 'roomControl'), false);
    assert.equal(
      count(f, 'room_controls'),
      0,
      'Reads do not backfill or mutate existing saves',
    );
    assert.equal(
      Object.hasOwn(await f.rooms.readRoom(f.code), 'roomControl'),
      false,
    );
    const before = f.row();
    const applied = await f.apply();
    assert.deepEqual(applied, {
      paused: true,
      joinLocked: false,
      revision: 1,
      updatedAt: 10000,
      replayed: false,
    });
    assert.equal(f.row().state, before.state);
    assert.equal(f.row().updated_at, before.updated_at);
    assert.equal(f.version(), Number(before.version) + 1);
    const view = await f.restart().readSeatView(f.code, f.auth);
    assert.deepEqual(view.roomControl, {
      paused: true,
      joinLocked: false,
      revision: 1,
      updatedAt: 10000,
    });
    const publicControl = JSON.stringify(view.roomControl);
    for (const privateValue of [
      f.identity.id,
      f.identity.sessionHash,
      'maintenance',
      'actor',
      'reason',
    ])
      assert.equal(publicControl.includes(privateValue), false);
    await f.apply(change(1, false, false));
    const resumed = await f.restart().readSeatView(f.code, f.auth);
    assert.deepEqual(resumed.roomControl, {
      paused: false,
      joinLocked: false,
      revision: 2,
      updatedAt: 10000,
    });
    assert.equal(
      JSON.stringify(view).includes(f.guestEntry.sessionToken),
      false,
    );
  } finally {
    f.sqlite.close();
  }
});

void test('room control receipts replay exactly without reverting later settings; mismatched reuse and stale new operations reject', async () => {
  const f = await fixture();
  try {
    const input = change();
    await f.apply(input);
    const first = f.row();
    assert.equal((await f.apply(input)).replayed, true);
    assert.deepEqual(f.row(), first);
    assert.equal(count(f, 'admin_room_audit'), 1);
    for (const patch of [
      { paused: false },
      { joinLocked: true },
      { reason: 'Different reason' },
      { expectedRevision: 1 },
    ])
      await assert.rejects(f.apply({ ...input, ...patch }), status(409));
    await assert.rejects(f.apply(change(0)), status(409));
    await f.apply(change(1, false, true), 20000);
    const current = f.row();
    assert.deepEqual(await f.apply(input), {
      paused: false,
      joinLocked: true,
      revision: 2,
      updatedAt: 20000,
      replayed: true,
    });
    assert.deepEqual(f.row(), current);
    assert.equal(count(f, 'admin_room_audit'), 2);
    const audit = f.sqlite
      .prepare('SELECT * FROM admin_room_audit ORDER BY created_at')
      .all();
    assert.equal(audit[0].actor_admin_id, f.identity.id);
    assert.equal(audit[0].room_code, f.code);
    assert.equal(audit[0].before_paused, 0);
    assert.equal(audit[0].after_paused, 1);
    assert.equal(audit[1].before_paused, 1);
    assert.equal(audit[1].after_paused, 0);
    assert.equal(
      JSON.stringify(audit).includes(f.ownerEntry.sessionToken),
      false,
    );
    assert.equal(JSON.stringify(audit).includes(f.identity.sessionHash), false);
    const other = f.provision('operator');
    const login = await adminLogin(f.database, other.key);
    const identity = await requireAdmin(f.database, login.token);
    await assert.rejects(
      applyAdminRoomControl(f.database, identity, f.code, input),
      status(409),
    );
  } finally {
    f.sqlite.close();
  }
});

void test('room mutations use live owner/operator authority; viewers may read and cannot spoof the identity role', async () => {
  for (const role of ['owner', 'operator', 'viewer'] as const) {
    const f = await fixture(role);
    try {
      assert.deepEqual(await f.read(), DEFAULT_ROOM_CONTROL);
      const mutated = applyAdminRoomControl(
        f.database,
        { ...f.identity, role: 'owner' },
        f.code,
        change(),
      );
      if (role === 'viewer') {
        await assert.rejects(mutated, status(403));
        assert.equal(count(f, 'admin_room_audit'), 0);
      } else assert.equal((await mutated).paused, true);
      await assert.rejects(
        applyAdminRoomControl(
          f.database,
          { ...f.identity, sessionHash: secret() },
          f.code,
          change(),
        ),
        status(401),
      );
    } finally {
      f.sqlite.close();
    }
  }
});

void test('room read/write authorization is fenced against logout, disable, role demotion and expiry at the transaction', async () => {
  for (const mode of [
    'logout',
    'disable',
    'demote',
    'expire',
    'read',
  ] as const) {
    const f = await fixture();
    try {
      const before = f.row();
      const gate = pauseAdminBatch(f);
      const pending = mode === 'read' ? f.read() : f.apply();
      await gate.waiting;
      if (mode === 'disable')
        f.sqlite
          .prepare('UPDATE admin_accounts SET enabled=0 WHERE id=?')
          .run(f.identity.id);
      else if (mode === 'demote')
        f.sqlite
          .prepare("UPDATE admin_accounts SET role='viewer' WHERE id=?")
          .run(f.identity.id);
      else if (mode === 'expire')
        f.sqlite
          .prepare('UPDATE admin_sessions SET expires_at=1 WHERE token_hash=?')
          .run(f.identity.sessionHash);
      else await adminLogoutAll(f.database, f.identity);
      gate.release();
      await assert.rejects(pending, status(mode === 'demote' ? 403 : 401));
      assert.deepEqual(f.row(), before);
      assert.equal(count(f, 'admin_room_audit'), 0);
    } finally {
      f.sqlite.close();
    }
  }
});

void test('concurrent same revision operations have one winner and exact queued retry gets one receipt', async () => {
  const f = await fixture();
  try {
    const same = change();
    const gate = pauseAdminBatch(f);
    const waiting = f.apply(same);
    await gate.waiting;
    await f.apply(same);
    gate.release();
    assert.equal((await waiting).replayed, true);
    assert.equal(count(f, 'admin_room_audit'), 1);
    const gate2 = pauseAdminBatch(f);
    const stale = f.apply(change(1, false));
    await gate2.waiting;
    await f.apply(change(1, true, true));
    gate2.release();
    await assert.rejects(stale, status(409));
    assert.equal(count(f, 'admin_room_audit'), 2);
  } finally {
    f.sqlite.close();
  }
});

void test('failed control persistence rolls back receipt, game fence and audit; audit survives deliberate record removal', async () => {
  const f = await fixture();
  try {
    const before = f.row();
    f.sqlite.exec(
      "CREATE TRIGGER fail_control BEFORE INSERT ON room_controls BEGIN SELECT RAISE(ABORT,'test storage failure'); END;",
    );
    await assert.rejects(f.apply(), /test storage failure/);
    assert.deepEqual(f.row(), before);
    assert.equal(count(f, 'admin_room_audit'), 0);
    f.sqlite.exec('DROP TRIGGER fail_control');
    await f.apply();
    f.sqlite.prepare('DELETE FROM rooms WHERE code=?').run(f.code);
    assert.equal(count(f, 'room_controls'), 0);
    assert.equal(count(f, 'admin_room_audit'), 1);
  } finally {
    f.sqlite.close();
  }
});

void test('bounded mutation inputs reject malformed UUIDs, revisions, fields, reason controls and missing rooms', async () => {
  const f = await fixture();
  try {
    for (const patch of [
      { operationId: randomUUID() + '\n' },
      { expectedRevision: -1 },
      { expectedRevision: 0.5 },
      { expectedRevision: Number.MAX_SAFE_INTEGER },
      { paused: 'true' },
      { reason: ' ' },
      { reason: 'a'.repeat(301) },
      { reason: 'line\nbreak' },
      { extra: true },
    ]) {
      const input = { ...change(), ...patch };
      assert.equal(validAdminRoomControlInput(input), false);
      await assert.rejects(
        f.apply(input as AdminRoomControlInput),
        status(400),
      );
    }
    await assert.rejects(
      applyAdminRoomControl(f.database, f.identity, f.code + '\n', change()),
      status(400),
    );
    await assert.rejects(
      applyAdminRoomControl(f.database, f.identity, 'MISSING1', change()),
      status(404),
    );
    await assert.rejects(
      readAdminRoomControl(f.database, f.identity, 'MISSING1'),
      status(404),
    );
    assert.equal(count(f, 'admin_room_audit'), 0);
  } finally {
    f.sqlite.close();
  }
});

void test('pause and join locks block new seats but preserve completed entry retries and current-seat restoration', async () => {
  const f = await fixture();
  try {
    await f.apply(change(0, false, true));
    const before = f.row();
    await assert.rejects(
      f.rooms.joinRoom(f.code, 'New seat', 'guild', entry()),
      /locked/i,
    );
    const retry = await f.rooms.joinRoom(
      f.code,
      'Lifecycle QA guest',
      'emperor',
      f.guestEntry,
    );
    assert.equal(retry.entryReceipt?.replayed, true);
    assert.equal(retry.token, f.guest.token);
    assert.equal(
      (
        await f.rooms.joinRoom(
          f.code,
          'New name',
          'guild',
          undefined,
          f.guestAuth,
        )
      ).alreadySeated,
      true,
    );
    assert.deepEqual(f.row(), before);
    await f.apply(change(1, true, false));
    await assert.rejects(
      f.rooms.joinRoom(f.code, 'New seat', 'guild', entry()),
      /paused/i,
    );
    const replay = await f.rooms.createRoom(
      'Lifecycle QA owner',
      'atreides',
      false,
      [],
      f.ownerEntry,
    );
    assert.equal(replay.view.code, f.code);
    assert.equal(replay.view.roomControl?.paused, true);
    assert.equal(count(f, 'seats'), 2);
  } finally {
    f.sqlite.close();
  }
});

void test('pause/lock racing a prepared join rejects its room, seat and receipt write together', async () => {
  for (const paused of [false, true]) {
    const f = await fixture();
    try {
      const gate = pauseAdminBatch(f);
      const joining = f.rooms.joinRoom(
        f.code,
        'Racing new seat',
        'guild',
        entry(),
      );
      await gate.waiting;
      await f.apply(change(0, paused, !paused));
      const state = f.row();
      gate.release();
      await assert.rejects(joining, /table changed/i);
      assert.deepEqual(f.row(), state);
      assert.equal(count(f, 'seats'), 2);
      assert.equal(count(f, 'room_entry_receipts'), 2);
    } finally {
      f.sqlite.close();
    }
  }
});

void test('pause wins against in-flight human actions and later gameplay without modifying saved choices', async () => {
  const f = await fixture();
  try {
    const gate = pauseRun(f);
    const pending = f.rooms.act(
      f.code,
      f.auth,
      f.version(),
      { type: 'ready' },
      f.clock,
    );
    await gate.waiting;
    await f.apply();
    const before = f.row();
    gate.release();
    await assert.rejects(pending, /another action/i);
    await assert.rejects(
      f.rooms.act(f.code, f.auth, f.version(), { type: 'ready' }, f.clock),
      /paused/i,
    );
    await assert.rejects(
      f.rooms.act(
        f.code,
        f.auth,
        f.version(),
        { type: 'advanceBots' },
        f.clock,
      ),
      /paused/i,
    );
    assert.deepEqual(f.row(), before);
    await f.apply(change(1, false));
    const view = await f.rooms.act(
      f.code,
      f.auth,
      f.version(),
      { type: 'ready' },
      f.clock,
    );
    assert.equal(
      view.players.find((p) => p.id === f.auth.playerId)!.ready,
      true,
    );
  } finally {
    f.sqlite.close();
  }
});

void test('paused AI exits before computation or sleep, persists across restart, and resumes at a fresh deadline', async () => {
  const f = await fixture('operator', true);
  try {
    await f.rooms.act(
      f.code,
      f.auth,
      f.version(),
      { type: 'setAutopilot', difficulty: 'Hard' },
      f.clock,
    );
    const before = f.row().state;
    await f.apply();
    assert.equal(f.row().state, before);
    f.clock.advance(50000);
    const snapshot = f.row();
    await f.restart().continueRoomBots(f.code, 4, f.clock);
    await f.restart().continueRoomAutomatic(f.code, f.clock);
    assert.deepEqual(f.row(), snapshot);
    assert.deepEqual(f.calls, { bots: 0, normalization: 0 });
    assert.deepEqual(f.clock.sleeps, []);
    await f.apply(change(1, false));
    const resumed = await f.rooms.readRoom(f.code);
    assert.equal(resumed.botNextActionAt, f.clock.now() + 1500);
    assert.deepEqual(
      { ...resumed, version: 0, botNextActionAt: 0 },
      { ...JSON.parse(String(before)), version: 0, botNextActionAt: 0 },
    );
    await f.rooms.continueRoomBots(f.code, 1, f.clock);
    assert.deepEqual(f.clock.sleeps, [1500]);
    assert.equal(f.calls.bots, 1);
    assert.equal(
      (await f.rooms.readRoom(f.code)).players[0].traitors.length,
      1,
    );
  } finally {
    f.sqlite.close();
  }
});

void test('worker asleep when paused rereads operational authority before computing or persisting', async () => {
  const f = await fixture('operator', true);
  try {
    await f.rooms.act(
      f.code,
      f.auth,
      f.version(),
      { type: 'setAutopilot', difficulty: 'Hard' },
      f.clock,
    );
    let enter!: () => void, release!: () => void;
    const sleeping = new Promise<void>((resolve) => {
      enter = resolve;
    });
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const clock = {
      now: f.clock.now,
      sleep: async (ms: number) => {
        enter();
        await gate;
        f.clock.advance(ms);
      },
    };
    const running = f.rooms.continueRoomBots(f.code, 1, clock);
    await sleeping;
    await f.apply();
    const before = f.row();
    release();
    await running;
    assert.deepEqual(f.row(), before);
    assert.equal(f.calls.bots, 0);
  } finally {
    f.sqlite.close();
  }
});

void test('pause after AI computation but before SQL CAS discards the computed action', async () => {
  const f = await fixture('operator', true);
  try {
    await f.rooms.act(
      f.code,
      f.auth,
      f.version(),
      { type: 'setAutopilot', difficulty: 'Hard' },
      f.clock,
    );
    f.clock.advance(1500);
    const gate = pauseRun(f);
    const running = f.rooms.continueRoomBots(f.code, 2, f.clock);
    await gate.waiting;
    assert.equal(f.calls.bots, 1);
    await f.apply();
    const before = f.row();
    gate.release();
    await running;
    assert.deepEqual(f.row(), before);
    assert.equal(f.calls.bots, 1);
  } finally {
    f.sqlite.close();
  }
});

async function marketFixture() {
  const f = await fixture();
  const g = await f.rooms.readRoom(f.code);
  g.players[0] = engine.newPlayer(f.auth.playerId, 'CHOAM', 'choam');
  g.players.push(engine.newPlayer('guild', 'Guild', 'guild'));
  g.status = 'playing';
  g.phase = 3;
  g.turn = 2;
  g.order = g.players.map((p) => p.id);
  g.active = f.auth.playerId;
  for (const p of g.players) {
    p.hand = [];
    p.spice = 10;
  }
  g.auction = null;
  g.response = null;
  g.deck = baseDeck();
  g.discard = [];
  g.choamMarket = { owner: f.auth.playerId, resume: 'phase', blocked: [] };
  g.decision = { kind: 'choamMarket', player: f.auth.playerId };
  g.aid = { [f.auth.playerId]: { recipient: 'emperor', amount: 2 } };
  f.sqlite
    .prepare('UPDATE rooms SET state=? WHERE code=?')
    .run(JSON.stringify(g), f.code);
  return f;
}

void test('automatic normalization stays frozen while paused and loses its commit race without double settlement', async () => {
  const f = await marketFixture();
  try {
    const gate = pauseRun(f);
    const running = f.rooms.continueRoomAutomatic(f.code, f.clock);
    await gate.waiting;
    await f.apply();
    const before = f.row();
    gate.release();
    await running;
    assert.deepEqual(f.row(), before);
    assert.equal(f.calls.normalization, 1);
    await f.rooms.continueRoomAutomatic(f.code, f.clock);
    assert.equal(f.calls.normalization, 1);
    await f.apply(change(1, false));
    await f.rooms.continueRoomAutomatic(f.code, f.clock);
    const after = await f.rooms.readRoom(f.code);
    assert.equal(after.phase, 4);
    assert.equal(after.players[0].spice, 12);
    assert.equal(after.decision, null);
    await f.rooms.continueRoomAutomatic(f.code, f.clock);
    assert.deepEqual(await f.rooms.readRoom(f.code), after);
  } finally {
    f.sqlite.close();
  }
});

void test('paused seats can take back AI control and revoke consent but cannot grant, enable or activate AI', async () => {
  const f = await fixture('operator', true);
  try {
    const grant = {
      grantId: randomUUID(),
      delegateId: f.guestAuth.playerId,
      difficulty: 'Hard' as const,
    };
    await f.rooms.setSeatAiDelegate(
      f.code,
      f.auth,
      f.version(),
      grant,
      f.clock,
    );
    await f.apply();
    const before = f.row();
    await assert.rejects(
      f.rooms.act(
        f.code,
        f.auth,
        f.version(),
        { type: 'setAutopilot', difficulty: 'Hard' },
        f.clock,
      ),
      /paused/i,
    );
    await assert.rejects(
      f.rooms.setSeatAiDelegate(
        f.code,
        f.auth,
        f.version(),
        { ...grant, grantId: randomUUID() },
        f.clock,
      ),
      /paused/i,
    );
    await assert.rejects(
      f.rooms.useSeatAiDelegate(
        f.code,
        f.guestAuth,
        f.version(),
        { ownerId: f.auth.playerId, grantId: grant.grantId },
        f.clock,
      ),
      /paused/i,
    );
    assert.deepEqual(f.row(), before);
    const replay = await f.rooms.setSeatAiDelegate(
      f.code,
      f.auth,
      f.version(),
      grant,
      f.clock,
    );
    assert.equal(replay.replayed, true);
    await f.rooms.revokeSeatAiDelegate(
      f.code,
      f.auth,
      f.version(),
      grant.grantId,
      f.clock,
    );
    await f.apply(change(1, false));
    await f.rooms.act(
      f.code,
      f.auth,
      f.version(),
      { type: 'setAutopilot', difficulty: 'Hard' },
      f.clock,
    );
    await f.apply(change(2));
    const game = await f.rooms.readRoom(f.code);
    const view = await f.rooms.act(
      f.code,
      f.auth,
      f.version(),
      { type: 'setAutopilot', difficulty: null },
      f.clock,
    );
    assert.equal(view.roomControl?.paused, true);
    const after = await f.rooms.readRoom(f.code);
    assert.equal(after.players[0].autopilot, undefined);
    assert.deepEqual(
      after.players[0].traitorChoices,
      game.players[0].traitorChoices,
    );
    assert.deepEqual(after.players[0].hand, game.players[0].hand);
    assert.equal(after.setupStage, game.setupStage);
  } finally {
    f.sqlite.close();
  }
});

void test('paused delegated activation loses the final transaction race without consuming consent', async () => {
  const f = await fixture('operator', true);
  try {
    const grant = {
      grantId: randomUUID(),
      delegateId: f.guestAuth.playerId,
      difficulty: 'Hard' as const,
    };
    await f.rooms.setSeatAiDelegate(
      f.code,
      f.auth,
      f.version(),
      grant,
      f.clock,
    );
    const gate = pauseAdminBatch(f);
    const activation = f.rooms.useSeatAiDelegate(
      f.code,
      f.guestAuth,
      f.version(),
      { ownerId: f.auth.playerId, grantId: grant.grantId },
      f.clock,
    );
    await gate.waiting;
    await f.apply();
    const before = f.row();
    gate.release();
    await assert.rejects(activation, /table.*changed/i);
    assert.deepEqual(f.row(), before);
    assert.equal(
      f.sqlite.prepare('SELECT used_at FROM seat_ai_delegations').get()!
        .used_at,
      null,
    );
  } finally {
    f.sqlite.close();
  }
});

void test('paused room keeps recovery/key rotation and handover with exact retries and public pause metadata', async () => {
  const f = await fixture('operator', true);
  try {
    await f.apply(change(0, true, true));
    const privateState = f.row().state;
    const recoverySecret = secret();
    await f.rooms.setRecoveryKey(f.code, f.auth, f.version(), recoverySecret);
    const recover = {
      playerId: f.auth.playerId,
      recoverySecret,
      operationId: randomUUID(),
      newSessionToken: secret(),
    };
    const recovered = await f.rooms.recoverSeat(f.code, recover);
    const replay = await f.rooms.recoverSeat(f.code, recover);
    assert.equal(replay.replayed, true);
    for (const result of [recovered, replay])
      assert.equal(result.view.roomControl?.paused, true);
    await assert.rejects(f.rooms.readSeatView(f.code, f.auth), /verified/i);
    const auth = await f.rooms.authenticate(f.code, recovered.token);
    const offer = { offerId: randomUUID(), handoverSecret: secret() };
    await f.rooms.createSeatHandover(f.code, auth, f.version(), offer, f.clock);
    const claim = {
      playerId: auth.playerId,
      ...offer,
      operationId: randomUUID(),
      newSessionToken: secret(),
    };
    const claimed = await f.rooms.claimSeatHandover(f.code, claim, f.clock);
    const claimedAgain = await f.rooms.claimSeatHandover(
      f.code,
      claim,
      f.clock,
    );
    assert.equal(claimedAgain.replayed, true);
    for (const result of [claimed, claimedAgain])
      assert.deepEqual(result.view.roomControl, {
        paused: true,
        joinLocked: true,
        revision: 1,
        updatedAt: 10000,
      });
    assert.equal(f.row().state, privateState);
    await assert.rejects(f.rooms.readSeatView(f.code, auth), /verified/i);
  } finally {
    f.sqlite.close();
  }
});
