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

const clock: Rooms.RoomsClock = { now: () => 10000, sleep: async () => {} };
async function fixture(population = 10, withTleilaxu = false) {
  const store = unitStore();
  const made = await store.rooms.createRoom(
    'Tupile recovery QA',
    'choam',
    true,
    ['ix'],
  );
  const code = made.view.code;
  const joined = await store.rooms.joinRoom(code, 'Observer', 'atreides');
  const tokens = [made.token, joined.token!];
  if (withTleilaxu) {
    const tleilaxu = await store.rooms.joinRoom(code, 'Tleilaxu', 'tleilaxu');
    tokens.push(tleilaxu.token!);
  }
  const auths = await Promise.all(
    tokens.map((token) => store.rooms.authenticate(code, token)),
  );
  let g = await store.rooms.readRoom(code);
  g = engine.applyAction(g, g.host, { type: 'homeworlds', enabled: true });
  for (const player of g.players)
    g = engine.applyAction(g, player.id, { type: 'ready' });
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
  // The real CHOAM identity precedes Homeworld/Ix setup and its signed history.
  // Stage only the conserved population and balance needed for this sale.
  Object.assign(g.players[0], {
    name: 'CHOAM',
    spice: 12,
    reserves: population,
    tanks: 1,
    forces: { 'polar_sink:0': 19 - population },
  });
  Object.assign(g, {
    phase: 2,
    phaseOpening: null,
    response: null,
    decision: null,
    active: null,
    order: ids,
    ready: [],
    storm: 18,
    choamCharity: { turn: g.turn, canceled: false },
  });
  const hold = (
    who: number,
    predicate: (card: engine.Player['hand'][number]) => boolean,
  ) => {
    const at = g.deck.findIndex(predicate);
    assert.ok(at >= 0);
    const [card] = g.deck.splice(at, 1);
    g.players[who].hand.push(card);
    return card.id;
  };
  const card = hold(
    0,
    (c) => c.kind === 'worthless' && c.name === 'Kull Wahad',
  );
  const witness = hold(0, (c) => c.kind === 'worthless');
  // The currently implemented deck has no printed Worthless duplicate. Keep
  // two physical IDs and isolate the duplicate-name contract explicitly.
  g.players[0].hand.find((c) => c.id === witness)!.name = 'Kull Wahad';
  const ghola = hold(0, (c) => c.effect === 'ghola');
  const karama = hold(1, (c) => c.effect === 'karama');
  const incomeKarama = withTleilaxu
    ? hold(0, (c) => c.effect === 'karama')
    : null;
  homeworldGameIntegrity(g);
  for (const id of ids) g = engine.applyAction(g, id, { type: 'ready' });
  assert.equal(g.decision?.kind, 'choamMarket');
  store.sqlite
    .prepare('UPDATE rooms SET state = ?, version = ? WHERE code = ?')
    .run(JSON.stringify(g), g.version, code);
  const other = await store.rooms.createRoom(
    'Untouched room',
    'atreides',
    false,
    [],
  );
  const otherBefore = await store.rooms.readRoom(other.view.code);
  const cardIds = [...g.deck, ...g.discard, ...g.players.flatMap((p) => p.hand)]
    .map((c) => c.id)
    .sort();
  store.writes.length = 0;
  return {
    ...store,
    code,
    tokens,
    auths,
    ids,
    initial: g,
    card,
    witness,
    ghola,
    karama,
    incomeKarama,
    cardIds,
    otherCode: other.view.code,
    otherBefore,
  };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
function snapshot(f: Fixture) {
  const row = f.sqlite
    .prepare('SELECT state, version FROM rooms WHERE code = ?')
    .get(f.code)!;
  return {
    version: row.version,
    hash: createHash('sha256').update(String(row.state)).digest('hex'),
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
    if (i !== 0) assert.deepEqual(view.choamMarket, { owner: f.ids[0] });
  }
  homeworldGameIntegrity(state);
  for (const p of state.players)
    assert.equal(
      p.reserves + p.tanks + Object.values(p.forces).reduce((a, b) => a + b, 0),
      20,
    );
  assert.deepEqual(
    [...state.deck, ...state.discard, ...state.players.flatMap((p) => p.hand)]
      .map((c) => c.id)
      .sort(),
    f.cardIds,
  );
  assert.deepEqual(await rooms.readRoom(f.otherCode), f.otherBefore);
  return rooms;
}
async function pending(f: Fixture, duplicate = false) {
  await f.rooms.act(
    f.code,
    f.auths[0],
    f.initial.version,
    {
      type: 'decision',
      mode: 'sell',
      card: f.card,
      ...(duplicate ? { witness: f.witness } : {}),
    },
    clock,
  );
  const g = await f.rooms.readRoom(f.code);
  assert.equal(g.response?.kind, 'choamSale');
  assert.equal(g.choamMarket?.sale?.price, duplicate ? 3 : 2);
  return g;
}
async function raisePopulation(f: Fixture, g: engine.Game) {
  const rooms = await restored(f, g);
  await rooms.act(
    f.code,
    f.auths[0],
    g.version,
    { type: 'card', card: f.ghola, amount: 1 },
    clock,
  );
  const raised = await rooms.readRoom(f.code);
  assert.equal(raised.players[0].reserves, 11);
  assert.equal(raised.players[0].tanks, 0);
  assert.equal(raised.response?.kind, 'choamSale');
  assert.equal(raised.discard.filter((c) => c.id === f.ghola).length, 1);
  await restored(f, raised);
  return raised;
}
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

void test('production SQL high Tupile rejects ordinary and duplicate Worthless sale posts without version, hash or custody changes', async () => {
  const f = await fixture(11);
  try {
    const rooms = await restored(f, f.initial);
    const before = snapshot(f);
    const owner = await rooms.readSeatView(f.code, f.auths[0]);
    assert.deepEqual(owner.choamMarket?.sales, []);
    for (const duplicate of [false, true]) {
      await assert.rejects(
        rooms.act(
          f.code,
          f.auths[0],
          f.initial.version,
          {
            type: 'decision',
            mode: 'sell',
            card: f.card,
            ...(duplicate ? { witness: f.witness } : {}),
          },
          clock,
        ),
        /Tupile/,
      );
      assert.deepEqual(snapshot(f), before);
      assert.deepEqual(await rooms.readRoom(f.code), f.initial);
    }
    assert.equal(f.writes.length, 0);
    await restored(f, f.initial);
  } finally {
    f.sqlite.close();
  }
});

void test('production SQL low Tupile sale restores across restart then genuine Ghola makes its later settlement illegal without selling the card', async () => {
  for (const duplicate of [false, true]) {
    const f = await fixture();
    try {
      const raised = await raisePopulation(f, await pending(f, duplicate));
      const rooms = await restored(f, raised);
      await rooms.act(
        f.code,
        f.auths[1],
        raised.version,
        { type: 'passResponse' },
        clock,
      );
      const done = await rooms.readRoom(f.code);
      assert.equal(done.players[0].spice, 12);
      assert.ok(done.players[0].hand.some((c) => c.id === f.card));
      assert.ok(done.players[0].hand.some((c) => c.id === f.witness));
      assert.equal(
        done.discard.some((c) => c.id === f.card),
        false,
      );
      assert.equal(done.response, null);
      assert.equal(done.choamMarket?.sale, undefined);
      assert.equal(done.decision?.kind, 'choamMarket');
      await restored(f, done);
    } finally {
      f.sqlite.close();
    }
  }
});

void test('production SQL ordinary Karama can still deny a pending sale after genuine Ghola raised Tupile', async () => {
  const f = await fixture();
  try {
    const raised = await raisePopulation(f, await pending(f));
    const rooms = await restored(f, raised);
    await rooms.act(
      f.code,
      f.auths[1],
      raised.version,
      { type: 'card', card: f.karama, mode: 'cancel' },
      clock,
    );
    const done = await rooms.readRoom(f.code);
    assert.equal(done.players[0].spice, 12);
    assert.ok(done.players[0].hand.some((c) => c.id === f.card));
    assert.equal(done.discard.filter((c) => c.id === f.karama).length, 1);
    assert.equal(done.response, null);
    assert.deepEqual(done.choamMarket?.blocked, [f.card]);
    await restored(f, done);
  } finally {
    f.sqlite.close();
  }
});

void test('production SQL duplicate low Tupile settlement races sell and pay exactly once after restart', async () => {
  const f = await fixture();
  try {
    const declared = await pending(f, true);
    const rooms = await restored(f, declared);
    f.writes.length = 0;
    barrier(f);
    const action = { type: 'passResponse' };
    const results = await Promise.allSettled([
      f.rooms.act(f.code, f.auths[1], declared.version, action, clock),
      rooms.act(f.code, f.auths[1], declared.version, action, clock),
    ]);
    delete f.hooks.beforeWrite;
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
    assert.deepEqual(
      f.writes.map((w) => w.changes).sort((a, b) => a - b),
      [0, 1],
    );
    const done = await rooms.readRoom(f.code);
    assert.equal(done.version, declared.version + 1);
    assert.equal(done.players[0].spice, 15);
    assert.equal(done.discard.filter((c) => c.id === f.card).length, 1);
    assert.ok(done.players[0].hand.some((c) => c.id === f.witness));
    assert.equal(done.response, null);
    const before = snapshot(f);
    await assert.rejects(
      rooms.act(f.code, f.auths[1], declared.version, action, clock),
    );
    await assert.rejects(
      rooms.act(f.code, f.auths[1], done.version, action, clock),
    );
    await rooms.continueRoomAutomatic(f.code, clock);
    assert.deepEqual(snapshot(f), before);
    await restored(f, done);
  } finally {
    f.sqlite.close();
  }
});

void test('production SQL Ghola income interruption restores the suspended sale after restart and Karama denial', async () => {
  const f = await fixture(10, true);
  try {
    const declared = await pending(f, true);
    const rooms = await restored(f, declared);
    const incomeBefore = declared.players[2].spice;
    await rooms.act(
      f.code,
      f.auths[0],
      declared.version,
      { type: 'card', card: f.ghola, amount: 1 },
      clock,
    );
    const nested = await rooms.readRoom(f.code);
    assert.equal(nested.response?.kind, 'revivalIncome');
    assert.equal(nested.response?.amount, 1);
    assert.equal(nested.players[0].reserves, 11);
    assert.equal(nested.players[0].spice, 12);
    assert.deepEqual(nested.choamMarket?.sale, declared.choamMarket?.sale);
    assert.ok(nested.pendingChoamMarketGhola);
    // Corrupt only the disposable SQL fixture to exercise saved-frame validation.
    for (const mutate of [
      (g: engine.Game) => {
        g.pendingChoamMarketGhola!.turn++;
      },
      (g: engine.Game) => {
        g.pendingChoamMarketGhola!.market.sale!.price = 2;
      },
      (g: engine.Game) => {
        g.pendingChoamMarketGhola!.discardSequence = 0;
      },
    ]) {
      const corrupt = structuredClone(nested);
      mutate(corrupt);
      f.sqlite
        .prepare('UPDATE rooms SET state = ? WHERE code = ?')
        .run(JSON.stringify(corrupt), f.code);
      const before = snapshot(f);
      const writeCount = f.writes.length;
      const invalidRooms = f.restart();
      await assert.rejects(invalidRooms.readSeatView(f.code, f.auths[0]));
      await assert.rejects(
        invalidRooms.act(
          f.code,
          f.auths[0],
          corrupt.version,
          { type: 'card', card: f.incomeKarama!, mode: 'cancel' },
          clock,
        ),
      );
      assert.deepEqual(snapshot(f), before);
      assert.equal(f.writes.length, writeCount);
    }
    f.sqlite
      .prepare('UPDATE rooms SET state = ? WHERE code = ?')
      .run(JSON.stringify(nested), f.code);
    const restarted = await restored(f, nested);
    await restarted.act(
      f.code,
      f.auths[0],
      nested.version,
      { type: 'card', card: f.incomeKarama!, mode: 'cancel' },
      clock,
    );
    const resumed = await restarted.readRoom(f.code);
    assert.equal(resumed.players[2].spice, incomeBefore);
    assert.equal(
      resumed.discard.filter((c) => c.id === f.incomeKarama).length,
      1,
    );
    assert.equal(resumed.discard.filter((c) => c.id === f.ghola).length, 1);
    assert.equal(resumed.response?.kind, 'choamSale');
    assert.deepEqual(resumed.choamMarket?.sale, declared.choamMarket?.sale);
    const settledRooms = await restored(f, resumed);
    await settledRooms.act(
      f.code,
      f.auths[1],
      resumed.version,
      { type: 'passResponse' },
      clock,
    );
    const done = await settledRooms.readRoom(f.code);
    assert.equal(done.players[0].spice, 12);
    assert.equal(done.players[0].tanks, 0);
    assert.equal(done.players[0].reserves, 11);
    assert.ok(done.players[0].hand.some((c) => c.id === f.card));
    assert.equal(done.response, null);
    assert.equal(done.choamMarket?.sale, undefined);
    await restored(f, done);
  } finally {
    f.sqlite.close();
  }
});
