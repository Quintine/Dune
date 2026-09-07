import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as engine from '../game/engine';
import * as bots from '../game/bots';
import { treacheryDeck } from '../game/cards';
import { createTechTokens } from '../game/tech-tokens';
import type * as Rooms from '../db/rooms';
import { createRequire } from 'node:module';

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

/** Observe the real dispatcher before its public wrapper drains the saved frame. */
const observed: { applyActionInner?: typeof engine.applyAction } = {};
runInNewContext(
  ts.transpileModule(
    readFileSync(new URL('../game/engine.ts', import.meta.url), 'utf8') +
      '\nexport { applyActionInner };\n',
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText,
  {
    exports: observed,
    require: createRequire(new URL('../game/engine.ts', import.meta.url)),
    crypto: webcrypto,
    structuredClone,
    TextEncoder,
    JSON,
  },
);
function inner(g: engine.Game, id: string, action: engine.Action): engine.Game {
  const before = structuredClone(g);
  const next = JSON.parse(
    JSON.stringify(observed.applyActionInner!(g, id, action)),
  );
  assert.deepEqual(g, before);
  return next;
}

type Effect = 'hajr' | 'ghola' | 'harvester' | 'weather' | 'atomics';
async function fixture(effect: Effect) {
  const store = unitStore();
  const created = await store.rooms.createRoom(
    'Card owner',
    'emperor',
    false,
    [],
  );
  const code = created.view.code;
  const other = await store.rooms.joinRoom(code, 'Other', 'harkonnen');
  const observer = await store.rooms.joinRoom(code, 'Observer', 'atreides');
  const seats = await Promise.all(
    [created.token, other.token!, observer.token!].map((token) =>
      store.restart().authenticate(code, token),
    ),
  );
  const initial = await store.restart().readRoom(code);
  // Isolated component position: one real expanded deck, conserved physical
  // forces and production authenticated actions after this bounded setup.
  Object.assign(initial, {
    status: 'playing',
    phase:
      effect === 'ghola'
        ? 4
        : effect === 'hajr'
          ? 5
          : effect === 'harvester'
            ? 1
            : 0,
    turn: 2,
    active: seats[0].playerId,
    order: seats.map((s) => s.playerId),
    movementRemaining: seats.map((s) => s.playerId),
    storm: 18,
    stormPending: null,
    stormDialers: [seats[0].playerId, seats[2].playerId],
    stormDials: {},
    advanced: effect === 'ghola' || effect === 'atomics',
    expansions: ['ix'],
    deck: treacheryDeck(['ix']),
    response: null,
    decision: null,
    phaseOpening: null,
    pendingKarama: null,
    ready: [],
  });
  for (const p of initial.players) {
    p.hand = [];
    p.spice = 10;
    p.forces = {};
    p.reserves = 20;
    p.tanks = 0;
    p.shipped = false;
    p.moved = 0;
    p.traitors = [];
    p.traitorChoices = [];
  }
  const hold = (
    index: number,
    predicate: (c: engine.Player['hand'][number]) => boolean,
  ) => {
    const at = initial.deck.findIndex(predicate);
    assert.ok(at >= 0);
    const card = initial.deck.splice(at, 1)[0];
    initial.players[index].hand.push(card);
    return card;
  };
  const card = hold(0, (c) => c.effect === effect),
    karama = hold(2, (c) => c.effect === 'karama');
  hold(1, (c) => c.name === 'Shield');
  let second: engine.Player['hand'][number] | null = null;
  if (effect === 'ghola') {
    initial.players[1].faction = 'tleilaxu';
    initial.players[0].tanks = 5;
    initial.players[0].reserves = 15;
    initial.players[0].elites = {
      forces: {},
      tanks: 2,
      reserves: 3,
      revived: 0,
    };
    initial.techTokens = createTechTokens();
    initial.techTokens.axlotl.owner = seats[2].playerId;
    initial.techTokens.heighliners.owner = seats[2].playerId;
    initial.revivalFreeIncome = { [seats[0].playerId]: initial.turn };
  } else if (effect === 'hajr') {
    initial.players[0].forces = { 'imperial_basin:10': 3 };
    initial.players[0].reserves = 17;
  } else if (effect === 'harvester') {
    initial.spiceDeck = [{ territory: 'red_chasm', sector: 7, amount: 8 }];
    initial.spice = { 'red_chasm:7': 3 };
    second = hold(1, (c) => c.effect === 'harvester');
  } else if (effect === 'atomics') {
    initial.players[0].forces = { 'shield_wall:8': 2, 'arrakeen:10': 1 };
    initial.players[0].reserves = 17;
    initial.players[0].elites = {
      forces: { 'shield_wall:8': 1 },
      tanks: 0,
      reserves: 4,
      revived: 0,
    };
    initial.players[1].forces = { 'shield_wall:8': 3 };
    initial.players[1].reserves = 17;
  }
  const save = (g: engine.Game) =>
    store.sqlite
      .prepare('UPDATE rooms SET state=?,version=? WHERE code=?')
      .run(JSON.stringify(g), g.version, code);
  save(initial);
  async function action(index: number, a: engine.Action) {
    const current = await store.restart().readRoom(code);
    await store.restart().act(code, seats[index], current.version, a, clock);
    return store.restart().readRoom(code);
  }
  if (effect === 'hajr')
    await action(0, {
      type: 'move',
      forces: { 'imperial_basin:10': 1 },
      territory: 'arrakeen',
      sector: 10,
    });
  if (effect === 'harvester')
    for (const index of [0, 1, 2]) await action(index, { type: 'ready' });
  const before = await store.restart().readRoom(code);
  store.writes.length = 0;
  const play: engine.Action = {
    type: 'card',
    card: card.id,
    ...(effect === 'weather'
      ? { amount: 0 }
      : effect === 'ghola'
        ? { amount: 2, elite: 1 }
        : {}),
  };
  return {
    ...store,
    code,
    seats,
    initial: before,
    save,
    act: action,
    card,
    karama,
    second,
    play,
  };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
function receipt(g: engine.Game) {
  const c = g.pendingTreacheryDiscard?.continuation;
  if (c?.kind !== 'ordinaryCardDiscard')
    throw Error('Missing ordinary card frame');
  return c;
}
function inventory(g: engine.Game) {
  const ids = [...g.deck, ...g.discard, ...g.players.flatMap((p) => p.hand)]
    .map((c) => c.id)
    .sort();
  assert.equal(new Set(ids).size, ids.length);
  return ids;
}
function barrier() {
  let arrivals = 0,
    release!: () => void;
  const ready = new Promise<void>((r) => {
    release = r;
  });
  return async () => {
    if (++arrivals === 2) release();
    await ready;
  };
}
async function stage(
  f: Fixture,
  before = f.initial,
  index = 0,
  action = f.play,
) {
  const frame = inner(before, f.seats[index].playerId, action);
  assert.equal(receipt(frame).player, f.seats[index].playerId);
  assert.equal(receipt(frame).card, action.card);
  assert.deepEqual(
    frame.pendingTreacheryDiscard!.batch.entries.map((e) => [
      e.card.id,
      e.discardedBy,
      e.publicFace,
    ]),
    [[action.card, f.seats[index].playerId, true]],
  );
  assert.equal(frame.response, null);
  assert.equal(frame.decision, null);
  f.save(frame);
  f.writes.length = 0;
  for (const [index, seat] of f.seats.entries()) {
    const view = await f.restart().readSeatView(f.code, seat);
    assert.equal(view.automaticContinuationPending, true);
    assert.equal(f.restart().needsAutomaticRoomRecovery(view), true);
    assert.equal(Object.hasOwn(view, 'pendingTreacheryDiscard'), false);
    assert.equal(view.shipmentCompletion, null);
    assert.equal(view.battle, null);
    for (const p of view.players) {
      if (p.id === seat.playerId)
        assert.deepEqual(p.hand, frame.players[index].hand);
      else
        for (const key of ['hand', 'spice', 'traitors', 'traitorChoices'])
          assert.equal(key in p, false, key);
    }
  }
  assert.equal(f.writes.length, 0);
  return frame;
}
async function recover(f: Fixture, frame: engine.Game) {
  f.hooks.beforeWrite = barrier();
  await Promise.all([
    f.restart().continueRoomAutomatic(f.code, clock),
    f.restart().continueRoomAutomatic(f.code, clock),
  ]);
  f.hooks.beforeWrite = undefined;
  const done = await f.restart().readRoom(f.code);
  assert.deepEqual(
    f.writes.map((w) => w.changes).sort((a, b) => a - b),
    [0, 1],
  );
  assert.equal(done.version, frame.version + 1);
  assert.equal(done.pendingTreacheryDiscard, null);
  assert.equal(
    done.resolvedTreacheryDiscardSequence,
    frame.treacheryDiscardSequence,
  );
  for (const key of [
    'players',
    'deck',
    'discard',
    'log',
    'hajr',
    'spice',
    'spiceWindow',
    'storm',
    'stormPending',
    'stormDials',
    'ready',
    'shieldWallDestroyed',
    'techTokens',
    'revivalFreeIncome',
    'movementRemaining',
    'active',
  ] as const)
    assert.deepEqual(done[key], frame[key], key + ' must not replay');
  assert.deepEqual(done.response, receipt(frame).resume.response);
  assert.deepEqual(inventory(done), inventory(f.initial));
  await f.restart().continueRoomAutomatic(f.code, clock);
  assert.deepEqual(await f.restart().readRoom(f.code), done);
  assert.equal(f.writes.length, 2);
  return done;
}

void test('Ghola retirement recovers typed revival and accrued technology once before actual income allowance or cancellation', async () => {
  for (const cancel of [false, true]) {
    const f = await fixture('ghola');
    try {
      const frame = await stage(f);
      assert.equal(frame.players[0].tanks, 3);
      assert.equal(frame.players[0].reserves, 17);
      assert.deepEqual(frame.players[0].elites, {
        forces: {},
        tanks: 1,
        reserves: 4,
        revived: 1,
      });
      assert.equal(frame.techTokens!.axlotl.spice, 2);
      assert.equal(frame.techTokens!.axlotl.triggeredTurn, 2);
      assert.equal(receipt(frame).resume.response?.kind, 'revivalIncome');
      assert.equal(receipt(frame).resume.response?.amount, 1);
      assert.deepEqual(
        frame.players.map((p) => p.spice),
        [10, 10, 10],
      );
      const done = await recover(f, frame);
      let settled = done;
      if (cancel)
        settled = await f.act(2, {
          type: 'card',
          card: f.karama.id,
          mode: 'cancel',
        });
      else
        while (settled.response) {
          const index = settled.players.findIndex(
            (p) => !settled.response!.passed.includes(p.id),
          );
          settled = await f.act(index, { type: 'passResponse' });
        }
      assert.equal(settled.response, null);
      assert.equal(settled.players[1].spice, cancel ? 10 : 11);
      assert.deepEqual(settled.players[0], frame.players[0]);
      assert.equal(settled.techTokens!.axlotl.spice, 2);
      for (const index of [0, 1, 2])
        settled = await f.act(index, { type: 'ready' });
      assert.equal(settled.techTokens!.axlotl.spice, 0);
      assert.equal(settled.players[2].spice, 12);
      assert.equal(settled.discard.filter((c) => c.id === f.card.id).length, 1);
    } finally {
      f.sqlite.close();
    }
  }
});

void test('Hajr retirement preserves a genuine first move and grants exactly one remaining move across restart', async () => {
  const f = await fixture('hajr');
  try {
    assert.equal(f.initial.players[0].moved, 1);
    const frame = await stage(f),
      done = await recover(f, frame);
    assert.deepEqual(done.hajr, [f.seats[0].playerId]);
    assert.equal(done.players[0].moved, 1);
    assert.equal(done.active, f.seats[0].playerId);
    const moved = await f.act(0, {
      type: 'move',
      forces: { 'imperial_basin:10': 1 },
      territory: 'carthag',
      sector: 11,
    });
    assert.equal(moved.players[0].moved, 2);
    await assert.rejects(
      f.restart().act(
        f.code,
        f.seats[0],
        moved.version,
        {
          type: 'move',
          forces: { 'imperial_basin:10': 1 },
          territory: 'arrakeen',
          sector: 10,
        },
        clock,
      ),
    );
    await assert.rejects(
      f.restart().act(f.code, f.seats[0], moved.version, f.play, clock),
    );
    assert.deepEqual(await f.restart().readRoom(f.code), moved);
  } finally {
    f.sqlite.close();
  }
});

void test('Weather zero, successive physical Harvesters and Atomics typed casualties survive frozen-frame recovery without replay', async () => {
  for (const effect of ['weather', 'harvester', 'atomics'] as const) {
    const f = await fixture(effect);
    try {
      const frame = await stage(f),
        done = await recover(f, frame);
      if (effect === 'weather') {
        assert.equal(done.stormPending, 0);
        assert.equal(done.storm, 18);
        assert.deepEqual(done.ready, []);
        let accepted = done;
        for (const index of [0, 1, 2])
          accepted = await f.act(index, { type: 'ready' });
        assert.equal(accepted.storm, 18);
        assert.equal(accepted.phase, 1);
      } else if (effect === 'harvester') {
        assert.equal(f.initial.spice['red_chasm:7'], 11);
        assert.equal(done.spice['red_chasm:7'], 19);
        assert.equal(done.spiceWindow!.amount, 16);
        const paused = await f.act(0, { type: 'ready' });
        const next = await stage(f, paused, 1, {
          type: 'card',
          card: f.second!.id,
        });
        assert.equal(next.spice['red_chasm:7'], 35);
        assert.equal(next.spiceWindow!.amount, 32);
        assert.equal(next.spiceWindow!.harvesters, 2);
        assert.deepEqual(next.ready, []);
        const twice = await recover(f, next);
        assert.equal(twice.resolvedTreacheryDiscardSequence, 2);
        assert.deepEqual(
          twice.discard.map((c) => c.id),
          [f.card.id, f.second!.id],
        );
      } else {
        assert.equal(done.shieldWallDestroyed, true);
        assert.deepEqual(done.players[0].forces, { 'arrakeen:10': 1 });
        assert.equal(done.players[0].tanks, 2);
        assert.equal(done.players[0].elites!.tanks, 1);
        assert.deepEqual(done.players[0].elites!.forces, {});
        assert.deepEqual(done.players[1].forces, {});
        assert.equal(done.players[1].tanks, 3);
      }
    } finally {
      f.sqlite.close();
    }
  }
});

void test('duplicated ordinary card actions commit their effect and automatic retirement within a single original CAS', async () => {
  for (const effect of ['ghola', 'weather'] as const) {
    const f = await fixture(effect);
    try {
      f.hooks.beforeWrite = barrier();
      const results = await Promise.allSettled([
        f.restart().act(f.code, f.seats[0], f.initial.version, f.play, clock),
        f.restart().act(f.code, f.seats[0], f.initial.version, f.play, clock),
      ]);
      f.hooks.beforeWrite = undefined;
      assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
      assert.equal(results.filter((r) => r.status === 'rejected').length, 1);
      assert.deepEqual(
        f.writes.map((w) => w.changes).sort((a, b) => a - b),
        [0, 1],
      );
      const done = await f.restart().readRoom(f.code);
      assert.equal(done.version, f.initial.version + 1);
      assert.equal(done.pendingTreacheryDiscard, null);
      assert.equal(done.resolvedTreacheryDiscardSequence, 1);
      assert.deepEqual(done.discard, [f.card]);
      assert.equal(
        done.log.filter((l) => l.text === `Card owner played ${f.card.name}.`)
          .length,
        1,
      );
      if (effect === 'ghola') {
        assert.equal(done.players[0].tanks, 3);
        assert.equal(done.techTokens!.axlotl.spice, 2);
        assert.equal(done.response?.kind, 'revivalIncome');
      } else assert.equal(done.stormPending, 0);
      await assert.rejects(
        f.restart().act(f.code, f.seats[0], done.version, f.play, clock),
      );
      assert.deepEqual(await f.restart().readRoom(f.code), done);
      assert.equal(f.writes.length, 2);
    } finally {
      f.sqlite.close();
    }
  }
});

void test('all five effect receipts reject corrupted context, physical custody or results before SQL writes and reject retired replay', async () => {
  for (const effect of [
    'hajr',
    'ghola',
    'harvester',
    'weather',
    'atomics',
  ] as const) {
    const f = await fixture(effect);
    try {
      const frame = await stage(f);
      const changes: ((g: engine.Game) => void)[] = [
        (g) => {
          g.pendingTreacheryDiscard!.batch.event = 'stale-effect';
        },
        (g) => {
          receipt(g).player = f.seats[1].playerId;
        },
        (g) => {
          receipt(g).card = f.karama.id;
        },
        (g) => {
          receipt(g).effect = effect === 'hajr' ? 'ghola' : 'hajr';
        },
        (g) => {
          receipt(g).stateSignature = '{}';
        },
        (g) => {
          g.players[0].hand.push(structuredClone(f.card));
        },
        (g) => {
          g.phaseOpening = { initialize: true, passed: [] };
        },
        (g) => {
          g.status = 'finished';
        },
        (g) => {
          g.turn++;
        },
      ];
      if (effect === 'hajr')
        changes.push((g) => {
          g.hajr = [];
        });
      if (effect === 'weather')
        changes.push((g) => {
          g.stormPending = 1;
        });
      if (effect === 'harvester')
        changes.push(
          (g) => {
            g.spiceWindow!.amount *= 2;
          },
          (g) => {
            g.spice['red_chasm:7']++;
          },
        );
      if (effect === 'atomics')
        changes.push(
          (g) => {
            g.shieldWallDestroyed = false;
          },
          (g) => {
            g.players[0].elites!.tanks++;
          },
        );
      if (effect === 'ghola')
        changes.push(
          (g) => {
            g.players[0].tanks--;
          },
          (g) => {
            g.techTokens!.axlotl.spice++;
          },
          (g) => {
            receipt(g).resume.response!.amount = 2;
          },
        );
      for (const [index, change] of changes.entries()) {
        const bad = structuredClone(frame);
        change(bad);
        f.save(bad);
        await assert.rejects(
          f.restart().readSeatView(f.code, f.seats[0]),
          `${effect} mutation ${index} view`,
        );
        await assert.rejects(
          f.restart().continueRoomAutomatic(f.code, clock),
          `${effect} mutation ${index} recovery`,
        );
        await assert.rejects(
          f
            .restart()
            .act(
              f.code,
              f.seats[0],
              bad.version,
              { type: 'advanceBots' },
              clock,
            ),
        );
        assert.deepEqual(await f.restart().readRoom(f.code), bad);
        assert.equal(f.writes.length, 0);
      }
      f.save(frame);
      const done = await recover(f, frame);
      const retired = structuredClone(done);
      retired.pendingTreacheryDiscard = frame.pendingTreacheryDiscard;
      f.save(retired);
      await assert.rejects(f.restart().continueRoomAutomatic(f.code, clock));
      assert.deepEqual(await f.restart().readRoom(f.code), retired);
      assert.equal(f.writes.length, 2);
    } finally {
      f.sqlite.close();
    }
  }
});
