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
import type { TruthQuestion } from '../game/truthtrance';
import { createRequire } from 'node:module';
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

async function fixture(
  parent: 'auction' | 'response' | 'shipment' = 'auction',
  queued = false,
) {
  const store = unitStore();
  const created = await store.rooms.createRoom('Asker', 'guild', false, []);
  const code = created.view.code;
  const target = await store.rooms.joinRoom(code, 'Target', 'emperor');
  const other = await store.rooms.joinRoom(code, 'Other asker', 'atreides');
  const seats = await Promise.all(
    [created.token, target.token!, other.token!].map((token) =>
      store.restart().authenticate(code, token),
    ),
  );
  const initial = await store.restart().readRoom(code);
  // Bounded component position with one physical base deck. Credentials and
  // the subsequent shipment/declaration/question/answer use actual room APIs.
  Object.assign(initial, {
    status: 'playing',
    phase: parent === 'auction' ? 3 : 5,
    turn: 2,
    active: seats[1].playerId,
    order: seats.map((s) => s.playerId),
    movementRemaining: [
      seats[1].playerId,
      seats[0].playerId,
      seats[2].playerId,
    ],
    storm: 18,
    deck: baseDeck(),
    decision: null,
    response: null,
    phaseOpening: null,
  });
  for (const p of initial.players) {
    p.hand = [];
    p.spice = 10;
    p.forces = {};
    p.reserves = 20;
    p.shipped = false;
    p.moved = 0;
    p.traitors = [p.leaders[0].id];
    p.traitorChoices = [];
  }
  const hold = (index: number, name: string) => {
    const at = initial.deck.findIndex((c) => c.name === name);
    assert.ok(at >= 0);
    const card = initial.deck.splice(at, 1)[0];
    initial.players[index].hand.push(card);
    return card;
  };
  const card = hold(0, 'Truthtrance'),
    second = queued ? hold(2, 'Truthtrance') : null;
  hold(1, 'Shield');
  hold(1, 'Karama');
  hold(2, 'Lasgun');
  if (parent === 'auction') {
    initial.auction = {
      cards: initial.deck.splice(0, 1),
      index: 0,
      bid: 3,
      bidder: seats[1].playerId,
      active: seats[1].playerId,
      passed: [seats[0].playerId, seats[2].playerId],
      opener: 0,
    };
    initial.decision = { kind: 'auctionPayment', player: seats[1].playerId };
  }
  const save = (g: engine.Game) =>
    store.sqlite
      .prepare('UPDATE rooms SET state=?,version=? WHERE code=?')
      .run(JSON.stringify(g), g.version, code);
  save(initial);
  if (parent === 'response')
    await store
      .restart()
      .act(
        code,
        seats[1],
        initial.version,
        { type: 'ship', territory: 'arrakeen', sector: 10, amount: 2 },
        clock,
      );
  const baseline = await store.restart().readRoom(code);
  if (parent === 'response')
    assert.equal(baseline.response?.kind, 'guildIncome');
  store.writes.length = 0;
  return { ...store, code, seats, initial: baseline, card, second, save };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
async function act(f: Fixture, index: number, action: engine.Action) {
  const current = await f.restart().readRoom(f.code);
  await f.restart().act(f.code, f.seats[index], current.version, action, clock);
  return f.restart().readRoom(f.code);
}
async function ask(f: Fixture, question?: TruthQuestion) {
  // Declare reverse to storm priority, then verify the persisted queue order.
  if (f.second) await act(f, 2, { type: 'card', card: f.second.id });
  await act(f, 0, { type: 'card', card: f.card.id });
  await act(f, 1, { type: 'truthPass' });
  if (!f.second) await act(f, 2, { type: 'truthPass' });
  const ready = await f.restart().readRoom(f.code);
  assert.deepEqual(ready.truthtrance!.queue, [
    { player: f.seats[0].playerId, card: f.card.id },
    ...(f.second ? [{ player: f.seats[2].playerId, card: f.second.id }] : []),
  ]);
  return act(f, 0, {
    type: 'truthAsk',
    question: question ?? {
      kind: 'fact',
      target: f.seats[1].playerId,
      fact: {
        kind: 'and',
        terms: [
          { kind: 'handCount', name: 'Shield', compare: 'eq', value: 1 },
          { kind: 'spice', compare: 'gte', value: 7 },
        ],
      },
    },
  });
}
function receipt(g: engine.Game) {
  const c = g.pendingTreacheryDiscard?.continuation;
  if (c?.kind !== 'truthtranceDiscard')
    throw Error('Missing consumed Truthtrance frame');
  return c;
}
function inventory(g: engine.Game) {
  const ids = [
    ...g.deck,
    ...g.discard,
    ...(g.auction?.cards ?? []),
    ...g.players.flatMap((p) => p.hand),
  ]
    .map((c) => c.id)
    .sort();
  assert.equal(new Set(ids).size, ids.length);
  return ids;
}
function barrier() {
  let arrivals = 0,
    release!: () => void;
  const ready = new Promise<void>((resolve) => {
    release = resolve;
  });
  return async () => {
    if (++arrivals === 2) release();
    await ready;
  };
}
async function views(f: Fixture, g: engine.Game, answer: 'yes' | null) {
  for (const [index, seat] of f.seats.entries()) {
    const view = await f.restart().readSeatView(f.code, seat);
    assert.equal(view.truthAnswer, index === 1 ? answer : null);
    assert.equal(
      view.automaticContinuationPending,
      !!g.pendingTreacheryDiscard,
    );
    assert.equal(Object.hasOwn(view, 'pendingTreacheryDiscard'), false);
    assert.deepEqual(view.truthHistory, g.truthHistory ?? []);
    for (const p of view.players) {
      if (p.id === seat.playerId)
        assert.deepEqual(p.hand, g.players[index].hand);
      else
        for (const key of [
          'hand',
          'spice',
          'traitors',
          'traitorChoices',
          'bribes',
        ])
          assert.equal(key in p, false, key);
    }
    if (g.pendingTreacheryDiscard) {
      assert.equal(view.truthtrance, null);
      assert.equal(view.truthShipmentAnswers, null);
      assert.equal(view.truthBattleAnswers, null);
      assert.equal(view.shipmentCompletion, null);
      assert.equal(f.restart().needsAutomaticRoomRecovery(view), true);
    }
  }
}
async function frameFor(f: Fixture, question?: TruthQuestion) {
  const answering = await ask(f, question);
  if (!question) await views(f, answering, 'yes');
  const frame = inner(answering, f.seats[1].playerId, {
    type: 'truthAnswer',
    answer: 'yes',
  });
  assert.deepEqual(receipt(frame).consumed, {
    player: f.seats[0].playerId,
    card: f.card.id,
  });
  assert.equal(frame.truthtrance, null);
  assert.equal(frame.truthHistory!.length, 1);
  assert.deepEqual(
    frame.pendingTreacheryDiscard!.batch.entries.map((e) => [
      e.card.id,
      e.discardedBy,
      e.publicFace,
    ]),
    [[f.card.id, f.seats[0].playerId, true]],
  );
  assert.deepEqual(frame.discard, [f.card]);
  assert.deepEqual(
    frame.players[1],
    answering.players[1],
    'answering target never loses its card or spice',
  );
  f.save(frame);
  f.writes.length = 0;
  await views(f, frame, null);
  return { answering, frame };
}
async function recover(f: Fixture, frame: engine.Game) {
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
  assert.equal(
    done.resolvedTreacheryDiscardSequence,
    frame.treacheryDiscardSequence,
  );
  assert.deepEqual(done.players, frame.players);
  assert.deepEqual(done.discard, frame.discard);
  assert.deepEqual(done.deck, frame.deck);
  assert.deepEqual(done.truthHistory, frame.truthHistory);
  assert.deepEqual(done.shipmentPromises, frame.shipmentPromises);
  assert.deepEqual(
    done.log,
    frame.log,
    'history, answer and consumption logs are committed before the frame',
  );
  assert.deepEqual(inventory(done), inventory(f.initial));
  await f.restart().continueRoomAutomatic(f.code, clock);
  assert.deepEqual(await f.restart().readRoom(f.code), done);
  assert.equal(f.writes.length, 2);
  return done;
}

void test('a consumed head restores the exact next storm-priority question once while its auction remains suspended', async () => {
  const f = await fixture('auction', true);
  try {
    const { frame } = await frameFor(f);
    const remaining = receipt(frame).remaining;
    assert.equal(remaining?.stage, 'ask');
    assert.deepEqual(remaining?.queue, [
      { player: f.seats[2].playerId, card: f.second!.id },
    ]);
    const done = await recover(f, frame);
    assert.deepEqual(done.truthtrance, remaining);
    assert.deepEqual(done.decision, f.initial.decision);
    assert.deepEqual(done.auction, f.initial.auction);
    await assert.rejects(
      f
        .restart()
        .act(
          f.code,
          f.seats[1],
          done.version,
          { type: 'truthAnswer', answer: 'yes' },
          clock,
        ),
    );
    assert.equal(f.writes.length, 2);
    const next = await act(f, 2, {
      type: 'truthAsk',
      question: {
        kind: 'fact',
        target: f.seats[1].playerId,
        fact: { kind: 'hand', name: 'Shield' },
      },
    });
    const final = await act(f, 1, { type: 'truthAnswer', answer: 'yes' });
    assert.equal(final.version, next.version + 1);
    assert.equal(final.pendingTreacheryDiscard, null);
    assert.equal(final.truthtrance, null);
    assert.equal(final.truthHistory!.length, 2);
    assert.deepEqual(
      final.discard.map((c) => c.id),
      [f.card.id, f.second!.id],
    );
    assert.deepEqual(final.decision, f.initial.decision);
    assert.equal(final.resolvedTreacheryDiscardSequence, 2);
  } finally {
    f.sqlite.close();
  }
});

void test('the final consumed Truthtrance restores a genuine paid-shipment income response without paying or shipping twice', async () => {
  const f = await fixture('response');
  try {
    const { answering, frame } = await frameFor(f);
    assert.equal(receipt(frame).remaining, null);
    assert.deepEqual(receipt(frame).resume.response, f.initial.response);
    assert.equal(frame.response, null);
    const done = await recover(f, frame);
    assert.equal(done.truthtrance, null);
    assert.deepEqual(done.response, f.initial.response);
    assert.deepEqual(done.players[1].forces, { 'arrakeen:10': 2 });
    assert.deepEqual(
      done.players.map((p) => p.spice),
      [10, 8, 10],
    );
    for (const version of [answering.version, done.version])
      await assert.rejects(
        f
          .restart()
          .act(
            f.code,
            f.seats[1],
            version,
            { type: 'truthAnswer', answer: 'yes' },
            clock,
          ),
      );
    assert.equal(f.writes.length, 2);
    const replay = structuredClone(done);
    replay.pendingTreacheryDiscard = frame.pendingTreacheryDiscard;
    f.save(replay);
    await assert.rejects(f.restart().continueRoomAutomatic(f.code, clock));
    await assert.rejects(f.restart().readSeatView(f.code, f.seats[0]));
    assert.equal(f.writes.length, 2);
    assert.deepEqual(await f.restart().readRoom(f.code), replay);
  } finally {
    f.sqlite.close();
  }
});

void test('a consumed shipment answer persists its single binding promise before frame recovery and later fulfills it once', async () => {
  const f = await fixture('shipment');
  try {
    const { frame } = await frameFor(f, {
      kind: 'shipment',
      target: f.seats[1].playerId,
      territory: 'carthag',
      minimum: 2,
    });
    assert.equal(frame.shipmentPromises!.length, 1);
    assert.equal(frame.shipmentPromises![0].answer, true);
    const done = await recover(f, frame);
    for (const [index, seat] of f.seats.entries()) {
      const view = await f.restart().readSeatView(f.code, seat);
      assert.deepEqual(view.shipmentPromises, frame.shipmentPromises);
      if (index === 1) assert.ok(view.shipmentCompletion?.actions.length);
      else assert.equal(view.shipmentCompletion, null);
    }
    await assert.rejects(
      f
        .restart()
        .act(f.code, f.seats[1], done.version, { type: 'endMovement' }, clock),
    );
    const shipped = await act(f, 1, {
      type: 'ship',
      territory: 'carthag',
      sector: 11,
      amount: 2,
    });
    assert.equal(shipped.shipmentPromises!.length, 1);
    assert.equal(shipped.shipmentPromises![0].fulfilled, true);
    assert.equal(shipped.truthHistory!.length, 1);
    assert.deepEqual(shipped.discard, [f.card]);
    assert.equal(shipped.players[1].forces['carthag:11'], 2);
  } finally {
    f.sqlite.close();
  }
});

void test('duplicate valid answer requests consume the asker card and history in exactly one original room CAS', async () => {
  const f = await fixture();
  try {
    const answering = await ask(f);
    for (const [index, answer] of [
      [0, 'yes'],
      [1, 'no'],
    ] as const)
      await assert.rejects(
        f
          .restart()
          .act(
            f.code,
            f.seats[index],
            answering.version,
            { type: 'truthAnswer', answer },
            clock,
          ),
      );
    assert.deepEqual(await f.restart().readRoom(f.code), answering);
    f.writes.length = 0;
    f.hooks.beforeWrite = barrier();
    const results = await Promise.allSettled([
      f
        .restart()
        .act(
          f.code,
          f.seats[1],
          answering.version,
          { type: 'truthAnswer', answer: 'yes' },
          clock,
        ),
      f
        .restart()
        .act(
          f.code,
          f.seats[1],
          answering.version,
          { type: 'truthAnswer', answer: 'yes' },
          clock,
        ),
    ]);
    f.hooks.beforeWrite = undefined;
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
    assert.equal(results.filter((r) => r.status === 'rejected').length, 1);
    assert.deepEqual(
      f.writes.map((w) => w.changes).sort((a, b) => a - b),
      [0, 1],
    );
    const done = await f.restart().readRoom(f.code);
    assert.equal(done.version, answering.version + 1);
    assert.equal(done.truthHistory!.length, 1);
    assert.equal(done.pendingTreacheryDiscard, null);
    assert.equal(done.truthtrance, null);
    assert.deepEqual(done.discard, [f.card]);
    assert.deepEqual(done.players[1], answering.players[1]);
    assert.deepEqual(done.decision, f.initial.decision);
    assert.equal(done.resolvedTreacheryDiscardSequence, 1);
  } finally {
    f.sqlite.close();
  }
});

void test('corrupted consumed card, indexed answer, remaining queue or suspended parent fails before any SQL write', async () => {
  for (const parent of ['auction', 'response', 'shipment'] as const) {
    const f = await fixture(parent, parent === 'auction');
    try {
      const { frame } = await frameFor(
        f,
        parent === 'shipment'
          ? {
              kind: 'shipment',
              target: f.seats[1].playerId,
              territory: 'carthag',
              minimum: 2,
            }
          : undefined,
      );
      const mutations: ((g: engine.Game) => void)[] = [
        (g) => {
          g.pendingTreacheryDiscard!.batch.event = 'stale-consumption';
        },
        (g) => {
          receipt(g).consumed.player = f.seats[1].playerId;
        },
        (g) => {
          receipt(g).consumed.card = g.players[1].hand[0].id;
        },
        (g) => {
          receipt(g).historyIndex++;
        },
        (g) => {
          g.truthHistory![0].answer = 'no';
        },
        (g) => {
          receipt(g).record.answer = 'unknown';
        },
        (g) => {
          receipt(g).parentSignature = '{}';
        },
        (g) => {
          g.players[0].hand.push(structuredClone(f.card));
        },
        (g) => {
          g.turn++;
        },
        (g) => {
          g.phaseOpening = { initialize: true, passed: [] };
        },
        (g) => {
          g.status = 'finished';
        },
      ];
      if (parent === 'auction')
        mutations.push(
          (g) => {
            receipt(g).remaining!.queue.push(
              structuredClone(receipt(g).remaining!.queue[0]),
            );
          },
          (g) => {
            receipt(g).remaining!.queue[0].player = f.seats[0].playerId;
          },
          (g) => {
            g.truthtrance = structuredClone(receipt(g).remaining);
          },
          (g) => {
            g.players[2].hand = g.players[2].hand.filter(
              (c) => c.id !== f.second!.id,
            );
          },
        );
      if (parent === 'response')
        mutations.push((g) => {
          receipt(g).resume.response!.amount = 99;
        });
      if (parent === 'shipment')
        mutations.push((g) => {
          g.shipmentPromises![0].minimum = 3;
        });
      for (const [mutationIndex, mutate] of mutations.entries()) {
        const bad = structuredClone(frame);
        mutate(bad);
        f.save(bad);
        await assert.rejects(
          f.restart().readSeatView(f.code, f.seats[0]),
          `${parent} mutation ${mutationIndex}`,
        );
        assert.throws(
          () => engine.normalizeAutomaticGame(bad),
          `${parent} mutation ${mutationIndex} engine`,
        );
        await assert.rejects(
          f.restart().continueRoomAutomatic(f.code, clock),
          `${parent} mutation ${mutationIndex} recovery`,
        );
        await assert.rejects(
          f
            .restart()
            .act(
              f.code,
              f.seats[1],
              bad.version,
              { type: 'advanceBots' },
              clock,
            ),
        );
        assert.deepEqual(await f.restart().readRoom(f.code), bad);
        assert.equal(f.writes.length, 0);
      }
    } finally {
      f.sqlite.close();
    }
  }
});
