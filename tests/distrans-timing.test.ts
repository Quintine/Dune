import assert from 'node:assert/strict';
import test from 'node:test';
import { distransAuctionBlock as block } from '../game/distrans-timing';

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

void test('Distrans first bid or pass, committed aid and every special unpaid lot retain their timing boundary', () => {
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
  for (const method of ['onceAround', 'silent']) {
    assert.ok(block({ ...g, richeseAuction: { method, bid: 0, acted: [] } }));
    assert.ok(block({ phase: 3, auction: null, richeseAuction: { method, bid: 0, acted: [] } }));
  }
});

void test('Distrans keeps the existing paid-sale allowance independently of the later income response', () => {
  const g = fresh();
  assert.equal(block({ ...g, auction: { ...g.auction, bid: 2, bidder: 'a' },
    currentAuctionSale: { winner: 'a', amount: 2, free: false, origin: 'normal', seller: null } }), null);
});
