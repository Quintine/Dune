import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PublicDealError, createPublicDeal, createMultipartyPublicDeal, publicDealAcceptVotes,
  publicDealParticipants, parsePublicDealPayment, releasePublicDeal, respondPublicDeal,
  validatePublicDeals, withdrawPublicDeal,
} from '../game/public-deals';

const players = [
  { id: 'a', ally: null }, { id: 'b', ally: null }, { id: 'c', ally: null },
  { id: 'bot', bot: 'Medium', ally: null },
];
const offer = () => createPublicDeal(players, 'a', 'b', '  Trade two spice later.  ', 2, 'event-1');

void test('an explicit offer and recipient response preserve input and do not form an alliance', () => {
  const before = structuredClone(players);
  const pending = offer();
  assert.deepEqual(pending, { id: 'event-1', from: 'a', to: 'b', terms: 'Trade two spice later.', turn: 2, status: 'offered', releaseVotes: [] });
  const original = structuredClone(pending);
  assert.throws(() => respondPublicDeal(pending, players, 'a', true), PublicDealError);
  assert.throws(() => respondPublicDeal(pending, players, 'c', false), PublicDealError);
  const active = respondPublicDeal(pending, players, 'b', true);
  assert.equal(active.status, 'active');
  assert.deepEqual(pending, original);
  assert.deepEqual(players, before);
  validatePublicDeals([pending, { ...active, id: 'event-2' }], players);
  assert.throws(() => respondPublicDeal(active, players, 'b', true), PublicDealError);
});

void test('legacy two-party JSON keeps its exact representation and implicit votes', () => {
  const pending = JSON.parse(JSON.stringify(offer()));
  const before = JSON.stringify(pending);
  validatePublicDeals([pending], players);
  assert.deepEqual(publicDealParticipants(pending), ['a', 'b']);
  assert.deepEqual(publicDealAcceptVotes(pending), ['a']);
  assert.equal(JSON.stringify(pending), before);
  const active = respondPublicDeal(pending, players, 'b', true);
  assert.deepEqual(publicDealAcceptVotes(active), ['a', 'b']);
  assert.equal('participants' in active, false);
  assert.equal('acceptVotes' in active, false);
  const released = releasePublicDeal(releasePublicDeal(active, players, 'b', true), players, 'a', true);
  assert.deepEqual(released.releaseVotes, ['b', 'a']);
  assert.equal('participants' in released, false);
  validatePublicDeals(JSON.parse(JSON.stringify([pending, { ...active, id: 'legacy-active' },
    { ...released, id: 'legacy-released' }])), players);
});

void test('an immediate gross bribe is an explicit, immutable term between signatories', () => {
  const payment = { kind: 'immediateBribe' as const, payer: 'b', recipient: 'a', amount: 5 };
  const pending = createPublicDeal(players, 'a', 'b', 'Terms', 2, 'payment', payment);
  const before = structuredClone(pending);
  assert.deepEqual(pending.payment, payment);
  payment.amount = 9;
  assert.deepEqual(pending, before, 'the signed record does not alias the caller’s term');
  const active = respondPublicDeal(pending, players, 'b', true);
  assert.deepEqual(active.payment, before.payment);
  const firstRelease = releasePublicDeal(active, players, 'a', true);
  const released = releasePublicDeal(firstRelease, players, 'b', true);
  assert.deepEqual(released.payment, before.payment);
  validatePublicDeals(JSON.parse(JSON.stringify([pending, { ...active, id: 'active-payment' },
    { ...released, id: 'released-payment' }])), players);
  assert.equal('payment' in offer(), false, 'legacy records keep their exact shape');
});

void test('multiparty payment terms remain bound through partial consent, decline and release', () => {
  const payment = { kind: 'immediateBribe' as const, payer: 'c', recipient: 'b', amount: 3 };
  const pending = createMultipartyPublicDeal(players, 'a', ['b', 'c'], 'Terms', 3, 'multi-payment', payment);
  const partial = respondPublicDeal(pending, players, 'b', true);
  assert.deepEqual(partial.payment, payment);
  const declined = respondPublicDeal(partial, players, 'c', false);
  assert.deepEqual(declined.payment, payment);
  const withdrawn = withdrawPublicDeal(partial, players, 'a');
  assert.deepEqual(withdrawn.payment, payment);
  let active = respondPublicDeal(partial, players, 'c', true);
  for (const actor of ['a', 'b', 'c']) active = releasePublicDeal(active, players, actor, true);
  assert.equal(active.status, 'released');
  assert.deepEqual(active.payment, payment);
  validatePublicDeals([pending, { ...declined, id: 'declined-payment' },
    { ...withdrawn, id: 'withdrawn-payment' }, { ...active, id: 'active-payment' }], players);
});

void test('payment terms reject malformed amounts, fields and nonsignatory parties', () => {
  const valid = { kind: 'immediateBribe', payer: 'a', recipient: 'b', amount: 5 };
  for (const term of [
    null, undefined, {}, [], { ...valid, kind: 'later' }, { ...valid, amount: 0 },
    { ...valid, amount: -1 }, { ...valid, amount: 1.5 }, { ...valid, amount: Number.MAX_SAFE_INTEGER + 1 },
    { ...valid, amount: '5' }, { ...valid, payer: 'b' }, { ...valid, payer: 'c' },
    { ...valid, recipient: 'bot' }, { ...valid, payer: ' a' }, { ...valid, extra: true },
  ]) {
    assert.throws(() => parsePublicDealPayment(term, ['a', 'b']), PublicDealError);
    assert.throws(() => validatePublicDeals([{ ...offer(), payment: term }], players), PublicDealError);
  }
  assert.deepEqual(parsePublicDealPayment(valid, ['a', 'b']), valid);
  assert.throws(() => createPublicDeal(players, 'a', 'b', 'Terms', 1, 'bad', undefined), PublicDealError);
  assert.throws(() => createMultipartyPublicDeal(players, 'a', ['b', 'c'], 'Terms', 1, 'bad', undefined), PublicDealError);
  assert.throws(() => createPublicDeal(players, 'a', 'b', 'Terms', 1, 'bad',
    { kind: 'immediateBribe', payer: 'a', recipient: 'c', amount: 2 }), PublicDealError);
  assert.throws(() => createMultipartyPublicDeal(players, 'a', ['b', 'c'], 'Terms', 1, 'bad',
    { kind: 'immediateBribe', payer: 'a', recipient: 'bot', amount: 2 }), PublicDealError);
});

void test('multiparty deals activate only after every invited human accepts and release unanimously', () => {
  const seats = [...players, { id: 'd', ally: null }, { id: 'e', ally: null }];
  const initial = createMultipartyPublicDeal(seats, 'a', ['b', 'c', 'd'], '  No raids this turn. ', 3, 'multi-1');
  assert.deepEqual(initial, { id: 'multi-1', from: 'a', to: 'b', terms: 'No raids this turn.', turn: 3,
    status: 'offered', releaseVotes: [], participants: ['a', 'b', 'c', 'd'], acceptVotes: ['a'] });
  const first = respondPublicDeal(initial, seats, 'd', true);
  assert.equal(first.status, 'offered');
  assert.deepEqual(first.acceptVotes, ['a', 'd']);
  assert.deepEqual(initial.acceptVotes, ['a']);
  assert.throws(() => respondPublicDeal(first, seats, 'd', true), PublicDealError);
  assert.throws(() => respondPublicDeal(first, seats, 'a', true), PublicDealError);
  assert.throws(() => respondPublicDeal(first, seats, 'e', true), PublicDealError);
  const next = respondPublicDeal(first, seats, 'b', true);
  assert.deepEqual(next.acceptVotes, ['a', 'b', 'd']);
  const active = respondPublicDeal(next, seats, 'c', true);
  assert.equal(active.status, 'active');
  assert.deepEqual(publicDealAcceptVotes(active), ['a', 'b', 'c', 'd']);
  let current = releasePublicDeal(active, seats, 'd', true);
  current = releasePublicDeal(current, seats, 'a', true);
  assert.deepEqual(current.releaseVotes, ['a', 'd']);
  current = releasePublicDeal(current, seats, 'd', false);
  assert.deepEqual(current.releaseVotes, ['a']);
  for (const actor of ['c', 'b']) current = releasePublicDeal(current, seats, actor, true);
  assert.equal(current.status, 'active');
  current = releasePublicDeal(current, seats, 'd', true);
  assert.equal(current.status, 'released');
  assert.deepEqual(current.releaseVotes, ['a', 'b', 'c', 'd']);
  validatePublicDeals([initial, { ...active, id: 'multi-active' }, { ...current, id: 'multi-released' }], seats);
});

void test('a recipient can decline after accepting and a proposer can withdraw a partial offer', () => {
  const initial = createMultipartyPublicDeal(players, 'a', ['b', 'c'], 'terms', 2, 'decline');
  const accepted = respondPublicDeal(initial, players, 'b', true);
  const declined = respondPublicDeal(accepted, players, 'b', false);
  const withdrawn = withdrawPublicDeal(accepted, players, 'a');
  assert.equal(declined.status, 'declined');
  assert.equal(withdrawn.status, 'withdrawn');
  assert.deepEqual(declined.acceptVotes, ['a', 'b']);
  assert.deepEqual(withdrawn.acceptVotes, ['a', 'b']);
  assert.throws(() => respondPublicDeal(declined, players, 'c', true), PublicDealError);
  validatePublicDeals([{ ...declined, id: 'declined' }, withdrawn], players);
});

void test('a six-seat deal requires all five responses and all six release votes', () => {
  const seats = ['a', 'b', 'c', 'd', 'e', 'f'].map(id => ({ id, ally: null }));
  let deal = createMultipartyPublicDeal(seats, 'a', ['b', 'c', 'd', 'e', 'f'], 'Terms', 1, 'six');
  for (const actor of ['b', 'c', 'd', 'e']) deal = respondPublicDeal(deal, seats, actor, true);
  assert.equal(deal.status, 'offered');
  deal = respondPublicDeal(deal, seats, 'f', true);
  assert.equal(deal.status, 'active');
  for (const actor of ['a', 'b', 'c', 'd', 'e']) deal = releasePublicDeal(deal, seats, actor, true);
  assert.equal(deal.status, 'active');
  deal = releasePublicDeal(deal, seats, 'f', true);
  assert.equal(deal.status, 'released');
  validatePublicDeals([deal], seats);
});

void test('a new alliance between any invitees blocks acceptance but not decline or mutual release', () => {
  const initial = createMultipartyPublicDeal(players, 'a', ['b', 'c'], 'terms', 2, 'alliance');
  const allied = players.map(player => player.id === 'b' ? { ...player, ally: 'c' } : player);
  assert.throws(() => createMultipartyPublicDeal(allied, 'a', ['b', 'c'], 'terms', 2, 'bad'), PublicDealError);
  assert.throws(() => respondPublicDeal(initial, allied, 'b', true), PublicDealError);
  assert.equal(respondPublicDeal(initial, allied, 'b', false).status, 'declined');
  let active = respondPublicDeal(respondPublicDeal(initial, players, 'b', true), players, 'c', true);
  for (const actor of ['b', 'a', 'c']) active = releasePublicDeal(active, allied, actor, true);
  assert.equal(active.status, 'released');
});

void test('multiparty shape rejects duplicate, noncanonical and impossible lifecycle votes', () => {
  const initial = createMultipartyPublicDeal(players, 'a', ['b', 'c'], 'terms', 2, 'shape');
  for (const targets of [['b'], ['b', 'b'], ['a', 'b'], ['b', 'bot'], ['b', 'missing'],
    ['a', 'b', 'c', 'bot', 'missing', 'extra']])
    assert.throws(() => createMultipartyPublicDeal(players, 'a', targets, 'terms', 2, 'invalid'), PublicDealError);
  for (const invalid of [
    { ...initial, participants: ['a', 'c', 'b'] },
    { ...initial, participants: ['a', 'b', 'b'] },
    { ...initial, acceptVotes: ['b'] },
    { ...initial, acceptVotes: ['a', 'c', 'b'] },
    { ...initial, acceptVotes: ['a', 'b', 'b'] },
    { ...initial, acceptVotes: ['a', 'b', 'c'] },
    { ...initial, status: 'active', acceptVotes: ['a', 'b'] },
    { ...initial, status: 'active', acceptVotes: ['a', 'b', 'c'], releaseVotes: ['c', 'b'] },
    { ...initial, status: 'released', acceptVotes: ['a', 'b', 'c'], releaseVotes: ['a', 'b'] },
    { ...initial, releaseVotes: ['a'] },
    { ...initial, acceptVotes: undefined },
    { ...initial, extra: true },
  ]) assert.throws(() => validatePublicDeals([invalid], players), PublicDealError);
});

void test('decline and withdrawal require their respective participant and are terminal', () => {
  const pending = offer();
  assert.throws(() => withdrawPublicDeal(pending, players, 'b'), PublicDealError);
  const declined = respondPublicDeal(pending, players, 'b', false);
  const withdrawn = withdrawPublicDeal(pending, players, 'a');
  assert.equal(declined.status, 'declined');
  assert.equal(withdrawn.status, 'withdrawn');
  for (const deal of [declined, withdrawn]) {
    validatePublicDeals([deal], players);
    assert.throws(() => releasePublicDeal(deal, players, 'a', true), PublicDealError);
  }
});

void test('only both participants can release an accepted deal and a prior vote may be withdrawn', () => {
  const initial = respondPublicDeal(offer(), players, 'b', true);
  const aVotes = releasePublicDeal(initial, players, 'a', true);
  assert.deepEqual(aVotes.releaseVotes, ['a']);
  assert.deepEqual(initial.releaseVotes, []);
  assert.throws(() => releasePublicDeal(aVotes, players, 'c', true), PublicDealError);
  const aWithdraws = releasePublicDeal(aVotes, players, 'a', false);
  assert.deepEqual(aWithdraws.releaseVotes, []);
  const bVotes = releasePublicDeal(aWithdraws, players, 'b', true);
  assert.deepEqual(bVotes.releaseVotes, ['b']);
  const released = releasePublicDeal(bVotes, players, 'a', true);
  assert.equal(released.status, 'released');
  assert.deepEqual(new Set(released.releaseVotes), new Set(['a', 'b']));
  validatePublicDeals([released], players);
  assert.throws(() => releasePublicDeal(released, players, 'a', false), PublicDealError);
});

void test('alliance of the two parties prevents new and accepted deals, but not decline or release', () => {
  const pending = offer();
  const between = players.map(player => player.id === 'a' ? { ...player, ally: 'b' } : player);
  assert.throws(() => createPublicDeal(between, 'a', 'b', 'terms', 2, 'x'), PublicDealError);
  assert.throws(() => respondPublicDeal(pending, between, 'b', true), PublicDealError);
  assert.equal(respondPublicDeal(pending, between, 'b', false).status, 'declined');
  const active = respondPublicDeal(pending, players, 'b', true);
  const first = releasePublicDeal(active, between, 'a', true);
  assert.equal(releasePublicDeal(first, between, 'b', true).status, 'released');
  const otherAlliance = players.map(player => player.id === 'a' ? { ...player, ally: 'c' } : player);
  assert.equal(createPublicDeal(otherAlliance, 'a', 'b', 'terms', 2, 'y').status, 'offered');
});

void test('strict ledger and creation validation reject malformed or forged records', () => {
  validatePublicDeals([], [players[0]]);
  for (const [actor, target, terms, turn, event] of [
    ['a', 'a', 'x', 1, 'e'], ['a', 'bot', 'x', 1, 'e'], ['bot', 'a', 'x', 1, 'e'],
    ['a', 'missing', 'x', 1, 'e'], ['a', 'b', ' ', 1, 'e'], ['a', 'b', 'x'.repeat(501), 1, 'e'],
    ['a', 'b', 'x', 0, 'e'], ['a', 'b', 'x', 1, ' e '],
  ] as Array<[string, string, string, number, string]>)
    assert.throws(() => createPublicDeal(players, actor, target, terms, turn, event), PublicDealError);
  const pending = offer();
  for (const ledger of [
    [pending, pending], [{ ...pending, unexpected: true }], [{ ...pending, releaseVotes: ['c'] }],
    [{ ...pending, status: 'active', releaseVotes: ['a', 'a'] }],
    [{ ...pending, status: 'released', releaseVotes: ['a'] }],
    [{ ...pending, status: 'offered', releaseVotes: ['a'] }],
  ]) assert.throws(() => validatePublicDeals(ledger, players), PublicDealError);
});
