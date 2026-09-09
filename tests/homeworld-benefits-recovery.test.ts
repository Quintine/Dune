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
import type { FactionId } from '../game/catalog';
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
async function fixture(revival = false, advanced = !revival) {
  const store = unitStore();
  const roster: FactionId[] = revival
    ? ['tleilaxu', 'atreides', 'harkonnen']
    : ['atreides', 'beneGesserit', 'guild'];
  const made = await store.rooms.createRoom(
    'Homeworld benefits recovery QA',
    roster[0],
    advanced,
    revival ? ['ix'] : [],
  );
  const code = made.view.code;
  const tokens = [made.token];
  for (const faction of roster.slice(1)) {
    const joined = await store.rooms.joinRoom(code, faction, faction);
    tokens.push(joined.token!);
  }
  const auths = await Promise.all(
    tokens.map((token) => store.rooms.authenticate(code, token)),
  );
  let g = await store.rooms.readRoom(code);
  g = engine.applyAction(g, g.host, { type: 'homeworlds', enabled: true });
  for (const player of g.players)
    g = engine.applyAction(g, player.id, { type: 'ready' });
  g = engine.initializeHomeworldGameForAudit(g);
  for (let step = 0; g.status === 'setup' && step < 30; step++) {
    let next: engine.Game | undefined;
    for (const player of g.players) {
      const view = engine.viewGame(g, player.id);
      view.players.find((owner) => owner.id === player.id)!.bot = 'Easy';
      const action = bots.botActions(view)[0];
      if (action) {
        next = engine.applyAction(g, player.id, action);
        break;
      }
    }
    assert.ok(next, 'Genuine setup must supply a legal decision.');
    g = next;
  }
  assert.equal(g.status, 'playing');
  for (const player of g.players) g.deck.push(...player.hand.splice(0));
  Object.assign(g, {
    phase: 2,
    turn: 2,
    active: null,
    ready: [],
    phaseOpening: null,
    response: null,
    decision: null,
  });
  const save = (state: engine.Game) =>
    store.sqlite
      .prepare('UPDATE rooms SET state = ?, version = ? WHERE code = ?')
      .run(JSON.stringify(state), state.version, code);
  const other = await store.rooms.createRoom(
    'Untouched saved table',
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
    initial: g,
    save,
    otherCode: other.view.code,
    otherBefore,
  };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;

function position(g: engine.Game, index: number, reserves: number, tanks = 0) {
  const player = g.players[index];
  assert.equal(
    player.elites,
    undefined,
    'These fixtures use ordinary-force factions.',
  );
  Object.assign(player, {
    reserves,
    tanks,
    forces: { 'polar_sink:0': 20 - reserves - tanks },
  });
  homeworldGameIntegrity(g);
}
function charity(f: Fixture) {
  let g = f.initial;
  position(g, 1, 10);
  // Explicit payer seam after genuine base setup; this is not CHOAM setup or
  // deck certification. All original physical forces and cards are retained.
  g.players[2].faction = 'choam';
  g.players[2].spice = 12;
  g.players[1].spice = 9;
  g.choamCharity = { turn: g.turn, canceled: false };
  const index = g.deck.findIndex((card) => card.effect === 'karama');
  assert.ok(index >= 0);
  const [card] = g.deck.splice(index, 1);
  g.players[0].hand.push(card);
  g = engine.applyAction(g, g.players[1].id, { type: 'charity' });
  assert.equal(g.response?.kind, 'bgCharity');
  assert.equal(g.response.amount, 3);
  assert.equal(g.response.charityHomeworld, 1);
  f.save(g);
  return { g, card };
}
function enterRevival(state: engine.Game) {
  let g = state;
  for (const player of g.players)
    g = engine.applyAction(g, player.id, { type: 'ready' });
  for (let step = 0; (g.phase === 3 || g.phaseOpening) && step < 100; step++) {
    if (g.phaseOpening) {
      const player = g.players.find(
        (owner) => !g.phaseOpening!.passed.includes(owner.id),
      )!;
      g = engine.applyAction(g, player.id, { type: 'ready' });
    } else {
      assert.ok(g.auction?.active);
      g = engine.applyAction(g, g.auction.active, { type: 'passBid' });
    }
  }
  assert.equal(g.phase, 4);
  assert.equal(g.phaseOpening ?? null, null);
  return g;
}
async function restored(f: Fixture, state: engine.Game) {
  const restarted = f.restart();
  for (let i = 0; i < f.tokens.length; i++) {
    const auth = await restarted.authenticate(f.code, f.tokens[i]);
    const view = await restarted.readSeatView(f.code, auth);
    assert.deepEqual(view, engine.viewGame(state, state.players[i].id));
    for (const other of view.players.filter(
      (player) => player.id !== state.players[i].id,
    )) {
      assert.equal(other.hand, undefined);
      assert.equal(other.traitors, undefined);
      assert.equal(other.prediction, undefined);
    }
  }
  assert.deepEqual(await restarted.readRoom(f.otherCode), f.otherBefore);
  return restarted;
}
async function race(f: Fixture, owner: number, actions: engine.Action[]) {
  const before = await f.rooms.readRoom(f.code);
  const restarted = f.restart();
  const freshAuth = await restarted.authenticate(f.code, f.tokens[owner]);
  let release!: () => void;
  let arrivals = 0;
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  f.hooks.beforeWrite = async () => {
    if (++arrivals === 2) release();
    await waiting;
  };
  const results = await Promise.allSettled([
    f.rooms.act(f.code, f.auths[owner], before.version, actions[0], clock),
    restarted.act(f.code, freshAuth, before.version, actions[1], clock),
  ]);
  delete f.hooks.beforeWrite;
  assert.equal(
    results.filter((result) => result.status === 'fulfilled').length,
    1,
  );
  assert.deepEqual(
    f.writes
      .slice(-2)
      .map((write) => write.changes)
      .sort((a, b) => a - b),
    [0, 1],
  );
  const after = await restarted.readRoom(f.code);
  assert.equal(after.version, before.version + 1);
  const winner = results.findIndex((result) => result.status === 'fulfilled');
  await assert.rejects(
    restarted.act(f.code, freshAuth, before.version, actions[winner], clock),
  );
  assert.deepEqual(await restarted.readRoom(f.code), after);
  return { after, winner, restarted, freshAuth };
}

for (const choices of [
  ['allow', 'allow'],
  ['cancel', 'cancel'],
  ['allow', 'cancel'],
])
  void test(`saved BG Homeworld charity ${choices.join('/')} SQL race pays or cancels the two sources exactly once`, async () => {
    const f = await fixture();
    try {
      const { g, card } = charity(f);
      const fresh = await restored(f, g);
      await fresh.continueRoomAutomatic(f.code, clock);
      assert.deepEqual(
        await fresh.readRoom(f.code),
        g,
        'A real held Karama keeps the saved choice pending.',
      );
      assert.equal(f.writes.length, 0);
      const actions: engine.Action[] = choices.map((choice) =>
        choice === 'allow'
          ? { type: 'passResponse' }
          : { type: 'card', card: card.id, mode: 'cancel' },
      );
      const { after, winner, restarted } = await race(f, 0, actions);
      const canceled = choices[winner] === 'cancel';
      assert.equal(after.response, null);
      assert.equal(after.players[1].spice, canceled ? 9 : 12);
      assert.equal(after.players[2].spice, canceled ? 12 : 10);
      assert.equal(after.players[1].charityTurn, g.turn);
      assert.equal(
        after.discard.filter((held) => held.id === card.id).length,
        canceled ? 1 : 0,
      );
      assert.deepEqual(after.homeworlds, g.homeworlds);
      assert.deepEqual(
        after.players.map((player) => player.forces),
        g.players.map((player) => player.forces),
      );
      await restarted.continueRoomAutomatic(f.code, clock);
      await assert.rejects(
        restarted.act(
          f.code,
          f.auths[1],
          after.version,
          { type: 'charity' },
          clock,
        ),
      );
      assert.deepEqual(await restarted.readRoom(f.code), after);
      await restored(f, after);
    } finally {
      f.sqlite.close();
    }
  });

void test('saved BG charity with a corrupt Homeworld source split rejects reads, recovery and actions without SQL writes', async () => {
  const f = await fixture();
  try {
    const { g } = charity(f);
    for (const amount of [undefined, 0, 2]) {
      const corrupt = structuredClone(g);
      if (amount === undefined) delete corrupt.response!.charityHomeworld;
      else corrupt.response!.charityHomeworld = amount;
      f.save(corrupt);
      const restarted = f.restart();
      await assert.rejects(
        restarted.readSeatView(f.code, f.auths[0]),
        /Homeworld|charity/i,
      );
      await assert.rejects(
        restarted.continueRoomAutomatic(f.code, clock),
        /Homeworld|charity/i,
      );
      await assert.rejects(
        restarted.act(
          f.code,
          f.auths[0],
          corrupt.version,
          { type: 'passResponse' },
          clock,
        ),
        /Homeworld|charity/i,
      );
      assert.equal(f.writes.length, 0);
      assert.deepEqual(await restarted.readRoom(f.code), corrupt);
    }
    assert.deepEqual(await f.rooms.readRoom(f.otherCode), f.otherBefore);
  } finally {
    f.sqlite.close();
  }
});

void test('Tleilaxu low phase-entry receipt survives a later physical population increase, SQL request races and restart without other free-income rewards', async () => {
  const f = await fixture(true);
  try {
    let g = f.initial;
    position(g, 0, 7, 3);
    position(g, 1, 5, 4);
    g = enterRevival(g);
    const receipt = {
      turn: g.turn,
      tleilaxu: { player: g.players[0].id, low: true },
    };
    assert.deepEqual(g.homeworldRevival, receipt);
    f.save(g);
    await assert.rejects(
      f.rooms.act(
        f.code,
        f.auths[0],
        g.version,
        { type: 'revive', amount: 2, elite: 0 },
        clock,
      ),
      /timing ruling/,
    );
    assert.equal(f.writes.length, 0);
    assert.deepEqual(await f.rooms.readRoom(f.code), g);
    await f.rooms.act(
      f.code,
      f.auths[0],
      g.version,
      { type: 'revive', amount: 1, elite: 0 },
      clock,
    );
    const high = await f.rooms.readRoom(f.code);
    assert.equal(high.players[0].reserves, 8);
    assert.equal(high.players[0].spice, g.players[0].spice + 1);
    assert.deepEqual(high.homeworldRevival, receipt);
    // Stage a later board-to-native physical return, keeping the actual low
    // phase-entry receipt, completed revival and SQL version. This conserved
    // position seam does not claim a threshold-crossing revival is permitted.
    position(high, 0, 9, high.players[0].tanks);
    f.save(high);
    const fresh = await restored(f, high);
    const view = await fresh.readSeatView(f.code, f.auths[1]);
    assert.equal(view.revival.tleilaxuHomeworldIncomeBlocked, true);
    assert.equal(
      view.homeworlds!.worlds!.find(
        (world) => world.native === high.players[0].id,
      )!.side,
      'high',
    );
    const action: engine.Action = { type: 'revive', amount: 2, elite: 0 };
    const { after, restarted, freshAuth } = await race(f, 1, [action, action]);
    assert.equal(after.players[1].reserves, 7);
    assert.equal(after.players[1].tanks, 2);
    assert.equal(after.players[1].freeForcesRevived, 2);
    assert.equal(after.players[0].spice, high.players[0].spice);
    assert.equal(after.revivalFreeIncome![after.players[1].id], g.turn);
    assert.deepEqual(after.homeworldRevival, receipt);
    await restored(f, after);
    await restarted.act(
      f.code,
      freshAuth,
      after.version,
      { type: 'revive', amount: 1, elite: 0 },
      clock,
    );
    const paid = await restarted.readRoom(f.code);
    assert.equal(
      paid.players[0].spice,
      high.players[0].spice + 2,
      'Paid revival income survives the low-at-opening restriction.',
    );
    assert.equal(paid.players[1].spice, after.players[1].spice - 2);
    assert.deepEqual(paid.homeworldRevival, receipt);
    for (const player of paid.players)
      assert.equal(
        player.reserves +
          player.tanks +
          Object.values(player.forces).reduce((a, b) => a + b, 0),
        20,
      );
    await restored(f, paid);
  } finally {
    f.sqlite.close();
  }
});

void test('missing, stale and malformed saved Tleilaxu phase-entry receipts never reconstruct from current high population', async () => {
  const f = await fixture(true);
  try {
    position(f.initial, 0, 7, 3);
    position(f.initial, 1, 5, 4);
    let g = enterRevival(f.initial);
    g = engine.applyAction(g, g.players[0].id, {
      type: 'revive',
      amount: 1,
      elite: 0,
    });
    assert.equal(g.players[0].reserves, 8);
    // Preserve the real low opening and non-crossing free revival, then stage
    // one physical board-to-native return before corrupting only its receipt.
    position(g, 0, 9, g.players[0].tanks);
    for (const change of ['missing', 'stale', 'wrong-owner'] as const) {
      const corrupt = structuredClone(g);
      if (change === 'missing') delete corrupt.homeworldRevival;
      else if (change === 'stale') corrupt.homeworldRevival!.turn--;
      else corrupt.homeworldRevival!.tleilaxu.player = corrupt.players[1].id;
      f.save(corrupt);
      const restarted = f.restart();
      await assert.rejects(
        restarted.readSeatView(f.code, f.auths[1]),
        /receipt|Homeworld/i,
      );
      await assert.rejects(
        restarted.act(
          f.code,
          f.auths[1],
          corrupt.version,
          { type: 'revive', amount: 1, elite: 0 },
          clock,
        ),
        /receipt|Homeworld/i,
      );
      assert.equal(f.writes.length, 0);
      assert.deepEqual(await restarted.readRoom(f.code), corrupt);
    }
    assert.deepEqual(await f.rooms.readRoom(f.otherCode), f.otherBefore);
  } finally {
    f.sqlite.close();
  }
});

void test('saved pending Homeworld revival cannot invent a free counter by consistently corrupting both frozen prices', async () => {
  const f = await fixture(true, true);
  try {
    let g = f.initial;
    position(g, 0, 9, 2);
    position(g, 1, 10, 4);
    g = enterRevival(g);
    const index = g.deck.findIndex((card) => card.effect === 'karama');
    assert.ok(index >= 0);
    g.players[0].hand.push(g.deck.splice(index, 1)[0]);
    g = engine.applyAction(g, g.players[1].id, {
      type: 'revive',
      amount: 3,
      elite: 0,
    });
    assert.equal(g.decision?.kind, 'revivalStop');
    assert.equal(g.decision.player, g.players[0].id);
    assert.equal(g.pendingRevival?.free, 2);
    assert.equal(g.pendingRevival.normalCost, 2);
    assert.equal(g.pendingRevival.cost, 2);
    const corrupt = structuredClone(g);
    corrupt.pendingRevival!.free = 3;
    corrupt.pendingRevival!.normalCost = 0;
    corrupt.pendingRevival!.cost = 0;
    f.save(corrupt);
    const restarted = f.restart();
    const auth = await restarted.authenticate(f.code, f.tokens[0]);
    // Existing public views are not expected to validate every frozen price;
    // the authoritative settlement must reject before returning any counter.
    await assert.rejects(
      restarted.act(
        f.code,
        auth,
        corrupt.version,
        { type: 'decision', decline: true },
        clock,
      ),
      /Homeworld revival free allocation/i,
    );
    assert.equal(f.writes.length, 0);
    assert.deepEqual(await restarted.readRoom(f.code), corrupt);
    assert.deepEqual(await restarted.readRoom(f.otherCode), f.otherBefore);
    f.save(g);
    await restarted.act(
      f.code,
      auth,
      g.version,
      { type: 'decision', decline: true },
      clock,
    );
    const paid = await restarted.readRoom(f.code);
    assert.equal(paid.pendingRevival, null);
    assert.equal(paid.players[1].reserves, 13);
    assert.equal(paid.players[1].tanks, 1);
    assert.equal(paid.players[1].spice, g.players[1].spice - 2);
    assert.equal(paid.players[1].freeForcesRevived, 2);
    assert.equal(f.writes.length, 1);
    await restored(f, paid);
  } finally {
    f.sqlite.close();
  }
});
