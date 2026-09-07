import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  joinGame,
  newPlayer,
  viewGame,
  prepareSpecialKaramaIntent,
  executeSpecialKaramaIntent,
  type Game,
  type Action,
} from '../game/engine';
import { baseDeck, leaders } from '../game/cards';
import { richeseCards } from '../game/richese-cards';
import { createRicheseAuction } from '../game/richese-auction';

function fixture(emperor = true) {
  let g = createGame('RICHACQUIRE', newPlayer('r', 'Richese', 'guild'));
  joinGame(g, newPlayer('h', 'Harkonnen', 'harkonnen'));
  joinGame(g, newPlayer('a', 'Atreides', 'atreides'));
  if (emperor) joinGame(g, newPlayer('e', 'Emperor', 'emperor'));
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
  g.players[0].faction = 'richese';
  g.players[0].leaders = leaders('richese');
  g.players.forEach((p) => {
    p.hand = [];
    p.spice = 20;
  });
  Object.assign(g, {
    advanced: true,
    phase: 3,
    turn: 2,
    response: null,
    decision: null,
    phaseOpening: null,
    pendingKarama: null,
    deck: baseDeck(),
    discard: [],
    richeseCache: richeseCards(),
    richeseRemoved: [],
    order: g.players.map((p) => p.id),
  });
  const karama = g.deck.find((c) => c.effect === 'karama')!;
  g.deck = g.deck.filter((c) => c.id !== karama.id);
  g.players[0].hand = [karama];
  return g;
}
function command(g: Game): Action {
  return {
    type: 'card',
    mode: 'special',
    card: g.players[0].hand.find((c) => c.effect === 'karama')!.id,
    acquire: g.richeseCache!.find((c) => c.effect !== 'karama')!.id,
  };
}
function giveKarama(g: Game, id: string) {
  let card = g.deck.find((c) => c.effect === 'karama');
  if (card) g.deck = g.deck.filter((c) => c.id !== card!.id);
  else {
    card = g.richeseCache!.find((c) => c.effect === 'karama')!;
    g.richeseCache = g.richeseCache!.filter((c) => c.id !== card!.id);
  }
  g.players.find((p) => p.id === id)!.hand.push(card);
  return card.id;
}
function inventory(g: Game) {
  return [
    ...g.deck,
    ...g.discard,
    ...g.players.flatMap((p) => p.hand),
    ...(g.richeseCache ?? []),
    ...(g.richeseRemoved ?? []),
    ...(g.auction?.cards.slice(g.auction.index) ?? []),
  ]
    .map((c) => c.id)
    .sort();
}
function rejected(g: Game, action: Action, pattern: RegExp) {
  const before = structuredClone(g);
  assert.throws(() => applyAction(g, 'r', action), pattern);
  assert.deepEqual(g, before);
}

void test('special purchase preparation is pure and a bank purchase commits exact card, cost and once marker once', () => {
  const g = fixture(false);
  g.players[0].ally = 'h';
  g.players[1].ally = 'r';
  const action = command(g);
  const before = structuredClone(g);
  const intent = prepareSpecialKaramaIntent(g, 'r', action);
  assert.equal(intent.kind, 'richese');
  assert.deepEqual(g, before);
  const done = applyAction(g, 'r', action);
  assert.equal(done.players[0].spice, 17);
  assert.equal(done.players[0].specialKaramaUsed, true);
  assert.equal(done.players[0].hand.length, 1);
  assert.equal(done.players[0].hand[0].id, action.acquire);
  assert.equal(done.discard.filter((c) => c.id === action.card).length, 1);
  assert.equal(done.richeseCache!.length, 9);
  assert.equal(done.pendingIxAlly ?? null, null);
  assert.equal(done.players[1].hand.length, 0);
  assert.deepEqual(inventory(done), inventory(before));
  rejected(done, action, /already been used/);
});

void test('Emperor automatically receives the three-spice purchase when no cancellation choice exists', () => {
  const g = fixture();
  const action = command(g);
  const done = applyAction(g, 'r', action);
  assert.equal(done.players.find((p) => p.id === 'e')!.spice, 23);
  assert.equal(done.players[0].spice, 17);
  assert.equal(done.pendingRichesePurchaseIncome, null);
  assert.equal(done.response, null);
  assert.equal(done.players[0].hand[0].id, action.acquire);
  assert.deepEqual(inventory(done), inventory(g));
});

void test('canceling only Emperor income preserves the private purchase and exactly restores an interrupted auction response', () => {
  const g = fixture();
  const cancel = giveKarama(g, 'h');
  giveKarama(g, 'e');
  g.auction = {
    cards: [g.deck.shift()!],
    index: 0,
    bid: 0,
    bidder: null,
    active: 'h',
    passed: [],
    opener: 1,
  };
  g.active = 'h';
  g.response = { kind: 'atreidesAuction', owner: 'a', passed: ['r'] };
  const action = command(g);
  const originalResponse = structuredClone(g.response);
  const originalAuction = structuredClone(g.auction);
  const held = applyAction(g, 'r', action);
  assert.equal(held.response!.kind, 'richesePurchaseIncome');
  assert.equal(held.players[0].hand[0].id, action.acquire);
  assert.equal(held.players[0].specialKaramaUsed, true);
  assert.equal(held.players.find((p) => p.id === 'e')!.spice, 20);
  assert.deepEqual(
    held.pendingRichesePurchaseIncome!.resume.response,
    originalResponse,
  );
  const selected = g.richeseCache!.find((c) => c.id === action.acquire)!;
  for (const viewer of ['h', 'a', 'e']) {
    const view = viewGame(held, viewer);
    assert.equal(view.players[0].hand, undefined);
    assert.equal('pendingRichesePurchaseIncome' in view, false);
    assert.equal(JSON.stringify(view.response).includes(selected.id), false);
    assert.equal(
      view.log.some((entry) => entry.text.includes(selected.name)),
      false,
    );
  }
  const done = applyAction(JSON.parse(JSON.stringify(held)), 'h', {
    type: 'card',
    card: cancel,
    mode: 'cancel',
  });
  assert.equal(done.players.find((p) => p.id === 'e')!.spice, 20);
  assert.equal(done.players[0].spice, 17);
  assert.equal(done.players[0].hand[0].id, action.acquire);
  assert.deepEqual(done.response, originalResponse);
  assert.deepEqual(done.auction, originalAuction);
  assert.equal(done.pendingRichesePurchaseIncome, null);
  assert.deepEqual(inventory(done), inventory(g));
});

void test('purchase income resumes an existing cache decision without rebuilding its pool or revealing the selected acquisition', () => {
  const g = fixture();
  giveKarama(g, 'h');
  g.richeseBidding = {
    owner: 'r',
    event: 'round-1',
    turn: g.turn,
    stage: 'cacheOffer',
    position: 'first',
    normalCount: 3,
    blackMarketSold: false,
    cacheCanceled: false,
  };
  g.decision = { kind: 'richeseCache', player: 'r' };
  const decision = structuredClone(g.decision);
  const round = structuredClone(g.richeseBidding);
  let done = applyAction(g, 'r', command(g));
  assert.equal(done.decision, null);
  assert.equal(done.response!.kind, 'richesePurchaseIncome');
  done = applyAction(JSON.parse(JSON.stringify(done)), 'h', {
    type: 'passResponse',
  });
  assert.deepEqual(done.decision, decision);
  assert.deepEqual(done.richeseBidding, round);
  assert.equal(done.auction, null);
  assert.equal(done.players.find((p) => p.id === 'e')!.spice, 23);
  assert.equal(done.richeseCache!.length, 9);
});

void test('an interrupted Worthless-Karama conversion and its original response survive the independent income window', () => {
  const g = fixture();
  const bg = newPlayer('b', 'Bene Gesserit', 'beneGesserit');
  bg.hand = [];
  g.players.push(bg);
  g.order.push('b');
  giveKarama(g, 'h');
  giveKarama(g, 'e');
  const original = {
    kind: 'atreidesAuction' as const,
    owner: 'a',
    passed: ['r'],
  };
  g.auction = {
    cards: [g.deck.shift()!],
    index: 0,
    bid: 0,
    bidder: null,
    active: 'h',
    passed: [],
    opener: 1,
  };
  const worthless = g.deck.find((c) => c.kind === 'worthless')!;
  g.deck = g.deck.filter((c) => c.id !== worthless.id);
  g.discard.push(worthless);
  g.pendingKarama = { owner: 'b', use: { kind: 'cancel', response: original } };
  g.response = {
    kind: 'worthlessKarama',
    owner: 'b',
    passed: [],
    intent: 'Cancel the inspection.',
  };
  const pending = structuredClone(g.pendingKarama);
  const response = structuredClone(g.response);
  let done = applyAction(g, 'r', command(g));
  assert.equal(done.pendingKarama, null);
  assert.deepEqual(
    done.pendingRichesePurchaseIncome!.resume.pendingKarama,
    pending,
  );
  done = applyAction(JSON.parse(JSON.stringify(done)), 'h', {
    type: 'passResponse',
  });
  assert.deepEqual(done.pendingKarama, pending);
  assert.deepEqual(done.response, response);
  assert.equal(done.players.find((p) => p.id === 'e')!.spice, 23);
  assert.deepEqual(inventory(done), inventory(g));
});

void test('special purchase cannot spend sealed bid funds or take the already offered cache card', () => {
  const g = fixture();
  const action = command(g);
  const offered = g.richeseCache![1].id;
  g.richeseAuction = createRicheseAuction({
    event: 'lot',
    cardId: offered,
    owner: 'r',
    source: 'cache',
    method: 'silent',
    eligible: g.order,
    order: g.order,
    tieOrder: g.order,
  });
  g.richeseAuction.sealed = { r: 18 };
  g.richeseAuction.acted = ['r'];
  g.richeseFunding = { r: { amount: 18, allyPayment: 0, donor: null } };
  rejected(g, action, /uncommitted/);
  g.richeseAuction.sealed = {};
  g.richeseAuction.acted = [];
  g.richeseFunding = {};
  rejected(g, { ...action, acquire: offered }, /offered for auction/);
});

void test('full-hand, final-cache and noncanonical selections remain explicit atomic unsupported or invalid cases', () => {
  let g = fixture();
  const action = command(g);
  g.players[0].hand.push(...g.deck.splice(0, 3));
  rejected(g, action, /full hand.*ruling/);
  g = fixture();
  const last = command(g);
  g.richeseCache = g.richeseCache!.filter((c) => c.id === last.acquire);
  rejected(g, last, /final cache.*implementation/);
  g = fixture();
  const fake = command(g);
  g.richeseCache!.find((c) => c.id === fake.acquire)!.name =
    'Invented replacement';
  rejected(g, fake, /verified card/);
});

void test('a delayed normalized acquisition intent revalidates exact card custody before any cost or once marker', () => {
  const g = fixture(false);
  const action = command(g);
  const intent = prepareSpecialKaramaIntent(g, 'r', action);
  const removed = g.richeseCache!.find((c) => c.id === action.acquire)!;
  g.richeseCache = g.richeseCache!.filter((c) => c.id !== removed.id);
  g.players[1].hand.push(removed);
  const before = structuredClone(g);
  assert.throws(() => executeSpecialKaramaIntent(g, intent), /verified card/);
  assert.deepEqual(g, before);
  assert.equal(g.players[0].spice, 20);
  assert.equal(g.players[0].specialKaramaUsed ?? false, false);
});

void test('a special cache purchase with an Ixian ally does not create a bidding replacement or bonus draw', () => {
  const g = fixture();
  g.players[1].faction = 'ixians';
  g.players[1].leaders = leaders('ixians');
  g.players[0].ally = 'h';
  g.players[1].ally = 'r';
  g.players[1].hand = [g.deck.shift()!];
  const deck = structuredClone(g.deck);
  const allyHand = structuredClone(g.players[1].hand);
  const action = command(g);
  const done = applyAction(g, 'r', action);
  assert.equal(done.players[0].hand[0].id, action.acquire);
  assert.equal(done.pendingIxAlly ?? null, null);
  assert.equal(done.decision, null);
  assert.deepEqual(done.players[1].hand, allyHand);
  assert.deepEqual(done.deck, deck);
  assert.deepEqual(inventory(done), inventory(g));
});
