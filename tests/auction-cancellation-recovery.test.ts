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

type Source = 'income' | 'technology';
async function fixture(source: Source, converted = true) {
  const store = unitStore(),
    extensions: 'ix'[] = source === 'technology' ? ['ix'] : [];
  const made = await store.rooms.createRoom(
      'BG',
      'beneGesserit',
      false,
      extensions,
    ),
    code = made.view.code,
    tokens = [made.token];
  const factions =
    source === 'income'
      ? (['harkonnen', 'emperor'] as const)
      : (['ixians', 'atreides'] as const);
  for (const faction of factions)
    tokens.push((await store.rooms.joinRoom(code, faction, faction)).token!);
  const seats = await Promise.all(
      tokens.map((t) => store.restart().authenticate(code, t)),
    ),
    ids = seats.map((s) => s.playerId);
  const old = await store.restart().readRoom(code);
  const g = engine.createGame(
    code,
    engine.newPlayer(ids[0], 'BG', 'beneGesserit'),
    true,
    extensions,
  );
  factions.forEach((f, i) =>
    g.players.push(engine.newPlayer(ids[i + 1], f, f)),
  );
  // Phase2 position only: all pool creation, paid sale, substitution, responses
  // and costs below are public production actions on authenticated SQL rooms.
  Object.assign(g, {
    version: old.version,
    status: 'playing',
    phase: 2,
    turn: 2,
    storm: 18,
    active: null,
    order: [ids[1], ids[2], ids[0]],
    deck: baseDeck(),
    discard: [],
    phaseOpening: null,
    ready: [],
  });
  for (const p of g.players)
    Object.assign(p, {
      hand: [],
      spice: 20,
      forces: {},
      reserves: 20,
      tanks: 0,
      traitors: [],
      traitorChoices: [],
    });
  function hold(
    index: number,
    pred: (c: engine.Game['deck'][number]) => boolean,
  ) {
    const at = g.deck.findIndex(pred);
    assert.ok(at >= 0);
    const card = g.deck.splice(at, 1)[0];
    g.players[index].hand.push(card);
    return card;
  }
  const worthless = hold(0, (c) => c.kind === 'worthless'),
    printed = hold(1, (c) => c.effect === 'karama'),
    offered =
      source === 'technology' ? hold(1, (c) => c.kind === 'shield') : null;
  const save = (state: engine.Game) =>
    store.sqlite
      .prepare('UPDATE rooms SET state=?,version=? WHERE code=?')
      .run(JSON.stringify(state), state.version, code);
  save(g);
  async function act(index: number, action: engine.Action) {
    const state = await store.restart().readRoom(code);
    await store.restart().act(code, seats[index], state.version, action, clock);
    return store.restart().readRoom(code);
  }
  let state: engine.Game = g;
  for (const index of [0, 1, 2]) state = await act(index, { type: 'ready' });
  if (state.phaseOpening)
    for (const index of [0, 1, 2]) state = await act(index, { type: 'ready' });
  assert.equal(state.phase, 3);
  if (source === 'technology') {
    assert.equal(state.response?.kind, 'ixAuction');
    for (let n = 0; state.response && n < 10; n++) {
      const index = state.players.findIndex(
        (p) => !state.response!.passed.includes(p.id),
      );
      assert.ok(index >= 0);
      state = await act(index, { type: 'passResponse' });
    }
    assert.equal(state.decision?.kind, 'ixAuction');
    state = await act(1, {
      type: 'decision',
      card: state.ixAuction!.cards[0].id,
      position: 'bottom',
    });
    assert.equal(state.decision?.kind, 'ixTechnology');
    state = await act(1, { type: 'decision', card: offered!.id });
    assert.equal(state.response?.kind, 'ixTechnology');
  } else {
    assert.equal(state.auction!.active, ids[1]);
    state = await act(1, { type: 'bid', amount: 4 });
    for (let n = 0; !state.decision && n < 5; n++) {
      const index = ids.indexOf(state.auction!.active);
      assert.ok(index >= 0);
      state = await act(index, { type: 'passBid' });
    }
    assert.equal(state.decision?.kind, 'auctionPayment');
    state = await act(1, { type: 'decision', karama: false });
    assert.equal(state.response?.kind, 'emperorIncome');
    assert.equal(state.players[1].spice, 16);
    assert.equal(state.players[2].spice, 20);
  }
  const original = state;
  const pending = converted
    ? await act(0, { type: 'card', card: worthless.id, mode: 'cancel' })
    : original;
  if (converted) assert.equal(pending.response?.kind, 'worthlessKarama');
  store.writes.length = 0;
  return {
    ...store,
    code,
    tokens,
    seats,
    ids,
    save,
    act,
    source,
    offered,
    original,
    pending,
    worthless,
    printed,
  };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
async function privateViews(f: Fixture) {
  for (const token of f.tokens) {
    const seat = await f.restart().authenticate(f.code, token),
      view = await f.restart().readSeatView(f.code, seat);
    assert.equal('pendingKarama' in view, false);
    assert.equal(JSON.stringify(view).includes('"signature"'), false);
    for (const p of view.players)
      if (p.id !== seat.playerId)
        for (const key of ['hand', 'spice', 'traitors', 'traitorChoices'])
          assert.equal(key in p, false);
    if (f.source === 'technology' && seat.playerId !== f.ids[1])
      assert.equal(JSON.stringify(view).includes(f.offered!.id), false);
  }
}
async function allowance(f: Fixture) {
  await privateViews(f);
  await f.restart().continueRoomAutomatic(f.code, clock);
  assert.equal(f.writes.length, 0);
  await assert.rejects(
    f
      .restart()
      .act(
        f.code,
        f.seats[2],
        f.pending.version,
        { type: 'card', card: f.printed.id, mode: 'cancel' },
        clock,
      ),
  );
  assert.equal(f.writes.length, 0);
  let count = 0,
    release!: () => void;
  const gate = new Promise<void>((r) => {
    release = r;
  });
  f.hooks.beforeWrite = async () => {
    if (++count === 2) release();
    await gate;
  };
  const results = await Promise.allSettled(
    [0, 1].map(() =>
      f
        .restart()
        .act(
          f.code,
          f.seats[1],
          f.pending.version,
          { type: 'passResponse' },
          clock,
        ),
    ),
  );
  f.hooks.beforeWrite = undefined;
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(results.filter((r) => r.status === 'rejected').length, 1);
  assert.deepEqual(
    f.writes.map((w) => w.changes).sort((a, b) => a - b),
    [0, 1],
  );
  const done = await f.restart().readRoom(f.code);
  assert.equal(done.version, f.pending.version + 1);
  assert.equal(done.pendingKarama ?? null, null);
  assert.equal(done.discard.filter((c) => c.id === f.worthless.id).length, 1);
  assert.ok(done.players[1].hand.some((c) => c.id === f.printed.id));
  await Promise.all([
    f.restart().continueRoomAutomatic(f.code, clock),
    f.restart().continueRoomAutomatic(f.code, clock),
  ]);
  assert.deepEqual(await f.restart().readRoom(f.code), done);
  await assert.rejects(
    f
      .restart()
      .act(
        f.code,
        f.seats[1],
        f.pending.version,
        { type: 'passResponse' },
        clock,
      ),
    /changed/i,
  );
  assert.equal(f.writes.length, 2);
  await privateViews(f);
  return done;
}
void test('paid Harkonnen win survives concurrent Emperor-income cancellation with one automatic private bonus and next-lot advancement', async () => {
  const f = await fixture('income');
  try {
    const won = f.original.auction!.cards[0],
      bonus = f.original.deck[0],
      done = await allowance(f);
    assert.equal(done.response, null);
    assert.equal(done.currentAuctionSale, null);
    assert.equal(done.auction!.index, 1);
    assert.equal(done.auction!.bid, 0);
    assert.equal(done.auction!.bidder, null);
    assert.deepEqual(done.auction!.passed, []);
    assert.equal(done.auction!.active, f.ids[2]);
    assert.deepEqual(
      done.players.map((p) => p.spice),
      [20, 16, 20],
    );
    assert.deepEqual(
      done.players[1].hand.map((c) => c.id),
      [f.printed.id, won.id, bonus.id],
    );
    assert.deepEqual(done.deck, f.original.deck.slice(1));
    assert.equal(
      done.log.filter((l) => /drew one bonus treachery card/.test(l.text))
        .length,
      1,
    );
    assert.equal(
      done.log.filter((l) => /won a treachery card/.test(l.text)).length,
      1,
    );
    for (const index of [0, 2]) {
      const view = await f
        .restart()
        .readSeatView(
          f.code,
          await f.restart().authenticate(f.code, f.tokens[index]),
        );
      assert.equal(JSON.stringify(view).includes(bonus.id), false);
      assert.equal(JSON.stringify(view).includes(won.id), false);
    }
  } finally {
    f.sqlite.close();
  }
});
void test('real Ixian Technology cancellation resumes an Atreides peek without exchanging cards or repeating pool work after fresh authenticated recovery', async () => {
  const f = await fixture('technology');
  try {
    const done = await allowance(f),
      incoming = f.original.auction!.cards[f.original.auction!.index];
    assert.equal(done.pendingIxTechnology, null);
    assert.equal(done.ixTechnologyTurn, 2);
    assert.equal(done.response?.kind, 'atreidesAuction');
    assert.equal(done.response!.owner, f.ids[2]);
    assert.deepEqual(done.auction, f.original.auction);
    assert.equal(done.auction!.peekKnown, false);
    assert.deepEqual(done.players[1].hand, f.original.players[1].hand);
    assert.deepEqual(done.deck, f.original.deck);
    assert.deepEqual(done.ixAuctionKnown, f.original.ixAuctionKnown);
    const hidden = await f.restart().readSeatView(f.code, f.seats[2]);
    assert.equal(hidden.auction?.card, null);
    const peek = await f.act(1, { type: 'passResponse' });
    assert.equal(peek.response, null);
    assert.equal(peek.auction!.peekKnown, true);
    const mine = await f
      .restart()
      .readSeatView(
        f.code,
        await f.restart().authenticate(f.code, f.tokens[2]),
      );
    assert.equal(mine.auction!.card!.id, incoming.id);
    await f.restart().continueRoomAutomatic(f.code, clock);
    assert.deepEqual(await f.restart().readRoom(f.code), peek);
  } finally {
    f.sqlite.close();
  }
});
for (const source of ['income', 'technology'] as const)
  void test(`${source} source corruption rejects new card costs and paid conversion allowances before any SQL write`, async () => {
    for (const converted of [false, true]) {
      const f = await fixture(source, converted);
      try {
        const mutations: ((g: engine.Game) => void)[] =
          source === 'income'
            ? [
                (g) => {
                  g.currentAuctionSale!.amount = -1;
                },
                (g) => {
                  g.currentAuctionSale!.winner = f.ids[2];
                },
                (g) => {
                  g.auction!.opener = -1;
                },
              ]
            : [
                (g) => {
                  g.ixTechnologyTurn = 1;
                },
                (g) => {
                  g.pendingIxTechnology!.card = '';
                },
                (g) => {
                  g.auction!.index = g.auction!.cards.length;
                },
              ];
        for (const mutate of mutations) {
          const bad = structuredClone(f.pending);
          mutate(bad);
          f.save(bad);
          await assert.rejects(
            f
              .restart()
              .act(
                f.code,
                f.seats[converted ? 1 : 0],
                bad.version,
                converted
                  ? { type: 'passResponse' }
                  : { type: 'card', card: f.worthless.id, mode: 'cancel' },
                clock,
              ),
          );
          assert.deepEqual(await f.restart().readRoom(f.code), bad);
          assert.equal(f.writes.length, 0);
          assert.equal(
            bad.discard.filter((c) => c.id === f.worthless.id).length,
            converted ? 1 : 0,
          );
        }
      } finally {
        f.sqlite.close();
      }
    }
  });
