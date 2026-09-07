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
import {
  createRicheseNoField,
  deployRicheseNoField,
} from '../game/richese-no-field';
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

async function fixture(choam = false, marker = false) {
  const store = unitStore();
  const created = await store.rooms.createRoom('Mover', 'guild', false, []);
  const code = created.view.code;
  const joined = await store.rooms.joinRoom(code, 'Other', 'atreides');
  const third = await store.rooms.joinRoom(code, 'Observer', 'emperor');
  const owner = await store.rooms.authenticate(code, created.token),
    other = await store.rooms.authenticate(code, joined.token!),
    observer = await store.rooms.authenticate(code, third.token!);
  const old = await store.rooms.readRoom(code),
    initial = engine.createGame(
      code,
      engine.newPlayer(owner.playerId, 'Mover', 'richese'),
      false,
      ['choam'],
    );
  initial.players.push(
    engine.newPlayer(other.playerId, 'Other', choam ? 'choam' : 'atreides'),
    engine.newPlayer(observer.playerId, 'Observer', 'emperor'),
  );
  Object.assign(initial, {
    version: old.version,
    status: 'playing',
    phase: 5,
    turn: 2,
    active: owner.playerId,
    order: initial.players.map((p) => p.id),
    movementRemaining: initial.players.map((p) => p.id),
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
  const card = initial.richeseCache!.find((c) => c.effect === 'ornithopter')!;
  initial.richeseCache = initial.richeseCache!.filter((c) => c.id !== card.id);
  initial.players[0].hand.push(card);
  initial.players[0].forces = { 'imperial_basin:10': 3 };
  initial.players[0].reserves = 17;
  if (choam) {
    initial.players[1].forces = { 'hagga_basin:12': 1 };
    initial.players[1].reserves = 19;
  }
  if (marker) {
    initial.players[0].noField = createRicheseNoField([
      'private-zero',
      'private-three',
      'private-five',
    ]);
    initial.players[0].noField = deployRicheseNoField(
      initial.players[0].noField,
      {
        tokenId: 'private-three',
        controller: owner.playerId,
        location: { territory: 'carthag', sector: 11 },
      },
    );
    initial.players[0].noFieldEvent = 'original-marker-event';
  }
  const save = (g: engine.Game) =>
    store.sqlite
      .prepare('UPDATE rooms SET state=?,version=? WHERE code=?')
      .run(JSON.stringify(g), g.version, code);
  save(initial);
  store.writes.length = 0;
  const first: engine.Action = {
    type: 'move',
    movementCard: card.id,
    ornithopter: choam ? 'range3' : 'twoGroups',
    forces: { 'imperial_basin:10': 1 },
    territory: choam ? 'hagga_basin' : 'arrakeen',
    sector: choam ? 12 : 10,
  };
  return { ...store, code, owner, other, observer, initial, card, first, save };
}
function barrier() {
  let release!: () => void;
  const ready = new Promise<void>((resolve) => {
    release = resolve;
  });
  let arrivals = 0;
  return async () => {
    if (++arrivals === 2) release();
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

void test('concurrent first and second group requests each commit once across JSON restart and discard one played Ornithopter', async () => {
  const f = await fixture();
  try {
    f.hooks.beforeWrite = barrier();
    const starts = await Promise.allSettled([
      f.rooms.act(f.code, f.owner, f.initial.version, f.first, clock),
      f.restart().act(f.code, f.owner, f.initial.version, f.first, clock),
    ]);
    f.hooks.beforeWrite = undefined;
    committedOnce(starts, f.writes);
    const first = await f.restart().readRoom(f.code);
    assert.equal(first.version, f.initial.version + 1);
    assert.equal(first.players[0].moved, 1);
    assert.equal(first.players[0].hand.length, 0);
    assert.equal(first.discard.length, 0);
    assert.equal(first.ornithopter!.card.id, f.card.id);
    assert.deepEqual(first.ornithopter!.cohort!.forces, {
      'imperial_basin:10': 2,
    });
    await assert.rejects(
      f.restart().act(f.code, f.owner, first.version, f.first, clock),
    );
    assert.deepEqual(await f.rooms.readRoom(f.code), first);
    const writes = f.writes.length;
    await f.restart().continueRoomAutomatic(f.code, clock);
    assert.equal(f.writes.length, writes);
    assert.deepEqual(await f.rooms.readRoom(f.code), first);
    const action = {
      type: 'move',
      ornithopterEvent: first.ornithopter!.event,
      forces: { 'imperial_basin:10': 2 },
      territory: 'carthag',
      sector: 11,
    };
    f.writes.length = 0;
    f.hooks.beforeWrite = barrier();
    const seconds = await Promise.allSettled([
      f.restart().act(f.code, f.owner, first.version, action, clock),
      f.rooms.act(f.code, f.owner, first.version, action, clock),
    ]);
    f.hooks.beforeWrite = undefined;
    committedOnce(seconds, f.writes);
    const done = await f.restart().readRoom(f.code);
    assert.equal(done.version, first.version + 1);
    assert.equal(done.players[0].moved, 2);
    assert.deepEqual(done.players[0].forces, {
      'arrakeen:10': 1,
      'carthag:11': 2,
    });
    assert.equal(done.ornithopter, null);
    assert.deepEqual(done.discard, [f.card]);
    assert.deepEqual(
      done.players.map((p) => p.spice),
      [10, 10, 10],
    );
    await assert.rejects(
      f.rooms.act(f.code, f.owner, done.version, action, clock),
    );
    assert.deepEqual(await f.restart().readRoom(f.code), done);
  } finally {
    f.sqlite.close();
  }
});

void test('a persisted fixed-range declaration waits for the actual CHOAM owner and duplicated allowance commits its movement once', async () => {
  const f = await fixture(true);
  try {
    await f.rooms.act(f.code, f.owner, f.initial.version, f.first, clock);
    const pending = await f.restart().readRoom(f.code);
    assert.equal(pending.decision?.kind, 'choamMovement');
    assert.equal(pending.players[0].moved, 0);
    assert.equal(pending.ornithopter!.completed, 0);
    assert.equal(pending.pendingChoamMove!.ornithopterRange, true);
    const before = f.writes.length;
    await f.restart().continueRoomAutomatic(f.code, clock);
    assert.equal(f.writes.length, before);
    assert.deepEqual(await f.rooms.readRoom(f.code), pending);
    await assert.rejects(
      f.rooms.act(
        f.code,
        f.owner,
        pending.version,
        { type: 'decision', decline: true },
        clock,
      ),
    );
    f.writes.length = 0;
    f.hooks.beforeWrite = barrier();
    const replies = await Promise.allSettled([
      f
        .restart()
        .act(
          f.code,
          f.other,
          pending.version,
          { type: 'decision', decline: true },
          clock,
        ),
      f.rooms.act(
        f.code,
        f.other,
        pending.version,
        { type: 'decision', decline: true },
        clock,
      ),
    ]);
    f.hooks.beforeWrite = undefined;
    committedOnce(replies, f.writes);
    const done = await f.restart().readRoom(f.code);
    assert.equal(done.version, pending.version + 1);
    assert.equal(done.ornithopter, null);
    assert.equal(done.pendingChoamMove, null);
    assert.equal(done.players[0].moved, 1);
    assert.equal(done.players[0].forces['hagga_basin:12'], 1);
    assert.deepEqual(done.discard, [f.card]);
  } finally {
    f.sqlite.close();
  }
});

void test('unmoved concealed marker remains private after first group and its second movement uses both exact events in one CAS', async () => {
  const f = await fixture(false, true);
  try {
    await f.rooms.act(f.code, f.owner, f.initial.version, f.first, clock);
    const pending = await f.restart().readRoom(f.code);
    const own = await f.rooms.readSeatView(f.code, f.owner);
    assert.equal(
      own.ornithopter!.active!.cohort!.noField!.tokenId,
      'private-three',
    );
    for (const auth of [f.other, f.observer]) {
      const view = await f.restart().readSeatView(f.code, auth);
      assert.equal(view.ornithopter, null);
      for (const id of ['private-zero', 'private-three', 'private-five'])
        assert.equal(JSON.stringify(view).includes(id), false);
    }
    const action = {
      type: 'move',
      ornithopterEvent: pending.ornithopter!.event,
      noField: 'private-three',
      event: pending.players[0].noFieldEvent,
      forces: {},
      territory: 'imperial_basin',
      sector: 11,
    };
    for (const stale of [
      { ...action, event: 'stale-marker' },
      { ...action, ornithopterEvent: 'stale-flight' },
    ])
      await assert.rejects(
        f.rooms.act(f.code, f.owner, pending.version, stale, clock),
      );
    assert.deepEqual(await f.rooms.readRoom(f.code), pending);
    f.writes.length = 0;
    f.hooks.beforeWrite = barrier();
    const replies = await Promise.allSettled([
      f.rooms.act(f.code, f.owner, pending.version, action, clock),
      f.restart().act(f.code, f.owner, pending.version, action, clock),
    ]);
    f.hooks.beforeWrite = undefined;
    committedOnce(replies, f.writes);
    const done = await f.restart().readRoom(f.code);
    assert.equal(done.ornithopter, null);
    assert.equal(done.players[0].moved, 2);
    assert.deepEqual(done.players[0].noField!.deployed!.location, {
      territory: 'imperial_basin',
      sector: 11,
    });
    assert.notEqual(done.players[0].noFieldEvent, action.event);
    assert.equal(done.players[0].reserves, 17);
    assert.deepEqual(done.players[0].forces, pending.players[0].forces);
    assert.deepEqual(done.discard, [f.card]);
  } finally {
    f.sqlite.close();
  }
});

void test('a restored missing cohort is never reconstructed from merged forces by actions, normalization or no-op room recovery', async () => {
  const f = await fixture();
  try {
    await f.rooms.act(f.code, f.owner, f.initial.version, f.first, clock);
    const broken = await f.rooms.readRoom(f.code);
    delete broken.ornithopter!.cohort;
    f.save(broken);
    const writes = f.writes.length;
    const second = {
      type: 'move',
      ornithopterEvent: broken.ornithopter!.event,
      forces: { 'arrakeen:10': 1 },
      territory: 'imperial_basin',
      sector: 10,
    };
    await assert.rejects(
      f.restart().act(f.code, f.owner, broken.version, second, clock),
      /cohort/,
    );
    await assert.rejects(
      f
        .restart()
        .act(f.code, f.owner, broken.version, { type: 'endMovement' }, clock),
      /cohort/,
    );
    assert.throws(() => engine.normalizeAutomaticGame(broken), /cohort/);
    // No automatic response is queued here: the room worker must remain a no-op,
    // rather than inventing the lost original quota from present board counts.
    await f.restart().continueRoomAutomatic(f.code, clock);
    assert.deepEqual(await f.restart().readRoom(f.code), broken);
    assert.equal(f.writes.length, writes);
    assert.equal(broken.players[0].moved, 1);
    assert.equal(broken.discard.length, 0);
    assert.equal(broken.ornithopter!.card.id, f.card.id);
  } finally {
    f.sqlite.close();
  }
});
