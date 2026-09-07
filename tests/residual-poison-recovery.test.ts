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
import { richeseCards } from '../game/richese-cards';
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
  const created = await store.rooms.createRoom('Holder', 'guild', false, []),
    code = created.view.code;
  const joined = await store.rooms.joinRoom(code, 'Opponent', 'atreides');
  const third = await store.rooms.joinRoom(code, 'Observer', 'emperor');
  const owner = await store.rooms.authenticate(code, created.token),
    other = await store.rooms.authenticate(code, joined.token!),
    observer = await store.rooms.authenticate(code, third.token!);
  const old = await store.rooms.readRoom(code);
  let initial = engine.createGame(
    code,
    engine.newPlayer(owner.playerId, 'Holder', 'richese'),
    false,
    ['choam'],
  );
  initial.players.push(
    engine.newPlayer(other.playerId, 'Opponent', 'guild'),
    engine.newPlayer(observer.playerId, 'Observer', 'emperor'),
  );
  Object.assign(initial, {
    version: old.version,
    status: 'playing',
    phase: 6,
    turn: 2,
    active: owner.playerId,
    order: initial.players.map((p) => p.id),
    storm: 18,
    deck: baseDeck(),
    richeseCache: richeseCards(),
  });
  for (const p of initial.players) {
    p.hand = [];
    p.spice = 10;
    p.forces = {};
    p.reserves = 20;
  }
  for (const p of initial.players.slice(0, 2)) {
    p.forces = { 'arrakeen:10': 2 };
    p.reserves = 18;
  }
  const card = initial.richeseCache!.find(
    (c) => c.effect === 'residualPoison',
  )!;
  initial.richeseCache = initial.richeseCache!.filter((c) => c.id !== card.id);
  initial.players[0].hand.push(card);
  initial = engine.applyAction(initial, owner.playerId, {
    type: 'chooseBattle',
    target: other.playerId,
    territory: 'arrakeen',
  });
  const save = (g: engine.Game) =>
    store.sqlite
      .prepare('UPDATE rooms SET state=?,version=? WHERE code=?')
      .run(JSON.stringify(g), g.version, code);
  save(initial);
  store.writes.length = 0;
  const action: engine.Action = {
    type: 'card',
    card: card.id,
    target: other.playerId,
    event: initial.battle!.event,
  };
  const ready: engine.Action = {
    type: 'battlePreparationReady',
    event: initial.battle!.event,
  };
  return {
    ...store,
    code,
    owner,
    other,
    observer,
    initial,
    action,
    ready,
    save,
  };
}

function barrier() {
  let release!: () => void;
  const ready = new Promise<void>((resolve) => {
    release = resolve;
  });
  let arrived = 0;
  return async () => {
    if (++arrived === 2) release();
    await ready;
  };
}
function committedOnce(
  results: PromiseSettledResult<unknown>[],
  writes: { changes: number }[],
) {
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(results.filter((r) => r.status === 'rejected').length, 1);
  assert.deepEqual(
    writes.map((w) => w.changes).sort((a, b) => a - b),
    [0, 1],
  );
}

void test('concurrent authenticated Residual plays persist exactly one death and discard across private refresh and module restart', async () => {
  const f = await fixture();
  try {
    const ownerView = await f.rooms.readSeatView(f.code, f.owner),
      otherView = await f.rooms.readSeatView(f.code, f.other);
    assert.equal(ownerView.residualPoison!.blocked, null);
    assert.equal(otherView.residualPoison, null);
    assert.equal(
      (await f.rooms.readSeatView(f.code, f.observer)).residualPoison,
      null,
    );
    f.hooks.beforeWrite = barrier();
    const results = await Promise.allSettled([
      f.rooms.act(f.code, f.owner, f.initial.version, f.action, clock),
      f.restart().act(f.code, f.owner, f.initial.version, f.action, clock),
    ]);
    f.hooks.beforeWrite = undefined;
    committedOnce(results, f.writes);
    const done = await f.restart().readRoom(f.code);
    assert.equal(done.version, f.initial.version + 1);
    assert.equal(done.players[1].leaders.filter((l) => l.dead).length, 1);
    assert.equal(done.discard.filter((c) => c.id === f.action.card).length, 1);
    assert.equal(done.players[0].hand.length, 0);
    assert.deepEqual(
      done.players.map((p) => p.spice),
      [10, 10, 10],
    );
    assert.deepEqual(done.battle!.preLeader!.ready, []);
    await assert.rejects(
      f.restart().act(f.code, f.owner, done.version, f.action, clock),
    );
    await assert.rejects(
      f.rooms.act(f.code, f.owner, f.initial.version, f.action, clock),
    );
    const writes = f.writes.length;
    await f.restart().continueRoomAutomatic(f.code, clock);
    assert.equal(f.writes.length, writes);
    assert.deepEqual(await f.rooms.readRoom(f.code), done);
    assert.equal(
      (await f.restart().readSeatView(f.code, f.owner)).residualPoison,
      null,
    );
  } finally {
    f.sqlite.close();
  }
});

void test('racing opponent readiness and card play preserve both effects after one stale retry without opening leader selection early', async () => {
  const f = await fixture();
  try {
    f.hooks.beforeWrite = barrier();
    const results = await Promise.allSettled([
      f.rooms.act(f.code, f.owner, f.initial.version, f.action, clock),
      f.restart().act(f.code, f.other, f.initial.version, f.ready, clock),
    ]);
    f.hooks.beforeWrite = undefined;
    committedOnce(results, f.writes);
    let current = await f.restart().readRoom(f.code);
    if (results[0].status === 'rejected')
      await f.rooms.act(f.code, f.owner, current.version, f.action, clock);
    else await f.rooms.act(f.code, f.other, current.version, f.ready, clock);
    current = await f.restart().readRoom(f.code);
    assert.equal(current.version, f.initial.version + 2);
    assert.equal(current.players[1].leaders.filter((l) => l.dead).length, 1);
    assert.deepEqual(current.battle!.preLeader!.ready, [f.other.playerId]);
    assert.equal(current.battle!.preLeader!.closed, false);
    const leader = current.players[1].leaders.find((l) => !l.dead)!.id;
    await assert.rejects(
      f.rooms.act(
        f.code,
        f.other,
        current.version,
        { type: 'battlePlan', leader, dial: 1 },
        clock,
      ),
      /Both combatants/,
    );
    await f.rooms.act(f.code, f.owner, current.version, f.ready, clock);
    current = await f.rooms.readRoom(f.code);
    assert.equal(current.battle!.preLeader!.closed, true);
    const viewed = await f
      .restart()
      .act(
        f.code,
        f.other,
        current.version,
        { type: 'battlePlan', leader, dial: 1 },
        clock,
      );
    assert.equal(viewed.version, current.version + 1);
    const observer = await f.rooms.readSeatView(f.code, f.observer);
    assert.equal(observer.battle!.plans[f.other.playerId]?.leader, undefined);
    assert.equal(
      (await f.rooms.readRoom(f.code)).battle!.plans[f.other.playerId].leader,
      leader,
    );
  } finally {
    f.sqlite.close();
  }
});

void test('two simultaneous ready declarations require refreshed retry; stale events and unauthorized identities never write', async () => {
  const f = await fixture();
  try {
    f.hooks.beforeWrite = barrier();
    const results = await Promise.allSettled([
      f.rooms.act(f.code, f.owner, f.initial.version, f.ready, clock),
      f.restart().act(f.code, f.other, f.initial.version, f.ready, clock),
    ]);
    f.hooks.beforeWrite = undefined;
    committedOnce(results, f.writes);
    let current = await f.restart().readRoom(f.code);
    assert.equal(current.battle!.preLeader!.ready.length, 1);
    assert.equal(current.battle!.preLeader!.closed, false);
    const missing = results[0].status === 'rejected' ? f.owner : f.other;
    await f.restart().act(f.code, missing, current.version, f.ready, clock);
    current = await f.rooms.readRoom(f.code);
    assert.equal(current.battle!.preLeader!.closed, true);
    await assert.rejects(
      f.rooms.act(f.code, f.owner, current.version, f.ready, clock),
    );
    await assert.rejects(
      f.rooms.act(
        f.code,
        f.owner,
        current.version,
        { ...f.action, event: 'old' },
        clock,
      ),
      /stale/,
    );
    await assert.rejects(
      f.rooms.act(f.code, f.observer, current.version, f.action, clock),
    );
    const spoof = { ...f.owner, tokenHash: f.other.tokenHash };
    await assert.rejects(
      f.rooms.act(f.code, spoof, current.version, f.action, clock),
      /Another action/,
    );
    assert.deepEqual(await f.restart().readRoom(f.code), current);
    assert.equal(current.players[1].leaders.filter((l) => l.dead).length, 0);
    assert.equal(current.players[0].hand.length, 1);
  } finally {
    f.sqlite.close();
  }
});
