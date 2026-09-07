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
import type { TruthFact } from '../game/truthtrance';
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
  const made = await store.rooms.createRoom(
    'Question holder',
    'guild',
    false,
    [],
  );
  const code = made.view.code;
  const joined = await store.rooms.joinRoom(code, 'Question target', 'emperor');
  const observed = await store.rooms.joinRoom(
    code,
    'Question observer',
    'atreides',
  );
  const seats = await Promise.all(
    [made.token, joined.token!, observed.token!].map((token) =>
      store.rooms.authenticate(code, token),
    ),
  );
  const initial = await store.rooms.readRoom(code);
  Object.assign(initial, {
    status: 'playing',
    phase: 3,
    turn: 2,
    active: seats[1].playerId,
    order: seats.map((seat) => seat.playerId),
    storm: 18,
    deck: baseDeck(),
  });
  for (const p of initial.players) {
    p.hand = [];
    p.spice = 7;
    p.traitors = [p.leaders[0].id];
    p.traitorChoices = [];
  }
  const hold = (index: number, name: string) => {
    const at = initial.deck.findIndex((card) => card.name === name);
    assert.ok(at >= 0);
    const card = initial.deck.splice(at, 1)[0];
    initial.players[index].hand.push(card);
    return card;
  };
  const card = hold(0, 'Truthtrance');
  hold(1, 'Shield');
  hold(1, 'Karama'); // Both spice and card payment remain meaningful after the interrupt.
  hold(2, 'Lasgun');
  // Publicly committed/incoming resources are separate from the target's spendable seven spice.
  initial.players[1].bribes = 19;
  initial.players[1].ally = seats[2].playerId;
  initial.players[2].ally = seats[1].playerId;
  initial.aid = {
    [seats[2].playerId]: { recipient: seats[1].playerId, amount: 13 },
    [seats[1].playerId]: { recipient: seats[2].playerId, amount: 5 },
  };
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
async function ask(f: Fixture, fact: TruthFact) {
  await act(f, 0, { type: 'card', card: f.card.id });
  for (const index of [1, 2]) await act(f, index, { type: 'truthPass' });
  return act(f, 0, {
    type: 'truthAsk',
    question: { kind: 'fact', target: f.seats[1].playerId, fact },
  });
}
async function restored(f: Fixture) {
  const before = await f.restart().readRoom(f.code);
  const writes = f.writes.length;
  await f.restart().continueRoomAutomatic(f.code, clock);
  assert.equal(
    f.writes.length,
    writes,
    'A pending Truthtrance cannot pay the suspended auction automatically.',
  );
  assert.deepEqual(await f.restart().readRoom(f.code), before);
  return before;
}
function assertSuspended(f: Fixture, g: engine.Game) {
  for (const key of [
    'auction',
    'decision',
    'aid',
    'turn',
    'phase',
    'active',
  ] as const)
    assert.deepEqual(g[key], f.initial[key], key);
  for (const [index, p] of g.players.entries()) {
    assert.equal(p.spice, f.initial.players[index].spice);
    assert.equal(p.bribes, f.initial.players[index].bribes);
    if (index !== 0) assert.deepEqual(p.hand, f.initial.players[index].hand);
  }
}
function inventory(g: engine.Game) {
  return [
    ...g.deck,
    ...g.discard,
    ...(g.auction?.cards ?? []),
    ...g.players.flatMap((p) => p.hand),
  ]
    .map((card) => card.id)
    .sort();
}
async function assertPrivate(f: Fixture, expected: 'yes' | 'no' | null) {
  const state = await f.restart().readRoom(f.code);
  for (const [index, seat] of f.seats.entries()) {
    const view = await f.restart().readSeatView(f.code, seat);
    assert.equal(view.truthAnswer, index === 1 ? expected : null);
    for (const p of view.players.filter((p) => p.id !== seat.playerId))
      for (const key of [
        'spice',
        'hand',
        'traitors',
        'traitorChoices',
        'bribes',
      ])
        assert.equal(key in p, false, `Other seat disclosed ${key}`);
    assert.deepEqual(
      view.players.find((p) => p.id === seat.playerId)!.hand,
      state.players[index].hand,
    );
    assert.deepEqual(view.truthtrance, state.truthtrance ?? null);
    assert.deepEqual(view.truthHistory, state.truthHistory ?? []);
    assert.equal('deck' in view, false);
  }
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

void test('spice facts restore only the target answer and preserve an interrupted auction and payment without including incoming resources', async () => {
  for (const [compare, value, answer] of [
    ['eq', 7, 'yes'],
    ['gte', 8, 'no'],
    ['lte', 7, 'yes'],
  ] as const) {
    const f = await fixture();
    try {
      await ask(f, { kind: 'spice', compare, value });
      const pending = await restored(f);
      assertSuspended(f, pending);
      assert.deepEqual(
        pending.players.map((p) => p.hand),
        f.initial.players.map((p) => p.hand),
      );
      await assertPrivate(f, answer);
      const before = structuredClone(pending);
      for (const index of [0, 2])
        await assert.rejects(
          f
            .restart()
            .act(
              f.code,
              f.seats[index],
              before.version,
              { type: 'truthAnswer', answer },
              clock,
            ),
          /questioned player/,
        );
      assert.deepEqual(await f.restart().readRoom(f.code), before);
      const done = await act(f, 1, { type: 'truthAnswer', answer });
      assertSuspended(f, done);
      assert.equal(done.truthtrance, null);
      assert.equal(done.truthHistory!.length, 1);
      assert.equal(done.truthHistory![0].answer, answer);
      assert.deepEqual(inventory(done), inventory(f.initial));
      assert.equal(
        done.discard.filter((card) => card.id === f.card.id).length,
        1,
      );
      await restored(f);
      await assertPrivate(f, null);
    } finally {
      f.sqlite.close();
    }
  }
});

void test('recovered AND/OR spice questions expose one aggregate answer without identifying the matching private clause', async () => {
  for (const kind of ['and', 'or'] as const) {
    const f = await fixture();
    try {
      const fact: TruthFact = {
        kind,
        terms: [
          { kind: 'spice', compare: 'gte', value: 8 },
          { kind: 'hand', name: 'Shield' },
        ],
      };
      await ask(f, fact);
      const pending = await restored(f);
      const answer = kind === 'or' ? 'yes' : 'no';
      await assertPrivate(f, answer);
      // Swap which clause is true while preserving the aggregate and public card count.
      const alternative = structuredClone(pending);
      alternative.players[1].spice = 11;
      const shield = alternative.players[1].hand[0];
      const replacementIndex = alternative.deck.findIndex(
        (card) => card.kind === 'poison',
      );
      assert.ok(replacementIndex >= 0);
      const replacement = alternative.deck[replacementIndex];
      alternative.deck[replacementIndex] = shield;
      alternative.players[1].hand[0] = replacement;
      assert.notEqual(shield.name, replacement.name);
      assert.deepEqual(inventory(alternative), inventory(pending));
      for (const index of [0, 2])
        assert.deepEqual(
          engine.viewGame(alternative, f.seats[index].playerId),
          engine.viewGame(pending, f.seats[index].playerId),
        );
      assert.equal(
        engine.viewGame(alternative, f.seats[1].playerId).truthAnswer,
        answer,
      );
      const done = await act(f, 1, { type: 'truthAnswer', answer });
      assert.deepEqual(done.truthHistory, [
        {
          turn: pending.turn,
          phase: pending.phase,
          asker: f.seats[0].playerId,
          question: pending.truthtrance!.question!,
          answer,
        },
      ]);
      assertSuspended(f, done);
      await assertPrivate(f, null);
    } finally {
      f.sqlite.close();
    }
  }
});

void test('dishonest recovered spice answers write nothing; racing truthful answers commit one history and one physical discard', async () => {
  const f = await fixture();
  try {
    await ask(f, { kind: 'spice', compare: 'eq', value: 7 });
    const before = await restored(f);
    const writeCount = f.writes.length;
    for (const answer of ['no', 'unknown']) {
      await assert.rejects(
        f
          .restart()
          .act(
            f.code,
            f.seats[1],
            before.version,
            { type: 'truthAnswer', answer },
            clock,
          ),
        /truthfully/,
      );
      assert.deepEqual(await f.restart().readRoom(f.code), before);
      assert.equal(f.writes.length, writeCount);
    }
    f.writes.length = 0;
    f.hooks.beforeWrite = barrier();
    const action = { type: 'truthAnswer', answer: 'yes' };
    const outcomes = await Promise.allSettled([
      f.rooms.act(f.code, f.seats[1], before.version, action, clock),
      f.restart().act(f.code, f.seats[1], before.version, action, clock),
    ]);
    f.hooks.beforeWrite = undefined;
    assert.equal(
      outcomes.filter((result) => result.status === 'fulfilled').length,
      1,
    );
    assert.equal(
      outcomes.filter((result) => result.status === 'rejected').length,
      1,
    );
    assert.deepEqual(
      f.writes.map((write) => write.changes).sort((a, b) => a - b),
      [0, 1],
    );
    const after = await f.restart().readRoom(f.code);
    assert.equal(after.version, before.version + 1);
    assert.equal(after.truthHistory!.length, 1);
    assert.equal(after.truthHistory![0].answer, 'yes');
    assert.equal(
      after.discard.filter((card) => card.id === f.card.id).length,
      1,
    );
    assert.equal(
      after.players[0].hand.some((card) => card.id === f.card.id),
      false,
    );
    assert.deepEqual(inventory(after), inventory(before));
    assertSuspended(f, after);
    const committedWrites = f.writes.length;
    for (const version of [before.version, after.version])
      await assert.rejects(
        f.restart().act(f.code, f.seats[1], version, action, clock),
      );
    assert.equal(f.writes.length, committedWrites);
    assert.deepEqual(await restored(f), after);
    await assertPrivate(f, null);
  } finally {
    f.hooks.beforeWrite = undefined;
    f.sqlite.close();
  }
});

void test('an existing structured hand fact remains answerable after room-module restart without rewriting the question or suspended auction', async () => {
  const f = await fixture();
  try {
    const fact: TruthFact = { kind: 'hand', name: 'Shield' };
    await ask(f, fact);
    const before = await restored(f);
    assert.deepEqual(before.truthtrance!.question, {
      kind: 'fact',
      target: f.seats[1].playerId,
      fact,
    });
    await assertPrivate(f, 'yes');
    const after = await act(f, 1, { type: 'truthAnswer', answer: 'yes' });
    assertSuspended(f, after);
    assert.equal(after.truthHistory!.length, 1);
    assert.deepEqual(
      after.truthHistory![0].question,
      before.truthtrance!.question,
    );
    assert.deepEqual(inventory(after), inventory(before));
    await restored(f);
  } finally {
    f.sqlite.close();
  }
});

void test('hand-count questions restore physical duplicate counts and expose the definite answer only to the target', async () => {
  for (const [compare, value, answer] of [
    ['eq', 2, 'yes'],
    ['gte', 3, 'no'],
    ['lte', 2, 'yes'],
  ] as const) {
    const f = await fixture();
    try {
      const secondShield = f.initial.deck.findIndex(
        (card) => card.name === 'Shield',
      );
      assert.ok(secondShield >= 0);
      f.initial.players[1].hand.push(f.initial.deck.splice(secondShield, 1)[0]);
      f.sqlite
        .prepare('UPDATE rooms SET state=? WHERE code=?')
        .run(JSON.stringify(f.initial), f.code);
      const fact: TruthFact = {
        kind: 'handCount',
        name: 'Shield',
        compare,
        value,
      };
      await ask(f, fact);
      const pending = await restored(f);
      assertSuspended(f, pending);
      assert.deepEqual(pending.truthtrance!.question, {
        kind: 'fact',
        target: f.seats[1].playerId,
        fact,
      });
      await assertPrivate(f, answer);

      // Equal-sized hidden hands with different Shield multiplicity must be
      // indistinguishable to both the asker and the target's ally.
      const alternative = structuredClone(pending);
      const replacementIndex = alternative.deck.findIndex(
        (card) => card.kind === 'poison',
      );
      assert.ok(replacementIndex >= 0);
      const shieldIndex = alternative.players[1].hand.findIndex(
        (card) => card.name === 'Shield',
      );
      const shield = alternative.players[1].hand[shieldIndex];
      alternative.players[1].hand[shieldIndex] =
        alternative.deck[replacementIndex];
      alternative.deck[replacementIndex] = shield;
      assert.deepEqual(inventory(alternative), inventory(pending));
      for (const index of [0, 2])
        assert.deepEqual(
          engine.viewGame(alternative, f.seats[index].playerId),
          engine.viewGame(pending, f.seats[index].playerId),
        );
      if (compare === 'eq')
        assert.equal(
          engine.viewGame(alternative, f.seats[1].playerId).truthAnswer,
          'no',
        );

      const done = await act(f, 1, { type: 'truthAnswer', answer });
      assert.equal(done.truthtrance, null);
      assert.deepEqual(done.truthHistory, [
        {
          turn: pending.turn,
          phase: pending.phase,
          asker: f.seats[0].playerId,
          question: pending.truthtrance!.question!,
          answer,
        },
      ]);
      assert.equal(
        done.discard.filter((card) => card.id === f.card.id).length,
        1,
      );
      assert.deepEqual(inventory(done), inventory(f.initial));
      assertSuspended(f, done);
      assert.deepEqual(await restored(f), done);
      await assertPrivate(f, null);
    } finally {
      f.sqlite.close();
    }
  }
});

void test('recovered hand-count answers reject dishonest or wrong-seat requests and concurrent truthful answers commit exactly once', async () => {
  const f = await fixture();
  try {
    await ask(f, {
      kind: 'handCount',
      name: 'Shield',
      compare: 'eq',
      value: 1,
    });
    const before = await restored(f);
    await assertPrivate(f, 'yes');
    const writeCount = f.writes.length;
    for (const index of [0, 2])
      await assert.rejects(
        f
          .restart()
          .act(
            f.code,
            f.seats[index],
            before.version,
            { type: 'truthAnswer', answer: 'yes' },
            clock,
          ),
        /questioned player/,
      );
    for (const answer of ['no', 'unknown'])
      await assert.rejects(
        f
          .restart()
          .act(
            f.code,
            f.seats[1],
            before.version,
            { type: 'truthAnswer', answer },
            clock,
          ),
        /truthfully/,
      );
    assert.equal(f.writes.length, writeCount);
    assert.deepEqual(await f.restart().readRoom(f.code), before);

    f.writes.length = 0;
    f.hooks.beforeWrite = barrier();
    const action = { type: 'truthAnswer', answer: 'yes' };
    const outcomes = await Promise.allSettled([
      f.rooms.act(f.code, f.seats[1], before.version, action, clock),
      f.restart().act(f.code, f.seats[1], before.version, action, clock),
    ]);
    f.hooks.beforeWrite = undefined;
    assert.equal(
      outcomes.filter((result) => result.status === 'fulfilled').length,
      1,
    );
    assert.equal(
      outcomes.filter((result) => result.status === 'rejected').length,
      1,
    );
    assert.deepEqual(
      f.writes.map((write) => write.changes).sort((a, b) => a - b),
      [0, 1],
    );
    const after = await f.restart().readRoom(f.code);
    assert.equal(after.version, before.version + 1);
    assert.equal(after.truthtrance, null);
    assert.deepEqual(after.truthHistory, [
      {
        turn: before.turn,
        phase: before.phase,
        asker: f.seats[0].playerId,
        question: before.truthtrance!.question!,
        answer: 'yes',
      },
    ]);
    assert.equal(
      after.discard.filter((card) => card.id === f.card.id).length,
      1,
    );
    assert.equal(
      after.players[0].hand.some((card) => card.id === f.card.id),
      false,
    );
    assert.deepEqual(inventory(after), inventory(before));
    assertSuspended(f, after);
    const committedWrites = f.writes.length;
    for (const version of [before.version, after.version])
      await assert.rejects(
        f.restart().act(f.code, f.seats[1], version, action, clock),
      );
    assert.equal(f.writes.length, committedWrites);
    assert.deepEqual(await restored(f), after);
    await assertPrivate(f, null);
  } finally {
    f.hooks.beforeWrite = undefined;
    f.sqlite.close();
  }
});
