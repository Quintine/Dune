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
  const made = await store.rooms.createRoom(
    'Homeworld recovery QA',
    'emperor',
    true,
    [],
  );
  const code = made.view.code;
  const joined = await store.rooms.joinRoom(code, 'Observer', 'harkonnen');
  const tokens = [made.token, joined.token!];
  const auths = await Promise.all(
    tokens.map((token) => store.rooms.authenticate(code, token)),
  );
  let g = await store.rooms.readRoom(code);
  g = engine.applyAction(g, g.host, { type: 'homeworlds', enabled: true });
  for (const p of g.players) g = engine.applyAction(g, p.id, { type: 'ready' });
  g = engine.initializeHomeworldGameForAudit(g);
  const setupActions = (id: string) => {
    const view = engine.viewGame(g, id);
    view.players.find((p) => p.id === id)!.bot = 'Medium';
    return bots.botActions(view);
  };
  for (let step = 0; g.status === 'setup' && step < 20; step++) {
    const owner = g.players.find((p) => setupActions(p.id).length)!;
    assert.ok(owner);
    g = engine.applyAction(g, owner.id, setupActions(owner.id)[0]);
  }
  assert.equal(g.status, 'playing');
  // A deterministic phase position after genuine setup; no force/card custody is replaced.
  Object.assign(g, {
    phase: 5,
    active: g.host,
    order: g.players.map((p) => p.id),
    movementRemaining: g.players.map((p) => p.id),
    phaseOpening: null,
    response: null,
    decision: null,
  });
  const save = (state: engine.Game) =>
    store.sqlite
      .prepare('UPDATE rooms SET state = ?, version = ? WHERE code = ?')
      .run(JSON.stringify(state), state.version, code);
  save(g);
  const other = await store.rooms.createRoom(
    'Untouched',
    'atreides',
    false,
    [],
  );
  const otherBefore = await store.rooms.readRoom(other.view.code);
  store.writes.length = 0;
  return {
    ...store,
    code,
    tokens,
    auths,
    save,
    initial: g,
    otherCode: other.view.code,
    otherBefore,
  };
}

for (const counts of [
  [1, 1],
  [1, 2],
])
  void test(`Homeworld move ${counts.join('/')} concurrent SQL orders commit once and restore without hidden-state changes`, async () => {
    const f = await fixture();
    try {
      const before = await f.rooms.readRoom(f.code);
      const view = await f.rooms.readSeatView(f.code, f.auths[0]);
      const order = (normal: number): engine.Action => ({
        type: 'emperorHomeworldMove',
        event: view.homeworldMove!.event,
        origin: 'homeworld:emperor',
        normal,
        elite: 0,
      });
      let release!: () => void;
      let arrivals = 0;
      const waiting = new Promise<void>((resolve) => {
        release = resolve;
      });
      f.hooks.beforeWrite = async () => {
        if (++arrivals === 2) release();
        await waiting;
      };
      const restarted = f.restart();
      const freshAuth = await restarted.authenticate(f.code, f.tokens[0]);
      const results = await Promise.allSettled([
        f.rooms.act(
          f.code,
          f.auths[0],
          before.version,
          order(counts[0]),
          clock,
        ),
        restarted.act(
          f.code,
          freshAuth,
          before.version,
          order(counts[1]),
          clock,
        ),
      ]);
      delete f.hooks.beforeWrite;
      assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
      assert.deepEqual(
        f.writes.map((w) => w.changes).sort((a, b) => a - b),
        [0, 1],
      );
      const committed =
        counts[results.findIndex((r) => r.status === 'fulfilled')];
      const after = await restarted.readRoom(f.code);
      assert.equal(after.version, before.version + 1);
      assert.deepEqual(after.homeworlds!.custody!.salusa, {
        normal: committed,
        elite: 5,
      });
      assert.equal(after.players[0].moved, 1);
      assert.equal(after.players[0].shipped, true);
      for (let i = 0; i < after.players.length; i++) {
        const p = after.players[i];
        assert.equal(p.reserves, before.players[i].reserves);
        assert.equal(p.spice, before.players[i].spice);
        assert.deepEqual(p.hand, before.players[i].hand);
        assert.deepEqual(p.traitors, before.players[i].traitors);
        const auth = await restarted.authenticate(f.code, f.tokens[i]);
        const restored = await restarted.readSeatView(f.code, auth);
        assert.deepEqual(
          restored.homeworlds,
          engine.viewGame(after, p.id).homeworlds,
        );
        assert.deepEqual(
          restored.players.find((seat) => seat.id === p.id)!.hand,
          p.hand,
        );
        assert.ok(
          restored.players
            .filter((seat) => seat.id !== p.id)
            .every((seat) => !('hand' in seat) && !('traitors' in seat)),
        );
      }
      await assert.rejects(
        restarted.act(
          f.code,
          freshAuth,
          before.version,
          order(committed),
          clock,
        ),
      );
      await assert.rejects(
        restarted.act(
          f.code,
          freshAuth,
          after.version,
          order(committed),
          clock,
        ),
      );
      assert.deepEqual(await restarted.readRoom(f.code), after);
      assert.deepEqual(await restarted.readRoom(f.otherCode), f.otherBefore);
    } finally {
      f.sqlite.close();
    }
  });

void test('Homeworld recovery rejects a missing saved Salusa allocation without reconstruction or a database write', async () => {
  const f = await fixture();
  try {
    const corrupt = structuredClone(f.initial);
    corrupt.homeworlds!.custody!.salusa = null;
    f.save(corrupt);
    const fresh = f.restart();
    const auth = await fresh.authenticate(f.code, f.tokens[0]);
    await assert.rejects(fresh.readSeatView(f.code, auth), /Salusa|Homeworld/);
    await assert.rejects(
      fresh.act(f.code, auth, corrupt.version, { type: 'endMovement' }, clock),
      /Salusa|Homeworld/,
    );
    assert.equal(f.writes.length, 0);
    assert.deepEqual(await fresh.readRoom(f.code), corrupt);
    assert.deepEqual(await fresh.readRoom(f.otherCode), f.otherBefore);
  } finally {
    f.sqlite.close();
  }
});
