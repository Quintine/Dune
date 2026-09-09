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
import { MOBILE_LOCATION, mobileRoutes } from '../game/board';
import { homeworldGameIntegrity } from '../game/homeworld-game';

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
async function fixture(faction: 'atreides' | 'ixians') {
  const store = unitStore();
  const made = await store.rooms.createRoom(
    'Homeworld mobility recovery',
    faction,
    true,
    faction === 'ixians' ? ['ix'] : [],
  );
  const code = made.view.code;
  const joined = await store.rooms.joinRoom(code, 'Emperor', 'emperor');
  const tokens = [made.token, joined.token!];
  const auths = await Promise.all(
    tokens.map((token) => store.rooms.authenticate(code, token)),
  );
  let g = await store.rooms.readRoom(code);
  g = engine.applyAction(g, g.host, { type: 'homeworlds', enabled: true });
  for (const p of g.players) g = engine.applyAction(g, p.id, { type: 'ready' });
  g = engine.initializeHomeworldGameForAudit(g);
  for (let step = 0; g.status === 'setup' && step < 40; step++) {
    let next: engine.Game | undefined;
    for (const p of g.players) {
      const view = engine.viewGame(g, p.id);
      view.players.find((seat) => seat.id === p.id)!.bot = 'Easy';
      const action = bots.botActions(view)[0];
      if (action) {
        next = engine.applyAction(g, p.id, action);
        break;
      }
    }
    assert.ok(next);
    g = next;
  }
  assert.equal(g.status, 'playing');
  for (const p of g.players) g.deck.push(...p.hand.splice(0));
  Object.assign(g, {
    phase: 5,
    phaseOpening: null,
    turn: 2,
    storm: 18,
    active: g.host,
    response: null,
    decision: null,
    ready: [],
    movementRemaining: g.players.map((p) => p.id),
    order: g.players.map((p) => p.id),
  });
  g.players[0].shipped = false;
  g.players[0].moved = 0;
  const save = (state: engine.Game) =>
    store.sqlite
      .prepare('UPDATE rooms SET state = ?, version = ? WHERE code = ?')
      .run(JSON.stringify(state), state.version, code);
  const other = await store.rooms.createRoom(
    'Untouched saved mobility table',
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
    g,
    save,
    otherCode: other.view.code,
    otherBefore,
  };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
function position(g: engine.Game, reserves: number) {
  const p = g.players[0],
    source = p.faction === 'ixians' ? MOBILE_LOCATION : 'polar_sink:0';
  p.reserves = reserves;
  p.tanks = 0;
  p.forces = { [source]: 20 - reserves };
  if (p.elites) {
    p.elites.reserves = 4;
    p.elites.tanks = 0;
    p.elites.forces = { [source]: 3 };
  }
  homeworldGameIntegrity(g);
}
function special(f: Fixture, reserves: number) {
  const g = f.g;
  position(g, reserves);
  g.mobileStronghold = { location: 'polar_sink:0' };
  const index = g.deck.findIndex((c) => c.effect === 'karama');
  assert.ok(index >= 0);
  const [card] = g.deck.splice(index, 1);
  g.players[0].hand.push(card);
  const route = mobileRoutes(g, 2)[0];
  assert.ok(route);
  f.save(g);
  return {
    card,
    route,
    action: {
      type: 'card',
      mode: 'special',
      card: card.id,
      route,
      collect: false,
    },
  };
}
async function restore(f: Fixture, state: engine.Game) {
  const rooms = f.restart();
  for (let i = 0; i < f.tokens.length; i++) {
    const auth = await rooms.authenticate(f.code, f.tokens[i]);
    const view = await rooms.readSeatView(f.code, auth);
    assert.deepEqual(view, engine.viewGame(state, state.players[i].id));
    for (const other of view.players.filter(
      (p) => p.id !== state.players[i].id,
    )) {
      assert.equal(other.hand, undefined);
      assert.equal(other.traitors, undefined);
    }
  }
  assert.deepEqual(await rooms.readRoom(f.otherCode), f.otherBefore);
  return rooms;
}
void test('low Caladan saved foresight response cannot reveal cards or write an automatic continuation', async () => {
  const f = await fixture('atreides');
  try {
    position(f.g, 5);
    f.g.response = { kind: 'atreidesSpice', owner: f.g.host, passed: [] };
    f.save(f.g);
    const rooms = f.restart();
    for (const auth of f.auths)
      await assert.rejects(
        rooms.readSeatView(f.code, auth),
        /Caladan|foresight|Homeworld/,
      );
    await assert.rejects(
      rooms.continueRoomAutomatic(f.code, clock),
      /Caladan|foresight|Homeworld/,
    );
    await assert.rejects(
      rooms.act(
        f.code,
        f.auths[0],
        f.g.version,
        { type: 'passResponse' },
        clock,
      ),
    );
    assert.equal(f.writes.length, 0);
    assert.deepEqual(await rooms.readRoom(f.code), f.g);
    assert.deepEqual(await rooms.readRoom(f.otherCode), f.otherBefore);
  } finally {
    f.sqlite.close();
  }
});
void test('already granted Caladan knowledge survives a later low population and room restart only for its owner', async () => {
  const f = await fixture('atreides');
  try {
    position(f.g, 5);
    f.g.spicePeekKnown = true;
    f.save(f.g);
    const rooms = await restore(f, f.g);
    assert.ok((await rooms.readSeatView(f.code, f.auths[0])).spicePeek);
    assert.equal(
      (await rooms.readSeatView(f.code, f.auths[1])).spicePeek,
      null,
    );
    assert.equal(f.writes.length, 0);
  } finally {
    f.sqlite.close();
  }
});
void test('saved low Ix special Karama rejects repeated attempts without spending the card or SQL version', async () => {
  const f = await fixture('ixians');
  try {
    const { action, card } = special(f, 4);
    const rooms = await restore(f, f.g);
    for (let repeat = 0; repeat < 2; repeat++)
      await assert.rejects(
        rooms.act(f.code, f.auths[0], f.g.version, action, clock),
        /Low-population Ix/,
      );
    assert.deepEqual(await rooms.readRoom(f.code), f.g);
    assert.ok(f.g.players[0].hand.some((held) => held.id === card.id));
    assert.equal(f.writes.length, 0);
  } finally {
    f.sqlite.close();
  }
});
void test('concurrent saved high Ix special Karama relocates once with one discarded physical card and one SQL version', async () => {
  const f = await fixture('ixians');
  try {
    const { action, card, route } = special(f, 5);
    const rooms = await restore(f, f.g);
    let release!: () => void,
      arrivals = 0;
    const waiting = new Promise<void>((resolve) => {
      release = resolve;
    });
    f.hooks.beforeWrite = async () => {
      if (++arrivals === 2) release();
      await waiting;
    };
    const results = await Promise.allSettled([
      f.rooms.act(f.code, f.auths[0], f.g.version, action, clock),
      rooms.act(f.code, f.auths[0], f.g.version, action, clock),
    ]);
    delete f.hooks.beforeWrite;
    assert.equal(
      results.filter((result) => result.status === 'fulfilled').length,
      1,
    );
    assert.deepEqual(f.writes.map((write) => write.changes).sort((a, b) => a - b), [0, 1]);
    const next = await rooms.readRoom(f.code);
    assert.equal(next.version, f.g.version + 1);
    assert.equal(next.mobileStronghold!.location, route.at(-1));
    assert.equal(next.players[0].specialKaramaUsed, true);
    assert.equal(next.discard.filter((c) => c.id === card.id).length, 1);
    assert.deepEqual(next.homeworlds, f.g.homeworlds);
    assert.equal(next.players[0].moved, 0);
    await assert.rejects(
      rooms.act(f.code, f.auths[0], f.g.version, action, clock),
    );
    await assert.rejects(
      rooms.act(f.code, f.auths[0], next.version, action, clock),
    );
    assert.deepEqual(await rooms.readRoom(f.code), next);
    await restore(f, next);
    homeworldGameIntegrity(next);
  } finally {
    f.sqlite.close();
  }
});
