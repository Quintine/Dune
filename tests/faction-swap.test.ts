import assert from 'node:assert/strict';
import test from 'node:test';
import {
  answerFactionSwap, cancelFactionSwap, createFactionSwap, FactionSwapError,
  validateFactionSwap, type FactionSwapSeat,
} from '../game/faction-swap';

const roster: FactionSwapSeat[] = [
  { id: 'one', faction: 'atreides' },
  { id: 'two', faction: 'harkonnen' },
  { id: 'three', faction: 'guild' },
];

void test('an offer snapshots the public identities and current faction assignments', () => {
  const players = structuredClone(roster);
  const offer = createFactionSwap(players, 'one', 'two', 'swap:1');
  assert.deepEqual(offer, {
    event: 'swap:1', from: 'one', to: 'two', fromFaction: 'atreides', toFaction: 'harkonnen',
  });
  assert.deepEqual(players, roster);
  validateFactionSwap(JSON.parse(JSON.stringify(offer)), players);
});

void test('only the recipient may accept or reject and acceptance swaps precisely two factions', () => {
  const players = structuredClone(roster);
  const offer = createFactionSwap(players, 'one', 'two', 'swap:1');
  const original = structuredClone(offer);
  assert.deepEqual(answerFactionSwap(players, offer, 'two', true), {
    accepted: true, assignments: [
      { player: 'one', faction: 'harkonnen' },
      { player: 'two', faction: 'atreides' },
    ],
  });
  assert.deepEqual(answerFactionSwap(players, offer, 'two', false), { accepted: false, assignments: [] });
  assert.throws(() => answerFactionSwap(players, offer, 'one', true), FactionSwapError);
  assert.throws(() => answerFactionSwap(players, offer, 'three', false), FactionSwapError);
  assert.throws(() => answerFactionSwap(players, offer, 'two', 'yes' as unknown as boolean), FactionSwapError);
  assert.deepEqual(players, roster);
  assert.deepEqual(offer, original);
});

void test('only the proposer can cancel an offer', () => {
  const offer = createFactionSwap(roster, 'one', 'two', 'swap:1');
  assert.doesNotThrow(() => cancelFactionSwap(roster, offer, 'one'));
  assert.throws(() => cancelFactionSwap(roster, offer, 'two'), FactionSwapError);
  assert.throws(() => cancelFactionSwap(roster, offer, 'three'), FactionSwapError);
});

void test('invalid rosters and participants cannot create an offer', () => {
  assert.throws(() => createFactionSwap(roster, 'one', 'one', 'swap:1'), FactionSwapError);
  assert.throws(() => createFactionSwap(roster, 'one', 'missing', 'swap:1'), FactionSwapError);
  assert.throws(() => createFactionSwap(roster, 'one', 'two', ' '), FactionSwapError);
  assert.throws(() => createFactionSwap([roster[0], roster[0]], 'one', 'two', 'swap:1'), FactionSwapError);
  assert.throws(() => createFactionSwap([roster[0], { ...roster[1], faction: 'atreides' }], 'one', 'two', 'swap:1'), FactionSwapError);
  assert.throws(() => createFactionSwap([roster[0]], 'one', 'two', 'swap:1'), FactionSwapError);
});

void test('saved offers cannot authorize stale or malformed faction assignments', () => {
  const offer = createFactionSwap(roster, 'one', 'two', 'swap:1');
  const changed = [roster[0], { ...roster[1], faction: 'fremen' as const }, roster[2]];
  assert.throws(() => answerFactionSwap(changed, offer, 'two', true), FactionSwapError);
  assert.throws(() => validateFactionSwap(offer, [roster[0], roster[2]]), FactionSwapError);
  assert.throws(() => validateFactionSwap({ ...offer, event: '' }, roster), FactionSwapError);
  assert.throws(() => validateFactionSwap({ ...offer, to: 'one' }, roster), FactionSwapError);
  assert.throws(() => validateFactionSwap({ ...offer, toFaction: 'invalid' }, roster), FactionSwapError);
  assert.throws(() => validateFactionSwap({ ...offer, secret: 'extra' }, roster), FactionSwapError);
});
