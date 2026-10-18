import assert from 'node:assert/strict';
import test from 'node:test';
import {
  reorderSaphoCyclicAuction,
  SaphoCyclicAuctionError,
  type SaphoCyclicAuctionContext,
  type SaphoCyclicAuctionRequest,
} from '../game/sapho-cyclic-auction';
import { quoteNormalAuctionBid, quoteNormalAuctionNext } from '../game/normal-auction';
import { createRicheseAuction, submitRicheseBid, type RicheseAuction } from '../game/richese-auction';
import { quoteAuctionContinuation, type AuctionContinuationInput } from '../game/auction-continuation-quote';
import { baseDeck } from '../game/cards';

const context = (): SaphoCyclicAuctionContext => ({
  event: 'ordinary-lot-2', order: ['a', 'full', 'b', 'c', 'd', 'p'],
  eligible: ['a', 'b', 'c', 'd', 'p'], active: 'c', bidder: 'a', passed: ['b', 'p'],
});
const reorder = (state: SaphoCyclicAuctionContext, player: string, mode: 'first' | 'last') =>
  reorderSaphoCyclicAuction(state, { event: state.event, player, mode });
const submit = (state: RicheseAuction, actor: string, amount: number | null, maximum = 20) =>
  submitRicheseBid(state, { event: state.event, actor, amount }, maximum);

void test('Sapho first rotates the current lot and preserves all high, passed and full-hand placeholders', () => {
  const state = context(), before = structuredClone(state);
  const result = reorder(state, 'd', 'first');
  assert.deepEqual(result, { order: ['d', 'c', 'p', 'a', 'full', 'b'], active: 'd' });
  assert.deepEqual([...result.order].sort(), [...state.order].sort());
  assert.deepEqual(state, before);
  assert.deepEqual(quoteNormalAuctionNext({ ...state, ...result, bid: 4, passed: [...state.passed, 'd'] }),
    { kind: 'bid', player: 'c' });
  assert.deepEqual(quoteNormalAuctionNext({
    ...state, ...result, active: 'c', bid: 4, passed: [...state.passed, 'd', 'c'],
  }), { kind: 'payment', player: 'a' });
});

void test('Sapho last lets the current pending actor yield without repeating earlier passes when the cycle wraps', () => {
  const state = context(), result = reorder(state, 'c', 'last');
  assert.deepEqual(result, { order: ['d', 'p', 'a', 'full', 'b', 'c'], active: 'd' });
  assert.deepEqual(quoteNormalAuctionNext({ ...state, ...result, bid: 4, passed: [...state.passed, 'd'] }),
    { kind: 'bid', player: 'c' });
});

void test('a currently last pending bidder can meaningfully move behind placeholders that reenter after a raise', () => {
  const state = context(), result = reorder(state, 'd', 'last');
  assert.deepEqual(result, { order: ['c', 'p', 'a', 'full', 'b', 'd'], active: 'c' });
  assert.deepEqual(quoteNormalAuctionNext({ ...state, ...result, bid: 5, bidder: 'c', passed: [] }),
    { kind: 'bid', player: 'p' }, 'An actual raise restores passes in the altered full cycle');
  assert.deepEqual(quoteNormalAuctionNext({ ...state, order: ['c', 'd', 'p', 'a', 'full', 'b'],
    bid: 5, bidder: 'c', passed: [] }), { kind: 'bid', player: 'd' });
});

void test('true full-cycle no-ops are unavailable but changing the next actor in a two-seat cycle is meaningful', () => {
  assert.throws(() => reorder(context(), 'c', 'first'), /already.*position/);
  const simple = { event: 'lot', order: ['a', 'b', 'c'], eligible: ['a', 'b', 'c'],
    active: 'a', bidder: null, passed: [] };
  assert.throws(() => reorder(simple, 'c', 'last'), SaphoCyclicAuctionError);
  const single = { event: 'lot', order: ['a', 'high', 'passed', 'full'], eligible: ['a', 'high', 'passed'],
    active: 'a', bidder: 'high', passed: ['passed'] };
  assert.throws(() => reorder(single, 'a', 'first'), SaphoCyclicAuctionError);
  assert.throws(() => reorder(single, 'a', 'last'), SaphoCyclicAuctionError,
    'Moving the only pending actor around skipped seats merely rotates the same effective cycle');
  const pair = { ...simple, order: ['a', 'b'], eligible: ['a', 'b'] };
  assert.deepEqual(reorder(pair, 'b', 'first'), { order: ['b', 'a'], active: 'b' });
  assert.deepEqual(reorder(pair, 'a', 'last'), { order: ['b', 'a'], active: 'b' });
});

void test('stale events, invalid permutations, nonpending actors and unavailable holders reject without repairing the lot', () => {
  const state = context(), before = structuredClone(state);
  for (const request of [
    { event: 'old-lot', player: 'd', mode: 'first' },
    { event: state.event, player: 'full', mode: 'first' },
    { event: state.event, player: 'b', mode: 'first' },
    { event: state.event, player: 'a', mode: 'first' },
    { event: state.event, player: 'missing', mode: 'last' },
    { event: state.event, player: 'd', mode: 'middle' },
  ]) assert.throws(() => reorderSaphoCyclicAuction(state, request as SaphoCyclicAuctionRequest), SaphoCyclicAuctionError);
  for (const invalid of [
    { ...state, event: '' }, { ...state, order: [] },
    { ...state, order: ['a', 'b', 'c', 'd', 'p', 'p'] },
    { ...state, order: ['a', 'b', 'c', 'p'] },
    { ...state, eligible: [...state.eligible, 'c'] },
    { ...state, eligible: [...state.eligible, 'outsider'] },
    { ...state, passed: ['p', 'p'] }, { ...state, passed: ['outsider'] },
    { ...state, bidder: 'outsider' }, { ...state, bidder: 'p' },
    { ...state, active: 'a' }, { ...state, active: 'b' }, { ...state, active: 'full' },
  ]) assert.throws(() => reorder(invalid, 'd', 'first'), SaphoCyclicAuctionError);
  assert.deepEqual(state, before);
});

void test('ordinary cyclic traversal skips prior passes on wrap and preserves strict raises and terminal outcomes', () => {
  const state = { order: ['a', 'b', 'c', 'd'], eligible: ['a', 'b', 'c', 'd'],
    active: 'd', bid: 4, bidder: 'c', passed: ['a', 'd'] };
  assert.deepEqual(quoteNormalAuctionNext(state), { kind: 'bid', player: 'b' });
  assert.deepEqual(quoteNormalAuctionNext({ ...state, active: 'b', passed: ['a', 'b', 'd'] }),
    { kind: 'payment', player: 'c' });
  assert.deepEqual(quoteNormalAuctionNext({ ...state, bid: 0, bidder: null, passed: ['a', 'b', 'c', 'd'] }),
    { kind: 'unbid' });
  assert.deepEqual(quoteNormalAuctionBid({ currentBid: 4, amount: 4, maximum: 10 }),
    { ok: false, reason: 'Bid must be an integer from 5 to 10.' });
  assert.deepEqual(quoteNormalAuctionBid({ currentBid: 4, amount: 5, maximum: 10 }), { ok: true, amount: 5 });
});

void test('normal Richese bidding skips an earlier pass after Sapho and a real raise restores that seat', () => {
  let lot = createRicheseAuction({
    event: 'black-market-2', cardId: 'physical-card', source: 'blackMarket', owner: 'r', method: 'normal',
    eligible: ['a', 'b', 'c', 'r'], order: ['a', 'b', 'c', 'r'], tieOrder: ['a', 'b', 'c', 'r'],
  });
  lot = submit(lot, 'a', 3);
  lot = submit(lot, 'b', null);
  const moved = reorder({ ...lot, active: lot.active! }, 'c', 'last');
  lot = { ...lot, ...moved, saphoOriginalOpener: lot.order[0] };
  assert.deepEqual(lot.order, ['r', 'a', 'b', 'c']);
  assert.equal(lot.active, 'r');
  lot = submit(lot, 'r', null);
  assert.equal(lot.active, 'c', 'Neither the high bidder nor the already passed b repeats an opportunity');
  assert.throws(() => submit(lot, 'c', 3), /Raise/);
  assert.throws(() => submit(lot, 'c', 4, 3), /funding/);
  lot = submit(lot, 'c', 4);
  assert.deepEqual(lot.passed, []);
  assert.equal(lot.active, 'r');
  lot = submit(lot, 'r', null);
  assert.equal(lot.active, 'a');
  lot = submit(lot, 'a', null);
  assert.equal(lot.active, 'b', 'The raise made the original passer eligible again');
  lot = submit(lot, 'b', null);
  assert.deepEqual(lot.outcome, { kind: 'sold', winner: 'c', amount: 4 });
  assert.equal(lot.active, null);
  assert.equal(lot.saphoOriginalOpener, 'a');
});

/** Controlled post-sale quote inputs only; these do not claim an original
 * action-only game history, card acquisition or payment programme. */
function continuation(): AuctionContinuationInput {
  const cards = baseDeck().slice(0, 2);
  return {
    status: 'playing', phase: 3, turn: 2, advanced: true, order: ['a', 'b', 'r'], physicalCards: cards,
    players: [
      { id: 'a', faction: 'atreides', spice: 10, hand: [cards[0]], handLimit: 4 },
      { id: 'b', faction: 'fremen', spice: 10, hand: [], handLimit: 4 },
      { id: 'r', faction: 'richese', spice: 10, hand: [], handLimit: 4 },
    ],
    auction: { cards, index: 0, bid: 4, bidder: 'a', active: 'a', passed: ['b', 'r'], opener: 0,
      saphoOrder: ['r', 'b', 'a'] },
    sale: { winner: 'a', amount: 4, free: false, origin: 'normal', seller: null },
  };
}

void test('the next normal lot drops its local Sapho override and retains the original physical opener rotation', () => {
  const input = continuation(), before = structuredClone(input);
  const result = quoteAuctionContinuation(input, { kind: 'next' });
  assert.equal(result.next.kind, 'normalLot');
  assert.ok(result.next.kind === 'normalLot');
  assert.equal(result.next.active, 'b');
  assert.equal(result.next.auction.opener, 1);
  assert.equal(result.next.auction.index, 1);
  assert.equal(Object.hasOwn(result.next.auction, 'saphoOrder'), false);
  assert.deepEqual(input, before);
});

void test('a reordered normal Black Market sale rotates the next opener from its original native first bidder', () => {
  const input = continuation();
  let lot = createRicheseAuction({ event: 'black-market-2', cardId: input.auction!.cards[0].id,
    source: 'blackMarket', owner: 'r', method: 'normal', eligible: ['a', 'b', 'r'],
    order: ['a', 'b', 'r'], tieOrder: ['a', 'b', 'r'] });
  lot = submit(lot, 'a', 4);
  const moved = reorder({ ...lot, active: lot.active! }, 'r', 'first');
  lot = { ...lot, ...moved, saphoOriginalOpener: lot.order[0] };
  lot = submit(lot, 'r', null);
  lot = submit(lot, 'b', null);
  assert.equal(lot.order[0], 'r');
  input.auction = null;
  input.richeseAuction = lot;
  input.sale = { winner: 'a', amount: 4, free: false, origin: 'blackMarket', seller: 'r' };
  input.richeseBidding = { owner: 'r', event: 'declaration-2', turn: 2, stage: 'lot', position: null,
    normalCount: null, blackMarketSold: false, cacheCanceled: false };
  input.richeseCacheCount = 8;
  const result = quoteAuctionContinuation(input, { kind: 'next' });
  assert.ok(result.next.kind === 'richeseEnd');
  assert.equal(result.next.opener, 1);
  const legacy = structuredClone(input); delete legacy.richeseAuction!.saphoOriginalOpener;
  const old = quoteAuctionContinuation(legacy, { kind: 'next' });
  assert.ok(old.next.kind === 'richeseEnd');
  assert.equal(old.next.opener, 0, 'Unstamped lots retain their old first-position opener');
});
