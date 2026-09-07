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

async function fixture(advanced = false, pendingBlackMarket = false) {
  const store = unitStore();
  const created = await store.rooms.createRoom('Richese', 'guild', false, []);
  const code = created.view.code;
  const hark = await store.rooms.joinRoom(code, 'Harkonnen', 'harkonnen');
  const emperor = await store.rooms.joinRoom(code, 'Emperor', 'emperor');
  const ownerAuth = await store.rooms.authenticate(code, created.token);
  const harkAuth = await store.rooms.authenticate(code, hark.token!);
  const emperorAuth = await store.rooms.authenticate(code, emperor.token!);
  const auths = [ownerAuth, harkAuth, emperorAuth];
  let initial = await store.rooms.readRoom(code);
  initial.players.forEach((p) => (p.ready = true));
  initial = engine.applyAction(initial, ownerAuth.playerId, { type: 'start' });
  for (const p of initial.players)
    if (p.traitorChoices.length)
      initial = engine.applyAction(initial, p.id, {
        type: 'traitor',
        leader: p.traitorChoices[0],
      });
  initial.players[0].faction = 'richese';
  initial.players[0].leaders = engine.newPlayer(
    'roster',
    'Roster',
    'richese',
  ).leaders;
  initial.players.forEach((p) => {
    p.hand = [];
    p.spice = 20;
  });
  initial.deck = baseDeck();
  initial.discard = [];
  initial.richeseCache = richeseCards();
  initial.richeseRemoved = [];
  initial.phase = 2;
  initial.turn = 2;
  initial.ready = [];
  initial.order = [harkAuth.playerId, emperorAuth.playerId, ownerAuth.playerId];
  initial.response = null;
  initial.decision = null;
  initial.phaseOpening = null;
  initial.advanced = advanced;
  if (advanced) initial.players[0].hand = [initial.deck.shift()!];
  if (pendingBlackMarket) {
    const karama = initial.deck.find((c) => c.effect === 'karama')!;
    initial.players[2].hand = [karama];
    initial.deck = initial.deck.filter((c) => c.id !== karama.id);
  }
  const save = (g: engine.Game) =>
    store.sqlite
      .prepare('UPDATE rooms SET state = ?, version = ? WHERE code = ?')
      .run(JSON.stringify(g), g.version, code);
  save(initial);
  async function action(
    auth: Rooms.SeatAuth,
    value: engine.Action,
    rooms = store.rooms,
  ) {
    const current = await rooms.readRoom(code);
    return rooms.act(code, auth, current.version, value, clock);
  }
  async function decision(extra: Record<string, unknown>, rooms = store.rooms) {
    const current = await rooms.readRoom(code);
    return rooms.act(
      code,
      ownerAuth,
      current.version,
      {
        type: 'decision',
        event: current.richeseBidding!.event,
        ...extra,
      },
      clock,
    );
  }
  for (const auth of auths) await action(auth, { type: 'ready' });
  store.writes.length = 0;
  return {
    ...store,
    code,
    ownerAuth,
    harkAuth,
    emperorAuth,
    auths,
    action,
    decision,
    save,
  };
}
async function cache(position: 'first' | 'last' = 'first') {
  const f = await fixture();
  await f.decision({ position });
  if (position === 'first') {
    const g = await f.rooms.readRoom(f.code);
    await f.decision({ card: g.richeseCache![0].id, method: 'silent' });
  }
  f.writes.length = 0;
  return f;
}
function bidAction(g: engine.Game, amount: number | null) {
  return {
    type: 'richeseBid',
    event: g.richeseAuction!.event,
    amount,
    allyPayment: 0,
  };
}
function physical(g: engine.Game) {
  return [
    ...g.deck,
    ...g.discard,
    ...(g.richeseCache ?? []),
    ...(g.richeseRemoved ?? []),
    ...g.players.flatMap((p) => p.hand),
    ...(g.auction?.cards.slice(g.auction.index) ?? []),
    ...(g.ixAuction?.cards ?? []),
  ]
    .map((c) => c.id)
    .sort();
}
function barrier() {
  let resolve!: () => void;
  const done = new Promise<void>((yes) => {
    resolve = yes;
  });
  let arrivals = 0;
  return async () => {
    if (++arrivals === 2) resolve();
    await done;
  };
}

void test('authenticated concurrent Silent bids commit once per version, retain private offers and allow the loser to retry', async () => {
  const f = await cache();
  try {
    const pending = await f.rooms.readRoom(f.code);
    const attempts = [
      { auth: f.harkAuth, amount: 7 },
      { auth: f.emperorAuth, amount: 4 },
    ];
    f.hooks.beforeWrite = barrier();
    const results = await Promise.allSettled(
      attempts.map(({ auth, amount }) =>
        f.rooms.act(
          f.code,
          auth,
          pending.version,
          bidAction(pending, amount),
          clock,
        ),
      ),
    );
    f.hooks.beforeWrite = undefined;
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
    assert.equal(results.filter((r) => r.status === 'rejected').length, 1);
    let current = await f.rooms.readRoom(f.code);
    assert.equal(current.version, pending.version + 1);
    assert.equal(Object.keys(current.richeseAuction!.sealed).length, 1);
    assert.deepEqual(
      f.writes.map((w) => w.changes).sort((a, b) => a - b),
      [0, 1],
    );
    const winner = attempts[results.findIndex((r) => r.status === 'fulfilled')];
    const retry = attempts[results.findIndex((r) => r.status === 'rejected')];
    const own = await f.rooms.readSeatView(f.code, winner.auth);
    assert.equal(own.richeseAuction!.ownBid, winner.amount);
    for (const auth of [f.ownerAuth, retry.auth]) {
      const view = await f.rooms.readSeatView(f.code, auth);
      assert.equal(view.richeseAuction!.ownBid, null);
      assert.equal(view.richeseAuction!.revealedBids, null);
      assert.equal(view.richeseAuction!.bid, 0);
      assert.equal('sealed' in view.richeseAuction!, false);
      assert.equal('richeseFunding' in view, false);
    }
    const restarted = f.restart();
    await restarted.act(
      f.code,
      retry.auth,
      current.version,
      bidAction(current, retry.amount),
      clock,
    );
    current = await restarted.readRoom(f.code);
    assert.equal(Object.keys(current.richeseAuction!.sealed).length, 2);
    assert.equal(current.version, pending.version + 2);
    await assert.rejects(
      restarted.act(
        f.code,
        winner.auth,
        current.version,
        bidAction(current, winner.amount),
        clock,
      ),
      /already submitted/,
    );
    assert.deepEqual(await restarted.readRoom(f.code), current);
    assert.equal(
      current.players.every((p) => p.spice === 20),
      true,
    );
    assert.equal(current.richeseCache!.length, 10);
  } finally {
    f.sqlite.close();
  }
});

void test('restart before the final Silent bid and duplicate final submissions settle one payment, card and Harkonnen bonus', async () => {
  const f = await cache();
  try {
    let pending = await f.rooms.readRoom(f.code);
    const inventory = physical(pending);
    const card = pending.richeseAuction!.cardId;
    await f.action(f.harkAuth, bidAction(pending, 5));
    pending = await f.rooms.readRoom(f.code);
    await f.action(f.emperorAuth, bidAction(pending, 3));
    pending = await f.rooms.readRoom(f.code);
    const resumed = f.restart();
    assert.deepEqual(await resumed.readRoom(f.code), pending);
    const final = bidAction(pending, 0);
    f.writes.length = 0;
    f.hooks.beforeWrite = barrier();
    const results = await Promise.allSettled([
      resumed.act(f.code, f.ownerAuth, pending.version, final, clock),
      f.rooms.act(f.code, f.ownerAuth, pending.version, final, clock),
    ]);
    f.hooks.beforeWrite = undefined;
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
    const settled = await resumed.readRoom(f.code);
    assert.equal(settled.version, pending.version + 1);
    assert.equal(settled.players[0].spice, 25);
    assert.equal(settled.players[1].spice, 15);
    assert.equal(settled.players[2].spice, 20);
    assert.equal(settled.players[1].hand.length, 2);
    assert.equal(
      settled.players[1].hand.filter((c) => c.id === card).length,
      1,
    );
    assert.equal(settled.richeseCache!.length, 9);
    assert.equal(settled.auction!.cards.length, 2);
    assert.equal(settled.richeseAuction, null);
    assert.deepEqual(physical(settled), inventory);
    assert.deepEqual(
      f.writes.map((w) => w.changes).sort((a, b) => a - b),
      [0, 1],
    );
    for (let i = 0; i < 2; i++) {
      const next = f.restart();
      await next.continueRoomAutomatic(f.code, clock);
      await next.readSeatView(f.code, f.harkAuth);
      await assert.rejects(
        next.act(f.code, f.ownerAuth, settled.version, final, clock),
      );
      assert.deepEqual(await next.readRoom(f.code), settled);
    }
  } finally {
    f.sqlite.close();
  }
});

void test('ordinary all-pass persists a last-cache continuation across restart without returning or duplicating the cache card', async () => {
  const f = await cache('last');
  try {
    let g = await f.rooms.readRoom(f.code);
    const inventory = physical(g);
    assert.ok(g.auction);
    assert.equal(g.richeseAuction, null);
    assert.equal(
      (await f.rooms.readSeatView(f.code, f.emperorAuth)).richeseBidding!.cache,
      null,
    );
    for (let steps = 0; g.auction && steps < 6; steps++) {
      const auth = f.auths.find((a) => a.playerId === g.auction!.active)!;
      await f.action(auth, { type: 'passBid' });
      g = await f.rooms.readRoom(f.code);
    }
    assert.equal(g.auction, null);
    assert.equal(g.phase, 3);
    assert.equal(g.decision!.kind, 'richeseCache');
    assert.equal(g.richeseCache!.length, 10);
    const restarted = f.restart();
    const chosen = g.richeseCache![1].id;
    await f.decision(
      { card: chosen, method: 'onceAround', direction: 'clockwise' },
      restarted,
    );
    g = await restarted.readRoom(f.code);
    for (let steps = 0; !g.richeseAuction!.outcome && steps < 6; steps++) {
      const auth = f.auths.find(
        (a) => a.playerId === g.richeseAuction!.active,
      )!;
      await f.action(auth, bidAction(g, null), restarted);
      g = await restarted.readRoom(f.code);
    }
    assert.equal(g.decision!.kind, 'richeseUnbid');
    const remove = {
      type: 'decision',
      event: g.richeseBidding!.event,
      keep: false,
    };
    const version = g.version;
    await restarted.act(f.code, f.ownerAuth, version, remove, clock);
    const finished = await restarted.readRoom(f.code);
    assert.equal(finished.phase, 4);
    assert.equal(
      finished.richeseRemoved!.filter((c) => c.id === chosen).length,
      1,
    );
    assert.deepEqual(physical(finished), inventory);
    await assert.rejects(
      f.restart().act(f.code, f.ownerAuth, finished.version, remove, clock),
    );
    assert.deepEqual(await restarted.readRoom(f.code), finished);
  } finally {
    f.sqlite.close();
  }
});

void test('concealed Black Market response preserves seller custody on restart and a duplicated cancellation commits only once', async () => {
  const f = await fixture(true, true);
  try {
    let g = await f.rooms.readRoom(f.code);
    const inventory = physical(g);
    const card = g.players[0].hand[0];
    const karama = g.players[2].hand[0];
    await f.decision({
      card: card.id,
      method: 'silent',
      claim: 'A useful card',
    });
    g = await f.rooms.readRoom(f.code);
    assert.equal(g.response!.kind, 'richeseBlackMarket');
    const resumed = f.restart();
    for (const auth of [f.harkAuth, f.emperorAuth]) {
      const view = await resumed.readSeatView(f.code, auth);
      assert.equal(view.richeseAuction!.card, null);
      assert.equal(view.richeseAuction!.cardId, null);
      assert.equal(view.players[0].hand, undefined);
      assert.equal('richeseOfferedCard' in view, false);
      assert.equal(
        view.log.some((entry) => entry.text.includes(card.name)),
        false,
      );
    }
    const owner = await resumed.readSeatView(f.code, f.ownerAuth);
    assert.equal(owner.richeseAuction!.card!.id, card.id);
    assert.equal(g.players[0].hand.filter((c) => c.id === card.id).length, 1);
    assert.deepEqual(physical(g), inventory);
    const cancel = { type: 'card', card: karama.id, mode: 'cancel' };
    f.writes.length = 0;
    f.hooks.beforeWrite = barrier();
    const results = await Promise.allSettled([
      resumed.act(f.code, f.emperorAuth, g.version, cancel, clock),
      f.rooms.act(f.code, f.emperorAuth, g.version, cancel, clock),
    ]);
    f.hooks.beforeWrite = undefined;
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
    const done = await resumed.readRoom(f.code);
    assert.equal(done.version, g.version + 1);
    assert.deepEqual(done.players[0].hand, [card]);
    assert.equal(done.discard.filter((c) => c.id === karama.id).length, 1);
    assert.equal(done.richeseBidding!.blackMarketSold, false);
    assert.equal(done.richeseBidding!.normalCount, 2);
    assert.equal(done.decision!.kind, 'richeseDeclaration');
    assert.equal(
      done.players.every((p) => p.spice === 20),
      true,
    );
    assert.deepEqual(physical(done), inventory);
    assert.deepEqual(
      f.writes.map((w) => w.changes).sort((a, b) => a - b),
      [0, 1],
    );
    await assert.rejects(
      resumed.act(f.code, f.emperorAuth, done.version, cancel, clock),
    );
    assert.deepEqual(await resumed.readRoom(f.code), done);
  } finally {
    f.sqlite.close();
  }
});

void test('a previously authenticated Silent bidder cannot write or read after its credential is revoked', async () => {
  const f = await cache();
  try {
    const g = await f.rooms.readRoom(f.code);
    // Revoke after act has read the room and computed the prospective bid,
    // immediately before its credential-fenced conditional write.
    f.hooks.beforeWrite = async () => {
      f.hooks.beforeWrite = undefined;
      f.sqlite
        .prepare(
          'UPDATE seats SET revoked = 1 WHERE room_code = ? AND player_id = ?',
        )
        .run(f.code, f.harkAuth.playerId);
    };
    await assert.rejects(
      f.rooms.act(f.code, f.harkAuth, g.version, bidAction(g, 5), clock),
      /arrived first/,
    );
    assert.deepEqual(await f.rooms.readRoom(f.code), g);
    assert.equal(f.writes[0].changes, 0);
    await assert.rejects(
      f.restart().readSeatView(f.code, f.harkAuth),
      /could not be verified/,
    );
    await f.action(f.emperorAuth, bidAction(g, 3));
    const next = await f.rooms.readRoom(f.code);
    assert.deepEqual(next.richeseAuction!.sealed, {
      [f.emperorAuth.playerId]: 3,
    });
    assert.equal(next.version, g.version + 1);
  } finally {
    f.sqlite.close();
  }
});

void test('competing recovery workers automatically zero a restored full hand and settle the Silent purchase once', async () => {
  const f = await cache();
  try {
    let pending = await f.rooms.readRoom(f.code);
    await f.action(f.harkAuth, bidAction(pending, 5));
    pending = await f.rooms.readRoom(f.code);
    await f.action(f.emperorAuth, bidAction(pending, 3));
    pending = await f.rooms.readRoom(f.code);
    const card = pending.richeseAuction!.cardId;
    // Restore the persisted interruption after the last unsubmitted seat's
    // hand became full. Move actual deck cards; do not duplicate inventory.
    const safeCards = pending.deck
      .filter((c) => c.effect !== 'karama')
      .slice(0, 4);
    assert.equal(safeCards.length, 4);
    pending.players[0].hand = safeCards;
    pending.deck = pending.deck.filter(
      (c) => !safeCards.some((held) => held.id === c.id),
    );
    pending.version++;
    f.save(pending);
    const inventory = physical(pending);
    assert.equal(
      Object.hasOwn(pending.richeseAuction!.sealed, f.ownerAuth.playerId),
      false,
    );
    const resumed = f.restart();
    assert.equal(
      (await resumed.readSeatView(f.code, f.ownerAuth)).richeseAuction!.ownBid,
      null,
    );
    f.writes.length = 0;
    f.hooks.beforeWrite = barrier();
    await Promise.all([
      resumed.continueRoomAutomatic(f.code, clock),
      f.rooms.continueRoomAutomatic(f.code, clock),
    ]);
    f.hooks.beforeWrite = undefined;
    const settled = await resumed.readRoom(f.code);
    assert.equal(settled.version, pending.version + 1);
    assert.equal(settled.richeseAuction, null);
    assert.equal(settled.players[0].hand.length, 4);
    assert.equal(settled.players[0].spice, 25);
    assert.equal(settled.players[1].spice, 15);
    assert.equal(settled.players[2].spice, 20);
    assert.equal(settled.players[1].hand.length, 2);
    assert.equal(
      settled.players[1].hand.filter((c) => c.id === card).length,
      1,
    );
    assert.equal(settled.richeseCache!.length, 9);
    assert.deepEqual(physical(settled), inventory);
    assert.deepEqual(
      f.writes.map((w) => w.changes).sort((a, b) => a - b),
      [0, 1],
    );
    assert.equal(
      settled.log.filter((entry) => entry.automatic?.name === 'Auction payment')
        .length,
      1,
    );
    await f.restart().continueRoomAutomatic(f.code, clock);
    await assert.rejects(
      resumed.act(
        f.code,
        f.ownerAuth,
        settled.version,
        bidAction(pending, 0),
        clock,
      ),
    );
    assert.deepEqual(await resumed.readRoom(f.code), settled);
    assert.equal(f.writes.length, 2);
  } finally {
    f.sqlite.close();
  }
});

void test('authenticated refresh and recovery workers do not write or auto-pass a legitimate pending Richese bid', async () => {
  const f = await cache();
  try {
    const opening = await f.rooms.readRoom(f.code);
    await f.action(f.harkAuth, bidAction(opening, 4));
    const pending = await f.rooms.readRoom(f.code);
    f.writes.length = 0;
    const resumed = f.restart();
    for (const auth of f.auths) {
      const view = await resumed.readSeatView(f.code, auth);
      assert.equal(view.version, pending.version);
      assert.equal(view.richeseAuction!.outcome, null);
      assert.equal(
        view.richeseAuction!.ownBid,
        auth.playerId === f.harkAuth.playerId ? 4 : null,
      );
    }
    await Promise.all([
      resumed.continueRoomAutomatic(f.code, clock),
      f.rooms.continueRoomAutomatic(f.code, clock),
    ]);
    await f.restart().continueRoomAutomatic(f.code, clock);
    assert.deepEqual(await resumed.readRoom(f.code), pending);
    assert.deepEqual(f.writes, []);
    assert.deepEqual(Object.keys(pending.richeseAuction!.sealed), [
      f.harkAuth.playerId,
    ]);
    assert.equal(
      pending.players.every((p) => p.hand.length === 0),
      true,
    );
  } finally {
    f.sqlite.close();
  }
});

async function acquisitionFixture() {
  const f = await fixture(true);
  const g = await f.rooms.readRoom(f.code);
  g.deck.push(...g.players[0].hand);
  g.players[0].hand = [];
  const k = g.deck.findIndex((c) => c.effect === 'karama');
  g.players[0].hand.push(...g.deck.splice(k, 1));
  // Purchase during the existing Black Market offer, preserving that decision.
  f.save(g);
  return {
    ...f,
    purchase: {
      type: 'card',
      mode: 'special',
      card: g.players[0].hand[0].id,
      acquire: 'richese-karama',
    },
  };
}
void test('concurrent authenticated special purchases acquire and pay once, then reload the private income response', async () => {
  const f = await acquisitionFixture();
  try {
    const before = await f.rooms.readRoom(f.code),
      stock = physical(before);
    f.hooks.beforeWrite = barrier();
    const attempts = await Promise.allSettled([
      f.rooms.act(f.code, f.ownerAuth, before.version, f.purchase, clock),
      f.rooms.act(f.code, f.ownerAuth, before.version, f.purchase, clock),
    ]);
    f.hooks.beforeWrite = undefined;
    assert.equal(attempts.filter((a) => a.status === 'fulfilled').length, 1);
    assert.equal(attempts.filter((a) => a.status === 'rejected').length, 1);
    const bought = await f.rooms.readRoom(f.code);
    assert.equal(bought.version, before.version + 1);
    assert.equal(bought.players[0].spice, 17);
    assert.equal(bought.players[2].spice, 20);
    assert.equal(bought.players[0].specialKaramaUsed, true);
    assert.equal(bought.response?.kind, 'richesePurchaseIncome');
    assert.equal(
      bought.players[0].hand.filter((c) => c.id === 'richese-karama').length,
      1,
    );
    assert.deepEqual(physical(bought), stock);
    const restarted = f.restart();
    assert.deepEqual(await restarted.readRoom(f.code), bought);
    const owner = await restarted.readSeatView(f.code, f.ownerAuth);
    assert.equal(
      owner.players.find((p) => p.id === f.ownerAuth.playerId)!.hand![0].id,
      'richese-karama',
    );
    for (const auth of [f.harkAuth, f.emperorAuth]) {
      const view = await restarted.readSeatView(f.code, auth);
      assert.equal(view.richeseSpecialKarama, null);
      assert.equal(view.richeseBidding!.cache, null);
      assert.equal(JSON.stringify(view).includes('richese-karama'), false);
      assert.equal('pendingRichesePurchaseIncome' in view, false);
    }
    await assert.rejects(
      restarted.act(f.code, f.ownerAuth, bought.version, f.purchase, clock),
      /already been used/,
    );
    assert.deepEqual(await restarted.readRoom(f.code), bought);
  } finally {
    f.sqlite.close();
  }
});
void test('racing allow and cancellation after restart settle Emperor income at most once and restore the original offer', async () => {
  const f = await acquisitionFixture();
  try {
    const before = await f.rooms.readRoom(f.code);
    await f.action(f.ownerAuth, f.purchase);
    const pending = await f.rooms.readRoom(f.code),
      restarted = f.restart();
    f.hooks.beforeWrite = barrier();
    const attempts = await Promise.allSettled([
      restarted.act(
        f.code,
        f.ownerAuth,
        pending.version,
        { type: 'passResponse' },
        clock,
      ),
      f.rooms.act(
        f.code,
        f.ownerAuth,
        pending.version,
        { type: 'card', mode: 'cancel', card: 'richese-karama' },
        clock,
      ),
    ]);
    f.hooks.beforeWrite = undefined;
    assert.equal(attempts.filter((a) => a.status === 'fulfilled').length, 1);
    const after = await restarted.readRoom(f.code);
    assert.equal(after.version, pending.version + 1);
    assert.equal(after.pendingRichesePurchaseIncome, null);
    assert.deepEqual(after.decision, before.decision);
    assert.equal(after.players[0].spice, 17);
    assert.equal(
      after.players[2].spice,
      attempts[0].status === 'fulfilled' ? 23 : 20,
    );
    assert.equal(after.richeseCache!.length, 9);
    assert.equal(after.players[0].specialKaramaUsed, true);
    const again = f.restart();
    await again.continueRoomAutomatic(f.code, clock);
    assert.deepEqual(await again.readRoom(f.code), after);
  } finally {
    f.sqlite.close();
  }
});
