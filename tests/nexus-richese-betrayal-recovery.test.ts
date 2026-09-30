import assert from 'node:assert/strict';
import test from 'node:test';
import type { DatabaseSync, SQLOutputValue } from 'node:sqlite';
import { viewGame, type Action, type Game } from '../game/engine';
import { NEXUS_FACTIONS, validateNexusCards } from '../game/nexus-cards';
import type { RoomsClock, SeatAuth } from '../db/rooms';
import type * as Rooms from '../db/rooms';
import { unitStore } from './fixture-nexus-room-store';
import {
  createRicheseBetrayalFixture,
  RICHESE_BETRAYAL_FIXTURE_FACTIONS,
  type RicheseBetrayalFixture,
  type RicheseBetrayalFixtureOptions,
} from './fixture-richese-betrayal';

const clock: RoomsClock = { now: () => 10000, sleep: async () => {} };
type Kind = 'purchase' | 'sale';
type Options = RicheseBetrayalFixtureOptions;
const plain = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const player = (g: Game, id: string) => {
  const found = g.players.find(p => p.id === id);
  assert.ok(found);
  return found;
};

function physical(g: Game) {
  const ids = [
    ...g.deck, ...g.discard, ...(g.richeseCache ?? []),
    ...(g.richeseRemoved ?? []), ...g.players.flatMap(p => p.hand),
    ...(g.auction?.cards.slice(g.auction.index) ?? []),
  ].map(card => card.id).sort();
  assert.equal(new Set(ids).size, ids.length, 'physical Treachery custody is unique');
  return ids;
}
function nexusInventory(g: Game) {
  assert.ok(g.nexusCards?.cards);
  const cards = g.nexusCards.cards;
  validateNexusCards(cards, g.players);
  assert.deepEqual([
    ...cards.deck, ...cards.discard,
    ...Object.values(cards.hands).filter(card => card !== null),
  ].sort(), [...NEXUS_FACTIONS].sort());
}
function credentials(sqlite: DatabaseSync) {
  return {
    seats: sqlite.prepare('SELECT * FROM seats ORDER BY room_code,player_id,token_hash').all(),
    keys: sqlite.prepare('SELECT * FROM seat_recovery_keys ORDER BY room_code,player_id').all(),
    receipts: sqlite.prepare('SELECT * FROM seat_recovery_receipts ORDER BY room_code,player_id,operation_hash').all(),
  };
}

async function fixture(t: test.TestContext, kind: Kind, options: Options = {}): Promise<Fixture> {
  const store = unitStore();
  t.after(() => store.sqlite.close());
  const [host, ...rest] = RICHESE_BETRAYAL_FIXTURE_FACTIONS;
  const made = await store.rooms.createRoom('Richese Betrayal SQL', host, options.advanced ?? true, ['choam']);
  const code = made.view.code;
  const tokens = [made.token];
  for (const faction of rest)
    tokens.push((await store.rooms.joinRoom(code, faction, faction)).token!);
  const auths = await Promise.all(tokens.map(token => store.rooms.authenticate(code, token)));
  const seatIds = auths.map(auth => auth.playerId);
  const madeGame = createRicheseBetrayalFixture(kind, { ...options, seatIds });
  const initial = madeGame.game;
  initial.code = code;
  initial.version = (await store.rooms.readRoom(code)).version;
  const save = (g: Game) => store.sqlite.prepare('UPDATE rooms SET state = ?, version = ? WHERE code = ?')
    .run(JSON.stringify(g), g.version, code);
  save(initial);
  const unrelated = await store.rooms.createRoom('Unrelated preserved room', 'atreides', false, []);
  const unrelatedRow = store.sqlite.prepare('SELECT * FROM rooms WHERE code = ?').get(unrelated.view.code);
  const credentialRows = credentials(store.sqlite);
  const stock = physical(initial);
  nexusInventory(initial);
  store.writes.length = 0;
  return { ...store, ...madeGame, code, tokens, auths, initial, save, stock, credentialRows,
    unrelatedCode: unrelated.view.code, unrelatedToken: unrelated.token, unrelatedRow };
}
type SqlRow = Record<string, SQLOutputValue>;
interface Fixture extends RicheseBetrayalFixture {
  code: string;
  tokens: string[];
  auths: SeatAuth[];
  initial: Game;
  save(g: Game): void;
  stock: string[];
  credentialRows: { seats: SqlRow[]; keys: SqlRow[]; receipts: SqlRow[] };
  unrelatedCode: string;
  unrelatedToken: string;
  unrelatedRow: SqlRow | undefined;
  sqlite: DatabaseSync;
  restart(): typeof Rooms;
  hooks: { beforeWrite?: () => Promise<void> };
  writes: { expected: number; changes: number }[];
}
const row = (f: Fixture) => f.sqlite.prepare('SELECT * FROM rooms WHERE code = ?').get(f.code);
function protectedRows(f: Fixture) {
  assert.deepEqual(credentials(f.sqlite), f.credentialRows);
  assert.deepEqual(f.sqlite.prepare('SELECT * FROM rooms WHERE code = ?').get(f.unrelatedCode), f.unrelatedRow);
}
function inventory(f: Fixture, g: Game) {
  assert.deepEqual(physical(g), f.stock);
  nexusInventory(g);
  protectedRows(f);
}
async function authenticate(f: Fixture, id: string) {
  const index = f.auths.findIndex(auth => auth.playerId === id);
  assert.ok(index >= 0);
  const auth = await f.restart().authenticate(f.code, f.tokens[index]);
  // Authorization is the credential's values, not its realm/prototype or brand.
  assert.equal(auth.playerId, id);
  assert.equal(auth.tokenHash, f.auths[index].tokenHash);
  return auth;
}
async function act(f: Fixture, id: string, action: Action) {
  const rooms = f.restart();
  const current = await rooms.readRoom(f.code);
  await rooms.act(f.code, await authenticate(f, id), current.version, action, clock);
  return f.restart().readRoom(f.code);
}
const pass = (event: string): Action => ({ type: 'richeseBetrayalPass', event });
const use = (event: string): Action => ({ type: 'richeseBetrayalUse', event });
function publicReaction(g: Game, id: string) {
  const reaction = viewGame(g, id).richeseBetrayalReaction;
  assert.ok(reaction);
  const { event, kind, target, buyer, source, price } = reaction;
  return { event, kind, target, buyer, source, price };
}

async function restored(f: Fixture, g: Game) {
  const before = row(f);
  const writeCount = f.writes.length;
  for (const [index, token] of f.tokens.entries()) {
    const rooms = f.restart();
    const auth = await rooms.authenticate(f.code, token);
    assert.equal(auth.playerId, f.auths[index].playerId);
    assert.equal(auth.tokenHash, f.auths[index].tokenHash);
    const view = await rooms.readSeatView(f.code, auth);
    assert.deepEqual(plain(view), plain(viewGame(g, auth.playerId)));
    assert.equal(view.richeseBetrayalPreview, true);
    for (const key of ['pendingRicheseBetrayal', 'richeseBetrayal'])
      assert.equal(Object.hasOwn(view, key), false, 'receipt/cursor stays private');
    for (const rival of view.players.filter(p => p.id !== auth.playerId)) {
      assert.equal(Object.hasOwn(rival, 'hand'), false);
      assert.equal(Object.hasOwn(rival, 'traitors'), false);
      assert.equal(Object.hasOwn(rival, 'spice'), false);
    }
    if (view.richeseBetrayalReaction) {
      assert.deepEqual(publicReaction(g, auth.playerId), publicReaction(g, f.holder));
      assert.deepEqual(Object.keys(view.richeseBetrayalReaction).sort(), [
        'event', 'kind', 'target', 'buyer', 'source', 'price',
        'canPass', 'hasPassed', 'canUse', 'blocked',
      ].sort());
      assert.equal(view.richeseBetrayalReaction.canUse,
        auth.playerId === f.holder && g.nexusCards!.cards!.hands[f.holder] === 'richese' &&
        !view.richeseBetrayalReaction.hasPassed);
      if (view.richeseBetrayalReaction.source === 'blackMarket' && auth.playerId !== f.target) {
        assert.equal(view.richeseAuction?.card ?? null, null);
        assert.equal(JSON.stringify(view).includes(f.card), false, 'concealed lot identity stays unentitled');
      }
    }
  }
  await Promise.all([f.restart().continueRoomAutomatic(f.code, clock),
    f.restart().continueRoomAutomatic(f.code, clock)]);
  assert.deepEqual(row(f), before, 'refresh/recovery cannot acknowledge a human opportunity');
  assert.equal(f.writes.length, writeCount);
  inventory(f, g);
}
async function passOthers(f: Fixture, g: Game) {
  for (const p of g.players) {
    if (p.id === f.holder) continue;
    const reaction = viewGame(g, p.id).richeseBetrayalReaction;
    if (reaction?.canPass) g = await act(f, p.id, pass(reaction.event));
  }
  assert.equal(viewGame(g, f.holder).richeseBetrayalReaction?.canPass, true);
  return g;
}
async function allPass(f: Fixture, g: Game) {
  g = await passOthers(f, g);
  await restored(f, g);
  return act(f, f.holder, pass(f.event));
}
function spentOnce(f: Fixture, g: Game) {
  assert.equal(g.nexusCards!.cards!.hands[f.holder], null);
  assert.equal(g.nexusCards!.cards!.discard.filter(card => card === 'richese').length, 1);
  assert.equal(g.richeseBetrayal!.completed.length, 1);
  assert.equal(g.richeseBetrayal!.completed[0].stage, 'used');
  assert.equal(viewGame(g, f.holder).richeseBetrayalReaction, null);
}
function vetoed(f: Fixture, g: Game) {
  spentOnce(f, g);
  assert.deepEqual(g.players.map(p => [p.id, p.spice]), f.initial.players.map(p => [p.id, p.spice]));
  for (const p of g.players) assert.deepEqual(p.hand, player(f.initial, p.id).hand);
  assert.equal(g.discard.filter(card => card.id === f.card).length, 1);
  assert.equal(g.richeseCache!.some(card => card.id === f.card), false);
  assert.notEqual(g.richeseAuction?.event, f.initial.richeseAuction!.event);
  inventory(f, g);
}
function sold(f: Fixture, g: Game, diverted: boolean, allyPayment = 0) {
  const invoice = publicReaction(f.initial, f.holder);
  assert.equal(player(g, f.buyer).spice, player(f.initial, f.buyer).spice - invoice.price + allyPayment);
  assert.equal(player(g, f.target).spice, player(f.initial, f.target).spice + (diverted ? 0 : invoice.price));
  if (allyPayment) {
    const ally = player(f.initial, f.buyer).ally!;
    assert.equal(player(g, ally).spice, player(f.initial, ally).spice);
    assert.equal(g.aid[ally].amount, f.initial.aid[ally].amount - allyPayment);
  }
  for (const p of g.players) {
    if ([f.buyer, f.target, player(f.initial, f.buyer).ally].includes(p.id)) continue;
    assert.equal(p.spice, player(f.initial, p.id).spice);
  }
  const total = (game: Game) => game.players.reduce((sum, p) => sum + p.spice, 0) +
    Object.values(game.aid).reduce((sum, credit) => sum + credit.amount, 0);
  assert.equal(total(g), total(f.initial) - (diverted ? invoice.price : 0),
    'bank receives the original payment, not a second charge');
  const buyer = player(g, f.buyer);
  const bonus = f.initial.deck[0].id;
  assert.equal(buyer.faction, 'harkonnen');
  assert.deepEqual(buyer.hand.map(card => card.id).sort(),
    [...player(f.initial, f.buyer).hand.map(card => card.id), f.card, bonus].sort());
  assert.equal(g.deck.some(card => card.id === bonus), false);
  assert.equal(player(g, f.target).hand.some(card => card.id === f.card), false);
  assert.notEqual(g.richeseAuction?.event, f.initial.richeseAuction!.event);
  inventory(f, g);
}

for (const advanced of [false, true]) {
  void test(`SQLite saved ${advanced ? 'Advanced' : 'Basic'} cache veto discards its exact lot without debit or acquisition`, async t => {
    const f = await fixture(t, 'purchase', { advanced });
    await restored(f, f.initial);
    assert.equal(player(f.initial, f.target).hand.some(card => card.id === f.card), false);
    assert.equal(f.initial.richeseCache!.some(card => card.id === f.card), true);
    const done = await act(f, f.holder, use(f.event));
    assert.equal(done.version, f.initial.version + 1);
    vetoed(f, done);
    await restored(f, done);
    const before = row(f), writes = f.writes.length;
    await assert.rejects(f.restart().act(f.code, await authenticate(f, f.holder), done.version, use(f.event), clock));
    assert.deepEqual(row(f), before);
    assert.equal(f.writes.length, writes);
  });
}

for (const scenario of [
  { source: 'cache', advanced: false, allyPayment: 0 },
  { source: 'cache', advanced: true, allyPayment: 2 },
  { source: 'blackMarket', advanced: true, allyPayment: 2 },
] as const) {
  void test(`SQLite saved ${scenario.advanced ? 'Advanced' : 'Basic'} ${scenario.source} sale diversion preserves original payers, card and one Harkonnen bonus`, async t => {
    const f = await fixture(t, 'sale', scenario);
    await restored(f, f.initial);
    const done = await act(f, f.holder, use(f.event));
    spentOnce(f, done);
    sold(f, done, true, scenario.allyPayment);
    await restored(f, done);
    const before = row(f), writes = f.writes.length;
    for (const action of [use(f.event), pass(f.event)])
      await assert.rejects(f.restart().act(f.code, await authenticate(f, f.holder), done.version, action, clock));
    assert.deepEqual(row(f), before);
    assert.equal(f.writes.length, writes);
  });
}

for (const kind of ['purchase', 'sale'] as const) {
  void test(`SQLite saved all-pass ${kind} performs the original quoted settlement once without consuming Nexus`, async t => {
    const f = await fixture(t, kind);
    const invoice = publicReaction(f.initial, f.holder);
    const done = await allPass(f, f.initial);
    assert.equal(done.nexusCards!.cards!.hands[f.holder], 'richese');
    assert.equal(done.nexusCards!.cards!.discard.includes('richese'), false);
    assert.equal(viewGame(done, f.holder).richeseBetrayalReaction, null);
    assert.equal(done.richeseBetrayal!.completed.length, 1);
    assert.equal(done.richeseBetrayal!.completed[0].stage, 'passed');
    if (kind === 'sale') sold(f, done, false);
    else {
      assert.equal(player(done, f.target).spice, player(f.initial, f.target).spice - invoice.price);
      assert.deepEqual(player(done, f.target).hand.map(card => card.id).sort(),
        [...player(f.initial, f.target).hand.map(card => card.id), f.card].sort());
      assert.equal(done.discard.some(card => card.id === f.card), false);
      assert.equal(done.richeseCache!.some(card => card.id === f.card), false);
      for (const p of done.players.filter(p => p.id !== f.target))
        assert.equal(p.spice, player(f.initial, p.id).spice);
      inventory(f, done);
    }
    await restored(f, done);
    const before = row(f), writes = f.writes.length;
    await assert.rejects(f.restart().act(f.code, await authenticate(f, f.holder), done.version, pass(f.event), clock));
    assert.deepEqual(row(f), before);
    assert.equal(f.writes.length, writes);
  });
}

for (const kind of ['purchase', 'sale'] as const) {
  void test(`SQLite competing final pass/use ${kind} CAS commits one original settlement after restart`, async t => {
    const f = await fixture(t, kind);
    const pending = await passOthers(f, f.initial);
    await restored(f, pending);
    f.writes.length = 0;
    let arrivals = 0;
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    f.hooks.beforeWrite = async () => {
      if (++arrivals === 2) release();
      await gate;
    };
    let results: PromiseSettledResult<unknown>[];
    try {
      const auth = await authenticate(f, f.holder);
      results = await Promise.allSettled([pass(f.event), use(f.event)].map(action =>
        f.restart().act(f.code, auth, pending.version, action, clock).finally(release)));
    } finally {
      delete f.hooks.beforeWrite;
    }
    assert.equal(arrivals, 2);
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(results.filter(result => result.status === 'rejected').length, 1);
    assert.deepEqual(f.writes.map(write => write.changes).sort((a,b) => a - b), [0, 1]);
    const done = await f.restart().readRoom(f.code);
    assert.equal(done.version, pending.version + 1);
    const used = results[1].status === 'fulfilled';
    assert.equal(done.nexusCards!.cards!.hands[f.holder], used ? null : 'richese');
    assert.equal(done.richeseBetrayal!.completed.length, 1);
    assert.equal(done.richeseBetrayal!.completed[0].stage, used ? 'used' : 'passed');
    if (used) spentOnce(f, done);
    if (kind === 'sale') sold(f, done, used);
    else if (used) vetoed(f, done);
    else {
      assert.equal(player(done, f.target).spice,
        player(f.initial, f.target).spice - publicReaction(f.initial, f.holder).price);
      assert.equal(player(done, f.target).hand.filter(card => card.id === f.card).length, 1);
    }
    await restored(f, done);
  });
}

void test('SQLite stale, foreign-seat, forged invoice and wrong-event reactions reject before writes and preserve real credentials', async t => {
  const f = await fixture(t, 'purchase');
  const rooms = f.restart();
  const before = row(f);
  const holder = await authenticate(f, f.holder);
  const foreign = await rooms.authenticate(f.unrelatedCode, f.unrelatedToken);
  await assert.rejects(rooms.authenticate(f.code, f.unrelatedToken));
  await assert.rejects(rooms.readSeatView(f.code, foreign));
  await assert.rejects(rooms.readSeatView(f.code, { playerId: f.holder, tokenHash: foreign.tokenHash }));
  const requests: { auth: SeatAuth; version: number; action: Action }[] = [
    { auth: holder, version: f.initial.version - 1, action: use(f.event) },
    { auth: foreign, version: f.initial.version, action: use(f.event) },
    { auth: await authenticate(f, f.target), version: f.initial.version, action: use(f.event) },
    { auth: holder, version: f.initial.version, action: use(`${f.event}:stale`) },
    { auth: holder, version: f.initial.version, action: pass(`${f.event}:stale`) },
    { auth: holder, version: f.initial.version,
      action: { ...use(f.event), card: f.card, price: 0, recipient: f.holder } as Action },
  ];
  for (const request of requests) {
    await assert.rejects(rooms.act(f.code, request.auth, request.version, request.action, clock));
    assert.deepEqual(row(f), before);
    assert.equal(f.writes.length, 0);
    protectedRows(f);
  }
  const pending = await passOthers(f, f.initial);
  const saved = row(f), writes = f.writes.length;
  if (pending.version !== f.initial.version)
    await assert.rejects(rooms.act(f.code, holder, f.initial.version, use(f.event), clock));
  const otherReaction = viewGame(pending, f.other).richeseBetrayalReaction;
  if (otherReaction?.hasPassed)
    await assert.rejects(rooms.act(f.code, await authenticate(f, f.other), pending.version, pass(f.event), clock));
  assert.deepEqual(row(f), saved);
  assert.equal(f.writes.length, writes);
  await restored(f, pending);
});

void test('SQLite neutral acknowledgement and all-seat public invoice survive hidden relevant/nonrelevant Nexus substitution', async t => {
  const f = await fixture(t, 'sale');
  const irrelevant = structuredClone(f.initial);
  const cards = irrelevant.nexusCards!.cards!;
  const replacement = cards.deck.indexOf('choam');
  assert.ok(replacement >= 0);
  assert.equal(cards.hands[f.holder], 'richese');
  cards.hands[f.holder] = 'choam';
  cards.deck[replacement] = 'richese';
  f.save(irrelevant);
  f.writes.length = 0;
  await restored(f, irrelevant);
  for (const auth of f.auths) {
    const original = viewGame(f.initial, auth.playerId).richeseBetrayalReaction!;
    const changed = (await f.restart().readSeatView(f.code,
      await authenticate(f, auth.playerId))).richeseBetrayalReaction!;
    assert.deepEqual(publicReaction(irrelevant, auth.playerId), publicReaction(f.initial, auth.playerId));
    assert.equal(changed.canPass, original.canPass);
    assert.equal(changed.hasPassed, original.hasPassed);
    assert.equal(changed.canUse, false);
    if (auth.playerId !== f.holder) assert.deepEqual(plain(changed), plain(original));
  }
  const saved = row(f);
  await assert.rejects(f.restart().act(f.code, await authenticate(f, f.holder),
    irrelevant.version, use(f.event), clock));
  assert.deepEqual(row(f), saved);
  assert.equal(f.writes.length, 0);
  const done = await allPass(f, irrelevant);
  sold(f, done, false);
  assert.equal(done.nexusCards!.cards!.hands[f.holder], 'choam');
  await restored(f, done);
});

for (const kind of ['purchase', 'sale'] as const) {
  void test(`SQLite corrupt/orphaned saved ${kind} receipts reject all-seat disclosure and settlement before writes`, async t => {
    const f = await fixture(t, kind);
    const mutations: { name: string; change(this: void, g: Game): void }[] = [
      { name: 'deleted frame with independent pending cursor', change: g => { delete g.pendingRicheseBetrayal; } },
      { name: 'deleted cursor with orphan frame', change: g => { delete g.richeseBetrayal; } },
      { name: 'detached cursor event', change: g => { g.richeseBetrayal!.current = null; } },
      { name: 'lost pending sequence', change: g => { g.richeseBetrayal!.sequence = 0; } },
      { name: 'changed public price', change: g => { g.pendingRicheseBetrayal!.receipt.invoice.price++; } },
      { name: 'changed payer split', change: g => { g.pendingRicheseBetrayal!.receipt.invoice.ownPayment++; } },
      { name: 'changed physical face', change: g => { g.pendingRicheseBetrayal!.receipt.invoice.card.name += ' forged'; } },
      { name: 'foreign buyer', change: g => { g.pendingRicheseBetrayal!.receipt.invoice.buyer = f.holder; } },
      { name: 'changed source quote', change: g => { g.pendingRicheseBetrayal!.quote.amount++; } },
      { name: 'changed original lot', change: g => { g.pendingRicheseBetrayal!.lot.cardId = g.deck[0].id; } },
      { name: 'foreign required acknowledgement', change: g => { g.pendingRicheseBetrayal!.receipt.required.push(f.target); } },
      { name: 'forged pass', change: g => { g.pendingRicheseBetrayal!.receipt.passed.push(f.holder); } },
      { name: 'lost exact source custody', change: g => {
        if (kind === 'purchase') {
          const index = g.richeseCache!.findIndex(card => card.id === f.card);
          assert.ok(index >= 0);
          player(g, f.other).hand.push(...g.richeseCache!.splice(index, 1));
        } else {
          const owner = player(g, f.target);
          const index = owner.hand.findIndex(card => card.id === f.card);
          assert.ok(index >= 0);
          player(g, f.other).hand.push(...owner.hand.splice(index, 1));
        }
      } },
    ];
    for (const { name, change } of mutations) {
      const corrupt = structuredClone(f.initial);
      change(corrupt);
      f.save(corrupt);
      f.writes.length = 0;
      const saved = row(f);
      for (const auth of f.auths)
        await assert.rejects(f.restart().readSeatView(f.code,
          await authenticate(f, auth.playerId)), name);
      for (const action of [pass(f.event), use(f.event)])
        await assert.rejects(f.restart().act(f.code, await authenticate(f, f.holder),
          corrupt.version, action, clock), name);
      await Promise.allSettled([f.restart().continueRoomAutomatic(f.code, clock)]);
      assert.deepEqual(row(f), saved, name);
      assert.equal(f.writes.length, 0, name);
      protectedRows(f);
    }
  });
}

void test('SQLite completed veto history survives later physical card movement but not deleted or corrupted completion evidence', async t => {
  const f = await fixture(t, 'purchase');
  const done = await act(f, f.holder, use(f.event));
  vetoed(f, done);
  const later = structuredClone(done);
  // Model later component recycling without recreating or copying a component.
  const treacheryIndex = later.discard.findIndex(card => card.id === f.card);
  assert.ok(treacheryIndex >= 0);
  later.deck.push(...later.discard.splice(treacheryIndex, 1));
  const cards = later.nexusCards!.cards!;
  const nexusIndex = cards.discard.indexOf('richese');
  assert.ok(nexusIndex >= 0);
  cards.deck.push(...cards.discard.splice(nexusIndex, 1));
  f.save(later);
  f.writes.length = 0;
  await restored(f, later);
  assert.equal(later.richeseBetrayal!.completed[0].stage, 'used');
  const saved = row(f);
  await assert.rejects(f.restart().act(f.code, await authenticate(f, f.holder),
    later.version, use(f.event), clock));
  assert.deepEqual(row(f), saved);
  assert.equal(f.writes.length, 0);
  for (const change of [
    (g: Game) => { g.richeseBetrayal!.completed = []; },
    (g: Game) => { g.richeseBetrayal!.completed[0].invoice.price++; },
    (g: Game) => { delete g.richeseBetrayal; },
  ]) {
    const corrupt = structuredClone(later);
    change(corrupt);
    f.save(corrupt);
    f.writes.length = 0;
    const before = row(f);
    for (const auth of f.auths)
      await assert.rejects(f.restart().readSeatView(f.code, await authenticate(f, auth.playerId)));
    await assert.rejects(f.restart().act(f.code, await authenticate(f, f.holder),
      corrupt.version, use(f.event), clock));
    assert.deepEqual(row(f), before);
    assert.equal(f.writes.length, 0);
    protectedRows(f);
  }
});
