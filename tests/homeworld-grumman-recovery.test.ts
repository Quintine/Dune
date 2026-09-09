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

import { createRequire } from 'node:module';
import { baseDeck, spiceDeck } from '../game/cards';
import { createHomeworldCustody } from '../game/homeworld-custody';
import { homeworldContext } from '../game/homeworld-game';
import { createTerrorState, placeTerror } from '../game/moritani-terror';
const clock: Rooms.RoomsClock = { now: () => 10000, sleep: async () => {} };
/** Observe the real dispatcher before its public wrapper drains the saved frame. */
const observed: { applyActionInner?: typeof engine.applyAction } = {};
runInNewContext(
  ts.transpileModule(
    readFileSync(new URL('../game/engine.ts', import.meta.url), 'utf8') +
      '\nexport { applyActionInner };\n',
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText,
  {
    exports: observed,
    require: createRequire(new URL('../game/engine.ts', import.meta.url)),
    crypto: webcrypto,
    structuredClone,
    TextEncoder,
    JSON,
  },
);
function inner(g: engine.Game, id: string, action: engine.Action): engine.Game {
  const before = structuredClone(g);
  const next = JSON.parse(
    JSON.stringify(observed.applyActionInner!(g, id, action)),
  );
  assert.deepEqual(g, before);
  return next;
}

async function fixture(native = 7, amount = 3, overflow = false) {
  const store = unitStore();
  const made = await store.rooms.createRoom(
    'Grumman SQL QA',
    'moritani',
    false,
    ['ecaz'],
  );
  const code = made.view.code;
  const entrant = await store.rooms.joinRoom(code, 'Entrant', 'emperor');
  const observer = await store.rooms.joinRoom(code, 'Observer', 'atreides');
  const tokens = [made.token, entrant.token!, observer.token!];
  const auths = await Promise.all(
    tokens.map((token) => store.rooms.authenticate(code, token)),
  );
  const ids = auths.map((a) => a.playerId);
  let g = await store.rooms.readRoom(code);
  // Explicit Moritani runtime position; complete expansion setup stays gated.
  // Real room credentials, printed card/token identities and all typed forces
  // are retained; the shipment and every subsequent Terror action are genuine.
  Object.assign(g, {
    status: 'playing',
    phase: 5,
    turn: 2,
    storm: 18,
    active: ids[1],
    order: [ids[1], ids[0], ids[2]],
    movementRemaining: [ids[1], ids[0], ids[2]],
    deck: baseDeck(),
    spiceDeck: spiceDeck(),
    phaseOpening: null,
  });
  for (const p of g.players)
    Object.assign(p, {
      forces: {},
      reserves: 20,
      tanks: 0,
      spice: 20,
      hand: [],
      traitors: [],
      traitorChoices: [],
    });
  g.players[1].elites = { reserves: 5, tanks: 0, forces: {}, revived: 0 };
  g.players[0].reserves = native;
  g.players[0].forces = { 'polar_sink:0': 20 - native };
  if (overflow) g.players[0].hand.push(...g.deck.splice(0, 4));
  g.moritaniTerror = createTerrorState(() => 0);
  const token = g.moritaniTerror.tokens.find((t) => t.kind === 'robbery')!;
  g.moritaniTerror = placeTerror(g.moritaniTerror, token.id, 'arrakeen', 1);
  g.homeworlds = { custody: createHomeworldCustody(homeworldContext(g)) };
  homeworldGameIntegrity(g);
  const save = (state: engine.Game) =>
    store.sqlite
      .prepare('UPDATE rooms SET state = ?, version = ? WHERE code = ?')
      .run(JSON.stringify(state), state.version, code);
  save(g);
  await store.rooms.act(
    code,
    auths[1],
    g.version,
    { type: 'ship', territory: 'arrakeen', sector: 10, amount, elite: 0 },
    clock,
  );
  g = await store.rooms.readRoom(code);
  assert.equal(g.pendingTerrorEntry?.stage, 'offer');
  assert.equal(g.pendingTerrorEntry.amount, amount);
  assert.equal(typeof g.pendingTerrorEntry.entrySignature, 'string');
  const other = await store.rooms.createRoom(
    'Untouched room',
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
    ids,
    initial: g,
    save,
    token: token.id,
    otherCode: other.view.code,
    otherBefore,
  };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
const reload = (g: engine.Game): engine.Game => JSON.parse(JSON.stringify(g));
function snapshot(f: Fixture) {
  const row = f.sqlite
    .prepare('SELECT state, version FROM rooms WHERE code = ?')
    .get(f.code)!;
  return {
    version: row.version,
    hash: createHash('sha256').update(String(row.state)).digest('hex'),
  };
}
async function restored(f: Fixture, g: engine.Game) {
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
  homeworldGameIntegrity(g);
  for (const p of g.players)
    assert.equal(
      p.reserves + p.tanks + Object.values(p.forces).reduce((a, b) => a + b, 0),
      20,
    );
  const elite = g.players[1].elites!;
  assert.equal(
    elite.reserves +
      elite.tanks +
      Object.values(elite.forces).reduce((a, b) => a + b, 0),
    5,
  );
  assert.deepEqual(
    [...g.deck, ...g.discard, ...g.players.flatMap((p) => p.hand)]
      .map((c) => c.id)
      .sort(),
    baseDeck()
      .map((c) => c.id)
      .sort(),
  );
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
async function race(f: Fixture, g: engine.Game, action: engine.Action) {
  const rooms = await restored(f, g);
  f.writes.length = 0;
  barrier(f);
  const results = await Promise.allSettled([
    rooms.act(f.code, f.auths[0], g.version, action, clock),
    f.rooms.act(f.code, f.auths[0], g.version, action, clock),
  ]);
  delete f.hooks.beforeWrite;
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.deepEqual(
    f.writes.map((w) => w.changes).sort((a, b) => a - b),
    [0, 1],
  );
  const done = await rooms.readRoom(f.code);
  assert.equal(done.version, g.version + 1);
  return done;
}

void test('production SQL low-Grumman three-force arrival restores its signature and concurrent Robbery reveals and pays once', async () => {
  const f = await fixture();
  try {
    assert.equal(f.initial.players[1].spice, 17);
    assert.equal(f.initial.players[1].reserves, 17);
    assert.deepEqual(
      engine.normalizeAutomaticGame(reload(f.initial)),
      f.initial,
    );
    const entrySignature = f.initial.pendingTerrorEntry!.entrySignature;
    let g = await race(f, f.initial, { type: 'decision', reveal: true });
    assert.equal(g.pendingTerrorEntry?.stage, 'robbery');
    assert.equal(g.pendingTerrorEntry?.entrySignature, entrySignature);
    assert.equal(
      g.moritaniTerror!.tokens.find((t) => t.id === f.token)!.status,
      'removed',
    );
    assert.equal(
      g.log.filter((entry) => entry.text.includes('revealed Robbery')).length,
      1,
    );
    g = await race(f, g, { type: 'decision', choice: 'spice' });
    assert.equal(g.pendingTerrorEntry, null);
    assert.equal(g.players[0].spice, 29);
    assert.equal(g.players[1].spice, 8);
    assert.equal(g.players[1].forces['arrakeen:10'], 3);
    assert.equal(g.players[1].reserves, 17);
    const rooms = await restored(f, g);
    const before = snapshot(f);
    await rooms.continueRoomAutomatic(f.code, clock);
    await assert.rejects(
      rooms.act(
        f.code,
        f.auths[0],
        g.version,
        { type: 'decision', choice: 'spice' },
        clock,
      ),
    );
    assert.deepEqual(snapshot(f), before);
  } finally {
    f.sqlite.close();
  }
});

void test('production SQL high-eight entry of two becomes blocked at low seven and cannot forge three while retaining its original signature', async () => {
  const f = await fixture(8, 2);
  try {
    const low = reload(f.initial);
    low.players[0].reserves--;
    low.players[0].forces['polar_sink:0']++;
    homeworldGameIntegrity(low);
    f.save(low);
    const rooms = await restored(f, low);
    assert.equal(
      (await rooms.readSeatView(f.code, f.auths[0])).terrorEntry?.canReveal,
      false,
    );
    // Explicit legacy compatibility: absence is not proof of corruption and
    // normalization must not invent the original arrival signature.
    const legacy = reload(low);
    delete legacy.pendingTerrorEntry!.entrySignature;
    f.save(legacy);
    await restored(f, legacy);
    const normalizedLegacy = engine.normalizeAutomaticGame(reload(legacy));
    assert.equal(
      normalizedLegacy.pendingTerrorEntry?.entrySignature,
      undefined,
    );
    assert.equal(normalizedLegacy.pendingTerrorEntry?.amount, 2);
    f.save(low);
    const corrupt = reload(low);
    corrupt.pendingTerrorEntry!.amount = 3;
    f.save(corrupt);
    const before = snapshot(f);
    await assert.rejects(
      rooms.readSeatView(f.code, f.auths[0]),
      /original public arrival receipt/,
    );
    assert.throws(
      () => engine.normalizeAutomaticGame(corrupt),
      /original public arrival receipt/,
    );
    await assert.rejects(
      rooms.act(
        f.code,
        f.auths[0],
        corrupt.version,
        { type: 'decision', reveal: true },
        clock,
      ),
      /original public arrival receipt/,
    );
    assert.deepEqual(snapshot(f), before);
    assert.equal(f.writes.length, 0);
    f.save(low);
    await rooms.act(
      f.code,
      f.auths[0],
      low.version,
      { type: 'decision', decline: true },
      clock,
    );
    const declined = await rooms.readRoom(f.code);
    assert.equal(declined.players[1].forces['arrakeen:10'], 2);
    assert.equal(declined.players[1].spice, 18);
    assert.equal(
      declined.moritaniTerror!.tokens.find((t) => t.id === f.token)!.status,
      'placed',
    );
    await restored(f, declined);
  } finally {
    f.sqlite.close();
  }
});

void test('production SQL suspended signed Terror discard rejects altered arrival facts and concurrent recovery retires only its committed card', async () => {
  const f = await fixture(7, 3, true);
  try {
    let g = f.initial;
    await f.rooms.act(
      f.code,
      f.auths[0],
      g.version,
      { type: 'decision', reveal: true },
      clock,
    );
    g = await f.rooms.readRoom(f.code);
    await f.rooms.act(
      f.code,
      f.auths[0],
      g.version,
      { type: 'decision', choice: 'card' },
      clock,
    );
    g = await f.rooms.readRoom(f.code);
    assert.equal(g.players[0].hand.length, 5);
    const discarded = g.players[0].hand[0].id;
    const frame = inner(g, f.ids[0], { type: 'decision', card: discarded });
    assert.equal(frame.pendingTerrorEntry, null);
    const continuation = frame.pendingTreacheryDiscard!.continuation;
    assert.equal(continuation.kind, 'terrorDiscard');
    if (continuation.kind !== 'terrorDiscard')
      throw new Error('Missing suspended Terror parent.');
    assert.equal(
      continuation.entry.entrySignature,
      f.initial.pendingTerrorEntry!.entrySignature,
    );
    f.save(frame);
    f.writes.length = 0;
    await restored(f, frame);
    const corrupt = reload(frame);
    const corrupted = corrupt.pendingTreacheryDiscard!.continuation;
    if (corrupted.kind !== 'terrorDiscard')
      throw new Error('Missing suspended Terror parent.');
    corrupted.entry.amount = 4;
    f.save(corrupt);
    const before = snapshot(f);
    await assert.rejects(
      f.rooms.readSeatView(f.code, f.auths[0]),
      /original public arrival receipt/,
    );
    await assert.rejects(
      f.rooms.continueRoomAutomatic(f.code, clock),
      /original public arrival receipt/,
    );
    assert.deepEqual(snapshot(f), before);
    assert.equal(f.writes.length, 0);
    f.save(frame);
    const rooms = await restored(f, frame);
    barrier(f);
    await Promise.all([
      rooms.continueRoomAutomatic(f.code, clock),
      f.rooms.continueRoomAutomatic(f.code, clock),
    ]);
    delete f.hooks.beforeWrite;
    assert.deepEqual(
      f.writes.map((w) => w.changes).sort((a, b) => a - b),
      [0, 1],
    );
    const done = await rooms.readRoom(f.code);
    assert.equal(done.version, frame.version + 1);
    assert.equal(done.pendingTreacheryDiscard, null);
    assert.equal(done.pendingTerrorEntry, null);
    assert.equal(done.discard.filter((c) => c.id === discarded).length, 1);
    assert.equal(done.players[0].hand.length, 4);
    assert.equal(done.players[1].reserves, 17);
    assert.equal(done.players[1].spice, 17);
    await restored(f, done);
    const settled = snapshot(f);
    await rooms.continueRoomAutomatic(f.code, clock);
    assert.deepEqual(snapshot(f), settled);
  } finally {
    f.sqlite.close();
  }
});
