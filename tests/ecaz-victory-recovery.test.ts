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
import { createStrongholdCards } from '../game/stronghold-cards';
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

/** Stage only a conserved end-Collection position in private in-memory SQLite.
 * Every readiness action, authentication, projection and CAS uses production code. */
async function fixture(advanced = true, joint = true) {
  const store = unitStore();
  const host = await store.rooms.createRoom('Ecaz', 'harkonnen', false, []);
  const code = host.view.code;
  const ally = await store.rooms.joinRoom(code, 'Ally', 'atreides');
  const rival = await store.rooms.joinRoom(code, 'Rival', 'emperor');
  const bg = await store.rooms.joinRoom(code, 'Predictor', 'beneGesserit');
  const tokens = [host.token, ally.token!, rival.token!, bg.token!];
  const auths = await Promise.all(
    tokens.map((t) => store.rooms.authenticate(code, t)),
  );
  const g = await store.rooms.readRoom(code);
  g.players[0] = engine.newPlayer(auths[0].playerId, 'Ecaz', 'ecaz');
  Object.assign(g, {
    status: 'playing',
    phase: 7,
    turn: 2,
    storm: 18,
    advanced,
    expansions: ['ecaz'],
    order: auths.map((a) => a.playerId),
    ready: [],
    active: null,
    response: null,
    decision: null,
    phaseOpening: null,
    deck: baseDeck(),
    discard: [],
  });
  for (const p of g.players)
    Object.assign(p, {
      forces: {},
      reserves: 20,
      tanks: 0,
      spice: 20,
      hand: [g.deck.shift()!],
      traitors: [p.leaders[0].id],
      traitorChoices: [],
    });
  g.players[0].ally = g.players[1].id;
  g.players[1].ally = g.players[0].id;
  const keys = ['arrakeen:10', 'carthag:11', 'sietch_tabr:14'];
  for (const [index, p] of g.players.slice(0, 2).entries()) {
    const locations = index === 1 && !joint ? keys.slice(0, 2) : keys;
    p.forces = Object.fromEntries(locations.map((k) => [k, 1]));
    p.reserves -= locations.length;
  }
  g.players[3].prediction = { faction: 'ecaz', turn: 3 };
  if (advanced) g.strongholdCards = createStrongholdCards();
  const save = (state: engine.Game) =>
    store.sqlite
      .prepare('UPDATE rooms SET state = ?, version = ? WHERE code = ?')
      .run(JSON.stringify(state), state.version, code);
  save(g);
  store.writes.length = 0;
  return { ...store, code, tokens, auths, initial: g, save };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
async function refresh(f: Fixture) {
  f.rooms = f.restart();
  const auths = await Promise.all(
    f.tokens.map((t) => f.rooms.authenticate(f.code, t)),
  );
  assert.deepEqual(
    auths.map((a) => a.playerId),
    f.auths.map((a) => a.playerId),
  );
  assert.ok(auths.every((a, i) => a.tokenHash === f.auths[i].tokenHash));
  return f.rooms.readRoom(f.code);
}
async function prepareFinalReady(f: Fixture) {
  for (const auth of f.auths.slice(0, -1)) {
    const current = await f.rooms.readRoom(f.code);
    await f.rooms.act(f.code, auth, current.version, { type: 'ready' }, clock);
  }
  const before = await refresh(f);
  assert.equal(before.phase, 7);
  assert.equal(before.status, 'playing');
  assert.deepEqual(
    before.ready,
    f.auths.slice(0, -1).map((a) => a.playerId),
  );
  return before;
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
async function assertPrivateViews(f: Fixture, g: engine.Game) {
  const views = await Promise.all(
    f.auths.map((a) => f.rooms.readSeatView(f.code, a)),
  );
  for (const [index, view] of views.entries()) {
    assert.deepEqual(view.victoryProgress, views[0].victoryProgress);
    for (const p of view.players) {
      if (p.id === f.auths[index].playerId) {
        assert.deepEqual(p.hand, player(g, p.id).hand);
        assert.deepEqual(p.prediction, player(g, p.id).prediction);
      } else {
        assert.equal('hand' in p, false);
        assert.equal('prediction' in p, false);
        assert.equal('traitors' in p, false);
      }
    }
    assert.ok(view.victoryProgress.every((row) => !('prediction' in row)));
  }
  return views;
}

void test('joint-three final readiness survives reload and concurrent CAS exactly once in Basic and Advanced', async () => {
  for (const advanced of [false, true]) {
    const f = await fixture(advanced);
    try {
      const other = await f.rooms.createRoom(
        'Unrelated human',
        'guild',
        false,
        [],
      );
      const untouched = await f.rooms.readRoom(other.view.code);
      const before = await prepareFinalReady(f);
      if (advanced) assert.equal(before.strongholdCards!.claimedTurn, 0);
      let release!: () => void;
      let arrivals = 0;
      const barrier = new Promise<void>((resolve) => {
        release = resolve;
      });
      f.writes.length = 0;
      f.hooks.beforeWrite = async () => {
        if (++arrivals === 2) release();
        await barrier;
      };
      const auth = f.auths[3];
      const outcomes = await Promise.allSettled([
        f.rooms.act(f.code, auth, before.version, { type: 'ready' }, clock),
        f.restart().act(f.code, auth, before.version, { type: 'ready' }, clock),
      ]);
      delete f.hooks.beforeWrite;
      assert.equal(outcomes.filter((r) => r.status === 'fulfilled').length, 1);
      assert.equal(outcomes.filter((r) => r.status === 'rejected').length, 1);
      assert.deepEqual(
        f.writes.map((w) => w.changes).sort((a, b) => a - b),
        [0, 1],
      );
      const done = await refresh(f);
      assert.equal(done.version, before.version + 1);
      assert.equal(done.status, 'finished');
      assert.equal(done.phase, 8);
      assert.deepEqual(
        done.winner,
        f.auths.slice(0, 2).map((a) => a.playerId),
      );
      assert.equal(
        done.log.filter((e) => e.text.includes('won the game')).length,
        1,
      );
      assert.match(
        done.log.find((e) => e.text.includes('won the game'))!.text,
        /Ecaz Occupy/,
      );
      if (advanced) {
        assert.equal(done.strongholdCards!.claimedTurn, done.turn);
        for (const id of ['arrakeen', 'carthag', 'sietch_tabr'] as const)
          assert.equal(done.strongholdCards!.owners[id], f.auths[0].playerId);
        assert.equal(done.strongholdCards!.owners.tueks_sietch, null);
      }
      conserved(done);
      await assertPrivateViews(f, done);
      assert.deepEqual(engine.normalizeAutomaticGame(clone(done)), clone(done));
      f.writes.length = 0;
      await assert.rejects(() =>
        f.rooms.act(f.code, auth, before.version, { type: 'ready' }, clock),
      );
      await assert.rejects(() =>
        f.rooms.act(f.code, auth, done.version, { type: 'ready' }, clock),
      );
      assert.deepEqual(f.writes, []);
      assert.deepEqual(await refresh(f), done);
      assert.deepEqual(await f.rooms.readRoom(other.view.code), untouched);
    } finally {
      f.sqlite.close();
    }
  }
});

void test('authenticated rival progress is prediction-independent and a correct secret prediction still overrides the joint win', async () => {
  const f = await fixture();
  try {
    const before = await prepareFinalReady(f);
    const originalViews = await assertPrivateViews(f, before);
    const variant = clone(before);
    variant.players[3].prediction = { faction: 'ecaz', turn: 2 };
    f.save(variant);
    await refresh(f);
    const changedViews = await assertPrivateViews(f, variant);
    for (let index = 0; index < 3; index++)
      assert.deepEqual(changedViews[index], originalViews[index]);
    assert.notDeepEqual(
      changedViews[3].players[3].prediction,
      originalViews[3].players[3].prediction,
    );
    await assert.rejects(() =>
      f.rooms.readSeatView(f.code, {
        ...f.auths[3],
        tokenHash: f.auths[2].tokenHash,
      }),
    );
    await f.rooms.act(
      f.code,
      f.auths[3],
      variant.version,
      { type: 'ready' },
      clock,
    );
    const done = await refresh(f);
    assert.equal(done.status, 'finished');
    assert.deepEqual(done.winner, [f.auths[3].playerId]);
    const finalViews = await assertPrivateViews(f, done);
    assert.deepEqual(
      finalViews[2].victoryProgress,
      originalViews[2].victoryProgress,
    );
    assert.equal(done.strongholdCards!.owners.arrakeen, f.auths[0].playerId);
    assert.equal(done.strongholdCards!.claimedTurn, 2);
    conserved(done);
  } finally {
    f.sqlite.close();
  }
});

void test('three union strongholds with only two cooccupied persist into Mentat without a premature victory', async () => {
  const f = await fixture(true, false);
  try {
    const before = await prepareFinalReady(f);
    await f.rooms.act(
      f.code,
      f.auths[3],
      before.version,
      { type: 'ready' },
      clock,
    );
    const after = await refresh(f);
    assert.equal(after.phase, 8);
    assert.equal(after.status, 'playing');
    assert.deepEqual(after.winner, []);
    assert.equal(
      after.log.filter((e) => e.text.includes('won the game')).length,
      0,
    );
    assert.equal(after.strongholdCards!.claimedTurn, 0);
    const views = await assertPrivateViews(f, after);
    const row = views[0].victoryProgress.find(
      (r) => r.player === f.auths[0].playerId,
    )!;
    assert.equal(row.strongholds.length, 3);
    assert.equal(row.jointlyOccupied.length, 2);
    assert.equal(row.qualifies, false);
    f.writes.length = 0;
    await assert.rejects(() =>
      f.rooms.act(f.code, f.auths[3], before.version, { type: 'ready' }, clock),
    );
    assert.deepEqual(f.writes, []);
    assert.deepEqual(await refresh(f), after);
    conserved(after);
  } finally {
    f.sqlite.close();
  }
});
