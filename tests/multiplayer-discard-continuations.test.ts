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
import { createAmbassadors } from '../game/ecaz-ambassadors';

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

type Kind = 'ixians' | 'choam' | 'ixAllyCard';
async function fixture(kind: Kind, emptyDeck = false) {
  const store = unitStore();
  const created = await store.rooms.createRoom('Owner', 'guild', false, []);
  const code = created.view.code;
  const second = await store.rooms.joinRoom(code, 'Emperor', 'emperor');
  const third = await store.rooms.joinRoom(code, 'Observer', 'atreides');
  const tokens = [created.token, second.token!, third.token!];
  const seats = await Promise.all(
    tokens.map((token) => store.restart().authenticate(code, token)),
  );
  async function act(index: number, action: engine.Action) {
    const g = await store.restart().readRoom(code);
    await store.restart().act(code, seats[index], g.version, action, clock);
  }
  for (const index of [0, 1, 2]) await act(index, { type: 'ready' });
  await act(0, { type: 'start' });
  const started = await store.restart().readRoom(code);
  for (const [index, p] of started.players.entries())
    if (p.traitorChoices.length)
      await act(index, { type: 'traitor', leader: p.traitorChoices[0] });
  const g = await store.restart().readRoom(code);
  assert.equal(g.status, 'playing');
  Object.assign(g, {
    turn: 2,
    phase: kind === 'ixAllyCard' ? 3 : 5,
    storm: 18,
    order: seats.map((s) => s.playerId),
    active: seats[2].playerId,
    response: null,
    decision: null,
    phaseOpening: null,
    pendingAmbassador: null,
    pendingIxAlly: null,
    deck: baseDeck(),
    discard: [],
    treacheryDiscardSequence: 1,
    resolvedTreacheryDiscardSequence: 0,
  });
  for (const p of g.players) {
    p.hand = [];
    p.forces = {};
    p.reserves = 20;
    p.spice = 20;
  }
  const count = kind === 'choam' ? 2 : 1;
  const discarded = g.deck.splice(0, count);
  const replacement = emptyDeck ? discarded[0] : g.deck[0];
  if (emptyDeck) g.deck = [];
  g.discard = discarded;
  const event = `discard:${g.turn}:${g.phase}:1`;
  const entries = discarded.map((card) => ({
    card,
    discardedBy: seats[0].playerId,
    publicFace: false,
  }));
  // Explicit persisted-stage fixture: the originating effect already removed
  // the selected cards and committed any prefix payment. Production action
  // wrappers normally drain this frame immediately. We save the exact internal
  // pre-draw frame to exercise recovery rather than pretending Semuta is live.
  if (kind === 'ixAllyCard') {
    g.players[2].faction = 'ixians';
    g.players[0].ally = seats[2].playerId;
    g.players[2].ally = seats[0].playerId;
    g.players[0].spice = 17; // purchase paid; Emperor income is still in suffix
    g.auction = {
      cards: [discarded[0]],
      index: 0,
      bid: 3,
      bidder: seats[0].playerId,
      active: seats[0].playerId,
      passed: seats.slice(1).map((s) => s.playerId),
      opener: 0,
      peekKnown: false,
    };
    g.currentAuctionSale = {
      winner: seats[0].playerId,
      amount: 3,
      free: false,
      origin: 'normal',
      seller: null,
    };
    g.active = seats[0].playerId;
    g.pendingTreacheryDiscard = {
      sequence: 1,
      batch: {
        event,
        turn: g.turn,
        phase: g.phase,
        cause: 'ixAllyCard',
        entries,
      },
      continuation: {
        kind: 'ixAllyCard',
        player: seats[0].playerId,
        card: discarded[0].id,
        free: false,
        sale: structuredClone(g.currentAuctionSale),
        auctionIndex: 0,
        auctionEvent: null,
      },
    };
  } else {
    g.players[0].faction = 'ecaz';
    g.movementRemaining = [
      seats[2].playerId,
      seats[0].playerId,
      seats[1].playerId,
    ];
    g.players[2].forces = { 'arrakeen:10': 2 };
    g.players[2].reserves = 18;
    g.players[2].shipped = true;
    g.players[2].spice = 18;
    const inventory = createAmbassadors(() => 0);
    const chosen = inventory.tokens.find((t) => t.effect === kind)!;
    inventory.cohort = [
      chosen.id,
      ...inventory.tokens
        .filter((t) => t.id !== chosen.id && t.effect !== 'ecaz')
        .slice(0, 4)
        .map((t) => t.id),
    ];
    for (const token of inventory.tokens)
      token.zone =
        token.id === chosen.id
          ? 'used'
          : token.effect === 'ecaz' || inventory.cohort.includes(token.id)
            ? 'supply'
            : 'pool';
    g.ecazAmbassadors = inventory;
    if (kind === 'choam') g.players[0].spice += 3 * count;
    g.pendingTreacheryDiscard = {
      sequence: 1,
      batch: {
        event,
        turn: g.turn,
        phase: g.phase,
        cause: `ambassador:${kind}`,
        entries,
      },
      continuation: {
        kind: 'ambassador',
        entry: {
          event: `ambassador:${g.turn}:${g.phase}:saved`,
          owner: seats[0].playerId,
          entrant: seats[2].playerId,
          token: chosen.id,
          territory: 'arrakeen',
          sector: 10,
          turn: g.turn,
          phase: g.phase,
          stage: 'cards',
          beneficiary: seats[0].playerId,
          effect: kind,
          copyChoices: [],
          resume: 'none',
        },
      },
    };
  }
  const save = (state: engine.Game) =>
    store.sqlite
      .prepare('UPDATE rooms SET state=?,version=? WHERE code=?')
      .run(JSON.stringify(state), state.version, code);
  save(g);
  store.writes.length = 0;
  return {
    ...store,
    code,
    seats,
    tokens,
    initial: g,
    save,
    replacement,
    discarded,
    kind,
  };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;

async function privateRead(f: Fixture) {
  const auth = await f.restart().authenticate(f.code, f.tokens[1]);
  const view = await f.restart().readSeatView(f.code, auth);
  assert.equal(Object.hasOwn(view, 'pendingTreacheryDiscard'), false);
  assert.equal(Object.hasOwn(view, 'treacheryDiscardSequence'), false);
  assert.equal(Object.hasOwn(view, 'resolvedTreacheryDiscardSequence'), false);
  assert.equal(view.players[0].hand, undefined);
  for (const card of f.discarded)
    assert.equal(
      JSON.stringify(view).includes(card.id),
      false,
      'private batch face must not enter observer projection',
    );
  return view;
}
function settled(f: Fixture, g: engine.Game) {
  assert.equal(g.pendingTreacheryDiscard, null);
  assert.equal(g.resolvedTreacheryDiscardSequence, 1);
  assert.equal(g.treacheryDiscardSequence, 1);
  assert.equal(g.version, f.initial.version + 1);
  assert.equal(
    g.players[0].spice,
    f.kind === 'choam' ? 26 : f.kind === 'ixAllyCard' ? 17 : 20,
  );
  assert.equal(g.players[0].hand.length, f.kind === 'choam' ? 0 : 1);
  if (f.kind !== 'choam')
    assert.equal(g.players[0].hand[0].id, f.replacement.id);
  if (f.kind === 'ixAllyCard') {
    assert.equal(g.players[1].spice, 23);
    assert.equal(g.phase, 4);
    assert.equal(g.currentAuctionSale, null);
    assert.equal(
      g.log.filter((l) => l.text.includes('discarded the purchased card'))
        .length,
      1,
    );
  } else {
    assert.equal(g.phase, 5);
    assert.equal(g.pendingAmbassador, null);
    assert.equal(g.players[2].forces['arrakeen:10'], 2);
    assert.equal(g.players[2].spice, 18);
  }
}

void test('fresh authenticated reads recover each committed discard frame through one real SQL version update', async () => {
  for (const kind of ['ixians', 'choam', 'ixAllyCard'] as const) {
    const f = await fixture(kind);
    try {
      const view = await privateRead(f);
      assert.equal(
        f.restart().needsAutomaticRoomRecovery(view),
        true,
        'authenticated route projection must schedule the hidden continuation',
      );
      assert.deepEqual(await f.restart().readRoom(f.code), f.initial);
      assert.equal(f.writes.length, 0);
      await assert.rejects(
        f
          .restart()
          .act(f.code, f.seats[2], f.initial.version, { type: 'ready' }, clock),
        /committed discard/,
      );
      assert.equal(f.writes.length, 0);
      await f.restart().continueRoomAutomatic(f.code, clock);
      const after = await f.restart().readRoom(f.code);
      settled(f, after);
      await privateRead(f);
      const ownAuth = await f.restart().authenticate(f.code, f.tokens[0]);
      const own = await f.restart().readSeatView(f.code, ownAuth);
      assert.deepEqual(own.players[0].hand, after.players[0].hand);
      await assert.rejects(
        f
          .restart()
          .act(f.code, f.seats[2], f.initial.version, { type: 'ready' }, clock),
        /table changed/,
      );
      await f.restart().continueRoomAutomatic(f.code, clock);
      assert.deepEqual(await f.restart().readRoom(f.code), after);
      assert.equal(f.writes.length, 1);
    } finally {
      f.sqlite.close();
    }
  }
});

void test('two recovery workers race at the production CAS without duplicate replacement draw or income', async () => {
  for (const kind of ['ixians', 'choam', 'ixAllyCard'] as const) {
    const f = await fixture(kind);
    try {
      let resolve!: () => void;
      const both = new Promise<void>((done) => {
        resolve = done;
      });
      let arrivals = 0;
      f.hooks.beforeWrite = async () => {
        if (++arrivals === 2) resolve();
        await both;
      };
      await Promise.all([
        f.restart().continueRoomAutomatic(f.code, clock),
        f.restart().continueRoomAutomatic(f.code, clock),
      ]);
      const after = await f.restart().readRoom(f.code);
      settled(f, after);
      assert.deepEqual(
        f.writes.map((w) => w.changes).sort((a, b) => a - b),
        [0, 1],
      );
      await f.restart().continueRoomAutomatic(f.code, clock);
      assert.deepEqual(await f.restart().readRoom(f.code), after);
      assert.equal(f.writes.length, 2);
    } finally {
      f.sqlite.close();
    }
  }
});

void test('empty-deck recovery retires the frame before refilling from its actual discard, once', async () => {
  for (const kind of ['ixians', 'ixAllyCard'] as const) {
    const f = await fixture(kind, true);
    try {
      assert.deepEqual(f.initial.deck, []);
      assert.deepEqual(f.initial.players[0].hand, []);
      assert.equal(f.initial.discard.length, 1);
      await f.restart().continueRoomAutomatic(f.code, clock);
      const after = await f.restart().readRoom(f.code);
      settled(f, after);
      assert.deepEqual(after.discard, []);
      assert.deepEqual(after.deck, []);
      assert.equal(
        after.players[0].hand.filter((c) => c.id === f.discarded[0].id).length,
        1,
      );
      await f.restart().continueRoomAutomatic(f.code, clock);
      assert.deepEqual(await f.restart().readRoom(f.code), after);
    } finally {
      f.sqlite.close();
    }
  }
});

void test('malformed persisted bindings reject recovery and gameplay without writing a repaired or replayed state', async () => {
  const f = await fixture('ixians');
  try {
    for (const corrupt of [
      (g: engine.Game) => {
        g.pendingTreacheryDiscard!.batch.event = 'old-discard';
      },
      (g: engine.Game) => {
        g.resolvedTreacheryDiscardSequence = 1;
      },
      (g: engine.Game) => {
        g.deck.push(g.discard[0]);
      },
      (g: engine.Game) => {
        g.pendingTreacheryDiscard!.batch.entries[0].discardedBy =
          f.seats[2].playerId;
      },
    ]) {
      const g = structuredClone(f.initial);
      corrupt(g);
      f.save(g);
      await assert.rejects(f.restart().continueRoomAutomatic(f.code, clock));
      await assert.rejects(
        f
          .restart()
          .act(f.code, f.seats[0], g.version, { type: 'ready' }, clock),
      );
      assert.deepEqual(await f.restart().readRoom(f.code), g);
      assert.equal(f.writes.length, 0);
    }
  } finally {
    f.sqlite.close();
  }
});
