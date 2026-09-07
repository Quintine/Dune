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
const player = (g: engine.Game, id: string) =>
  g.players.find((p) => p.id === id)!;
const clone = (g: engine.Game): engine.Game => JSON.parse(JSON.stringify(g));

/** Only this conserved Advanced movement position is staged. Room creation,
 * credentials, shipping, movement, end-turn actions and SQL CAS are production. */
async function fixture(mode: 'ship' | 'move', ecazMoves = true) {
  const store = unitStore();
  const made = await store.rooms.createRoom('Ecaz', 'harkonnen', false, []);
  const code = made.view.code;
  const joined = await store.rooms.joinRoom(code, 'Ally', 'atreides');
  const third = await store.rooms.joinRoom(code, 'Next', 'emperor');
  const tokens = [made.token, joined.token!, third.token!];
  const auths = await Promise.all(
    tokens.map((t) => store.rooms.authenticate(code, t)),
  );
  const [ecazAuth, allyAuth, nextAuth] = auths;
  const activeAuth = ecazMoves ? ecazAuth : allyAuth;
  const waitingAuth = ecazMoves ? allyAuth : ecazAuth;
  const g = await store.rooms.readRoom(code);
  g.players[0] = engine.newPlayer(ecazAuth.playerId, 'Ecaz', 'ecaz');
  Object.assign(g, {
    status: 'playing',
    phase: 5,
    turn: 2,
    advanced: true,
    expansions: ['ecaz'],
    storm: 18,
    active: activeAuth.playerId,
    order: auths.map((a) => a.playerId),
    movementRemaining: [activeAuth.playerId, nextAuth.playerId],
    response: null,
    decision: null,
    phaseOpening: null,
    deck: baseDeck(),
    discard: [],
  });
  for (const p of g.players)
    Object.assign(p, {
      forces: {},
      hand: [g.deck.shift()!],
      reserves: 20,
      tanks: 0,
      spice: 20,
      traitors: [p.leaders[0].id],
      traitorChoices: [],
      moved: 0,
      shipped: false,
    });
  player(g, ecazAuth.playerId).ally = allyAuth.playerId;
  player(g, allyAuth.playerId).ally = ecazAuth.playerId;
  player(g, waitingAuth.playerId).forces = { 'arrakeen:10': 2 };
  player(g, waitingAuth.playerId).reserves = 18;
  player(g, waitingAuth.playerId).shipped = true;
  player(g, waitingAuth.playerId).moved = 1;
  player(g, activeAuth.playerId).forces = { 'imperial_basin:10': 1 };
  player(g, activeAuth.playerId).reserves = 19;
  player(g, activeAuth.playerId).shipped = mode === 'move';
  const save = (state: engine.Game) =>
    store.sqlite
      .prepare('UPDATE rooms SET state = ?, version = ? WHERE code = ?')
      .run(JSON.stringify(state), state.version, code);
  save(g);
  store.writes.length = 0;
  const action: engine.Action =
    mode === 'ship'
      ? { type: 'ship', amount: 2, territory: 'arrakeen', sector: 10 }
      : {
          type: 'move',
          forces: { 'imperial_basin:10': 1 },
          territory: 'arrakeen',
          sector: 10,
        };
  return {
    ...store,
    code,
    tokens,
    auths,
    activeAuth,
    waitingAuth,
    nextAuth,
    save,
    initial: g,
    action,
  };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
async function fresh(f: Fixture) {
  f.rooms = f.restart();
  const auths = await Promise.all(
    f.tokens.map((t) => f.rooms.authenticate(f.code, t)),
  );
  assert.deepEqual(
    auths.map((a) => a.playerId),
    f.auths.map((a) => a.playerId),
  );
  return auths.find((a) => a.playerId === f.activeAuth.playerId)!;
}
async function privateViews(f: Fixture, g: engine.Game) {
  for (const auth of f.auths) {
    const view = await f.rooms.readSeatView(f.code, auth);
    assert.deepEqual(
      view.players.find((p) => p.id === auth.playerId)!.hand,
      player(g, auth.playerId).hand,
    );
    assert.ok(
      view.players.every((p) => p.id === auth.playerId || !('hand' in p)),
    );
  }
}
async function race(f: Fixture, g: engine.Game, action: engine.Action) {
  let release!: () => void;
  let arrivals = 0;
  const waiting = new Promise<void>((r) => {
    release = r;
  });
  f.writes.length = 0;
  f.hooks.beforeWrite = async () => {
    if (++arrivals === 2) release();
    await waiting;
  };
  const results = await Promise.allSettled([
    f.rooms.act(f.code, f.activeAuth, g.version, action, clock),
    f.restart().act(f.code, f.activeAuth, g.version, action, clock),
  ]);
  delete f.hooks.beforeWrite;
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(results.filter((r) => r.status === 'rejected').length, 1);
  assert.deepEqual(
    f.writes.map((w) => w.changes).sort((a, b) => a - b),
    [0, 1],
  );
  const after = await f.rooms.readRoom(f.code);
  assert.equal(after.version, g.version + 1);
  return after;
}
function conserved(g: engine.Game) {
  for (const p of g.players)
    assert.equal(
      p.reserves + p.tanks + Object.values(p.forces).reduce((a, b) => a + b, 0),
      20,
    );
  const cards = [...g.deck, ...g.discard, ...g.players.flatMap((p) => p.hand)];
  assert.equal(cards.length, baseDeck().length);
  assert.equal(new Set(cards.map((c) => c.id)).size, cards.length);
}
async function end(f: Fixture, g: engine.Game) {
  await fresh(f);
  const after = await race(f, g, { type: 'endMovement' });
  assert.equal(after.phase, 5);
  assert.equal(after.active, f.nextAuth.playerId);
  assert.ok(player(after, f.activeAuth.playerId).forces['arrakeen:10'] > 0);
  assert.equal(player(after, f.waitingAuth.playerId).forces['arrakeen:10'], 2);
  assert.equal(player(after, f.activeAuth.playerId).tanks, 0);
  assert.equal(player(after, f.waitingAuth.playerId).tanks, 0);
  assert.deepEqual(engine.normalizeAutomaticGame(clone(after)), clone(after));
  conserved(after);
  return after;
}
void test('ordinary paid shipment into an Ecaz ally territory survives refresh and duplicate CAS without repeating payment or destroying cooccupation at turn end', async () => {
  for (const ecazMoves of [true, false]) {
    const f = await fixture('ship', ecazMoves);
    try {
      const auth = await fresh(f);
      assert.equal(auth.playerId, f.activeAuth.playerId);
      await privateViews(f, f.initial);
      const after = await race(f, f.initial, f.action);
      const active = player(after, f.activeAuth.playerId);
      assert.equal(active.forces['arrakeen:10'], 2);
      assert.equal(active.reserves, 17);
      assert.equal(active.spice, 18);
      assert.equal(active.shipped, true);
      assert.equal(active.moved, 0);
      assert.deepEqual(active.hand, player(f.initial, active.id).hand);
      assert.deepEqual(
        player(after, f.waitingAuth.playerId),
        player(f.initial, f.waitingAuth.playerId),
      );
      await assert.rejects(() =>
        f.rooms.act(f.code, f.activeAuth, f.initial.version, f.action, clock),
      );
      assert.deepEqual(await f.rooms.readRoom(f.code), after);
      await privateViews(f, after);
      const done = await end(f, after);
      assert.equal(player(done, active.id).spice, 18);
      assert.equal(player(done, active.id).forces['arrakeen:10'], 2);
    } finally {
      f.sqlite.close();
    }
  }
});
void test('ordinary ground movement into either Ecaz alliance partner persists separately owned forces and ends after the ally has already moved', async () => {
  for (const ecazMoves of [true, false]) {
    const f = await fixture('move', ecazMoves);
    try {
      await fresh(f);
      const after = await race(f, f.initial, f.action);
      const active = player(after, f.activeAuth.playerId);
      assert.equal(active.forces['arrakeen:10'], 1);
      assert.equal(active.forces['imperial_basin:10'] ?? 0, 0);
      assert.equal(active.reserves, 19);
      assert.equal(active.spice, 20);
      assert.equal(active.moved, 1);
      assert.deepEqual(active.hand, player(f.initial, active.id).hand);
      await privateViews(f, after);
      await assert.rejects(() =>
        f.rooms.act(f.code, f.activeAuth, f.initial.version, f.action, clock),
      );
      assert.deepEqual(await f.rooms.readRoom(f.code), after);
      const done = await end(f, after);
      assert.equal(player(done, active.id).forces['arrakeen:10'], 1);
      assert.equal(player(done, active.id).spice, 20);
    } finally {
      f.sqlite.close();
    }
  }
});
void test('asymmetric saved alliance rejects real entry and end-turn requests before any SQL mutation', async () => {
  for (const mode of ['ship', 'move'] as const) {
    const f = await fixture(mode);
    try {
      const damaged = clone(f.initial);
      player(damaged, f.waitingAuth.playerId).ally = null;
      f.save(damaged);
      await fresh(f);
      f.writes.length = 0;
      await assert.rejects(
        () =>
          f.rooms.act(f.code, f.activeAuth, damaged.version, f.action, clock),
        /reciprocal/,
      );
      assert.equal(f.writes.length, 0);
      assert.deepEqual(await f.rooms.readRoom(f.code), damaged);
      // A genuinely committed cooccupation is then copied with damaged alliance data.
      f.save(f.initial);
      const committed = await race(f, f.initial, f.action);
      const corrupted = clone(committed);
      player(corrupted, f.waitingAuth.playerId).ally = null;
      f.save(corrupted);
      f.writes.length = 0;
      await assert.rejects(
        () =>
          f.rooms.act(
            f.code,
            f.activeAuth,
            corrupted.version,
            { type: 'endMovement' },
            clock,
          ),
        /reciprocal/,
      );
      assert.equal(f.writes.length, 0);
      assert.deepEqual(await f.rooms.readRoom(f.code), corrupted);
    } finally {
      f.sqlite.close();
    }
  }
});
