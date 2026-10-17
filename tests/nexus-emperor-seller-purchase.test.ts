import assert from 'node:assert/strict';
import test from 'node:test';
import { baseDeck } from '../game/cards';
import { createGame, newPlayer, handLimit, type Game } from '../game/engine';
import { createNexusCards, drawNexusCard } from '../game/nexus-cards';
import { createRicheseAuction, submitRicheseBid } from '../game/richese-auction';
import { richeseCards } from '../game/richese-cards';
import { quoteRicheseSettlement } from '../game/richese-settlement';
import {
  EmperorNexusPurchaseError, createEmperorNexusSellerPurchase,
  emperorNexusSellerPurchaseEvent, emperorNexusPurchaseEvent, quoteEmperorNexusSellerPurchase,
  signEmperorNexusPurchase, validateEmperorNexusPurchase,
  type EmperorNexusBankPurchase, type EmperorNexusSellerPurchaseInput, type EmperorNexusSellerPurchase,
} from '../game/nexus-emperor-purchase';
import {
  auctionEmperorIncomeAmount, quoteAuctionContinuation, AuctionContinuationError,
  type AuctionContinuationInput,
} from '../game/auction-continuation-quote';

function original(source: 'cache' | 'blackMarket' = 'cache', self = false) {
  const g = createGame('SELLERQUOTE', newPlayer('r', 'Richese', 'richese'), source === 'blackMarket', ['choam']);
  g.players.push(newPlayer('h', 'Harkonnen', 'harkonnen'), newPlayer('c', 'CHOAM', 'choam'));
  g.order = g.players.map(p => p.id);
  g.status = 'playing';
  g.phase = 3;
  g.turn = 2;
  for (const p of g.players) { p.hand = []; p.spice = 10; }
  g.deck = [];
  g.discard = [];
  g.auction = null;
  const card = source === 'cache' ? richeseCards()[0] : baseDeck()[0];
  g.richeseCache = source === 'cache' ? [card] : [];
  if (source === 'blackMarket') g.players[0].hand.push(card);
  const winner = self ? 'r' : 'h';
  let lot = createRicheseAuction({
    event: 'original-lot', cardId: card.id, source, owner: 'r', method: 'silent',
    eligible: g.order, order: g.order, tieOrder: g.order,
  });
  for (const actor of g.order)
    lot = submitRicheseBid(lot, { event: lot.event, actor, amount: actor === winner ? 6 : 0 }, 10);
  g.richeseAuction = lot;
  g.richeseBidding = {
    owner: 'r', event: 'original-round', turn: g.turn, stage: 'lot',
    position: source === 'cache' ? 'first' : null, normalCount: 3,
    blackMarketSold: false, cacheCanceled: false,
  };
  g.richeseFunding = { [winner]: { amount: 6, allyPayment: 0, donor: null } };
  const cards = createNexusCards(g.players, () => 0);
  cards.deck = ['emperor', ...cards.deck.filter(c => c !== 'emperor')];
  g.nexusCards = { cards: drawNexusCard(cards, winner, g.players, () => 0), phase: null };
  const buyer = g.players.find(p => p.id === winner)!;
  const quote = quoteRicheseSettlement({
    lot, owner: { id: 'r', handCount: g.players[0].hand.length, handLimit: 4 },
    winner: { id: winner, handCount: buyer.hand.length, handLimit: handLimit(buyer), spice: buyer.spice },
    card, funding: g.richeseFunding[winner],
  });
  assert.equal(quote.kind, 'sold');
  if (quote.kind !== 'sold') throw new Error('Expected native original sale.');
  const input: EmperorNexusSellerPurchaseInput = { round: g.richeseBidding.event, lot, quote, bank: false };
  return { g, input, winner };
}

function continuation(g: Game, input: EmperorNexusSellerPurchaseInput, free = true): AuctionContinuationInput {
  return {
    status: g.status, phase: g.phase, turn: g.turn, advanced: g.advanced,
    players: g.players.map(p => ({ ...p, handLimit: handLimit(p) })), order: g.order,
    physicalCards: [...g.players.flatMap(p => p.hand), ...(g.richeseCache ?? [])],
    auction: null, richeseAuction: input.lot, richeseBidding: g.richeseBidding,
    richeseCacheCount: g.richeseCache?.length,
    sale: { winner: input.quote.winner, amount: input.quote.amount, free,
      origin: input.lot.source, seller: input.lot.owner, ...(input.bank ? { recipient: 'bank' as const } : {}) },
  };
}

void test('original cache and Black Market price proofs sign unchanged personally held spice without mutating the source', () => {
  for (const source of ['cache', 'blackMarket'] as const) {
    const { g, input, winner } = original(source), before = structuredClone(g);
    const offer = quoteEmperorNexusSellerPurchase(g, input, winner);
    assert.equal(offer.blocked, null);
    assert.equal(offer.price, 6);
    assert.equal(offer.source, source);
    const receipt = createEmperorNexusSellerPurchase(g, input);
    assert.equal(receipt.version, 2);
    assert.equal(receipt.owner, winner);
    assert.equal(receipt.seller, 'r');
    assert.equal(receipt.beforeSpice, 10);
    assert.equal(receipt.afterSpice, 10);
    assert.equal(receipt.event, emperorNexusSellerPurchaseEvent(2, winner, 0, 'original-round', 'original-lot', source, 6));
    assert.equal(Object.hasOwn(receipt, 'auctionIndex'), false);
    assert.deepEqual(g, before);
    // Historical evidence deliberately ignores future wallets and card transfers.
    g.turn = 4;
    g.players.find(p => p.id === winner)!.spice = 0;
    g.richeseAuction = null;
    g.richeseCache = [];
    assert.doesNotThrow(() => validateEmperorNexusPurchase(g, receipt));
  }
});

void test('native Richese self cache purchase can retain its personally affordable price', () => {
  const { g, input } = original('cache', true);
  assert.equal(createEmperorNexusSellerPurchase(g, input).owner, 'r');
  const q = quoteAuctionContinuation(continuation(g, input), { kind: 'sale', free: true });
  assert.deepEqual(q.steps, []);
  assert.deepEqual(q.next, { kind: 'richeseEnd', source: 'cache', after: 'normalPool' });
});

void test('personal-price, exact source, full hand and physical singleton corruption fail closed', () => {
  const changes: ((g: Game, input: EmperorNexusSellerPurchaseInput) => void)[] = [
    g => { g.players[1].spice = 5; },
    (_g, input) => { input.quote.amount = 5; },
    (_g, input) => { input.quote.ownPayment = 5; },
    (_g, input) => { input.quote.allyPayment = 1; },
    (_g, input) => { input.round = 'other-round'; },
    (_g, input) => { input.lot = { ...input.lot, event: 'other-lot' }; },
    (_g, input) => { input.lot = { ...input.lot, bid: 5 }; },
    g => { g.richeseFunding!.h.donor = 'c'; },
    g => { g.richeseFunding!.h.amount = 5; },
    g => { g.deck.push(g.richeseCache![0]); },
    g => { g.richeseCache = []; },
    g => { g.players[1].hand = baseDeck().slice(0, 8); },
    g => { g.nexusCards!.cards!.deck.push('emperor'); },
    (_g, input) => { input.quote.card = { ...input.quote.card, name: 'substituted face' }; },
    (_g, input) => { Object.assign(input, { extra: true }); },
    (_g, input) => { Object.assign(input.quote, { extra: true }); },
  ];
  for (const change of changes) {
    const { g, input } = original();
    change(g, input);
    assert.throws(() => createEmperorNexusSellerPurchase(g, input), EmperorNexusPurchaseError);
  }
  const { g, input } = original('blackMarket');
  g.advanced = false;
  assert.throws(() => createEmperorNexusSellerPurchase(g, input), EmperorNexusPurchaseError);
});

void test('private card entitlement and alliances cannot authorize retention, even with enough visible spice', () => {
  const { g, input, winner } = original();
  const cards = g.nexusCards!.cards!;
  cards.hands[winner] = 'guild';
  cards.deck = ['emperor', ...cards.deck.filter(c => c !== 'guild')];
  assert.match(quoteEmperorNexusSellerPurchase(g, input, winner).blocked!, /real Emperor/);
  cards.deck = ['guild', ...cards.deck.filter(c => c !== 'emperor')];
  cards.hands[winner] = 'emperor';
  g.players[1].ally = 'c';
  g.players[2].ally = winner;
  assert.match(quoteEmperorNexusSellerPurchase(g, input, winner).blocked!, /unallied/);
  input.quote.allyPayment = 2;
  input.quote.ownPayment = 4;
  g.richeseFunding!.h = { amount: 6, allyPayment: 2, donor: 'c' };
  g.aid.c = { recipient: winner, amount: 2 };
  g.players[1].spice = 4;
  assert.throws(() => createEmperorNexusSellerPurchase(g, input), /unallied/);
});

void test('free original seller continuation produces no seller credit or income while preserving native bonus and end boundaries', () => {
  for (const source of ['cache', 'blackMarket'] as const) {
    const { g, input } = original(source);
    for (const bank of [false, true]) {
      input.bank = bank;
      const ctx = continuation(g, input), before = structuredClone(ctx);
      const q = quoteAuctionContinuation(ctx, { kind: 'sale', free: true });
      assert.equal(q.sale.amount, 6);
      assert.equal(auctionEmperorIncomeAmount(q.sale), 0);
      assert.deepEqual(q.steps, []);
      assert.deepEqual(q.next, { kind: 'response', response: { kind: 'harkonnenBonus', owner: 'h', passed: [] } });
      const end = quoteAuctionContinuation(ctx, { kind: 'next' });
      assert.deepEqual(end.next, source === 'cache'
        ? { kind: 'richeseEnd', source: 'cache', after: 'normalPool' }
        : { kind: 'richeseEnd', source: 'blackMarket', after: 'declaration', blackMarketSold: true });
      assert.deepEqual(ctx, before);
      const paid = quoteAuctionContinuation(continuation(g, input, false), { kind: 'sale', free: false });
      assert.deepEqual(paid.steps, bank ? [] : [{ kind: 'sellerCredit', player: 'r', amount: 6, balance: 16 }]);
    }
  }
});

void test('a free seller lot cannot fabricate a donor invoice or payer-derived income', () => {
  for (const patch of [
    { richeseContribution: 1 }, { richeseContribution: 0 },
    { occupiedContributions: [{ payer: 'h', amount: 6 }] },
    { bureaucratPaymentEvent: 'fake-paid-source' },
    { spiceBankerIncomePayment: {} }, { bureaucratPayment: {} },
  ]) {
    const { g, input } = original();
    const ctx = continuation(g, input);
    Object.assign(ctx.sale!, patch);
    assert.throws(() => quoteAuctionContinuation(ctx, { kind: 'sale', free: true }), AuctionContinuationError);
  }
});

void test('strict seller receipt source, price and retained balance corruption rejects even after re-signing', () => {
  const { g, input } = original();
  const receipt = createEmperorNexusSellerPurchase(g, input);
  const invalid = (patch: Partial<EmperorNexusSellerPurchase>, resign = false) => {
    const changed = { ...receipt, ...patch };
    if (resign) changed.signature = signEmperorNexusPurchase(changed);
    assert.throws(() => validateEmperorNexusPurchase(g, changed), EmperorNexusPurchaseError);
  };
  for (const patch of [
    { origin: 'blackMarket' as const }, { seller: 'c' }, { round: 'other-round' },
    { lot: 'other-lot' }, { price: 7 }, { card: 'other-card' }, { owner: 'c' }, { sequence: 1 },
  ]) invalid(patch);
  for (const patch of [
    { version: 1 as never }, { price: 0 }, { price: 11 }, { price: 1.5 },
    { beforeSpice: 5, afterSpice: 5 }, { afterSpice: 9 }, { afterSpice: 16 },
    { seller: 'c' }, { phase: 4 as never }, { turn: 0 }, { turn: 3 },
    { lot: ' ' }, { round: ' ' }, { auctionIndex: 0 } as never,
    { ownPayment: 6 } as never, { bankSubsidy: 6 } as never,
  ]) invalid(patch, true);
});

void test('normal bank receipts retain their exact original shape, event and typed signature', () => {
  const { g } = original();
  const receipt: EmperorNexusBankPurchase = {
    kind: 'purchase', event: emperorNexusPurchaseEvent(1, 'h', 0, 2, 6),
    owner: 'h', turn: 1, phase: 3, sequence: 0, faction: 'harkonnen', advanced: false,
    price: 6, auctionIndex: 2, card: 'historical-bank-card', beforeSpice: 10, afterSpice: 10, signature: '',
  };
  const expected = JSON.stringify([
    'emperorNexusPurchase', 'purchase', receipt.event, 'h', 1, 3, 0, 'harkonnen',
    false, 6, 2, 'historical-bank-card', 10, 10,
  ]);
  receipt.signature = signEmperorNexusPurchase(receipt);
  assert.equal(receipt.signature, expected);
  assert.doesNotThrow(() => validateEmperorNexusPurchase(g, receipt));
  const hybrid = { ...receipt, version: 2, origin: 'cache', seller: 'r', round: 'round', lot: 'lot' } as never;
  assert.throws(() => validateEmperorNexusPurchase(g, hybrid), EmperorNexusPurchaseError);
});
