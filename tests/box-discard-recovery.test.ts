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
import { richeseCards } from '../game/richese-cards';

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

async function fixture(single = false) {
  const store = unitStore();
  const created = await store.rooms.createRoom(
    'Searcher',
    'atreides',
    false,
    [],
  );
  const code = created.view.code;
  const guild = await store.rooms.joinRoom(code, 'Guild', 'guild');
  const entrant = await store.rooms.joinRoom(code, 'Entrant', 'emperor');
  const tokens = [created.token, guild.token!, entrant.token!];
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
  const g = await store.restart().readRoom(code);
  assert.equal(g.status, 'playing');
  // Internal component fixture; physical cards come from one base deck and
  // one Richese cache. Credentials and subsequent shipment/search use real APIs.
  Object.assign(g, {
    turn: 2,
    phase: 5,
    storm: 18,
    active: seats[2].playerId,
    order: seats.map((s) => s.playerId),
    movementRemaining: seats.map((s) => s.playerId),
    deck: baseDeck(),
    discard: [],
    richeseCache: richeseCards(),
    decision: null,
    response: null,
    phaseOpening: null,
    pendingKarama: null,
    ready: [],
  });
  for (const p of g.players) {
    p.hand = [];
    p.spice = 10;
    p.forces = {};
    p.reserves = 20;
    p.shipped = false;
    p.moved = 0;
    p.traitors = [];
  }
  const boxAt = g.richeseCache!.findIndex((c) => c.effect === 'nullentropyBox');
  const box = g.richeseCache!.splice(boxAt, 1)[0];
  g.players[0].hand.push(box);
  for (const name of single
    ? ['Shield']
    : ['Shield', 'Maula Pistol', 'Lasgun', 'Baliset']) {
    const at = g.deck.findIndex((c) => c.name === name);
    assert.ok(at >= 0);
    g.discard.push(...g.deck.splice(at, 1));
  }
  const karamaAt = g.deck.findIndex((c) => c.effect === 'karama');
  g.players[2].hand.push(...g.deck.splice(karamaAt, 1));
  const save = (state: engine.Game) =>
    store.sqlite
      .prepare('UPDATE rooms SET state=?,version=? WHERE code=?')
      .run(JSON.stringify(state), state.version, code);
  save(g);
  // A genuine paid shipment creates the suspended Guild income response.
  await act(2, { type: 'ship', territory: 'arrakeen', sector: 10, amount: 2 });
  const initial = await store.restart().readRoom(code);
  assert.equal(initial.response?.kind, 'guildIncome');
  assert.equal(initial.response?.amount, 2);
  assert.equal(initial.players[2].spice, 8);
  store.writes.length = 0;
  return {
    ...store,
    code,
    seats,
    tokens,
    initial,
    save,
    act,
    box,
    action: { type: 'card', card: box.id } as engine.Action,
    physicalIds: inventory(initial),
  };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
function inventory(g: engine.Game) {
  const ids = [
    ...g.deck,
    ...g.discard,
    ...(g.richeseCache ?? []),
    ...g.players.flatMap((p) => p.hand),
  ]
    .map((c) => c.id)
    .sort();
  assert.equal(new Set(ids).size, ids.length);
  return ids;
}
function barrier() {
  let release!: () => void,
    arrivals = 0;
  const both = new Promise<void>((resolve) => {
    release = resolve;
  });
  return async () => {
    if (++arrivals === 2) release();
    await both;
  };
}
async function paidFrame(f: Fixture) {
  await f.act(0, f.action);
  const paid = await f.restart().readRoom(f.code);
  assert.equal(paid.players[0].spice, 8);
  assert.equal(paid.pendingNullentropy?.player, f.seats[0].playerId);
  assert.deepEqual(paid.discard, f.initial.discard);
  assert.equal(paid.response, null);
  const selected = paid.discard[1];
  const frame = inner(paid, f.seats[0].playerId, {
    type: 'decision',
    event: paid.pendingNullentropy!.event,
    card: selected.id,
  });
  assert.equal(
    frame.pendingTreacheryDiscard?.continuation.kind,
    'nullentropyDiscard',
  );
  assert.equal(frame.pendingNullentropy, null);
  assert.equal(frame.response, null);
  assert.equal(frame.decision, null);
  assert.equal(frame.discard.at(-1)!.id, f.box.id);
  assert.deepEqual(
    frame.pendingTreacheryDiscard!.batch.entries.map((e) => [
      e.card.id,
      e.discardedBy,
      e.publicFace,
    ]),
    [[f.box.id, f.seats[0].playerId, true]],
  );
  assert.deepEqual(frame.players[0].hand, [selected]);
  f.save(frame);
  f.writes.length = 0;
  return { frame, paid, selected };
}
async function recoverRace(f: Fixture, frame: engine.Game) {
  f.hooks.beforeWrite = barrier();
  await Promise.all([
    f.restart().continueRoomAutomatic(f.code, clock),
    f.restart().continueRoomAutomatic(f.code, clock),
  ]);
  f.hooks.beforeWrite = undefined;
  const done = await f.restart().readRoom(f.code);
  assert.deepEqual(
    f.writes.map((w) => w.changes).sort((a, b) => a - b),
    [0, 1],
  );
  assert.equal(done.version, frame.version + 1);
  assert.equal(done.pendingTreacheryDiscard, null);
  assert.equal(done.pendingNullentropy, null);
  assert.equal(
    done.resolvedTreacheryDiscardSequence,
    frame.treacheryDiscardSequence,
  );
  assert.deepEqual(
    done.discard,
    frame.discard,
    'the committed Box shuffle is not repeated',
  );
  assert.deepEqual(done.deck, frame.deck);
  assert.deepEqual(
    done.players,
    frame.players,
    'fee, recovered card and paid shipment are not replayed',
  );
  assert.deepEqual(done.response, f.initial.response);
  assert.deepEqual(done.pendingKarama, f.initial.pendingKarama);
  assert.deepEqual(done.phaseOpening, f.initial.phaseOpening);
  assert.deepEqual(inventory(done), f.physicalIds);
  assert.equal(
    done.log.filter((l) => l.text.includes('paid two spice to the bank'))
      .length,
    1,
  );
  assert.equal(
    done.log.filter((l) => l.automatic?.name === 'Nullentropy Box').length,
    1,
  );
  await f.restart().continueRoomAutomatic(f.code, clock);
  assert.deepEqual(await f.restart().readRoom(f.code), done);
  assert.equal(f.writes.length, 2);
  return done;
}
void test('paid multi-choice Box inspection is private, and its committed shuffle survives two recovery workers unchanged', async () => {
  const f = await fixture();
  try {
    await f.act(0, f.action);
    const paid = await f.restart().readRoom(f.code);
    assert.equal(f.writes.length, 1);
    assert.equal(paid.players[0].spice, 8);
    for (const [index, token] of f.tokens.entries()) {
      const auth = await f.restart().authenticate(f.code, token);
      const view = await f.restart().readSeatView(f.code, auth);
      if (index === 0) {
        assert.deepEqual(
          view.nullentropy!.search!.cards.map((c) => c.id).sort(),
          paid.discard.map((c) => c.id).sort(),
        );
      } else {
        assert.equal(view.nullentropy, null);
        for (const card of paid.discard)
          assert.equal(JSON.stringify(view).includes(card.id), false);
      }
    }
    await f.restart().continueRoomAutomatic(f.code, clock);
    assert.deepEqual(await f.restart().readRoom(f.code), paid);
    assert.equal(f.writes.length, 1);
    const selected = paid.discard[1];
    const selection = {
      type: 'decision',
      event: paid.pendingNullentropy!.event,
      card: selected.id,
    };
    await assert.rejects(
      f.restart().act(f.code, f.seats[1], paid.version, selection, clock),
      /owner/,
    );
    await assert.rejects(
      f
        .restart()
        .act(
          f.code,
          f.seats[0],
          paid.version,
          { ...selection, event: 'old-search' },
          clock,
        ),
      /stale/,
    );
    assert.deepEqual(await f.restart().readRoom(f.code), paid);
    assert.equal(f.writes.length, 1);
    const frame = inner(paid, f.seats[0].playerId, selection);
    assert.equal(
      frame.pendingTreacheryDiscard?.continuation.kind,
      'nullentropyDiscard',
    );
    assert.deepEqual(frame.players[0].hand, [selected]);
    assert.equal(frame.discard.at(-1)!.id, f.box.id);
    f.save(frame);
    f.writes.length = 0;
    for (const [index, token] of f.tokens.entries()) {
      const auth = await f.restart().authenticate(f.code, token);
      const view = await f.restart().readSeatView(f.code, auth);
      assert.equal(view.automaticContinuationPending, true);
      assert.equal(f.restart().needsAutomaticRoomRecovery(view), true);
      assert.equal(Object.hasOwn(view, 'pendingTreacheryDiscard'), false);
      assert.equal(view.nullentropy, null);
      assert.equal(view.response, null);
      if (index !== 0)
        assert.equal(JSON.stringify(view).includes(selected.id), false);
      for (const [seat, p] of view.players.entries())
        assert.deepEqual(
          p.hand,
          seat === index ? frame.players[seat].hand : undefined,
        );
    }
    assert.equal(f.writes.length, 0);
    const done = await recoverRace(f, frame);
    assert.equal(done.players[0].spice, 8);
    assert.equal(
      done.players[1].spice,
      10,
      'restoring the income response does not pay it twice or early',
    );
  } finally {
    f.sqlite.close();
  }
});
void test('a sole Box candidate completes in one original paid CAS without a second choice or duplicate fee', async () => {
  const f = await fixture(true);
  try {
    const selected = f.initial.discard[0];
    f.hooks.beforeWrite = barrier();
    const results = await Promise.allSettled([
      f.restart().act(f.code, f.seats[0], f.initial.version, f.action, clock),
      f.restart().act(f.code, f.seats[0], f.initial.version, f.action, clock),
    ]);
    f.hooks.beforeWrite = undefined;
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
    assert.deepEqual(
      f.writes.map((w) => w.changes).sort((a, b) => a - b),
      [0, 1],
    );
    const done = await f.restart().readRoom(f.code);
    assert.equal(done.version, f.initial.version + 1);
    assert.equal(done.players[0].spice, 8);
    assert.deepEqual(done.players[0].hand, [selected]);
    assert.deepEqual(done.discard, [f.box]);
    assert.equal(done.pendingNullentropy, null);
    assert.equal(done.pendingTreacheryDiscard, null);
    assert.equal(done.resolvedTreacheryDiscardSequence, 1);
    assert.equal(done.decision, null);
    assert.deepEqual(done.response, f.initial.response);
    assert.deepEqual(inventory(done), f.physicalIds);
    assert.equal(
      done.log.filter((l) => l.text.includes('paid two spice to the bank'))
        .length,
      1,
    );
    await f.restart().continueRoomAutomatic(f.code, clock);
    assert.deepEqual(await f.restart().readRoom(f.code), done);
    assert.equal(f.writes.length, 2);
  } finally {
    f.sqlite.close();
  }
});
void test('corrupted post-Box custody, pile order and selected receipt reject before any SQL write', async () => {
  const f = await fixture();
  try {
    const { frame } = await paidFrame(f);
    const continuation = (g: engine.Game) => {
      const c = g.pendingTreacheryDiscard!.continuation;
      if (c.kind !== 'nullentropyDiscard') throw Error('Missing Box frame');
      return c;
    };
    for (const mutate of [
      (g: engine.Game) => {
        g.pendingTreacheryDiscard!.batch.event = 'stale-discard';
      },
      (g: engine.Game) => {
        continuation(g).player = f.seats[1].playerId;
      },
      (g: engine.Game) => {
        continuation(g).selected = structuredClone(g.deck[0]);
      },
      (g: engine.Game) => {
        g.discard.reverse();
      },
      (g: engine.Game) => {
        continuation(g).finalDiscardSignature = '[]';
      },
      (g: engine.Game) => {
        continuation(g).resume.response!.amount = 999;
      },
      (g: engine.Game) => {
        continuation(g).searchEvent = 'different-paid-search';
      },
      (g: engine.Game) => {
        continuation(g).finalDiscardIds.reverse();
      },
      (g: engine.Game) => {
        g.deck.push(structuredClone(g.players[0].hand[0]));
      },
      (g: engine.Game) => {
        g.players[0].hand.push(structuredClone(f.box));
      },
    ]) {
      const bad = structuredClone(frame);
      mutate(bad);
      f.save(bad);
      await assert.rejects(f.restart().readSeatView(f.code, f.seats[0]));
      await assert.rejects(f.restart().continueRoomAutomatic(f.code, clock));
      await assert.rejects(
        f
          .restart()
          .act(f.code, f.seats[0], bad.version, { type: 'ready' }, clock),
      );
      assert.deepEqual(await f.restart().readRoom(f.code), bad);
      assert.equal(f.writes.length, 0);
    }
  } finally {
    f.sqlite.close();
  }
});
void test('a retired Box frame and stale original selection cannot recover the card or shuffle again', async () => {
  const f = await fixture();
  try {
    const { frame, paid, selected } = await paidFrame(f);
    const done = await recoverRace(f, frame);
    await assert.rejects(
      f.restart().act(
        f.code,
        f.seats[0],
        paid.version,
        {
          type: 'decision',
          event: paid.pendingNullentropy!.event,
          card: selected.id,
        },
        clock,
      ),
      /table changed/,
    );
    const replay = structuredClone(done);
    replay.pendingTreacheryDiscard = structuredClone(
      frame.pendingTreacheryDiscard,
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
