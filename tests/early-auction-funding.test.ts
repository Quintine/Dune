import assert from 'node:assert/strict';
import test from 'node:test';
import { earlyAuctionFunding, type EarlyAuctionFunding } from '../game/early-auction-funding';
import { createRicheseAuction, submitRicheseBid } from '../game/richese-auction';

const input = (): EarlyAuctionFunding => ({ phase: 3, owner: 'buyer', ally: 'ally',
  paid: false, normal: null, pledge: 8, funding: {} });
function lot(method: 'onceAround' | 'silent') {
  return createRicheseAuction({ event: 'native-lot', cardId: 'held-cache-card',
    source: 'cache', owner: 'richese', method, eligible: ['buyer', 'ally', 'richese'],
    order: ['buyer', 'ally', 'richese'], tieOrder: ['buyer', 'ally', 'richese'] });
}
void test('an unpaid ordinary invoice keeps its own cash and donated escrow distinct', () => {
  assert.deepEqual(earlyAuctionFunding({ ...input(), normal: { bidder: 'buyer', bid: 7, allyPayment: 2 } }),
    { normalCash: 5, nativeCash: 0, refund: 8 });
  assert.deepEqual(earlyAuctionFunding({ ...input(), normal: { bidder: 'ally', bid: 7, allyPayment: 3 } }),
    { normalCash: 0, nativeCash: 0, refund: 5 });
});
void test('native Once Around owns only the leading exact split and releases an outbid offer', () => {
  const funding = { buyer: { amount: 7, allyPayment: 2, donor: 'ally' },
    ally: { amount: 8, allyPayment: 3, donor: 'buyer' } };
  let native = submitRicheseBid(lot('onceAround'), { event: 'native-lot', actor: 'buyer', amount: 7 }, 20);
  assert.deepEqual(earlyAuctionFunding({ ...input(), native, funding }), { normalCash: 0, nativeCash: 5, refund: 8 });
  native = submitRicheseBid(native, { event: 'native-lot', actor: 'ally', amount: 8 }, 20);
  assert.deepEqual(earlyAuctionFunding({ ...input(), native, funding }), { normalCash: 0, nativeCash: 0, refund: 5 });
});
void test('own Silent funding is exact while a submitted ally locks the whole pledge regardless of secret split', () => {
  let native = submitRicheseBid(lot('silent'), { event: 'native-lot', actor: 'buyer', amount: 7 }, 20);
  const funding = { buyer: { amount: 7, allyPayment: 2, donor: 'ally' },
    ally: { amount: 8, allyPayment: 1, donor: 'buyer' } };
  assert.deepEqual(earlyAuctionFunding({ ...input(), native, funding }), { normalCash: 0, nativeCash: 5, refund: 8 });
  native = submitRicheseBid(native, { event: 'native-lot', actor: 'ally', amount: 8 }, 20);
  for (const allyPayment of [0, 1, 5, 8]) {
    const quote = earlyAuctionFunding({ ...input(), native, funding: { ...funding,
      ally: { ...funding.ally, allyPayment } } });
    assert.deepEqual(quote, { normalCash: 0, nativeCash: 5, refund: 0 });
  }
});
void test('a revealed native winner reserves its actual donor leg and a losing offer spends nothing', () => {
  let native = lot('silent');
  for (const [actor, amount] of [['buyer', 7], ['ally', 8], ['richese', 0]] as const)
    native = submitRicheseBid(native, { event: native.event, actor, amount }, 20);
  const funding = { buyer: { amount: 7, allyPayment: 2, donor: 'ally' },
    ally: { amount: 8, allyPayment: 3, donor: 'buyer' } };
  assert.deepEqual(earlyAuctionFunding({ ...input(), native, funding }), { normalCash: 0, nativeCash: 0, refund: 5 });
});
void test('an already-paid sale and a later phase do not charge an old invoice twice', () => {
  const native = submitRicheseBid(lot('onceAround'), { event: 'native-lot', actor: 'buyer', amount: 7 }, 20);
  const state = { ...input(), native, funding: { buyer: { amount: 7, allyPayment: 0, donor: null } },
    normal: { bidder: 'buyer', bid: 4, allyPayment: 0 } };
  assert.deepEqual(earlyAuctionFunding({ ...state, paid: true }), { normalCash: 0, nativeCash: 0, refund: 8 });
  assert.deepEqual(earlyAuctionFunding({ ...state, phase: 2 }), { normalCash: 0, nativeCash: 0, refund: 8 });
});
void test('a malformed donated invoice cannot create a negative refund', () => {
  assert.throws(() => earlyAuctionFunding({ ...input(), pledge: 2,
    normal: { bidder: 'ally', bid: 4, allyPayment: 4 } }), RangeError);
});
