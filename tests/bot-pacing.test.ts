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
  return { rooms: exports as typeof Rooms, sqlite, hooks, writes };
}

function fakeClock(start = 10000) {
  let time = start;
  const sleeps: number[] = [];
  return {
    sleeps,
    now: () => time,
    advance: (ms: number) => {
      time += ms;
    },
    sleep: async (ms: number) => {
      sleeps.push(ms);
      time += ms;
    },
  };
}
async function fixture() {
  const store = unitStore();
  const created = await store.rooms.createRoom('Owner', 'atreides', false, []);
  const code = created.view.code;
  const auth = await store.rooms.authenticate(code, created.token);
  let initial = await store.rooms.readRoom(code);
  engine.joinGame(initial, engine.newPlayer('guest', 'Human guest', 'emperor'));
  initial.players.forEach((p) => (p.ready = true));
  initial = engine.applyAction(initial, auth.playerId, { type: 'start' });
  store.sqlite
    .prepare('UPDATE rooms SET state = ? WHERE code = ?')
    .run(JSON.stringify(initial), code);
  const clock = fakeClock();
  const enabled = await store.rooms.act(
    code,
    auth,
    initial.version,
    { type: 'setAutopilot', difficulty: 'Hard' },
    clock,
  );
  return {
    ...store,
    code,
    token: created.token,
    auth,
    clock,
    initial,
    enabled,
  };
}

void test('online opt-in persists a deadline without playing; one due step commits only one actual AI action', async () => {
  const f = await fixture();
  try {
    assert.equal(f.enabled.botNextActionAt, 11500);
    assert.equal(f.enabled.botsPending, true);
    let g = await f.rooms.readRoom(f.code);
    assert.deepEqual(g.players[0].traitors, []);
    await f.rooms.continueRoomBots(f.code, 1, f.clock);
    g = await f.rooms.readRoom(f.code);
    assert.deepEqual(f.clock.sleeps, [1500]);
    assert.equal(g.version, f.enabled.version + 1);
    assert.equal(g.players[0].traitors.length, 1);
    assert.deepEqual(g.players[1], f.initial.players[1]);
    assert.equal(g.botNextActionAt, 13000);
    assert.equal(g.botsPending, true);
    // A later probe discovers the remaining decision belongs to the human.
    await f.rooms.continueRoomBots(f.code, 1, f.clock);
    g = await f.rooms.readRoom(f.code);
    assert.equal(g.botsPending, false);
    assert.equal(g.botNextActionAt, undefined);
    assert.equal(g.players[0].traitors.length, 1);
    assert.equal(g.version, f.enabled.version + 2);
  } finally {
    f.sqlite.close();
  }
});

void test('early advance requests neither run AI nor change version/deadline; control changes preserve pending deadline', async () => {
  const f = await fixture();
  try {
    f.clock.advance(700);
    const early = await f.rooms.act(
      f.code,
      f.auth,
      f.enabled.version,
      { type: 'advanceBots' },
      f.clock,
    );
    assert.equal(early.version, f.enabled.version);
    assert.equal(early.botNextActionAt, 11500);
    assert.deepEqual((await f.rooms.readRoom(f.code)).players[0].traitors, []);
    const changed = await f.rooms.act(
      f.code,
      f.auth,
      early.version,
      { type: 'setAutopilot', difficulty: 'Brutal' },
      f.clock,
    );
    assert.equal(changed.botNextActionAt, 11500);
    await f.rooms.continueRoomBots(f.code, 1, f.clock);
    assert.deepEqual(f.clock.sleeps, [800]);
    assert.equal(
      (await f.rooms.readRoom(f.code)).players[0].traitors.length,
      1,
    );
  } finally {
    f.sqlite.close();
  }
});

void test('a new continuation honors the persisted deadline after JSON read/reconnect and does not replay elapsed actions', async () => {
  const f = await fixture();
  try {
    const resumedClock = fakeClock(11499);
    const before = await f.rooms.readSeatView(f.code, f.auth);
    assert.equal(before.botNextActionAt, 11500);
    await f.rooms.continueRoomBots(f.code, 1, resumedClock);
    assert.deepEqual(resumedClock.sleeps, [1]);
    const first = await f.rooms.readRoom(f.code);
    const nextProcessClock = fakeClock(12999);
    await f.rooms.continueRoomBots(f.code, 1, nextProcessClock);
    assert.deepEqual(nextProcessClock.sleeps, [1]);
    const stopped = await f.rooms.readRoom(f.code);
    assert.deepEqual(stopped.players, first.players);
    assert.equal(stopped.botsPending, false);
    const writes = f.writes.length;
    await f.rooms.continueRoomBots(f.code, 3, nextProcessClock);
    assert.equal(f.writes.length, writes);
  } finally {
    f.sqlite.close();
  }
});

void test('takeback while a worker sleeps cancels its action before selection or persistence', async () => {
  const f = await fixture();
  try {
    const clock = {
      now: f.clock.now,
      sleep: async (ms: number) => {
        f.clock.advance(ms);
        await f.rooms.act(
          f.code,
          f.auth,
          f.enabled.version,
          { type: 'setAutopilot', difficulty: null },
          f.clock,
        );
      },
    };
    await f.rooms.continueRoomBots(f.code, 1, clock);
    const g = await f.rooms.readRoom(f.code);
    assert.equal(g.version, f.enabled.version + 1);
    assert.equal(g.players[0].autopilot, undefined);
    assert.deepEqual(g.players[0].traitors, []);
    assert.equal(g.botsPending, false);
    assert.equal(g.botNextActionAt, undefined);
    assert.equal(f.writes.length, 0);
  } finally {
    f.sqlite.close();
  }
});

void test('takeback between a paced AI computation and CAS fences its obsolete action', async () => {
  const f = await fixture();
  try {
    f.hooks.beforeWrite = async () => {
      f.hooks.beforeWrite = undefined;
      await f.rooms.act(
        f.code,
        f.auth,
        f.enabled.version,
        { type: 'setAutopilot', difficulty: null },
        f.clock,
      );
    };
    await f.rooms.continueRoomBots(f.code, 2, f.clock);
    const g = await f.rooms.readRoom(f.code);
    assert.deepEqual(g.players[0].traitors, []);
    assert.equal(g.botsPending, false);
    assert.deepEqual(
      f.writes.map((w) => w.changes),
      [0],
    );
    assert.equal(g.version, f.enabled.version + 1);
  } finally {
    f.sqlite.close();
  }
});

void test('two workers at the same deadline commit one action and one future deadline', async () => {
  const f = await fixture();
  try {
    f.clock.advance(1500);
    let release!: () => void;
    const barrier = new Promise<void>((resolve) => {
      release = resolve;
    });
    let arrivals = 0;
    f.hooks.beforeWrite = async () => {
      if (++arrivals === 2) release();
      await barrier;
    };
    await Promise.all([
      f.rooms.continueRoomBots(f.code, 1, f.clock),
      f.rooms.continueRoomBots(f.code, 1, f.clock),
    ]);
    const g = await f.rooms.readRoom(f.code);
    assert.equal(g.version, f.enabled.version + 1);
    assert.equal(g.players[0].traitors.length, 1);
    assert.equal(g.botNextActionAt, 13000);
    assert.deepEqual(
      f.writes.map((w) => w.changes).sort((a, b) => a - b),
      [0, 1],
    );
  } finally {
    f.sqlite.close();
  }
});

void test('fast offline simulation ignores online deadlines and retains multi-action batches', async () => {
  const f = await fixture();
  try {
    const g = await f.rooms.readRoom(f.code);
    g.players[1].autopilot = 'Hard';
    g.botNextActionAt = Number.MAX_SAFE_INTEGER;
    const before = structuredClone(g);
    const next = bots.runBots(g, 2);
    assert.deepEqual(g, before);
    assert.equal(next.players[0].traitors.length, 1);
    assert.equal(next.players[1].traitors.length, 1);
    assert.equal(f.clock.now(), 10000);
  } finally {
    f.sqlite.close();
  }
});

void test('authenticated GET schedules the persisted queue after reconnect while returning a no-store private view', async () => {
  const f = await fixture();
  try {
    const pending: Promise<unknown>[] = [];
    const exports: { GET?: (req: Request) => Promise<Response> } = {};
    runInNewContext(
      ts.transpileModule(
        readFileSync(
          new URL('../app/api/rooms/[code]/route.ts', import.meta.url),
          'utf8',
        ),
        {
          compilerOptions: {
            module: ts.ModuleKind.CommonJS,
            target: ts.ScriptTarget.ES2022,
          },
        },
      ).outputText,
      {
        exports,
        URL,
        Response,
        JSON,
        require: (name: string) => {
          if (name === '@/db/rooms')
            return {
              ...f.rooms,
              continueRoomBots: (code: string) =>
                f.rooms.continueRoomBots(code, 1, f.clock),
            };
          if (name === '@/game/engine') return engine;
          if (name === 'cloudflare:workers')
            return {
              waitUntil: (work: Promise<unknown>) => pending.push(work),
            };
          throw new Error('Unexpected route dependency ' + name);
        },
      },
    );
    const response = await exports.GET!(
      new Request(`http://localhost/api/rooms/${f.code}`, {
        headers: { cookie: `dune_${f.code}=${f.token}` },
      }),
    );
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const view = (await response.json()) as ReturnType<typeof engine.viewGame>;
    assert.equal(view.me, f.auth.playerId);
    assert.equal(view.version, f.enabled.version);
    assert.equal(view.botNextActionAt, 11500);
    assert.equal(pending.length, 1);
    await Promise.all(pending);
    assert.equal(
      (await f.rooms.readRoom(f.code)).players[0].traitors.length,
      1,
    );
    const unauthorized = await exports.GET!(
      new Request(`http://localhost/api/rooms/${f.code}`),
    );
    assert.notEqual(unauthorized.status, 200);
    assert.equal(
      pending.length,
      1,
      'unauthenticated requests cannot schedule work',
    );
  } finally {
    f.sqlite.close();
  }
});
