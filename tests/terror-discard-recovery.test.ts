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
import { createTerrorState, placeTerror } from '../game/moritani-terror';

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

type Kind = 'sabotage' | 'robberyOverflow';
async function fixture(kind: Kind, gift = true) {
  const store = unitStore();
  const created = await store.rooms.createRoom(
    'Moritani fixture seat',
    'guild',
    false,
    [],
  );
  const code = created.view.code;
  const joined = await store.rooms.joinRoom(code, 'Entrant', 'emperor');
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
  const [owner, entrant, witness] = seats.map((s) => s.playerId);
  // Internal expansion fixture only; room credentials and subsequent shipment,
  // reveal, draw and discard actions all use the actual production code.
  g.players[0] = engine.newPlayer(owner, 'Moritani', 'moritani');
  Object.assign(g, {
    turn: 2,
    phase: 5,
    storm: 18,
    active: entrant,
    order: [entrant, owner, witness],
    movementRemaining: [entrant, owner, witness],
    deck: baseDeck(),
    discard: [],
    decision: null,
    response: null,
    phaseOpening: null,
    ready: [],
  });
  for (const p of g.players) {
    p.hand = [];
    p.forces = {};
    p.reserves = 20;
    p.spice = 20;
    p.traitors = [];
    p.shipped = false;
    p.moved = 0;
  }
  g.players[0].hand.push(
    ...g.deck.splice(0, kind === 'robberyOverflow' ? 4 : gift ? 2 : 0),
  );
  g.players[1].hand.push(...g.deck.splice(0, kind === 'sabotage' ? 3 : 0));
  const originalVictimHand = structuredClone(g.players[1].hand);
  const overflowSelection = g.players[0].hand[0]?.id;
  const originalTop = g.deck[0].id;
  const physicalIds = inventory(g);
  g.moritaniTerror = createTerrorState(() => 0);
  const token = g.moritaniTerror.tokens.find(
    (t) => t.kind === (kind === 'sabotage' ? 'sabotage' : 'robbery'),
  )!;
  g.moritaniTerror = placeTerror(g.moritaniTerror, token.id, 'arrakeen', 1);
  const save = (state: engine.Game) =>
    store.sqlite
      .prepare('UPDATE rooms SET state=?,version=? WHERE code=?')
      .run(JSON.stringify(state), state.version, code);
  save(g);
  await act(1, { type: 'ship', territory: 'arrakeen', sector: 10, amount: 2 });
  g = await store.restart().readRoom(code);
  assert.equal(g.pendingTerrorEntry?.stage, 'offer');
  assert.equal(g.players[1].spice, 18);
  if (kind === 'robberyOverflow') {
    await act(0, { type: 'decision', reveal: true });
    await act(0, { type: 'decision', choice: 'card' });
    g = await store.restart().readRoom(code);
    assert.equal(g.players[0].hand.length, 5);
    assert.ok(g.players[0].hand.some((c) => c.id === originalTop));
    assert.equal(g.pendingTerrorEntry?.stage, 'discard');
  }
  const beforeDiscard = structuredClone(g);
  g = inner(
    g,
    owner,
    kind === 'sabotage'
      ? { type: 'decision', reveal: true }
      : { type: 'decision', card: overflowSelection },
  );
  assert.equal(g.pendingTreacheryDiscard?.continuation.kind, 'terrorDiscard');
  assert.equal(g.pendingTreacheryDiscard!.batch.cause, `terror:${kind}`);
  assert.equal(g.pendingTerrorEntry, null);
  assert.equal(g.decision, null);
  assert.equal(g.pendingTreacheryDiscard!.batch.entries.length, 1);
  assert.equal(g.pendingTreacheryDiscard!.batch.entries[0].publicFace, false);
  assert.equal(
    g.pendingTreacheryDiscard!.batch.entries[0].discardedBy,
    kind === 'sabotage' ? entrant : owner,
  );
  save(g);
  store.writes.length = 0;
  return {
    ...store,
    code,
    seats,
    tokens,
    initial: g,
    save,
    kind,
    gift,
    physicalIds,
    originalVictimHand,
    originalTop,
    overflowSelection,
    beforeDiscard,
    tokenId: token.id,
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
async function privateRead(f: Fixture) {
  const discarded = f.initial.pendingTreacheryDiscard!.batch.entries[0].card;
  for (const [index, token] of f.tokens.entries()) {
    const auth = await f.restart().authenticate(f.code, token);
    const view = await f.restart().readSeatView(f.code, auth);
    assert.equal(view.automaticContinuationPending, true);
    assert.equal(f.restart().needsAutomaticRoomRecovery(view), true);
    assert.equal(view.terrorEntry, null);
    for (const field of [
      'pendingTreacheryDiscard',
      'treacheryDiscardSequence',
      'resolvedTreacheryDiscardSequence',
    ])
      assert.equal(Object.hasOwn(view, field), false);
    for (const [seat, p] of view.players.entries())
      assert.deepEqual(
        p.hand,
        seat === index ? f.initial.players[seat].hand : undefined,
      );
    assert.equal(
      JSON.stringify(view).includes(discarded.id),
      false,
      'no seat receives a fresh private discard identity',
    );
  }
  assert.deepEqual(await f.restart().readRoom(f.code), f.initial);
  assert.equal(f.writes.length, 0);
}
async function race(f: Fixture) {
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
  const done = await f.restart().readRoom(f.code);
  assert.deepEqual(
    f.writes.map((w) => w.changes).sort((a, b) => a - b),
    [0, 1],
  );
  assert.equal(done.version, f.initial.version + 1);
  assert.equal(done.pendingTreacheryDiscard, null);
  assert.equal(
    done.resolvedTreacheryDiscardSequence,
    f.initial.treacheryDiscardSequence,
  );
  assert.deepEqual(done.deck, f.initial.deck);
  assert.deepEqual(done.discard, f.initial.discard);
  assert.deepEqual(done.players, f.initial.players);
  assert.deepEqual(done.moritaniTerror, f.initial.moritaniTerror);
  assert.deepEqual(inventory(done), f.physicalIds);
  await f.restart().continueRoomAutomatic(f.code, clock);
  assert.deepEqual(await f.restart().readRoom(f.code), done);
  assert.equal(f.writes.length, 2);
  return done;
}
void test('actual random Sabotage discard survives private reconnect and competing SQL workers without a reroll or repeated entry', async () => {
  for (const gift of [true, false]) {
    const f = await fixture('sabotage', gift);
    try {
      await privateRead(f);
      const victim = f.initial.discard[0].id;
      assert.ok(f.originalVictimHand.some((c) => c.id === victim));
      assert.equal(f.initial.players[1].hand.length, 2);
      assert.equal(
        f.initial.moritaniTerror!.tokens.find((t) => t.id === f.tokenId)!
          .status,
        'removed',
      );
      const done = await race(f);
      assert.equal(
        done.pendingTerrorEntry?.stage ?? null,
        gift ? 'gift' : null,
      );
      assert.equal(done.decision?.kind ?? null, gift ? 'moritaniTerror' : null);
      assert.equal(done.players[1].forces['arrakeen:10'], 2);
      assert.equal(done.players[1].reserves, 18);
      assert.equal(done.players[1].spice, 18);
      assert.equal(
        done.log.filter((l) =>
          l.text.includes('discarded a random Treachery card to Sabotage'),
        ).length,
        1,
      );
      assert.equal(
        done.log.filter((l) => l.text.includes('revealed Sabotage')).length,
        1,
      );
      if (gift) {
        const card = done.players[0].hand[0].id;
        await f
          .restart()
          .act(
            f.code,
            f.seats[0],
            done.version,
            { type: 'decision', card },
            clock,
          );
        const given = await f.restart().readRoom(f.code);
        assert.ok(given.players[1].hand.some((c) => c.id === card));
        assert.deepEqual(given.discard, done.discard);
        assert.equal(
          given.treacheryDiscardSequence,
          done.treacheryDiscardSequence,
        );
        assert.equal(given.pendingTerrorEntry, null);
      }
    } finally {
      f.sqlite.close();
    }
  }
});
void test('actual five-to-four Robbery overflow resumes once without a second draw or spice theft', async () => {
  const f = await fixture('robberyOverflow');
  try {
    await privateRead(f);
    assert.equal(f.beforeDiscard.players[0].hand.length, 5);
    assert.equal(f.initial.players[0].hand.length, 4);
    assert.equal(f.initial.discard[0].id, f.overflowSelection);
    assert.ok(f.initial.players[0].hand.some((c) => c.id === f.originalTop));
    await assert.rejects(
      f
        .restart()
        .act(
          f.code,
          f.seats[1],
          f.initial.version,
          { type: 'decision', choice: 'spice' },
          clock,
        ),
      /committed discard/,
    );
    assert.equal(f.writes.length, 0);
    const done = await race(f);
    assert.equal(done.pendingTerrorEntry, null);
    assert.equal(done.decision, null);
    assert.equal(done.players[0].spice, 20);
    assert.equal(done.players[1].spice, 18);
    assert.equal(
      done.log.filter((l) =>
        l.text.includes('drew a Treachery card through Robbery'),
      ).length,
      1,
    );
    assert.equal(
      done.log.filter((l) =>
        l.text.includes('discarded a card after the Robbery draw'),
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
          { type: 'decision', card: f.overflowSelection },
          clock,
        ),
      /table changed/,
    );
    await assert.rejects(
      f
        .restart()
        .act(
          f.code,
          f.seats[0],
          done.version,
          { type: 'decision', choice: 'card' },
          clock,
        ),
    );
    assert.deepEqual(await f.restart().readRoom(f.code), done);
  } finally {
    f.sqlite.close();
  }
});
void test('corrupt forced-discard owner, parent, token, count and custody fail before persistence', async () => {
  for (const kind of ['sabotage', 'robberyOverflow'] as const) {
    const f = await fixture(kind);
    try {
      const continuation = (g: engine.Game) => {
        const c = g.pendingTreacheryDiscard!.continuation;
        assert.equal(c.kind, 'terrorDiscard');
        if (c.kind !== 'terrorDiscard')
          throw Error('Missing Terror continuation');
        return c;
      };
      const corruptions: ((g: engine.Game) => void)[] = [
        (g) => {
          g.pendingTreacheryDiscard!.batch.event = 'old-discard';
        },
        (g) => {
          continuation(g).owner = f.seats[1].playerId;
        },
        (g) => {
          continuation(g).entry.turn--;
        },
        (g) => {
          continuation(g).discardedHandSize = 0;
        },
        (g) => {
          g.moritaniTerror!.tokens.find((t) => t.id === f.tokenId)!.status =
            'placed';
        },
        (g) => {
          g.deck.push(structuredClone(g.discard[0]));
        },
      ];
      for (const corrupt of corruptions) {
        const bad = structuredClone(f.initial);
        corrupt(bad);
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
  }
});
void test('retired forced-discard frames cannot be replayed at the latest room version', async () => {
  for (const kind of ['sabotage', 'robberyOverflow'] as const) {
    const f = await fixture(kind, false);
    try {
      const done = await race(f);
      const replay = structuredClone(done);
      replay.pendingTreacheryDiscard = structuredClone(
        f.initial.pendingTreacheryDiscard,
      );
      f.save(replay);
      const beforeWrites = f.writes.length;
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
      assert.equal(f.writes.length, beforeWrites);
    } finally {
      f.sqlite.close();
    }
  }
});
