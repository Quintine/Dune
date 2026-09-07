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
import { TERRITORIES, gameDistance, location } from '../game/board';
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
  const created = await store.rooms.createRoom(
    'Fremen mover',
    'fremen',
    false,
    [],
  );
  const code = created.view.code;
  const joined = await store.rooms.joinRoom(code, 'Canceler', 'emperor');
  const third = await store.rooms.joinRoom(code, 'Observer', 'harkonnen');
  const owner = await store.rooms.authenticate(code, created.token);
  const other = await store.rooms.authenticate(code, joined.token!);
  const observer = await store.rooms.authenticate(code, third.token!);
  const initial = await store.rooms.readRoom(code);
  Object.assign(initial, {
    status: 'playing',
    phase: 5,
    turn: 2,
    active: owner.playerId,
    order: initial.players.map((p) => p.id),
    movementRemaining: initial.players.map((p) => p.id),
    storm: 18,
  });
  const cards = baseDeck();
  const karama = cards.find((c) => c.effect === 'karama')!;
  const privateCards = [
    cards.find((c) => c.kind === 'poison')!,
    cards.find((c) => c.kind === 'projectile')!,
    cards.find((c) => c.kind === 'shield')!,
  ];
  for (const [i, p] of initial.players.entries()) {
    Object.assign(p, {
      hand: [privateCards[i]],
      spice: 10,
      forces: {},
      reserves: 20,
    });
  }
  initial.players[1].hand.push(karama);
  const held = new Set(initial.players.flatMap((p) => p.hand.map((c) => c.id)));
  initial.deck = cards.filter((c) => !held.has(c.id));
  const from = 'red_chasm:7';
  initial.players[0].forces = { [from]: 4 };
  initial.players[0].reserves = 16;
  const targets = TERRITORIES.filter((t) => t.type === 'sand').flatMap((t) =>
    t.sectors
      .filter((s) => s !== 18)
      .map((s) => ({ territory: t.id, sector: s })),
  );
  const to = targets.find(
    (t) =>
      gameDistance(initial, from, location(t.territory, t.sector), (k) =>
        k.endsWith(':18'),
      ) === 2,
  )!;
  const near = targets.find(
    (t) =>
      gameDistance(initial, from, location(t.territory, t.sector), (k) =>
        k.endsWith(':18'),
      ) === 1,
  )!;
  assert.ok(
    to && near,
    'The fixture requires printed legal two- and one-territory routes.',
  );
  const first: engine.Action = { type: 'move', forces: { [from]: 3 }, ...to };
  const replacement: engine.Action = {
    type: 'move',
    forces: { [from]: 3 },
    ...near,
  };
  store.sqlite
    .prepare('UPDATE rooms SET state=?,version=? WHERE code=?')
    .run(JSON.stringify(initial), initial.version, code);
  store.writes.length = 0;
  return {
    ...store,
    code,
    owner,
    other,
    observer,
    initial,
    first,
    replacement,
    to,
    near,
    from,
    karama,
    privateCards,
  };
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

void test('Fremen movement declaration survives production room-module restart with exact forces and private hands, then allowance commits once', async () => {
  const f = await fixture();
  try {
    await f.rooms.act(f.code, f.owner, f.initial.version, f.first, clock);
    const pending = await f.restart().readRoom(f.code);
    assert.equal(pending.response?.kind, 'fremenMovement');
    assert.equal(pending.pendingFremenMove?.order.player, f.owner.playerId);
    assert.equal(pending.pendingFremenMove?.turn, 2);
    assert.equal(pending.pendingFremenMove?.move, 0);
    assert.deepEqual(pending.players[0].forces, f.initial.players[0].forces);
    assert.equal(pending.players[0].moved, 0);
    assert.deepEqual(
      pending.players.map((p) => p.spice),
      [10, 10, 10],
    );
    const writes = f.writes.length;
    await f.restart().continueRoomAutomatic(f.code, clock);
    assert.equal(
      f.writes.length,
      writes,
      'A legitimate private cancellation choice must remain waiting without writes.',
    );
    assert.deepEqual(await f.restart().readRoom(f.code), pending);
    const seats = [f.owner, f.other, f.observer];
    for (const [i, auth] of seats.entries()) {
      const view = await f.restart().readSeatView(f.code, auth);
      assert.equal(view.response?.kind, 'fremenMovement');
      assert.deepEqual(
        view.players.find((p) => p.id === auth.playerId)!.hand,
        pending.players[i].hand,
      );
      for (const [j, card] of f.privateCards.entries()) {
        if (i !== j)
          assert.equal(
            JSON.stringify(view).includes(card.id),
            false,
            'Foreign unplayed card identities must stay hidden.',
          );
      }
      assert.equal(JSON.stringify(view).includes(f.karama.id), i === 1);
    }
    await f
      .restart()
      .act(f.code, f.other, pending.version, { type: 'passResponse' }, clock);
    const done = await f.restart().readRoom(f.code);
    assert.equal(done.version, pending.version + 1);
    assert.equal(done.pendingFremenMove, null);
    assert.equal(done.response, null);
    assert.equal(done.players[0].moved, 1);
    assert.deepEqual(done.players[0].forces, {
      [f.from]: 1,
      [location(f.to.territory, f.to.sector)]: 3,
    });
    assert.ok(done.players[1].hand.some((c) => c.id === f.karama.id));
    assert.equal(done.discard.length, 0);
    await assert.rejects(
      f.rooms.act(
        f.code,
        f.other,
        pending.version,
        { type: 'passResponse' },
        clock,
      ),
    );
    assert.deepEqual(await f.restart().readRoom(f.code), done);
  } finally {
    f.sqlite.close();
  }
});

void test('concurrent Fremen movement allowance and Karama cancellation publish exactly one authoritative outcome', async () => {
  const f = await fixture();
  try {
    await f.rooms.act(f.code, f.owner, f.initial.version, f.first, clock);
    const pending = await f.restart().readRoom(f.code);
    f.writes.length = 0;
    f.hooks.beforeWrite = barrier();
    const replies = await Promise.allSettled([
      f.rooms.act(
        f.code,
        f.other,
        pending.version,
        { type: 'passResponse' },
        clock,
      ),
      f
        .restart()
        .act(
          f.code,
          f.other,
          pending.version,
          { type: 'card', mode: 'cancel', card: f.karama.id },
          clock,
        ),
    ]);
    f.hooks.beforeWrite = undefined;
    committedOnce(replies, f.writes);
    const done = await f.restart().readRoom(f.code);
    assert.equal(done.version, pending.version + 1);
    assert.equal(done.pendingFremenMove, null);
    assert.equal(done.response, null);
    const canceled = done.discard.some((c) => c.id === f.karama.id);
    assert.equal(done.players[0].moved, canceled ? 0 : 1);
    assert.equal(
      done.players[1].hand.some((c) => c.id === f.karama.id),
      !canceled,
    );
    assert.equal(
      done.discard.filter((c) => c.id === f.karama.id).length,
      canceled ? 1 : 0,
    );
    assert.deepEqual(
      done.players[0].forces,
      canceled
        ? pending.players[0].forces
        : { [f.from]: 1, [location(f.to.territory, f.to.sector)]: 3 },
    );
    assert.deepEqual(
      done.players.map((p) => p.spice),
      [10, 10, 10],
    );
    assert.equal(done.players[0].reserves, 16);
  } finally {
    f.sqlite.close();
  }
});

void test('duplicate movement cancellation spends one Karama and a restored one-territory replacement uses the still-unspent move once', async () => {
  const f = await fixture();
  try {
    await f.rooms.act(f.code, f.owner, f.initial.version, f.first, clock);
    const pending = await f.restart().readRoom(f.code);
    const cancel: engine.Action = {
      type: 'card',
      mode: 'cancel',
      card: f.karama.id,
    };
    f.writes.length = 0;
    f.hooks.beforeWrite = barrier();
    const replies = await Promise.allSettled([
      f.rooms.act(f.code, f.other, pending.version, cancel, clock),
      f.restart().act(f.code, f.other, pending.version, cancel, clock),
    ]);
    f.hooks.beforeWrite = undefined;
    committedOnce(replies, f.writes);
    const stopped = await f.restart().readRoom(f.code);
    assert.equal(stopped.players[0].moved, 0);
    assert.deepEqual(stopped.players[0].forces, pending.players[0].forces);
    assert.deepEqual(stopped.players[0].fremenMovementBlocked, {
      turn: 2,
      move: 0,
    });
    assert.equal(stopped.discard.filter((c) => c.id === f.karama.id).length, 1);
    assert.equal(
      stopped.players[1].hand.some((c) => c.id === f.karama.id),
      false,
    );
    for (const auth of [f.owner, f.other, f.observer]) {
      const view = await f.restart().readSeatView(f.code, auth);
      assert.equal(view.players[0].fremenMovementBlocked, true);
    }
    await assert.rejects(
      f.restart().act(f.code, f.owner, stopped.version, f.first, clock),
      /more than 1 territories/,
    );
    await assert.rejects(
      f.restart().act(f.code, f.other, stopped.version, cancel, clock),
    );
    assert.deepEqual(await f.rooms.readRoom(f.code), stopped);
    f.writes.length = 0;
    f.hooks.beforeWrite = barrier();
    const replacements = await Promise.allSettled([
      f.restart().act(f.code, f.owner, stopped.version, f.replacement, clock),
      f.rooms.act(f.code, f.owner, stopped.version, f.replacement, clock),
    ]);
    f.hooks.beforeWrite = undefined;
    committedOnce(replacements, f.writes);
    const done = await f.restart().readRoom(f.code);
    assert.equal(done.version, stopped.version + 1);
    assert.equal(done.players[0].moved, 1);
    assert.equal(done.response, null);
    assert.equal(done.pendingFremenMove, null);
    assert.deepEqual(done.players[0].forces, {
      [f.from]: 1,
      [location(f.near.territory, f.near.sector)]: 3,
    });
    assert.equal(done.discard.filter((c) => c.id === f.karama.id).length, 1);
    assert.deepEqual(
      done.players.map((p) => p.spice),
      [10, 10, 10],
    );
    assert.equal(
      (await f.restart().readSeatView(f.code, f.owner)).players[0]
        .fremenMovementBlocked,
      false,
    );
  } finally {
    f.sqlite.close();
  }
});
