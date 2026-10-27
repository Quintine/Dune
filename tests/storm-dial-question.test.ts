import test from 'node:test';
import assert from 'node:assert/strict';
import {
  nativeStormDialOpportunity, parseStormDialClaim, parseStormDialSource,
  stormDialMatches, type StormDialGame,
} from '../game/storm-dial-question';

const first: StormDialGame = {
  status: 'playing', advanced: false, phase: 0, turn: 1,
  players: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
  stormDialers: ['a', 'b'], stormPending: null, stormDials: {},
};
const source = (turn: number, player: string) => JSON.stringify(['stormDial', turn, player]);
const claim = (turn: number, player: string, value: number) =>
  ({ kind: 'stormDial' as const, source: source(turn, player), value });

void test('public opportunity selects the real Basic unsubmitted dialer and exact turn', () => {
  assert.deepEqual(nativeStormDialOpportunity(first, 'a'), {
    turn: 1, player: 'a', source: source(1, 'a'), min: 0, max: 20,
  });
  assert.equal(nativeStormDialOpportunity(first, 'c'), null);
  assert.equal(nativeStormDialOpportunity(first, 'a', source(2, 'a')), null);
  assert.equal(nativeStormDialOpportunity({ ...first, phase: 1 }, 'a'), null);
  assert.equal(nativeStormDialOpportunity({ ...first, status: 'finished' }, 'a'), null);
  assert.equal(nativeStormDialOpportunity({ ...first, advanced: true }, 'a'), null);
  assert.equal(nativeStormDialOpportunity({ ...first, stormPending: 0 }, 'a'), null);
  assert.deepEqual(nativeStormDialOpportunity({ ...first, turn: 2 }, 'a'), {
    turn: 2, player: 'a', source: source(2, 'a'), min: 1, max: 3,
  });
});

void test('server and public view eligibility test submission without reading sealed values', () => {
  const hidden = Object.defineProperty({}, 'a', { enumerable: true, get() { throw Error('read sealed value'); } });
  const state = { ...first, stormDials: hidden };
  assert.equal(nativeStormDialOpportunity(state, 'a'), null);
  assert.ok(nativeStormDialOpportunity(state, 'b'));
  const { stormDials: _hidden, ...publicView } = state;
  assert.equal(nativeStormDialOpportunity({ ...publicView, stormSubmitted: ['a'] }, 'a'), null);
  assert.ok(nativeStormDialOpportunity({ ...publicView, stormSubmitted: ['a'] }, 'b'));
  assert.equal(nativeStormDialOpportunity({ ...publicView, stormSubmitted: ['c'] }, 'b'), null);
});

void test('canonical source and claim enforce actual turn-specific ranges and no extra keys', () => {
  assert.deepEqual(parseStormDialSource(source(1, 'a')), { turn: 1, player: 'a' });
  for (const invalid of [' ["stormDial",1,"a"]', source(0, 'a'), source(1, ''), '["stormDial",1,"a",0]', 'not-json'])
    assert.equal(parseStormDialSource(invalid), null);
  assert.deepEqual(parseStormDialClaim(claim(1, 'a', 0)), claim(1, 'a', 0));
  assert.deepEqual(parseStormDialClaim(claim(1, 'a', 20)), claim(1, 'a', 20));
  assert.deepEqual(parseStormDialClaim(claim(2, 'a', 3)), claim(2, 'a', 3));
  for (const invalid of [claim(1, 'a', -1), claim(1, 'a', 21), claim(2, 'a', 0),
    claim(2, 'a', 4), claim(2, 'a', 2.5), { ...claim(1, 'a', 4), reveal: true }])
    assert.throws(() => parseStormDialClaim(invalid));
});

void test('match evaluates only an actual legal submission in the named native range', () => {
  assert.equal(stormDialMatches(claim(1, 'a', 0), 0), true);
  assert.equal(stormDialMatches(claim(1, 'a', 0), 1), false);
  assert.equal(stormDialMatches(claim(2, 'a', 3), 3), true);
  for (const invalid of [undefined, null, -1, 0, 4, 1.5, '3'])
    assert.throws(() => stormDialMatches(claim(2, 'a', 2), invalid));
});

void test('malformed or inconsistent public seat and dialer sets have no opportunity', () => {
  for (const game of [
    { ...first, stormDialers: ['a', 'a'] },
    { ...first, stormDialers: ['a', 'unknown'] },
    { ...first, players: [{ id: 'a' }, { id: 'a' }] },
    { ...first, stormDialers: [] },
    { ...first, stormDials: undefined },
    { ...first, stormSubmitted: ['a', 'a'] },
  ]) assert.equal(nativeStormDialOpportunity(game, 'a'), null);
});
