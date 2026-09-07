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
import { richeseCards } from '../game/richese-cards';
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

const SAPHO = 'richese-juice-of-sapho';
type Scope = 'onceAround' | 'movement';
async function fixture(scope: Scope, advanced = false) {
  const store = unitStore();
  const made = await store.rooms.createRoom(
    'First player',
    'atreides',
    false,
    [],
  );
  const code = made.view.code;
  const holder = await store.rooms.joinRoom(code, 'Sapho holder', 'emperor');
  const guild = await store.rooms.joinRoom(code, 'Guild', 'guild');
  const fourth = advanced
    ? await store.rooms.joinRoom(code, 'Later player', 'harkonnen')
    : null;
  const seats = await Promise.all(
    [
      made.token,
      holder.token!,
      guild.token!,
      ...(fourth ? [fourth.token!] : []),
    ].map((token) => store.rooms.authenticate(code, token)),
  );
  let initial = await store.rooms.readRoom(code);
  for (const p of initial.players) p.ready = true;
  initial = engine.applyAction(initial, seats[0].playerId, { type: 'start' });
  for (const p of initial.players)
    if (p.traitorChoices.length)
      initial = engine.applyAction(initial, p.id, {
        type: 'traitor',
        leader: p.traitorChoices[0],
      });
  initial.deck = baseDeck();
  initial.discard = [];
  initial.richeseCache = richeseCards();
  initial.richeseRemoved = [];
  initial.turn = 2;
  initial.phase = scope === 'onceAround' ? 2 : 4;
  initial.ready = [];
  initial.active = null;
  initial.response = null;
  initial.decision = null;
  initial.phaseOpening = null;
  initial.advanced = advanced;
  initial.storm = 18;
  initial.order = seats.map((seat) => seat.playerId);
  for (const p of initial.players) {
    p.hand = [];
    p.spice = 20;
    p.forces = {};
    p.reserves = 20;
    p.shipped = false;
    p.moved = 0;
  }
  const saphoIndex = initial.richeseCache.findIndex(
    (card) => card.id === SAPHO,
  );
  assert.ok(saphoIndex >= 0);
  initial.players[1].hand.push(initial.richeseCache.splice(saphoIndex, 1)[0]);
  for (const index of [0, 2]) {
    const at = initial.deck.findIndex((card) => card.name === 'Shield');
    initial.players[index].hand.push(initial.deck.splice(at, 1)[0]);
  }
  if (scope === 'onceAround') {
    initial.players[0].faction = 'richese';
    initial.players[0].leaders = engine.newPlayer(
      'roster',
      'Roster',
      'richese',
    ).leaders;
    initial.order = [seats[2].playerId, seats[1].playerId, seats[0].playerId];
  }
  const save = (g: engine.Game) =>
    store.sqlite
      .prepare('UPDATE rooms SET state=?,version=? WHERE code=?')
      .run(JSON.stringify(g), g.version, code);
  save(initial);
  const f = { ...store, code, seats, initial, save };
  for (const [index] of seats.entries()) await act(f, index, { type: 'ready' });
  if (scope === 'onceAround') {
    let g = await f.restart().readRoom(code);
    assert.equal(g.decision?.kind, 'richeseDeclaration');
    await act(f, 0, {
      type: 'decision',
      event: g.richeseBidding!.event,
      position: 'first',
    });
    g = await f.restart().readRoom(code);
    assert.equal(g.decision?.kind, 'richeseCache');
    await act(f, 0, {
      type: 'decision',
      event: g.richeseBidding!.event,
      card: g.richeseCache![0].id,
      method: 'onceAround',
      direction: 'clockwise',
    });
    g = await f.restart().readRoom(code);
    assert.deepEqual(g.richeseAuction!.order, [
      seats[2].playerId,
      seats[1].playerId,
      seats[0].playerId,
    ]);
  } else if (advanced) {
    const g = await f.restart().readRoom(code);
    assert.equal(g.decision?.kind, 'guildTiming');
    await act(f, 2, { type: 'decision', take: false });
  }
  f.writes.length = 0;
  return f;
}
type Fixture = {
  code: string;
  seats: Rooms.SeatAuth[];
  initial: engine.Game;
  save: (g: engine.Game) => unknown;
} & ReturnType<typeof unitStore>;
async function act(f: Fixture, index: number, action: engine.Action) {
  const current = await f.restart().readRoom(f.code);
  await f.restart().act(f.code, f.seats[index], current.version, action, clock);
  return f.restart().readRoom(f.code);
}
async function stable(f: Fixture) {
  const before = await f.restart().readRoom(f.code);
  const writes = f.writes.length;
  await f.restart().continueRoomAutomatic(f.code, clock);
  assert.equal(
    f.writes.length,
    writes,
    'Refresh must not bid, defer or replay the card for a human.',
  );
  assert.deepEqual(await f.restart().readRoom(f.code), before);
  return before;
}
function action(
  scope: Scope,
  event: string,
  mode: 'first' | 'last',
): engine.Action {
  return { type: 'card', card: SAPHO, scope, event, mode };
}
function physical(g: engine.Game) {
  return [
    ...g.deck,
    ...g.discard,
    ...(g.richeseCache ?? []),
    ...(g.richeseRemoved ?? []),
    ...g.players.flatMap((p) => p.hand),
    ...(g.auction?.cards.slice(g.auction.index) ?? []),
    ...(g.ixAuction?.cards ?? []),
  ]
    .map((c) => c.id)
    .sort();
}
async function privacy(
  f: Fixture,
  scope: Scope,
  event: string,
  modes: ('first' | 'last')[],
) {
  const state = await f.restart().readRoom(f.code);
  for (const [index, seat] of f.seats.entries()) {
    const view = await f.restart().readSeatView(f.code, seat);
    assert.deepEqual(
      view.saphoOptions,
      index === 1 ? modes.map((mode) => ({ scope, event, mode })) : [],
    );
    assert.deepEqual(view.saphoMovementLast, state.saphoMovementLast ?? null);
    for (const p of view.players.filter((p) => p.id !== seat.playerId))
      for (const key of ['hand', 'spice', 'traitors', 'traitorChoices'])
        assert.equal(key in p, false, `Other seat disclosed ${key}`);
    assert.deepEqual(
      view.players.find((p) => p.id === seat.playerId)!.hand,
      state.players[index].hand,
    );
  }
}
async function rejectsWithoutWrite(
  f: Fixture,
  index: number,
  a: engine.Action,
) {
  const before = await f.restart().readRoom(f.code),
    writes = f.writes.length;
  await assert.rejects(
    f.restart().act(f.code, f.seats[index], before.version, a, clock),
  );
  assert.equal(f.writes.length, writes);
  assert.deepEqual(await f.restart().readRoom(f.code), before);
}
function barrier() {
  let release!: () => void;
  const waiting = new Promise<void>((yes) => {
    release = yes;
  });
  let arrivals = 0;
  return async () => {
    if (++arrivals === 2) release();
    await waiting;
  };
}
async function duplicate(f: Fixture, a: engine.Action) {
  const before = await f.restart().readRoom(f.code);
  f.writes.length = 0;
  f.hooks.beforeWrite = barrier();
  const results = await Promise.allSettled([
    f.rooms.act(f.code, f.seats[1], before.version, a, clock),
    f.restart().act(f.code, f.seats[1], before.version, a, clock),
  ]);
  f.hooks.beforeWrite = undefined;
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(results.filter((r) => r.status === 'rejected').length, 1);
  assert.deepEqual(
    f.writes.map((w) => w.changes).sort((a, b) => a - b),
    [0, 1],
  );
  const after = await f.restart().readRoom(f.code);
  assert.equal(after.version, before.version + 1);
  assert.equal(after.discard.filter((c) => c.id === SAPHO).length, 1);
  assert.equal(
    after.players[1].hand.some((c) => c.id === SAPHO),
    false,
  );
  assert.deepEqual(physical(after), physical(before));
  assert.deepEqual(after.order, before.order);
  assert.equal(
    after.log.filter((entry) => entry.text.includes('discarded Juice of Sapho'))
      .length,
    before.log.filter((entry) =>
      entry.text.includes('discarded Juice of Sapho'),
    ).length + 1,
  );
  const writes = f.writes.length;
  for (const version of [before.version, after.version])
    await assert.rejects(
      f.restart().act(f.code, f.seats[1], version, a, clock),
    );
  assert.equal(f.writes.length, writes);
  return stable(f);
}
function bid(g: engine.Game, amount: number | null): engine.Action {
  return {
    type: 'richeseBid',
    event: g.richeseAuction!.event,
    amount,
    allyPayment: 0,
  };
}

void test('Once Around last survives duplicate cardplay and restart without replaying an earlier bid or its later sale', async () => {
  const f = await fixture('onceAround');
  try {
    let g = await stable(f);
    const event = g.richeseAuction!.event,
      card = g.richeseAuction!.cardId;
    await privacy(f, 'onceAround', event, ['first', 'last']);
    await rejectsWithoutWrite(f, 0, action('onceAround', event, 'last'));
    await rejectsWithoutWrite(f, 1, action('onceAround', 'stale-lot', 'last'));
    g = await act(f, 2, bid(g, 2));
    const before = structuredClone(g);
    await privacy(f, 'onceAround', event, ['last']);
    await rejectsWithoutWrite(f, 1, action('onceAround', event, 'first'));
    g = await duplicate(f, action('onceAround', event, 'last'));
    assert.deepEqual(g.richeseAuction!.order, [
      f.seats[2].playerId,
      f.seats[0].playerId,
      f.seats[1].playerId,
    ]);
    for (const key of [
      'acted',
      'passed',
      'bid',
      'bidder',
      'tieOrder',
      'eligible',
      'sealed',
    ] as const)
      assert.deepEqual(
        g.richeseAuction![key],
        before.richeseAuction![key],
        key,
      );
    assert.equal(g.richeseAuction!.active, f.seats[0].playerId);
    await privacy(f, 'onceAround', event, []);
    g = await act(f, 0, bid(g, 3));
    assert.equal(g.richeseAuction!.active, f.seats[1].playerId);
    g = await act(f, 1, bid(g, 4));
    assert.equal(g.players[1].spice, 16);
    assert.equal(g.players[1].hand.filter((c) => c.id === card).length, 1);
    assert.equal(g.discard.filter((c) => c.id === SAPHO).length, 1);
    assert.deepEqual(physical(g), physical(before));
    await rejectsWithoutWrite(f, 1, {
      type: 'richeseBid',
      event,
      amount: 4,
      allyPayment: 0,
    });
    assert.deepEqual(await stable(f), g);
  } finally {
    f.hooks.beforeWrite = undefined;
    f.sqlite.close();
  }
});

void test('Once Around first persists only within its lot and cannot be replayed after its first actual bid', async () => {
  const f = await fixture('onceAround');
  try {
    let g = await stable(f);
    const event = g.richeseAuction!.event;
    const before = structuredClone(g);
    g = await duplicate(f, action('onceAround', event, 'first'));
    assert.deepEqual(g.richeseAuction!.order, [
      f.seats[1].playerId,
      f.seats[2].playerId,
      f.seats[0].playerId,
    ]);
    assert.equal(g.richeseAuction!.active, f.seats[1].playerId);
    assert.deepEqual(g.richeseAuction!.acted, []);
    assert.deepEqual(
      g.richeseAuction!.tieOrder,
      before.richeseAuction!.tieOrder,
    );
    g = await act(f, 1, bid(g, 2));
    assert.deepEqual(g.richeseAuction!.acted, [f.seats[1].playerId]);
    assert.equal(g.richeseAuction!.active, f.seats[2].playerId);
    await rejectsWithoutWrite(f, 1, action('onceAround', event, 'first'));
    assert.deepEqual(await stable(f), g);
    await privacy(f, 'onceAround', event, []);
  } finally {
    f.hooks.beforeWrite = undefined;
    f.sqlite.close();
  }
});

void test('movement first and last preserve counters and storm order across duplicate play, reconnect and phase completion', async () => {
  for (const mode of ['first', 'last'] as const) {
    const f = await fixture('movement');
    try {
      const before = await stable(f),
        event = `movement:${before.turn}`;
      await privacy(f, 'movement', event, ['first', 'last']);
      await rejectsWithoutWrite(f, 1, action('movement', 'movement:1', mode));
      await rejectsWithoutWrite(f, 0, action('movement', event, mode));
      let g = await duplicate(f, action('movement', event, mode));
      const [a, b, c] = f.seats.map((s) => s.playerId);
      const expected = mode === 'first' ? [b, a, c] : [a, c, b];
      assert.deepEqual(g.movementRemaining, expected);
      assert.deepEqual(
        g.saphoMovementLast ?? null,
        mode === 'last' ? { event, turn: before.turn, player: b } : null,
      );
      assert.equal(g.active, expected[0]);
      for (const [index, p] of g.players.entries()) {
        assert.equal(p.spice, before.players[index].spice);
        assert.equal(p.reserves, before.players[index].reserves);
        assert.deepEqual(p.forces, before.players[index].forces);
        assert.equal(p.shipped, before.players[index].shipped);
        assert.equal(p.moved, before.players[index].moved);
      }
      await privacy(f, 'movement', event, []);
      for (const player of expected) {
        assert.equal(g.active, player);
        g = await act(
          f,
          f.seats.findIndex((s) => s.playerId === player),
          { type: 'endMovement' },
        );
        await stable(f);
      }
      assert.notEqual(g.phase, 5);
      assert.equal(g.saphoMovementLast ?? null, null);
      assert.equal(g.turn, before.turn);
      assert.deepEqual(g.order, before.order);
      assert.equal(g.discard.filter((card) => card.id === SAPHO).length, 1);
      assert.deepEqual(physical(g), physical(before));
      await rejectsWithoutWrite(f, 1, action('movement', event, mode));
    } finally {
      f.hooks.beforeWrite = undefined;
      f.sqlite.close();
    }
  }
});

void test('persisted last protection survives the Guild choosing to wait at a later genuine turn boundary', async () => {
  const f = await fixture('movement', true);
  try {
    let g = await stable(f);
    const event = `movement:${g.turn}`;
    await privacy(f, 'movement', event, ['last']);
    await rejectsWithoutWrite(f, 1, action('movement', event, 'first'));
    g = await duplicate(f, action('movement', event, 'last'));
    const [a, b, guild, later] = f.seats.map((s) => s.playerId);
    assert.deepEqual(g.movementRemaining, [a, guild, later, b]);
    assert.equal(g.active, a);
    g = await act(f, 0, { type: 'endMovement' });
    assert.equal(g.decision?.kind, 'guildTiming');
    assert.equal(g.decision!.player, guild);
    await stable(f);
    g = await act(f, 2, { type: 'decision', take: false });
    assert.deepEqual(g.movementRemaining, [later, guild, b]);
    assert.equal(
      g.active,
      later,
      'Guild deferral must remain before the protected last participant.',
    );
    await stable(f);
    g = await act(f, 3, { type: 'endMovement' });
    assert.equal(
      g.decision,
      null,
      'The final Guild/last pair needs no redundant timing decision.',
    );
    assert.equal(g.active, guild);
    assert.deepEqual(g.movementRemaining, [guild, b]);
    g = await act(f, 2, { type: 'endMovement' });
    assert.equal(g.active, b);
    assert.deepEqual(g.movementRemaining, [b]);
    g = await act(f, 1, { type: 'endMovement' });
    assert.notEqual(g.phase, 5);
    assert.equal(g.saphoMovementLast ?? null, null);
    assert.equal(g.discard.filter((card) => card.id === SAPHO).length, 1);
    assert.deepEqual(await stable(f), g);
  } finally {
    f.hooks.beforeWrite = undefined;
    f.sqlite.close();
  }
});
