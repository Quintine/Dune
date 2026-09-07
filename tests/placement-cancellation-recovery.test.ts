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
import { createAmbassadors } from '../game/ecaz-ambassadors';
import { createTerrorState } from '../game/moritani-terror';
import { createDukeVidal } from '../game/duke-vidal';
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

type Source = 'ecaz' | 'terror' | 'duke';
async function fixture(source: Source, converted = true) {
  const store = unitStore(),
    ownerFaction = source === 'ecaz' ? 'ecaz' : 'moritani';
  const made = await store.rooms.createRoom('Owner', ownerFaction, false, [
      'ecaz',
    ]),
    code = made.view.code,
    tokens = [made.token];
  for (const [name, faction] of [
    ['Emperor', 'emperor'],
    ['BG', 'beneGesserit'],
  ] as const)
    tokens.push((await store.rooms.joinRoom(code, name, faction)).token!);
  const seats = await Promise.all(
      tokens.map((t) => store.restart().authenticate(code, t)),
    ),
    ids = seats.map((s) => s.playerId),
    old = await store.restart().readRoom(code);
  const g = engine.createGame(
    code,
    engine.newPlayer(ids[0], 'Owner', ownerFaction),
    true,
    ['ecaz'],
  );
  g.players.push(
    engine.newPlayer(ids[1], 'Emperor', 'emperor'),
    engine.newPlayer(ids[2], 'BG', 'beneGesserit'),
  );
  // The exposed starting position is staged and physically conserved. Responses,
  // source decisions, donation, victory and card costs below are real actions.
  Object.assign(g, {
    version: old.version,
    status: 'playing',
    phase: source === 'ecaz' ? 4 : source === 'terror' ? 7 : 5,
    turn: 2,
    storm: 18,
    order: [...ids],
    deck: baseDeck(),
    discard: [],
    ready: [],
    phaseOpening: null,
  });
  for (const p of g.players)
    Object.assign(p, {
      hand: [],
      forces: {},
      reserves: 20,
      tanks: 0,
      spice: 20,
      traitors: [],
      traitorChoices: [],
      elites: undefined,
    });
  const hold = (index: number, name: string) => {
    const at = g.deck.findIndex((c) => c.name === name);
    assert.ok(at >= 0);
    const c = g.deck.splice(at, 1)[0];
    g.players[index].hand.push(c);
    return c;
  };
  const cost = hold(2, 'Baliset'),
    printed = hold(1, 'Karama');
  if (source === 'ecaz') g.ecazAmbassadors = createAmbassadors(() => 0);
  else if (source === 'terror') {
    g.moritaniTerror = createTerrorState(() => 0.4);
    Object.assign(g.players[0], {
      forces: { 'arrakeen:10': 1, 'carthag:11': 1, 'tueks_sietch:5': 1 },
      reserves: 17,
    });
  } else {
    g.dukeVidal = createDukeVidal();
    g.active = ids[1];
    g.movementRemaining = [ids[1]];
    for (const p of g.players.slice(0, 2))
      Object.assign(p, {
        forces: { 'arrakeen:10': 3, 'carthag:11': 3 },
        reserves: 14,
      });
    g.players[0].ally = ids[2];
    g.players[2].ally = ids[0];
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
  let original: engine.Game,
    token: string | null = null;
  if (source === 'duke') {
    await act(2, { type: 'pledgeAid', amount: 3 });
    original = await act(1, { type: 'endMovement' });
    assert.equal(original.response?.kind, 'moritaniDuke');
    assert.equal(original.players[2].spice, 17);
    assert.equal(original.aid[ids[2]].amount, 3);
  } else {
    let state = g;
    for (const i of [0, 1, 2]) state = await act(i, { type: 'ready' });
    assert.equal(
      state.decision?.kind,
      source === 'ecaz' ? 'ecazPlacement' : 'moritaniPlacement',
    );
    assert.equal(state.status, 'playing');
    assert.deepEqual(state.winner, []);
    token =
      source === 'ecaz'
        ? state.ecazAmbassadors!.tokens.find((t) => t.zone === 'supply')!.id
        : state.moritaniTerror!.tokens[0].id;
    original = await act(0, { type: 'decision', token, territory: 'arrakeen' });
    assert.equal(
      original.response?.kind,
      source === 'ecaz' ? 'ecazPlacement' : 'moritaniPlacement',
    );
  }
  const pending = converted
    ? await act(2, { type: 'card', mode: 'cancel', card: cost.id })
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
    original,
    pending,
    cost,
    printed,
    token,
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
    if (f.source === 'terror' && seat.playerId !== f.ids[0])
      assert.equal(JSON.stringify(view).includes(f.token!), false);
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
        f.seats[2],
        f.pending.version,
        { type: 'card', mode: 'cancel', card: f.printed.id },
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
  const outcomes = await Promise.allSettled(
    [0, 1].map(() =>
      f
        .restart()
        .act(
          f.code,
          f.seats[1],
          f.pending.version,
          { type: 'passResponse' },
          clock,
        ),
    ),
  );
  f.hooks.beforeWrite = undefined;
  assert.equal(outcomes.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(outcomes.filter((r) => r.status === 'rejected').length, 1);
  assert.deepEqual(
    f.writes.map((w) => w.changes).sort((a, b) => a - b),
    [0, 1],
  );
  const done = await f.restart().readRoom(f.code);
  assert.equal(done.version, f.pending.version + 1);
  assert.equal(done.pendingKarama ?? null, null);
  assert.equal(done.discard.filter((c) => c.id === f.cost.id).length, 1);
  assert.ok(done.players[1].hand.some((c) => c.id === f.printed.id));
  assert.deepEqual(done.deck, f.original.deck);
  assert.deepEqual(
    done.players.map((p) => ({
      hand: p.hand,
      forces: p.forces,
      reserves: p.reserves,
      tanks: p.tanks,
    })),
    f.pending.players.map((p) => ({
      hand: p.hand,
      forces: p.forces,
      reserves: p.reserves,
      tanks: p.tanks,
    })),
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
        f.seats[1],
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
void test('genuine Ecaz placement cancellation races once into a complete movement queue with tokens and placement spice untouched', async () => {
  const f = await fixture('ecaz');
  try {
    const done = await race(f);
    assert.equal(done.phase, 5);
    assert.equal(done.active, f.ids[0]);
    assert.deepEqual(done.movementRemaining, f.ids);
    assert.equal(new Set(done.movementRemaining).size, 3);
    assert.equal(done.pendingEcazPlacement, null);
    assert.equal(done.ecazPlacementTurn, 2);
    assert.deepEqual(
      done.ecazAmbassadors!.tokens,
      f.original.ecazAmbassadors!.tokens,
    );
    assert.deepEqual(done.ecazAmbassadors!.placement, {
      turn: 2,
      count: 0,
      blocked: true,
    });
    assert.deepEqual(
      done.players.map((p) => p.spice),
      [20, 20, 20],
    );
    assert.ok(done.players.every((p) => !p.shipped && p.moved === 0));
    const moved = await f.act(0, { type: 'endMovement' });
    assert.deepEqual(moved.movementRemaining, f.ids.slice(1));
    assert.equal(moved.active, f.ids[1]);
    await f.restart().continueRoomAutomatic(f.code, clock);
    assert.deepEqual(await f.restart().readRoom(f.code), moved);
  } finally {
    f.sqlite.close();
  }
});
void test('genuine Moritani placement cancellation preserves every hidden token and computes its deferred victory once under racing final allowances', async () => {
  const f = await fixture('terror');
  try {
    const done = await race(f);
    assert.equal(done.phase, 8);
    assert.equal(done.status, 'finished');
    assert.deepEqual(done.winner, [f.ids[0]]);
    assert.equal(done.pendingMoritaniPlacement, null);
    assert.equal(done.moritaniTerror!.placementTurn, 2);
    assert.deepEqual(
      done.moritaniTerror!.tokens,
      f.original.moritaniTerror!.tokens,
    );
    assert.deepEqual(
      done.players.map((p) => p.spice),
      [20, 20, 20],
    );
    assert.equal(done.log.filter((l) => /won the game/.test(l.text)).length, 1);
  } finally {
    f.sqlite.close();
  }
});
void test('genuine Duke denial retains the shared disc and refunds an actual pledged donation once before opening the first battle', async () => {
  const f = await fixture('duke');
  try {
    const done = await race(f);
    assert.equal(done.phase, 6);
    assert.equal(done.active, f.ids[0]);
    assert.equal(done.battle, null);
    assert.deepEqual(done.dukeVidal, f.original.dukeVidal);
    assert.equal(done.dukeAcquisitionTurn, 2);
    assert.deepEqual(done.aid, {});
    assert.deepEqual(
      done.players.map((p) => p.spice),
      [20, 20, 20],
    );
    assert.deepEqual(done.movementRemaining, []);
    const battle = await f.act(0, {
      type: 'chooseBattle',
      territory: 'arrakeen',
      target: f.ids[1],
    });
    assert.equal(battle.battle?.territory, 'arrakeen');
    assert.equal(battle.dukeVidal?.controller, null);
    assert.equal(battle.players[2].spice, 20);
  } finally {
    f.sqlite.close();
  }
});
void test('corrupted movement order, victory alliance and refund from real declarations reject before BG cost and final paid allowance without SQL writes', async () => {
  for (const source of ['ecaz', 'terror', 'duke'] as const)
    for (const converted of [false, true]) {
      const f = await fixture(source, converted);
      try {
        const bad = structuredClone(f.pending);
        if (source === 'ecaz') bad.order = [f.ids[0], f.ids[0], f.ids[2]];
        else if (source === 'terror') bad.players[0].ally = 'missing';
        else bad.aid[f.ids[2]].amount = -50;
        f.save(bad);
        await assert.rejects(
          f
            .restart()
            .act(
              f.code,
              f.seats[converted ? 1 : 2],
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
      } finally {
        f.sqlite.close();
      }
    }
});
