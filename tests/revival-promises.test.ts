import assert from 'node:assert/strict';
import test from 'node:test';
import {
  RevivalPromiseError,
  liveRevivalPromises,
  parseRevivalClaim,
  recordPromisedRevival,
  revivalClaimText,
  revivalPromiseCount,
  revivalPromiseModeSupported,
  revivalPromisesSatisfied,
  validateRevivalPromises,
  type RevivalClaim,
  type RevivalPromise,
} from '../game/revival-promises';

const seats = ['respondent', 'asker', 'rival'] as const;
function promise(event: string, minimum: number, extra: Partial<RevivalPromise> = {}): RevivalPromise {
  return { event, turn: 2, counter: 'total', minimum, player: 'respondent', asker: 'asker',
    answer: true, progress: 0, ...extra };
}

void test('revival claims retain only the current-turn physical counter and positive bounded threshold', () => {
  const input = { turn: 2, counter: 'normal', minimum: 4, privateTanks: 12, priorReturns: 3 };
  assert.deepEqual(parseRevivalClaim(input), { turn: 2, counter: 'normal', minimum: 4 });
  for (const counter of ['total', 'normal', 'elite'] as const) {
    assert.deepEqual(parseRevivalClaim({ turn: 1, counter, minimum: 1 }), { turn: 1, counter, minimum: 1 });
    assert.deepEqual(parseRevivalClaim({ turn: Number.MAX_SAFE_INTEGER, counter, minimum: 20 }),
      { turn: Number.MAX_SAFE_INTEGER, counter, minimum: 20 });
  }
  const valid = { turn: 2, counter: 'total', minimum: 4 };
  for (const turn of [0, -1, 1.5, Number.NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '2', null, undefined])
    assert.throws(() => parseRevivalClaim({ ...valid, turn }), RevivalPromiseError);
  for (const minimum of [0, -1, 1.5, 21, Number.NaN, Infinity, Number.MAX_SAFE_INTEGER, '4', null, undefined])
    assert.throws(() => parseRevivalClaim({ ...valid, minimum }), RevivalPromiseError);
  for (const counter of ['forces', 'sardaukar', '', 1, null, undefined])
    assert.throws(() => parseRevivalClaim({ ...valid, counter }), RevivalPromiseError);
  for (const value of [null, undefined, [], 'four', 4]) assert.throws(() => parseRevivalClaim(value), RevivalPromiseError);
  assert.match(revivalClaimText(parseRevivalClaim(input)), /at least 4 normal forces/);
  assert.match(revivalClaimText(parseRevivalClaim(input)), /ordinary force revival from now/);
  assert.match(revivalClaimText(parseRevivalClaim(input)), /your Revival opportunity ends this turn/);
});

void test('revival promise scope preserves bare registered native Basic and Advanced selections and optional-module fences', () => {
  const classic = { advanced: false, expansions: [], players: [{ faction: 'atreides' }, { faction: 'emperor' }] };
  const native = { advanced: true, expansions: ['ix', 'choam', 'ecaz'],
    players: ['ixians', 'tleilaxu', 'choam', 'richese', 'ecaz', 'moritani'].map(faction => ({ faction })) };
  for (const game of [classic, { ...classic, advanced: true }, native, { ...native, advanced: false },
    { ...classic, expansions: ['ix', 'choam', 'ecaz'] },
    { ...classic, advanced: true, expansions: ['ecaz'], players: [{ faction: 'moritani' }, { faction: 'harkonnen' }] },
  ]) assert.equal(revivalPromiseModeSupported(game), true);
  for (const option of ['homeworlds', 'nexusCards', 'leaderSkills', 'techTokens', 'strongholdCards',
    'discoveryEnabled', 'discoveries', 'discoveryStash', 'greatMaker', 'ecazTreachery',
    'semutaPreview', 'kullPreview', 'nexusKullPreview', 'richeseBetrayalPreview'] as const)
    assert.equal(revivalPromiseModeSupported({ ...native, [option]: true }), false, option);
  for (const game of [
    { ...native, expansions: ['ix', 'choam'] }, { ...native, expansions: ['ix', 'ix', 'ecaz'] },
    { ...classic, expansions: ['unknown'] }, { ...classic, players: [{ faction: 'atreides' }, { faction: 'unknown' }] },
    { ...classic, players: [{ faction: 'atreides' }] }, { ...classic, players: [...native.players, { faction: 'atreides' }] },
    { ...classic, advanced: 'basic' as unknown as boolean },
  ]) assert.equal(revivalPromiseModeSupported(game), false);
});

void test('typed revival counts physical elites once and separates total, normal and elite quantities', () => {
  const group = { amount: 3, elite: 2 };
  const expected = { total: 3, normal: 1, elite: 2 };
  for (const counter of ['total', 'normal', 'elite'] as const) {
    const claim: RevivalClaim = { turn: 2, counter, minimum: 1 };
    assert.equal(revivalPromiseCount(claim, group), expected[counter]);
    assert.equal(revivalPromiseCount(claim, { amount: 0, elite: 0 }), 0);
  }
  assert.equal(revivalPromiseCount({ turn: 2, counter: 'normal', minimum: 20 }, { amount: 20, elite: 0 }), 20);
  assert.equal(revivalPromiseCount({ turn: 2, counter: 'total', minimum: 2 }, { amount: 2, elite: 2 }), 2);
  for (const group of [{ amount: -1, elite: 0 }, { amount: 21, elite: 0 }, { amount: 1.5, elite: 0 },
    { amount: Infinity, elite: 0 }, { amount: 2, elite: -1 }, { amount: 2, elite: 3 },
    { amount: 2, elite: 0.5 }, { amount: 2, elite: Number.NaN }]) {
    assert.throws(() => revivalPromiseCount({ turn: 2, counter: 'total', minimum: 1 }, group), RevivalPromiseError);
    assert.throws(() => recordPromisedRevival([], 'respondent', 2, group), RevivalPromiseError);
    assert.throws(() => revivalPromisesSatisfied([], 'respondent', 2, group), RevivalPromiseError);
  }
});

void test('future ordinary requests accumulate after each answer while prior completed returns do not satisfy a new promise', () => {
  const original = [promise('first-answer', 5)];
  const first = recordPromisedRevival(original, 'respondent', 2, { amount: 2, elite: 1 });
  assert.equal(first[0].progress, 2); assert.equal(first[0].fulfilled, undefined);
  const second = recordPromisedRevival(first, 'respondent', 2, { amount: 3, elite: 0 });
  assert.equal(second[0].progress, 5); assert.equal(second[0].fulfilled, true);
  const later = [...second, promise('later-answer', 2)];
  assert.equal(revivalPromisesSatisfied(later, 'respondent', 2, { amount: 0, elite: 0 }), false,
    'Five earlier returns are outside the new answer’s future progress');
  const third = recordPromisedRevival(later, 'respondent', 2, { amount: 1, elite: 0 });
  assert.equal(third[0], second[0]); assert.equal(third[1].progress, 1); assert.equal(third[1].fulfilled, undefined);
  const fourth = recordPromisedRevival(third, 'respondent', 2, { amount: 1, elite: 0 });
  assert.equal(fourth[1].progress, 2); assert.equal(fourth[1].fulfilled, true);
  assert.equal(original[0].progress, 0); assert.equal(first[0].progress, 2);
});

void test('one hypothetical completion must satisfy total, normal, elite and No answers together', () => {
  const records = [promise('total-four', 4), promise('normal-three', 3, { counter: 'normal' }),
    promise('elite-one', 1, { counter: 'elite' }), promise('not-two-elites', 2, { counter: 'elite', answer: false })];
  assert.equal(revivalPromisesSatisfied(records, 'respondent', 2, { amount: 4, elite: 1 }), true);
  assert.equal(revivalPromisesSatisfied(records, 'respondent', 2, { amount: 4, elite: 2 }), false,
    'Four total cannot compensate for too few normals or a breached elite cap');
  assert.equal(revivalPromisesSatisfied(records, 'respondent', 2, { amount: 4, elite: 0 }), false);
  const split = recordPromisedRevival(records, 'respondent', 2, { amount: 2, elite: 1 });
  assert.deepEqual(split.map(record => record.progress), [2, 1, 1, 1]);
  assert.equal(revivalPromisesSatisfied(split, 'respondent', 2, { amount: 2, elite: 0 }), true);
  const completed = recordPromisedRevival(split, 'respondent', 2, { amount: 2, elite: 0 });
  assert.deepEqual(completed.map(record => !!record.fulfilled), [true, true, true, false]);
  assert.equal(completed[3].progress, 1);
  const conflict = [promise('two-elites', 2, { counter: 'elite' }),
    promise('below-two-elites', 2, { counter: 'elite', answer: false })];
  assert.equal(revivalPromisesSatisfied(conflict, 'respondent', 2, { amount: 2, elite: 2 }), false);
  assert.equal(revivalPromisesSatisfied(conflict, 'respondent', 2, { amount: 2, elite: 1 }), false);
});

void test('No forbids crossing a cumulative cap through smaller split requests and rejection leaves every record unchanged', () => {
  const initial = [promise('need-three-normal', 3, { counter: 'normal' }), promise('below-four-total', 4, { answer: false })];
  const first = recordPromisedRevival(initial, 'respondent', 2, { amount: 2, elite: 1 });
  const second = recordPromisedRevival(first, 'respondent', 2, { amount: 1, elite: 0 });
  assert.deepEqual(second.map(record => record.progress), [2, 3]);
  const before = structuredClone(second); second.forEach(Object.freeze); Object.freeze(second);
  assert.throws(() => recordPromisedRevival(second, 'respondent', 2, { amount: 1, elite: 0 }), RevivalPromiseError);
  assert.deepEqual(second, before, 'A disallowed fourth total return cannot partly fulfill the normal Yes');
  assert.equal(revivalPromisesSatisfied(second, 'respondent', 2, { amount: 1, elite: 0 }), false);
  assert.equal(initial[0].progress, 0); assert.equal(initial[1].progress, 0);
});

void test('fulfilled and released answers retain their exact records while an unmatched typed counter is a no-op', () => {
  const fulfilled = promise('fulfilled', 2, { progress: 2, fulfilled: true });
  const released = promise('released', 2, { progress: 1, released: true });
  const elite = promise('still-needs-elite', 1, { counter: 'elite' });
  const no = promise('continuing-no', 4, { answer: false });
  const records = Object.freeze([fulfilled, released, elite, no]); records.forEach(Object.freeze);
  const next = recordPromisedRevival(records, 'respondent', 2, { amount: 2, elite: 0 });
  assert.equal(next[0], fulfilled); assert.equal(next[1], released); assert.equal(next[2], elite);
  assert.notEqual(next[3], no); assert.equal(next[3].progress, 2); assert.equal(next[3].fulfilled, undefined);
  assert.deepEqual(liveRevivalPromises(next, 'respondent', 2), [elite, next[3]]);
});

void test('current turn and respondent isolate progress while different askers retain jointly binding answers', () => {
  const own = promise('own', 3), secondAsker = promise('rival-asker', 5, { asker: 'rival', answer: false });
  const otherTurn = promise('old-turn', 1, { turn: 1 });
  const otherPlayer = promise('other-player', 1, { player: 'rival' });
  const records = [own, secondAsker, otherTurn, otherPlayer];
  assert.deepEqual(liveRevivalPromises(records, 'respondent', 2), [own, secondAsker]);
  assert.equal(revivalPromisesSatisfied(records, 'respondent', 2, { amount: 3, elite: 0 }), true);
  const next = recordPromisedRevival(records, 'respondent', 2, { amount: 3, elite: 0 });
  assert.equal(next[0].fulfilled, true); assert.equal(next[1].progress, 3);
  assert.equal(next[2], otherTurn); assert.equal(next[3], otherPlayer);
  const unrelated = recordPromisedRevival(records, 'absent', 2, { amount: 1, elite: 0 });
  records.forEach((record, index) => assert.equal(unrelated[index], record));
});

void test('zero final additions distinguish outstanding Yes from satisfied No and progress cannot exceed twenty physical returns', () => {
  const no = [promise('below-two', 2, { answer: false, progress: 1 })];
  assert.equal(revivalPromisesSatisfied(no, 'respondent', 2, { amount: 0, elite: 0 }), true);
  const yes = [promise('one-remaining', 20, { progress: 19 })];
  assert.equal(revivalPromisesSatisfied(yes, 'respondent', 2, { amount: 0, elite: 0 }), false);
  const zero = recordPromisedRevival(yes, 'respondent', 2, { amount: 0, elite: 0 });
  assert.equal(zero[0], yes[0]);
  assert.equal(revivalPromisesSatisfied(yes, 'respondent', 2, { amount: 1, elite: 0 }), true);
  const completed = recordPromisedRevival(yes, 'respondent', 2, { amount: 1, elite: 0 });
  assert.equal(completed[0].progress, 20); assert.equal(completed[0].fulfilled, true);
  assert.equal(revivalPromisesSatisfied(yes, 'respondent', 2, { amount: 2, elite: 0 }), false);
  assert.throws(() => recordPromisedRevival(yes, 'respondent', 2, { amount: 2, elite: 0 }), RevivalPromiseError);
  assert.equal(revivalPromisesSatisfied(completed, 'respondent', 2, { amount: 0, elite: 0 }), true);
  assert.equal(revivalPromisesSatisfied([], 'respondent', 2, { amount: 0, elite: 0 }), true);
});

void test('record validation binds original events, participants and consistent cumulative terminal states', () => {
  const valid = [promise('live-yes', 3, { progress: 2 }),
    promise('fulfilled-yes', 3, { progress: 3, fulfilled: true }),
    promise('released-yes', 3, { progress: 1, released: true }),
    promise('live-no', 3, { progress: 2, answer: false }),
    promise('completed-no', 3, { progress: 2, answer: false, fulfilled: true }),
    promise('released-no', 3, { progress: 2, answer: false, released: true })];
  const before = structuredClone(valid);
  assert.doesNotThrow(() => validateRevivalPromises(valid, seats)); assert.deepEqual(valid, before);
  assert.doesNotThrow(() => validateRevivalPromises(JSON.parse(JSON.stringify(valid)) as RevivalPromise[], seats));
  assert.doesNotThrow(() => validateRevivalPromises([], seats));
  const base = promise('event', 3);
  const invalid: unknown[] = [null, {}, [null], [base, { ...base }],
    ...[{ event: '' }, { event: ' ' }, { player: 'outsider' }, { asker: 'outsider' }, { asker: 'respondent' },
      { answer: 'yes' }, { progress: -1 }, { progress: 21 }, { progress: 1.5 }, { progress: Number.NaN },
      { progress: Number.MAX_SAFE_INTEGER + 1 }, { fulfilled: 1 }, { released: 'true' },
      { fulfilled: true, progress: 2 }, { fulfilled: false, progress: 3 }, { progress: 3 },
      { fulfilled: true, released: true, progress: 3 }, { answer: false, progress: 3 },
      { answer: false, progress: 3, fulfilled: true }, { answer: false, progress: 3, released: true },
      { turn: 0 }, { minimum: 21 }, { counter: 'sardaukar' }].map(extra => [{ ...base, ...extra }])];
  for (const records of invalid)
    assert.throws(() => validateRevivalPromises(records as RevivalPromise[], seats), RevivalPromiseError);
  assert.deepEqual(valid, before);
});
