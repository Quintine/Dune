import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as engine from '../game/engine';
import * as bots from '../game/bots';
import type * as Rooms from '../db/rooms';
import { homeworldGameIntegrity } from '../game/homeworld-game';

/** Execute the production room module and SQL, with a hook immediately before its CAS. */
function unitStore(runBots = bots.runBots) {
  const sqlite = new DatabaseSync(':memory:');
  const hooks: { beforeWrite?: () => Promise<void> } = {};
  const writes: { expected: number; changes: number }[] = [];
  for (const file of readdirSync(new URL('../drizzle/', import.meta.url))
    .filter((f) => f.endsWith('.sql'))
    .sort())
    sqlite.exec(
      readFileSync(new URL('../drizzle/' + file, import.meta.url), 'utf8'),
    );
  class Statement {
    values: (string | number | null)[] = [];
    constructor(readonly sql: string) {}
    bind(...values: (string | number | null)[]) {
      this.values = values;
      return this;
    }
    async first() {
      return sqlite.prepare(this.sql).get(...this.values) ?? null;
    }
    async run() {
      const continuation = this.sql.startsWith('UPDATE rooms SET state');
      if (continuation) await hooks.beforeWrite?.();
      const changes = Number(
        sqlite.prepare(this.sql).run(...this.values).changes,
      );
      if (continuation)
        writes.push({ expected: Number(this.values[3]), changes });
      return { meta: { changes } };
    }
  }
  const database = {
    prepare: (sql: string) => new Statement(sql),
    batch: async (statements: Statement[]) => {
      sqlite.exec('BEGIN');
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.run());
        sqlite.exec('COMMIT');
        return results;
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
  };
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
        // Keep persisted JSON values in the test realm for strict structural assertions.
        JSON,
        require: (name: string) => {
          if (name === 'cloudflare:workers') return { env: { DB: database } };
          if (name === '@/game/engine') return engine;
          if (name === '@/game/bots') return { ...bots, runBots };
          throw new Error('Unexpected module ' + name);
        },
      },
    );
    return exports as typeof Rooms;
  }
  return { rooms: loadRooms(), restart: loadRooms, sqlite, hooks, writes };
}

const clock: Rooms.RoomsClock = { now: () => 10000, sleep: async () => {} };
async function fixture() {
  const store = unitStore();
  const made = await store.rooms.createRoom(
    'Junction recovery QA',
    'guild',
    true,
    [],
  );
  const code = made.view.code;
  const tokens = [made.token];
  for (const faction of ['emperor', 'atreides'] as const) {
    const joined = await store.rooms.joinRoom(code, faction, faction);
    tokens.push(joined.token!);
  }
  const auths = await Promise.all(
    tokens.map((token) => store.rooms.authenticate(code, token)),
  );
  let g = await store.rooms.readRoom(code);
  g = engine.applyAction(g, g.host, { type: 'homeworlds', enabled: true });
  for (const player of g.players)
    g = engine.applyAction(g, player.id, { type: 'ready' });
  g = engine.initializeHomeworldGameForAudit(g);
  for (let step = 0; g.status === 'setup' && step < 30; step++) {
    let next: engine.Game | undefined;
    for (const player of g.players) {
      const view = engine.viewGame(g, player.id);
      view.players.find((p) => p.id === player.id)!.bot = 'Easy';
      const action = bots.botActions(view)[0];
      if (action) {
        next = engine.applyAction(g, player.id, action);
        break;
      }
    }
    assert.ok(next);
    g = next;
  }
  assert.equal(g.status, 'playing');
  for (const player of g.players) g.deck.push(...player.hand.splice(0));
  const ids = g.players.map((p) => p.id);
  Object.assign(g, {
    phase: 5,
    phaseOpening: null,
    response: null,
    decision: null,
    order: ids,
    active: ids[2],
    movementRemaining: [ids[2], ids[0], ids[1]],
    ready: [],
    storm: 18,
  });
  for (const player of g.players) player.shipped = false;
  const hold = (index: number, effect: string) => {
    const at = g.deck.findIndex((card) => card.effect === effect);
    assert.ok(at >= 0);
    const [card] = g.deck.splice(at, 1);
    g.players[index].hand.push(card);
    return card.id;
  };
  const karama = hold(0, 'karama');
  const save = (state: engine.Game) =>
    store.sqlite
      .prepare('UPDATE rooms SET state = ?, version = ? WHERE code = ?')
      .run(JSON.stringify(state), state.version, code);
  homeworldGameIntegrity(g);
  save(g);
  const other = await store.rooms.createRoom(
    'Untouched other table',
    'atreides',
    false,
    [],
  );
  const otherBefore = await store.rooms.readRoom(other.view.code);
  store.writes.length = 0;
  return {
    ...store,
    code,
    tokens,
    auths,
    ids,
    save,
    initial: g,
    karama,
    otherCode: other.view.code,
    otherBefore,
  };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
function offer(
  state: engine.Game,
  rate: 'half' | 'full' = 'half',
): engine.Action {
  const view = engine.viewGame(state, state.players[0].id).junctionTransport!;
  return { type: 'offerJunctionTransport', event: view.offerEvent, rate };
}
function acceptance(state: engine.Game): engine.Action {
  const view = engine.viewGame(state, state.players[2].id).junctionTransport!;
  return {
    type: 'junctionShip',
    event: view.event,
    offer: view.offer!.event,
    destination: 'homeworld:atreides',
    sources: { 'arrakeen:10': { normal: 3, elite: 0 } },
  };
}
function barrier(f: Fixture) {
  let arrivals = 0;
  let release!: () => void;
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  f.hooks.beforeWrite = async () => {
    if (++arrivals === 2) release();
    await waiting;
  };
}
async function restored(f: Fixture, state: engine.Game) {
  const rooms = f.restart();
  for (let i = 0; i < f.tokens.length; i++) {
    const auth = await rooms.authenticate(f.code, f.tokens[i]);
    const view = await rooms.readSeatView(f.code, auth);
    assert.deepEqual(view, engine.viewGame(state, f.ids[i]));
    for (const opponent of view.players.filter((p) => p.id !== f.ids[i])) {
      assert.equal(opponent.hand, undefined);
      assert.equal(opponent.traitors, undefined);
    }
    const visible = JSON.stringify(view.junctionTransport);
    for (const other of state.players.filter((p) => p.id !== f.ids[i])) {
      for (const card of other.hand)
        assert.equal(visible.includes(card.id), false);
      for (const traitor of other.traitors)
        assert.equal(visible.includes(traitor), false);
    }
  }
  homeworldGameIntegrity(state);
  assert.deepEqual(await rooms.readRoom(f.otherCode), f.otherBefore);
  return rooms;
}
async function offered(f: Fixture) {
  await f.rooms.act(
    f.code,
    f.auths[0],
    f.initial.version,
    offer(f.initial),
    clock,
  );
  const state = await f.rooms.readRoom(f.code);
  assert.equal(state.decision, null, 'Offer is not a blocking response.');
  assert.deepEqual(state.players, f.initial.players);
  assert.deepEqual(state.homeworlds, f.initial.homeworlds);
  f.writes.length = 0;
  return state;
}

void test('production SQL duplicate Junction offers win one CAS without moving or paying', async () => {
  const f = await fixture();
  try {
    const restarted = await restored(f, f.initial);
    barrier(f);
    const action = offer(f.initial);
    const result = await Promise.allSettled([
      f.rooms.act(f.code, f.auths[0], f.initial.version, action, clock),
      restarted.act(f.code, f.auths[0], f.initial.version, action, clock),
    ]);
    delete f.hooks.beforeWrite;
    assert.equal(result.filter((r) => r.status === 'fulfilled').length, 1);
    assert.deepEqual(
      f.writes.map((w) => w.changes).sort((a, b) => a - b),
      [0, 1],
    );
    const after = await restarted.readRoom(f.code);
    assert.equal(after.version, f.initial.version + 1);
    assert.deepEqual(after.players, f.initial.players);
    assert.deepEqual(after.homeworlds, f.initial.homeworlds);
    assert.equal(
      engine.viewGame(after, f.ids[2]).junctionTransport!.offer!.rate,
      'half',
    );
    await restored(f, after);
  } finally {
    f.sqlite.close();
  }
});

void test('production SQL duplicate Junction acceptance settles exactly once across module restart', async () => {
  const f = await fixture();
  try {
    const before = await offered(f);
    const restarted = await restored(f, before);
    const action = acceptance(before);
    barrier(f);
    const result = await Promise.allSettled([
      f.rooms.act(f.code, f.auths[2], before.version, action, clock),
      restarted.act(f.code, f.auths[2], before.version, action, clock),
    ]);
    delete f.hooks.beforeWrite;
    assert.equal(result.filter((r) => r.status === 'fulfilled').length, 1);
    assert.deepEqual(
      f.writes.map((w) => w.changes).sort((a, b) => a - b),
      [0, 1],
    );
    const after = await restarted.readRoom(f.code);
    assert.equal(after.version, before.version + 1);
    assert.equal(after.players[2].reserves, 13);
    assert.equal(after.players[2].forces['arrakeen:10'], 7);
    assert.equal(after.players[2].spice, 8);
    assert.equal(after.players[2].shipped, true);
    assert.equal(after.players[2].moved, 0);
    assert.equal(after.players[0].spice, 5);
    assert.equal(after.decision, null);
    assert.ok(after.players[0].hand.some((card) => card.id === f.karama));
    assert.equal(
      after.discard.some((card) => card.id === f.karama),
      false,
    );
    await assert.rejects(
      restarted.act(f.code, f.auths[2], before.version, action, clock),
    );
    await assert.rejects(
      restarted.act(f.code, f.auths[2], after.version, action, clock),
    );
    await restarted.continueRoomAutomatic(f.code, clock);
    assert.deepEqual(await restarted.readRoom(f.code), after);
    await restored(f, after);
  } finally {
    f.sqlite.close();
  }
});

void test('production SQL offer replacement races acceptance without changing its agreed tariff', async () => {
  const f = await fixture();
  try {
    const before = await offered(f);
    const restarted = await restored(f, before);
    const oldAcceptance = acceptance(before);
    barrier(f);
    const result = await Promise.allSettled([
      f.rooms.act(
        f.code,
        f.auths[0],
        before.version,
        offer(before, 'full'),
        clock,
      ),
      restarted.act(f.code, f.auths[2], before.version, oldAcceptance, clock),
    ]);
    delete f.hooks.beforeWrite;
    assert.equal(result.filter((r) => r.status === 'fulfilled').length, 1);
    assert.deepEqual(
      f.writes.map((w) => w.changes).sort((a, b) => a - b),
      [0, 1],
    );
    let after = await restarted.readRoom(f.code);
    assert.equal(after.version, before.version + 1);
    if (result[0].status === 'fulfilled') {
      assert.equal(after.players[2].shipped, false);
      assert.equal(after.players[2].spice, 10);
      assert.equal(
        engine.viewGame(after, f.ids[2]).junctionTransport!.offer!.rate,
        'full',
      );
      await assert.rejects(
        restarted.act(f.code, f.auths[2], after.version, oldAcceptance, clock),
      );
      await restarted.act(
        f.code,
        f.auths[2],
        after.version,
        acceptance(after),
        clock,
      );
      after = await restarted.readRoom(f.code);
      assert.equal(after.players[2].spice, 7);
    } else {
      assert.equal(after.players[2].shipped, true);
      assert.equal(after.players[2].spice, 8);
    }
    assert.equal(after.players[2].reserves, 13);
    assert.equal(after.players[2].forces['arrakeen:10'], 7);
    await restored(f, after);
  } finally {
    f.sqlite.close();
  }
});

void test('persisted Junction proposal remains optional and repeated reads do not execute a shipment', async () => {
  const f = await fixture();
  try {
    const before = await offered(f);
    const restarted = await restored(f, before);
    for (let i = 0; i < 3; i++) {
      await restarted.continueRoomAutomatic(f.code, clock);
      await restored(f, before);
    }
    assert.equal(f.writes.length, 0);
    const action = acceptance(before);
    await assert.rejects(
      restarted.act(f.code, f.auths[1], before.version, action, clock),
    );
    await assert.rejects(
      restarted.act(
        f.code,
        f.auths[2],
        before.version,
        { ...action, sources: { 'arrakeen:10': { normal: 11, elite: 0 } } },
        clock,
      ),
    );
    assert.equal(f.writes.length, 0);
    assert.deepEqual(await restarted.readRoom(f.code), before);
    await restarted.act(
      f.code,
      f.auths[2],
      before.version,
      { type: 'endMovement' },
      clock,
    );
    const after = await restarted.readRoom(f.code);
    assert.notEqual(after.active, f.ids[2]);
    assert.equal(after.players[2].spice, 10);
    assert.equal(after.players[2].reserves, 10);
    await assert.rejects(
      restarted.act(f.code, f.auths[2], after.version, action, clock),
    );
    await restored(f, after);
  } finally {
    f.sqlite.close();
  }
});
