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

async function fixture(parent = false) {
  const store = unitStore();
  const created = await store.rooms.createRoom('Richese', 'guild', false, []);
  const code = created.view.code;
  const joined = await store.rooms.joinRoom(code, 'Ally', 'atreides');
  const last = await store.rooms.joinRoom(code, 'Other', 'emperor');
  const owner = await store.rooms.authenticate(code, created.token),
    ally = await store.rooms.authenticate(code, joined.token!),
    other = await store.rooms.authenticate(code, last.token!);
  const old = await store.rooms.readRoom(code),
    initial = engine.createGame(
      code,
      engine.newPlayer(owner.playerId, 'Richese', 'richese'),
      true,
      ['choam'],
    );
  initial.players.push(
    engine.newPlayer(ally.playerId, 'Ally', 'atreides'),
    engine.newPlayer(other.playerId, 'Other', 'emperor'),
  );
  initial.version = old.version;
  initial.status = 'playing';
  initial.phase = 3;
  initial.turn = 2;
  initial.active = ally.playerId;
  initial.order = initial.players.map((p) => p.id);
  initial.deck = baseDeck();
  initial.players.forEach((p) => {
    p.hand = [];
    p.spice = 10;
  });
  initial.players[0].ally = ally.playerId;
  initial.players[1].ally = owner.playerId;
  initial.richeseCache = richeseCards();
  const gift = initial.richeseCache.find((c) => c.effect === 'karama')!;
  initial.richeseCache = initial.richeseCache.filter((c) => c.id !== gift.id);
  initial.players[0].hand.push(gift);
  const index = initial.deck.findIndex((c) => c.effect === 'karama');
  initial.players[2].hand.push(...initial.deck.splice(index, 1));
  if (parent) {
    // This suspended receipt is Guild income during Shipment & Movement.
    initial.phase = 5;
    initial.players[2].faction = 'guild';
    initial.response = {
      kind: 'guildIncome',
      owner: other.playerId,
      amount: 3,
      passed: [owner.playerId],
    };
    initial.phaseOpening = { passed: [owner.playerId], initialize: false };
  }
  const save = (g: engine.Game) =>
    store.sqlite
      .prepare('UPDATE rooms SET state = ?, version = ? WHERE code = ?')
      .run(JSON.stringify(g), g.version, code);
  save(initial);
  store.writes.length = 0;
  async function action(
    auth: Rooms.SeatAuth,
    value: engine.Action,
    rooms = store.rooms,
  ) {
    const state = await rooms.readRoom(code);
    return rooms.act(code, auth, state.version, value, clock);
  }
  return {
    ...store,
    owner,
    ally,
    other,
    code,
    initial,
    save,
    action,
    gift: gift.id,
  };
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
function committedOnce(
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
function hands(g: engine.Game) {
  return g.players.map((p) => ({ id: p.id, hand: p.hand }));
}

void test('concurrent authenticated gift declarations and resumed allowance each commit once with private identity and no card replay', async () => {
  const f = await fixture();
  try {
    const action = { type: 'richeseGift', card: f.gift };
    f.hooks.beforeWrite = barrier();
    const declarations = await Promise.allSettled([
      f.rooms.act(f.code, f.owner, f.initial.version, action, clock),
      f.restart().act(f.code, f.owner, f.initial.version, action, clock),
    ]);
    f.hooks.beforeWrite = undefined;
    committedOnce(declarations, f.writes);
    const pending = await f.rooms.readRoom(f.code);
    assert.equal(pending.version, f.initial.version + 1);
    assert.equal(pending.response?.kind, 'richeseGift');
    const restarted = f.restart();
    for (const auth of [f.owner, f.ally])
      assert.equal(
        (await restarted.readSeatView(f.code, auth)).richeseGift!.pending!.card!
          .id,
        f.gift,
      );
    const foreign = await restarted.readSeatView(f.code, f.other);
    assert.equal(foreign.richeseGift, null);
    assert.equal(JSON.stringify(foreign).includes(f.gift), false);
    assert.equal(pending.players[0].hand[0].id, f.gift);
    assert.equal(pending.players[1].hand.length, 0);
    f.writes.length = 0;
    f.hooks.beforeWrite = barrier();
    const allow = { type: 'passResponse' };
    const allowances = await Promise.allSettled([
      restarted.act(f.code, f.other, pending.version, allow, clock),
      f.rooms.act(f.code, f.other, pending.version, allow, clock),
    ]);
    f.hooks.beforeWrite = undefined;
    committedOnce(allowances, f.writes);
    const complete = await restarted.readRoom(f.code);
    assert.equal(complete.version, pending.version + 1);
    assert.equal(complete.pendingRicheseGift, null);
    assert.equal(complete.players[0].hand.length, 0);
    assert.deepEqual(
      complete.players[1].hand.map((c) => c.id),
      [f.gift],
    );
    assert.equal(
      complete.players.every((p) => p.spice === 10),
      true,
    );
    assert.equal(
      complete.discard.some((c) => c.id === f.gift),
      false,
    );
    await assert.rejects(
      restarted.act(f.code, f.owner, complete.version, action, clock),
    );
    const writes = f.writes.length;
    for (let i = 0; i < 2; i++) {
      const worker = f.restart();
      await worker.readSeatView(f.code, f.ally);
      await worker.continueRoomAutomatic(f.code, clock);
      assert.deepEqual(await worker.readRoom(f.code), complete);
    }
    assert.equal(f.writes.length, writes);
  } finally {
    f.sqlite.close();
  }
});
void test('duplicate cancellation restores persisted phase-opening and its parent response without paying or moving the gift', async () => {
  const f = await fixture(true);
  try {
    await f.action(f.owner, { type: 'richeseGift', card: f.gift });
    const pending = await f.rooms.readRoom(f.code);
    assert.equal(pending.phaseOpening, null);
    const resumed = f.restart();
    const cancel = {
      type: 'card',
      mode: 'cancel',
      card: pending.players[2].hand[0].id,
    };
    f.writes.length = 0;
    f.hooks.beforeWrite = barrier();
    const results = await Promise.allSettled([
      resumed.act(f.code, f.other, pending.version, cancel, clock),
      f.rooms.act(f.code, f.other, pending.version, cancel, clock),
    ]);
    f.hooks.beforeWrite = undefined;
    committedOnce(results, f.writes);
    const canceled = await resumed.readRoom(f.code);
    assert.equal(canceled.pendingRicheseGift, null);
    assert.deepEqual(canceled.phaseOpening, f.initial.phaseOpening);
    assert.deepEqual(canceled.response, f.initial.response);
    assert.deepEqual(canceled.players[0].hand, f.initial.players[0].hand);
    assert.equal(canceled.players[1].hand.length, 0);
    assert.equal(canceled.players[2].spice, 10);
    assert.equal(
      canceled.discard.filter((c) => c.id === cancel.card).length,
      1,
    );
    await resumed.continueRoomAutomatic(f.code, clock);
    assert.deepEqual(await resumed.readRoom(f.code), canceled);
    await assert.rejects(
      resumed.act(f.code, f.other, canceled.version, cancel, clock),
    );
    assert.deepEqual(await resumed.readRoom(f.code), canceled);
  } finally {
    f.sqlite.close();
  }
});
void test('restored changed-alliance gift aborts atomically instead of copying the replacement ally hand into the old recipient', async () => {
  const f = await fixture();
  try {
    await f.action(f.owner, { type: 'richeseGift', card: f.gift });
    const pending = await f.rooms.readRoom(f.code);
    pending.players[1].hand.push(pending.deck.shift()!);
    pending.players[2].hand.push(pending.deck.shift()!);
    pending.players[0].ally = f.other.playerId;
    pending.players[1].ally = null;
    pending.players[2].ally = f.owner.playerId;
    f.save(pending);
    const before = hands(pending);
    const resumed = f.restart();
    f.writes.length = 0;
    f.hooks.beforeWrite = barrier();
    const allow = { type: 'passResponse' };
    const results = await Promise.allSettled([
      resumed.act(f.code, f.other, pending.version, allow, clock),
      f.rooms.act(f.code, f.other, pending.version, allow, clock),
    ]);
    f.hooks.beforeWrite = undefined;
    committedOnce(results, f.writes);
    const aborted = await resumed.readRoom(f.code);
    assert.deepEqual(hands(aborted), before);
    assert.equal(aborted.version, pending.version + 1);
    assert.equal(aborted.pendingRicheseGift, null);
    assert.equal(aborted.response, null);
    assert.match(aborted.log.at(-1)!.text, /became unavailable/);
    await resumed.continueRoomAutomatic(f.code, clock);
    assert.deepEqual(await resumed.readRoom(f.code), aborted);
  } finally {
    f.sqlite.close();
  }
});
