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
import { newRevivalRules } from '../game/revival';
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
async function fixture(source: Source, converted = true) {
  const store = unitStore();
  const made = await store.rooms.createRoom('BG', 'beneGesserit', false, [
      'choam',
    ]),
    code = made.view.code,
    tokens = [made.token];
  for (const [name, faction] of [
    ['CHOAM', 'choam'],
    ['Emperor', 'emperor'],
  ] as const)
    tokens.push((await store.rooms.joinRoom(code, name, faction)).token!);
  const seats = await Promise.all(
      tokens.map((token) => store.restart().authenticate(code, token)),
    ),
    ids = seats.map((s) => s.playerId),
    old = await store.restart().readRoom(code);
  const g = engine.createGame(
    code,
    engine.newPlayer(ids[0], 'BG', 'beneGesserit'),
    true,
    ['choam'],
  );
  g.players.push(
    engine.newPlayer(ids[1], 'CHOAM', 'choam'),
    engine.newPlayer(ids[2], 'Emperor', 'emperor'),
  );
  // Conserved exposed starting position only. Pending revival/storm, CHOAM
  // declaration, BG conversion and subsequent continuations are real actions.
  Object.assign(g, {
    version: old.version,
    status: 'playing',
    phase: source === 'revival' ? 4 : 0,
    turn: 2,
    active: source === 'revival' ? ids[1] : null,
    order: [...ids],
    deck: baseDeck(),
    discard: [],
    phaseOpening: null,
    ready: [],
    storm: source === 'revival' ? 18 : 5,
    revivalRules: newRevivalRules(),
  });
  for (const p of g.players)
    Object.assign(p, {
      hand: [],
      spice: 10,
      forces: {},
      reserves: 20,
      tanks: 0,
      traitors: [],
      traitorChoices: [],
      elites: undefined,
    });
  if (source === 'revival')
    Object.assign(g.players[2], { reserves: 14, tanks: 6 });
  else {
    g.stormPending = 3;
    Object.assign(g.players[1], { forces: { 'red_chasm:7': 4 }, reserves: 16 });
    Object.assign(g.players[2], { forces: { 'red_chasm:7': 3 }, reserves: 17 });
    g.spice = { 'red_chasm:7': 8, 'basin:9': 4 };
  }
  function hold(index: number, name: string) {
    const at = g.deck.findIndex((c) => c.name === name);
    assert.ok(at >= 0);
    const card = g.deck.splice(at, 1)[0];
    g.players[index].hand.push(card);
    return card;
  }
  const cost = hold(0, 'Baliset'),
    printed = hold(2, 'Karama'),
    declared = hold(1, source === 'revival' ? 'La La La' : 'Jubba Cloak');
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
  let prepared: engine.Game;
  if (source === 'revival') {
    prepared = await act(2, { type: 'revive', amount: 3 });
    assert.equal(prepared.decision?.kind, 'choamFreeRevival');
  } else {
    prepared = g;
    for (const index of [0, 1, 2])
      prepared = await act(index, { type: 'ready' });
    assert.equal(prepared.decision?.kind, 'choamStorm');
  }
  const original = await act(1, {
    type: 'card',
    mode: 'choam',
    card: declared.id,
    ...(source === 'storm' ? { territory: 'red_chasm' } : {}),
  });
  assert.equal(original.response?.kind, 'choamWorthless');
  const pending = converted
    ? await act(0, { type: 'card', mode: 'cancel', card: cost.id })
    : original;
  if (converted) assert.equal(pending.response?.kind, 'worthlessKarama');
  store.writes.length = 0;
  return {
    ...store,
    code,
    tokens,
    seats,
    ids,
    save,
    act,
    source,
    prepared,
    original,
    pending,
    cost,
    printed,
    declared,
  };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
async function privacy(f: Fixture) {
  for (const token of f.tokens) {
    const seat = await f.restart().authenticate(f.code, token),
      view = await f.restart().readSeatView(f.code, seat);
    assert.equal('pendingKarama' in view, false);
    assert.equal(JSON.stringify(view).includes('"signature"'), false);
    for (const p of view.players)
      if (p.id !== seat.playerId)
        for (const key of ['hand', 'spice', 'traitors', 'traitorChoices'])
          assert.equal(key in p, false);
    if (seat.playerId !== f.ids[1])
      assert.equal(JSON.stringify(view).includes(f.declared.id), false);
  }
}
async function race(f: Fixture) {
  await privacy(f);
  await f.restart().continueRoomAutomatic(f.code, clock);
  assert.equal(f.writes.length, 0);
  await assert.rejects(
    f
      .restart()
      .act(
        f.code,
        f.seats[0],
        f.pending.version,
        { type: 'card', card: f.printed.id, mode: 'cancel' },
        clock,
      ),
  );
  assert.equal(f.writes.length, 0);
  let count = 0,
    release!: () => void;
  const gate = new Promise<void>((r) => {
    release = r;
  });
  f.hooks.beforeWrite = async () => {
    if (++count === 2) release();
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
  assert.equal(done.pendingKarama ?? null, null);
  assert.equal(done.pendingChoamWorthless, null);
  assert.equal(done.discard.filter((c) => c.id === f.cost.id).length, 1);
  assert.equal(done.discard.filter((c) => c.id === f.declared.id).length, 0);
  assert.deepEqual(done.players[1].hand, f.original.players[1].hand);
  assert.ok(done.players[2].hand.some((c) => c.id === f.printed.id));
  assert.deepEqual(done.choamWorthlessBlocked, {
    turn: 2,
    phase: sourcePhase(f.source),
    cards: [f.declared.id],
  });
  assert.equal(
    done.log.filter((l) => /Worthless card effect was prevented/.test(l.text))
      .length,
    1,
  );
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
  await privacy(f);
  return done;
}
const sourcePhase = (source: Source) => (source === 'revival' ? 4 : 0);
void test('real reactive La La La cancellation races one saved allowance and completes the original mixed-price revival once with private hands retained', async () => {
  const f = await fixture('revival');
  try {
    assert.deepEqual(f.original.pendingRevival, {
      player: f.ids[2],
      kind: 'forces',
      amount: 3,
      elite: 0,
      free: 1,
      normalCost: 4,
      cost: 4,
      checks: [],
    });
    const done = await race(f),
      emperor = done.players[2];
    assert.equal(done.pendingRevival, null);
    assert.equal(done.response, null);
    assert.equal(done.decision, null);
    assert.equal(emperor.spice, 6);
    assert.equal(emperor.tanks, 3);
    assert.equal(emperor.reserves, 17);
    assert.equal(emperor.revived, 3);
    assert.equal(emperor.freeForcesRevived, 1);
    assert.equal(
      done.log.filter((l) => /revived 3 forces/.test(l.text)).length,
      1,
    );
    assert.equal(
      done.revivalRules?.freeBlocked?.includes(f.ids[2]) ?? false,
      false,
    );
    const v = await f
      .restart()
      .readSeatView(
        f.code,
        await f.restart().authenticate(f.code, f.tokens[2]),
      );
    assert.equal(v.revival.freeBlocked, false);
  } finally {
    f.sqlite.close();
  }
});
void test('real Jubba cancellation restores the threat decision once, then an actual decline traverses the saved storm without casualty or spice replay', async () => {
  const f = await fixture('storm');
  try {
    const done = await race(f);
    assert.equal(done.decision?.kind, 'choamStorm');
    assert.deepEqual(done.decision, f.prepared.decision);
    assert.deepEqual(done.stormResolution, f.original.stormResolution);
    assert.deepEqual(
      done.players.map((p) => [p.forces, p.tanks, p.reserves, p.spice]),
      f.original.players.map((p) => [p.forces, p.tanks, p.reserves, p.spice]),
    );
    const finished = await f.act(1, { type: 'decision', decline: true });
    assert.equal(finished.storm, 8);
    assert.equal(finished.stormResolution, null);
    assert.equal(finished.players[1].tanks, 4);
    assert.equal(finished.players[2].tanks, 3);
    assert.deepEqual(finished.spice, { 'basin:9': 4 });
    assert.equal(finished.decision?.kind, 'choamMarket');
    await Promise.all([
      f.restart().continueRoomAutomatic(f.code, clock),
      f.restart().continueRoomAutomatic(f.code, clock),
    ]);
    assert.deepEqual(await f.restart().readRoom(f.code), finished);
    await assert.rejects(
      f
        .restart()
        .act(
          f.code,
          f.seats[1],
          done.version,
          { type: 'decision', decline: true },
          clock,
        ),
      /changed/i,
    );
    assert.equal(
      finished.discard.filter((c) => c.id === f.declared.id).length,
      0,
    );
  } finally {
    f.sqlite.close();
  }
});
void test('malformed La La La saved amount, queue and contradictory Mentat branch reject before new BG cost and after paid declaration with zero writes', async () => {
  for (const converted of [false, true]) {
    const f = await fixture('revival', converted);
    try {
      const mutations: ((g: engine.Game) => void)[] = [
        (g) => {
          g.pendingRevival!.amount = 99;
        },
        (g) => {
          g.pendingRevival!.checks = null as never;
        },
        (g) => {
          g.pendingChoamWorthless!.mentat = true;
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
                : { type: 'card', mode: 'cancel', card: f.cost.id },
              clock,
            ),
        );
        assert.deepEqual(await f.restart().readRoom(f.code), bad);
        assert.equal(f.writes.length, 0);
        assert.equal(
          bad.discard.filter((c) => c.id === f.cost.id).length,
          converted ? 1 : 0,
        );
      }
    } finally {
      f.sqlite.close();
    }
  }
});
void test('malformed Jubba traversal and missing saved storm reject before spending and at the final saved allowance with zero writes', async () => {
  for (const converted of [false, true]) {
    const f = await fixture('storm', converted);
    try {
      const mutations: ((g: engine.Game) => void)[] = [
        (g) => {
          g.stormResolution = null;
        },
        (g) => {
          g.stormResolution!.pending = null as never;
        },
        (g) => {
          g.stormResolution!.traversed = 1;
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
                : { type: 'card', mode: 'cancel', card: f.cost.id },
              clock,
            ),
        );
        assert.deepEqual(await f.restart().readRoom(f.code), bad);
        assert.equal(f.writes.length, 0);
        assert.equal(
          bad.discard.filter((c) => c.id === f.cost.id).length,
          converted ? 1 : 0,
        );
      }
    } finally {
      f.sqlite.close();
    }
  }
});
