import assert from 'node:assert/strict';
import test from 'node:test';
import type { DatabaseSync, SQLOutputValue } from 'node:sqlite';
import { viewGame, type Action, type Game } from '../game/engine';
import { NEXUS_FACTIONS, validateNexusCards } from '../game/nexus-cards';
import type { RoomsClock, SeatAuth } from '../db/rooms';
import type * as Rooms from '../db/rooms';
import { unitStore } from './fixture-nexus-room-store';
import {
  createIxianNexusReplacementFixture,
  type IxianReplacementFixture,
  type IxianReplacementFixtureOptions as Options,
} from './fixture-nexus-ixian-replacement';

type SqlRow = Record<string, SQLOutputValue>;
interface Fixture extends IxianReplacementFixture {
  sqlite: DatabaseSync;
  restart(): typeof Rooms;
  hooks: { beforeWrite?: () => Promise<void> };
  writes: { expected: number; changes: number }[];
  initial: Game;
  code: string;
  tokens: string[];
  auths: SeatAuth[];
  save(g: Game): void;
  credentialRows: { seats: SqlRow[]; entries: SqlRow[]; keys: SqlRow[]; receipts: SqlRow[] };
  unrelatedCode: string;
  unrelatedToken: string;
  unrelatedRow: SqlRow | undefined;
  stock: string[];
}
const clock: RoomsClock = { now: () => 10000, sleep: async () => {} };
const plain = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const pass = (event: string): Action => ({ type: 'nexusIxianReplacementPass', event });
const use = (event: string): Action => ({ type: 'nexusIxianReplacementUse', event });
function player(g: Game, id: string) {
  const found = g.players.find(p => p.id === id);
  assert.ok(found);
  return found;
}
function physical(g: Game) {
  // A delivered normal sale's current auction descriptor is a receipt alias,
  // not another owned component. Unsold later lots remain physical cards.
  const ids = [...g.deck, ...g.discard, ...g.players.flatMap(p => p.hand),
    ...(g.auction?.cards.slice(g.auction.index + Number(g.currentAuctionSale?.origin === 'normal')) ?? [])]
    .map(card => card.id).sort();
  assert.equal(new Set(ids).size, ids.length, 'one physical custodian per Treachery card');
  return ids;
}
function credentials(sqlite: DatabaseSync) {
  return {
    seats: sqlite.prepare('SELECT * FROM seats ORDER BY room_code,player_id,token_hash').all(),
    entries: sqlite.prepare('SELECT * FROM room_entry_receipts ORDER BY room_code,player_id,operation_hash').all(),
    keys: sqlite.prepare('SELECT * FROM seat_recovery_keys ORDER BY room_code,player_id').all(),
    receipts: sqlite.prepare('SELECT * FROM seat_recovery_receipts ORDER BY room_code,player_id,operation_hash').all(),
  };
}
function totalChanges(sqlite: DatabaseSync) {
  const value = sqlite.prepare('SELECT total_changes() AS changes').get()?.changes;
  assert.equal(typeof value, 'number');
  return value;
}
async function fixture(t: test.TestContext, options: Options = {}): Promise<Fixture> {
  const store = unitStore();
  t.after(() => store.sqlite.close());
  const made = await store.rooms.createRoom('Ixian replacement recovery', 'atreides', options.advanced ?? true, []);
  const code = made.view.code;
  const joined = await store.rooms.joinRoom(code, 'Emperor', 'emperor');
  assert.ok(joined.token);
  const guild = await store.rooms.joinRoom(code, 'Guild', 'guild');
  assert.ok(guild.token);
  const tokens = [made.token, joined.token, guild.token];
  const auths = await Promise.all(tokens.map(token => store.rooms.authenticate(code, token)));
  const admitted = await store.rooms.readRoom(code);
  const native = createIxianNexusReplacementFixture({ ...options, initial: admitted });
  assert.equal(native.beforePayment.code, code);
  assert.equal(native.beforePayment.host, admitted.host);
  assert.equal(native.beforePayment.advanced, admitted.advanced);
  assert.deepEqual(native.beforePayment.expansions, admitted.expansions);
  assert.deepEqual(native.beforePayment.players.map(p => [p.id, p.name, p.faction]),
    admitted.players.map(p => [p.id, p.name, p.faction]));
  assert.deepEqual(native.beforePayment.playerPositions, admitted.playerPositions);
  const save = (g: Game) => {
    assert.equal(store.sqlite.prepare('UPDATE rooms SET state=?, version=? WHERE code=?')
      .run(JSON.stringify(g), g.version, code).changes, 1);
  };
  save(native.beforePayment);
  const unrelated = await store.rooms.createRoom('Preserved unrelated lobby', 'guild', false, []);
  const credentialRows = credentials(store.sqlite);
  const unrelatedRow = store.sqlite.prepare('SELECT * FROM rooms WHERE code=?').get(unrelated.view.code);
  const buyerIndex = auths.findIndex(auth => auth.playerId === native.buyer);
  assert.ok(buyerIndex >= 0);
  await store.restart().act(code, await store.restart().authenticate(code, tokens[buyerIndex]),
    native.beforePayment.version, native.paymentAction, clock);
  const initial = await store.restart().readRoom(code);
  const opportunity = viewGame(initial, native.buyer).nexusIxianReplacement;
  assert.ok(opportunity);
  assert.equal(opportunity.event, native.event);
  assert.deepEqual(opportunity.purchased, native.purchased);
  assert.equal(opportunity.canPass, true);
  assert.equal(opportunity.canUse, true);
  store.writes.length = 0;
  return { ...store, ...native, initial, code, tokens, auths, save, credentialRows,
    unrelatedCode: unrelated.view.code, unrelatedToken: unrelated.token, unrelatedRow,
    stock: physical(initial) };
}
const row = (f: Fixture) => f.sqlite.prepare('SELECT * FROM rooms WHERE code=?').get(f.code);
function protectedRows(f: Fixture) {
  assert.deepEqual(credentials(f.sqlite), f.credentialRows);
  assert.deepEqual(f.sqlite.prepare('SELECT * FROM rooms WHERE code=?').get(f.unrelatedCode), f.unrelatedRow);
}
function inventory(f: Fixture, g: Game) {
  assert.deepEqual(physical(g), f.stock);
  assert.ok(g.nexusCards?.cards);
  validateNexusCards(g.nexusCards.cards, g.players);
  assert.deepEqual([...g.nexusCards.cards.deck, ...g.nexusCards.cards.discard,
    ...Object.values(g.nexusCards.cards.hands).filter(face => face !== null)].sort(), [...NEXUS_FACTIONS].sort());
  protectedRows(f);
}
async function authenticate(f: Fixture, id: string) {
  const index = f.auths.findIndex(auth => auth.playerId === id);
  assert.ok(index >= 0);
  const auth = await f.restart().authenticate(f.code, f.tokens[index]);
  assert.equal(auth.playerId, id);
  assert.equal(auth.tokenHash, f.auths[index].tokenHash);
  return auth;
}
async function act(f: Fixture, g: Game, action: Action) {
  await f.restart().act(f.code, await authenticate(f, f.buyer), g.version, action, clock);
  return f.restart().readRoom(f.code);
}
async function closeSale(f: Fixture, state: Game) {
  let game = state;
  for (let step = 0; game.response && step < 20; step++) {
    const responder = game.players.find(p => !game.response!.passed.includes(p.id));
    assert.ok(responder);
    await f.restart().act(f.code, await authenticate(f, responder.id), game.version,
      { type: 'passResponse' }, clock);
    game = await f.restart().readRoom(f.code);
  }
  assert.equal(game.response, null, 'the original auction suffix must finish');
  assert.equal(game.pendingTreacheryDiscard ?? null, null);
  return game;
}
async function rejected(f: Fixture, g: Game, auth: SeatAuth, action: Action, version = g.version) {
  const before = row(f), changes = totalChanges(f.sqlite);
  await assert.rejects(f.restart().act(f.code, auth, version, action, clock));
  assert.deepEqual(row(f), before);
  assert.equal(totalChanges(f.sqlite), changes, 'invalid action writes no durable table');
  protectedRows(f);
}
async function restored(f: Fixture, g: Game) {
  const before = row(f), changes = totalChanges(f.sqlite);
  assert.deepEqual(plain(await f.restart().readRoom(f.code)), plain(g));
  for (const auth of f.auths) {
    const view = await f.restart().readSeatView(f.code, await authenticate(f, auth.playerId));
    assert.deepEqual(plain(view), plain(viewGame(g, auth.playerId)));
    assert.equal(view.nexusIxianReplacementPreview, true);
    for (const key of ['pendingNexusIxianReplacement', 'nexusIxianReplacementHistory', 'nexusIxianReplacementCursor'])
      assert.equal(Object.hasOwn(view, key), false);
    for (const rival of view.players.filter(p => p.id !== auth.playerId)) {
      for (const key of ['hand', 'traitors', 'spice']) assert.equal(Object.hasOwn(rival, key), false);
    }
    if (view.nexusIxianReplacement) {
      const offer = view.nexusIxianReplacement;
      assert.deepEqual(Object.keys(offer).sort(), ['event', 'buyer', 'canPass', 'canUse', 'blocked', 'purchased'].sort());
      assert.equal(offer.event, f.event);
      assert.equal(offer.buyer, f.buyer);
      assert.equal(offer.canPass, auth.playerId === f.buyer);
      if (auth.playerId !== f.buyer) {
        assert.equal(offer.canUse, false);
        assert.equal(offer.blocked, null);
        assert.equal(offer.purchased, null);
      }
    }
  }
  await Promise.all([f.restart().continueRoomAutomatic(f.code, clock), f.restart().continueRoomAutomatic(f.code, clock)]);
  assert.deepEqual(row(f), before, 'restart/refresh cannot consume an optional response');
  assert.equal(totalChanges(f.sqlite), changes);
  inventory(f, g);
}
function settled(f: Fixture, g: Game, used: boolean) {
  assert.equal(viewGame(g, f.buyer).nexusIxianReplacement, null);
  assert.equal(player(g, f.buyer).spice, f.paidSpice, 'original funded payment is not repeated or refunded');
  const emperor = g.players.find(p => p.faction === 'emperor');
  assert.ok(emperor);
  const paid = f.beforeSpice - f.paidSpice;
  assert.equal(emperor.spice, player(f.beforePayment, emperor.id).spice + paid,
    'native Emperor sale income runs exactly once');
  const original = player(f.initial, f.buyer).hand.map(card => card.id);
  const expected = used ? original.filter(id => id !== f.purchased.id).concat(f.initial.deck[0].id) : original;
  assert.deepEqual(player(g, f.buyer).hand.map(card => card.id).sort(), expected.sort());
  assert.equal(g.nexusCards!.cards!.hands[f.buyer], used ? null : 'ixians');
  assert.equal(g.nexusCards!.cards!.discard.filter(face => face === 'ixians').length, Number(used));
  assert.equal(g.discard.filter(card => card.id === f.purchased.id).length, Number(used));
  assert.equal(g.currentAuctionSale, null);
  if (g.auction) assert.equal(g.auction.index, f.initial.auction!.index + 1);
  inventory(f, g);
}

for (const advanced of [false, true]) {
  for (const karama of [false, true]) {
    for (const used of [false, true]) {
      void test(`SQLite ${advanced ? 'Advanced' : 'Basic'} ${karama ? 'printed Karama' : 'paid'} purchase ${used ? 'Use' : 'Pass'} survives auth restart and runs its original suffix once`, async t => {
        const f = await fixture(t, { advanced, karama });
        assert.equal(player(f.initial, f.buyer).spice, f.paidSpice);
        await restored(f, f.initial);
        const closed = await act(f, f.initial, used ? use(f.event) : pass(f.event));
        assert.equal(closed.version, f.initial.version + 1);
        await restored(f, closed);
        const done = await closeSale(f, closed);
        settled(f, done, used);
        await restored(f, done);
        for (const action of [pass(f.event), use(f.event)])
          await rejected(f, done, await authenticate(f, f.buyer), action);
      });
    }
  }
}

void test('SQLite competing Pass/Use CAS commits one replacement outcome and one original auction suffix', async t => {
  const f = await fixture(t);
  let arrivals = 0;
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  f.hooks.beforeWrite = async () => {
    if (++arrivals === 2) release();
    await gate;
  };
  let results: PromiseSettledResult<unknown>[];
  try {
    const auth = await authenticate(f, f.buyer);
    results = await Promise.allSettled([pass(f.event), use(f.event)].map(action =>
      f.restart().act(f.code, auth, f.initial.version, action, clock).finally(release)));
  } finally {
    delete f.hooks.beforeWrite;
  }
  assert.equal(arrivals, 2);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(results.filter(result => result.status === 'rejected').length, 1);
  assert.deepEqual(f.writes.map(write => write.changes).sort((one, two) => one - two), [0, 1]);
  const closed = await f.restart().readRoom(f.code);
  assert.equal(closed.version, f.initial.version + 1);
  await restored(f, closed);
  const done = await closeSale(f, closed);
  settled(f, done, results[1].status === 'fulfilled');
  await restored(f, done);
});

void test('SQLite stale, wrong buyer, foreign seat, substituted hand card and unknown payload reject without durable writes', async t => {
  const f = await fixture(t);
  const buyer = await authenticate(f, f.buyer);
  const other = f.auths.find(auth => auth.playerId !== f.buyer)!;
  const foreign = await f.restart().authenticate(f.unrelatedCode, f.unrelatedToken);
  const changes = totalChanges(f.sqlite), before = row(f);
  await assert.rejects(f.restart().authenticate(f.code, f.unrelatedToken));
  await assert.rejects(f.restart().readSeatView(f.code, foreign));
  await assert.rejects(f.restart().readSeatView(f.code, { playerId: f.buyer, tokenHash: foreign.tokenHash }));
  assert.equal(totalChanges(f.sqlite), changes);
  assert.deepEqual(row(f), before);
  await rejected(f, f.initial, buyer, use(f.event), f.initial.version - 1);
  await rejected(f, f.initial, foreign, use(f.event));
  await rejected(f, f.initial, other, pass(f.event));
  await rejected(f, f.initial, other, use(f.event));
  for (const action of [pass(`${f.event}:expired`), use(`${f.event}:expired`),
    { ...use(f.event), card: player(f.initial, f.buyer).hand.find(card => card.id !== f.purchased.id)!.id },
    { ...use(f.event), price: 0 }, { ...pass(f.event), recipient: f.buyer }])
    await rejected(f, f.initial, buyer, action as Action);
  await restored(f, f.initial);
});

void test('SQLite cached authentication revoked after restart cannot inspect or consume the purchase', async t => {
  const f = await fixture(t);
  const cached = await authenticate(f, f.buyer);
  f.sqlite.prepare('UPDATE seats SET revoked=1 WHERE room_code=? AND player_id=?').run(f.code, f.buyer);
  f.credentialRows = credentials(f.sqlite);
  const before = row(f), changes = totalChanges(f.sqlite);
  const index = f.auths.findIndex(auth => auth.playerId === f.buyer);
  await assert.rejects(f.restart().authenticate(f.code, f.tokens[index]));
  await assert.rejects(f.restart().readSeatView(f.code, cached));
  await rejected(f, f.initial, cached, use(f.event));
  await rejected(f, f.initial, cached, pass(f.event));
  assert.deepEqual(row(f), before);
  assert.equal(totalChanges(f.sqlite), changes);
});

void test('SQLite neutral purchase response reveals no relevant-face distinction to other seats', async t => {
  const f = await fixture(t);
  // Vary only the owned physical face in the same genuine pre-payment
  // parent, then let the original native payment authorize its own receipt.
  const alternateParent = structuredClone(f.beforePayment);
  const cards = alternateParent.nexusCards!.cards!;
  const index = cards.deck.indexOf('richese');
  assert.ok(index >= 0);
  assert.equal(cards.hands[f.buyer], 'ixians');
  cards.hands[f.buyer] = 'richese';
  cards.deck[index] = 'ixians';
  f.save(alternateParent);
  await f.restart().act(f.code, await authenticate(f, f.buyer), alternateParent.version,
    f.paymentAction, clock);
  const irrelevant = await f.restart().readRoom(f.code);
  assert.equal(irrelevant.version, f.initial.version);
  assert.equal(viewGame(irrelevant, f.buyer).nexusIxianReplacement!.event, f.event);
  f.writes.length = 0;
  await restored(f, irrelevant);
  for (const auth of f.auths) {
    const original = viewGame(f.initial, auth.playerId);
    const changed = await f.restart().readSeatView(f.code, await authenticate(f, auth.playerId));
    if (auth.playerId !== f.buyer) assert.deepEqual(plain(changed), plain(original));
    else {
      assert.equal(changed.nexusIxianReplacement!.canPass, true);
      assert.equal(changed.nexusIxianReplacement!.canUse, false);
      assert.deepEqual(changed.nexusIxianReplacement!.purchased, original.nexusIxianReplacement!.purchased);
    }
  }
  await rejected(f, irrelevant, await authenticate(f, f.buyer), use(f.event));
  const done = await act(f, irrelevant, pass(f.event));
  assert.equal(player(done, f.buyer).spice, f.paidSpice);
  assert.equal(done.nexusCards!.cards!.hands[f.buyer], 'richese');
  assert.equal(player(done, f.buyer).hand.some(card => card.id === f.purchased.id), true);
  await restored(f, done);
});

void test('SQLite current purchase source, parent, canonical face and exact owned reservation reject corruption before disclosure or writes', async t => {
  const f = await fixture(t);
  const mutations: { name: string; change: (g: Game) => void }[] = [
    { name: 'missing source', change: g => { delete g.pendingNexusIxianReplacement; } },
    { name: 'missing history', change: g => { delete g.nexusIxianReplacementHistory; } },
    { name: 'missing cursor', change: g => { delete g.nexusIxianReplacementCursor; } },
    { name: 'cursor sequence', change: g => { g.nexusIxianReplacementCursor!.sequence++; } },
    { name: 'source parent', change: g => { g.pendingNexusIxianReplacement!.parent += ':forged'; } },
    { name: 'source amount', change: g => { g.pendingNexusIxianReplacement!.amount++; } },
    { name: 'source payment method', change: g => { g.pendingNexusIxianReplacement!.free = true; } },
    { name: 'source canonical descriptor', change: g => { g.pendingNexusIxianReplacement!.card.name += ' forged'; } },
    { name: 'source buyer', change: g => {
      g.pendingNexusIxianReplacement!.buyer = g.players.find(p => p.id !== f.buyer)!.id;
    } },
    { name: 'native amount', change: g => { g.auction!.bid++; } },
    { name: 'native sale amount', change: g => { g.currentAuctionSale!.amount++; } },
    { name: 'native source origin', change: g => { g.currentAuctionSale!.origin = 'cache'; } },
    { name: 'native reserved lot', change: g => { g.auction!.cards[g.auction!.index] = structuredClone(g.deck[0]); } },
    { name: 'held canonical face', change: g => {
      player(g, f.buyer).hand.find(card => card.id === f.purchased.id)!.name += ' forged';
    } },
    { name: 'lost exact purchased custody', change: g => {
      const owner = player(g, f.buyer);
      const index = owner.hand.findIndex(card => card.id === f.purchased.id);
      assert.ok(index >= 0);
      player(g, g.players.find(p => p.id !== f.buyer)!.id).hand.push(...owner.hand.splice(index, 1));
    } },
    { name: 'duplicated exact purchased custody', change: g => {
      g.deck.push(structuredClone(player(g, f.buyer).hand.find(card => card.id === f.purchased.id)!));
    } },
  ];
  for (const { name, change } of mutations) {
    const corrupt = structuredClone(f.initial);
    change(corrupt);
    f.save(corrupt);
    f.writes.length = 0;
    const before = row(f), changes = totalChanges(f.sqlite), original = plain(corrupt);
    for (const auth of f.auths)
      await assert.rejects(f.restart().readSeatView(f.code, await authenticate(f, auth.playerId)), name);
    for (const action of [use(f.event), pass(f.event), { type: 'passBid' } as Action])
      await rejected(f, corrupt, await authenticate(f, f.buyer), action);
    await Promise.allSettled([f.restart().continueRoomAutomatic(f.code, clock)]);
    assert.deepEqual(row(f), before, name);
    assert.equal(totalChanges(f.sqlite), changes, name);
    assert.equal(f.writes.length, 0, name);
    assert.deepEqual(corrupt, original, 'recovery never mutates the caller snapshot');
    protectedRows(f);
  }
});

for (const used of [false, true]) {
  void test(`SQLite closed normal auction retains its canonical ${used ? 'replacement' : 'pass'} source history after card and Nexus recycling`, async t => {
    const f = await fixture(t, { endingAuction: true });
    const closed = await act(f, f.initial, used ? use(f.event) : pass(f.event));
    await restored(f, closed);
    const done = await closeSale(f, closed);
    assert.equal(done.auction, null, 'the normal auction actually closes');
    assert.equal(done.currentAuctionSale, null);
    assert.equal(done.nexusIxianReplacementHistory!.length, 1);
    const receipt = done.nexusIxianReplacementHistory![0];
    assert.equal(receipt.outcome, used ? 'use' : 'pass');
    assert.deepEqual(receipt.source, f.initial.pendingNexusIxianReplacement);
    assert.deepEqual(receipt.source.card, f.purchased);
    assert.equal(receipt.source.amount, f.beforePayment.auction!.bid);
    assert.equal(receipt.source.free, false);
    assert.equal(receipt.source.buyer, f.buyer);
    assert.equal(receipt.source.auctionIndex, f.auctionIndex);
    await restored(f, done);
    const later = structuredClone(done);
    // Conserved physical recycling models later custody, without recreating
    // components or altering a historical receipt's original source.
    if (used) {
      const index = later.discard.findIndex(card => card.id === f.purchased.id);
      assert.ok(index >= 0);
      later.deck.push(...later.discard.splice(index, 1));
      const nexus = later.nexusCards!.cards!;
      const nexusIndex = nexus.discard.indexOf('ixians');
      assert.ok(nexusIndex >= 0);
      nexus.deck.push(...nexus.discard.splice(nexusIndex, 1));
    } else {
      const owner = player(later, f.buyer);
      const index = owner.hand.findIndex(card => card.id === f.purchased.id);
      assert.ok(index >= 0);
      player(later, later.players.find(p => p.id !== f.buyer)!.id).hand.push(...owner.hand.splice(index, 1));
    }
    f.save(later);
    f.writes.length = 0;
    await restored(f, later);
    assert.deepEqual(later.nexusIxianReplacementHistory, done.nexusIxianReplacementHistory);
    for (const action of [use(f.event), pass(f.event)])
      await rejected(f, later, await authenticate(f, f.buyer), action);
    for (const change of [
      (g: Game) => { g.nexusIxianReplacementHistory = []; },
      (g: Game) => { delete g.nexusIxianReplacementCursor; },
      (g: Game) => { g.nexusIxianReplacementHistory![0].source.amount++; },
      (g: Game) => { g.nexusIxianReplacementHistory![0].source.card.name += ' forged'; },
      (g: Game) => { g.nexusIxianReplacementHistory![0].source.parent += ':forged'; },
      (g: Game) => { g.nexusIxianReplacementHistory![0].signature += ':forged'; },
    ]) {
      const corrupt = structuredClone(later);
      change(corrupt);
      f.save(corrupt);
      f.writes.length = 0;
      const before = row(f), changes = totalChanges(f.sqlite);
      for (const auth of f.auths)
        await assert.rejects(f.restart().readSeatView(f.code, await authenticate(f, auth.playerId)));
      await rejected(f, corrupt, await authenticate(f, f.buyer), use(f.event));
      assert.deepEqual(row(f), before);
      assert.equal(totalChanges(f.sqlite), changes);
      assert.equal(f.writes.length, 0);
    }
  });
}

void test('SQLite credential revocation racing the final replacement CAS leaves the purchased source and all cards untouched', async t => {
  const f = await fixture(t);
  const auth = await authenticate(f, f.buyer);
  const before = row(f), changes = totalChanges(f.sqlite);
  let revoked = false;
  f.hooks.beforeWrite = async () => {
    assert.equal(revoked, false);
    revoked = true;
    assert.equal(f.sqlite.prepare('UPDATE seats SET revoked=1 WHERE room_code=? AND player_id=?')
      .run(f.code, f.buyer).changes, 1);
    f.credentialRows = credentials(f.sqlite);
  };
  try {
    await assert.rejects(f.restart().act(f.code, auth, f.initial.version, use(f.event), clock));
  } finally {
    delete f.hooks.beforeWrite;
  }
  assert.equal(revoked, true);
  assert.deepEqual(f.writes.map(write => write.changes), [0]);
  assert.equal(totalChanges(f.sqlite), Number(changes) + 1, 'only the deliberate credential revocation is durable');
  assert.deepEqual(row(f), before);
  const recovered = await f.restart().readRoom(f.code);
  assert.deepEqual(plain(recovered), plain(f.initial));
  inventory(f, recovered);
  await assert.rejects(f.restart().readSeatView(f.code, auth));
});
