import assert from 'node:assert/strict';
import test from 'node:test';
import {
  REVIVAL_EXPRESSION_MAX_DEPTH,
  REVIVAL_EXPRESSION_MAX_LEAVES,
  RevivalExpressionPromiseError,
  evaluateRevivalExpression,
  liveRevivalExpressionPromises,
  parseRevivalExpression,
  parseRevivalExpressionClaim,
  recordRevivalExpressionReturn,
  revivalExpressionBranches,
  revivalExpressionPromiseModeSupported,
  revivalExpressionText,
  validateRevivalExpressionPromises,
  type RevivalExpression,
  type RevivalExpressionProgress,
  type RevivalExpressionPromise,
} from '../game/revival-expression-promises';
import { revivalPromiseModeSupported } from '../game/revival-promises';

const seats = ['respondent', 'asker', 'other-player'];
const forces = (minimum = 3, counter: 'total' | 'normal' | 'elite' = 'total'): RevivalExpression =>
  ({ kind: 'forces', counter, minimum });
const leader = (id = 'leader-a'): RevivalExpression => ({ kind: 'leader', leader: id });
const group = (kind: 'and' | 'or', ...terms: RevivalExpression[]): RevivalExpression => ({ kind, terms });
const zero = (): RevivalExpressionProgress => ({ total: 0, normal: 0, elite: 0, leaders: [] });
const promise = (event: string, claim: RevivalExpression = forces(), extra: Partial<RevivalExpressionPromise> = {}): RevivalExpressionPromise =>
  ({ event, turn: 2, claim, player: 'respondent', asker: 'asker', answer: true, progress: zero(), ...extra });

void test('revival expressions accept all sixteen leaves and four group levels with independent canonical copies', () => {
  assert.equal(REVIVAL_EXPRESSION_MAX_DEPTH, 4); assert.equal(REVIVAL_EXPRESSION_MAX_LEAVES, 16);
  const sixteen = group('and', ...Array.from({ length: 16 }, (_, index) => leader(`leader-${index}`)));
  const parsed = parseRevivalExpression(sixteen);
  assert.deepEqual(parsed, sixteen); assert.notEqual(parsed, sixteen);
  if ('terms' in parsed && 'terms' in sixteen) {
    assert.notEqual(parsed.terms, sixteen.terms); assert.notEqual(parsed.terms[0], sixteen.terms[0]);
  }
  const nested = (depth: number): RevivalExpression => depth === 0 ? forces(1) : group('or', leader(`level-${depth}`), nested(depth - 1));
  assert.deepEqual(parseRevivalExpression(nested(4)), nested(4));
  assert.throws(() => parseRevivalExpression(nested(5)), RevivalExpressionPromiseError);
  assert.throws(() => parseRevivalExpression(group('or', ...Array.from({ length: 17 }, (_, index) => leader(`leader-${index}`)))),
    RevivalExpressionPromiseError);
  assert.deepEqual(parseRevivalExpressionClaim({ turn: Number.MAX_SAFE_INTEGER, claim: leader('kwisatz') }),
    { turn: Number.MAX_SAFE_INTEGER, claim: leader('kwisatz') });
});

void test('strict parsing checks malformed decisive branches, exact fields and every threshold before evaluation', () => {
  const invalid: unknown[] = [null, [], {}, { kind: 'and', terms: [] }, { kind: 'or', terms: [leader()] },
    { kind: 'and', terms: [leader(), forces()], extra: true }, { kind: 'leader', leader: ' leader-a' },
    { kind: 'leader', leader: '' }, { kind: 'leader', leader: 'leader-a', cost: 2 },
    { kind: 'forces', counter: 'total', minimum: 1, progress: 0 },
    ...[0, 21, 1.5, Number.NaN, Infinity, '3'].map(minimum => ({ kind: 'forces', counter: 'total', minimum })),
    { kind: 'forces', counter: 'sardaukar', minimum: 1 }, { kind: 'not', terms: [leader(), forces()] }];
  for (const input of invalid) assert.throws(() => parseRevivalExpression(input), RevivalExpressionPromiseError);
  const decisive = { kind: 'or', terms: [leader(), { kind: 'forces', counter: 'total', minimum: 0 }] };
  assert.throws(() => evaluateRevivalExpression(decisive as RevivalExpression,
    { ...zero(), leaders: ['leader-a'] }), RevivalExpressionPromiseError,
  'A true first branch does not hide a malformed later branch');
  for (const input of [{ turn: 0, claim: forces() }, { turn: '2', claim: forces() },
    { turn: 2, claim: forces(), target: 'respondent' }, { turn: 2 }, { claim: forces() }])
    assert.throws(() => parseRevivalExpressionClaim(input), RevivalExpressionPromiseError);
});

void test('evaluation and public text keep nested Boolean meaning and count each elite as one physical force', () => {
  const claim = group('and', forces(3), group('or', forces(2, 'normal'), leader('kwisatz')));
  const twoElites = { total: 3, normal: 1, elite: 2, leaders: [] };
  assert.equal(evaluateRevivalExpression(claim, twoElites), false);
  assert.equal(evaluateRevivalExpression(claim, { ...twoElites, leaders: ['kwisatz'] }), true);
  assert.equal(evaluateRevivalExpression(claim, { total: 3, normal: 2, elite: 1, leaders: [] }), true);
  assert.equal(evaluateRevivalExpression(forces(2, 'elite'), twoElites), true);
  assert.equal(evaluateRevivalExpression(forces(2, 'normal'), twoElites), false);
  assert.equal(revivalExpressionText(claim),
    '(revive at least 3 physical forces through ordinary force revival AND (revive at least 2 normal forces through ordinary force revival OR revive Kwisatz Haderach through ordinary leader revival))');
  assert.equal(revivalExpressionText(leader(), () => 'Named Leader'), 'revive Named Leader through ordinary leader revival');
});

void test('whole Yes keeps OR alternatives after partial force progress and fulfills on either actual return route', () => {
  const original = promise('choice', group('or', forces(3, 'normal'), leader()));
  const initial = [...revivalExpressionBranches(original)];
  assert.deepEqual(initial, [[{ kind: 'forces', counter: 'normal', minimum: 3, progress: 0, answer: true }],
    [{ kind: 'leader', leader: 'leader-a', answer: true }]]);
  const partial = recordRevivalExpressionReturn([original], 'respondent', 2, { kind: 'forces', amount: 2, elite: 1 });
  assert.deepEqual(partial[0].progress, { total: 2, normal: 1, elite: 1, leaders: [] });
  assert.equal(partial[0].fulfilled, undefined);
  assert.deepEqual([...revivalExpressionBranches(partial[0])],
    [[{ kind: 'forces', counter: 'normal', minimum: 3, progress: 1, answer: true }],
      [{ kind: 'leader', leader: 'leader-a', answer: true }]], 'Partial play never pins the force alternative');
  const byLeader = recordRevivalExpressionReturn(partial, 'respondent', 2, { kind: 'leader', leader: 'leader-a' });
  assert.equal(byLeader[0].fulfilled, true);
  const byForces = recordRevivalExpressionReturn(partial, 'respondent', 2, { kind: 'forces', amount: 2, elite: 0 });
  assert.equal(byForces[0].fulfilled, true);
  assert.deepEqual([...revivalExpressionBranches(byLeader[0])], [[]]);
  assert.deepEqual(original.progress, zero());
});

void test('whole No to AND permits one completed conjunct and only prevents completing the whole statement', () => {
  const original = promise('not-both', group('and', forces(2, 'elite'), leader()), { answer: false });
  assert.deepEqual([...revivalExpressionBranches(original)],
    [[{ kind: 'forces', counter: 'elite', minimum: 2, progress: 0, answer: false }],
      [{ kind: 'leader', leader: 'leader-a', answer: false }]]);
  const first = recordRevivalExpressionReturn([original], 'respondent', 2, { kind: 'forces', amount: 2, elite: 2 });
  assert.equal(first[0].fulfilled, undefined);
  assert.deepEqual([...revivalExpressionBranches(first[0])], [[{ kind: 'leader', leader: 'leader-a', answer: false }]]);
  const before = structuredClone(first); Object.freeze(first[0].progress.leaders); Object.freeze(first[0].progress); Object.freeze(first[0]); Object.freeze(first);
  assert.throws(() => recordRevivalExpressionReturn(first, 'respondent', 2, { kind: 'leader', leader: 'leader-a' }), RevivalExpressionPromiseError);
  assert.deepEqual(first, before);
  const other = recordRevivalExpressionReturn(first, 'respondent', 2, { kind: 'leader', leader: 'leader-b' });
  assert.deepEqual(other[0].progress.leaders, ['leader-b']); assert.equal(other[0].fulfilled, undefined);
});

void test('whole No to OR retains every cap across split requests and rejects before another Yes can change', () => {
  const no = promise('neither', group('or', forces(3), leader()), { answer: false });
  assert.deepEqual([...revivalExpressionBranches(no)], [[
    { kind: 'forces', counter: 'total', minimum: 3, progress: 0, answer: false },
    { kind: 'leader', leader: 'leader-a', answer: false },
  ]]);
  const first = recordRevivalExpressionReturn([no], 'respondent', 2, { kind: 'forces', amount: 1, elite: 0 });
  const second = recordRevivalExpressionReturn(first, 'respondent', 2, { kind: 'forces', amount: 1, elite: 1 });
  const together = [promise('yes-third-force', forces(1)), second[0]], before = structuredClone(together);
  assert.throws(() => recordRevivalExpressionReturn(together, 'respondent', 2, { kind: 'forces', amount: 1, elite: 0 }), RevivalExpressionPromiseError);
  assert.deepEqual(together, before);
  assert.throws(() => recordRevivalExpressionReturn(second, 'respondent', 2, { kind: 'leader', leader: 'leader-a' }), RevivalExpressionPromiseError);
  assert.equal(second[0].progress.total, 2); assert.equal(second[0].fulfilled, undefined);
});

void test('lazy branch products retain sixteen-leaf choices and prune redundant same-counter bounds', () => {
  const sixteen = group('and', ...Array.from({ length: 8 }, (_, index) =>
    group('or', leader(`left-${index}`), leader(`right-${index}`))));
  const iterator = revivalExpressionBranches(promise('sixteen', sixteen));
  assert.equal(iterator[Symbol.iterator](), iterator);
  const first = iterator.next(); assert.equal(first.done, false); assert.equal(first.value?.length, 8);
  const firstSnapshot = structuredClone(first.value);
  const second = iterator.next(); assert.equal(second.done, false); assert.equal(second.value?.length, 8);
  assert.deepEqual(first.value, firstSnapshot, 'Later products cannot mutate previously returned alternatives');
  assert.notDeepEqual(first.value, second.value);
  assert.equal([...revivalExpressionBranches(promise('all', sixteen))].length, 256);
  assert.deepEqual([...revivalExpressionBranches(promise('strongest-yes', group('and', forces(2), forces(5), forces(3))))],
    [[{ kind: 'forces', counter: 'total', minimum: 5, progress: 0, answer: true }]]);
  assert.deepEqual([...revivalExpressionBranches(promise('strongest-no', group('or', forces(2), forces(5)), { answer: false }))],
    [[{ kind: 'forces', counter: 'total', minimum: 2, progress: 0, answer: false }]]);
  assert.deepEqual([...revivalExpressionBranches(promise('same-disc', group('and', leader(), leader())))],
    [[{ kind: 'leader', leader: 'leader-a', answer: true }]]);
});

void test('candidate branches simplify completed leaves without allowing a currently true whole No', () => {
  const progress = { total: 3, normal: 2, elite: 1, leaders: ['leader-a'] };
  const yes = promise('already-true', group('or', forces(3), leader('leader-b')), { progress });
  assert.deepEqual([...revivalExpressionBranches(yes)], [[]]);
  const no = promise('impossible-no', yes.claim, { progress, answer: false });
  assert.deepEqual([...revivalExpressionBranches(no)], []);
  const and = promise('remaining-leader', group('and', forces(3), leader('leader-b')), { progress });
  assert.deepEqual([...revivalExpressionBranches(and)], [[{ kind: 'leader', leader: 'leader-b', answer: true }]]);
  assert.deepEqual([...revivalExpressionBranches({ ...and, answer: false })],
    [[{ kind: 'leader', leader: 'leader-b', answer: false }]]);
});

void test('new answer intervals, terminal entries, players and turns isolate immutable physical progress', () => {
  const completed = recordRevivalExpressionReturn([promise('first', leader())], 'respondent', 2,
    { kind: 'leader', leader: 'leader-a' })[0];
  const released = promise('released', forces(1), { released: true });
  const otherTurn = promise('other-turn', forces(1), { turn: 1 });
  const otherPlayer = promise('other-player', forces(1), { player: 'other-player' });
  const later = promise('later', leader());
  const records = [completed, released, otherTurn, otherPlayer, later];
  assert.deepEqual(liveRevivalExpressionPromises(records, 'respondent', 2), [later]);
  assert.deepEqual([...revivalExpressionBranches(later)], [[{ kind: 'leader', leader: 'leader-a', answer: true }]],
    'An earlier physical return is excluded from a later answer');
  const returned = recordRevivalExpressionReturn(records, 'respondent', 2, { kind: 'leader', leader: 'leader-a' });
  for (let index = 0; index < 4; index++) assert.equal(returned[index], records[index]);
  assert.equal(returned[4].fulfilled, true); assert.deepEqual(later.progress, zero());
  const duplicate = recordRevivalExpressionReturn([promise('same-id', forces(20), { progress: { ...zero(), leaders: ['leader-a'] } })],
    'respondent', 2, { kind: 'leader', leader: 'leader-a' });
  assert.deepEqual(duplicate[0].progress.leaders, ['leader-a']);
  const absent = recordRevivalExpressionReturn(records, 'absent', 2, { kind: 'forces', amount: 1, elite: 0 });
  records.forEach((record, index) => assert.equal(absent[index], record));
});

void test('physical progress validates typed totals, the twenty-counter bound, exact events and unique leader identities', () => {
  const invalidProgress: unknown[] = [{ ...zero(), total: 1 }, { ...zero(), normal: -1 },
    { total: 21, normal: 20, elite: 1, leaders: [] }, { total: 1, normal: 0.5, elite: 0.5, leaders: [] },
    { ...zero(), leaders: ['leader-a', 'leader-a'] }, { ...zero(), leaders: [' leader-a'] },
    { ...zero(), extra: 1 }];
  for (const progress of invalidProgress)
    assert.throws(() => evaluateRevivalExpression(forces(), progress as RevivalExpressionProgress), RevivalExpressionPromiseError);
  const nearLimit = promise('twenty', forces(20, 'elite'), { progress: { total: 20, normal: 20, elite: 0, leaders: [] } });
  assert.throws(() => recordRevivalExpressionReturn([nearLimit], 'respondent', 2,
    { kind: 'forces', amount: 1, elite: 1 }), RevivalExpressionPromiseError);
  for (const event of [{ kind: 'forces', amount: 1, elite: 2 }, { kind: 'forces', amount: 21, elite: 0 },
    { kind: 'forces', amount: 1, elite: -1 }, { kind: 'forces', amount: 1.5, elite: 0 },
    { kind: 'leader', leader: ' leader-a' }, { kind: 'leader', leader: 'leader-a', special: true }])
    assert.throws(() => recordRevivalExpressionReturn([], 'respondent', 2, event as Parameters<typeof recordRevivalExpressionReturn>[3]),
      RevivalExpressionPromiseError);
  const original = promise('zero');
  assert.equal(recordRevivalExpressionReturn([original], 'respondent', 2, { kind: 'forces', amount: 0, elite: 0 })[0], original);
});

void test('ledger validation binds event participants and whole-answer terminal consistency including JSON records', () => {
  const valid = [promise('live'), promise('fulfilled', forces(2),
    { progress: { total: 2, normal: 1, elite: 1, leaders: [] }, fulfilled: true }),
  promise('closed-no', forces(2), { answer: false, fulfilled: true }),
  promise('released', leader(), { released: true })];
  const before = structuredClone(valid);
  assert.doesNotThrow(() => validateRevivalExpressionPromises(valid, seats));
  assert.doesNotThrow(() => validateRevivalExpressionPromises(JSON.parse(JSON.stringify(valid)) as RevivalExpressionPromise[], seats));
  const base = promise('event');
  const invalid: unknown[] = [null, {}, [null], [base, { ...base }],
    ...[{ event: '' }, { player: 'absent' }, { asker: 'absent' }, { asker: 'respondent' }, { answer: 'yes' },
      { fulfilled: 1 }, { fulfilled: true }, { fulfilled: true, released: true },
      { progress: { total: 3, normal: 3, elite: 0, leaders: [] } },
      { answer: false, progress: { total: 3, normal: 3, elite: 0, leaders: [] } }, { turn: 0 }]
      .map(extra => [{ ...base, ...extra }])];
  for (const records of invalid)
    assert.throws(() => validateRevivalExpressionPromises(records as RevivalExpressionPromise[], seats), RevivalExpressionPromiseError);
  assert.deepEqual(valid, before);
});

void test('expression mode is exactly the existing native revival mode with no new module or start permission', () => {
  assert.equal(revivalExpressionPromiseModeSupported, revivalPromiseModeSupported);
  const classic = { advanced: false, expansions: [], players: [{ faction: 'atreides' }, { faction: 'emperor' }] };
  assert.equal(revivalExpressionPromiseModeSupported(classic), true);
  assert.equal(revivalExpressionPromiseModeSupported({ ...classic, advanced: true }), true);
  for (const option of ['homeworlds', 'nexusCards', 'leaderSkills', 'techTokens', 'strongholdCards',
    'discoveryEnabled', 'ecazTreachery', 'semutaPreview', 'kullPreview', 'nexusKullPreview', 'richeseBetrayalPreview'] as const)
    assert.equal(revivalExpressionPromiseModeSupported({ ...classic, [option]: true }), false, option);
});
