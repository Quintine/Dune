import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createRicheseAuction,
  submitRicheseBid,
  type RicheseAuction,
} from '../game/richese-auction';
import {
  validateRicheseFunding,
  richeseOwnCommitment,
  richeseAllyCommitment,
  type RicheseFunding,
} from '../game/richese-funding';

const create = (method: RicheseAuction['method'] = 'silent') =>
  createRicheseAuction({
    event: 'lot',
    cardId: 'opaque',
    source: method === 'normal' ? 'blackMarket' : 'cache',
    owner: 'r',
    method,
    eligible: ['a', 'b', 'r'],
    order: ['a', 'b', 'r'],
    tieOrder: ['b', 'a', 'r'],
  });
const bid = (state: RicheseAuction, actor: string, amount: number | null) =>
  submitRicheseBid(state, { event: state.event, actor, amount }, 100);
const funding: RicheseFunding = {
  a: { amount: 8, allyPayment: 3, donor: 'donor-a' },
  b: { amount: 10, allyPayment: 4, donor: 'donor-b' },
  r: { amount: 6, allyPayment: 0, donor: null },
  outsider: { amount: 99, allyPayment: 99, donor: 'donor-a' },
};

void test('funding validates the exact own/ally split without reallocating a funded total', () => {
  assert.deepEqual(validateRicheseFunding(8, 3, 5, 3), { own: 5, ally: 3 });
  assert.deepEqual(validateRicheseFunding(8, 0, 8, 0), { own: 8, ally: 0 });
  assert.deepEqual(validateRicheseFunding(8, 8, 0, 8), { own: 0, ally: 8 });
  assert.deepEqual(validateRicheseFunding(0, 0, 0, 0), { own: 0, ally: 0 });
  assert.throws(() => validateRicheseFunding(8, 3, 4, 100), /split/);
  assert.throws(() => validateRicheseFunding(8, 3, 100, 2), /split/);
  assert.throws(() => validateRicheseFunding(8, 9, 100, 100), /exceed/);
});

void test('every funding input rejects fractional, negative, nonfinite and unsafe numbers', () => {
  for (const bad of [
    -1,
    0.5,
    NaN,
    Infinity,
    -Infinity,
    Number.MAX_SAFE_INTEGER + 1,
  ])
    for (let position = 0; position < 4; position++) {
      const args: [number, number, number, number] = [8, 3, 5, 3];
      args[position] = bad;
      assert.throws(() => validateRicheseFunding(...args), /safe integer/);
    }
  // Individual safe limits are valid even when their sum would overflow.
  assert.deepEqual(
    validateRicheseFunding(
      Number.MAX_SAFE_INTEGER,
      0,
      Number.MAX_SAFE_INTEGER,
      Number.MAX_SAFE_INTEGER,
    ),
    { own: Number.MAX_SAFE_INTEGER, ally: 0 },
  );
});

void test('unfinished Silent reserves every submitted offer and no unsubmitted ledger draft', () => {
  let state = create();
  assert.equal(richeseOwnCommitment(state, funding, 'a'), 0);
  state = bid(state, 'a', 8);
  state = bid(state, 'b', 10);
  assert.equal(state.outcome, null);
  assert.equal(richeseOwnCommitment(state, funding, 'a'), 5);
  assert.equal(richeseOwnCommitment(state, funding, 'b'), 6);
  assert.equal(richeseOwnCommitment(state, funding, 'r'), 0);
  assert.equal(richeseAllyCommitment(state, funding, 'donor-a'), 3);
  assert.equal(richeseAllyCommitment(state, funding, 'donor-b'), 4);
  assert.equal(richeseOwnCommitment(state, funding, 'outsider'), 0);
});

void test('normal and Once Around reserve only the current highest bidder and release an outbid offer', () => {
  for (const method of ['normal', 'onceAround'] as const) {
    let state = bid(create(method), 'a', 8);
    assert.equal(richeseOwnCommitment(state, funding, 'a'), 5);
    assert.equal(richeseAllyCommitment(state, funding, 'donor-a'), 3);
    state = bid(state, 'b', 10);
    assert.equal(richeseOwnCommitment(state, funding, 'a'), 0);
    assert.equal(richeseAllyCommitment(state, funding, 'donor-a'), 0);
    assert.equal(richeseOwnCommitment(state, funding, 'b'), 6);
    assert.equal(richeseAllyCommitment(state, funding, 'donor-b'), 4);
  }
});

void test('terminal Silent immediately releases losers but retains winner until its funding is cleared', () => {
  let state = create();
  for (const actor of ['a', 'b', 'r'])
    state = bid(state, actor, funding[actor].amount);
  assert.deepEqual(state.outcome, { kind: 'sold', winner: 'b', amount: 10 });
  assert.equal(richeseOwnCommitment(state, funding, 'a'), 0);
  assert.equal(richeseOwnCommitment(state, funding, 'r'), 0);
  assert.equal(richeseAllyCommitment(state, funding, 'donor-a'), 0);
  assert.equal(richeseOwnCommitment(state, funding, 'b'), 6);
  assert.equal(richeseAllyCommitment(state, funding, 'donor-b'), 4);
  const cleared = structuredClone(funding);
  delete cleared.b;
  assert.equal(richeseOwnCommitment(state, cleared, 'b'), 0);
  assert.equal(richeseAllyCommitment(state, cleared, 'donor-b'), 0);
});

void test('terminal normal/Once Around retain winning commitments while unbid and absent auctions reserve nothing', () => {
  for (const method of ['normal', 'onceAround'] as const) {
    let state = bid(create(method), 'a', 8);
    state = bid(state, 'b', null);
    state = bid(state, 'r', null);
    assert.equal(state.outcome?.kind, 'sold');
    assert.equal(richeseOwnCommitment(state, funding, 'a'), 5);
    assert.equal(richeseAllyCommitment(state, funding, 'donor-a'), 3);
  }
  let unbid = bid(create('onceAround'), 'a', null);
  unbid = bid(unbid, 'b', null);
  for (const state of [unbid, null, undefined]) {
    assert.equal(richeseOwnCommitment(state, funding, 'a'), 0);
    assert.equal(richeseAllyCommitment(state, funding, 'donor-a'), 0);
  }
});

void test('donor queries reveal only the requested donor commitment and aggregate shared funding defensively', () => {
  let state = bid(create(), 'a', 8);
  state = bid(state, 'b', 10);
  const ledger = structuredClone(funding);
  ledger.b.donor = 'donor-a';
  assert.equal(richeseAllyCommitment(state, ledger, 'donor-a'), 7);
  assert.equal(richeseAllyCommitment(state, ledger, 'unrelated'), 0);
  ledger.a.amount = 900;
  ledger.a.allyPayment = 500;
  assert.equal(richeseAllyCommitment(state, ledger, 'unrelated'), 0);
  assert.equal(richeseAllyCommitment(state, ledger, 'donor-b'), 0);
});

void test('JSON restoration preserves reservations and queries do not mutate either ledger', () => {
  const state = bid(bid(create(), 'a', 8), 'b', 10);
  const original = JSON.stringify({ state, funding });
  const restored = JSON.parse(original) as {
    state: RicheseAuction;
    funding: RicheseFunding;
  };
  for (const player of ['a', 'b', 'r', 'outsider'])
    assert.equal(
      richeseOwnCommitment(restored.state, restored.funding, player),
      richeseOwnCommitment(state, funding, player),
    );
  for (const donor of ['donor-a', 'donor-b', 'other'])
    assert.equal(
      richeseAllyCommitment(restored.state, restored.funding, donor),
      richeseAllyCommitment(state, funding, donor),
    );
  assert.equal(JSON.stringify(restored), original);
  assert.equal(JSON.stringify({ state, funding }), original);
});

void test('malformed active reservations cannot become negative or unsafe commitments', () => {
  const state = bid(create(), 'a', 8);
  for (const record of [
    { amount: NaN, allyPayment: 0, donor: 'd' },
    { amount: 3, allyPayment: 4, donor: 'd' },
    { amount: 3, allyPayment: -1, donor: 'd' },
  ]) {
    assert.throws(() => richeseOwnCommitment(state, { a: record }, 'a'));
    assert.throws(() => richeseAllyCommitment(state, { a: record }, 'd'));
  }
  const two = bid(state, 'b', 10);
  const huge = {
    amount: Number.MAX_SAFE_INTEGER,
    allyPayment: Number.MAX_SAFE_INTEGER,
    donor: 'd',
  };
  assert.throws(
    () => richeseAllyCommitment(two, { a: huge, b: huge }, 'd'),
    /safe integer/,
  );
});
