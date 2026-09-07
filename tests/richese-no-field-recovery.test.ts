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
import { createRicheseNoField } from '../game/richese-no-field';
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

const tokenIds = [
  'secret-token-alpha',
  'secret-token-beta',
  'secret-token-gamma',
];
async function fixture(cancelAvailable = false) {
  const store = unitStore();
  const created = await store.rooms.createRoom('Richese', 'guild', false, []);
  const code = created.view.code;
  const joined = await store.rooms.joinRoom(code, 'Harkonnen', 'harkonnen');
  const owner = await store.rooms.authenticate(code, created.token);
  const other = await store.rooms.authenticate(code, joined.token!);
  const stored = await store.rooms.readRoom(code);
  const initial = engine.createGame(
    code,
    engine.newPlayer(owner.playerId, 'Richese', 'richese'),
    false,
    ['choam'],
  );
  initial.players.push(
    engine.newPlayer(other.playerId, 'Harkonnen', 'harkonnen'),
  );
  initial.version = stored.version;
  initial.status = 'playing';
  initial.phase = 5;
  initial.turn = 2;
  initial.active = owner.playerId;
  initial.order = [owner.playerId, other.playerId];
  initial.storm = 18;
  initial.deck = baseDeck();
  initial.discard = [];
  for (const p of initial.players) {
    p.spice = 10;
    p.reserves = 20;
    p.hand = [];
    p.forces = {};
  }
  initial.players[0].noField = createRicheseNoField(tokenIds);
  initial.players[0].noFieldEvent = 'initial-private-selection';
  if (cancelAvailable) {
    const index = initial.deck.findIndex((c) => c.effect === 'karama');
    initial.players[1].hand.push(...initial.deck.splice(index, 1));
  }
  store.sqlite
    .prepare('UPDATE rooms SET state = ?, version = ? WHERE code = ?')
    .run(JSON.stringify(initial), initial.version, code);
  store.writes.length = 0;
  async function action(
    auth: Rooms.SeatAuth,
    action: engine.Action,
    rooms = store.rooms,
  ) {
    const current = await rooms.readRoom(code);
    return rooms.act(code, auth, current.version, action, clock);
  }
  return { ...store, code, owner, other, initial, action };
}
function ship(g: engine.Game, token = tokenIds[2]): engine.Action {
  return {
    type: 'ship',
    noField: token,
    event: g.players[0].noFieldEvent,
    territory: 'imperial_basin',
    sector: 10,
  };
}
function conserve(g: engine.Game) {
  for (const p of g.players)
    assert.equal(
      p.reserves +
        p.tanks +
        Object.values(p.forces).reduce((sum, count) => sum + count, 0),
      20,
    );
}
function barrier() {
  let release!: () => void;
  const ready = new Promise<void>((resolve) => {
    release = resolve;
  });
  let arrivals = 0;
  return async () => {
    if (++arrivals === 2) release();
    await ready;
  };
}
function oneCommit(
  results: PromiseSettledResult<unknown>[],
  writes: { changes: number }[],
) {
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(results.filter((r) => r.status === 'rejected').length, 1);
  assert.deepEqual(
    writes.map((w) => w.changes).sort((a, b) => a - b),
    [0, 1],
  );
}

void test('authenticated restarted No-Field projections expose inventory only to its owner for all three values', async () => {
  for (const token of tokenIds) {
    const f = await fixture();
    try {
      await f.action(f.owner, ship(f.initial, token));
      const restarted = f.restart();
      const state = await restarted.readRoom(f.code);
      const own = await restarted.readSeatView(f.code, f.owner);
      const other = await restarted.readSeatView(f.code, f.other);
      assert.equal(own.richeseNoField!.private!.deployed!.tokenId, token);
      assert.deepEqual(
        own.richeseNoField!.private!.tokens.map((t) => t.value),
        [0, 3, 5],
      );
      assert.equal(other.richeseNoField!.private, null);
      for (const id of tokenIds)
        assert.equal(JSON.stringify(other).includes(id), false);
      assert.deepEqual(other.players[0].noField, {
        deployed: {
          controller: f.owner.playerId,
          location: { territory: 'imperial_basin', sector: 10 },
          effectiveForces: 1,
        },
        lastUsed: null,
      });
      assert.equal(state.players[0].spice, 8);
      assert.equal(state.players[0].reserves, 20);
      assert.deepEqual(state.players[0].forces, {});
      conserve(state);
      const writes = f.writes.length;
      await restarted.readSeatView(f.code, f.owner);
      await restarted.continueRoomAutomatic(f.code, clock);
      assert.equal(f.writes.length, writes);
      assert.deepEqual(await restarted.readRoom(f.code), state);
    } finally {
      f.sqlite.close();
    }
  }
});

void test('pending No-Field shipment survives restart and cancellation commits once without charging or revealing the choice', async () => {
  const f = await fixture(true);
  try {
    await f.action(f.owner, ship(f.initial));
    const pending = await f.rooms.readRoom(f.code);
    assert.equal(pending.response?.kind, 'richeseNoField');
    assert.equal(pending.players[0].noField!.deployed, null);
    assert.equal(pending.players[0].spice, 10);
    const resumed = f.restart();
    const other = await resumed.readSeatView(f.code, f.other);
    for (const token of tokenIds)
      assert.equal(JSON.stringify(other).includes(token), false);
    const cancel = {
      type: 'card',
      mode: 'cancel',
      card: pending.players[1].hand[0].id,
    };
    f.writes.length = 0;
    f.hooks.beforeWrite = barrier();
    const results = await Promise.allSettled([
      resumed.act(f.code, f.other, pending.version, cancel, clock),
      f.rooms.act(f.code, f.other, pending.version, cancel, clock),
    ]);
    f.hooks.beforeWrite = undefined;
    oneCommit(results, f.writes);
    const settled = await resumed.readRoom(f.code);
    assert.equal(settled.version, pending.version + 1);
    assert.equal(settled.players[0].noField!.deployed, null);
    assert.equal(settled.players[0].noField!.lastShipped, null);
    assert.equal(settled.players[0].spice, 10);
    assert.equal(settled.players[0].shipped, false);
    assert.equal(settled.discard.filter((c) => c.id === cancel.card).length, 1);
    await assert.rejects(
      resumed.act(f.code, f.other, settled.version, cancel, clock),
    );
    assert.deepEqual(await resumed.readRoom(f.code), settled);
    await f.action(
      f.owner,
      { type: 'ship', territory: 'arrakeen', sector: 10, amount: 2 },
      resumed,
    );
    const ordinary = await resumed.readRoom(f.code);
    assert.equal(ordinary.players[0].forces['arrakeen:10'], 2);
    assert.equal(ordinary.players[0].spice, 8);
    conserve(ordinary);
  } finally {
    f.sqlite.close();
  }
});

void test('concurrent different No-Field declarations preserve one token selection and payment and fence the losing retry', async () => {
  const f = await fixture();
  try {
    const attempts = [
      ship(f.initial, tokenIds[0]),
      ship(f.initial, tokenIds[2]),
    ];
    f.hooks.beforeWrite = barrier();
    const results = await Promise.allSettled(
      attempts.map((action) =>
        f.rooms.act(f.code, f.owner, f.initial.version, action, clock),
      ),
    );
    f.hooks.beforeWrite = undefined;
    oneCommit(results, f.writes);
    const winner = results.findIndex((r) => r.status === 'fulfilled');
    const state = await f.rooms.readRoom(f.code);
    assert.equal(state.version, f.initial.version + 1);
    assert.equal(
      state.players[0].noField!.deployed!.tokenId,
      attempts[winner].noField,
    );
    assert.equal(state.players[0].spice, 8);
    assert.equal(state.players[0].reserves, 20);
    await assert.rejects(
      f.rooms.act(f.code, f.owner, state.version, attempts[1 - winner], clock),
    );
    assert.deepEqual(await f.restart().readRoom(f.code), state);
    conserve(state);
  } finally {
    f.sqlite.close();
  }
});

void test('marker movement and concurrent revelation persist once, reject stale events and survive repeated recovery', async () => {
  const f = await fixture();
  try {
    await f.action(f.owner, ship(f.initial));
    const shipped = await f.rooms.readRoom(f.code);
    const oldEvent = shipped.players[0].noFieldEvent;
    const move = {
      type: 'move',
      noField: tokenIds[2],
      event: oldEvent,
      forces: {},
      territory: 'arrakeen',
      sector: 10,
    };
    const resumed = f.restart();
    await f.action(f.owner, move, resumed);
    const moved = await resumed.readRoom(f.code);
    assert.notEqual(moved.players[0].noFieldEvent, oldEvent);
    assert.equal(
      moved.players[0].noField!.deployed!.location.territory,
      'arrakeen',
    );
    assert.equal(moved.players[0].moved, 1);
    assert.equal(moved.players[0].reserves, 20);
    assert.deepEqual(moved.players[0].forces, {});
    await assert.rejects(
      resumed.act(
        f.code,
        f.owner,
        moved.version,
        { type: 'revealNoField', token: tokenIds[2], event: oldEvent },
        clock,
      ),
      /changed|stale|refresh/i,
    );
    assert.deepEqual(await resumed.readRoom(f.code), moved);
    const reveal = {
      type: 'revealNoField',
      token: tokenIds[2],
      event: moved.players[0].noFieldEvent,
    };
    f.writes.length = 0;
    f.hooks.beforeWrite = barrier();
    const results = await Promise.allSettled([
      resumed.act(f.code, f.owner, moved.version, reveal, clock),
      f.rooms.act(f.code, f.owner, moved.version, reveal, clock),
    ]);
    f.hooks.beforeWrite = undefined;
    oneCommit(results, f.writes);
    const revealed = await resumed.readRoom(f.code);
    assert.equal(revealed.version, moved.version + 1);
    assert.equal(revealed.players[0].noField!.deployed, null);
    assert.equal(revealed.players[0].forces['arrakeen:10'], 5);
    assert.equal(revealed.players[0].reserves, 15);
    assert.equal(revealed.players[0].spice, 8);
    conserve(revealed);
    for (let i = 0; i < 2; i++) {
      const worker = f.restart();
      await worker.continueRoomAutomatic(f.code, clock);
      const publicView = await worker.readSeatView(f.code, f.other);
      assert.equal(publicView.players[0].noField!.lastUsed, 5);
      assert.equal(publicView.richeseNoField!.private, null);
      await assert.rejects(
        worker.act(f.code, f.owner, revealed.version, reveal, clock),
      );
      assert.deepEqual(await worker.readRoom(f.code), revealed);
    }
  } finally {
    f.sqlite.close();
  }
});
