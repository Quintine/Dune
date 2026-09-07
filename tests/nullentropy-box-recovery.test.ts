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

async function fixture(single = false) {
  const store = unitStore();
  const created = await store.rooms.createRoom(
    'Searcher',
    'atreides',
    false,
    [],
  );
  const code = created.view.code;
  const joined = await store.rooms.joinRoom(code, 'Guild', 'guild');
  const last = await store.rooms.joinRoom(code, 'Observer', 'emperor');
  const owner = await store.rooms.authenticate(code, created.token);
  const guild = await store.rooms.authenticate(code, joined.token!);
  const observer = await store.rooms.authenticate(code, last.token!);
  const old = await store.rooms.readRoom(code);
  const initial = engine.createGame(
    code,
    engine.newPlayer(owner.playerId, 'Searcher', 'atreides'),
    true,
    ['choam'],
  );
  initial.players.push(
    engine.newPlayer(guild.playerId, 'Guild', 'guild'),
    engine.newPlayer(observer.playerId, 'Observer', 'emperor'),
  );
  Object.assign(initial, {
    version: old.version,
    status: 'playing',
    phase: 3,
    turn: 2,
    active: guild.playerId,
    order: initial.players.map((p) => p.id),
    deck: baseDeck(),
    richeseCache: richeseCards(),
  });
  for (const p of initial.players) {
    p.hand = [];
    p.spice = 10;
  }
  const box = initial.richeseCache!.find((c) => c.effect === 'nullentropyBox')!;
  initial.richeseCache = initial.richeseCache!.filter((c) => c.id !== box.id);
  initial.players[0].hand.push(box);
  for (const name of single
    ? ['Shield']
    : ['Shield', 'Maula Pistol', 'Lasgun', 'Baliset']) {
    const i = initial.deck.findIndex((c) => c.name === name);
    initial.discard.push(...initial.deck.splice(i, 1));
  }
  const i = initial.deck.findIndex((c) => c.effect === 'karama');
  initial.players[2].hand.push(...initial.deck.splice(i, 1));
  initial.response = {
    kind: 'guildIncome',
    owner: guild.playerId,
    amount: 3,
    passed: [owner.playerId],
  };
  initial.phaseOpening = { passed: [owner.playerId], initialize: false };
  const save = (g: engine.Game) =>
    store.sqlite
      .prepare('UPDATE rooms SET state = ?, version = ? WHERE code = ?')
      .run(JSON.stringify(g), g.version, code);
  save(initial);
  store.writes.length = 0;
  return {
    ...store,
    code,
    owner,
    guild,
    observer,
    initial,
    box,
    save,
    action: { type: 'card', card: box.id },
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

void test('duplicate paid starts and selections across restarted workers each commit once and persist one final shuffle', async (t) => {
  const f = await fixture();
  try {
    f.hooks.beforeWrite = barrier();
    const starts = await Promise.allSettled([
      f.rooms.act(f.code, f.owner, f.initial.version, f.action, clock),
      f.restart().act(f.code, f.owner, f.initial.version, f.action, clock),
    ]);
    f.hooks.beforeWrite = undefined;
    committedOnce(starts, f.writes);
    const pending = await f.restart().readRoom(f.code);
    assert.equal(pending.version, f.initial.version + 1);
    assert.equal(pending.players[0].spice, 8);
    assert.deepEqual(pending.discard, f.initial.discard);
    assert.equal(pending.players[0].hand[0].id, f.box.id);
    assert.equal(pending.decision?.kind, 'nullentropy');
    await assert.rejects(
      f.restart().act(f.code, f.owner, pending.version, f.action, clock),
    );
    assert.deepEqual(await f.rooms.readRoom(f.code), pending);
    const selected = f.initial.discard[1].id;
    const action = {
      type: 'decision',
      event: pending.pendingNullentropy!.event,
      card: selected,
    };
    f.writes.length = 0;
    f.hooks.beforeWrite = barrier();
    const choices = await Promise.allSettled([
      f.restart().act(f.code, f.owner, pending.version, action, clock),
      f.rooms.act(f.code, f.owner, pending.version, action, clock),
    ]);
    f.hooks.beforeWrite = undefined;
    committedOnce(choices, f.writes);
    const result = await f.restart().readRoom(f.code);
    assert.equal(result.version, pending.version + 1);
    assert.equal(result.players[0].spice, 8);
    assert.equal(result.pendingNullentropy, null);
    assert.deepEqual(
      result.players[0].hand.map((c) => c.id),
      [selected],
    );
    assert.deepEqual(result.response, f.initial.response);
    assert.deepEqual(result.phaseOpening, f.initial.phaseOpening);
    assert.equal(result.discard.at(-1)!.id, f.box.id);
    assert.deepEqual(
      result.discard.map((c) => c.id).sort(),
      [
        ...f.initial.discard.filter((c) => c.id !== selected).map((c) => c.id),
        f.box.id,
      ].sort(),
    );
    t.mock.method(crypto, 'getRandomValues', () => {
      throw new Error('Unexpected shuffle after committed choice');
    });
    await assert.rejects(
      f.restart().act(f.code, f.owner, result.version, action, clock),
    );
    const writes = f.writes.length;
    for (let i = 0; i < 2; i++) {
      const worker = f.restart();
      await worker.readSeatView(f.code, f.owner);
      await worker.continueRoomAutomatic(f.code, clock);
      assert.deepEqual(await worker.readRoom(f.code), result);
    }
    assert.equal(f.writes.length, writes);
  } finally {
    f.sqlite.close();
  }
});

void test('inspection authority is owner-only after persisted payment, survives restart, and expires when selection completes', async () => {
  const f = await fixture();
  try {
    for (const auth of [f.owner, f.guild, f.observer]) {
      const view = await f.rooms.readSeatView(f.code, auth);
      assert.equal(view.nullentropy?.search ?? null, null);
      for (const card of f.initial.discard)
        assert.equal(JSON.stringify(view).includes(card.id), false);
    }
    await f.rooms.act(f.code, f.owner, f.initial.version, f.action, clock);
    const pending = await f.rooms.readRoom(f.code);
    const beforeWrites = f.writes.length;
    const own = await f.restart().readSeatView(f.code, f.owner);
    assert.deepEqual(
      own.nullentropy!.search!.cards.map((c) => c.id).sort(),
      f.initial.discard.map((c) => c.id).sort(),
    );
    for (const auth of [f.guild, f.observer]) {
      const view = await f.restart().readSeatView(f.code, auth);
      assert.equal(view.nullentropy, null);
      for (const card of f.initial.discard)
        assert.equal(JSON.stringify(view).includes(card.id), false);
    }
    await f.restart().continueRoomAutomatic(f.code, clock);
    assert.equal(f.writes.length, beforeWrites);
    assert.deepEqual(await f.rooms.readRoom(f.code), pending);
    const selected = f.initial.discard[0];
    const action = {
      type: 'decision',
      event: pending.pendingNullentropy!.event,
      card: selected.id,
    };
    await assert.rejects(
      f.rooms.act(f.code, f.observer, pending.version, action, clock),
    );
    await f.restart().act(f.code, f.owner, pending.version, action, clock);
    const ownFinal = await f.rooms.readSeatView(f.code, f.owner);
    assert.equal(ownFinal.nullentropy, null);
    assert.ok(JSON.stringify(ownFinal).includes(selected.id));
    for (const card of f.initial.discard.slice(1))
      assert.equal(JSON.stringify(ownFinal).includes(card.id), false);
    const foreign = await f.rooms.readSeatView(f.code, f.observer);
    assert.equal(JSON.stringify(foreign).includes(selected.id), false);
  } finally {
    f.sqlite.close();
  }
});

void test('a sole eligible discard completes automatically in one paid CAS without an acknowledgement or replay', async () => {
  const f = await fixture(true);
  try {
    f.hooks.beforeWrite = barrier();
    const results = await Promise.allSettled([
      f.rooms.act(f.code, f.owner, f.initial.version, f.action, clock),
      f.restart().act(f.code, f.owner, f.initial.version, f.action, clock),
    ]);
    f.hooks.beforeWrite = undefined;
    committedOnce(results, f.writes);
    const result = await f.restart().readRoom(f.code);
    assert.equal(result.version, f.initial.version + 1);
    assert.equal(result.pendingNullentropy ?? null, null);
    assert.notEqual(result.decision?.kind, 'nullentropy');
    assert.equal(result.players[0].spice, 8);
    assert.deepEqual(result.players[0].hand, f.initial.discard);
    assert.deepEqual(result.discard, [f.box]);
    assert.deepEqual(result.response, f.initial.response);
    assert.deepEqual(result.phaseOpening, f.initial.phaseOpening);
    await assert.rejects(
      f.rooms.act(f.code, f.owner, result.version, f.action, clock),
    );
    assert.deepEqual(await f.rooms.readRoom(f.code), result);
  } finally {
    f.sqlite.close();
  }
});

void test('restored discard signature corruption reveals no paid candidates and cannot partially settle or charge again', async () => {
  const f = await fixture();
  try {
    await f.rooms.act(f.code, f.owner, f.initial.version, f.action, clock);
    const changed = await f.rooms.readRoom(f.code);
    changed.discard[0].name = 'Corrupt stored face';
    f.save(changed);
    const view = await f.restart().readSeatView(f.code, f.owner);
    assert.ok(
      !view.nullentropy?.search || view.nullentropy.search.cards.length === 0,
    );
    const writes = f.writes.length;
    await assert.rejects(
      f
        .restart()
        .act(
          f.code,
          f.owner,
          changed.version,
          {
            type: 'decision',
            event: changed.pendingNullentropy!.event,
            card: changed.discard[0].id,
          },
          clock,
        ),
    );
    assert.deepEqual(await f.rooms.readRoom(f.code), changed);
    assert.equal(f.writes.length, writes);
    assert.equal(changed.players[0].spice, 8);
  } finally {
    f.sqlite.close();
  }
});
