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
import { createDukeVidal, DUKE_VIDAL_ID } from '../game/duke-vidal';
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
  const made = await store.rooms.createRoom('Reviver', 'emperor', false, []);
  const code = made.view.code;
  const joined = [
    await store.rooms.joinRoom(code, 'Opponent', 'guild'),
    await store.rooms.joinRoom(code, 'Third combatant', 'fremen'),
  ];
  const tokens = [made.token, ...joined.map((s) => s.token!)];
  const seats = await Promise.all(
    tokens.map((token) => store.restart().authenticate(code, token)),
  );
  const initial = await store.restart().readRoom(code);
  Object.assign(initial, {
    status: 'playing',
    phase: 6,
    turn: 2,
    advanced: false,
    expansions: [],
    storm: 18,
    order: seats.map((s) => s.playerId),
    active: seats[0].playerId,
    deck: baseDeck(),
    discard: [],
  });
  for (const [index, p] of initial.players.entries()) {
    Object.assign(p, {
      hand: [],
      forces:
        index < 2
          ? { 'arrakeen:10': 3, 'carthag:11': 3 }
          : { 'arrakeen:10': 3 },
      reserves: index < 2 ? 14 : 17,
      tanks: 0,
      spice: 20,
      traitors: [],
      traitorChoices: [],
    });
  }
  const hold = (index: number, kind: string) => {
    const at = initial.deck.findIndex(
      (c) => c.kind === kind || c.effect === kind,
    );
    assert.ok(at >= 0);
    const c = initial.deck.splice(at, 1)[0];
    initial.players[index].hand.push(c);
    return c;
  };
  const ghola = hold(0, 'ghola'),
    poison = hold(2, 'poison');
  hold(0, 'shield');
  hold(1, 'snooper');
  hold(2, 'worthless');
  const leader = [...initial.players[0].leaders].sort(
    (a, b) => b.strength - a.strength,
  )[0];
  // The conserved three-faction starting board is staged. Prior leader use,
  // death, Ghola, and the later territory's battle all use genuine actions.
  const save = (g: engine.Game) =>
    store.sqlite
      .prepare('UPDATE rooms SET state=?,version=? WHERE code=?')
      .run(JSON.stringify(g), g.version, code);
  save(initial);
  async function act(index: number, action: engine.Action) {
    const rooms = store.restart();
    const auth = await rooms.authenticate(code, tokens[index]);
    const before = await rooms.readRoom(code);
    await rooms.act(code, auth, before.version, action, clock);
    return store.restart().readRoom(code);
  }
  async function prepare(territory: string, target = 1) {
    let g = await act(0, {
      type: 'chooseBattle',
      territory,
      target: seats[target].playerId,
    });
    for (let i = 0; i < 30 && (g.response || g.battle?.preparation); i++) {
      if (g.response) {
        const index = seats.findIndex(
          (s) => !g.response!.passed.includes(s.playerId),
        );
        g = await act(index, { type: 'passResponse' });
      } else {
        const index = seats.findIndex(
          (s) => s.playerId === g.battle!.preparation!.owner,
        );
        g = await act(index, { type: 'declineBattlePower' });
      }
    }
    assert.equal(g.response, null);
    assert.equal(g.battle?.preparation ?? null, null);
    return g;
  }
  await prepare('arrakeen');
  await act(0, { type: 'battlePlan', dial: 0, leader: leader.id });
  await act(1, {
    type: 'battlePlan',
    dial: 0,
    leader: [...initial.players[1].leaders].sort(
      (a, b) => a.strength - b.strength,
    )[0].id,
  });
  await act(0, { type: 'traitorCall', call: false });
  const first = await act(1, { type: 'traitorCall', call: false });
  const used = first.players[0].leaders.find((l) => l.id === leader.id)!;
  assert.equal(used.dead, false);
  assert.equal(used.usedAt, 'arrakeen');
  assert.equal(first.players[1].forces['arrakeen:10'] ?? 0, 0);
  assert.equal(first.phase, 6);
  await prepare('arrakeen', 2);
  await act(0, { type: 'battlePlan', dial: 0, leader: leader.id });
  await act(2, {
    type: 'battlePlan',
    dial: 0,
    leader: initial.players[2].leaders[0].id,
    weapon: poison.id,
  });
  await act(0, { type: 'traitorCall', call: false });
  let dead = await act(2, { type: 'traitorCall', call: false });
  for (let i = 0; dead.decision && i < 10; i++) {
    const d = dead.decision;
    assert.equal(d.kind, 'battleCards');
    dead = await act(
      seats.findIndex((s) => s.playerId === d.player),
      { type: 'decision', discard: [] },
    );
  }
  assert.equal(dead.phase, 6);
  assert.equal(dead.battle, null);
  assert.equal(dead.decision, null);
  const killed = dead.players[0].leaders.find((l) => l.id === leader.id)!;
  assert.equal(killed.dead, true);
  assert.equal(killed.deaths, leader.deaths + 1);
  assert.equal(
    killed.usedAt,
    undefined,
    'ordinary battle death already clears the earlier territory',
  );
  assert.equal(dead.players[0].forces['arrakeen:10'] ?? 0, 0);
  assert.equal(dead.players[0].tanks, 3);
  store.writes.length = 0;
  return {
    ...store,
    code,
    tokens,
    seats,
    initial,
    dead,
    leader: leader.id,
    ghola,
    poison,
    save,
    act,
    prepare,
  };
}
function barrier() {
  let release!: () => void;
  const ready = new Promise<void>((r) => {
    release = r;
  });
  let count = 0;
  return async () => {
    if (++count === 2) release();
    await ready;
  };
}
function resources(g: engine.Game) {
  return g.players.map((p) => ({
    id: p.id,
    spice: p.spice,
    forces: p.forces,
    reserves: p.reserves,
    tanks: p.tanks,
    revived: p.revived,
    leaderRevived: p.leaderRevived,
    revivalCycle: p.revivalCycle,
    freeForcesRevived: p.freeForcesRevived,
    elites: p.elites,
  }));
}
function inventory(g: engine.Game) {
  const cards = [...g.deck, ...g.discard, ...g.players.flatMap((p) => p.hand)];
  assert.equal(cards.length, baseDeck().length);
  assert.equal(new Set(cards.map((c) => c.id)).size, cards.length);
  for (const p of g.players)
    assert.equal(
      p.reserves + p.tanks + Object.values(p.forces).reduce((a, b) => a + b, 0),
      20,
    );
}
async function privacy(f: Awaited<ReturnType<typeof fixture>>, g: engine.Game) {
  for (const [i, token] of f.tokens.entries()) {
    const rooms = f.restart(),
      auth = await rooms.authenticate(f.code, token);
    const view = await rooms.readSeatView(f.code, auth);
    assert.deepEqual(view.players[i].hand, g.players[i].hand);
    for (let j = 0; j < f.seats.length; j++)
      if (i !== j) {
        assert.equal(view.players[j].hand, undefined);
        assert.equal(view.players[j].traitors, undefined);
      }
    assert.equal('pendingTreacheryDiscard' in view, false);
  }
}

void test('actual prior use and battle death then concurrent Ghola revives once for the next territory', async () => {
  const f = await fixture();
  try {
    await privacy(f, f.dead);
    const rooms = f.restart(),
      auth = await rooms.authenticate(f.code, f.tokens[0]);
    const view = await rooms.readSeatView(f.code, auth);
    assert.ok(view.ghola.leaders.some((l) => l.id === f.leader));
    assert.equal(view.ghola.available, true);
    const play: engine.Action = {
      type: 'card',
      card: f.ghola.id,
      leader: f.leader,
    };
    f.hooks.beforeWrite = barrier();
    const attempts = await Promise.allSettled([
      rooms.act(f.code, auth, f.dead.version, play, clock),
      f.restart().act(f.code, f.seats[0], f.dead.version, play, clock),
    ]);
    f.hooks.beforeWrite = undefined;
    assert.equal(attempts.filter((r) => r.status === 'fulfilled').length, 1);
    assert.deepEqual(
      f.writes.map((w) => w.changes).sort((a, b) => a - b),
      [0, 1],
    );
    const alive = await f.restart().readRoom(f.code);
    assert.equal(alive.version, f.dead.version + 1);
    const before = f.dead.players[0].leaders.find((l) => l.id === f.leader)!;
    const expected = { ...before, dead: false };
    delete expected.usedAt;
    assert.deepEqual(
      alive.players[0].leaders.find((l) => l.id === f.leader),
      expected,
    );
    assert.deepEqual(resources(alive), resources(f.dead));
    assert.deepEqual(alive.players[1], f.dead.players[1]);
    assert.deepEqual(alive.players[2], f.dead.players[2]);
    assert.deepEqual(
      alive.players[0].hand,
      f.dead.players[0].hand.filter((c) => c.id !== f.ghola.id),
    );
    assert.equal(alive.discard.filter((c) => c.id === f.ghola.id).length, 1);
    assert.equal(alive.pendingTreacheryDiscard ?? null, null);
    assert.equal(
      alive.treacheryDiscardSequence,
      (f.dead.treacheryDiscardSequence ?? 0) + 1,
    );
    assert.equal(
      alive.resolvedTreacheryDiscardSequence,
      alive.treacheryDiscardSequence,
    );
    const logs = alive.log.slice(f.dead.log.length);
    assert.equal(
      logs.filter((l) => l.text.includes('revived') && l.text.includes('Ghola'))
        .length,
      1,
    );
    assert.equal(
      logs.filter((l) => l.automatic?.name === 'Ghola revival').length,
      1,
    );
    const writes = f.writes.length;
    await assert.rejects(
      f.restart().act(f.code, auth, f.dead.version, play, clock),
    );
    await assert.rejects(
      f.restart().act(f.code, auth, alive.version, play, clock),
    );
    assert.equal(f.writes.length, writes);
    assert.deepEqual(await f.restart().readRoom(f.code), alive);
    await privacy(f, alive);
    inventory(alive);
    await f.prepare('carthag');
    const planned = await f.act(0, {
      type: 'battlePlan',
      dial: 0,
      leader: f.leader,
    });
    assert.equal(planned.battle!.plans[f.seats[0].playerId]!.leader, f.leader);
    const otherView = await f.restart().readSeatView(f.code, f.seats[1]);
    assert.equal(
      otherView.battle?.plans[f.seats[0].playerId]?.leader,
      undefined,
    );
    assert.equal(
      planned.players[0].leaders.find((l) => l.id === f.leader)!.deaths,
      before.deaths,
    );
    assert.equal(
      planned.players[0].leaderRevived,
      f.dead.players[0].leaderRevived,
    );
    assert.deepEqual(resources(planned), resources(alive));
    inventory(planned);
  } finally {
    f.sqlite.close();
  }
});

void test('a synthetic dead foreign-controlled Duke cannot consume a non-Ecaz Ghola through the room API', async () => {
  const f = await fixture();
  try {
    // Explicit exceptional copied-save state: it is not produced by the ordinary
    // leader death above and must not grant another faction Duke revival rights.
    const bad = structuredClone(f.dead);
    bad.dukeVidal = createDukeVidal();
    bad.dukeVidal.controller = f.seats[0].playerId;
    bad.dukeVidal.source = 'ally';
    bad.dukeVidal.acquiredTurn = bad.turn;
    bad.dukeVidal.leader.dead = true;
    bad.dukeVidal.leader.deaths = 1;
    f.save(bad);
    const rooms = f.restart(),
      auth = await rooms.authenticate(f.code, f.tokens[0]);
    const view = await rooms.readSeatView(f.code, auth);
    assert.ok(!view.ghola.leaders.some((l) => l.id === DUKE_VIDAL_ID));
    await assert.rejects(
      rooms.act(
        f.code,
        auth,
        bad.version,
        { type: 'card', card: f.ghola.id, leader: DUKE_VIDAL_ID },
        clock,
      ),
      /Only Ecaz/,
    );
    assert.equal(f.writes.length, 0);
    assert.deepEqual(await f.restart().readRoom(f.code), bad);
    assert.ok(bad.players[0].hand.some((c) => c.id === f.ghola.id));
    inventory(bad);
  } finally {
    f.sqlite.close();
  }
});
