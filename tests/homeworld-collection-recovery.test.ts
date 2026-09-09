import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as engine from '../game/engine';
import * as bots from '../game/bots';
import type * as Rooms from '../db/rooms';
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

import { baseDeck, leaders } from '../game/cards';
import { createTechTokens } from '../game/tech-tokens';
const {
  applyAction,
  createGame,
  initializeHomeworldGameForAudit,
  joinGame,
  newPlayer,
  viewGame,
} = engine;
const { botActions } = bots;
type Game = engine.Game;
const clock: Rooms.RoomsClock = { now: () => 10000, sleep: async () => {} };
const own = (g: Game, id: string) => g.players.find((p) => p.id === id)!;
const reload = (g: Game): Game => JSON.parse(JSON.stringify(g));
type Options = {
  advanced?: boolean;
  native?: number;
  shared?: boolean;
  multiple?: boolean;
  stronghold?: boolean;
  empty?: boolean;
  technology?: boolean;
};
function fixture(options: Options = {}) {
  let g = createGame(
    'GIEDICOLLECTION',
    newPlayer('h', 'Harkonnen', 'harkonnen'),
    options.advanced ?? true,
    [],
  );
  joinGame(g, newPlayer('g', 'Guild', 'guild'));
  joinGame(g, newPlayer('a', 'Atreides', 'atreides'));
  g = applyAction(g, 'h', { type: 'homeworlds', enabled: true });
  for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
  g = initializeHomeworldGameForAudit(g);
  for (let n = 0; g.status === 'setup' && n < 40; n++) {
    let next: Game | undefined;
    for (const p of g.players) {
      const view = viewGame(g, p.id);
      view.players.find((seat) => seat.id === p.id)!.bot = 'Easy';
      const command = botActions(view)[0];
      if (command) {
        next = applyAction(g, p.id, command);
        break;
      }
    }
    assert.ok(next);
    g = next;
  }
  assert.equal(g.status, 'playing');
  for (const p of g.players) {
    g.deck.push(...p.hand.splice(0));
    Object.assign(p, {
      spice: 20,
      forces: {},
      reserves: 20,
      tanks: 0,
      shipped: true,
      moved: 0,
    });
  }
  const hark = own(g, 'h');
  hark.forces = {
    'wind_pass:14': 2,
    ...(options.multiple ? { 'hagga_basin:12': 2 } : {}),
    ...(options.stronghold ? { 'arrakeen:10': 1 } : {}),
  };
  hark.reserves = options.native ?? 7;
  hark.forces['imperial_basin:10'] =
    20 - hark.reserves - Object.values(hark.forces).reduce((a, b) => a + b, 0);
  if (options.shared) {
    // Explicit Ecaz faction seam after genuine base Homeworld setup; the shared
    // collection and all negotiated allocations still use production actions.
    const ecaz = own(g, 'g');
    ecaz.faction = 'ecaz';
    ecaz.leaders = leaders('ecaz');
    ecaz.forces = {
      'wind_pass:14': 2,
      ...(options.multiple ? { 'hagga_basin:12': 2 } : {}),
      ...(options.stronghold ? { 'arrakeen:10': 1 } : {}),
    };
    ecaz.reserves = 20 - Object.values(ecaz.forces).reduce((a, b) => a + b, 0);
    ecaz.ally = hark.id;
    hark.ally = ecaz.id;
    ecaz.allySinceTurn = hark.allySinceTurn = 1;
  }
  Object.assign(g, {
    phase: 5,
    turn: 2,
    active: 'a',
    movementRemaining: ['a'],
    order: ['g', 'h', 'a'],
    ready: [],
    phaseOpening: null,
    response: null,
    decision: null,
    storm: 18,
    spice: options.empty
      ? {}
      : {
          'wind_pass:14': 3,
          ...(options.multiple ? { 'hagga_basin:12': 5 } : {}),
        },
  });
  if (options.technology) {
    g.techTokens = createTechTokens(g.players);
    g.techTokens.heighliners = { owner: 'h', spice: 2 };
  }
  inventory(g);
  return g;
}
function inventory(g: Game) {
  homeworldGameIntegrity(g);
  for (const p of g.players) {
    assert.equal(
      p.reserves + p.tanks + Object.values(p.forces).reduce((a, b) => a + b, 0),
      20,
    );
    const view = viewGame(reload(g), p.id);
    for (const other of view.players.filter((other) => other.id !== p.id)) {
      assert.equal(other.hand, undefined);
      assert.equal(other.spice, undefined);
    }
  }
  assert.deepEqual(
    [...g.deck, ...g.discard, ...g.players.flatMap((p) => p.hand)]
      .map((c) => c.id)
      .sort(),
    baseDeck()
      .map((c) => c.id)
      .sort(),
  );
}
async function persisted(options: Options = {}, collection = false) {
  const store = unitStore();
  const made = await store.rooms.createRoom(
    'Giedi SQL QA',
    'harkonnen',
    true,
    [],
  );
  const code = made.view.code;
  const guild = await store.rooms.joinRoom(code, 'Guild', 'guild');
  const atreides = await store.rooms.joinRoom(code, 'Atreides', 'atreides');
  const tokens = [made.token, guild.token!, atreides.token!];
  const auths = await Promise.all(
    tokens.map((token) => store.rooms.authenticate(code, token)),
  );
  const initial = await store.rooms.readRoom(code);
  const prepared = fixture(options);
  // Preserve the production room credentials while relocating the audited
  // fixture's three identities consistently through its JSON keys and values.
  let encoded = JSON.stringify(prepared);
  for (const [index, id] of ['h', 'g', 'a'].entries())
    encoded = encoded.replaceAll(
      JSON.stringify(id),
      JSON.stringify(auths[index].playerId),
    );
  let g: Game = JSON.parse(encoded);
  g.code = code;
  g.host = auths[0].playerId;
  g.version = initial.version;
  // Create signed collection receipts only after identities are bound.
  if (collection) {
    g = applyAction(g, auths[2].playerId, { type: 'endMovement' });
    assert.equal(g.phase, 7);
  }
  const save = (state: Game) =>
    store.sqlite
      .prepare('UPDATE rooms SET state = ?, version = ? WHERE code = ?')
      .run(JSON.stringify(state), state.version, code);
  save(g);
  const other = await store.rooms.createRoom(
    'Untouched observer room',
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
    ids: auths.map((a) => a.playerId),
    initial: g,
    save,
    otherCode: other.view.code,
    otherBefore,
  };
}
type Fixture = Awaited<ReturnType<typeof persisted>>;
function snapshot(f: Fixture) {
  const row = f.sqlite
    .prepare('SELECT state, version FROM rooms WHERE code = ?')
    .get(f.code)!;
  return {
    version: row.version,
    hash: createHash('sha256').update(String(row.state)).digest('hex'),
  };
}
async function restored(f: Fixture, g: Game) {
  const rooms = f.restart();
  for (let i = 0; i < f.tokens.length; i++) {
    const auth = await rooms.authenticate(f.code, f.tokens[i]);
    const view = await rooms.readSeatView(f.code, auth);
    assert.deepEqual(view, engine.viewGame(g, f.ids[i]));
    for (const other of view.players.filter((p) => p.id !== f.ids[i])) {
      assert.equal(other.hand, undefined);
      assert.equal(other.spice, undefined);
    }
  }
  inventory(g);
  assert.deepEqual(await rooms.readRoom(f.otherCode), f.otherBefore);
  return rooms;
}
function barrier(f: Fixture) {
  let count = 0;
  let release!: () => void;
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  f.hooks.beforeWrite = async () => {
    if (++count === 2) release();
    await waiting;
  };
}
async function chooseShared(
  f: Fixture,
  g: Game,
  allocation: Record<string, unknown>,
) {
  const actor = g.decision!.player;
  const auth = f.auths.find((a) => a.playerId === actor)!;
  const rooms = await restored(f, g);
  await rooms.act(
    f.code,
    auth,
    g.version,
    { type: 'decision', event: g.ecazCollection!.event, allocation },
    clock,
  );
  return rooms.readRoom(f.code);
}

void test('production SQL competing last movements commit multiple desert collection and Giedi bonus exactly once', async () => {
  const f = await persisted({ multiple: true });
  try {
    const rooms = await restored(f, f.initial);
    barrier(f);
    const results = await Promise.allSettled([
      rooms.act(
        f.code,
        f.auths[2],
        f.initial.version,
        { type: 'endMovement' },
        clock,
      ),
      f.rooms.act(
        f.code,
        f.auths[2],
        f.initial.version,
        { type: 'endMovement' },
        clock,
      ),
    ]);
    delete f.hooks.beforeWrite;
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
    assert.deepEqual(
      f.writes.map((w) => w.changes).sort((a, b) => a - b),
      [0, 1],
    );
    const done = await rooms.readRoom(f.code);
    assert.equal(done.version, f.initial.version + 1);
    assert.equal(done.phase, 7);
    assert.equal(done.players[0].spice, 29);
    assert.equal(done.giediCollection?.qualifying, 7);
    assert.equal(done.giediCollection?.awarded, true);
    const before = snapshot(f);
    await rooms.continueRoomAutomatic(f.code, clock);
    await assert.rejects(
      rooms.act(
        f.code,
        f.auths[2],
        done.version,
        { type: 'endMovement' },
        clock,
      ),
    );
    assert.deepEqual(snapshot(f), before);
    await restored(f, done);
  } finally {
    f.sqlite.close();
  }
});

void test('production SQL duplicate shared settlement restores the first positive Giedi award without replay', async () => {
  const f = await persisted({ shared: true }, true);
  try {
    const rooms = await restored(f, f.initial);
    assert.equal(f.initial.giediCollection?.awarded, false);
    const auth = f.auths.find(
      (a) => a.playerId === f.initial.decision!.player,
    )!;
    const action = {
      type: 'decision',
      event: f.initial.ecazCollection!.event,
      allocation: { kind: 'equal' },
    };
    barrier(f);
    const results = await Promise.allSettled([
      rooms.act(f.code, auth, f.initial.version, action, clock),
      f.rooms.act(f.code, auth, f.initial.version, action, clock),
    ]);
    delete f.hooks.beforeWrite;
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
    assert.deepEqual(
      f.writes.map((w) => w.changes).sort((a, b) => a - b),
      [0, 1],
    );
    const done = await rooms.readRoom(f.code);
    assert.equal(done.players[0].spice, 24);
    assert.equal(done.giediCollection?.qualifying, 2);
    assert.equal(done.giediCollection?.awarded, true);
    assert.equal(done.ecazCollection!.settled.length, 1);
    const before = snapshot(f);
    await assert.rejects(rooms.act(f.code, auth, done.version, action, clock));
    await rooms.continueRoomAutomatic(f.code, clock);
    assert.deepEqual(snapshot(f), before);
    await restored(f, done);
  } finally {
    f.sqlite.close();
  }
});

void test('production SQL zero shared allotment remains unawarded after restart and a later positive territory awards once', async () => {
  const f = await persisted({ shared: true, multiple: true }, true);
  try {
    let g = f.initial;
    const first =
      g.ecazCollection!.allocation!.lots[g.ecazCollection!.allocation!.index];
    g = await chooseShared(f, g, { kind: 'propose', ecazShare: first.amount });
    g = await chooseShared(f, g, { kind: 'accept' });
    assert.equal(g.players[0].spice, 20);
    assert.equal(g.giediCollection!.qualifying, 0);
    assert.equal(g.giediCollection!.awarded, false);
    await restored(f, g);
    const next =
      g.ecazCollection!.allocation!.lots[g.ecazCollection!.allocation!.index];
    g = await chooseShared(f, g, { kind: 'equal' });
    assert.equal(g.players[0].spice, 22 + Math.ceil(next.amount / 2));
    assert.equal(g.giediCollection!.awarded, true);
    assert.equal(g.giediCollection!.qualifying, Math.ceil(next.amount / 2));
    const rooms = await restored(f, g);
    const before = snapshot(f);
    await rooms.continueRoomAutomatic(f.code, clock);
    assert.deepEqual(snapshot(f), before);
  } finally {
    f.sqlite.close();
  }
});

void test('production SQL corrupted existing Giedi award receipt rejects private reads and actions without writes', async () => {
  const f = await persisted({ multiple: true }, true);
  try {
    for (const mutate of [
      (g: Game) => {
        g.giediCollection!.qualifying++;
      },
      (g: Game) => {
        g.giediCollection!.player = f.ids[1];
      },
      (g: Game) => {
        g.giediCollection!.awarded = false;
      },
      (g: Game) => {
        g.giediCollection!.signature = 'replayed';
      },
    ]) {
      const corrupt = reload(f.initial);
      mutate(corrupt);
      f.save(corrupt);
      const before = snapshot(f);
      const rooms = f.restart();
      await assert.rejects(rooms.readSeatView(f.code, f.auths[0]));
      await assert.rejects(
        rooms.act(
          f.code,
          f.auths[0],
          corrupt.version,
          { type: 'ready' },
          clock,
        ),
      );
      assert.throws(() => engine.normalizeAutomaticGame(corrupt));
      assert.deepEqual(snapshot(f), before);
      assert.equal(f.writes.length, 0);
    }
    f.save(f.initial);
    await restored(f, f.initial);
  } finally {
    f.sqlite.close();
  }
});
