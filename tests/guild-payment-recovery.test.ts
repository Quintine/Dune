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

type Route = 'reserve' | 'cross';
async function fixture(route: Route, canCancel: boolean) {
  const store = unitStore();
  const created = await store.rooms.createRoom(
    'Guild shipper',
    'guild',
    false,
    [],
  );
  const code = created.view.code;
  const donor = await store.rooms.joinRoom(code, 'Emperor donor', 'emperor');
  const opposing = await store.rooms.joinRoom(
    code,
    'Atreides observer',
    'atreides',
  );
  const seats = await Promise.all(
    [created.token, donor.token!, opposing.token!].map((token) =>
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
  initial.players[0].ally = seats[1].playerId;
  initial.players[1].ally = seats[0].playerId;
  if (route === 'cross') {
    initial.players[0].forces = { 'arrakeen:10': 4 };
    initial.players[0].reserves = 16;
  }
  const karama = initial.deck.find((card) => card.effect === 'karama')!;
  if (canCancel) {
    initial.deck = initial.deck.filter((card) => card.id !== karama.id);
    initial.players[2].hand = [karama];
  }
  // Only this fixture's in-memory database receives the explicit mid-game scenario.
  store.sqlite
    .prepare('UPDATE rooms SET state=?,version=? WHERE code=?')
    .run(JSON.stringify(initial), initial.version, code);
  initial = await action(1, { type: 'pledgeAid', amount: 4 });
  store.writes.length = 0;
  const shipment: engine.Action = {
    type: route === 'reserve' ? 'ship' : 'guildShip',
    ...(route === 'cross' ? { from: 'arrakeen:10' } : {}),
    territory: 'carthag',
    sector: 11,
    amount: 4,
    allyPayment: 1,
  };
  return { ...store, code, seats, initial, karama, shipment, action };
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
async function duplicate(f: Fixture, index: number, action: engine.Action) {
  const before = await f.restart().readRoom(f.code);
  f.writes.length = 0;
  f.hooks.beforeWrite = barrier();
  const attempts = await Promise.allSettled([
    f.rooms.act(f.code, f.seats[index], before.version, action, clock),
    f.restart().act(f.code, f.seats[index], before.version, action, clock),
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
      f.restart().act(f.code, f.seats[index], version, action, clock),
    );
  assert.equal(f.writes.length, writes);
  assert.deepEqual(await f.restart().readRoom(f.code), after);
  return after;
}
async function restored(f: Fixture) {
  const before = await f.restart().readRoom(f.code);
  const writes = f.writes.length;
  await f.restart().continueRoomAutomatic(f.code, clock);
  assert.equal(f.writes.length, writes);
  assert.deepEqual(await f.restart().readRoom(f.code), before);
  for (const [index, seat] of f.seats.entries()) {
    const view = await f.restart().readSeatView(f.code, seat);
    const own = view.players.find((p) => p.id === seat.playerId)!;
    assert.deepEqual(own.hand, before.players[index].hand);
    assert.equal(own.spice, before.players[index].spice);
    for (const p of view.players.filter((p) => p.id !== seat.playerId)) {
      assert.equal(p.hand, undefined);
      assert.equal(p.spice, undefined);
      assert.equal(p.traitors, undefined);
      assert.equal(p.traitorChoices, undefined);
    }
    assert.equal('deck' in view, false);
    if (before.response) {
      assert.equal(view.response?.kind, 'guildIncome');
      assert.equal(view.response?.amount, 1);
      assert.deepEqual(
        view.responseControls?.cancelCards,
        index === 2 ? [f.karama.id] : [],
      );
    }
  }
  return before;
}
function paidOnce(f: Fixture, g: engine.Game, guildSpice: number) {
  assert.equal(g.players[0].spice, guildSpice);
  assert.equal(g.players[1].spice, 16);
  assert.equal(g.aid[f.seats[1].playerId].amount, 3);
  assert.equal(g.players[0].shipped, true);
  assert.equal(g.players[0].moved, 0);
  assert.equal(g.players[0].reserves, 16);
  assert.deepEqual(g.players[0].forces, { 'carthag:11': 4 });
  assert.equal(
    g.log.filter((entry) =>
      /shipped 4 forces|used Guild transport for 4 forces/.test(entry.text),
    ).length,
    1,
  );
}
function cards(g: engine.Game) {
  return [...g.deck, ...g.discard, ...g.players.flatMap((p) => p.hand)]
    .map((card) => card.id)
    .sort();
}

void test('duplicate Guild reserve and cross shipments from restarted room workers charge each contributor and grant income exactly once', async () => {
  for (const route of ['reserve', 'cross'] as const) {
    const f = await fixture(route, false);
    try {
      const before = await f.restart().readRoom(f.code);
      await assert.rejects(
        f.restart().act(f.code, f.seats[1], before.version, f.shipment, clock),
      );
      assert.equal(f.writes.length, 0);
      assert.deepEqual(await f.restart().readRoom(f.code), before);
      const after = await duplicate(f, 0, f.shipment);
      paidOnce(f, after, 20);
      assert.equal(after.response, null);
      assert.equal(
        after.log.filter((entry) => entry.automatic?.name === 'Shipment income')
          .length,
        1,
      );
      assert.deepEqual(cards(after), cards(f.initial));
      assert.deepEqual(await restored(f), after);
    } finally {
      f.hooks.beforeWrite = undefined;
      f.sqlite.close();
    }
  }
});

for (const cancel of [false, true])
  void test(`restored Guild income ${cancel ? 'cancellation' : 'allowance'} commits once while prior force arrival and contributor payments remain unchanged`, async () => {
    for (const route of ['reserve', 'cross'] as const) {
      const f = await fixture(route, true);
      try {
        await f.action(0, f.shipment);
        const pending = await restored(f);
        paidOnce(f, pending, 19);
        assert.equal(pending.response?.kind, 'guildIncome');
        assert.equal(pending.response?.owner, f.seats[0].playerId);
        assert.equal(pending.response?.amount, 1);
        assert.equal(
          pending.discard.some((card) => card.id === f.karama.id),
          false,
        );
        const writeCount = f.writes.length;
        for (const index of [0, 1])
          await assert.rejects(
            f.restart().act(
              f.code,
              f.seats[index],
              pending.version,
              {
                type: 'card',
                mode: 'cancel',
                card: f.karama.id,
              },
              clock,
            ),
          );
        await assert.rejects(
          f
            .restart()
            .act(f.code, f.seats[0], pending.version, f.shipment, clock),
        );
        assert.equal(f.writes.length, writeCount);
        assert.deepEqual(await f.restart().readRoom(f.code), pending);
        const resolution: engine.Action = cancel
          ? { type: 'card', mode: 'cancel', card: f.karama.id }
          : { type: 'passResponse' };
        const after = await duplicate(f, 2, resolution);
        paidOnce(f, after, cancel ? 19 : 20);
        assert.equal(after.response, null);
        assert.equal(
          after.discard.filter((card) => card.id === f.karama.id).length,
          cancel ? 1 : 0,
        );
        assert.equal(
          after.players[2].hand.some((card) => card.id === f.karama.id),
          !cancel,
        );
        assert.equal(
          after.log.filter(
            (entry) =>
              entry.automatic?.name ===
              (cancel ? 'Shipment income prevented' : 'Shipment income'),
          ).length,
          1,
        );
        assert.deepEqual(cards(after), cards(pending));
        assert.deepEqual(await restored(f), after);
      } finally {
        f.hooks.beforeWrite = undefined;
        f.sqlite.close();
      }
    }
  });
