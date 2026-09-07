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
  const created = await store.rooms.createRoom('Donor', 'atreides', false, []);
  const code = created.view.code;
  const joined = await store.rooms.joinRoom(code, 'Recipient', 'guild');
  const last = await store.rooms.joinRoom(code, 'Observer', 'emperor');
  const owner = await store.rooms.authenticate(code, created.token);
  const recipient = await store.rooms.authenticate(code, joined.token!);
  const observer = await store.rooms.authenticate(code, last.token!);
  const old = await store.rooms.readRoom(code);
  const initial = engine.createGame(
    code,
    engine.newPlayer(owner.playerId, 'Donor', 'atreides'),
    true,
    ['choam'],
  );
  initial.players.push(
    engine.newPlayer(recipient.playerId, 'Recipient', 'guild'),
    engine.newPlayer(observer.playerId, 'Observer', 'emperor'),
  );
  Object.assign(initial, {
    version: old.version,
    status: 'playing',
    phase: 3,
    turn: 2,
    active: recipient.playerId,
    order: initial.players.map((p) => p.id),
    deck: baseDeck(),
    richeseCache: richeseCards(),
  });
  for (const p of initial.players) {
    p.hand = [];
    p.spice = 10;
  }
  const distrans = initial.richeseCache!.find((c) => c.effect === 'distrans')!;
  initial.richeseCache = initial.richeseCache!.filter(
    (c) => c.id !== distrans.id,
  );
  const given = initial.deck.splice(
    initial.deck.findIndex((c) => c.name === 'Shield'),
    1,
  )[0];
  const karama = initial.deck.splice(
    initial.deck.findIndex((c) => c.effect === 'karama'),
    1,
  )[0];
  initial.players[0].hand.push(distrans, given);
  initial.players[2].hand.push(karama);
  initial.response = {
    kind: 'guildIncome',
    owner: recipient.playerId,
    amount: 3,
    passed: [],
  };
  initial.phaseOpening = { passed: [owner.playerId], initialize: false };
  store.sqlite
    .prepare('UPDATE rooms SET state = ?, version = ? WHERE code = ?')
    .run(JSON.stringify(initial), initial.version, code);
  store.writes.length = 0;
  const action = {
    type: 'card',
    card: distrans.id,
    target: recipient.playerId,
    give: given.id,
  };
  return {
    ...store,
    code,
    owner,
    recipient,
    observer,
    initial,
    distrans,
    given,
    action,
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

void test('duplicate authenticated Distrans submissions across restarted workers commit one transfer and preserve the live parent window', async () => {
  const f = await fixture();
  try {
    f.hooks.beforeWrite = barrier();
    const results = await Promise.allSettled([
      f.rooms.act(f.code, f.owner, f.initial.version, f.action, clock),
      f.restart().act(f.code, f.owner, f.initial.version, f.action, clock),
    ]);
    f.hooks.beforeWrite = undefined;
    committedOnce(results, f.writes);
    const current = await f.restart().readRoom(f.code);
    assert.equal(current.version, f.initial.version + 1);
    assert.deepEqual(current.response, f.initial.response);
    assert.deepEqual(current.phaseOpening, f.initial.phaseOpening);
    assert.equal(current.players[0].hand.length, 0);
    assert.deepEqual(
      current.players[1].hand.map((c) => c.id),
      [f.given.id],
    );
    assert.equal(
      current.discard.filter((c) => c.id === f.distrans.id).length,
      1,
    );
    assert.equal(
      current.discard.some((c) => c.id === f.given.id),
      false,
    );
    assert.deepEqual(
      current.players.map((p) => p.spice),
      [10, 10, 10],
    );
    await assert.rejects(
      f.restart().act(f.code, f.owner, current.version, f.action, clock),
    );
    assert.deepEqual(await f.rooms.readRoom(f.code), current);
    const writes = f.writes.length;
    for (let i = 0; i < 2; i++) {
      const worker = f.restart();
      await worker.readSeatView(f.code, f.recipient);
      await worker.continueRoomAutomatic(f.code, clock);
      assert.deepEqual(await worker.readRoom(f.code), current);
    }
    assert.equal(f.writes.length, writes);
  } finally {
    f.sqlite.close();
  }
});

void test('each persisted seat sees only authorized Distrans choices and the observer never learns the transferred identity', async () => {
  const f = await fixture();
  try {
    const owner = await f.rooms.readSeatView(f.code, f.owner);
    assert.equal(owner.distrans!.card.id, f.distrans.id);
    assert.ok(
      owner
        .distrans!.choices.find((c) => c.recipient === f.recipient.playerId)!
        .cards.some((c) => c.id === f.given.id),
    );
    for (const auth of [f.recipient, f.observer]) {
      const view = await f.restart().readSeatView(f.code, auth);
      assert.equal(view.distrans, null);
      assert.equal(JSON.stringify(view).includes(f.given.id), false);
    }
    await f.rooms.act(f.code, f.owner, f.initial.version, f.action, clock);
    const observer = await f.restart().readSeatView(f.code, f.observer);
    assert.equal(observer.distrans, null);
    assert.equal(JSON.stringify(observer).includes(f.given.id), false);
    const received = await f.restart().readSeatView(f.code, f.recipient);
    assert.ok(JSON.stringify(received).includes(f.given.id));
    assert.ok(
      observer.log.some((entry) => entry.text.includes('discarded Distrans')),
    );
    const persisted = await f.rooms.readRoom(f.code);
    assert.equal(
      persisted.log.some((entry) => entry.text.includes(f.given.name)),
      false,
    );
  } finally {
    f.sqlite.close();
  }
});

void test('another authenticated seat cannot activate a donor card or forge transfer custody even at the current version', async () => {
  const f = await fixture();
  try {
    await assert.rejects(
      f.rooms.act(f.code, f.observer, f.initial.version, f.action, clock),
    );
    await assert.rejects(
      f.rooms.act(
        f.code,
        f.owner,
        f.initial.version,
        { ...f.action, give: f.initial.players[2].hand[0].id },
        clock,
      ),
    );
    assert.deepEqual(await f.restart().readRoom(f.code), f.initial);
    assert.equal(f.writes.length, 0);
  } finally {
    f.sqlite.close();
  }
});
