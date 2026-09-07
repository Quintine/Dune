import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createRicheseAuction,
  moveRicheseBidderLast,
  projectRicheseAuction,
  submitRicheseBid,
  type RicheseAuction,
  type RicheseAuctionInput,
} from '../game/richese-auction';

const create = (overrides: Partial<RicheseAuctionInput> = {}) =>
  createRicheseAuction({
    event: 'public-lot-event',
    cardId: 'treachery-8',
    owner: 'richese',
    source: 'blackMarket',
    method: 'silent',
    eligible: ['a', 'b', 'richese'],
    order: ['a', 'b', 'richese'],
    tieOrder: ['b', 'a', 'richese'],
    ...overrides,
  });
const bid = (state: RicheseAuction, actor: string, amount: number | null) =>
  submitRicheseBid(state, { event: state.event, actor, amount }, 20);

void test('concealed Black Market projections do not disclose face-encoding physical card IDs', () => {
  const lasgun = bid(create({ cardId: 'treachery-8' }), 'a', 3);
  const shield = bid(create({ cardId: 'treachery-9' }), 'a', 3);
  for (const viewer of ['a', 'b', 'observer', 'atreides']) {
    assert.deepEqual(
      projectRicheseAuction(lasgun, viewer),
      projectRicheseAuction(shield, viewer),
    );
    assert.equal(projectRicheseAuction(lasgun, viewer).cardId, null);
    assert.equal(
      JSON.stringify(projectRicheseAuction(lasgun, viewer)).includes(
        'treachery-8',
      ),
      false,
    );
  }
  assert.equal(projectRicheseAuction(lasgun, 'richese').cardId, 'treachery-8');
  assert.equal(projectRicheseAuction(shield, 'richese').cardId, 'treachery-9');
});

void test('a sold or retained Black Market lot does not automatically publish its card identity', () => {
  for (const amount of [0, 4]) {
    let state = bid(create(), 'a', amount);
    state = bid(state, 'b', 0);
    state = bid(state, 'richese', 0);
    assert.ok(state.outcome);
    for (const viewer of ['a', 'b', 'observer'])
      assert.equal(projectRicheseAuction(state, viewer).cardId, null);
    assert.equal(projectRicheseAuction(state, 'richese').cardId, 'treachery-8');
  }
});

void test('revealed cache identities remain public while ordinary cache bidding is rejected', () => {
  assert.throws(
    () => create({ source: 'cache', method: 'normal' }),
    /Once Around or Silent/,
  );
  for (const method of ['onceAround', 'silent'] as const) {
    const state = create({ source: 'cache', method });
    assert.equal(
      projectRicheseAuction(state, 'observer').cardId,
      'treachery-8',
    );
  }
  assert.equal(create({ source: 'blackMarket', method: 'normal' }).active, 'a');
});

void test('Sapho ordering survives reload, preserves completed bids and leaves Silent tie order unchanged', () => {
  let state = bid(create({ source: 'cache', method: 'onceAround' }), 'a', 2);
  state = moveRicheseBidderLast(state, state.event, 'b');
  const saved = JSON.stringify(state);
  state = JSON.parse(saved);
  assert.deepEqual(state.acted, ['a']);
  assert.deepEqual(state.tieOrder, ['b', 'a', 'richese']);
  assert.equal(state.active, 'richese');
  state = bid(state, 'richese', null);
  assert.equal(state.active, 'b');
  assert.throws(() => bid(state, 'a', 5), /Wait/);
  state = bid(state, 'b', 3);
  assert.deepEqual(state.outcome, { kind: 'sold', winner: 'b', amount: 3 });
  assert.throws(() => moveRicheseBidderLast(state, state.event, 'a'), /open/);
  assert.throws(
    () => moveRicheseBidderLast(create(), 'public-lot-event', 'b'),
    /Once Around/,
  );
});

void test('input lists and revealed bid projections cannot mutate auction authority', () => {
  const eligible = ['a', 'b'];
  const order = ['b', 'a'];
  const tieOrder = ['a', 'b'];
  let state = create({ eligible, order, tieOrder });
  eligible.pop();
  order.reverse();
  tieOrder.reverse();
  assert.deepEqual(state.eligible, ['a', 'b']);
  assert.deepEqual(state.order, ['b', 'a']);
  assert.deepEqual(state.tieOrder, ['a', 'b']);
  state = bid(state, 'b', 3);
  state = bid(state, 'a', 3);
  const view = projectRicheseAuction(state, 'a');
  view.revealedBids!.a = 19;
  view.eligible.pop();
  assert.deepEqual(state.sealed, { b: 3, a: 3 });
  assert.deepEqual(state.outcome, { kind: 'sold', winner: 'a', amount: 3 });
  assert.deepEqual(state.eligible, ['a', 'b']);
});
