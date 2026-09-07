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

type Source = 'income' | 'capture';
async function fixture(source: Source, remaining = false, converted = true) {
  const store = unitStore();
  const made = await store.rooms.createRoom('BG', 'beneGesserit', false, []);
  const code = made.view.code,
    tokens = [made.token];
  for (const [name, faction] of [
    ['Winner', 'harkonnen'],
    ['Loser', 'emperor'],
    ['Fourth', 'guild'],
  ] as const)
    tokens.push((await store.rooms.joinRoom(code, name, faction)).token!);
  const seats = await Promise.all(
    tokens.map((token) => store.restart().authenticate(code, token)),
  );
  const ids = seats.map((seat) => seat.playerId);
  const saved = await store.restart().readRoom(code);
  const g = engine.createGame(
    code,
    engine.newPlayer(ids[0], 'BG', 'beneGesserit'),
    true,
    source === 'income' ? ['choam'] : [],
  );
  g.players.push(
    engine.newPlayer(ids[1], 'Winner', 'harkonnen'),
    engine.newPlayer(ids[2], 'Loser', 'emperor'),
    engine.newPlayer(ids[3], 'Fourth', source === 'income' ? 'choam' : 'guild'),
  );
  // Isolated physical component position with real authenticated room seats.
  // Every battle, aftermath response and cancellation is declared below.
  Object.assign(g, {
    version: saved.version,
    status: 'playing',
    phase: 6,
    turn: 2,
    storm: 18,
    active: ids[1],
    order: [ids[1], ids[2], ids[0], ids[3]],
    deck: baseDeck(),
    phaseOpening: null,
    spice: { 'arrakeen:10': 5 },
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
  for (const index of [1, 2]) {
    g.players[index].forces = {
      'arrakeen:10': 4,
      ...(remaining ? { 'red_chasm:7': 2 } : {}),
    };
    g.players[index].reserves = remaining ? 14 : 16;
  }
  g.players[0].ally = ids[3];
  g.players[3].ally = ids[0];
  // Existing saved Battle states can carry refundable escrow. This receipt is
  // explicit fixture data, not a claim that BG can newly pledge during Battle.
  g.players[0].spice = 18;
  g.aid = { [ids[0]]: { recipient: ids[3], amount: 2 } };
  function hold(index: number, kind: string) {
    const at = g.deck.findIndex((c) => c.kind === kind || c.effect === kind);
    assert.ok(at >= 0);
    const card = g.deck.splice(at, 1)[0];
    g.players[index].hand.push(card);
    return card;
  }
  const worthless = hold(0, 'worthless'),
    printed = hold(2, 'karama');
  hold(3, 'shield'); // A private, unrelated physical hand survives the aftermath.
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
  await act(1, { type: 'chooseBattle', territory: 'arrakeen', target: ids[2] });
  let state = await store.restart().readRoom(code);
  for (let tries = 0; state.response || state.battle?.preparation; tries++) {
    assert.ok(tries < 20);
    if (state.response) {
      const index = ids.findIndex((id) => !state.response!.passed.includes(id));
      state = await act(index, { type: 'passResponse' });
    } else
      state = await act(ids.indexOf(state.battle!.preparation!.owner), {
        type: 'declineBattlePower',
      });
  }
  const winner = state.players[1].leaders.reduce((a, b) =>
      a.strength > b.strength ? a : b,
    ),
    loser = state.players[2].leaders.reduce((a, b) =>
      a.strength < b.strength ? a : b,
    );
  state = await act(1, {
    type: 'battlePlan',
    dial: 3,
    support: 3,
    leader: winner.id,
  });
  const sealed = await store.restart().readSeatView(code, seats[2]);
  assert.equal(sealed.battle!.plans[ids[1]], undefined);
  await act(2, { type: 'battlePlan', dial: 0, support: 0, leader: loser.id });
  await act(1, { type: 'traitorCall', call: false });
  state = await act(2, { type: 'traitorCall', call: false });
  assert.equal(state.lastBattleContext?.winner, ids[1]);
  assert.equal(state.players[1].tanks, 3);
  assert.equal(state.players[2].tanks, 4);
  if (source === 'income') {
    assert.equal(state.response?.kind, 'choamBattleIncome');
    assert.equal(state.pendingChoamBattleIncome?.amount, 1);
  } else {
    assert.equal(state.decision?.kind, 'captureOffer');
    state = await act(1, { type: 'decision', accept: true });
    assert.equal(state.response?.kind, 'capture');
  }
  const original = state,
    pending = converted
      ? await act(0, { type: 'card', card: worthless.id, mode: 'cancel' })
      : original;
  if (converted) {
    assert.equal(pending.response?.kind, 'worthlessKarama');
    assert.equal(pending.pendingKarama?.opportunity?.kind, 'cancel');
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
    source,
    remaining,
  };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
const reload = (g: engine.Game): engine.Game => JSON.parse(JSON.stringify(g));
function inventory(g: engine.Game) {
  const ids = [...g.deck, ...g.discard, ...g.players.flatMap((p) => p.hand)]
    .map((c) => c.id)
    .sort();
  assert.equal(new Set(ids).size, ids.length);
  return ids;
}
async function privateRead(f: Fixture) {
  const before = await f.restart().readRoom(f.code);
  for (const token of f.tokens) {
    const auth = await f.restart().authenticate(f.code, token);
    const view = await f.restart().readSeatView(f.code, auth);
    for (const key of [
      'pendingKarama',
      'pendingChoamBattleIncome',
      'pendingCapture',
      'lastBattleContext',
    ])
      assert.equal(key in view, false);
    assert.equal(JSON.stringify(view).includes('"signature"'), false);
    for (const p of view.players)
      if (p.id !== auth.playerId)
        for (const key of ['hand', 'spice', 'traitors'])
          assert.equal(key in p, false);
  }
  assert.deepEqual(await f.restart().readRoom(f.code), before);
}
async function race(
  f: Fixture,
  actor: number,
  action: engine.Action,
  state = f.pending,
) {
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
      f.restart().act(f.code, f.seats[actor], state.version, action, clock),
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
  assert.equal(done.version, state.version + 1);
  assert.deepEqual(inventory(done), inventory(f.original));
  return done;
}
async function stable(f: Fixture, done: engine.Game) {
  const count = f.writes.length;
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
  assert.equal(f.writes.length, count);
  await privateRead(f);
}

void test('persisted real CHOAM battle-income cancellation commits once and restores the genuine capture decision without paying or rerolling', async () => {
  const f = await fixture('income');
  try {
    await privateRead(f);
    await assert.rejects(
      f
        .restart()
        .act(
          f.code,
          f.seats[3],
          f.pending.version,
          { type: 'decision', accept: true },
          clock,
        ),
    );
    assert.deepEqual(await f.restart().readRoom(f.code), f.pending);
    assert.equal(f.writes.length, 0);
    await f.restart().continueRoomAutomatic(f.code, clock);
    assert.equal(f.writes.length, 0);
    const done = await race(f, 2, { type: 'passResponse' });
    assert.equal(done.pendingKarama, null);
    assert.equal(done.pendingChoamBattleIncome, null);
    assert.equal(done.decision?.kind, 'captureOffer');
    assert.equal(done.decision?.player, f.ids[1]);
    assert.equal(done.players[3].spice, 20);
    assert.equal(done.players[1].tanks, 3);
    assert.equal(done.players[2].tanks, 4);
    assert.equal(done.discard.filter((c) => c.id === f.worthless.id).length, 1);
    assert.equal(
      done.players.flatMap((p) => p.leaders).some((l) => !!l.capturedBy),
      false,
    );
    assert.equal(
      done.log.filter((l) =>
        l.text.includes('used Karama to cancel choamBattleIncome'),
      ).length,
      1,
    );
    await stable(f, done);
  } finally {
    f.sqlite.close();
  }
});
void test('persisted capture cancellation resumes a remaining battle or refunds and collects once when the battle phase ends', async () => {
  for (const remaining of [true, false]) {
    const f = await fixture('capture', remaining);
    try {
      await privateRead(f);
      const done = await race(f, 2, { type: 'passResponse' });
      assert.equal(done.pendingCapture, null);
      assert.equal(done.pendingKarama, null);
      assert.equal(
        done.players.flatMap((p) => p.leaders).some((l) => !!l.capturedBy),
        false,
      );
      assert.equal(done.players[1].tanks, 3);
      assert.equal(done.players[2].tanks, 4);
      assert.equal(
        done.discard.filter((c) => c.id === f.worthless.id).length,
        1,
      );
      if (remaining) {
        assert.equal(done.phase, 6);
        assert.equal(done.active, f.ids[1]);
        assert.equal(done.spice['arrakeen:10'], 5);
        assert.equal(done.aid[f.ids[0]].amount, 2);
      } else {
        assert.equal(done.phase, 7);
        assert.equal(done.spice['arrakeen:10'], 2);
        assert.equal(done.players[1].spice, 22);
        assert.equal(done.players[0].spice, 20);
        assert.deepEqual(done.aid, {});
      }
      await stable(f, done);
    } finally {
      f.sqlite.close();
    }
  }
});
void test('a genuine printed capture cancellation submitted twice from one version spends one card and applies no extra casualty or collection', async () => {
  const f = await fixture('capture', false, false);
  try {
    const done = await race(
      f,
      2,
      { type: 'card', card: f.printed.id, mode: 'cancel' },
      f.original,
    );
    assert.equal(done.pendingCapture, null);
    assert.equal(done.phase, 7);
    assert.equal(done.discard.filter((c) => c.id === f.printed.id).length, 1);
    assert.ok(done.players[0].hand.some((c) => c.id === f.worthless.id));
    assert.equal(done.players[1].spice, 22);
    assert.equal(done.players[0].spice, 20);
    assert.equal(done.players[1].tanks, 3);
    assert.equal(done.players[2].tanks, 4);
    await stable(f, done);
  } finally {
    f.sqlite.close();
  }
});
void test('malformed immediate post-capture board, aid and collection state rejects both new costs and an already-paid allowance with zero SQL writes', async () => {
  for (const converted of [false, true]) {
    const f = await fixture('capture', false, converted);
    try {
      const mutations: ((g: engine.Game) => void)[] = [
        (g) => {
          g.order[1] = g.order[0];
        },
        (g) => {
          g.players[3].forces['red_chasm:8'] = 1;
        },
        (g) => {
          g.players[3].forces['red_chasm:7'] = -1;
        },
        (g) => {
          g.aid[f.ids[0]].amount = -1;
        },
        (g) => {
          g.aid['absent-donor'] = { recipient: f.ids[1], amount: 2 };
        },
        (g) => {
          g.players[0].spice = Number.MAX_SAFE_INTEGER;
        },
        (g) => {
          g.spice['arrakeen:10'] = -1;
        },
      ];
      for (const change of mutations) {
        const bad = reload(f.pending);
        change(bad);
        f.save(bad);
        for (const card of converted ? [null] : [f.worthless, f.printed]) {
          await assert.rejects(
            f
              .restart()
              .act(
                f.code,
                f.seats[converted || card?.id === f.printed.id ? 2 : 0],
                bad.version,
                converted
                  ? { type: 'passResponse' }
                  : { type: 'card', card: card!.id, mode: 'cancel' },
                clock,
              ),
          );
          assert.deepEqual(await f.restart().readRoom(f.code), bad);
          assert.equal(f.writes.length, 0);
        }
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
