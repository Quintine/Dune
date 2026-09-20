import test from 'node:test';
import assert from 'node:assert/strict';
import {
  quoteNormalAuctionBid,
  quoteNormalAuctionNext,
} from '../game/normal-auction';

void test('ordinary auction follows table order and skips full-hand seats and the high bidder', () => {
  assert.deepEqual(
    quoteNormalAuctionNext({
      order: ['a', 'full', 'b', 'c'],
      eligible: ['a', 'b', 'c'],
      active: 'a',
      bid: 3,
      bidder: 'a',
      passed: [],
    }),
    { kind: 'bid', player: 'b' },
  );
  assert.deepEqual(
    quoteNormalAuctionNext({
      order: ['a', 'full', 'b', 'c'],
      eligible: ['a', 'b', 'c'],
      active: 'c',
      bid: 4,
      bidder: 'b',
      passed: [],
    }),
    { kind: 'bid', player: 'a' },
  );
});

void test('a cleared pass list lets a prior passer reenter after a new high bid', () => {
  assert.deepEqual(
    quoteNormalAuctionNext({
      order: ['a', 'b', 'c'],
      eligible: ['a', 'b', 'c'],
      active: 'b',
      bid: 3,
      bidder: 'a',
      passed: ['b'],
    }),
    { kind: 'bid', player: 'c' },
  );
  assert.deepEqual(
    quoteNormalAuctionNext({
      order: ['a', 'b', 'c'],
      eligible: ['a', 'b', 'c'],
      active: 'c',
      bid: 5,
      bidder: 'c',
      passed: [],
    }),
    { kind: 'bid', player: 'a' },
  );
  assert.deepEqual(
    quoteNormalAuctionNext({
      order: ['a', 'b', 'c'],
      eligible: ['a', 'b', 'c'],
      active: 'a',
      bid: 5,
      bidder: 'c',
      passed: ['a'],
    }),
    { kind: 'bid', player: 'b' },
  );
});

void test('all-pass and completed winning rounds terminate without another bid', () => {
  assert.deepEqual(
    quoteNormalAuctionNext({
      order: ['a', 'b', 'c'],
      eligible: ['a', 'b', 'c'],
      active: 'c',
      bid: 0,
      bidder: null,
      passed: ['a', 'b', 'c'],
    }),
    { kind: 'unbid' },
  );
  assert.deepEqual(
    quoteNormalAuctionNext({
      order: ['a', 'b', 'c'],
      eligible: ['a', 'b', 'c'],
      active: 'c',
      bid: 4,
      bidder: 'a',
      passed: ['b', 'c'],
    }),
    { kind: 'payment', player: 'a' },
  );
});

void test('empty eligibility is unbid and malformed order fails closed', () => {
  assert.deepEqual(
    quoteNormalAuctionNext({
      order: ['a', 'b'],
      eligible: [],
      active: 'a',
      bid: 0,
      bidder: null,
      passed: [],
    }),
    { kind: 'unbid' },
  );
  assert.throws(
    () =>
      quoteNormalAuctionNext({
        order: ['a', 'b'],
        eligible: ['missing'],
        active: 'a',
        bid: 0,
        bidder: null,
        passed: [],
      }),
    /no eligible next bidder/,
  );
});

void test('ordinary bid quote accepts only safe integers within the funded range', () => {
  assert.deepEqual(
    quoteNormalAuctionBid({ currentBid: 3, amount: 4, maximum: 8 }),
    { ok: true, amount: 4 },
  );
  assert.deepEqual(
    quoteNormalAuctionBid({ currentBid: 3, amount: 8, maximum: 8 }),
    { ok: true, amount: 8 },
  );
  for (const amount of [3, 9, 4.5, Number.NaN, Number.POSITIVE_INFINITY, '4'])
    assert.deepEqual(
      quoteNormalAuctionBid({ currentBid: 3, amount, maximum: 8 }),
      { ok: false, reason: 'Bid must be an integer from 4 to 8.' },
    );
});
