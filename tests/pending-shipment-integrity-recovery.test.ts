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

async function fixture() {
  const store = unitStore();
  const created = await store.rooms.createRoom(
    'Shipment owner',
    'emperor',
    false,
    [],
  );
  const code = created.view.code;
  const joined = await store.rooms.joinRoom(code, 'Guild gatekeeper', 'guild');
  const donor = await store.rooms.joinRoom(code, 'Shipment donor', 'atreides');
  const seats = await Promise.all(
    [created.token, joined.token!, donor.token!].map((token) =>
      store.rooms.authenticate(code, token),
    ),
  );
  const action = async (index: number, command: engine.Action) => {
    const current = await store.restart().readRoom(code);
    await store
      .restart()
      .act(code, seats[index], current.version, command, clock);
    return store.restart().readRoom(code);
  };
  for (const index of [0, 1, 2]) await action(index, { type: 'ready' });
  let initial = await action(0, { type: 'start' });
  for (const [index, p] of initial.players.entries())
    if (p.traitorChoices.length)
      await action(index, { type: 'traitor', leader: p.traitorChoices[0] });
  initial = await store.restart().readRoom(code);
  assert.equal(initial.status, 'playing');
  Object.assign(initial, {
    advanced: true,
    phase: 5,
    turn: 2,
    storm: 18,
    active: seats[0].playerId,
    order: seats.map((seat) => seat.playerId),
    movementRemaining: seats.map((seat) => seat.playerId),
    deck: baseDeck(),
    discard: [],
  });
  for (const p of initial.players) {
    p.hand = [];
    p.spice = 20;
    p.forces = {};
    p.reserves = 20;
  }
  initial.players[0].elites = { reserves: 5, tanks: 0, forces: {}, revived: 0 };
  initial.players[0].ally = seats[2].playerId;
  initial.players[2].ally = seats[0].playerId;
  const karama = initial.deck.find((card) => card.effect === 'karama')!;
  initial.deck = initial.deck.filter((card) => card.id !== karama.id);
  initial.players[1].hand = [karama];
  const save = (g: engine.Game) =>
    store.sqlite
      .prepare('UPDATE rooms SET state=?,version=? WHERE code=?')
      .run(JSON.stringify(g), g.version, code);
  // Seed only the isolated in-memory room; all declaration and continuation actions use production rooms.act.
  save(initial);
  initial = await action(2, { type: 'pledgeAid', amount: 3 });
  const shipment: engine.Action = {
    type: 'ship',
    territory: 'arrakeen',
    sector: 10,
    amount: 4,
    elite: 2,
    allyPayment: 2,
  };
  const pending = await action(0, shipment);
  assert.equal(pending.decision?.kind, 'guildShipment');
  assert.ok(pending.pendingShipment);
  store.writes.length = 0;
  return {
    ...store,
    code,
    seats,
    initial,
    pending,
    save,
    karama,
    shipment,
    action,
  };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
function barrier() {
  let release!: () => void;
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  let arrivals = 0;
  return async () => {
    if (++arrivals === 2) release();
    await waiting;
  };
}
async function duplicate(f: Fixture, action: engine.Action) {
  const before = await f.restart().readRoom(f.code);
  f.writes.length = 0;
  f.hooks.beforeWrite = barrier();
  const attempts = await Promise.allSettled([
    f.rooms.act(f.code, f.seats[1], before.version, action, clock),
    f.restart().act(f.code, f.seats[1], before.version, action, clock),
  ]);
  f.hooks.beforeWrite = undefined;
  assert.equal(
    attempts.filter((result) => result.status === 'fulfilled').length,
    1,
  );
  assert.equal(
    attempts.filter((result) => result.status === 'rejected').length,
    1,
  );
  assert.deepEqual(
    f.writes.map((write) => write.changes).sort((a, b) => a - b),
    [0, 1],
  );
  const after = await f.restart().readRoom(f.code);
  assert.equal(after.version, before.version + 1);
  const writes = f.writes.length;
  for (const version of [before.version, after.version])
    await assert.rejects(
      f.restart().act(f.code, f.seats[1], version, action, clock),
    );
  assert.equal(f.writes.length, writes);
  assert.deepEqual(await f.restart().readRoom(f.code), after);
  return after;
}
function cards(g: engine.Game) {
  return [...g.deck, ...g.discard, ...g.players.flatMap((p) => p.hand)]
    .map((card) => card.id)
    .sort();
}
async function unchangedRejected(
  f: Fixture,
  g: engine.Game,
  action: engine.Action,
) {
  f.save(g);
  const before = await f.restart().readRoom(f.code);
  f.writes.length = 0;
  await assert.rejects(
    f.restart().act(f.code, f.seats[1], before.version, action, clock),
  );
  assert.equal(
    f.writes.length,
    0,
    'Invalid restored declaration reached a room CAS.',
  );
  assert.deepEqual(await f.restart().readRoom(f.code), before);
  assert.deepEqual(cards(before), cards(g));
  const guildView = await f.restart().readSeatView(f.code, f.seats[1]);
  assert.deepEqual(
    guildView.players.find((p) => p.id === f.seats[1].playerId)!.hand,
    g.players[1].hand,
  );
}
const mutations: [string, (g: engine.Game) => void][] = [
  [
    'negative price',
    (g) => {
      g.pendingShipment!.cost = -1;
    },
  ],
  [
    'stale price',
    (g) => {
      g.pendingShipment!.cost = 3;
    },
  ],
  [
    'excess contribution',
    (g) => {
      g.pendingShipment!.allyPayment = 5;
      g.aid[g.players[2].id].amount = 5;
    },
  ],
  [
    'negative contribution',
    (g) => {
      g.pendingShipment!.allyPayment = -1;
    },
  ],
  [
    'fractional contribution',
    (g) => {
      g.pendingShipment!.allyPayment = 1.5;
    },
  ],
  [
    'missing escrow',
    (g) => {
      g.aid[g.players[2].id].amount = 1;
    },
  ],
  [
    'broken mutual alliance',
    (g) => {
      g.players[2].ally = null;
    },
  ],
  [
    'missing physical reserves',
    (g) => {
      g.players[0].reserves = 3;
    },
  ],
  [
    'missing elite reserves',
    (g) => {
      g.players[0].elites!.reserves = 1;
    },
  ],
  [
    'missing regular reserves',
    (g) => {
      g.players[0].elites!.reserves = 19;
    },
  ],
  [
    'negative force count',
    (g) => {
      g.pendingShipment!.amount = -1;
    },
  ],
  [
    'negative elite count',
    (g) => {
      g.pendingShipment!.elite = -1;
    },
  ],
  [
    'already shipped',
    (g) => {
      g.players[0].shipped = true;
    },
  ],
  [
    'wrong phase',
    (g) => {
      g.phase = 7;
    },
  ],
  [
    'wrong status',
    (g) => {
      g.status = 'setup';
    },
  ],
  [
    'wrong active player',
    (g) => {
      g.active = g.players[2].id;
    },
  ],
  [
    'wrong stamped turn',
    (g) => {
      Object.assign(g.pendingShipment!, { turn: g.turn - 1 });
    },
  ],
  [
    'storm destination',
    (g) => {
      g.storm = 10;
    },
  ],
  [
    'invalid advisor stance',
    (g) => {
      g.pendingShipment!.advisors = true;
    },
  ],
  [
    'full stronghold',
    (g) => {
      for (const p of g.players.slice(1)) {
        p.forces = { 'arrakeen:10': 1 };
        p.reserves = 19;
      }
    },
  ],
  [
    'decision shipper mismatch',
    (g) => {
      if (g.decision?.kind === 'guildShipment')
        g.decision.shipper = g.players[2].id;
    },
  ],
  [
    'decision destination mismatch',
    (g) => {
      if (g.decision?.kind === 'guildShipment')
        g.decision.territory = 'carthag';
    },
  ],
  [
    'decision sector mismatch',
    (g) => {
      if (g.decision?.kind === 'guildShipment') g.decision.sector = 11;
    },
  ],
  [
    'decision quantity mismatch',
    (g) => {
      if (g.decision?.kind === 'guildShipment') g.decision.amount = 5;
    },
  ],
];

void test('corrupted saved physical shipment price, contribution, typed custody, context and public binding reject without a CAS or resource change', async (t) => {
  const f = await fixture();
  try {
    const failures: string[] = [];
    for (const [name, mutate] of mutations) {
      const g = structuredClone(f.pending);
      mutate(g);
      try {
        await unchangedRejected(f, g, { type: 'decision', allow: true });
      } catch (error) {
        failures.push(`${name}: ${String(error)}`);
      }
    }
    t.diagnostic(`${mutations.length} corrupted saved declarations checked`);
    assert.deepEqual(failures, []);
  } finally {
    f.sqlite.close();
  }
});

void test('current stamped and legacy unstamped pending shipments restore and commit once under duplicate Guild allowance', async () => {
  for (const legacy of [false, true]) {
    const f = await fixture();
    try {
      const pending = structuredClone(f.pending);
      assert.equal(
        (pending.pendingShipment as { turn?: number }).turn,
        pending.turn,
      );
      if (legacy) delete (pending.pendingShipment as { turn?: number }).turn;
      f.save(pending);
      assert.deepEqual(await f.restart().readRoom(f.code), pending);
      const beforeWrites = f.writes.length;
      await f.restart().continueRoomAutomatic(f.code, clock);
      assert.equal(f.writes.length, beforeWrites);
      assert.deepEqual(await f.restart().readRoom(f.code), pending);
      const after = await duplicate(f, { type: 'decision', allow: true });
      assert.equal(after.pendingShipment, null);
      assert.equal(after.decision, null);
      assert.equal(after.players[0].spice, 18);
      assert.equal(after.players[0].reserves, 16);
      assert.deepEqual(after.players[0].forces, { 'arrakeen:10': 4 });
      assert.equal(after.players[0].elites!.reserves, 3);
      assert.deepEqual(after.players[0].elites!.forces, { 'arrakeen:10': 2 });
      assert.equal(after.players[0].shipped, true);
      assert.equal(after.aid[f.seats[2].playerId].amount, 1);
      assert.equal(after.players[1].spice, 24);
      assert.deepEqual(after.players[1].hand, f.pending.players[1].hand);
      assert.deepEqual(cards(after), cards(pending));
      assert.equal(
        after.log.filter((entry) => /shipped 4 forces/.test(entry.text)).length,
        1,
      );
      await f.restart().continueRoomAutomatic(f.code, clock);
      assert.deepEqual(await f.restart().readRoom(f.code), after);
    } finally {
      f.hooks.beforeWrite = undefined;
      f.sqlite.close();
    }
  }
});

void test('Guild special stop validates the restored declaration before spending its physical card, then duplicate valid stops settle once', async (t) => {
  const f = await fixture();
  try {
    const stop: engine.Action = {
      type: 'card',
      mode: 'special',
      card: f.karama.id,
    };
    const failures: string[] = [];
    for (const [name, mutate] of mutations) {
      const g = structuredClone(f.pending);
      mutate(g);
      try {
        await unchangedRejected(f, g, stop);
      } catch (error) {
        failures.push(`${name}: ${String(error)}`);
      }
    }
    t.diagnostic(
      `${mutations.length} corrupted special-stop declarations checked`,
    );
    assert.deepEqual(failures, []);
    f.save(f.pending);
    const stopped = await duplicate(f, stop);
    assert.equal(stopped.pendingShipment, null);
    assert.equal(stopped.decision, null);
    assert.equal(stopped.players[0].shipped, true);
    assert.equal(stopped.players[1].specialKaramaUsed, true);
    assert.equal(
      stopped.discard.filter((card) => card.id === f.karama.id).length,
      1,
    );
    assert.equal(
      stopped.players[1].hand.some((card) => card.id === f.karama.id),
      false,
    );
    assert.equal(stopped.players[0].spice, f.pending.players[0].spice);
    assert.equal(stopped.players[1].spice, f.pending.players[1].spice);
    assert.deepEqual(stopped.aid, f.pending.aid);
    assert.deepEqual(stopped.players[0].forces, f.pending.players[0].forces);
    assert.deepEqual(stopped.players[0].elites, f.pending.players[0].elites);
    assert.equal(stopped.players[0].reserves, f.pending.players[0].reserves);
    assert.deepEqual(cards(stopped), cards(f.pending));
    await f.restart().continueRoomAutomatic(f.code, clock);
    assert.deepEqual(await f.restart().readRoom(f.code), stopped);
  } finally {
    f.hooks.beforeWrite = undefined;
    f.sqlite.close();
  }
});
