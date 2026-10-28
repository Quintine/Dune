import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createPublicDeal, markPublicDealPaid, parsePublicDealPayment, PublicDealError,
  releasePublicDeal, respondPublicDeal, validatePublicDeals,
  type PublicDeal, type PublicDealSeat,
} from '../game/public-deals';
import {
  outstandingPublicDealPayments, pendingPublicDealPayments, publicDealPaymentTotal,
} from '../game/public-deal-obligations';

const seats: PublicDealSeat[] = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
const payment = (dueTurn: number, amount = 3) => ({
  kind: 'deferredBribe' as const, payer: 'a', recipient: 'b', amount, dueTurn,
});
const offer = (id: string, dueTurn: number, turn = 3) =>
  createPublicDeal(seats, 'a', 'b', 'Pay by the agreed turn.', turn, id, payment(dueTurn));
const accept = (id: string, dueTurn: number, turn = 3) =>
  respondPublicDeal(offer(id, dueTurn, turn), seats, 'b', true);

void test('a deferred term retains an exact safe deadline at or after its offer turn', () => {
  const immediate = { kind: 'immediateBribe', payer: 'a', recipient: 'b', amount: 2 } as const;
  assert.deepEqual(parsePublicDealPayment(immediate, ['a', 'b']), immediate);
  assert.deepEqual(parsePublicDealPayment(payment(3), ['a', 'b'], 3), payment(3));
  assert.deepEqual(parsePublicDealPayment(payment(7), ['a', 'b'], 3), payment(7));
  assert.deepEqual(parsePublicDealPayment(payment(100), ['a', 'b'], 3), payment(100),
    'A later agreed game extension may make a distant deadline reachable.');
  for (const invalid of [payment(2), payment(0), payment(3.5), payment(Infinity),
    payment(Number.MAX_SAFE_INTEGER + 1), { ...payment(4), extra: true }])
    assert.throws(() => parsePublicDealPayment(invalid, ['a', 'b'], 3), PublicDealError);
  assert.throws(() => parsePublicDealPayment(payment(4), ['a', 'b']), PublicDealError);
  assert.throws(() => parsePublicDealPayment(payment(4), ['a', 'b'], 0), PublicDealError);
  assert.throws(() => parsePublicDealPayment({ ...payment(4), recipient: 'c' }, ['a', 'b'], 3), PublicDealError);
});

void test('separate pending and outstanding views preserve current-turn semantics', () => {
  const current = accept('current', 3);
  const later = accept('later', 5);
  const farther = accept('farther', 9);
  const paid = markPublicDealPaid(accept('paid', 8), seats, 'a');
  const declined = respondPublicDeal(offer('declined', 6), seats, 'b', false);
  const offered = offer('offered', 7);
  const deals: PublicDeal[] = [current, later, farther, paid, declined, offered];
  assert.deepEqual(pendingPublicDealPayments(deals, 'a', 3).map(row => row.deal), ['current']);
  assert.equal(publicDealPaymentTotal(deals, 'a', 3), 3);
  assert.deepEqual(outstandingPublicDealPayments(deals, 'a', 3).map(row => row.deal), ['current', 'later', 'farther']);
  assert.deepEqual(outstandingPublicDealPayments(deals, 'a', 4).map(row => row.deal), ['later', 'farther']);
  assert.deepEqual(pendingPublicDealPayments(deals, 'a', 5).map(row => row.deal), ['later']);
  assert.equal(publicDealPaymentTotal(deals, 'a', 5), 3);
  assert.deepEqual(outstandingPublicDealPayments(deals, 'a', 10), []);
  assert.deepEqual(outstandingPublicDealPayments(deals, 'c', 3), []);
  assert.equal(deals[0].paymentStatus, 'pending', 'Reading after a deadline never mutates a receipt.');
});

void test('early settlement and mutual release preserve exact future receipt history', () => {
  const pending = accept('future', 6);
  const copied = JSON.parse(JSON.stringify(pending)) as PublicDeal;
  validatePublicDeals([copied], seats);
  const paid = markPublicDealPaid(copied, seats, 'a');
  assert.equal(paid.paymentStatus, 'paid');
  const stillPaid = releasePublicDeal(releasePublicDeal(paid, seats, 'a', true), seats, 'b', true);
  assert.equal(stillPaid.status, 'released');
  assert.equal(stillPaid.paymentStatus, 'paid');
  const canceled = releasePublicDeal(releasePublicDeal(pending, seats, 'a', true), seats, 'b', true);
  assert.equal(canceled.paymentStatus, 'released');
  assert.deepEqual(outstandingPublicDealPayments([stillPaid, canceled], 'a', 3), []);
  assert.equal(pending.paymentStatus, 'pending', 'Pure transitions preserve the original record.');
});
