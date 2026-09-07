import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  newPlayer,
  normalizeAutomaticGame,
  viewGame,
  type Action,
  type Game,
} from '../game/engine';
import { baseDeck } from '../game/cards';
import { richeseCards } from '../game/richese-cards';

const player = (g: Game, id: string) => g.players.find((p) => p.id === id)!;
const reload = (g: Game): Game => JSON.parse(JSON.stringify(g));
function inventory(g: Game) {
  const ids = [
    ...g.deck,
    ...g.discard,
    ...g.players.flatMap((p) => p.hand),
    ...(g.richeseCache ?? []),
    ...(g.richeseRemoved ?? []),
    ...(g.auction?.cards.slice(
      g.auction.index + (g.currentAuctionSale ? 1 : 0),
    ) ?? []),
  ]
    .map((c) => c.id)
    .sort();
  assert.equal(new Set(ids).size, ids.length);
  return ids;
}
function action(g: Game, id: string, a: Action) {
  const snapshot = structuredClone(g),
    physical = inventory(g);
  const next = applyAction(g, id, a);
  assert.deepEqual(g, snapshot);
  assert.deepEqual(inventory(next), physical);
  return reload(next);
}
function hold(g: Game, id: string, effect: string, cache = false) {
  const pile = cache ? g.richeseCache! : g.deck;
  const i = pile.findIndex((c) => c.effect === effect || c.kind === effect);
  assert.ok(i >= 0, effect);
  const card = pile.splice(i, 1)[0];
  player(g, id).hand.push(card);
  return card.id;
}
/** Physically conserved isolated Bidding scenario; the BG conversion and every
 * nested interaction below are real production actions, not fabricated stamps. */
function fixture(karamaOwner = 'h') {
  let g = createGame('BGNESTED', newPlayer('b', 'BG', 'beneGesserit'), true, [
    'choam',
  ]);
  g.players.push(
    newPlayer('r', 'Richese', 'richese'),
    newPlayer('e', 'Emperor', 'emperor'),
    newPlayer('h', 'Hark', 'harkonnen'),
  );
  Object.assign(g, {
    status: 'playing',
    phase: 3,
    turn: 2,
    active: 'e',
    order: ['e', 'b', 'r', 'h'],
    deck: baseDeck(),
    richeseCache: richeseCards(),
  });
  for (const p of g.players) {
    p.hand = [];
    p.spice = 20;
    p.forces = {};
    p.reserves = 20;
    p.traitors = [];
    p.traitorChoices = [];
  }
  player(g, 'b').ally = 'r';
  player(g, 'r').ally = 'b';
  const worthless = hold(g, 'b', 'worthless');
  hold(g, 'e', 'karama');
  const special = hold(g, karamaOwner, 'karama');
  // For the purchase-income probe, a second physical Worthless makes the
  // Emperor's nested response cancellable by a non-owner, so it really pauses.
  hold(g, 'b', karamaOwner === 'r' ? 'worthless' : 'shield');
  hold(g, 'b', 'snooper');
  const box = hold(g, 'r', 'nullentropyBox', true),
    gift = hold(g, 'r', 'ornithopter', true);
  hold(g, 'h', 'truthtrance');
  const lot = g.deck.shift()!;
  g.auction = {
    cards: [lot],
    index: 0,
    bid: 0,
    bidder: null,
    active: 'e',
    passed: [],
    opener: 0,
  };
  g = action(g, 'b', { type: 'card', card: worthless, mode: 'purchase' });
  assert.ok(g.pendingKarama?.opportunity);
  assert.equal(g.response?.kind, 'worthlessKarama');
  assert.equal(player(g, 'b').hand.length, 2);
  return { g, worthless, special, box, gift, lot: lot.id };
}
function passKind(initial: Game, kind: NonNullable<Game['response']>['kind']) {
  let g = reload(initial);
  for (let n = 0; g.response?.kind === kind; n++) {
    assert.ok(n < 30);
    g = action(
      g,
      g.players.find((p) => !g.response!.passed.includes(p.id))!.id,
      { type: 'passResponse' },
    );
  }
  return g;
}
function privateViews(g: Game) {
  const before = structuredClone(g);
  for (const p of g.players) {
    const view = viewGame(g, p.id);
    assert.ok(!('pendingKarama' in view));
    assert.equal(JSON.stringify(view).includes('opportunity'), false);
    for (const other of view.players)
      if (other.id !== p.id) assert.equal(other.hand, undefined);
  }
  assert.deepEqual(g, before);
  const normalized = normalizeAutomaticGame(reload(g));
  assert.deepEqual(
    reload(normalizeAutomaticGame(reload(normalized))),
    reload(normalized),
  );
}
function exchange(initial: Game, card: string) {
  const g = action(initial, 'h', {
    type: 'card',
    mode: 'special',
    card,
    target: 'b',
    amount: 1,
  });
  assert.equal(g.decision?.kind, 'handExchange');
  assert.equal(g.response, null);
  assert.equal(g.pendingExchange?.response?.kind, 'worthlessKarama');
  assert.ok(g.pendingKarama?.opportunity);
  assert.equal(player(g, 'b').hand.length, 1);
  return g;
}
function finishExchange(initial: Game) {
  const returned = player(initial, 'h').hand.find(
    (c) => c.effect !== 'truthtrance',
  )!;
  assert.ok(returned);
  return action(initial, 'h', { type: 'decision', returnCards: [returned.id] });
}
function purchased(initial: Game, lot: string, count: number) {
  const done = passKind(initial, 'worthlessKarama');
  assert.equal(done.pendingKarama, null);
  assert.equal(player(done, 'b').hand.filter((c) => c.id === lot).length, 1);
  assert.equal(player(done, 'b').hand.length, count);
  assert.equal(done.phase, 4);
  assert.equal(player(done, 'b').spice, 20);
  assert.equal(done.currentAuctionSale, null);
  privateViews(done);
  return done;
}

void test('Box inside a Richese gift preserves the original BG purchase conversion and its incoming slot', () => {
  const f = fixture();
  let g = action(f.g, 'r', { type: 'richeseGift', card: f.gift });
  assert.ok(g.pendingRicheseGift?.resume.pendingKarama?.opportunity);
  g = action(g, 'r', { type: 'card', card: f.box });
  assert.equal(
    g.pendingNullentropy,
    null,
    'the spent Worthless is the sole discard candidate',
  );
  assert.equal(g.response?.kind, 'richeseGift');
  assert.ok(g.pendingRicheseGift?.resume.pendingKarama?.opportunity);
  assert.ok(player(g, 'r').hand.some((c) => c.id === f.worthless));
  privateViews(g);
  g = passKind(g, 'richeseGift');
  assert.equal(player(g, 'b').hand.length, 3);
  const done = purchased(g, f.lot, 4);
  assert.equal(player(done, 'r').spice, 18);
  assert.equal(done.discard.filter((c) => c.id === f.box).length, 1);
});

void test('Harkonnen hand exchange restores the stamped conversion response before the original free purchase', () => {
  const f = fixture();
  let g = exchange(f.g, f.special);
  privateViews(g);
  g = finishExchange(g);
  assert.equal(g.pendingExchange, null);
  assert.equal(g.response?.kind, 'worthlessKarama');
  const done = purchased(g, f.lot, 3);
  assert.equal(done.discard.filter((c) => c.id === f.special).length, 1);
  assert.equal(player(done, 'h').specialKaramaUsed, true);
});

void test('Richese special-purchase income can suspend and restore the BG purchase conversion independently', () => {
  const f = fixture('r'),
    acquire = f.g.richeseCache![0].id;
  let g = action(f.g, 'r', {
    type: 'card',
    mode: 'special',
    card: f.special,
    acquire,
  });
  assert.equal(g.response?.kind, 'richesePurchaseIncome');
  assert.ok(g.pendingRichesePurchaseIncome?.resume.pendingKarama?.opportunity);
  assert.equal(player(g, 'r').spice, 17);
  assert.equal(player(g, 'e').spice, 20);
  privateViews(g);
  g = passKind(g, 'richesePurchaseIncome');
  assert.equal(player(g, 'e').spice, 23);
  assert.equal(g.pendingRichesePurchaseIncome, null);
  const done = purchased(g, f.lot, 3);
  assert.equal(
    player(done, 'r').hand.filter((c) => c.id === acquire).length,
    1,
  );
  assert.equal(player(done, 'e').spice, 23);
});

void test('Box during a hand exchange resolves the conversion response through its suspended exchange parent', () => {
  const f = fixture();
  let g = exchange(f.g, f.special);
  g = action(g, 'r', { type: 'card', card: f.box });
  assert.ok(g.pendingNullentropy);
  assert.equal(g.pendingNullentropy.resume.response, null);
  assert.equal(g.pendingNullentropy.resume.decision?.kind, 'handExchange');
  assert.ok(g.pendingNullentropy.resume.pendingKarama?.opportunity);
  assert.equal(g.pendingExchange?.response?.kind, 'worthlessKarama');
  privateViews(g);
  g = action(g, 'r', {
    type: 'decision',
    event: g.pendingNullentropy.event,
    card: f.worthless,
  });
  assert.equal(g.decision?.kind, 'handExchange');
  assert.equal(g.response, null);
  assert.ok(g.pendingKarama?.opportunity);
  privateViews(g);
  g = finishExchange(g);
  const done = purchased(g, f.lot, 3);
  assert.ok(player(done, 'r').hand.some((c) => c.id === f.worthless));
  assert.equal(done.discard.filter((c) => c.id === f.box).length, 1);
});

void test('one gift fits both a pending hand return and auction purchase, while a second gift is rejected before transfer', () => {
  const f = fixture();
  let g = exchange(f.g, f.special);
  g = action(g, 'r', { type: 'richeseGift', card: f.gift });
  assert.equal(g.pendingRicheseGift?.resume.decision?.kind, 'handExchange');
  assert.ok(g.pendingRicheseGift?.resume.pendingKarama?.opportunity);
  privateViews(g);
  g = passKind(g, 'richeseGift');
  assert.equal(player(g, 'b').hand.length, 2);
  assert.equal(g.decision?.kind, 'handExchange');
  const before = structuredClone(g),
    physical = inventory(g);
  assert.throws(
    () => applyAction(g, 'r', { type: 'richeseGift', card: f.box }),
    /room|hand|purchase/i,
  );
  assert.deepEqual(g, before);
  assert.deepEqual(inventory(g), physical);
  assert.ok(player(g, 'r').hand.some((c) => c.id === f.box));
  assert.equal(g.pendingRicheseGift, null);
  g = finishExchange(g);
  assert.equal(player(g, 'b').hand.length, 3);
  purchased(g, f.lot, 4);
});
