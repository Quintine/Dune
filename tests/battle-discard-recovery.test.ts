import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as engine from '../game/engine';
import * as bots from '../game/bots';
import { baseDeck } from '../game/cards';
import type * as Rooms from '../db/rooms';
import { createRequire } from 'node:module';

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
type Kind = 'mandatory' | 'winner' | 'moritani';
async function fixture(kind: Kind) {
  const store = unitStore();
  const created = await store.rooms.createRoom('Winner', 'guild', false, []);
  const code = created.view.code;
  const joined = await store.rooms.joinRoom(code, 'Loser', 'emperor');
  const observer = await store.rooms.joinRoom(code, 'Observer', 'atreides');
  const tokens = [created.token, joined.token!, observer.token!];
  const seats = await Promise.all(
    tokens.map((t) => store.restart().authenticate(code, t)),
  );
  async function act(index: number, action: engine.Action) {
    const current = await store.restart().readRoom(code);
    await store
      .restart()
      .act(code, seats[index], current.version, action, clock);
  }
  for (const index of [0, 1, 2]) await act(index, { type: 'ready' });
  await act(0, { type: 'start' });
  const setup = await store.restart().readRoom(code);
  for (const [index, p] of setup.players.entries())
    await act(index, { type: 'traitor', leader: p.traitorChoices[0] });
  let g = await store.restart().readRoom(code);
  assert.equal(g.status, 'playing');
  const [winner, loser, other] = seats.map((s) => s.playerId);
  // Internal Advanced fixture seam, preserving genuine room/seat credentials.
  // The battle and every discard below still use the authoritative action path.
  Object.assign(g, {
    advanced: true,
    turn: 2,
    phase: 6,
    storm: 18,
    order: [winner, loser, other],
    active: winner,
    response: null,
    decision: null,
    phaseOpening: null,
    deck: baseDeck(),
    discard: [],
    ready: [],
  });
  g.players[2] = engine.newPlayer(
    other,
    'Observer',
    kind === 'moritani' ? 'moritani' : 'choam',
  );
  for (const [index, p] of g.players.entries()) {
    p.hand = [];
    p.traitors = [];
    p.spice = 20;
    p.forces = index < 2 ? { 'arrakeen:10': 5 } : {};
    p.reserves = index < 2 ? 15 : 20;
    p.tanks = 0;
    for (const leader of p.leaders) leader.strength = 0;
  }
  g.players[1].leaders[0].strength = kind === 'moritani' ? 0 : 3;
  if (kind === 'moritani') {
    g.players[1].ally = other;
    g.players[2].ally = loser;
  }
  function hold(index: number, cardKind: (typeof g.deck)[number]['kind']) {
    const at = g.deck.findIndex((c) => c.kind === cardKind);
    assert.ok(at >= 0);
    const card = g.deck.splice(at, 1)[0];
    g.players[index].hand.push(card);
    return card.id;
  }
  const hero = hold(0, 'hero');
  const weapon = hold(kind === 'moritani' ? 1 : 0, 'projectile');
  const defense = hold(1, 'snooper');
  const physicalIds = inventory(g);
  g = engine.applyAction(g, winner, {
    type: 'chooseBattle',
    territory: 'arrakeen',
    target: loser,
  });
  for (let steps = 0; g.response || g.battle?.preparation; steps++) {
    assert.ok(steps < 40);
    if (g.response)
      g = engine.applyAction(
        g,
        g.players.find((p) => !g.response!.passed.includes(p.id))!.id,
        { type: 'passResponse' },
      );
    else
      g = engine.applyAction(g, g.battle!.preparation!.owner, {
        type: 'declineBattlePower',
      });
  }
  g = engine.applyAction(g, winner, {
    type: 'battlePlan',
    dial: 2,
    support: 2,
    leader: hero,
    weapon: kind === 'moritani' ? undefined : weapon,
  });
  g = engine.applyAction(g, loser, {
    type: 'battlePlan',
    dial: 0,
    support: 0,
    leader: g.players[1].leaders[0].id,
    defense,
    weapon: kind === 'moritani' ? weapon : undefined,
  });
  g = engine.applyAction(g, winner, { type: 'traitorCall', call: false });
  g = inner(g, loser, { type: 'traitorCall', call: false });
  assert.equal(g.pendingTreacheryDiscard?.continuation.kind, 'battleResolved');
  assert.equal(g.players[0].tanks, 0);
  if (kind !== 'mandatory') {
    g = engine.normalizeAutomaticGame(g);
    g = inner(
      g,
      kind === 'winner' ? winner : loser,
      kind === 'winner'
        ? { type: 'decision', discard: [weapon] }
        : { type: 'decision', keep: null },
    );
  }
  assert.equal(
    g.pendingTreacheryDiscard?.batch.cause,
    kind === 'mandatory' ? 'battle:mandatory' : `battle:${kind}`,
  );
  const continuation = g.pendingTreacheryDiscard!.continuation;
  assert.ok('event' in continuation);
  assert.equal(g.lastBattleContext?.event, continuation.event);
  const save = (state: engine.Game) =>
    store.sqlite
      .prepare('UPDATE rooms SET state=?,version=? WHERE code=?')
      .run(JSON.stringify(state), state.version, code);
  save(g);
  store.writes.length = 0;
  return {
    ...store,
    code,
    seats,
    tokens,
    initial: g,
    save,
    physicalIds,
    kind,
  };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
function inventory(g: engine.Game) {
  const ids = [...g.deck, ...g.discard, ...g.players.flatMap((p) => p.hand)]
    .map((c) => c.id)
    .sort();
  assert.equal(new Set(ids).size, ids.length);
  return ids;
}
async function checkRead(f: Fixture) {
  for (const [index, token] of f.tokens.entries()) {
    const auth = await f.restart().authenticate(f.code, token);
    const view = await f.restart().readSeatView(f.code, auth);
    assert.equal(view.automaticContinuationPending, true);
    assert.equal(f.restart().needsAutomaticRoomRecovery(view), true);
    assert.equal(view.battle, null);
    assert.equal(Object.hasOwn(view, 'pendingTreacheryDiscard'), false);
    assert.equal(Object.hasOwn(view, 'lastBattleContext'), false);
    for (const [seat, p] of view.players.entries())
      assert.deepEqual(
        p.hand,
        seat === index ? f.initial.players[seat].hand : undefined,
      );
  }
  assert.deepEqual(await f.restart().readRoom(f.code), f.initial);
  assert.equal(f.writes.length, 0);
}
async function raceRecovery(f: Fixture) {
  let release!: () => void,
    arrivals = 0;
  const barrier = new Promise<void>((resolve) => {
    release = resolve;
  });
  f.hooks.beforeWrite = async () => {
    if (++arrivals === 2) release();
    await barrier;
  };
  await Promise.all([
    f.restart().continueRoomAutomatic(f.code, clock),
    f.restart().continueRoomAutomatic(f.code, clock),
  ]);
  f.hooks.beforeWrite = undefined;
  const after = await f.restart().readRoom(f.code);
  assert.deepEqual(
    f.writes.map((w) => w.changes).sort((a, b) => a - b),
    [0, 1],
  );
  assert.equal(after.version, f.initial.version + 1);
  assert.equal(after.pendingTreacheryDiscard, null);
  assert.equal(
    after.resolvedTreacheryDiscardSequence,
    f.initial.treacheryDiscardSequence,
  );
  assert.deepEqual(inventory(after), f.physicalIds);
  await f.restart().continueRoomAutomatic(f.code, clock);
  assert.deepEqual(await f.restart().readRoom(f.code), after);
  assert.equal(f.writes.length, 2);
  return after;
}
void test('real mandatory battle frame survives private reconnect and two SQL workers apply delayed casualties once', async () => {
  const f = await fixture('mandatory');
  try {
    await checkRead(f);
    assert.deepEqual(
      f.initial.pendingTreacheryDiscard!.batch.entries.map(
        (e) => e.discardedBy,
      ),
      f.seats.slice(0, 2).map((s) => s.playerId),
    );
    assert.equal(f.initial.players[0].spice, 21); // support paid and three-spice bounty already earned
    assert.equal(f.initial.players[1].leaders[0].deaths, 1);
    await assert.rejects(
      f
        .restart()
        .act(
          f.code,
          f.seats[1],
          f.initial.version,
          { type: 'traitorCall', call: false },
          clock,
        ),
      /committed discard/,
    );
    assert.equal(f.writes.length, 0);
    const after = await raceRecovery(f);
    assert.equal(after.players[0].tanks, 2);
    assert.equal(after.players[1].tanks, 5);
    assert.equal(after.players[0].spice, 21);
    assert.equal(after.players[2].spice, 20); // income waits behind winner card choice
    assert.equal(after.players[1].leaders[0].deaths, 1);
    assert.equal(after.decision?.kind, 'battleCards');
    assert.equal(
      after.log.filter((l) => l.automatic?.name === 'Battle casualties').length,
      1,
    );
  } finally {
    f.sqlite.close();
  }
});
void test('winner discard frame restores the paid battle and credits CHOAM once under concurrent recovery', async () => {
  const f = await fixture('winner');
  try {
    await checkRead(f);
    assert.equal(f.initial.players[0].tanks, 2);
    assert.equal(f.initial.pendingChoamBattleIncome?.amount, 1);
    const after = await raceRecovery(f);
    assert.equal(after.players[2].spice, 21);
    assert.equal(after.pendingChoamBattleIncome, null);
    assert.equal(after.players[0].tanks, 2);
    assert.equal(after.players[1].leaders[0].deaths, 1);
    assert.equal(
      after.log.filter((l) =>
        l.text.includes('received 1 spice from battle force payments'),
      ).length,
      1,
    );
    assert.equal(
      after.log.filter((l) =>
        l.text.includes('discarded 1 of their played battle cards'),
      ).length,
      1,
    );
    await assert.rejects(
      f
        .restart()
        .act(
          f.code,
          f.seats[0],
          f.initial.version,
          { type: 'decision', discard: [] },
          clock,
        ),
      /table changed/,
    );
    assert.deepEqual(await f.restart().readRoom(f.code), after);
  } finally {
    f.sqlite.close();
  }
});
void test('consumed Moritani card choice restores without reoffering retention or repeating casualties', async () => {
  const f = await fixture('moritani');
  try {
    await checkRead(f);
    assert.equal(f.initial.moritaniRetention, null);
    assert.equal(f.initial.pendingTreacheryDiscard!.batch.entries.length, 2);
    assert.ok(
      f.initial.pendingTreacheryDiscard!.batch.entries.every(
        (e) => e.discardedBy === f.seats[1].playerId,
      ),
    );
    const after = await raceRecovery(f);
    assert.equal(after.moritaniRetention, null);
    assert.equal(after.decision, null);
    assert.equal(after.phase, 7);
    assert.equal(after.players[0].tanks, 2);
    assert.equal(after.players[1].tanks, 5);
    assert.equal(
      after.log.filter((l) =>
        l.text.includes(
          'retained no battle card through the Moritani alliance',
        ),
      ).length,
      1,
    );
    await assert.rejects(
      f
        .restart()
        .act(
          f.code,
          f.seats[1],
          after.version,
          { type: 'decision', keep: null },
          clock,
        ),
    );
    assert.deepEqual(await f.restart().readRoom(f.code), after);
  } finally {
    f.sqlite.close();
  }
});
void test('forged battle event, casualty allocation and consumed source parent fail before any SQL write', async () => {
  for (const kind of ['mandatory', 'winner', 'moritani'] as const) {
    const f = await fixture(kind);
    try {
      const mutations: ((g: engine.Game) => void)[] = [
        (g) => {
          g.pendingTreacheryDiscard!.batch.event = 'stale-discard';
        },
        (g) => {
          g.lastBattleContext!.event = 'other-battle';
        },
        (g) => {
          const c = g.pendingTreacheryDiscard!.continuation;
          if (c.kind === 'battleResolved') c.casualties!.options[0].normal = 0;
          else if (c.kind === 'battleCleanup' && c.source === 'moritani')
            delete c.retention;
          else if (c.kind === 'battleCleanup') c.source = 'moritani';
        },
      ];
      for (const mutate of mutations) {
        const malformed = structuredClone(f.initial);
        mutate(malformed);
        f.save(malformed);
        await assert.rejects(f.restart().readSeatView(f.code, f.seats[0]));
        await assert.rejects(f.restart().continueRoomAutomatic(f.code, clock));
        await assert.rejects(
          f
            .restart()
            .act(
              f.code,
              f.seats[0],
              malformed.version,
              { type: 'ready' },
              clock,
            ),
        );
        assert.deepEqual(await f.restart().readRoom(f.code), malformed);
        assert.equal(f.writes.length, 0);
      }
    } finally {
      f.sqlite.close();
    }
  }
});
void test('reinserting a retired battle frame cannot repeat its continuation at the current room version', async () => {
  const f = await fixture('winner');
  try {
    const done = await raceRecovery(f);
    const replay = structuredClone(done);
    replay.pendingTreacheryDiscard = structuredClone(
      f.initial.pendingTreacheryDiscard,
    );
    f.save(replay);
    const writes = f.writes.length;
    await assert.rejects(
      f.restart().continueRoomAutomatic(f.code, clock),
      /sequence/,
    );
    await assert.rejects(
      f
        .restart()
        .act(
          f.code,
          f.seats[0],
          replay.version,
          { type: 'setAutopilot', difficulty: 'Easy' },
          clock,
        ),
      /sequence/,
    );
    assert.deepEqual(await f.restart().readRoom(f.code), replay);
    assert.equal(f.writes.length, writes);
  } finally {
    f.sqlite.close();
  }
});
