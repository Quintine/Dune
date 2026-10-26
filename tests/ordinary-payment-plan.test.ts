import assert from 'node:assert/strict';
import test from 'node:test';
import { splitOrdinaryPayments } from '../game/ordinary-payment-plan';

void test('payment installments conserve the exact original deficits across recipients', () => {
  const payments = [{ recipient: 'harkonnen', amount: 3 }, { recipient: 'atreides', amount: 3 }];
  const original = structuredClone(payments), result = splitOrdinaryPayments(payments, 5);
  assert.deepEqual(result, { before: [payments[0], { recipient: 'atreides', amount: 2 }],
    after: [{ recipient: 'atreides', amount: 1 }], total: 6 });
  for (const payment of payments) assert.equal([...result.before, ...result.after]
    .filter(part => part.recipient === payment.recipient).reduce((sum, part) => sum + part.amount, 0), payment.amount);
  assert.deepEqual(payments, original);
});

void test('no cash defers the whole payment and enough cash needs no later installment', () => {
  const payments = [{ recipient: 'emperor', amount: 6 }];
  assert.deepEqual(splitOrdinaryPayments(payments, 0), { before: [], after: payments, total: 6 });
  assert.deepEqual(splitOrdinaryPayments(payments, 6), { before: payments, after: [], total: 6 });
  assert.deepEqual(splitOrdinaryPayments([], 2), { before: [], after: [], total: 0 });
});

void test('invalid or overflowing payment partitions cannot become a funding witness', () => {
  for (const available of [-1, 1.5, Infinity]) assert.throws(() => splitOrdinaryPayments([], available));
  for (const payments of [[{ recipient: ' e', amount: 1 }], [{ recipient: 'e', amount: 0 }],
    [{ recipient: 'e', amount: Number.MAX_SAFE_INTEGER }, { recipient: 'a', amount: 1 }]])
    assert.throws(() => splitOrdinaryPayments(payments, 0));
});
