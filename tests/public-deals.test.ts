import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PublicDealError, createPublicDeal, releasePublicDeal, respondPublicDeal,
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
