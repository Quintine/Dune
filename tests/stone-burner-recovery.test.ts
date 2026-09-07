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

async function fixture() {
  const store = unitStore();
  const created = await store.rooms.createRoom('Holder', 'guild', false, []),
    code = created.view.code;
  const joined = await store.rooms.joinRoom(code, 'Opponent', 'atreides'),
    third = await store.rooms.joinRoom(code, 'Observer', 'emperor');
  const owner = await store.rooms.authenticate(code, created.token),
    other = await store.rooms.authenticate(code, joined.token!),
    observer = await store.rooms.authenticate(code, third.token!);
  const old = await store.rooms.readRoom(code);
  let initial = engine.createGame(
    code,
    engine.newPlayer(owner.playerId, 'Holder', 'richese'),
    true,
    ['choam'],
  );
  initial.players.push(
    engine.newPlayer(other.playerId, 'Opponent', 'guild'),
    engine.newPlayer(observer.playerId, 'Observer', 'emperor'),
  );
  Object.assign(initial, {
    version: old.version,
    status: 'playing',
    phase: 6,
    turn: 2,
    active: owner.playerId,
    order: initial.players.map((p) => p.id),
    storm: 18,
    deck: baseDeck(),
    richeseCache: richeseCards(),
  });
  for (const p of initial.players) {
    p.hand = [];
    p.spice = 10;
    p.forces = {};
    p.reserves = 20;
    p.traitors = [];
  }
  for (const p of initial.players.slice(0, 2)) {
    p.forces = { 'arrakeen:10': 5 };
    p.reserves = 15;
  }
  const card = initial.richeseCache!.find((c) => c.effect === 'stoneBurner')!;
  initial.richeseCache = initial.richeseCache!.filter((c) => c.id !== card.id);
  initial.players[0].hand.push(card);
  initial = engine.applyAction(initial, owner.playerId, {
    type: 'chooseBattle',
    target: other.playerId,
    territory: 'arrakeen',
  });
  for (const id of [owner.playerId, other.playerId])
    initial = engine.applyAction(initial, id, {
      type: 'battlePreparationReady',
      event: initial.battle!.event,
    });
  initial = engine.applyAction(initial, owner.playerId, {
    type: 'battlePlan',
    leader: initial.players[0].leaders[0].id,
    dial: 2,
    support: 2,
    weapon: card.id,
  });
  const sealed = structuredClone(initial);
  initial = engine.applyAction(initial, other.playerId, {
    type: 'battlePlan',
    leader: initial.players[1].leaders[0].id,
    dial: 3,
    support: 3,
  });
  const save = (g: engine.Game) =>
    store.sqlite
      .prepare('UPDATE rooms SET state=?,version=? WHERE code=?')
      .run(JSON.stringify(g), g.version, code);
  save(initial);
  store.writes.length = 0;
  const choose: engine.Action = {
      type: 'decision',
      event: initial.battle!.event,
      mode: 'kill',
    },
    call: engine.Action = { type: 'traitorCall', call: false };
  return {
    ...store,
    code,
    owner,
    other,
    observer,
    initial,
    sealed,
    card,
    choose,
    call,
    save,
  };
}
function barrier() {
  let release!: () => void;
  const p = new Promise<void>((resolve) => {
    release = resolve;
  });
  let count = 0;
  return async () => {
    if (++count === 2) release();
    await p;
  };
}
function once(
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

void test('duplicate Stone mode and final traitor requests each CAS once across restart without repeated payment, bounty or death', async () => {
  const f = await fixture();
  try {
    const bounty =
      f.initial.players[0].leaders[0].strength +
      f.initial.players[1].leaders[0].strength;
    f.hooks.beforeWrite = barrier();
    const modes = await Promise.allSettled([
      f.rooms.act(f.code, f.owner, f.initial.version, f.choose, clock),
      f.restart().act(f.code, f.owner, f.initial.version, f.choose, clock),
    ]);
    f.hooks.beforeWrite = undefined;
    once(modes, f.writes);
    let current = await f.restart().readRoom(f.code);
    assert.equal(current.version, f.initial.version + 1);
    assert.equal(current.battle!.stoneBurner![f.owner.playerId], 'kill');
    assert.deepEqual(
      current.players.map((p) => p.spice),
      [10, 10, 10],
    );
    assert.ok(current.players.every((p) => p.leaders.every((l) => !l.dead)));
    assert.deepEqual(current.battle!.plans, f.initial.battle!.plans);
    await assert.rejects(
      f.rooms.act(f.code, f.owner, current.version, f.choose, clock),
    );
    const writes = f.writes.length;
    await f.restart().continueRoomAutomatic(f.code, clock);
    assert.equal(f.writes.length, writes);
    assert.deepEqual(await f.rooms.readRoom(f.code), current);
    await f.rooms.act(f.code, f.owner, current.version, f.call, clock);
    current = await f.rooms.readRoom(f.code);
    f.writes.length = 0;
    f.hooks.beforeWrite = barrier();
    const ends = await Promise.allSettled([
      f.rooms.act(f.code, f.other, current.version, f.call, clock),
      f.restart().act(f.code, f.other, current.version, f.call, clock),
    ]);
    f.hooks.beforeWrite = undefined;
    once(ends, f.writes);
    const done = await f.restart().readRoom(f.code);
    assert.equal(done.version, current.version + 1);
    assert.equal(done.battle, null);
    assert.deepEqual(
      done.players.map((p) => p.spice),
      [8 + bounty, 7, 10],
    );
    assert.deepEqual(
      done.players.slice(0, 2).map((p) => p.leaders[0].deaths),
      [1, 1],
    );
    assert.deepEqual(
      done.players.slice(0, 2).map((p) => p.tanks),
      [2, 5],
    );
    assert.equal(done.decision?.kind, 'battleCards');
    await f.rooms.act(
      f.code,
      f.owner,
      done.version,
      { type: 'decision', discard: [f.card.id] },
      clock,
    );
    const cleaned = await f.rooms.readRoom(f.code);
    assert.equal(cleaned.discard.filter((c) => c.id === f.card.id).length, 1);
    await assert.rejects(
      f.rooms.act(f.code, f.other, cleaned.version, f.call, clock),
    );
    assert.deepEqual(await f.rooms.readRoom(f.code), cleaned);
  } finally {
    f.sqlite.close();
  }
});

void test('competing kill and ignore selections commit one public mode and cannot be revised by refreshed replay or another seat', async () => {
  const f = await fixture();
  try {
    f.hooks.beforeWrite = barrier();
    const choices = await Promise.allSettled([
      f.rooms.act(f.code, f.owner, f.initial.version, f.choose, clock),
      f
        .restart()
        .act(
          f.code,
          f.owner,
          f.initial.version,
          { ...f.choose, mode: 'ignore' },
          clock,
        ),
    ]);
    f.hooks.beforeWrite = undefined;
    once(choices, f.writes);
    const current = await f.restart().readRoom(f.code),
      selected = choices[0].status === 'fulfilled' ? 'kill' : 'ignore';
    assert.equal(current.battle!.stoneBurner![f.owner.playerId], selected);
    const observer = await f.rooms.readSeatView(f.code, f.observer);
    assert.equal(observer.battle!.stoneBurner[f.owner.playerId], selected);
    await assert.rejects(
      f.rooms.act(
        f.code,
        f.owner,
        current.version,
        { ...f.choose, mode: selected === 'kill' ? 'ignore' : 'kill' },
        clock,
      ),
    );
    await assert.rejects(
      f.rooms.act(f.code, f.other, current.version, f.choose, clock),
    );
    assert.deepEqual(await f.rooms.readRoom(f.code), current);
  } finally {
    f.sqlite.close();
  }
});

void test('private sealed Stone remains concealed before joint reveal; stale events, invalid credentials and corrupted saved weapon never write', async () => {
  const f = await fixture();
  try {
    f.save(f.sealed);
    const other = await f.rooms.readSeatView(f.code, f.other);
    assert.equal(other.battle!.plans[f.owner.playerId], undefined);
    assert.ok(!other.battle!.cards.some((c) => c.id === f.card.id));
    assert.deepEqual(other.battle!.stoneBurner, {});
    f.save(f.initial);
    await assert.rejects(
      f.rooms.act(
        f.code,
        f.owner,
        f.initial.version,
        { ...f.choose, event: 'old' },
        clock,
      ),
      /exact/,
    );
    await assert.rejects(
      f.rooms.act(
        f.code,
        { ...f.owner, tokenHash: f.other.tokenHash },
        f.initial.version,
        f.choose,
        clock,
      ),
      /Another action/,
    );
    assert.deepEqual(await f.rooms.readRoom(f.code), f.initial);
    for (const duplicate of [false, true]) {
      const corrupt = structuredClone(f.initial);
      if (duplicate) corrupt.discard.push(structuredClone(f.card));
      else corrupt.players[0].hand = [];
      f.save(corrupt);
      await assert.rejects(
        f.restart().act(f.code, f.owner, corrupt.version, f.choose, clock),
        /missing|duplicated/,
      );
      assert.throws(
        () => engine.normalizeAutomaticGame(corrupt),
        /missing|duplicated/,
      );
      const writes = f.writes.length;
      await f.restart().continueRoomAutomatic(f.code, clock);
      assert.equal(f.writes.length, writes);
      assert.deepEqual(await f.rooms.readRoom(f.code), corrupt);
    }
  } finally {
    f.sqlite.close();
  }
});
