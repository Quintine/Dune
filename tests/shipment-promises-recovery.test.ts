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
  const made = await store.rooms.createRoom('Asker', 'atreides', false, []);
  const code = made.view.code;
  const target = await store.rooms.joinRoom(code, 'Shipper', 'emperor');
  const observer = await store.rooms.joinRoom(code, 'Observer', 'harkonnen');
  const seats = await Promise.all(
    [made.token, target.token!, observer.token!].map((token) =>
      store.rooms.authenticate(code, token),
    ),
  );
  const initial = await store.rooms.readRoom(code);
  Object.assign(initial, {
    status: 'playing',
    phase: 5,
    turn: 2,
    active: seats[1].playerId,
    order: [seats[1].playerId, seats[0].playerId, seats[2].playerId],
    movementRemaining: [
      seats[1].playerId,
      seats[0].playerId,
      seats[2].playerId,
    ],
    storm: 18,
    deck: baseDeck(),
    response: null,
    decision: null,
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
  initial.players[1].forces = { 'polar_sink:0': 2 };
  initial.players[1].reserves = 18;
  const hold = (index: number, name: string) => {
    const at = initial.deck.findIndex((card) => card.name === name);
    assert.ok(at >= 0, name);
    const card = initial.deck.splice(at, 1)[0];
    initial.players[index].hand.push(card);
    return card;
  };
  const card = hold(0, 'Truthtrance');
  hold(1, 'Shield');
  hold(2, 'Gom Jabbar');
  store.sqlite
    .prepare('UPDATE rooms SET state=?,version=? WHERE code=?')
    .run(JSON.stringify(initial), initial.version, code);
  store.writes.length = 0;
  return { ...store, code, seats, initial, card };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
async function act(f: Fixture, index: number, action: engine.Action) {
  const current = await f.restart().readRoom(f.code);
  await f.restart().act(f.code, f.seats[index], current.version, action, clock);
  return f.restart().readRoom(f.code);
}
const claim = { kind: 'shipment', territory: 'carthag', minimum: 6 } as const;
async function priority(f: Fixture) {
  await act(f, 0, { type: 'card', card: f.card.id });
  for (const index of [1, 2]) await act(f, index, { type: 'truthPass' });
  return f.restart().readRoom(f.code);
}
async function ask(f: Fixture) {
  await priority(f);
  return act(f, 0, {
    type: 'truthAsk',
    question: { ...claim, target: f.seats[1].playerId },
  });
}
async function restored(f: Fixture) {
  const before = await f.restart().readRoom(f.code);
  const writes = f.writes.length;
  await f.restart().continueRoomAutomatic(f.code, clock);
  assert.equal(
    f.writes.length,
    writes,
    'Refresh must not answer or ship on behalf of a human.',
  );
  assert.deepEqual(await f.restart().readRoom(f.code), before);
  return before;
}
function inventory(g: engine.Game) {
  return [...g.deck, ...g.discard, ...g.players.flatMap((p) => p.hand)]
    .map((card) => card.id)
    .sort();
}
async function privateViews(
  f: Fixture,
  answering: boolean,
  completion: boolean,
) {
  const state = await f.restart().readRoom(f.code);
  for (const [index, seat] of f.seats.entries()) {
    const view = await f.restart().readSeatView(f.code, seat);
    assert.deepEqual(
      view.truthShipmentAnswers,
      index === 1 && answering ? ['yes', 'no'] : null,
    );
    if (index === 1 && completion)
      assert.ok(view.shipmentCompletion?.actions.length);
    else assert.equal(view.shipmentCompletion, null);
    assert.deepEqual(view.shipmentPromises, state.shipmentPromises ?? []);
    for (const p of view.players) {
      if (p.id === seat.playerId) {
        assert.deepEqual(p.hand, state.players[index].hand);
        continue;
      }
      for (const key of [
        'spice',
        'hand',
        'handCount',
        'traitors',
        'traitorChoices',
        'bribes',
      ])
        assert.equal(key in p, false, `Other seat disclosed ${key}`);
    }
    assert.equal('deck' in view, false);
  }
}
async function rejectsWithoutWrite(
  f: Fixture,
  index: number,
  action: engine.Action,
  pattern?: RegExp,
) {
  const before = await f.restart().readRoom(f.code);
  const writes = f.writes.length;
  const attempt = f
    .restart()
    .act(f.code, f.seats[index], before.version, action, clock);
  if (pattern) await assert.rejects(attempt, pattern);
  else await assert.rejects(attempt);
  assert.deepEqual(await f.restart().readRoom(f.code), before);
  assert.equal(f.writes.length, writes);
}
function barrier() {
  let release!: () => void;
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  let arrivals = 0;
  return async () => {
    if (++arrivals === 2) release();
    await waiting;
  };
}
async function race(
  f: Fixture,
  index: number,
  version: number,
  actions: engine.Action[],
) {
  f.writes.length = 0;
  f.hooks.beforeWrite = barrier();
  const outcomes = await Promise.allSettled(
    actions.map((action) =>
      f.restart().act(f.code, f.seats[index], version, action, clock),
    ),
  );
  f.hooks.beforeWrite = undefined;
  assert.equal(
    outcomes.filter((outcome) => outcome.status === 'fulfilled').length,
    1,
  );
  assert.equal(
    outcomes.filter((outcome) => outcome.status === 'rejected').length,
    1,
  );
  assert.deepEqual(
    f.writes.map((write) => write.changes).sort((a, b) => a - b),
    [0, 1],
  );
  return outcomes;
}
function assertSingleAnswer(f: Fixture, g: engine.Game, answer: boolean) {
  assert.equal(g.truthtrance, null);
  assert.equal(g.shipmentPromises?.length, 1);
  assert.equal(g.shipmentPromises![0].answer, answer);
  assert.equal(g.shipmentPromises![0].player, f.seats[1].playerId);
  assert.equal(g.shipmentPromises![0].asker, f.seats[0].playerId);
  assert.equal(g.shipmentPromises![0].turn, 2);
  assert.equal(g.shipmentPromises![0].territory, 'carthag');
  assert.equal(g.shipmentPromises![0].minimum, 6);
  assert.equal(g.truthHistory?.length, 1);
  assert.equal(g.truthHistory![0].answer, answer ? 'yes' : 'no');
  assert.deepEqual(g.truthHistory![0].question, {
    ...claim,
    target: f.seats[1].playerId,
  });
  assert.equal(g.discard.filter((card) => card.id === f.card.id).length, 1);
  assert.equal(
    g.players[0].hand.some((card) => card.id === f.card.id),
    false,
  );
  assert.deepEqual(inventory(g), inventory(f.initial));
}

void test('shipment question and accepted promise survive fresh room modules with only target-private answers and completion choices', async () => {
  const f = await fixture();
  try {
    const unasked = await priority(f);
    await restored(f);
    for (const minimum of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1])
      await rejectsWithoutWrite(f, 0, {
        type: 'truthAsk',
        question: { ...claim, target: f.seats[1].playerId, minimum },
      });
    await rejectsWithoutWrite(f, 0, {
      type: 'truthAsk',
      question: {
        ...claim,
        target: f.seats[1].playerId,
        territory: 'not-a-territory',
      },
    });
    await rejectsWithoutWrite(f, 0, {
      type: 'truthAsk',
      question: { ...claim, target: f.seats[2].playerId },
    });
    await rejectsWithoutWrite(f, 2, {
      type: 'truthAsk',
      question: { ...claim, target: f.seats[1].playerId },
    });
    assert.deepEqual(await f.restart().readRoom(f.code), unasked);
    await act(f, 0, {
      type: 'truthAsk',
      question: { ...claim, target: f.seats[1].playerId },
    });
    const pending = await restored(f);
    await privateViews(f, true, false);
    const poorTarget = structuredClone(pending);
    poorTarget.players[1].spice = 0;
    assert.deepEqual(
      engine.viewGame(poorTarget, f.seats[1].playerId).truthShipmentAnswers,
      ['no'],
    );
    for (const index of [0, 2])
      assert.deepEqual(
        engine.viewGame(poorTarget, f.seats[index].playerId),
        engine.viewGame(pending, f.seats[index].playerId),
        'Rival projections must not disclose whether private funding permits Yes.',
      );
    for (const index of [0, 2])
      await rejectsWithoutWrite(
        f,
        index,
        { type: 'truthAnswer', answer: 'yes' },
        /questioned player/,
      );
    await rejectsWithoutWrite(f, 1, { type: 'truthAnswer', answer: 'unknown' });
    assert.deepEqual(pending.players, f.initial.players);
    const accepted = await act(f, 1, { type: 'truthAnswer', answer: 'yes' });
    assertSingleAnswer(f, accepted, true);
    assert.equal(accepted.players[1].shipped, false);
    assert.deepEqual(accepted.players[1], f.initial.players[1]);
    await privateViews(f, false, true);
    assert.deepEqual(await restored(f), accepted);
    await rejectsWithoutWrite(f, 1, { type: 'truthAnswer', answer: 'yes' });
  } finally {
    f.hooks.beforeWrite = undefined;
    f.sqlite.close();
  }
});

void test('persisted Yes rejects evasion and a duplicated compatible reserve shipment pays, arrives and fulfills exactly once', async () => {
  const f = await fixture();
  try {
    // These actions are legal before the promise, so their later rejection is meaningful.
    const attempts: engine.Action[] = [
      { type: 'endMovement' },
      {
        type: 'move',
        forces: { 'polar_sink:0': 1 },
        territory: 'imperial_basin',
        sector: 11,
      },
      { type: 'ship', territory: 'carthag', sector: 11, amount: 5 },
      { type: 'ship', territory: 'arrakeen', sector: 10, amount: 6 },
    ];
    for (const action of attempts)
      assert.doesNotThrow(() =>
        engine.applyAction(f.initial, f.seats[1].playerId, action),
      );
    await ask(f);
    await act(f, 1, { type: 'truthAnswer', answer: 'yes' });
    const accepted = await restored(f);
    for (const action of attempts)
      await rejectsWithoutWrite(f, 1, action, /Truthtrance|promise/i);
    const action: engine.Action = {
      type: 'ship',
      territory: 'carthag',
      sector: 11,
      amount: 7,
    };
    await race(f, 1, accepted.version, [action, action]);
    const done = await f.restart().readRoom(f.code);
    assert.equal(done.version, accepted.version + 1);
    assertSingleAnswer(f, done, true);
    assert.equal(done.shipmentPromises![0].fulfilled, true);
    assert.notEqual(done.shipmentPromises![0].released, true);
    assert.equal(done.players[1].spice, 3);
    assert.equal(done.players[1].reserves, 11);
    assert.equal(done.players[1].forces['carthag:11'], 7);
    assert.equal(done.players[1].forces['polar_sink:0'], 2);
    assert.equal(done.players[1].shipped, true);
    const writes = f.writes.length;
    for (const version of [accepted.version, done.version])
      await assert.rejects(
        f.restart().act(f.code, f.seats[1], version, action, clock),
      );
    assert.equal(f.writes.length, writes);
    assert.deepEqual(await restored(f), done);
    await privateViews(f, false, false);
  } finally {
    f.hooks.beforeWrite = undefined;
    f.sqlite.close();
  }
});

void test('competing persisted Yes and No answers bind only the winning CAS and retain its exact shipment restriction', async () => {
  for (const firstAnswer of ['yes', 'no'] as const) {
    const f = await fixture();
    try {
      await ask(f);
      const pending = await restored(f);
      const answers = [firstAnswer, firstAnswer === 'yes' ? 'no' : 'yes'];
      const outcomes = await race(
        f,
        1,
        pending.version,
        answers.map((answer) => ({ type: 'truthAnswer', answer })),
      );
      const winningIndex = outcomes.findIndex(
        (outcome) => outcome.status === 'fulfilled',
      );
      const yes = answers[winningIndex] === 'yes';
      const accepted = await restored(f);
      assert.equal(accepted.version, pending.version + 1);
      assertSingleAnswer(f, accepted, yes);
      assert.equal(accepted.players[1].shipped, false);
      const matching: engine.Action = {
        type: 'ship',
        territory: 'carthag',
        sector: 11,
        amount: 6,
      };
      const smaller: engine.Action = {
        type: 'ship',
        territory: 'carthag',
        sector: 11,
        amount: 5,
      };
      await rejectsWithoutWrite(
        f,
        1,
        yes ? smaller : matching,
        /Truthtrance|promise/i,
      );
      if (!yes)
        assert.doesNotThrow(() =>
          engine.applyAction(accepted, f.seats[1].playerId, {
            type: 'endMovement',
          }),
        );
      const shipped = await act(f, 1, yes ? matching : smaller);
      assertSingleAnswer(f, shipped, yes);
      assert.equal(shipped.players[1].forces['carthag:11'], yes ? 6 : 5);
      assert.equal(shipped.players[1].spice, yes ? 4 : 5);
      assert.deepEqual(await restored(f), shipped);
    } finally {
      f.hooks.beforeWrite = undefined;
      f.sqlite.close();
    }
  }
});

void test('corrupt persisted promise records and pending shipment questions reject before any answer, discard or CAS write', async () => {
  const f = await fixture();
  try {
    await ask(f);
    const pending = await restored(f);
    const accepted = await act(f, 1, { type: 'truthAnswer', answer: 'yes' });
    const corruptions: ((g: engine.Game) => void)[] = [
      (g) => {
        g.shipmentPromises![0].minimum = 0;
      },
      (g) => {
        g.shipmentPromises![0].minimum = 1.5;
      },
      (g) => {
        g.shipmentPromises![0].turn = g.turn + 1;
      },
      (g) => {
        g.shipmentPromises![0].player = 'missing-seat';
      },
      (g) => {
        g.shipmentPromises![0].asker = g.shipmentPromises![0].player;
      },
      (g) => {
        g.shipmentPromises![0].territory = 'missing-territory';
      },
      (g) => {
        g.shipmentPromises![0].released = true;
        g.shipmentPromises![0].fulfilled = true;
      },
      (g) => {
        g.players[1].shipped = true;
      },
      (g) => {
        g.active = f.seats[2].playerId;
      },
      (g) => {
        g.phase = 6;
      },
      (g) => {
        g.advanced = true;
      },
      (g) => {
        g.expansions = ['ix'];
      },
    ];
    for (const corrupt of corruptions) {
      const bad = structuredClone(accepted);
      corrupt(bad);
      f.sqlite
        .prepare('UPDATE rooms SET state=?,version=? WHERE code=?')
        .run(JSON.stringify(bad), bad.version, f.code);
      assert.throws(
        () => engine.normalizeAutomaticGame(bad),
        /shipment promise/i,
      );
      for (const seat of f.seats)
        await assert.rejects(
          f.restart().readSeatView(f.code, seat),
          /shipment promise/i,
        );
      await rejectsWithoutWrite(
        f,
        1,
        { type: 'endMovement' },
        /shipment promise/i,
      );
    }
    const questionCorruptions: ((g: engine.Game) => void)[] = [
      (g) => {
        Object.assign(g.truthtrance!.question!, { minimum: 0 });
      },
      (g) => {
        Object.assign(g.truthtrance!.question!, { minimum: 1.5 });
      },
      (g) => {
        Object.assign(g.truthtrance!.question!, {
          target: f.seats[2].playerId,
        });
      },
      (g) => {
        g.truthtrance!.queue[0].player = 'missing-holder';
      },
      (g) => {
        g.truthtrance!.queue[0].card = 'missing-card';
      },
      (g) => {
        g.truthtrance!.queue[0] = {
          player: f.seats[2].playerId,
          card: g.players[2].hand[0].id,
        };
      },
    ];
    for (const corrupt of questionCorruptions) {
      const bad = structuredClone(pending);
      corrupt(bad);
      f.sqlite
        .prepare('UPDATE rooms SET state=?,version=? WHERE code=?')
        .run(JSON.stringify(bad), bad.version, f.code);
      await rejectsWithoutWrite(f, 1, { type: 'truthAnswer', answer: 'yes' });
      assert.throws(() => engine.normalizeAutomaticGame(bad));
      for (const seat of f.seats)
        await assert.rejects(f.restart().readSeatView(f.code, seat));
    }
  } finally {
    f.hooks.beforeWrite = undefined;
    f.sqlite.close();
  }
});

void test('older-turn and fulfilled shipment promises remain readable without reactivation, while absent legacy fields remain absent', async () => {
  const f = await fixture();
  try {
    const legacy = await restored(f);
    assert.equal(legacy.shipmentPromises, undefined);
    for (const seat of f.seats) {
      const view = await f.restart().readSeatView(f.code, seat);
      assert.deepEqual(view.shipmentPromises, []);
      assert.equal(view.shipmentCompletion, null);
    }
    assert.equal(
      (await f.restart().readRoom(f.code)).shipmentPromises,
      undefined,
    );
    await ask(f);
    await act(f, 1, { type: 'truthAnswer', answer: 'yes' });
    const accepted = await restored(f);
    const expired = structuredClone(accepted);
    expired.turn++;
    f.sqlite
      .prepare('UPDATE rooms SET state=?,version=? WHERE code=?')
      .run(JSON.stringify(expired), expired.version, f.code);
    const normalized = engine.normalizeAutomaticGame(expired);
    assert.deepEqual(normalized.shipmentPromises, expired.shipmentPromises);
    assert.deepEqual(normalized.truthHistory, expired.truthHistory);
    assert.deepEqual(engine.normalizeAutomaticGame(normalized), normalized);
    for (const seat of f.seats)
      assert.equal(
        (await f.restart().readSeatView(f.code, seat)).shipmentCompletion,
        null,
      );
    const newShipment = await act(f, 1, {
      type: 'ship',
      territory: 'carthag',
      sector: 11,
      amount: 5,
    });
    assert.equal(newShipment.players[1].forces['carthag:11'], 5);
    assert.deepEqual(newShipment.shipmentPromises, accepted.shipmentPromises);
    assert.deepEqual(newShipment.truthHistory, accepted.truthHistory);
    assert.deepEqual(inventory(newShipment), inventory(accepted));
    assert.deepEqual(await restored(f), newShipment);

    // A genuine completed record remains valid after leaving Shipment & Movement.
    f.sqlite
      .prepare('UPDATE rooms SET state=?,version=? WHERE code=?')
      .run(JSON.stringify(accepted), accepted.version, f.code);
    const completed = await act(f, 1, {
      type: 'ship',
      territory: 'carthag',
      sector: 11,
      amount: 6,
    });
    completed.phase = 6;
    f.sqlite
      .prepare('UPDATE rooms SET state=?,version=? WHERE code=?')
      .run(JSON.stringify(completed), completed.version, f.code);
    assert.equal(completed.shipmentPromises![0].fulfilled, true);
    for (const seat of f.seats) {
      const view = await f.restart().readSeatView(f.code, seat);
      assert.deepEqual(view.shipmentPromises, completed.shipmentPromises);
      assert.equal(view.shipmentCompletion, null);
    }
    assert.deepEqual(
      engine.normalizeAutomaticGame(completed).shipmentPromises,
      completed.shipmentPromises,
    );
    assert.deepEqual(await restored(f), completed);
  } finally {
    f.sqlite.close();
  }
});
