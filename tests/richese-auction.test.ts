import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createRicheseAuction,
  submitRicheseBid,
  projectRicheseAuction,
  moveRicheseBidderLast,
  type RicheseAuction,
  type RicheseAuctionInput,
} from '../game/richese-auction';

const create = (overrides: Partial<RicheseAuctionInput> = {}) =>
  createRicheseAuction({
    event: 'lot-1',
    cardId: 'physical-1',
    source: 'cache',
    owner: 'r',
    method: 'onceAround',
    eligible: ['r', 'a', 'b'],
    order: ['r', 'a', 'b'],
    tieOrder: ['b', 'r', 'a'],
    ...overrides,
  });
const bid = (
  state: RicheseAuction,
  actor: string,
  amount: number | null,
  max = 20,
) => submitRicheseBid(state, { event: state.event, actor, amount }, max);

void test('Once Around follows supplied physical direction, skips ineligible seats and offers owner last', () => {
  let state = create({ order: ['r', 'empty', 'b', 'a'] });
  assert.deepEqual(state.order, ['b', 'a', 'r']);
  state = bid(state, 'b', 2);
  state = bid(state, 'a', 4);
  assert.equal(state.active, 'r');
  assert.throws(() => bid(state, 'b', 5), /Wait/);
  state = bid(state, 'r', 5);
  assert.deepEqual(state.outcome, { kind: 'sold', winner: 'r', amount: 5 });
});

void test('Once Around owner decline preserves highest other bid and excludes an ineligible seller', () => {
  let state = bid(create(), 'a', 3);
  state = bid(state, 'b', null);
  state = bid(state, 'r', null);
  assert.deepEqual(state.outcome, { kind: 'sold', winner: 'a', amount: 3 });
  state = create({ eligible: ['a', 'b'] });
  state = bid(state, 'a', 2);
  state = bid(state, 'b', null);
  assert.deepEqual(state.outcome, { kind: 'sold', winner: 'a', amount: 2 });
});

void test('Once Around all-other-pass becomes unbid without a redundant owner acknowledgment', () => {
  for (const source of ['cache', 'blackMarket'] as const) {
    let state = create({ source });
    state = bid(state, 'a', null);
    state = bid(state, 'b', null);
    assert.deepEqual(state.outcome, { kind: 'unbid' });
    assert.equal(state.active, null);
    assert.deepEqual(state.acted, ['a', 'b']);
  }
  assert.deepEqual(create({ eligible: ['r'] }).outcome, { kind: 'unbid' });
});

void test('normal auctions allow a prior passer to reenter after a raise and skip the high bidder', () => {
  let state = create({
    method: 'normal',
    source: 'blackMarket',
    order: ['a', 'b', 'r'],
  });
  state = bid(state, 'a', null);
  state = bid(state, 'b', 2);
  state = bid(state, 'r', null);
  assert.equal(state.active, 'a');
  state = bid(state, 'a', 4);
  assert.deepEqual(state.passed, []);
  assert.equal(state.active, 'b');
  state = bid(state, 'b', null);
  state = bid(state, 'r', null);
  assert.deepEqual(state.outcome, { kind: 'sold', winner: 'a', amount: 4 });
});

void test('normal all-pass, empty eligibility and single-bidder outcomes terminate correctly', () => {
  let state = create({ method: 'normal', source: 'blackMarket' });
  for (const actor of ['r', 'a', 'b']) state = bid(state, actor, null);
  assert.deepEqual(state.outcome, { kind: 'unbid' });
  for (const method of ['normal', 'onceAround', 'silent'] as const)
    assert.deepEqual(
      create({ method, source: 'blackMarket', eligible: [] }).outcome,
      {
        kind: 'unbid',
      },
    );
  state = bid(
    create({ method: 'normal', source: 'blackMarket', eligible: ['a'] }),
    'a',
    1,
  );
  assert.deepEqual(state.outcome, { kind: 'sold', winner: 'a', amount: 1 });
});

void test('Silent commitments accept arbitrary submission order and break ties by storm order', () => {
  let state = create({ method: 'silent' });
  state = bid(state, 'r', 6);
  state = bid(state, 'a', 6);
  assert.equal(state.outcome, null);
  assert.equal(state.bid, 0);
  assert.equal(state.bidder, null);
  state = bid(state, 'b', 6);
  assert.deepEqual(state.outcome, { kind: 'sold', winner: 'b', amount: 6 });
  assert.deepEqual(projectRicheseAuction(state, 'observer').revealedBids, {
    r: 6,
    a: 6,
    b: 6,
  });
});

void test('Silent zero bids are valid declines and never produce a zero-spice winner', () => {
  let state = create({ method: 'silent' });
  assert.throws(() => bid(state, 'a', null), /zero/);
  for (const actor of ['a', 'r', 'b']) state = bid(state, actor, 0, 0);
  assert.deepEqual(state.outcome, { kind: 'unbid' });
  assert.deepEqual(projectRicheseAuction(state, 'r').revealedBids, {
    a: 0,
    r: 0,
    b: 0,
  });
});

void test('private projections are invariant to opponent sealed amounts before reveal', () => {
  const low = bid(create({ method: 'silent' }), 'a', 1);
  const high = bid(create({ method: 'silent' }), 'a', 17);
  for (const viewer of ['r', 'b', 'observer']) {
    assert.deepEqual(
      projectRicheseAuction(low, viewer),
      projectRicheseAuction(high, viewer),
    );
    assert.equal('sealed' in projectRicheseAuction(high, viewer), false);
  }
  assert.equal(projectRicheseAuction(high, 'a').ownBid, 17);
  assert.deepEqual(projectRicheseAuction(high, 'b').submitted, ['a']);
  const view = projectRicheseAuction(high, 'a');
  view.order.reverse();
  assert.deepEqual(high.order, ['r', 'a', 'b']);
});

void test('stale events, duplicate commitments, wrong actors and invalid funded bids reject without mutation', () => {
  const state = bid(create({ method: 'silent' }), 'a', 3);
  const original = JSON.stringify(state);
  for (const amount of [-1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])
    assert.throws(() => bid(state, 'b', amount));
  assert.throws(() => bid(state, 'b', 6, 5), /funding/);
  assert.throws(() => bid(state, 'b', 1, -1));
  assert.throws(() => bid(state, 'a', 4), /already submitted/);
  assert.throws(() => bid(state, 'outsider', 1), /cannot bid/);
  assert.throws(
    () => submitRicheseBid(state, { event: 'old', actor: 'b', amount: 1 }, 20),
    /expired/,
  );
  assert.equal(JSON.stringify(state), original);
  const ordinary = bid(
    create({ method: 'normal', source: 'blackMarket' }),
    'r',
    3,
  );
  assert.throws(() => bid(ordinary, 'a', 3), /Raise/);
  assert.throws(() => bid(ordinary, 'r', 4), /Wait/);
});

void test('a restored auction finishes once and replayed or stale terminal submissions fail', () => {
  const original = bid(create(), 'a', 2);
  const snapshot = JSON.stringify(original);
  let state: RicheseAuction = JSON.parse(snapshot);
  state = bid(state, 'b', null);
  state = bid(state, 'r', null);
  assert.deepEqual(state.outcome, { kind: 'sold', winner: 'a', amount: 2 });
  assert.equal(JSON.stringify(original), snapshot);
  assert.throws(() => bid(state, 'r', 3), /already complete/);
  const clone = JSON.parse(JSON.stringify(state));
  assert.deepEqual(
    projectRicheseAuction(clone, 'r'),
    projectRicheseAuction(state, 'r'),
  );
});

void test('legal last-position override can put an unacted opponent after Richese without repeating completed bids', () => {
  let state = bid(create(), 'a', 2);
  const original = structuredClone(state);
  state = moveRicheseBidderLast(state, state.event, 'b');
  assert.deepEqual(state.order, ['a', 'r', 'b']);
  assert.equal(state.active, 'r');
  state = bid(state, 'r', 3);
  assert.equal(state.active, 'b');
  state = bid(state, 'b', 4);
  assert.deepEqual(state.outcome, { kind: 'sold', winner: 'b', amount: 4 });
  assert.deepEqual(original.order, ['a', 'b', 'r']);
  assert.throws(
    () => moveRicheseBidderLast(original, original.event, 'a'),
    /has not bid/,
  );
  assert.throws(() => moveRicheseBidderLast(original, 'old', 'b'), /expired/);
  assert.throws(() => moveRicheseBidderLast(state, state.event, 'b'), /open/);
});

void test('an unacted bidder moved after owner prevents premature all-pass closure', () => {
  let state = bid(create(), 'a', null);
  state = moveRicheseBidderLast(state, state.event, 'b');
  assert.equal(state.active, 'r');
  assert.equal(state.outcome, null);
  state = bid(state, 'r', null);
  assert.equal(state.active, 'b');
  state = bid(state, 'b', 1);
  assert.deepEqual(state.outcome, { kind: 'sold', winner: 'b', amount: 1 });
});

void test('construction rejects ambiguous seat ordering and does not select seller participation', () => {
  assert.throws(() => create({ eligible: ['a', 'a'] }), /distinct/);
  assert.throws(() => create({ order: ['a', 'a', 'b', 'r'] }), /distinct/);
  assert.throws(() => create({ tieOrder: ['a', 'b'] }), /position/);
  assert.throws(() => create({ event: '' }), /event/);
  const state = create({
    method: 'silent',
    source: 'blackMarket',
    eligible: ['a', 'b'],
  });
  assert.throws(() => bid(state, 'r', 1), /cannot bid/);
  assert.deepEqual(state.eligible, ['a', 'b']);
});
