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

function assertPrivate(view: engine.GameView) {
  for (const p of view.players) {
    assert.equal(
      p.reserves + p.tanks + Object.values(p.forces).reduce((a, b) => a + b, 0),
      20,
    );
    if (p.id !== view.me)
      for (const key of ['hand', 'traitors', 'traitorChoices', 'spice'])
        assert.equal(key in p, false);
  }
  for (const key of ['deck', 'spiceDeck', 'tokenHash'])
    assert.equal(key in view, false);
}
async function finish(
  store: ReturnType<typeof unitStore>,
  code: string,
  auth: Rooms.SeatAuth,
  human: boolean,
) {
  let g = await store.rooms.readRoom(code);
  let actions = 0;
  for (; g.status !== 'finished' && actions < 10000; actions++) {
    const version = g.version;
    if (g.botsPending) await store.rooms.continueRoomBots(code, 1);
    else {
      assert.ok(
        human,
        `All-controlled game stopped: ${JSON.stringify({ phase: g.phase, decision: g.decision, response: g.response })}`,
      );
      const view = await store.rooms.readSeatView(code, auth);
      view.players.find((p) => p.id === view.me)!.bot = 'Hard';
      let accepted = false;
      for (const action of bots.botActions(view)) {
        try {
          await store.rooms.act(code, auth, version, action);
          accepted = true;
          break;
        } catch (e) {
          if (!(e instanceof engine.RuleError)) throw e;
        }
      }
      assert.ok(
        accepted,
        `Human policy has no legal action in phase ${g.phase}`,
      );
    }
    g = await store.rooms.readRoom(code);
    assert.equal(g.version, version + 1);
    assertPrivate(await store.rooms.readSeatView(code, auth));
  }
  assert.equal(
    g.status,
    'finished',
    `Game exceeded ${actions} persisted steps`,
  );
  assert.ok(g.winner.length > 0);
  return { g, actions };
}

for (const techEnabled of [false, true])
  void test(`paced production persistence completes six-seat native AI ${techEnabled ? 'tech-token' : 'base'} game with an automated human client`, async (t) => {
    const store = unitStore();
    try {
      const created = await store.rooms.createRoom(
        'Human host',
        'atreides',
        false,
        [],
      );
      const code = created.view.code;
      const auth = await store.rooms.authenticate(code, created.token);
      let view = created.view;
      const play = async (action: engine.Action) => {
        view = await store.rooms.act(code, auth, view.version, action);
      };
      for (const [faction, difficulty] of [
        ['harkonnen', 'Easy'],
        ['fremen', 'Medium'],
        ['emperor', 'Hard'],
        ['guild', 'Brutal'],
        ['beneGesserit', 'Hard'],
      ])
        await play({ type: 'addBot', faction, difficulty });
      if (techEnabled) await play({ type: 'techTokens', enabled: true });
      await play({ type: 'ready' });
      await play({ type: 'start' });
      const { g, actions } = await finish(store, code, auth, true);
      const restored = await store.rooms.readSeatView(code, auth);
      assert.equal(restored.status, 'finished');
      assert.deepEqual(restored.winner, g.winner);
      assert.equal(restored.players.filter((p) => p.bot).length, 5);
      if (techEnabled) {
        assert.deepEqual(restored.techTokens, g.techTokens);
        for (const token of Object.values(restored.techTokens!)) {
          assert.ok(restored.players.some((p) => p.id === token.owner));
          assert.equal(token.spice, 0);
        }
      }
      t.diagnostic(
        `${actions} one-action/probe CAS commits; finished turn ${g.turn}.`,
      );
    } finally {
      store.sqlite.close();
    }
  });

void test('all three delegated human seats complete through paced production persistence with their original credentials and private views', async (t) => {
  const store = unitStore();
  try {
    const created = await store.rooms.createRoom(
      'Autopilot A',
      'atreides',
      false,
      [],
    );
    const code = created.view.code;
    const b = await store.rooms.joinRoom(code, 'Autopilot B', 'emperor');
    const c = await store.rooms.joinRoom(code, 'Autopilot C', 'guild');
    const seats = await Promise.all(
      [created, b, c].map((s) => store.rooms.authenticate(code, s.token!)),
    );
    let g = await store.rooms.readRoom(code);
    for (const auth of seats) {
      await store.rooms.act(code, auth, g.version, { type: 'ready' });
      g = await store.rooms.readRoom(code);
    }
    await store.rooms.act(code, seats[0], g.version, { type: 'start' });
    for (const [i, auth] of seats.entries()) {
      g = await store.rooms.readRoom(code);
      await store.rooms.act(code, auth, g.version, {
        type: 'setAutopilot',
        difficulty: ['Hard', 'Medium', 'Brutal'][i],
      });
    }
    const result = await finish(store, code, seats[0], false);
    for (const auth of seats) {
      const view = await store.rooms.readSeatView(code, auth);
      assertPrivate(view);
      assert.equal(view.me, auth.playerId);
      assert.equal(view.version, result.g.version);
      assert.equal(view.status, 'finished');
      assert.ok(view.players.every((p) => !p.bot && p.autopilot));
    }
    t.diagnostic(
      `${result.actions} paced CAS commits; finished turn ${result.g.turn}.`,
    );
  } finally {
    store.sqlite.close();
  }
});
