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
  const made = await store.rooms.createRoom('Holder', 'guild', false, []),
    code = made.view.code;
  const joined = await store.rooms.joinRoom(code, 'Opponent', 'atreides'),
    third = await store.rooms.joinRoom(code, 'Observer', 'emperor');
  const owner = await store.rooms.authenticate(code, made.token),
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
    p.traitors = [];
    for (const l of p.leaders) l.strength = 0;
  }
  for (const p of initial.players.slice(0, 2)) {
    p.forces = { 'arrakeen:10': 5 };
    p.reserves = 15;
  }
  const card = initial.richeseCache!.find(
    (c) => c.effect === 'portableSnooper',
  )!;
  initial.richeseCache = initial.richeseCache!.filter((c) => c.id !== card.id);
  initial.players[0].hand.push(card);
  const weapon = initial.deck.splice(
    initial.deck.findIndex((c) => c.name === 'Chaumas'),
    1,
  )[0];
  initial.players[1].hand.push(weapon);
  initial = engine.applyAction(initial, owner.playerId, {
    type: 'chooseBattle',
    target: other.playerId,
    territory: 'arrakeen',
  });
  for (const id of [owner.playerId, other.playerId])
    initial = engine.applyAction(initial, id, {
      type: 'battlePreparationReady',
      event: initial.battle!.event,
    });
  initial = engine.applyAction(initial, owner.playerId, {
    type: 'battlePlan',
    dial: 3,
    leader: initial.players[0].leaders[0].id,
  });
  initial = engine.applyAction(initial, other.playerId, {
    type: 'battlePlan',
    dial: 1,
    leader: initial.players[1].leaders[0].id,
    weapon: weapon.id,
  });
  const save = (g: engine.Game) =>
    store.sqlite
      .prepare('UPDATE rooms SET state=?,version=? WHERE code=?')
      .run(JSON.stringify(g), g.version, code);
  save(initial);
  store.writes.length = 0;
  const action: engine.Action = {
      type: 'portableSnooper',
      card: card.id,
      event: initial.battle!.event,
    },
    call: engine.Action = { type: 'traitorCall', call: false };
  return {
    ...store,
    code,
    owner,
    other,
    observer,
    initial,
    card,
    action,
    call,
    save,
  };
}
function barrier() {
  let release!: () => void;
  const p = new Promise<void>((resolve) => {
    release = resolve;
  });
  let count = 0;
  return async () => {
    if (++count === 2) release();
    await p;
  };
}
function once(
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

void test('duplicate authenticated late plays reserve one physical card; restart and all private views preserve the original sealed plans', async () => {
  const f = await fixture();
  try {
    const before = await f.rooms.readSeatView(f.code, f.other);
    assert.equal(before.portableSnooper, null);
    assert.deepEqual(before.battle!.lateDefense, {});
    assert.ok(!before.battle!.cards.some((c) => c.id === f.card.id));
    assert.equal(
      (await f.rooms.readSeatView(f.code, f.owner)).portableSnooper!.blocked,
      null,
    );
    f.hooks.beforeWrite = barrier();
    const results = await Promise.allSettled([
      f.rooms.act(f.code, f.owner, f.initial.version, f.action, clock),
      f.restart().act(f.code, f.owner, f.initial.version, f.action, clock),
    ]);
    f.hooks.beforeWrite = undefined;
    once(results, f.writes);
    const current = await f.restart().readRoom(f.code);
    assert.equal(current.version, f.initial.version + 1);
    assert.deepEqual(current.battle!.plans, f.initial.battle!.plans);
    assert.deepEqual(current.battle!.lateDefense, {
      [f.owner.playerId]: f.card.id,
    });
    assert.equal(
      current.players[0].hand.filter((c) => c.id === f.card.id).length,
      1,
    );
    assert.equal(
      current.discard.some((c) => c.id === f.card.id),
      false,
    );
    const publicView = await f.restart().readSeatView(f.code, f.observer);
    assert.equal(publicView.battle!.lateDefense[f.owner.playerId], f.card.id);
    assert.ok(publicView.battle!.cards.some((c) => c.id === f.card.id));
    assert.equal(publicView.portableSnooper, null);
    await assert.rejects(
      f.restart().act(f.code, f.owner, current.version, f.action, clock),
      /already added/,
    );
    const writes = f.writes.length;
    await f.restart().continueRoomAutomatic(f.code, clock);
    assert.equal(f.writes.length, writes);
    assert.deepEqual(await f.rooms.readRoom(f.code), current);
  } finally {
    f.sqlite.close();
  }
});

void test('competing own late-play and traitor submission are CAS fenced and cannot retrofit protection after a committed pass', async () => {
  for (const protectedLeader of [true, false]) {
    const f = await fixture();
    try {
      let entered!: () => void, release!: () => void;
      const parked = new Promise<void>((resolve) => {
        entered = resolve;
      });
      const resume = new Promise<void>((resolve) => {
        release = resolve;
      });
      let count = 0;
      f.hooks.beforeWrite = async () => {
        if (++count === 1) {
          entered();
          await resume;
        }
      };
      // Park the losing request after full engine validation, then commit the other
      // action. Both opposite orderings are exercised deterministically.
      const losing = Promise.allSettled([
        f.rooms.act(
          f.code,
          f.owner,
          f.initial.version,
          protectedLeader ? f.call : f.action,
          clock,
        ),
      ]);
      await parked;
      const winner = await Promise.allSettled([
        f
          .restart()
          .act(
            f.code,
            f.owner,
            f.initial.version,
            protectedLeader ? f.action : f.call,
            clock,
          ),
      ]);
      release();
      const results = [...(await losing), ...winner];
      f.hooks.beforeWrite = undefined;
      once(results, f.writes);
      assert.equal(results[0].status, 'rejected');
      assert.equal(results[1].status, 'fulfilled');
      let current = await f.restart().readRoom(f.code);
      if (protectedLeader)
        await f.rooms.act(f.code, f.owner, current.version, f.call, clock);
      else
        await assert.rejects(
          f.rooms.act(f.code, f.owner, current.version, f.action, clock),
          /closed/,
        );
      current = await f.rooms.readRoom(f.code);
      assert.equal(
        !!current.battle!.lateDefense?.[f.owner.playerId],
        protectedLeader,
      );
      await f.restart().act(f.code, f.other, current.version, f.call, clock);
      current = await f.rooms.readRoom(f.code);
      assert.equal(current.battle, null);
      assert.equal(current.players[0].leaders[0].dead, !protectedLeader);
      if (protectedLeader) {
        assert.equal(current.decision?.kind, 'battleCards');
        await f.rooms.act(
          f.code,
          f.owner,
          current.version,
          { type: 'decision', discard: [f.card.id] },
          clock,
        );
        const done = await f.rooms.readRoom(f.code);
        assert.equal(done.discard.filter((c) => c.id === f.card.id).length, 1);
        assert.equal(
          done.players[0].hand.some((c) => c.id === f.card.id),
          false,
        );
      }
    } finally {
      f.sqlite.close();
    }
  }
});

void test('opponent pass does not steal the late opportunity and stale event, forged credential or corrupted reservation never commits', async () => {
  const f = await fixture();
  try {
    await f.rooms.act(f.code, f.other, f.initial.version, f.call, clock);
    let current = await f.rooms.readRoom(f.code);
    assert.ok(current.battle);
    await assert.rejects(
      f.rooms.act(
        f.code,
        f.owner,
        current.version,
        { ...f.action, event: 'old' },
        clock,
      ),
      /event/,
    );
    await assert.rejects(
      f.rooms.act(
        f.code,
        { ...f.owner, tokenHash: f.other.tokenHash },
        current.version,
        f.action,
        clock,
      ),
      /Another action/,
    );
    assert.deepEqual(await f.rooms.readRoom(f.code), current);
    await f.restart().act(f.code, f.owner, current.version, f.action, clock);
    current = await f.rooms.readRoom(f.code);
    const corrupt = structuredClone(current);
    corrupt.players[0].hand = [];
    f.save(corrupt);
    await assert.rejects(
      f.rooms.act(f.code, f.owner, corrupt.version, f.call, clock),
      /missing/,
    );
    const writes = f.writes.length;
    await f.restart().continueRoomAutomatic(f.code, clock);
    assert.equal(f.writes.length, writes);
    assert.deepEqual(await f.rooms.readRoom(f.code), corrupt);
    f.save(current);
    await f.restart().act(f.code, f.owner, current.version, f.call, clock);
    const settled = await f.rooms.readRoom(f.code);
    assert.equal(settled.players[0].leaders[0].dead, false);
  } finally {
    f.sqlite.close();
  }
});
