import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as engine from '../game/engine';
import * as bots from '../game/bots';
import { baseDeck } from '../game/cards';
import type { FactionId } from '../game/catalog';
import type * as Rooms from '../db/rooms';

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

async function fixture(
  factions: FactionId[] = ['beneGesserit', 'fremen', 'harkonnen', 'atreides'],
) {
  const store = unitStore();
  const created = await store.rooms.createRoom(
    'Setup host',
    factions[0],
    false,
    [],
  );
  const code = created.view.code;
  const tokens = [created.token];
  for (const faction of factions.slice(1))
    tokens.push(
      (await store.rooms.joinRoom(code, `${faction} setup seat`, faction))
        .token!,
    );
  const seats = await Promise.all(
    tokens.map((token) => store.rooms.authenticate(code, token)),
  );
  for (const seat of seats) {
    const current = await store.restart().readRoom(code);
    await store
      .restart()
      .act(code, seat, current.version, { type: 'ready' }, clock);
  }
  const ready = await store.restart().readRoom(code);
  await store
    .restart()
    .act(code, seats[0], ready.version, { type: 'start' }, clock);
  store.writes.length = 0;
  return { ...store, code, seats };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;

async function preservedReload(f: Fixture) {
  const before = await f.rooms.readRoom(f.code);
  const writes = f.writes.length;
  await f.restart().continueRoomAutomatic(f.code, clock);
  assert.equal(
    f.writes.length,
    writes,
    'A pending setup choice must not create writes or redeal.',
  );
  assert.deepEqual(await f.restart().readRoom(f.code), before);
  return before;
}
async function act(f: Fixture, index: number, action: engine.Action) {
  const current = await f.restart().readRoom(f.code);
  await f.restart().act(f.code, f.seats[index], current.version, action, clock);
  return f.restart().readRoom(f.code);
}
function barrier() {
  let release!: () => void;
  const ready = new Promise<void>((resolve) => {
    release = resolve;
  });
  let arrivals = 0;
  return async () => {
    if (++arrivals === 2) release();
    await ready;
  };
}
async function duplicate(f: Fixture, index: number, action: engine.Action) {
  const before = await f.restart().readRoom(f.code);
  f.writes.length = 0;
  f.hooks.beforeWrite = barrier();
  const results = await Promise.allSettled([
    f.rooms.act(f.code, f.seats[index], before.version, action, clock),
    f.restart().act(f.code, f.seats[index], before.version, action, clock),
  ]);
  f.hooks.beforeWrite = undefined;
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(results.filter((r) => r.status === 'rejected').length, 1);
  assert.deepEqual(
    f.writes.map((w) => w.changes).sort((a, b) => a - b),
    [0, 1],
  );
  const after = await f.restart().readRoom(f.code);
  assert.equal(after.version, before.version + 1);
  await assert.rejects(
    f.restart().act(f.code, f.seats[index], before.version, action, clock),
  );
  assert.deepEqual(await f.restart().readRoom(f.code), after);
  return after;
}
async function assertPrivateViews(
  f: Fixture,
  stage: 'prediction' | 'traitors' | 'forces' | null,
) {
  const state = await f.restart().readRoom(f.code);
  if (state.setupStage === 'traitors' || state.setupStage === 'forces') {
    const traitorIdentities = [
      ...(state.traitorReserve ?? []),
      ...state.players.flatMap((p) => [...p.traitors, ...p.traitorChoices]),
    ];
    const nativeIdentities = state.players.flatMap((p) =>
      p.leaders.map((l) => l.id),
    );
    assert.deepEqual(
      [...traitorIdentities].sort(),
      [...nativeIdentities].sort(),
    );
    assert.equal(new Set(traitorIdentities).size, traitorIdentities.length);
  }
  for (const [index, seat] of f.seats.entries()) {
    const view = await f.restart().readSeatView(f.code, seat);
    assert.equal(view.setupStage, stage);
    for (const [j, player] of view.players.entries()) {
      if (index === j) {
        assert.deepEqual(player.hand, state.players[j].hand);
        assert.deepEqual(
          player.traitorChoices,
          state.players[j].traitorChoices,
        );
        assert.deepEqual(player.traitors, state.players[j].traitors);
      } else {
        assert.equal(player.hand, undefined);
        assert.equal(player.traitorChoices, undefined);
        assert.equal(player.traitors, undefined);
        assert.equal(player.prediction, undefined);
      }
      if (stage === 'prediction') {
        assert.deepEqual(player.forces, {});
        if (index === j) {
          assert.deepEqual(player.hand, []);
          assert.deepEqual(player.traitorChoices, []);
          assert.deepEqual(player.traitors, []);
        }
      }
      if (stage === 'traitors' || stage === 'forces')
        if (index === j) assert.deepEqual(player.hand, []);
    }
    assert.equal('deck' in view, false);
  }
}

void test('new Basic setup restores prediction, traitors and force stages privately; duplicate stage-closing actions deal and place exactly once', async () => {
  const f = await fixture();
  try {
    let state = await preservedReload(f);
    assert.equal(state.status, 'setup');
    assert.equal(state.setupStage, 'prediction');
    await assertPrivateViews(f, 'prediction');
    const before = structuredClone(state);
    await assert.rejects(
      f
        .restart()
        .act(
          f.code,
          f.seats[1],
          state.version,
          { type: 'fremenSetup', placements: { sietch_tabr: 10 } },
          clock,
        ),
    );
    await assert.rejects(
      f
        .restart()
        .act(
          f.code,
          f.seats[3],
          state.version,
          { type: 'traitor', leader: state.players[0].leaders[0].id },
          clock,
        ),
    );
    assert.deepEqual(await f.restart().readRoom(f.code), before);
    state = await duplicate(f, 0, {
      type: 'predict',
      faction: 'atreides',
      turn: 4,
    });
    assert.equal(state.setupStage, 'traitors');
    assert.deepEqual(
      state.players.map((p) => p.forces),
      [{}, {}, {}, {}],
    );
    assert.deepEqual(
      state.players.map((p) => p.traitorChoices.length),
      [4, 4, 0, 4],
    );
    assert.equal(state.players[2].traitors.length, 4);
    await preservedReload(f);
    await assertPrivateViews(f, 'traitors');
    await assert.rejects(
      f
        .restart()
        .act(
          f.code,
          f.seats[1],
          state.version,
          { type: 'fremenSetup', placements: { sietch_tabr: 10 } },
          clock,
        ),
    );
    for (const index of [0, 1]) {
      state = await f.restart().readRoom(f.code);
      await act(f, index, {
        type: 'traitor',
        leader: state.players[index].traitorChoices[0],
      });
    }
    state = await f.restart().readRoom(f.code);
    state = await duplicate(f, 3, {
      type: 'traitor',
      leader: state.players[3].traitorChoices[0],
    });
    assert.equal(state.setupStage, 'forces');
    assert.deepEqual(
      state.players.map((p) => p.hand),
      [[], [], [], []],
    );
    assert.deepEqual(state.players[1].forces, {});
    assert.equal(state.players[1].reserves, 20);
    assert.deepEqual(state.players[0].forces, { 'polar_sink:0': 1 });
    assert.deepEqual(state.players[2].forces, { 'carthag:11': 10 });
    assert.deepEqual(state.players[3].forces, { 'arrakeen:10': 10 });
    await preservedReload(f);
    await assertPrivateViews(f, 'forces');
    const heldTraitors = state.players.map((p) => [...p.traitors]);
    state = await duplicate(f, 1, {
      type: 'fremenSetup',
      placements: { sietch_tabr: 10 },
    });
    assert.equal(state.status, 'playing');
    assert.equal(state.setupStage, undefined);
    assert.equal(state.phase, 0);
    assert.equal(state.players[1].reserves, 10);
    assert.equal(
      Object.values(state.players[1].forces).reduce((a, b) => a + b, 0),
      10,
    );
    assert.deepEqual(
      state.players.map((p) => p.hand.length),
      [1, 1, 2, 1],
    );
    assert.deepEqual(
      state.players.map((p) => p.traitors),
      heldTraitors,
    );
    const identities = [
      ...state.deck,
      ...state.discard,
      ...state.players.flatMap((p) => p.hand),
    ].map((c) => c.id);
    assert.equal(identities.length, baseDeck().length);
    assert.equal(new Set(identities).size, identities.length);
    const final = structuredClone(state);
    await f.restart().continueRoomAutomatic(f.code, clock);
    assert.deepEqual(await f.restart().readRoom(f.code), final);
    await assertPrivateViews(f, null);
    for (const p of state.players)
      assert.equal(
        p.reserves +
          p.tanks +
          Object.values(p.forces).reduce((a, b) => a + b, 0),
        20,
      );
  } finally {
    f.sqlite.close();
  }
});

void test('without prediction or placement choices, duplicate final traitor selection performs the automatic starting deal only once', async () => {
  const f = await fixture(['atreides', 'harkonnen']);
  try {
    const initial = await preservedReload(f);
    assert.equal(initial.setupStage, 'traitors');
    assert.deepEqual(
      initial.players.map((p) => p.hand),
      [[], []],
    );
    assert.deepEqual(
      initial.players.map((p) => p.forces),
      [{}, {}],
    );
    await assertPrivateViews(f, 'traitors');
    const done = await duplicate(f, 0, {
      type: 'traitor',
      leader: initial.players[0].traitorChoices[0],
    });
    assert.equal(done.status, 'playing');
    assert.equal(done.phase, 0);
    assert.deepEqual(
      done.players.map((p) => p.hand.length),
      [1, 2],
    );
    assert.equal(done.deck.length, baseDeck().length - 3);
    assert.deepEqual(done.players[0].forces, { 'arrakeen:10': 10 });
    assert.deepEqual(done.players[1].forces, { 'carthag:11': 10 });
    const snapshot = structuredClone(done);
    await f.restart().continueRoomAutomatic(f.code, clock);
    assert.deepEqual(await f.restart().readRoom(f.code), snapshot);
    await assertPrivateViews(f, null);
  } finally {
    f.sqlite.close();
  }
});

void test('legacy saved setup without a stage preserves already known hands and choices through recovery and completion', async () => {
  const f = await fixture();
  try {
    const legacy = await f.restart().readRoom(f.code);
    delete legacy.setupStage;
    const cards = baseDeck();
    legacy.deck = cards.slice(5);
    legacy.discard = [];
    legacy.players[0].hand = [cards[0]];
    legacy.players[1].hand = [cards[1]];
    legacy.players[2].hand = [cards[2], cards[3]];
    legacy.players[3].hand = [cards[4]];
    for (const p of legacy.players) {
      p.traitorChoices = [p.leaders[0].id];
      p.traitors = [];
    }
    legacy.players[2].traitors = legacy.players[2].leaders
      .slice(0, 4)
      .map((l) => l.id);
    legacy.players[2].traitorChoices = [];
    legacy.players[0].forces = { 'polar_sink:0': 1 };
    legacy.players[0].reserves = 19;
    legacy.players[2].forces = { 'carthag:11': 10 };
    legacy.players[2].reserves = 10;
    legacy.players[3].forces = { 'arrakeen:10': 10 };
    legacy.players[3].reserves = 10;
    f.sqlite
      .prepare('UPDATE rooms SET state=?,version=? WHERE code=?')
      .run(JSON.stringify(legacy), legacy.version, f.code);
    const beforeHands = structuredClone(legacy.players.map((p) => p.hand));
    const beforeDeck = structuredClone(legacy.deck);
    await preservedReload(f);
    await assertPrivateViews(f, null);
    await act(f, 0, { type: 'predict', faction: 'atreides', turn: 4 });
    for (const index of [0, 1, 3])
      await act(f, index, {
        type: 'traitor',
        leader: legacy.players[index].traitorChoices[0],
      });
    await act(f, 1, { type: 'fremenSetup', placements: { sietch_tabr: 10 } });
    const done = await f.restart().readRoom(f.code);
    assert.equal(done.status, 'playing');
    assert.equal(done.setupStage, undefined);
    assert.deepEqual(
      done.players.map((p) => p.hand),
      beforeHands,
    );
    assert.deepEqual(done.deck, beforeDeck);
    assert.deepEqual(done.players[0].forces, legacy.players[0].forces);
    assert.deepEqual(done.players[2].forces, legacy.players[2].forces);
    assert.deepEqual(done.players[3].forces, legacy.players[3].forces);
  } finally {
    f.sqlite.close();
  }
});
