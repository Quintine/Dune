import assert from 'node:assert/strict';
import test from 'node:test';
import {
  LeaderRevivalPromiseError,
  leaderRevivalClaimText,
  leaderRevivalPromiseModeSupported,
  leaderRevivalPromisesSatisfied,
  leaderRevivalRequirements,
  liveLeaderRevivalPromises,
  parseLeaderRevivalClaim,
  recordPromisedLeaderRevival,
  validateLeaderRevivalPromises,
  type LeaderRevivalPromise,
} from '../game/leader-revival-promises';
import { revivalPromiseModeSupported } from '../game/revival-promises';

const seats = ['respondent', 'asker', 'other-player'] as const;
function promise(event: string, leader = 'leader-a', extra: Partial<LeaderRevivalPromise> = {}): LeaderRevivalPromise {
  return { event, turn: 2, leader, player: 'respondent', asker: 'asker', answer: true, ...extra };
}

void test('named leader claims canonicalize current turn and exact identity including the reserved native KH token', () => {
  const input = { turn: 2, leader: 'leader-a', currentDeath: 1, privateCost: 3 };
  assert.deepEqual(parseLeaderRevivalClaim(input), { turn: 2, leader: 'leader-a' });
  assert.deepEqual(parseLeaderRevivalClaim({ turn: Number.MAX_SAFE_INTEGER, leader: 'kwisatz' }),
    { turn: Number.MAX_SAFE_INTEGER, leader: 'kwisatz' });
  for (const turn of [0, -1, 1.5, Number.NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '2', null, undefined])
    assert.throws(() => parseLeaderRevivalClaim({ ...input, turn }), LeaderRevivalPromiseError);
  for (const leader of ['', ' ', ' leader-a', 'leader-a ', 1, null, undefined])
    assert.throws(() => parseLeaderRevivalClaim({ ...input, leader }), LeaderRevivalPromiseError);
  for (const value of [null, undefined, [], 'leader-a', 2])
    assert.throws(() => parseLeaderRevivalClaim(value), LeaderRevivalPromiseError);
  assert.match(leaderRevivalClaimText(parseLeaderRevivalClaim(input), () => 'Named Leader'), /revive Named Leader through ordinary leader revival/);
  assert.match(leaderRevivalClaimText({ turn: 2, leader: 'kwisatz' }), /revive Kwisatz Haderach/);
  assert.match(leaderRevivalClaimText(parseLeaderRevivalClaim(input)), /from now until your Revival opportunity ends this turn/);
});

void test('named leader scope is the existing force-revival mode alias and introduces no optional-module permission', () => {
  assert.equal(leaderRevivalPromiseModeSupported, revivalPromiseModeSupported);
  const classic = { advanced: false, expansions: [], players: [{ faction: 'atreides' }, { faction: 'emperor' }] };
  const native = { advanced: true, expansions: ['ix', 'choam', 'ecaz'],
    players: ['ixians', 'tleilaxu', 'choam', 'richese', 'ecaz', 'moritani'].map(faction => ({ faction })) };
  assert.equal(leaderRevivalPromiseModeSupported(classic), true);
  assert.equal(leaderRevivalPromiseModeSupported({ ...classic, advanced: true }), true);
  assert.equal(leaderRevivalPromiseModeSupported(native), true);
  for (const option of ['homeworlds', 'nexusCards', 'leaderSkills', 'techTokens', 'strongholdCards',
    'discoveryEnabled', 'discoveries', 'discoveryStash', 'greatMaker', 'ecazTreachery',
    'semutaPreview', 'kullPreview', 'nexusKullPreview', 'richeseBetrayalPreview'] as const)
    assert.equal(leaderRevivalPromiseModeSupported({ ...native, [option]: true }), false, option);
  assert.equal(leaderRevivalPromiseModeSupported({ ...native, expansions: ['ix', 'choam'] }), false);
});

void test('joint requirements deduplicate the same disc and retain distinct leaders for native allowance quotation', () => {
  const records = [promise('yes-a'), promise('yes-a-again', 'leader-a', { asker: 'other-player' }),
    promise('yes-b', 'leader-b'), promise('no-c', 'leader-c', { answer: false }),
    promise('no-c-again', 'leader-c', { answer: false })];
  assert.deepEqual(leaderRevivalRequirements(records, 'respondent', 2),
    { required: ['leader-a', 'leader-b'], forbidden: ['leader-c'] });
  assert.equal(leaderRevivalPromisesSatisfied(records, 'respondent', 2, ['leader-a', 'leader-b']), true);
  assert.equal(leaderRevivalPromisesSatisfied(records, 'respondent', 2, ['leader-a']), false);
  assert.equal(leaderRevivalPromisesSatisfied(records, 'respondent', 2, ['leader-a', 'leader-b', 'leader-c']), false);
  assert.equal(leaderRevivalRequirements([...records, promise('no-a', 'leader-a', { answer: false })], 'respondent', 2), null);
  assert.equal(leaderRevivalPromisesSatisfied([promise('yes-a'), promise('no-a', 'leader-a', { answer: false })],
    'respondent', 2, ['leader-a']), false);
});

void test('hypothetical completion matches exact future return identities and No allows other leaders or no return', () => {
  const yes = [promise('yes-a')], no = [promise('no-a', 'leader-a', { answer: false })];
  assert.equal(leaderRevivalPromisesSatisfied(yes, 'respondent', 2, []), false);
  assert.equal(leaderRevivalPromisesSatisfied(yes, 'respondent', 2, ['leader-b']), false);
  assert.equal(leaderRevivalPromisesSatisfied(yes, 'respondent', 2, ['leader-a']), true);
  assert.equal(leaderRevivalPromisesSatisfied(yes, 'respondent', 2, ['leader-a', 'leader-a']), true);
  assert.equal(leaderRevivalPromisesSatisfied(no, 'respondent', 2, []), true);
  assert.equal(leaderRevivalPromisesSatisfied(no, 'respondent', 2, ['leader-b']), true);
  assert.equal(leaderRevivalPromisesSatisfied(no, 'respondent', 2, ['leader-a']), false);
  assert.deepEqual(leaderRevivalRequirements(no, 'respondent', 2), { required: [], forbidden: ['leader-a'] });
  assert.equal(leaderRevivalPromisesSatisfied([], 'respondent', 2, []), true);
});

void test('one actual ordinary return fulfills every matching Yes while retaining other live clauses', () => {
  const records = [promise('yes-a'), promise('yes-a-again'), promise('yes-b', 'leader-b'),
    promise('no-c', 'leader-c', { answer: false })];
  const before = structuredClone(records); records.forEach(Object.freeze); Object.freeze(records);
  const returned = recordPromisedLeaderRevival(records, 'respondent', 2, 'leader-a');
  assert.notEqual(returned, records); assert.notEqual(returned[0], records[0]); assert.notEqual(returned[1], records[1]);
  assert.equal(returned[0].fulfilled, true); assert.equal(returned[1].fulfilled, true);
  assert.equal(returned[2], records[2]); assert.equal(returned[3], records[3]);
  assert.deepEqual(leaderRevivalRequirements(returned, 'respondent', 2), { required: ['leader-b'], forbidden: ['leader-c'] });
  assert.deepEqual(records, before);
});

void test('a conflicting No rejects before any matching Yes can change and remains binding after unrelated returns', () => {
  const records = [promise('yes-a'), promise('no-a', 'leader-a', { answer: false })];
  const before = structuredClone(records); records.forEach(Object.freeze); Object.freeze(records);
  assert.throws(() => recordPromisedLeaderRevival(records, 'respondent', 2, 'leader-a'), LeaderRevivalPromiseError);
  assert.deepEqual(records, before);
  const unrelated = recordPromisedLeaderRevival(records, 'respondent', 2, 'leader-b');
  assert.equal(unrelated[0], records[0]); assert.equal(unrelated[1], records[1]);
  assert.equal(unrelated[1].fulfilled, undefined, 'An unrelated return does not close a No answer');
  for (const leader of ['', ' ', ' leader-a', 'leader-a '])
    assert.throws(() => recordPromisedLeaderRevival(records, 'respondent', 2, leader), LeaderRevivalPromiseError);
});

void test('earlier completed returns never satisfy a newly answered named-leader commitment', () => {
  const first = recordPromisedLeaderRevival([promise('earlier-answer')], 'respondent', 2, 'leader-a');
  const later = [...first, promise('new-answer')];
  assert.equal(first[0].fulfilled, true); assert.equal(later[1].fulfilled, undefined);
  assert.deepEqual(leaderRevivalRequirements(later, 'respondent', 2), { required: ['leader-a'], forbidden: [] });
  assert.equal(leaderRevivalPromisesSatisfied(later, 'respondent', 2, []), false);
  const completed = recordPromisedLeaderRevival(later, 'respondent', 2, 'leader-a');
  assert.equal(completed[0], first[0]); assert.equal(completed[1].fulfilled, true);
  assert.equal(later[1].fulfilled, undefined, 'Only a new actual return event changes the later ledger entry');
});

void test('native KH is a distinct named identity and the ledger does not turn a physical leader return into a KH return', () => {
  const records = [promise('yes-kh', 'kwisatz'), promise('no-leader-a', 'leader-a', { answer: false })];
  assert.deepEqual(leaderRevivalRequirements(records, 'respondent', 2), { required: ['kwisatz'], forbidden: ['leader-a'] });
  assert.equal(leaderRevivalPromisesSatisfied(records, 'respondent', 2, ['leader-b']), false);
  const other = recordPromisedLeaderRevival(records, 'respondent', 2, 'leader-b');
  assert.equal(other[0], records[0]);
  const returned = recordPromisedLeaderRevival(records, 'respondent', 2, 'kwisatz');
  assert.equal(returned[0].fulfilled, true); assert.equal(returned[1], records[1]);
  assert.equal(leaderRevivalPromisesSatisfied(returned, 'respondent', 2, []), true);
});

void test('other actors, old turns and terminal records preserve their exact identities and do not constrain the current return', () => {
  const live = promise('live');
  const records = [live, promise('other-player', 'leader-a', { player: 'other-player', answer: false }),
    promise('old-turn', 'leader-a', { turn: 1, answer: false }),
    promise('fulfilled', 'leader-a', { fulfilled: true }), promise('released', 'leader-a', { answer: false, released: true }),
    promise('other-disc', 'leader-b')];
  assert.deepEqual(liveLeaderRevivalPromises(records, 'respondent', 2), [live, records[5]]);
  const returned = recordPromisedLeaderRevival(records, 'respondent', 2, 'leader-a');
  assert.equal(returned[0].fulfilled, true);
  for (let index = 1; index < records.length; index++) assert.equal(returned[index], records[index]);
  assert.deepEqual(leaderRevivalRequirements(records, 'absent', 2), { required: [], forbidden: [] });
  const absent = recordPromisedLeaderRevival(records, 'absent', 2, 'leader-a');
  records.forEach((record, index) => assert.equal(absent[index], record));
});

void test('record validation binds unique events, actual participants, exact named identity and compatible terminal flags', () => {
  const valid = [promise('live'), promise('kh', 'kwisatz'), promise('fulfilled-yes', 'leader-b', { fulfilled: true }),
    promise('released-yes', 'leader-a', { released: true }),
    promise('fulfilled-no', 'leader-b', { answer: false, fulfilled: true }),
    promise('released-no', 'leader-a', { answer: false, released: true })];
  const before = structuredClone(valid);
  assert.doesNotThrow(() => validateLeaderRevivalPromises(valid, seats)); assert.deepEqual(valid, before);
  assert.doesNotThrow(() => validateLeaderRevivalPromises(JSON.parse(JSON.stringify(valid)) as LeaderRevivalPromise[], seats));
  assert.doesNotThrow(() => validateLeaderRevivalPromises([], seats));
  const base = promise('event');
  const invalid: unknown[] = [null, {}, [null], [base, { ...base }],
    ...[{ event: '' }, { event: ' ' }, { player: 'outsider' }, { asker: 'outsider' }, { asker: 'respondent' },
      { leader: '' }, { leader: ' leader-a' }, { leader: null }, { answer: 'yes' },
      { fulfilled: 1 }, { released: 'true' }, { fulfilled: true, released: true }, { turn: 0 }]
      .map(extra => [{ ...base, ...extra }])];
  for (const records of invalid)
    assert.throws(() => validateLeaderRevivalPromises(records as LeaderRevivalPromise[], seats), LeaderRevivalPromiseError);
  assert.deepEqual(valid, before);
});
