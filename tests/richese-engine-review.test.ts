import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  joinGame,
  newPlayer,
  viewGame,
  type Game,
  type Action,
} from '../game/engine';
import { baseDeck, leaders } from '../game/cards';
import { richeseCards } from '../game/richese-cards';

function fixture(advanced = false): Game {
  let g = createGame('RICHREVIEW', newPlayer('r', 'Richese', 'guild'));
  joinGame(g, newPlayer('a', 'Atreides', 'atreides'));
  joinGame(g, newPlayer('e', 'Emperor', 'emperor'));
  g.players.forEach((p) => {
    p.ready = true;
  });
  g = applyAction(g, 'r', { type: 'start' });
  for (const p of g.players)
    if (p.traitorChoices.length)
      g = applyAction(g, p.id, {
        type: 'traitor',
        leader: p.traitorChoices[0],
      });
  assert.equal(g.status, 'playing');
  g.players[0].faction = 'richese';
  g.players[0].leaders = leaders('richese');
  Object.assign(g, {
    phase: 2,
    advanced,
    order: ['a', 'e', 'r'],
    ready: [],
    response: null,
    decision: null,
    phaseOpening: null,
    richeseCache: richeseCards(),
    richeseRemoved: [],
    deck: baseDeck(),
  });
  for (const p of g.players) {
    p.spice = 20;
    p.hand = [];
  }
  if (advanced) g.players[0].hand = [g.deck.splice(8, 1)[0]];
  for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
  assert.equal(g.phase, 3);
  return g;
}
const decision = (g: Game, extra: Omit<Action, 'type'>) =>
  applyAction(g, 'r', {
    type: 'decision',
    event: g.richeseBidding!.event,
    ...extra,
  });
const bid = (g: Game, actor: string, amount: number | null, allyPayment = 0) =>
  applyAction(g, actor, {
    type: 'richeseBid',
    event: g.richeseAuction!.event,
    amount,
    allyPayment,
  });
function cache(g = fixture(), method = 'silent') {
  g = decision(g, { position: 'first' });
  return decision(g, {
    card: g.richeseCache![0].id,
    method,
    direction: 'counterclockwise',
  });
}
function reject(g: Game, actor: string, action: Action, pattern?: RegExp) {
  const original = structuredClone(g);
  if (pattern) assert.throws(() => applyAction(g, actor, action), pattern);
  else assert.throws(() => applyAction(g, actor, action));
  assert.deepEqual(g, original);
}

void test('cache sale transfers one physical card and exact payment to Richese across JSON restoration', () => {
  let g = cache();
  const card = g.richeseAuction!.cardId;
  g = bid(g, 'a', 5);
  g = bid(g, 'r', 0);
  g = bid(JSON.parse(JSON.stringify(g)), 'e', 0);
  assert.equal(g.players[0].spice, 25);
  assert.equal(g.players[1].spice, 15);
  assert.equal(g.players[2].spice, 20);
  assert.equal(g.players[1].hand.filter((c) => c.id === card).length, 1);
  assert.equal(
    g.richeseCache!.some((c) => c.id === card),
    false,
  );
  assert.equal(g.richeseCache!.length, 9);
  assert.equal(g.richeseAuction, null);
  assert.equal(g.richeseBidding!.stage, 'normal');
  assert.equal(g.auction!.cards.length, 2);
});

void test('Richese buying its cache card pays Emperor rather than receiving its own auction income', () => {
  let g = cache();
  g = bid(g, 'r', 4);
  g = bid(g, 'a', 0);
  g = bid(g, 'e', 0);
  assert.equal(g.players[0].spice, 16);
  assert.equal(g.players[2].spice, 24);
  assert.equal(g.players[0].hand.length, 1);
  assert.equal(g.richeseCache!.length, 9);
  assert.equal(g.richeseAuction, null);
});

void test('Black Market protects face IDs and sealed bid amounts while Atreides receives permitted inspection', () => {
  let g = fixture(true);
  const sold = g.players[0].hand[0];
  g = decision(g, {
    card: sold.id,
    method: 'silent',
    claim: 'My unverified claim',
  });
  assert.equal(viewGame(g, 'e').richeseAuction!.card, null);
  assert.equal(viewGame(g, 'e').richeseAuction!.cardId, null);
  assert.equal(viewGame(g, 'a').richeseAuction!.card!.id, sold.id);
  assert.equal(viewGame(g, 'r').richeseAuction!.card!.id, sold.id);
  const low = bid(g, 'a', 2),
    high = bid(g, 'a', 9);
  assert.deepEqual(viewGame(low, 'e'), viewGame(high, 'e'));
  assert.equal(viewGame(high, 'a').richeseAuction!.ownBid, 9);
  assert.equal(viewGame(high, 'e').richeseAuction!.ownBid, null);
});

void test('sealed own funds and pledged ally funds cannot be spent or withdrawn twice', () => {
  let g = cache();
  g.players[1].ally = 'e';
  g.players[2].ally = 'a';
  g = applyAction(g, 'e', { type: 'pledgeAid', amount: 6 });
  g = bid(g, 'a', 15, 5);
  reject(g, 'a', { type: 'bribe', target: 'r', amount: 11 });
  reject(g, 'e', { type: 'pledgeAid', amount: 4 });
  const before = structuredClone(g);
  reject(
    g,
    'a',
    { type: 'richeseBid', event: g.richeseAuction!.event, amount: 1 },
    /already submitted/,
  );
  assert.deepEqual(g, before);
  g = bid(g, 'r', 0);
  g = bid(g, 'e', 0);
  assert.equal(g.players[1].spice, 10);
  assert.equal(g.players[2].spice, 14);
  assert.equal(g.aid.e.amount, 1);
  assert.equal(g.players[0].spice, 35);
});

void test('a last cache lot remains scheduled after the normal pool ends without a bidder', () => {
  let g = decision(fixture(), { position: 'last' });
  const deckBefore = g.deck.length + g.auction!.cards.length;
  while (g.auction) g = applyAction(g, g.auction.active, { type: 'passBid' });
  assert.equal(g.phase, 3);
  assert.equal(g.decision!.kind, 'richeseCache');
  assert.equal(g.deck.length, deckBefore);
  g = decision(g, { card: g.richeseCache![0].id, method: 'silent' });
  for (const actor of ['a', 'e', 'r']) g = bid(g, actor, 0);
  assert.equal(g.decision!.kind, 'richeseUnbid');
  const selected = g.richeseAuction!.cardId;
  g = decision(g, { keep: false });
  assert.equal(g.phase, 4);
  assert.equal(g.richeseRemoved!.filter((c) => c.id === selected).length, 1);
  assert.equal(g.richeseCache!.length, 9);
});

void test('reserved Black Market Truthtrance cannot be queued for a later mandatory discard', () => {
  let g = fixture(true);
  g.deck.push(...g.players[0].hand);
  const at = g.deck.findIndex((c) => c.name === 'Truthtrance');
  assert.ok(at >= 0);
  const card = g.deck.splice(at, 1)[0];
  g.players[0].hand = [card];
  g = decision(g, { card: card.id, method: 'silent' });
  reject(g, 'r', { type: 'card', card: card.id });
  assert.equal(g.truthtrance ?? null, null);
});

void test('reserved Black Market Truthtrance cannot hide in the additional queued cards array', () => {
  let g = fixture(true);
  g.deck.push(...g.players[0].hand);
  const truths = g.deck.filter((c) => c.name === 'Truthtrance');
  assert.equal(truths.length, 2);
  g.deck = g.deck.filter((c) => c.name !== 'Truthtrance');
  g.players[0].hand = truths;
  const [main, offered] = truths;
  g = decision(g, { card: offered.id, method: 'silent' });
  reject(
    g,
    'r',
    { type: 'card', card: main.id, cards: [offered.id] },
    /reserved.*Truthtrance/,
  );
  assert.equal(g.truthtrance ?? null, null);
  assert.deepEqual(
    g.players[0].hand.map((c) => c.id),
    [main.id, offered.id],
  );
  const legal = applyAction(g, 'r', { type: 'card', card: main.id });
  assert.equal(
    legal.truthtrance!.queue.some((entry) => entry.card === offered.id),
    false,
  );
  assert.equal(
    legal.truthtrance!.queue.some((entry) => entry.card === main.id),
    true,
  );
});

void test('Silent ally funding errors cannot reveal the committed amount through withdrawal or malformed probes', () => {
  let initial = cache();
  initial.players[1].ally = 'e';
  initial.players[2].ally = 'a';
  initial = applyAction(initial, 'e', { type: 'pledgeAid', amount: 10 });
  const low = bid(initial, 'a', 2, 2),
    high = bid(initial, 'a', 9, 9);
  assert.deepEqual(viewGame(low, 'e'), viewGame(high, 'e'));
  const error = (g: Game, amount: unknown) => {
    const before = structuredClone(g);
    let message: string | undefined;
    try {
      applyAction(g, 'e', { type: 'pledgeAid', amount });
    } catch (caught) {
      message = (caught as Error).message;
    }
    assert.ok(message, `Expected rejected pledge probe ${String(amount)}`);
    assert.deepEqual(g, before);
    return message;
  };
  for (const amount of [
    0,
    1,
    2,
    5,
    8,
    9,
    -1,
    '0',
    null,
    undefined,
    NaN,
    Infinity,
    10.5,
    21,
  ]) {
    assert.equal(
      error(low, amount),
      error(high, amount),
      `Secret commitment leaked through ${String(amount)}`,
    );
  }
  for (const amount of [10, 11]) {
    const lowUpdated = applyAction(low, 'e', { type: 'pledgeAid', amount });
    const highUpdated = applyAction(high, 'e', { type: 'pledgeAid', amount });
    assert.deepEqual(viewGame(lowUpdated, 'e'), viewGame(highUpdated, 'e'));
    assert.equal(lowUpdated.aid.e.amount, amount);
  }
});

void test('Black Market Ixian ally replacement resumes seller income exactly once after a restored decision', () => {
  for (const accept of [false, true]) {
    let g = fixture(true);
    g.players[2].faction = 'ixians';
    g.players[2].leaders = leaders('ixians');
    g.players[1].ally = 'e';
    g.players[2].ally = 'a';
    const card = g.players[0].hand[0];
    g = decision(g, { card: card.id, method: 'silent' });
    g = bid(g, 'a', 3);
    g = bid(g, 'e', 0);
    g = bid(g, 'r', 0);
    assert.equal(g.decision!.kind, 'ixAllyCard');
    assert.equal(g.players[0].spice, 20);
    assert.equal(g.players[1].spice, 17);
    assert.equal(viewGame(g, 'e').ixPurchased, null);
    g = applyAction(JSON.parse(JSON.stringify(g)), 'a', {
      type: 'decision',
      accept,
    });
    assert.equal(g.players[0].spice, 23);
    assert.equal(g.players[1].spice, 17);
    assert.equal(
      g.players[1].hand.some((c) => c.id === card.id),
      !accept,
    );
    assert.equal(
      g.discard.some((c) => c.id === card.id),
      accept,
    );
    assert.equal(g.decision!.kind, 'richeseDeclaration');
    assert.equal(g.richeseAuction, null);
  }
});

void test('normal paid auctions after a cache sale route income to Emperor without repeating Richese income', () => {
  let g = cache();
  g = bid(g, 'a', 5);
  g = bid(g, 'r', 0);
  g = bid(g, 'e', 0);
  assert.equal(g.auction!.active, 'a');
  const ordinaryCard = g.auction!.cards[0].id;
  g = applyAction(g, 'a', { type: 'bid', amount: 3 });
  while (g.auction?.index === 0)
    g = applyAction(g, g.auction.active, { type: 'passBid' });
  assert.equal(g.players[0].spice, 25);
  assert.equal(g.players[1].spice, 12);
  assert.equal(g.players[2].spice, 23);
  assert.equal(
    g.players[1].hand.filter((c) => c.id === ordinaryCard).length,
    1,
  );
  assert.equal(g.richeseCache!.length, 9);
  assert.equal(g.currentAuctionSale, null);
  assert.equal(g.auction!.index, 1);
});

void test('advanced unused Ixian Technology explicitly fences special lots when Ixians hold a replacement', () => {
  let g = fixture(true);
  g.players[2].faction = 'ixians';
  g.players[2].hand = [g.deck.shift()!];
  reject(
    g,
    'r',
    {
      type: 'decision',
      event: g.richeseBidding!.event,
      card: g.players[0].hand[0].id,
      method: 'silent',
    },
    /Ixian Technology/,
  );
  g = decision(g, { decline: true });
  g = decision(g, { position: 'first' });
  reject(
    g,
    'r',
    {
      type: 'decision',
      event: g.richeseBidding!.event,
      card: g.richeseCache![0].id,
      method: 'silent',
    },
    /Ixian Technology/,
  );
  g.ixTechnologyTurn = g.turn;
  g = decision(g, { card: g.richeseCache![0].id, method: 'silent' });
  assert.equal(g.richeseAuction!.source, 'cache');
});
