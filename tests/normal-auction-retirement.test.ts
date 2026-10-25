import assert from 'node:assert/strict';
import test from 'node:test';
import { baseDeck } from '../game/cards';
import { quoteAuctionContinuation, type AuctionContinuationInput } from '../game/auction-continuation-quote';
import {
  quoteNormalAuctionRetirement, NormalAuctionRetirementError,
  type NormalAuctionRetirementInput,
} from '../game/normal-auction-retirement';

function fixture(): NormalAuctionRetirementInput {
  const cards = baseDeck().slice(0, 3);
  const held = baseDeck()[3];
  return {
    turn: 2, advanced: false, order: ['r', 'a', 'i', 'g'],
    players: [
      { id: 'r', faction: 'richese', spice: 5, hand: [], handLimit: 4 },
      { id: 'a', faction: 'atreides', spice: 5, hand: [], handLimit: 4 },
      { id: 'i', faction: 'ixians', spice: 5, hand: [held], handLimit: 4 },
      { id: 'g', faction: 'guild', spice: 5, hand: [], handLimit: 4 },
    ],
    physicalCards: [...cards, held],
    auction: { cards, index: 0, bid: 0, bidder: null, active: 'r', passed: [], opener: 0 },
  };
}
function round(input: NormalAuctionRetirementInput) {
  input.richeseBidding = {
    owner: 'r', event: 'round-2', turn: 2, stage: 'normal', position: 'last',
    normalCount: 3, blackMarketSold: false, cacheCanceled: false,
  };
}
function paid(input: NormalAuctionRetirementInput): AuctionContinuationInput {
  return {
    ...input, status: 'playing', phase: 3,
    auction: { ...input.auction!, bid: 4, bidder: 'r' },
  };
}
function reject(input: NormalAuctionRetirementInput) {
  const before = JSON.stringify(input);
  assert.throws(() => quoteNormalAuctionRetirement(input), NormalAuctionRetirementError);
  assert.equal(JSON.stringify(input), before);
}

void test('unbought retirement advances the original pool without a bidder, sale or payment', () => {
  const input = fixture(), before = structuredClone(input);
  const next = quoteNormalAuctionRetirement(input);
  assert.equal(next.kind, 'normalLot');
  if (next.kind !== 'normalLot') throw new Error('The next physical lot must remain.');
  assert.equal(next.auction.index, 1);
  assert.equal(next.auction.bid, 0);
  assert.equal(next.auction.bidder, null);
  assert.equal(next.auction.allyPayment, 0);
  assert.equal(next.active, 'a');
  assert.deepEqual(next.offer, { kind: 'atreidesAuction', owner: 'a', passed: [] });
  assert.equal(Object.hasOwn(next, 'sale'), false);
  assert.deepEqual(input, before);
  next.auction.cards[1].name = 'Changed output';
  assert.deepEqual(input, before);
});

void test('retirement rotates the physical opener rather than another seat currently leading the bid', () => {
  const input = fixture();
  input.auction = { ...input.auction!, bid: 5, bidder: 'g', active: 'i', passed: ['r', 'a'] };
  const next = quoteNormalAuctionRetirement(input);
  assert.equal(next.kind, 'normalLot');
  if (next.kind !== 'normalLot') throw new Error('The next physical lot must remain.');
  assert.equal(next.active, 'a');
  assert.equal(next.auction.opener, 1);
  assert.equal(next.auction.bidder, null);
});

void test('next-lot retirement skips full hands, removes Sapho and clears the prior inspection', () => {
  const input = fixture();
  input.players = input.players.map(player => player.id === 'a'
    ? { ...player, hand: [{ id: 'a-full' }], handLimit: 1 } : player);
  input.auction = { ...input.auction!, saphoOrder: ['g', 'i', 'a', 'r'], peekKnown: true,
    occupiedEvent: 'original-occupied-event' };
  const before = structuredClone(input), next = quoteNormalAuctionRetirement(input);
  assert.equal(next.kind, 'normalLot');
  if (next.kind !== 'normalLot') throw new Error('The next physical lot must remain.');
  assert.equal(next.active, 'i');
  assert.equal(next.auction.opener, 2);
  assert.deepEqual(next.auction.passed, []);
  assert.equal(next.auction.peekKnown, false);
  assert.equal(Object.hasOwn(next.auction, 'saphoOrder'), false);
  assert.equal(next.auction.occupiedEvent, 'original-occupied-event');
  assert.deepEqual(input, before);
});

void test('exhaustion keeps the 7 October last-cache stock and cancellation rule', () => {
  for (const [stock, canceled, after] of [[1, false, 'richeseCache'], [0, false, 'phase'], [1, true, 'phase']] as const) {
    const input = fixture();
    round(input);
    input.auction!.index = 2;
    input.richeseCacheCount = stock;
    input.richeseBidding!.cacheCanceled = canceled;
    assert.deepEqual(quoteNormalAuctionRetirement(input), {
      kind: 'normalEnd', returned: [], after, completeRound: after === 'phase',
    });
  }
  const ordinary = fixture();
  ordinary.auction!.index = 2;
  assert.deepEqual(quoteNormalAuctionRetirement(ordinary), {
    kind: 'normalEnd', returned: [], after: 'phase', completeRound: false,
  });
});

void test('full hands return only the untouched remainder as independent physical snapshots', () => {
  const input = fixture();
  input.players = input.players.map(player => ({ ...player, hand: [{ id: `${player.id}-full` }], handLimit: 1 }));
  const before = structuredClone(input), next = quoteNormalAuctionRetirement(input);
  assert.equal(next.kind, 'normalEnd');
  if (next.kind !== 'normalEnd') throw new Error('No seat can buy the remaining cards.');
  assert.deepEqual(next.returned, input.auction!.cards.slice(1));
  next.returned[0].name = 'Changed output';
  assert.deepEqual(input, before);
});

void test('next inspection offers retain Advanced Ix priority and ordinary Atreides fallback', () => {
  const input = fixture();
  input.advanced = true;
  const ix = quoteNormalAuctionRetirement(input);
  assert.equal(ix.kind, 'normalLot');
  if (ix.kind !== 'normalLot') throw new Error('The next physical lot must remain.');
  assert.deepEqual(ix.offer, { kind: 'ixTechnology', player: 'i' });
  input.ixTechnologyTurn = input.turn;
  const atreides = quoteNormalAuctionRetirement(input);
  assert.equal(atreides.kind, 'normalLot');
  if (atreides.kind !== 'normalLot') throw new Error('The next physical lot must remain.');
  assert.deepEqual(atreides.offer, { kind: 'atreidesAuction', owner: 'a', passed: [] });
  input.players = input.players.map(player => player.id === 'a' ? { ...player, faction: 'beneGesserit' } : player);
  const neither = quoteNormalAuctionRetirement(input);
  assert.equal(neither.kind, 'normalLot');
  if (neither.kind !== 'normalLot') throw new Error('The next physical lot must remain.');
  assert.equal(neither.offer, null);
});

void test('the existing paid continuation delegates unchanged and preserves declared-cost hand projection', () => {
  const input = paid(fixture());
  assert.deepEqual(quoteAuctionContinuation(input, { kind: 'next' }).next, quoteNormalAuctionRetirement(input));
  const cost = { id: 'r-last-slot' };
  input.players = input.players.map(player => ({ ...player, hand: [player.id === 'r' ? cost : { id: `${player.id}-full` }], handLimit: 1 }));
  const before = structuredClone(input);
  const next = quoteAuctionContinuation(input, { kind: 'next' }, { player: 'r', card: cost.id }).next;
  assert.equal(next.kind, 'normalLot');
  if (next.kind !== 'normalLot') throw new Error('Spending the real card opens the original slot.');
  assert.equal(next.active, 'r');
  assert.deepEqual(input, before);
  const ixInput = paid(fixture());
  ixInput.advanced = true;
  const ixCard = ixInput.players.find(player => player.id === 'i')!.hand[0].id;
  const afterIxCost = quoteAuctionContinuation(ixInput, { kind: 'next' }, { player: 'i', card: ixCard }).next;
  assert.equal(afterIxCost.kind, 'normalLot');
  if (afterIxCost.kind !== 'normalLot') throw new Error('The next physical lot must remain.');
  assert.deepEqual(afterIxCost.offer, { kind: 'atreidesAuction', owner: 'a', passed: [] });
});

void test('retirement rejects invalid source indices, order, hand limits and remaining physical custody', () => {
  for (const index of [-1, 3, 0.5, NaN, Infinity]) {
    const input = fixture();
    input.auction!.index = index;
    reject(input);
  }
  const badOpener = fixture();
  badOpener.auction!.opener = 4;
  reject(badOpener);
  const nullBidderPrice = fixture();
  nullBidderPrice.auction!.bid = 1;
  reject(nullBidderPrice);
  const duplicateOrder = fixture();
  duplicateOrder.order = ['r', 'r'];
  reject(duplicateOrder);
  const noHandLimit = fixture();
  noHandLimit.players = noHandLimit.players.map(player => player.id === 'r' ? { ...player, handLimit: 0 } : player);
  reject(noHandLimit);
  const noPhysical = fixture();
  noPhysical.physicalCards = noPhysical.physicalCards.filter(card => card.id !== noPhysical.auction!.cards[1].id);
  reject(noPhysical);
  const duplicatePhysical = fixture();
  duplicatePhysical.physicalCards = [...duplicatePhysical.physicalCards, duplicatePhysical.auction!.cards[1]];
  reject(duplicatePhysical);
  const duplicateCurrent = fixture();
  duplicateCurrent.auction!.cards[1] = duplicateCurrent.auction!.cards[0];
  reject(duplicateCurrent);
});
