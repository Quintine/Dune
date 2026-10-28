import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createMultipartyPublicDeal, createPublicDeal, markPublicDealPaid, parsePublicDealPayment,
  PublicDealError, releasePublicDeal, respondPublicDeal, validatePublicDeals,
  voidPublicDealPayment, type PublicDeal, type PublicDealSeat,
} from '../game/public-deals';
import {
  pendingPublicDealPayments, publicDealPaymentTotal, PublicDealObligationError,
  reconcilePublicDealPayments,
} from '../game/public-deal-obligations';

const seats: PublicDealSeat[] = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
const deferred = (amount: number) => ({
  kind: 'deferredBribe' as const, payer: 'a', recipient: 'b', amount, dueTurn: 3,
});
const accept = (id: string, amount: number) =>
  respondPublicDeal(createPublicDeal(seats, 'a', 'b', 'Pay during this turn', 3, id, deferred(amount)), seats, 'b', true);

void test('deferred deal terms bind an exact positive payment to this turn without changing immediate terms', () => {
  const immediate = { kind: 'immediateBribe', payer: 'a', recipient: 'b', amount: 2 } as const;
  assert.deepEqual(parsePublicDealPayment(immediate, ['a', 'b']), immediate);
  assert.deepEqual(parsePublicDealPayment(deferred(4), ['a', 'b'], 3), deferred(4));
  for (const input of [
    { ...deferred(4), dueTurn: 2 }, { ...deferred(0) },
    { ...deferred(4), recipient: 'c' }, { ...deferred(4), extra: true },
  ]) assert.throws(() => parsePublicDealPayment(input, ['a', 'b'], 3), PublicDealError);
  assert.throws(() => parsePublicDealPayment(deferred(4), ['a', 'b']), PublicDealError);
  assert.throws(() => createPublicDeal(seats, 'a', 'b', 'Pay later', 4, 'wrong-turn', deferred(4)), PublicDealError);
});

void test('all signatories accept before a future payment becomes pending; only its payer can settle it once', () => {
  const offered = createMultipartyPublicDeal(seats, 'a', ['b', 'c'], 'Pay later', 3, 'group', deferred(4));
  const partially = respondPublicDeal(offered, seats, 'b', true);
  assert.equal(partially.status, 'offered');
  assert.equal(partially.paymentStatus, undefined);
  const active = respondPublicDeal(partially, seats, 'c', true);
  assert.equal(active.paymentStatus, 'pending');
  assert.throws(() => markPublicDealPaid(active, seats, 'b'), PublicDealError);
  const paid = markPublicDealPaid(active, seats, 'a');
  assert.equal(paid.paymentStatus, 'paid');
  assert.throws(() => markPublicDealPaid(paid, seats, 'a'), PublicDealError);
  let released = releasePublicDeal(paid, seats, 'a', true);
  released = releasePublicDeal(released, seats, 'b', true);
  released = releasePublicDeal(released, seats, 'c', true);
  assert.equal(released.status, 'released');
  assert.equal(released.paymentStatus, 'paid');
  validatePublicDeals([{ ...offered, id: 'offered' }, active, { ...released, id: 'released' }], seats);
});

void test('mutual release and proven impossibility end only an unpaid accepted payment', () => {
  const first = accept('first', 4);
  const vote = releasePublicDeal(first, seats, 'a', true);
  assert.equal(vote.paymentStatus, 'pending');
  const released = releasePublicDeal(vote, seats, 'b', true);
  assert.equal(released.paymentStatus, 'released');
  const impossible = voidPublicDealPayment(first, seats);
  assert.equal(impossible.paymentStatus, 'void');
  assert.throws(() => markPublicDealPaid(impossible, seats, 'a'), PublicDealError);
  assert.throws(() => voidPublicDealPayment(released, seats), PublicDealError);
  const bad = [
    { ...first, paymentStatus: undefined }, { ...first, paymentStatus: 'released' },
    { ...first, status: 'offered', paymentStatus: 'pending' },
    { ...first, payment: { ...deferred(4), dueTurn: 2 } },
    { ...first, payment: { kind: 'immediateBribe', payer: 'a', recipient: 'b', amount: 4 }, paymentStatus: 'paid' },
  ];
  for (const deal of bad) assert.throws(() => validatePublicDeals([deal], seats), PublicDealError);
});

void test('distinct pending agreements add, voluntary spending is guarded, and uncertain external shortage does not erase them', () => {
  const deals: PublicDeal[] = [accept('first', 4), accept('second', 5)];
  const original = structuredClone(deals);
  assert.deepEqual(pendingPublicDealPayments(deals, 'a', 3).map(row => [row.deal, row.amount]), [['first', 4], ['second', 5]]);
  assert.equal(publicDealPaymentTotal(deals, 'a', 3), 9);
  assert.equal(publicDealPaymentTotal(deals, 'b', 3), 0);
  assert.equal(publicDealPaymentTotal(deals, 'a', 4), 0);
  assert.throws(() => reconcilePublicDealPayments(deals, seats, 'a', 3,
    { available: 8, change: 'voluntary' }), PublicDealObligationError);
  assert.deepEqual(reconcilePublicDealPayments(deals, seats, 'a', 3,
    { available: 8, change: 'external' }), deals, 'Current shortage does not prove impossibility.');
  assert.deepEqual(reconcilePublicDealPayments(deals, seats, 'a', 3,
    { available: null, change: 'external' }), deals);
  const reconciled = reconcilePublicDealPayments(deals, seats, 'a', 3,
    { available: null, change: 'external', impossibleDealIds: ['second'] });
  assert.equal(reconciled[0].paymentStatus, 'pending');
  assert.equal(reconciled[1].paymentStatus, 'void');
  assert.equal(publicDealPaymentTotal(reconciled, 'a', 3), 4);
  assert.throws(() => reconcilePublicDealPayments(deals, seats, 'a', 3,
    { available: 9, change: 'voluntary', impossibleDealIds: ['second'] }), PublicDealObligationError);
  assert.throws(() => reconcilePublicDealPayments(deals, seats, 'a', 3,
    { available: 9, change: 'external', impossibleDealIds: ['other'] }), PublicDealObligationError);
  assert.deepEqual(deals, original, 'Rejected quotes and pure transitions preserve the caller’s state.');
});

void test('individually valid payments cannot overflow their combined obligation', () => {
  const deals = [accept('large', Number.MAX_SAFE_INTEGER), accept('one', 1)];
  assert.throws(() => publicDealPaymentTotal(deals, 'a', 3), PublicDealObligationError);
});
