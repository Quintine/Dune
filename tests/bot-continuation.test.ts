import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as engine from '../game/engine';
import * as bots from '../game/bots';
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
      const continuation =
        this.sql.startsWith('UPDATE rooms SET state') &&
        !this.sql.includes('EXISTS');
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
  // Production timing remains intact; only this internal module harness supplies
  // a deterministic clock, so persisted tests do not sleep in real time.
  let now = 10000;
  const clock: Rooms.RoomsClock = {
    now: () => now,
    sleep: async (ms) => {
      now += ms;
    },
  };
  const roomModule = exports as typeof Rooms;
  const rooms = {
    ...roomModule,
    act: (
      code: string,
      auth: Rooms.SeatAuth,
      version: number,
      action: engine.Action,
    ) => roomModule.act(code, auth, version, action, clock),
    continueRoomBots: (code: string, batches?: number) =>
      roomModule.continueRoomBots(code, batches, clock),
  };
  return { rooms, sqlite, hooks, writes };
}
async function fixture(runBots = bots.runBots) {
  const store = unitStore(runBots);
  const created = await store.rooms.createRoom('Owner', 'atreides', false, []);
  const code = created.view.code;
  const auth = await store.rooms.authenticate(code, created.token);
  let g = await store.rooms.readRoom(code);
  engine.joinGame(g, engine.newPlayer('guest', 'Human guest', 'emperor'));
  g.players.forEach((p) => (p.ready = true));
  g = engine.applyAction(g, auth.playerId, { type: 'start' });
  g = engine.applyAction(g, auth.playerId, {
    type: 'setAutopilot',
    difficulty: 'Hard',
  });
  g.botsPending = true;
  store.sqlite
    .prepare('UPDATE rooms SET state = ? WHERE code = ?')
    .run(JSON.stringify(g), code);
  return { ...store, code, auth, initial: g };
}
function gate() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

void test('a real background bot batch persists its chosen setup action once and stops at a human decision', async () => {
  const f = await fixture();
  try {
    await f.rooms.continueRoomBots(f.code);
    const g = await f.rooms.readRoom(f.code);
    // One action commit, then a metadata-only probe establishes human waiting.
    assert.equal(g.version, f.initial.version + 2);
    assert.equal(g.status, 'setup');
    assert.equal(g.players[0].traitors.length, 1);
    assert.ok(
      f.initial.players[0].traitorChoices.includes(g.players[0].traitors[0]),
    );
    assert.deepEqual(g.players[1], f.initial.players[1]);
    assert.equal(g.botsPending, false);
    assert.equal(g.players[0].bot, undefined);
    assert.equal(g.players[0].autopilot, 'Hard');
    assert.equal(f.writes.length, 2);
    const row = f.sqlite
      .prepare('SELECT state FROM rooms WHERE code = ?')
      .get(f.code)!;
    assert.equal(JSON.parse(String(row.state)).version, g.version);
    await f.rooms.continueRoomBots(f.code);
    assert.deepEqual(await f.rooms.readRoom(f.code), g);
    assert.equal(f.writes.length, 2);
  } finally {
    f.sqlite.close();
  }
});

void test('finished games and tables already waiting for humans do not write another version', async () => {
  const f = await fixture();
  try {
    for (const finished of [false, true]) {
      const g = structuredClone(f.initial);
      g.botsPending = finished;
      if (finished) g.status = 'finished';
      f.sqlite
        .prepare('UPDATE rooms SET state = ? WHERE code = ?')
        .run(JSON.stringify(g), f.code);
      await f.rooms.continueRoomBots(f.code);
      assert.deepEqual(await f.rooms.readRoom(f.code), g);
    }
    assert.deepEqual(f.writes, []);
  } finally {
    f.sqlite.close();
  }
});

void test('continuation budget leaves durable pending work for another explicitly scheduled call', async () => {
  // A deterministic policy keeps work pending, allowing exact persistence/budget assertions.
  const f = await fixture((state) => {
    const g = structuredClone(state);
    g.turn++;
    g.botsPending = true;
    return g;
  });
  try {
    await f.rooms.continueRoomBots(f.code, 2);
    let g = await f.rooms.readRoom(f.code);
    assert.equal(g.version, f.initial.version + 2);
    assert.equal(g.turn, f.initial.turn + 2);
    assert.equal(g.botsPending, true);
    await f.rooms.continueRoomBots(f.code, 1);
    g = await f.rooms.readRoom(f.code);
    assert.equal(g.version, f.initial.version + 3);
    assert.equal(g.turn, f.initial.turn + 3);
    assert.deepEqual(
      f.writes.map((w) => w.changes),
      [1, 1, 1],
    );
  } finally {
    f.sqlite.close();
  }
});

void test('a real owner takeback between background computation and CAS discards the stale bot choice', async () => {
  const f = await fixture();
  try {
    let restored: Awaited<ReturnType<typeof f.rooms.act>> | undefined;
    f.hooks.beforeWrite = async () => {
      f.hooks.beforeWrite = undefined;
      restored = await f.rooms.act(f.code, f.auth, f.initial.version, {
        type: 'setAutopilot',
        difficulty: null,
      });
    };
    await f.rooms.continueRoomBots(f.code);
    const g = await f.rooms.readRoom(f.code);
    assert.ok(restored);
    assert.equal(g.version, restored.version);
    assert.equal(g.version, f.initial.version + 1);
    assert.equal(g.players[0].autopilot, undefined);
    assert.deepEqual(
      g.players[0].traitorChoices,
      f.initial.players[0].traitorChoices,
    );
    assert.deepEqual(g.players[0].traitors, []);
    assert.equal(g.botsPending, false);
    assert.deepEqual(f.writes, [{ expected: f.initial.version, changes: 0 }]);
    assert.deepEqual(await f.rooms.readSeatView(f.code, f.auth), restored);
  } finally {
    f.sqlite.close();
  }
});

void test('two continuations computed from the same version commit only one bot action batch', async () => {
  const f = await fixture();
  const both = gate();
  let arrivals = 0;
  try {
    f.hooks.beforeWrite = async () => {
      arrivals++;
      if (arrivals === 2) both.release();
      await both.promise;
    };
    await Promise.all([
      f.rooms.continueRoomBots(f.code, 1),
      f.rooms.continueRoomBots(f.code, 1),
    ]);
    const g = await f.rooms.readRoom(f.code);
    assert.equal(arrivals, 2);
    assert.deepEqual(
      f.writes.map((w) => w.changes).sort((a, b) => a - b),
      [0, 1],
    );
    assert.equal(g.version, f.initial.version + 1);
    assert.equal(g.players[0].traitors.length, 1);
    assert.ok(
      f.initial.players[0].traitorChoices.includes(g.players[0].traitors[0]),
    );
    assert.deepEqual(g.players[1], f.initial.players[1]);
    assert.equal(
      g.botsPending,
      true,
      'the one-action budget leaves its next probe queued',
    );
  } finally {
    f.sqlite.close();
  }
});
