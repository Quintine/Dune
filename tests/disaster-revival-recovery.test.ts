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

type Source = 'revival' | 'storm';
async function fixture(source: Source, convert = true) {
  const store = unitStore();
  const made = await store.rooms.createRoom('BG', 'beneGesserit', false, []);
  const code = made.view.code,
    tokens = [made.token];
  for (const [name, faction] of [
    ['Target', 'guild'],
    ['Emperor', 'emperor'],
  ] as const)
    tokens.push((await store.rooms.joinRoom(code, name, faction)).token!);
  const seats = await Promise.all(
    tokens.map((token) => store.restart().authenticate(code, token)),
  );
  const ids = seats.map((s) => s.playerId);
  const initial = await store.restart().readRoom(code);
  const g = engine.createGame(
    code,
    engine.newPlayer(ids[0], 'BG', 'beneGesserit'),
    true,
    ['ix'],
  );
  g.players.push(
    engine.newPlayer(
      ids[1],
      'Target',
      source === 'revival' ? 'tleilaxu' : 'fremen',
    ),
    engine.newPlayer(ids[2], 'Emperor', 'emperor'),
  );
  // Documented phase fixture with real credentials, physical deck and public
  // declaration actions below; this does not bypass the expansion start gate.
  Object.assign(g, {
    version: initial.version,
    status: 'playing',
    phase: source === 'revival' ? 4 : 0,
    turn: source === 'revival' ? 2 : 1,
    active: ids[1],
    storm: 6,
    order: [ids[1], ids[2], ids[0]],
    ready: [],
    deck: baseDeck(),
    phaseOpening: null,
    stormDialers: source === 'storm' ? [ids[1], ids[2]] : [],
    stormDials: {},
  });
  for (const p of g.players)
    Object.assign(p, {
      hand: [],
      spice: 20,
      forces: {},
      reserves: 20,
      tanks: 0,
      traitors: [],
      traitorChoices: [],
    });
  const hold = (index: number, kind: string) => {
    const at = g.deck.findIndex((c) => c.kind === kind || c.effect === kind);
    assert.ok(at >= 0);
    const card = g.deck.splice(at, 1)[0];
    g.players[index].hand.push(card);
    return card;
  };
  const worthless = hold(0, 'worthless'),
    printed = hold(2, 'karama');
  if (source === 'revival') {
    Object.assign(g.players[1], {
      tanks: 10,
      reserves: 10,
      specialKaramaUsed: true,
    });
    // The once-per-turn free-revival reward has already been received; this
    // keeps the test focused on the cancellation's own price and force return.
    g.revivalFreeIncome = { [ids[1]]: g.turn };
  } else {
    g.players[1].forces = { 'red_chasm:7': 4 };
    g.players[1].reserves = 16;
    g.players[1].elites = {
      forces: { 'red_chasm:7': 2 },
      reserves: 1,
      tanks: 0,
      revived: 0,
    };
  }
  const save = (state: engine.Game) =>
    store.sqlite
      .prepare('UPDATE rooms SET state=?,version=? WHERE code=?')
      .run(JSON.stringify(state), state.version, code);
  save(g);
  async function act(index: number, action: engine.Action) {
    const state = await store.restart().readRoom(code);
    await store.restart().act(code, seats[index], state.version, action, clock);
    return store.restart().readRoom(code);
  }
  let original: engine.Game;
  if (source === 'revival')
    original = await act(1, { type: 'revive', amount: 3 });
  else {
    await act(1, { type: 'stormDial', amount: 1 });
    await act(2, { type: 'stormDial', amount: 0 });
    for (const index of [0, 1, 2]) await act(index, { type: 'ready' });
    original = await store.restart().readRoom(code);
  }
  assert.equal(
    original.response?.kind,
    source === 'revival' ? 'revivalDiscount' : 'stormProtection',
  );
  const pending = convert
    ? await act(0, { type: 'card', card: worthless.id, mode: 'cancel' })
    : original;
  if (convert) {
    assert.equal(pending.response?.kind, 'worthlessKarama');
    assert.equal(pending.pendingKarama?.opportunity?.kind, 'cancel');
    assert.equal(
      pending.discard.filter((c) => c.id === worthless.id).length,
      1,
    );
  }
  store.writes.length = 0;
  return {
    ...store,
    code,
    tokens,
    seats,
    ids,
    save,
    act,
    original,
    pending,
    worthless,
    printed,
  };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
function physical(g: engine.Game) {
  const cards = [...g.deck, ...g.discard, ...g.players.flatMap((p) => p.hand)]
    .map((c) => c.id)
    .sort();
  assert.equal(new Set(cards).size, cards.length);
  return cards;
}
async function views(f: Fixture) {
  for (const token of f.tokens) {
    const seat = await f.restart().authenticate(f.code, token);
    const view = await f.restart().readSeatView(f.code, seat);
    assert.equal('pendingKarama' in view, false);
    assert.equal('pendingRevival' in view, false);
    assert.equal(JSON.stringify(view).includes('"signature"'), false);
    for (const p of view.players)
      if (p.id !== seat.playerId)
        for (const key of ['hand', 'spice', 'traitors'])
          assert.equal(key in p, false);
  }
}
async function finishRace(f: Fixture) {
  await views(f);
  await f.restart().continueRoomAutomatic(f.code, clock);
  assert.equal(
    f.writes.length,
    0,
    'the remaining human blocker must be allowed to decide',
  );
  let arrivals = 0,
    release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  f.hooks.beforeWrite = async () => {
    if (++arrivals === 2) release();
    await gate;
  };
  const results = await Promise.allSettled(
    [0, 1].map(() =>
      f
        .restart()
        .act(
          f.code,
          f.seats[2],
          f.pending.version,
          { type: 'passResponse' },
          clock,
        ),
    ),
  );
  f.hooks.beforeWrite = undefined;
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(results.filter((r) => r.status === 'rejected').length, 1);
  assert.deepEqual(
    f.writes.map((w) => w.changes).sort((a, b) => a - b),
    [0, 1],
  );
  const done = await f.restart().readRoom(f.code);
  assert.equal(done.version, f.pending.version + 1);
  assert.equal(done.pendingKarama, null);
  assert.equal(done.discard.filter((c) => c.id === f.worthless.id).length, 1);
  assert.ok(done.players[2].hand.some((c) => c.id === f.printed.id));
  assert.deepEqual(physical(done), physical(f.original));
  await Promise.all([
    f.restart().continueRoomAutomatic(f.code, clock),
    f.restart().continueRoomAutomatic(f.code, clock),
  ]);
  assert.deepEqual(await f.restart().readRoom(f.code), done);
  await assert.rejects(
    f
      .restart()
      .act(
        f.code,
        f.seats[2],
        f.pending.version,
        { type: 'passResponse' },
        clock,
      ),
    /changed/i,
  );
  assert.equal(f.writes.length, 2);
  await views(f);
  return done;
}
void test('genuine BG revival-discount cancellation reloads its paid cost and commits one repriced revival under concurrent final allowance', async () => {
  const f = await fixture('revival');
  try {
    const done = await finishRace(f),
      before = f.original.players[1],
      after = done.players[1];
    assert.equal(done.pendingRevival, null);
    assert.equal(done.revivalRules!.fullPrice, true);
    assert.equal(
      after.spice,
      before.spice - f.original.pendingRevival!.normalCost,
    );
    assert.equal(after.tanks, before.tanks - 3);
    assert.equal(after.reserves, before.reserves + 3);
    assert.equal(after.revived, before.revived + 3);
    assert.equal(
      done.log.filter((l) => l.text === `${after.name} revived 3 forces.`)
        .length,
      1,
    );
  } finally {
    f.sqlite.close();
  }
});
void test('genuine BG storm-protection cancellation reloads and applies typed storm losses exactly once under competing workers', async () => {
  const f = await fixture('storm');
  try {
    const done = await finishRace(f),
      target = done.players[1];
    assert.equal(target.forces['red_chasm:7'], undefined);
    assert.equal(target.elites!.forces['red_chasm:7'], undefined);
    assert.equal(target.tanks, 4);
    assert.equal(target.elites!.tanks, 2);
    assert.equal(target.reserves, 16);
    assert.equal(target.elites!.reserves, 1);
    assert.equal(done.storm, 7);
    assert.equal(done.stormResolution, null);
  } finally {
    f.sqlite.close();
  }
});
void test('malformed current revival or storm typed custody rejects both before conversion and after its durable cost with zero SQL writes', async () => {
  for (const source of ['revival', 'storm'] as const)
    for (const converted of [false, true]) {
      const f = await fixture(source, converted);
      try {
        const mutations: ((g: engine.Game) => void)[] =
          source === 'revival'
            ? [
                (g) => {
                  g.players[1].tanks = 0;
                },
                (g) => {
                  g.players[1].reserves = Number.MAX_SAFE_INTEGER;
                },
              ]
            : [
                (g) => {
                  g.players[1].elites!.forces['red_chasm:7'] = 99;
                },
                (g) => {
                  g.players[1].elites!.tanks = -1;
                },
              ];
        for (const mutate of mutations) {
          const bad = structuredClone(f.pending);
          mutate(bad);
          f.save(bad);
          await assert.rejects(
            f
              .restart()
              .act(
                f.code,
                f.seats[converted ? 2 : 0],
                bad.version,
                converted
                  ? { type: 'passResponse' }
                  : { type: 'card', card: f.worthless.id, mode: 'cancel' },
                clock,
              ),
          );
          assert.deepEqual(await f.restart().readRoom(f.code), bad);
          assert.equal(f.writes.length, 0);
          assert.equal(
            bad.discard.filter((c) => c.id === f.worthless.id).length,
            converted ? 1 : 0,
          );
        }
      } finally {
        f.sqlite.close();
      }
    }
});
