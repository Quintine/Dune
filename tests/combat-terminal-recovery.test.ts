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

type Source = 'combat' | 'gift';
async function fixture(source: Source, converted = true) {
  const store = unitStore();
  const made = await store.rooms.createRoom('BG', 'beneGesserit', false, []),
    code = made.view.code,
    tokens = [made.token];
  for (const [name, faction] of [
    ['Fremen', 'fremen'],
    ['Emperor', 'emperor'],
  ] as const)
    tokens.push((await store.rooms.joinRoom(code, name, faction)).token!);
  const seats = await Promise.all(
      tokens.map((token) => store.restart().authenticate(code, token)),
    ),
    ids = seats.map((s) => s.playerId);
  const old = await store.restart().readRoom(code);
  const g = engine.createGame(
    code,
    engine.newPlayer(ids[0], 'BG', 'beneGesserit'),
    true,
    [],
  );
  g.players.push(
    engine.newPlayer(ids[1], 'Fremen', 'fremen'),
    engine.newPlayer(ids[2], 'Emperor', 'emperor'),
  );
  // Genuine room identities with a bounded exposed phase fixture. All powers,
  // battle creation, card costs and saved conversion below use public actions.
  Object.assign(g, {
    version: old.version,
    status: 'playing',
    phase: source === 'combat' ? 6 : 5,
    turn: 2,
    storm: 18,
    active: ids[2],
    order: [ids[2], ids[1], ids[0]],
    movementRemaining: [ids[2], ids[1], ids[0]],
    deck: baseDeck(),
    phaseOpening: null,
    ready: [],
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
  function hold(index: number, kind: string) {
    const at = g.deck.findIndex((c) => c.kind === kind || c.effect === kind);
    assert.ok(at >= 0);
    const card = g.deck.splice(at, 1)[0];
    g.players[index].hand.push(card);
    return card;
  }
  const worthless = hold(0, 'worthless'),
    karama = hold(2, 'karama');
  if (source === 'combat')
    for (const index of [1, 2])
      Object.assign(g.players[index], {
        forces: { 'false_wall_south:4': 4 },
        reserves: 16,
      });
  else {
    g.players[1].ally = ids[2];
    g.players[2].ally = ids[1];
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
  const original = await act(
    2,
    source === 'combat'
      ? { type: 'chooseBattle', territory: 'false_wall_south', target: ids[1] }
      : { type: 'emperorGift', amount: 3 },
  );
  assert.equal(
    original.response?.kind,
    source === 'combat' ? 'fremenSupport' : 'emperorGift',
  );
  const pending = converted
    ? await act(0, { type: 'card', card: worthless.id, mode: 'cancel' })
    : original;
  if (converted) {
    assert.equal(pending.response?.kind, 'worthlessKarama');
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
    karama,
  };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
async function privateViews(f: Fixture) {
  for (const token of f.tokens) {
    const seat = await f.restart().authenticate(f.code, token),
      view = await f.restart().readSeatView(f.code, seat);
    assert.equal('pendingKarama' in view, false);
    assert.equal(JSON.stringify(view).includes('"signature"'), false);
    for (const p of view.players)
      if (p.id !== seat.playerId)
        for (const key of ['hand', 'spice', 'traitors', 'traitorChoices'])
          assert.equal(key in p, false);
  }
}
async function finishRace(f: Fixture) {
  await privateViews(f);
  await f.restart().continueRoomAutomatic(f.code, clock);
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
  assert.equal(done.pendingKarama, null);
  assert.equal(done.discard.filter((c) => c.id === f.worthless.id).length, 1);
  assert.ok(done.players[2].hand.some((c) => c.id === f.karama.id));
  assert.deepEqual(
    done.players.map((p) => ({
      spice: p.spice,
      forces: p.forces,
      reserves: p.reserves,
      tanks: p.tanks,
    })),
    f.original.players.map((p) => ({
      spice: p.spice,
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
        f.seats[2],
        f.pending.version,
        { type: 'passResponse' },
        clock,
      ),
    /changed/i,
  );
  assert.equal(f.writes.length, 2);
  return done;
}
void test('genuine Fremen support cancellation reloads and races one committed flag; subsequent sealed plan remains owner-private', async () => {
  const f = await fixture('combat');
  try {
    const done = await finishRace(f);
    assert.equal(done.battle!.fremenSupportBlocked, true);
    assert.equal(done.battle!.revealed, false);
    assert.equal(done.battle!.event, f.original.battle!.event);
    assert.deepEqual(done.battle!.plans, {});
    const leader = done.players[2].leaders[0].id;
    const sealed = await f.act(2, {
      type: 'battlePlan',
      leader,
      dial: 1,
      support: 1,
    });
    assert.ok(sealed.battle!.plans[f.ids[2]]);
    const mine = await f
      .restart()
      .readSeatView(
        f.code,
        await f.restart().authenticate(f.code, f.tokens[2]),
      );
    const other = await f
      .restart()
      .readSeatView(
        f.code,
        await f.restart().authenticate(f.code, f.tokens[1]),
      );
    assert.deepEqual(mine.battle!.plans, {
      [f.ids[2]]: sealed.battle!.plans[f.ids[2]],
    });
    assert.deepEqual(other.battle!.plans, {});
    assert.equal(JSON.stringify(other.battle).includes(leader), false);
    await privateViews(f);
    await f.restart().continueRoomAutomatic(f.code, clock);
    assert.deepEqual(await f.restart().readRoom(f.code), sealed);
  } finally {
    f.sqlite.close();
  }
});
void test('genuine Emperor gift cancellation retains both balances through fresh authenticated recovery and one final CAS winner', async () => {
  const f = await fixture('gift');
  try {
    const done = await finishRace(f);
    assert.equal(done.response, null);
    assert.deepEqual(
      done.players.map((p) => p.spice),
      [20, 20, 20],
    );
    await privateViews(f);
  } finally {
    f.sqlite.close();
  }
});
void test('malformed pending combat successor rejects before BG cost and after its durable allowance with zero SQL writes', async () => {
  for (const converted of [false, true]) {
    const f = await fixture('combat', converted);
    try {
      const mutations: ((g: engine.Game) => void)[] = [
        (g) => {
          g.battle!.powerChecks = [
            { kind: 'advisor', owner: f.ids[0] } as unknown as NonNullable<
              NonNullable<engine.Game['battle']>['powerChecks']
            >[number],
          ];
        },
        (g) => {
          g.battle!.powerChecks = [{ kind: 'kwisatz', owner: 'missing' }];
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
