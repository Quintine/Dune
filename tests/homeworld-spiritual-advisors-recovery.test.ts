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
async function fixture(withBox = false) {
  const store = unitStore();
  const made = await store.rooms.createRoom(
    'Wallach recovery QA',
    'atreides',
    true,
    withBox ? ['choam'] : [],
  );
  const code = made.view.code;
  const joined = await store.rooms.joinRoom(
    code,
    'Bene Gesserit',
    'beneGesserit',
  );
  const tokens = [made.token, joined.token!];
  if (withBox) {
    const richese = await store.rooms.joinRoom(code, 'Richese', 'richese');
    tokens.push(richese.token!);
  }
  const auths = await Promise.all(
    tokens.map((token) => store.rooms.authenticate(code, token)),
  );
  let g = await store.rooms.readRoom(code);
  g = engine.applyAction(g, g.host, { type: 'homeworlds', enabled: true });
  for (const player of g.players)
    g = engine.applyAction(g, player.id, { type: 'ready' });
  // Audit the Richese faction/cache with the implemented base deck; the full
  // expansion treachery deck remains gated independently of this Box case.
  if (withBox) g.expansions = [];
  g = engine.initializeHomeworldGameForAudit(g);
  for (let i = 0; g.status === 'setup' && i < 30; i++) {
    let next: engine.Game | undefined;
    for (const player of g.players) {
      const view = engine.viewGame(g, player.id);
      view.players.find((p) => p.id === player.id)!.bot = 'Easy';
      const action = bots.botActions(view)[0];
      if (action) {
        next = engine.applyAction(g, player.id, action);
        break;
      }
    }
    assert.ok(next);
    g = next;
  }
  assert.equal(g.status, 'playing');
  for (const player of g.players) g.deck.push(...player.hand.splice(0));
  const ids = g.players.map((p) => p.id);
  Object.assign(g, {
    phase: 5,
    phaseOpening: null,
    response: null,
    decision: null,
    active: ids[0],
    order: ids,
    movementRemaining: ids,
    ready: [],
    storm: 18,
  });
  Object.assign(g.players[1], {
    reserves: 11,
    tanks: 0,
    forces: { 'polar_sink:0': 9 },
    advisors: {},
  });
  for (const player of g.players)
    Object.assign(player, { shipped: false, moved: 0 });
  const at = g.deck.findIndex((card) => card.effect === 'karama');
  assert.ok(at >= 0);
  const [karama] = g.deck.splice(at, 1);
  g.players[0].hand.push(karama);
  let box: string | null = null;
  let recovered: string | null = null;
  if (withBox) {
    const index = g.richeseCache!.findIndex(
      (card) => card.effect === 'nullentropyBox',
    );
    assert.ok(index >= 0);
    const [card] = g.richeseCache!.splice(index, 1);
    g.players[0].hand.push(card);
    box = card.id;
    const recoverable = g.deck.shift()!;
    recovered = recoverable.id;
    g.discard.push(recoverable, g.deck.shift()!);
  }
  homeworldGameIntegrity(g);
  g = engine.applyAction(g, ids[0], {
    type: 'ship',
    territory: 'arrakeen',
    sector: 10,
    amount: 1,
  });
  assert.equal(g.decision?.kind, 'advisor');
  const save = (state: engine.Game) =>
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
    ids,
    save,
    initial: g,
    karama: karama.id,
    box,
    recovered,
    otherCode: other.view.code,
    otherBefore,
  };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
function barrier(f: Fixture) {
  let arrivals = 0;
  let release!: () => void;
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  f.hooks.beforeWrite = async () => {
    if (++arrivals === 2) release();
    await waiting;
  };
}
async function restored(f: Fixture, state: engine.Game) {
  const rooms = f.restart();
  for (let i = 0; i < f.tokens.length; i++) {
    const auth = await rooms.authenticate(f.code, f.tokens[i]);
    const view = await rooms.readSeatView(f.code, auth);
    assert.deepEqual(view, engine.viewGame(state, f.ids[i]));
    for (const opponent of view.players.filter((p) => p.id !== f.ids[i])) {
      assert.equal(opponent.hand, undefined);
      assert.equal(opponent.traitors, undefined);
    }
  }
  homeworldGameIntegrity(state);
  for (const p of state.players)
    assert.equal(
      p.reserves + p.tanks + Object.values(p.forces).reduce((a, b) => a + b, 0),
      20,
    );
  assert.deepEqual(await rooms.readRoom(f.otherCode), f.otherBefore);
  return rooms;
}
async function pending(f: Fixture) {
  await f.rooms.act(
    f.code,
    f.auths[1],
    f.initial.version,
    { type: 'decision', accept: true, amount: 2 },
    clock,
  );
  const g = await f.rooms.readRoom(f.code);
  assert.equal(g.response?.kind, 'advisor');
  assert.equal(g.response?.amount, 2);
  assert.equal(g.players[1].reserves, 11);
  f.writes.length = 0;
  return g;
}

void test('production SQL duplicate high-Wallach declarations select two once and restore the still-unspent group', async () => {
  const f = await fixture();
  try {
    const rooms = await restored(f, f.initial);
    const action = { type: 'decision', accept: true, amount: 2 };
    barrier(f);
    const result = await Promise.allSettled([
      f.rooms.act(f.code, f.auths[1], f.initial.version, action, clock),
      rooms.act(f.code, f.auths[1], f.initial.version, action, clock),
    ]);
    delete f.hooks.beforeWrite;
    assert.equal(result.filter((r) => r.status === 'fulfilled').length, 1);
    assert.deepEqual(
      f.writes.map((w) => w.changes).sort((a, b) => a - b),
      [0, 1],
    );
    const g = await rooms.readRoom(f.code);
    assert.equal(g.version, f.initial.version + 1);
    assert.equal(g.response?.amount, 2);
    assert.equal(g.players[1].reserves, 11);
    assert.equal(g.players[1].forces['polar_sink:0'], 9);
    await restored(f, g);
  } finally {
    f.sqlite.close();
  }
});

void test('production SQL competing one/two choices preserve one exact selected group through restart and allowance', async () => {
  const f = await fixture();
  try {
    const rooms = await restored(f, f.initial);
    barrier(f);
    const result = await Promise.allSettled(
      [1, 2].map((amount) =>
        rooms.act(
          f.code,
          f.auths[1],
          f.initial.version,
          { type: 'decision', accept: true, amount },
          clock,
        ),
      ),
    );
    delete f.hooks.beforeWrite;
    assert.equal(result.filter((r) => r.status === 'fulfilled').length, 1);
    const selected = await rooms.readRoom(f.code);
    const amount = selected.response!.amount!;
    assert.ok(amount === 1 || amount === 2);
    const restarted = await restored(f, selected);
    await restarted.act(
      f.code,
      f.auths[0],
      selected.version,
      { type: 'passResponse' },
      clock,
    );
    const done = await restarted.readRoom(f.code);
    assert.equal(done.players[1].reserves, 11 - amount);
    assert.equal(done.players[1].forces['polar_sink:0'], 9 + amount);
    assert.equal(done.response, null);
    await assert.rejects(
      restarted.act(
        f.code,
        f.auths[0],
        selected.version,
        { type: 'passResponse' },
        clock,
      ),
    );
    await assert.rejects(
      restarted.act(
        f.code,
        f.auths[0],
        done.version,
        { type: 'passResponse' },
        clock,
      ),
    );
    await restored(f, done);
  } finally {
    f.sqlite.close();
  }
});

void test('production SQL allowance-versus-Karama race settles the whole selected pair or neither exactly once', async () => {
  const f = await fixture();
  try {
    const before = await pending(f);
    const rooms = await restored(f, before);
    barrier(f);
    const result = await Promise.allSettled([
      f.rooms.act(
        f.code,
        f.auths[0],
        before.version,
        { type: 'passResponse' },
        clock,
      ),
      rooms.act(
        f.code,
        f.auths[0],
        before.version,
        { type: 'card', mode: 'cancel', card: f.karama },
        clock,
      ),
    ]);
    delete f.hooks.beforeWrite;
    assert.equal(result.filter((r) => r.status === 'fulfilled').length, 1);
    assert.deepEqual(
      f.writes.map((w) => w.changes).sort((a, b) => a - b),
      [0, 1],
    );
    const done = await rooms.readRoom(f.code);
    const canceled = done.discard.some((c) => c.id === f.karama);
    assert.equal(done.players[1].reserves, canceled ? 11 : 9);
    assert.equal(done.players[1].forces['polar_sink:0'], canceled ? 9 : 11);
    assert.equal(
      done.players[0].hand.some((c) => c.id === f.karama),
      !canceled,
    );
    assert.equal(done.response, null);
    assert.equal(done.version, before.version + 1);
    await rooms.continueRoomAutomatic(f.code, clock);
    assert.deepEqual(await rooms.readRoom(f.code), done);
    await restored(f, done);
  } finally {
    f.sqlite.close();
  }
});

void test('production SQL duplicate allowance cannot withdraw the pair or cross the low threshold twice', async () => {
  const f = await fixture();
  try {
    const before = await pending(f);
    const rooms = await restored(f, before);
    barrier(f);
    const result = await Promise.allSettled([
      f.rooms.act(
        f.code,
        f.auths[0],
        before.version,
        { type: 'passResponse' },
        clock,
      ),
      rooms.act(
        f.code,
        f.auths[0],
        before.version,
        { type: 'passResponse' },
        clock,
      ),
    ]);
    delete f.hooks.beforeWrite;
    assert.equal(result.filter((r) => r.status === 'fulfilled').length, 1);
    const done = await rooms.readRoom(f.code);
    assert.equal(done.players[1].reserves, 9);
    assert.equal(done.players[1].forces['polar_sink:0'], 11);
    assert.equal(
      done.discard.some((c) => c.id === f.karama),
      false,
    );
    await restored(f, done);
  } finally {
    f.sqlite.close();
  }
});

void test('production SQL corrupt advisor amount, destination or low-population parent fails before any reaction card or write', async () => {
  const f = await fixture();
  try {
    const before = await pending(f);
    for (const mutate of [
      (g: engine.Game) => {
        g.response!.amount = 3;
      },
      (g: engine.Game) => {
        g.response!.amount = 0;
      },
      (g: engine.Game) => {
        g.response!.amount = null as unknown as number;
      },
      (g: engine.Game) => {
        g.response!.location = 'arrakeen:10';
      },
      (g: engine.Game) => {
        g.players[1].reserves--;
        g.players[1].forces['polar_sink:0']++;
      },
    ]) {
      const bad = structuredClone(before);
      mutate(bad);
      f.save(bad);
      f.writes.length = 0;
      const rooms = f.restart();
      await assert.rejects(rooms.readSeatView(f.code, f.auths[0]));
      await assert.rejects(
        rooms.act(
          f.code,
          f.auths[0],
          bad.version,
          { type: 'card', mode: 'cancel', card: f.karama },
          clock,
        ),
      );
      assert.equal(f.writes.length, 0);
      const raw = f.sqlite
        .prepare('SELECT state FROM rooms WHERE code = ?')
        .get(f.code) as { state: string };
      assert.deepEqual(JSON.parse(raw.state), bad);
    }
    f.save(before);
    await restored(f, before);
  } finally {
    f.sqlite.close();
  }
});

void test('production SQL paid Box preserves the selected pair across restart and rejects corrupted suspended amounts before recovery', async () => {
  const f = await fixture(true);
  try {
    const before = await pending(f);
    await f.rooms.act(
      f.code,
      f.auths[0],
      before.version,
      { type: 'card', card: f.box! },
      clock,
    );
    const search = await f.rooms.readRoom(f.code);
    assert.equal(search.decision?.kind, 'nullentropy');
    assert.deepEqual(
      search.pendingNullentropy!.resume.response,
      before.response,
    );
    assert.equal(search.players[0].spice, before.players[0].spice - 2);
    assert.equal(search.players[1].reserves, 11);
    await restored(f, search);
    const selection = {
      type: 'decision',
      event: search.pendingNullentropy!.event,
      card: f.recovered!,
    };
    for (const mutate of [
      (g: engine.Game) => {
        g.pendingNullentropy!.resume.response!.amount = 3;
      },
      (g: engine.Game) => {
        g.pendingNullentropy!.resume.response!.location = 'arrakeen:10';
      },
      (g: engine.Game) => {
        g.players[1].reserves--;
        g.players[1].forces['polar_sink:0']++;
      },
    ]) {
      const bad = structuredClone(search);
      mutate(bad);
      f.save(bad);
      f.writes.length = 0;
      const rooms = f.restart();
      await assert.rejects(rooms.readSeatView(f.code, f.auths[0]));
      await assert.rejects(
        rooms.act(f.code, f.auths[0], bad.version, selection, clock),
      );
      assert.equal(f.writes.length, 0);
      const row = f.sqlite
        .prepare('SELECT state FROM rooms WHERE code = ?')
        .get(f.code) as { state: string };
      assert.deepEqual(JSON.parse(row.state), bad);
    }
    f.save(search);
    const rooms = f.restart();
    await rooms.act(f.code, f.auths[0], search.version, selection, clock);
    const resumed = await rooms.readRoom(f.code);
    assert.equal(resumed.pendingNullentropy, null);
    assert.deepEqual(resumed.response, before.response);
    assert.equal(resumed.players[0].spice, search.players[0].spice);
    assert.equal(
      resumed.players[0].hand.filter((c) => c.id === f.recovered).length,
      1,
    );
    assert.equal(resumed.discard.filter((c) => c.id === f.box).length, 1);
    await rooms.act(
      f.code,
      f.auths[0],
      resumed.version,
      { type: 'passResponse' },
      clock,
    );
    const done = await rooms.readRoom(f.code);
    assert.equal(done.players[1].reserves, 9);
    assert.equal(done.players[1].forces['polar_sink:0'], 11);
    assert.equal(done.response, null);
    await restored(f, done);
  } finally {
    f.sqlite.close();
  }
});
