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

type Use = 'purchase' | 'auctionPayment' | 'shipment';
async function fixture(use: Use = 'purchase', box = false) {
  const store = unitStore();
  const made = await store.rooms.createRoom('BG', 'beneGesserit', false, []),
    code = made.view.code;
  const ally = await store.rooms.joinRoom(code, 'Richese', 'harkonnen'),
    other = await store.rooms.joinRoom(code, 'Emperor', 'emperor');
  const tokens = [made.token, ally.token!, other.token!];
  const seats = await Promise.all(
    tokens.map((token) => store.restart().authenticate(code, token)),
  );
  const old = await store.restart().readRoom(code);
  const g = engine.createGame(
    code,
    engine.newPlayer(seats[0].playerId, 'BG', 'beneGesserit'),
    true,
    ['choam'],
  );
  g.players.push(
    engine.newPlayer(seats[1].playerId, 'Richese', 'richese'),
    engine.newPlayer(seats[2].playerId, 'Emperor', 'emperor'),
  );
  const ids = seats.map((s) => s.playerId),
    order =
      use === 'auctionPayment'
        ? [ids[0], ids[1], ids[2]]
        : [ids[2], ids[0], ids[1]];
  // Bounded expansion position with real room credentials and one physical
  // base deck/cache. Every bid, conversion, gift/search and allowance below is
  // a production API action; this is not public expansion-start evidence.
  Object.assign(g, {
    version: old.version,
    status: 'playing',
    phase: use === 'shipment' ? 5 : 3,
    turn: 2,
    active: order[0],
    order,
    movementRemaining: order,
    deck: baseDeck(),
    richeseCache: richeseCards(),
    response: null,
    decision: null,
    phaseOpening: null,
  });
  for (const p of g.players) {
    p.hand = [];
    p.spice = 20;
    p.forces = {};
    p.reserves = 20;
  }
  g.players[0].ally = ids[1];
  g.players[1].ally = ids[0];
  function hold(
    index: number,
    predicate: (c: engine.Game['deck'][number]) => boolean,
    cache = false,
  ) {
    const pile = cache ? g.richeseCache! : g.deck,
      at = pile.findIndex(predicate);
    assert.ok(at >= 0);
    const card = pile.splice(at, 1)[0];
    g.players[index].hand.push(card);
    return card;
  }
  const worthless = hold(0, (c) => c.kind === 'worthless');
  hold(0, (c) => c.name === 'Shield');
  hold(0, (c) => c.name === 'Snooper');
  const karama = hold(2, (c) => c.effect === 'karama');
  const gifts = [
    hold(1, (c) => c.effect === 'ornithopter', true),
    hold(1, (c) => c.effect === 'stoneBurner', true),
  ];
  const search = box
    ? hold(2, (c) => c.effect === 'nullentropyBox', true)
    : null;
  if (box) {
    const at = g.deck.findIndex((c) => c.name === 'Lasgun');
    assert.ok(at >= 0);
    g.discard.push(...g.deck.splice(at, 1));
  }
  const lot = use === 'shipment' ? null : g.deck.splice(0, 1)[0];
  g.auction = lot
    ? {
        cards: [lot],
        index: 0,
        bid: 0,
        bidder: null,
        active: order[0],
        passed: [],
        opener: 0,
      }
    : null;
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
  const physicalIds = inventory(g);
  if (use === 'purchase') {
    await act(2, { type: 'bid', amount: 2 });
    await act(0, { type: 'card', card: worthless.id, mode: 'purchase' });
  } else if (use === 'auctionPayment') {
    await act(0, { type: 'bid', amount: 5 });
    await act(1, { type: 'passBid' });
    await act(2, { type: 'passBid' });
    assert.equal(
      (await store.restart().readRoom(code)).decision?.kind,
      'auctionPayment',
    );
    await act(0, { type: 'decision', karama: true, card: worthless.id });
  } else
    await act(0, {
      type: 'card',
      card: worthless.id,
      mode: 'shipment',
      target: ids[2],
    });
  const pending = await store.restart().readRoom(code);
  assert.equal(pending.response?.kind, 'worthlessKarama');
  assert.ok(pending.pendingKarama?.opportunity);
  assert.equal(pending.discard.filter((c) => c.id === worthless.id).length, 1);
  store.writes.length = 0;
  return {
    ...store,
    code,
    tokens,
    seats,
    ids,
    act,
    save,
    pending,
    physicalIds,
    worthless,
    karama,
    gifts,
    search,
    lot,
  };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
function inventory(g: engine.Game) {
  const ids = [
    ...g.deck,
    ...g.discard,
    ...(g.richeseCache ?? []),
    ...g.players.flatMap((p) => p.hand),
    ...(g.auction?.cards.slice(
      g.auction.index + (g.currentAuctionSale ? 1 : 0),
    ) ?? []),
  ]
    .map((c) => c.id)
    .sort();
  assert.equal(new Set(ids).size, ids.length);
  return ids;
}
function barrier() {
  let arrivals = 0,
    release!: () => void;
  const ready = new Promise<void>((r) => {
    release = r;
  });
  return async () => {
    if (++arrivals === 2) release();
    await ready;
  };
}
async function privateViews(f: Fixture) {
  const state = await f.restart().readRoom(f.code);
  for (const [index, token] of f.tokens.entries()) {
    const auth = await f.restart().authenticate(f.code, token),
      view = await f.restart().readSeatView(f.code, auth);
    assert.equal('pendingKarama' in view, false);
    assert.equal(JSON.stringify(view).includes('"signature"'), false);
    for (const p of view.players)
      if (p.id === auth.playerId)
        assert.deepEqual(p.hand, state.players[index].hand);
      else
        for (const key of ['hand', 'spice', 'traitors', 'traitorChoices'])
          assert.equal(key in p, false, key);
  }
}
async function allowGift(f: Fixture) {
  let g = await f.restart().readRoom(f.code);
  for (let tries = 0; g.response?.kind === 'richeseGift'; tries++) {
    assert.ok(tries < 10);
    const index = g.players.findIndex(
      (p) => !g.response!.passed.includes(p.id),
    );
    g = await f.act(index, { type: 'passResponse' });
  }
  assert.equal(g.response?.kind, 'worthlessKarama');
  return g;
}
async function raceAllowance(f: Fixture, pending: engine.Game) {
  f.writes.length = 0;
  f.hooks.beforeWrite = barrier();
  const results = await Promise.allSettled([
    f
      .restart()
      .act(
        f.code,
        f.seats[2],
        pending.version,
        { type: 'passResponse' },
        clock,
      ),
    f
      .restart()
      .act(
        f.code,
        f.seats[2],
        pending.version,
        { type: 'passResponse' },
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
  assert.equal(done.version, pending.version + 1);
  assert.equal(done.pendingKarama, null);
  assert.deepEqual(inventory(done), f.physicalIds);
  assert.equal(done.discard.filter((c) => c.id === f.worthless.id).length, 1);
  await f.restart().continueRoomAutomatic(f.code, clock);
  assert.deepEqual(await f.restart().readRoom(f.code), done);
  assert.equal(f.writes.length, 2);
  return done;
}

void test('actual purchase conversion and nested gift reload before duplicate allowance awards the original lot once without overflow or payment', async () => {
  const f = await fixture();
  try {
    const nested = await f.act(1, { type: 'richeseGift', card: f.gifts[0].id });
    assert.equal(nested.pendingKarama, null);
    assert.deepEqual(
      nested.pendingRicheseGift!.resume.pendingKarama,
      f.pending.pendingKarama,
    );
    await privateViews(f);
    const pending = await allowGift(f);
    assert.equal(pending.players[0].hand.length, 3);
    assert.deepEqual(pending.pendingKarama, f.pending.pendingKarama);
    const beforeWrites = f.writes.length;
    await assert.rejects(
      f
        .restart()
        .act(
          f.code,
          f.seats[1],
          pending.version,
          { type: 'richeseGift', card: f.gifts[1].id },
          clock,
        ),
      /room|slot|purchase|commit/i,
    );
    assert.equal(f.writes.length, beforeWrites);
    assert.deepEqual(await f.restart().readRoom(f.code), pending);
    await privateViews(f);
    const done = await raceAllowance(f, pending);
    assert.equal(done.players[0].hand.length, 4);
    assert.equal(
      done.players[0].hand.filter((c) => c.id === f.lot!.id).length,
      1,
    );
    assert.deepEqual(
      done.players.map((p) => p.spice),
      [20, 20, 20],
    );
    assert.equal(
      done.players[1].hand.some((c) => c.id === f.gifts[1].id),
      true,
    );
    assert.equal(
      done.log.filter((l) => l.text.includes('won a treachery card')).length,
      1,
    );
    await assert.rejects(
      f
        .restart()
        .act(
          f.code,
          f.seats[2],
          pending.version,
          { type: 'passResponse' },
          clock,
        ),
      /changed/i,
    );
    await assert.rejects(
      f
        .restart()
        .act(
          f.code,
          f.seats[0],
          done.version,
          { type: 'card', card: f.worthless.id, mode: 'purchase' },
          clock,
        ),
    );
    assert.deepEqual(await f.restart().readRoom(f.code), done);
    assert.equal(f.writes.length, 2);
  } finally {
    f.sqlite.close();
  }
});

void test('winning payment and shipment conversions each preserve their original opportunity across authenticated restart and duplicate allowance', async () => {
  for (const use of ['auctionPayment', 'shipment'] as const) {
    const f = await fixture(use);
    try {
      await privateViews(f);
      await f.restart().continueRoomAutomatic(f.code, clock);
      assert.equal(f.writes.length, 0);
      assert.deepEqual(await f.restart().readRoom(f.code), f.pending);
      const done = await raceAllowance(f, f.pending);
      if (use === 'auctionPayment') {
        assert.equal(
          done.players[0].hand.filter((c) => c.id === f.lot!.id).length,
          1,
        );
        assert.deepEqual(
          done.players.map((p) => p.spice),
          [20, 20, 20],
        );
      } else {
        assert.deepEqual(done.karamaShipping, {
          player: f.ids[2],
          owner: f.ids[0],
          card: f.worthless.id,
        });
        assert.equal(done.players[2].shipped, false);
        const shipped = await f.act(2, {
          type: 'ship',
          territory: 'carthag',
          sector: 11,
          amount: 2,
        });
        assert.equal(shipped.players[2].forces['carthag:11'], 2);
        assert.equal(shipped.players[2].spice, 19);
        assert.deepEqual(
          shipped.players.slice(0, 2).map((p) => p.spice),
          [20, 20],
        );
      }
    } finally {
      f.sqlite.close();
    }
  }
});

void test('a genuine paid Box search restores the unchanged conversion while its fee and recovered card are committed once', async () => {
  const f = await fixture('purchase', true);
  try {
    const paid = await f.act(2, { type: 'card', card: f.search!.id });
    assert.ok(paid.pendingNullentropy);
    assert.equal(paid.pendingKarama, null);
    assert.deepEqual(
      paid.pendingNullentropy.resume.pendingKarama,
      f.pending.pendingKarama,
    );
    assert.equal(paid.players[2].spice, 18);
    await privateViews(f);
    const selected = paid.discard.find((c) => c.name === 'Lasgun')!;
    assert.ok(selected);
    const selectedState = await f.act(2, {
      type: 'decision',
      event: paid.pendingNullentropy.event,
      card: selected.id,
    });
    assert.equal(
      selectedState.players[2].hand.some((c) => c.id === selected.id),
      true,
    );
    assert.equal(selectedState.players[2].spice, 18);
    assert.deepEqual(selectedState.pendingKarama, f.pending.pendingKarama);
    const done = await raceAllowance(f, selectedState);
    assert.equal(
      done.players[0].hand.filter((c) => c.id === f.lot!.id).length,
      1,
    );
    assert.equal(done.players[2].spice, 18);
    assert.equal(
      done.players[2].hand.filter((c) => c.id === selected.id).length,
      1,
    );
    assert.equal(done.discard.filter((c) => c.id === f.search!.id).length, 1);
    assert.equal(
      done.log.filter((l) => l.text.includes('paid two spice to the bank'))
        .length,
      1,
    );
  } finally {
    f.sqlite.close();
  }
});

void test('malformed new opportunities reject before SQL writes directly and while suspended inside actual gift or Box windows', async () => {
  for (const parent of ['direct', 'gift', 'box'] as const) {
    const f = await fixture('purchase', parent === 'box');
    try {
      let pending = f.pending;
      if (parent === 'gift')
        pending = await f.act(1, { type: 'richeseGift', card: f.gifts[0].id });
      if (parent === 'box')
        pending = await f.act(2, { type: 'card', card: f.search!.id });
      const conversion = (g: engine.Game) =>
        parent === 'gift'
          ? g.pendingRicheseGift!.resume.pendingKarama!
          : parent === 'box'
            ? g.pendingNullentropy!.resume.pendingKarama!
            : g.pendingKarama!;
      f.writes.length = 0;
      const mutations: ((g: engine.Game) => void)[] = [
        (g) => {
          g.turn++;
        },
        (g) => {
          g.phase = 7;
        },
        (g) => {
          g.auction!.index++;
        },
        (g) => {
          g.auction!.bidder = f.ids[1];
        },
        (g) => {
          const old = g.auction!.cards[0];
          g.auction!.cards[0] = g.deck.shift()!;
          g.deck.push(old);
        },
        (g) => {
          conversion(g).owner = f.ids[1];
        },
        (g) => {
          conversion(g).opportunity!.signature = '{}';
        },
        (g) => {
          conversion(g).use = { kind: 'auctionPayment' };
        },
      ];
      for (const [index, mutate] of mutations.entries()) {
        const bad = structuredClone(pending);
        mutate(bad);
        f.save(bad);
        for (const seat of f.seats)
          await assert.rejects(
            f.restart().readSeatView(f.code, seat),
            `${parent} mutation ${index}`,
          );
        // Paid search is human work, so the scheduler may return before engine
        // normalization; both its actual decision API and normalization reject.
        assert.throws(() => engine.normalizeAutomaticGame(bad));
        if (parent === 'box')
          await f.restart().continueRoomAutomatic(f.code, clock);
        else
          await assert.rejects(
            f.restart().continueRoomAutomatic(f.code, clock),
          );
        const action: engine.Action =
          parent === 'box'
            ? {
                type: 'decision',
                event: bad.pendingNullentropy!.event,
                card: bad.discard[0].id,
              }
            : { type: 'passResponse' };
        await assert.rejects(
          f.restart().act(f.code, f.seats[2], bad.version, action, clock),
        );
        assert.deepEqual(await f.restart().readRoom(f.code), bad);
        assert.equal(f.writes.length, 0);
      }
    } finally {
      f.sqlite.close();
    }
  }
});
