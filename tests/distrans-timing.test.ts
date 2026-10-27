import assert from 'node:assert/strict';
import test from 'node:test';
import { distransAuctionBlock as block } from '../game/distrans-timing';
import { createRicheseAuction, submitRicheseBid } from '../game/richese-auction';

const fresh = () => ({ phase: 3, auction: { cards: ['original-lot'], index: 0,
  bid: 0, bidder: null as string | null, active: 'a', passed: [] as string[],
  opener: 0, peekKnown: true, allyPayment: 0 } });

void test('Distrans quotes a virgin physical ordinary lot without rewriting its inspected card or cycle', () => {
  const g = fresh(), before = structuredClone(g);
  assert.equal(block(g), null);
  assert.deepEqual(g, before);
  assert.equal(block({ ...g, auction: { ...g.auction, cards: ['earlier-sold', 'current'], index: 1 } }), null);
  assert.equal(block({ phase: 3, auction: null }), null);
});

void test('Distrans first bid or pass and committed aid retain the ordinary-lot timing boundary', () => {
  const g = fresh();
  for (const auction of [
    { ...g.auction, bid: 1, bidder: 'a' },
    { ...g.auction, passed: ['a'] },
    { ...g.auction, bidder: 'a' },
    { ...g.auction, allyPayment: 1 },
    { ...g.auction, index: -1 },
    { ...g.auction, index: 1 },
    { ...g.auction, index: 0.5 },
    { ...g.auction, cards: [] },
  ]) assert.match(block({ ...g, auction })!, /after bidding starts/);
  assert.ok(block({ ...g, phase: 4 }));
});

function special(method: 'onceAround' | 'silent' | 'normal', source: 'cache' | 'blackMarket' = 'cache') {
  return createRicheseAuction({ event: 'lot-event', cardId: 'physical-card', source,
    owner: 'r', method, eligible: ['a', 'r', 'b'], order: ['a', 'r', 'b'],
    tieOrder: ['r', 'a', 'b'] });
}

void test('Distrans can be used provisionally before the first decision in a genuine Richese special lot', () => {
  for (const method of ['onceAround', 'silent'] as const)
    for (const source of ['cache', 'blackMarket'] as const) {
      const lot = special(method, source), before = structuredClone(lot);
      assert.equal(block({ phase: 3, auction: null, richeseAuction: lot, richeseFunding: {} }), null);
      assert.deepEqual(lot, before);
      assert.ok(block({ phase: 4, auction: null, richeseAuction: lot }));
      assert.ok(block({ ...fresh(), richeseAuction: lot }));
    }
  const normal = special('normal', 'blackMarket'), before = structuredClone(normal);
  assert.equal(block({ phase: 3, auction: null, richeseAuction: normal, richeseFunding: {} }), null);
  assert.deepEqual(normal, before);
});

void test('a first pass, bid, zero sealed submission, funding or invalid special lot closes the pre-bid opportunity', () => {
  const once = special('onceAround'), silent = special('silent'), normal = special('normal', 'blackMarket');
  const pass = submitRicheseBid(once, { event: once.event, actor: once.active!, amount: null }, 0);
  const bid = submitRicheseBid(once, { event: once.event, actor: once.active!, amount: 1 }, 1);
  const sealed = submitRicheseBid(silent, { event: silent.event, actor: 'a', amount: 0 }, 0);
  const normalPass = submitRicheseBid(normal, { event: normal.event, actor: normal.active!, amount: null }, 0);
  const normalBid = submitRicheseBid(normal, { event: normal.event, actor: normal.active!, amount: 1 }, 1);
  for (const lot of [pass, bid, sealed, normalPass, normalBid,
    { ...once, event: '' },
    { ...once, active: 'b' },
    { ...once, cardId: '' },
    { ...once, order: ['a', 'a', 'r'] },
    { ...once, tieOrder: ['a', 'r', 'r'] },
    { ...once, outcome: { kind: 'unbid' as const } },
    { ...normal, source: 'cache' as const },
    { ...normal, active: 'r' },
    { ...silent, active: 'a' },
    { ...silent, passed: ['a'] },
    { ...silent, acted: ['a'] },
    { ...silent, sealed: { a: 0 } },
  ]) assert.ok(block({ phase: 3, auction: null, richeseAuction: lot }));
  assert.ok(block({ phase: 3, auction: null, richeseAuction: once, richeseFunding: { a: { amount: 0 } } }));
});

void test('Distrans keeps the existing paid-sale allowance independently of the later income response', () => {
  const g = fresh();
  assert.equal(block({ ...g, auction: { ...g.auction, bid: 2, bidder: 'a' },
    currentAuctionSale: { winner: 'a', amount: 2, free: false, origin: 'normal', seller: null } }), null);
});
