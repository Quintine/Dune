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
import {
  createAmbassadors,
  placeAmbassador,
  validateAmbassadors,
} from '../game/ecaz-ambassadors';
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

type Custody = 'available' | 'tanks' | 'captured' | 'ghola';

async function fixture(custody: Custody = 'available') {
  const store = unitStore();
  const created = await store.rooms.createRoom(
    'Ecaz seat',
    'emperor',
    false,
    [],
  );
  const code = created.view.code;
  const joined = [
    await store.rooms.joinRoom(code, 'Entrant', 'guild'),
    await store.rooms.joinRoom(code, 'Moritani seat', 'atreides'),
  ];
  const tokens = [created.token, ...joined.map((seat) => seat.token!)];
  const seats = await Promise.all(
    tokens.map((token) => store.restart().authenticate(code, token)),
  );
  const initial = await store.restart().readRoom(code);
  initial.players[0] = engine.newPlayer(seats[0].playerId, 'Ecaz', 'ecaz');
  initial.players[2] = engine.newPlayer(
    seats[2].playerId,
    'Moritani',
    'moritani',
  );
  // This is a conserved, isolated position, not an expansion setup-gate bypass
  // exercised by a live client. Shipment and all acquisition decisions are real actions.
  Object.assign(initial, {
    status: 'playing',
    phase: 5,
    turn: 2,
    advanced: false,
    expansions: ['ecaz'],
    storm: 18,
    order: seats.map((s) => s.playerId),
    active: seats[1].playerId,
    movementRemaining: [
      seats[1].playerId,
      seats[0].playerId,
      seats[2].playerId,
    ],
    deck: baseDeck(),
    discard: [],
  });
  for (const player of initial.players) {
    Object.assign(player, {
      hand: [],
      forces: {},
      reserves: 20,
      tanks: 0,
      spice: 10,
      shipped: false,
      moved: 0,
    });
    player.traitors = [player.leaders[0].id];
    player.hand.push(initial.deck.shift()!, initial.deck.shift()!);
  }
  initial.players[0].ally = seats[2].playerId;
  initial.players[2].ally = seats[0].playerId;
  initial.dukeVidal = createDukeVidal();
  initial.dukeVidal.controller = seats[2].playerId;
  initial.dukeVidal.acquiredTurn = 1;
  initial.dukeVidal.source = 'moritani';
  initial.dukeVidal.leader.usedAt = 'carthag';
  if (custody === 'tanks') {
    initial.dukeVidal.leader.dead = true;
    initial.dukeVidal.leader.deaths = 1;
    initial.dukeVidal.controller = null;
    initial.dukeVidal.source = null;
    initial.dukeVidal.acquiredTurn = null;
  } else if (custody === 'captured')
    initial.dukeVidal.leader.capturedBy = seats[2].playerId;
  else if (custody === 'ghola')
    initial.dukeVidal.leader.gholaBy = seats[2].playerId;
  const ambassadors = createAmbassadors(() => 0.3);
  const token = ambassadors.tokens.find((t) => t.effect === 'ecaz')!.id;
  const placement = placeAmbassador(ambassadors, token, {
    turn: initial.turn,
    availableSpice: initial.players[0].spice,
    destination: {
      id: 'arrakeen',
      stronghold: true,
      inStorm: false,
      allowed: true,
    },
  });
  initial.ecazAmbassadors = placement.state;
  initial.players[0].spice -= placement.cost;
  const save = (g: engine.Game) =>
    store.sqlite
      .prepare('UPDATE rooms SET state = ?, version = ? WHERE code = ?')
      .run(JSON.stringify(g), g.version, code);
  save(initial);
  const ship: engine.Action = {
    type: 'ship',
    territory: 'arrakeen',
    sector: 10,
    amount: 1,
  };
  const view = await store
    .restart()
    .act(code, seats[1], initial.version, ship, clock);
  assert.equal(view.decision?.kind, 'ecazAmbassador');
  const pending = await store.restart().readRoom(code);
  assert.ok(pending.pendingAmbassador?.event);
  assert.equal(pending.players[1].shipped, true);
  assert.equal(pending.players[1].moved, 0);
  assert.equal(pending.players[1].forces['arrakeen:10'], 1);
  assert.equal(pending.players[1].reserves, 19);
  assert.equal(pending.players[1].spice, 9);
  assert.equal(pending.pendingAmbassador!.resume, 'none');
  const trigger: engine.Action = {
    type: 'decision',
    event: pending.pendingAmbassador!.event,
    trigger: true,
    beneficiary: seats[0].playerId,
    choice: 'duke',
  };
  store.writes.length = 0;
  return {
    ...store,
    code,
    tokens,
    seats,
    initial,
    pending,
    ship,
    trigger,
    token,
    save,
  };
}
function barrier() {
  let resolve!: () => void;
  const promise = new Promise<void>((yes) => {
    resolve = yes;
  });
  let arrivals = 0;
  return async () => {
    if (++arrivals === 2) resolve();
    await promise;
  };
}
function conserved(g: engine.Game) {
  validateAmbassadors(g.ecazAmbassadors!);
  const cards = [...g.deck, ...g.discard, ...g.players.flatMap((p) => p.hand)];
  assert.equal(cards.length, baseDeck().length);
  assert.equal(new Set(cards.map((c) => c.id)).size, cards.length);
  for (const player of g.players) {
    assert.equal(
      player.reserves +
        player.tanks +
        Object.values(player.forces).reduce((a, b) => a + b, 0),
      20,
    );
    assert.ok(!player.leaders.some((l) => l.id === g.dukeVidal!.leader.id));
    assert.ok(!player.traitors.includes(g.dukeVidal!.leader.id));
  }
}
function privateState(g: engine.Game) {
  return g.players.map((p) => ({
    id: p.id,
    hand: p.hand,
    traitors: p.traitors,
    leaders: p.leaders,
    spice: p.spice,
  }));
}
async function assertPrivate(
  f: Awaited<ReturnType<typeof fixture>>,
  expected: engine.Game,
) {
  for (let index = 0; index < f.seats.length; index++) {
    const rooms = f.restart();
    const auth = await rooms.authenticate(f.code, f.tokens[index]);
    const view = await rooms.readSeatView(f.code, auth);
    assert.deepEqual(view.players[index].hand, expected.players[index].hand);
    assert.deepEqual(
      view.players[index].traitors,
      expected.players[index].traitors,
    );
    for (let other = 0; other < f.seats.length; other++)
      if (other !== index) {
        assert.equal(view.players[other].hand, undefined);
        assert.equal(view.players[other].traitors, undefined);
      }
    assert.equal('pendingAmbassador' in view, false);
    if (index !== 0)
      assert.equal(view.ambassadorEntry?.dukeAcquisition ?? null, null);
  }
}

void test('Ecaz Duke acquisition survives fresh auth and concurrent CAS once, then the shipped entrant moves', async () => {
  const f = await fixture();
  try {
    conserved(f.pending);
    await assertPrivate(f, f.pending);
    const refreshed = f.restart();
    const owner = await refreshed.authenticate(f.code, f.tokens[0]);
    const view = await refreshed.readSeatView(f.code, owner);
    assert.deepEqual(view.ambassadorEntry?.dukeAcquisition, { blocked: null });
    const privateBefore = privateState(f.pending);
    f.hooks.beforeWrite = barrier();
    const attempts = await Promise.allSettled([
      refreshed.act(f.code, owner, f.pending.version, f.trigger, clock),
      f.restart().act(f.code, f.seats[0], f.pending.version, f.trigger, clock),
    ]);
    f.hooks.beforeWrite = undefined;
    assert.equal(attempts.filter((r) => r.status === 'fulfilled').length, 1);
    assert.equal(attempts.filter((r) => r.status === 'rejected').length, 1);
    assert.deepEqual(
      f.writes.map((w) => w.changes).sort((a, b) => a - b),
      [0, 1],
    );
    const done = await f.restart().readRoom(f.code);
    assert.equal(done.version, f.pending.version + 1);
    assert.deepEqual(done.dukeVidal, {
      ...f.pending.dukeVidal,
      controller: f.seats[0].playerId,
      acquiredTurn: 2,
      source: 'ecaz',
    });
    assert.equal(done.pendingAmbassador, null);
    assert.equal(done.decision, null);
    assert.equal(done.response, null);
    assert.deepEqual(privateState(done), privateBefore);
    assert.deepEqual(
      done.ecazAmbassadors!.cohort,
      f.pending.ecazAmbassadors!.cohort,
    );
    assert.deepEqual(
      done.ecazAmbassadors!.placement,
      f.pending.ecazAmbassadors!.placement,
    );
    for (const token of done.ecazAmbassadors!.tokens) {
      const before = f.pending.ecazAmbassadors!.tokens.find(
        (t) => t.id === token.id,
      )!;
      assert.deepEqual(
        token,
        token.id === f.token
          ? { ...before, zone: 'supply', location: null }
          : before,
      );
    }
    assert.deepEqual(
      done.players.map((p) => ({
        forces: p.forces,
        reserves: p.reserves,
        shipped: p.shipped,
        moved: p.moved,
      })),
      f.pending.players.map((p) => ({
        forces: p.forces,
        reserves: p.reserves,
        shipped: p.shipped,
        moved: p.moved,
      })),
    );
    assert.deepEqual(
      [done.turn, done.phase, done.active, done.movementRemaining],
      [
        f.pending.turn,
        f.pending.phase,
        f.pending.active,
        f.pending.movementRemaining,
      ],
    );
    const addedLog = done.log.slice(f.pending.log.length);
    assert.equal(
      addedLog.filter((e) => JSON.stringify(e).includes('Duke')).length,
      1,
    );
    assert.equal(
      addedLog.filter((e) => JSON.stringify(e).includes('entered')).length,
      0,
    );
    const afterWrites = f.writes.length;
    await assert.rejects(
      f.restart().act(f.code, owner, f.pending.version, f.trigger, clock),
    );
    await assert.rejects(
      f.restart().act(f.code, owner, done.version, f.trigger, clock),
    );
    await assert.rejects(
      f.restart().act(f.code, f.seats[1], done.version, f.ship, clock),
    );
    assert.equal(f.writes.length, afterWrites);
    assert.deepEqual(await f.restart().readRoom(f.code), done);
    await assertPrivate(f, done);
    conserved(done);
    await f.restart().act(
      f.code,
      f.seats[1],
      done.version,
      {
        type: 'move',
        from: 'arrakeen:10',
        territory: 'imperial_basin',
        sector: 10,
        amount: 1,
      },
      clock,
    );
    const moved = await f.restart().readRoom(f.code);
    assert.equal(moved.players[1].moved, 1);
    assert.equal(moved.players[1].forces['imperial_basin:10'], 1);
    assert.equal(moved.players[1].forces['arrakeen:10'] ?? 0, 0);
    assert.deepEqual(moved.dukeVidal, done.dukeVidal);
    assert.equal(moved.pendingAmbassador, null);
    conserved(moved);
  } finally {
    f.sqlite.close();
  }
});

void test('wrong actor, stale event and unsupported Ecaz choices fail before any SQL write', async () => {
  const f = await fixture();
  try {
    const attempts: [number, engine.Action][] = [
      [1, f.trigger],
      [2, f.trigger],
      [0, { ...f.trigger, event: 'obsolete-ambassador-event' }],
      [0, { ...f.trigger, beneficiary: f.seats[2].playerId }],
      [0, { ...f.trigger, choice: 'alliance' }],
      [0, { ...f.trigger, choice: undefined }],
    ];
    for (const [index, action] of attempts) {
      await assert.rejects(
        f
          .restart()
          .act(f.code, f.seats[index], f.pending.version, action, clock),
      );
      assert.equal(f.writes.length, 0);
      assert.deepEqual(await f.restart().readRoom(f.code), f.pending);
    }
    await assertPrivate(f, f.pending);
    conserved(f.pending);
  } finally {
    f.sqlite.close();
  }
});

void test('Tanks, captured and ghola custody remain unavailable after reload without consuming the reusable token', async () => {
  for (const custody of ['tanks', 'captured', 'ghola'] as const) {
    const f = await fixture(custody);
    try {
      const rooms = f.restart();
      const owner = await rooms.authenticate(f.code, f.tokens[0]);
      const view = await rooms.readSeatView(f.code, owner);
      assert.equal(
        typeof view.ambassadorEntry?.dukeAcquisition?.blocked,
        'string',
      );
      assert.ok(view.ambassadorEntry!.dukeAcquisition!.blocked!.length > 0);
      await assertPrivate(f, f.pending);
      await assert.rejects(
        rooms.act(f.code, owner, f.pending.version, f.trigger, clock),
      );
      assert.equal(f.writes.length, 0);
      assert.deepEqual(await f.restart().readRoom(f.code), f.pending);
      assert.equal(
        f.pending.ecazAmbassadors!.tokens.find((t) => t.id === f.token)!.zone,
        'placed',
      );
      conserved(f.pending);
    } finally {
      f.sqlite.close();
    }
  }
});

void test('declining the Ecaz offer keeps Duke custody and the token while resuming the paid entrant action', async () => {
  const f = await fixture();
  try {
    await f.restart().act(
      f.code,
      f.seats[0],
      f.pending.version,
      {
        type: 'decision',
        event: f.trigger.event,
        decline: true,
      },
      clock,
    );
    const declined = await f.restart().readRoom(f.code);
    assert.deepEqual(declined.dukeVidal, f.pending.dukeVidal);
    assert.deepEqual(declined.ecazAmbassadors, f.pending.ecazAmbassadors);
    assert.deepEqual(privateState(declined), privateState(f.pending));
    assert.equal(declined.pendingAmbassador, null);
    assert.equal(declined.players[1].shipped, true);
    assert.equal(declined.players[1].spice, 9);
    assert.equal(f.writes.length, 1);
    await f.restart().act(
      f.code,
      f.seats[1],
      declined.version,
      {
        type: 'move',
        from: 'arrakeen:10',
        territory: 'imperial_basin',
        sector: 10,
        amount: 1,
      },
      clock,
    );
    const moved = await f.restart().readRoom(f.code);
    assert.equal(moved.players[1].moved, 1);
    assert.equal(moved.players[1].forces['imperial_basin:10'], 1);
    assert.deepEqual(moved.dukeVidal, declined.dukeVidal);
    conserved(moved);
  } finally {
    f.sqlite.close();
  }
});
