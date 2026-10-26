import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BRIBE_EXPRESSION_MAX_DEPTH,
  BRIBE_EXPRESSION_MAX_LEAVES,
  BribeExpressionPromiseError,
  bribeCompletionCandidates,
  bribeExpressionBranches,
  bribeExpressionRecipients,
  bribeExpressionText,
  evaluateBribeExpression,
  liveBribeExpressionPromises,
  parseBribeExpression,
  parseBribeExpressionClaim,
  recordBribeExpressionPayment,
  validateBribeExpressionPromises,
  type BribeExpression,
  type BribeExpressionProgress,
  type BribeExpressionPromise,
} from '../game/bribe-expression-promises';
import { type BribePromise } from '../game/bribe-promises';

const seats = ['payer', 'asker', 'a', 'b', 'c', 'other-payer'];
const pay = (recipient = 'a', minimum = 3): BribeExpression => ({ kind: 'payment', recipient, minimum });
const group = (kind: 'and' | 'or', ...terms: BribeExpression[]): BribeExpression => ({ kind, terms });
const progress = (recipient: string, amount: number): BribeExpressionProgress => [{ recipient, amount }];
const promise = (event: string, claim: BribeExpression = pay(), extra: Partial<BribeExpressionPromise> = {}): BribeExpressionPromise =>
  ({ event, turn: 2, claim, player: 'payer', asker: 'asker', answer: true, progress: [], ...extra });
const atomic = (event: string, recipient = 'a', minimum = 3, extra: Partial<BribePromise> = {}): BribePromise =>
  ({ event, turn: 2, recipient, minimum, player: 'payer', asker: 'asker', answer: true, progress: 0, ...extra });
const candidates = (atomics: BribePromise[], expressions: BribeExpressionPromise[]) =>
  [...bribeCompletionCandidates(atomics, expressions, 'payer', 2)];

void test('bribe expressions accept sixteen leaves, four group levels and safe spice minima without a gameplay cap', () => {
  assert.equal(BRIBE_EXPRESSION_MAX_DEPTH, 4); assert.equal(BRIBE_EXPRESSION_MAX_LEAVES, 16);
  const sixteen = group('and', ...Array.from({ length: 16 }, (_, index) => pay(`recipient-${index}`, index + 1)));
  const parsed = parseBribeExpression(sixteen);
  assert.deepEqual(parsed, sixteen); assert.notEqual(parsed, sixteen);
  if ('terms' in parsed && 'terms' in sixteen) {
    assert.notEqual(parsed.terms, sixteen.terms); assert.notEqual(parsed.terms[0], sixteen.terms[0]);
  }
  const nested = (depth: number): BribeExpression => depth === 0 ? pay('a', 1) : group('or', pay('b'), nested(depth - 1));
  assert.deepEqual(parseBribeExpression(nested(4)), nested(4));
  assert.throws(() => parseBribeExpression(nested(5)), BribeExpressionPromiseError);
  assert.throws(() => parseBribeExpression(group('or', ...Array.from({ length: 17 }, () => pay()))), BribeExpressionPromiseError);
  assert.throws(() => parseBribeExpression(group('and', group('or', ...Array.from({ length: 9 }, () => pay())),
    group('or', ...Array.from({ length: 8 }, () => pay('b'))))), BribeExpressionPromiseError);
  assert.deepEqual(parseBribeExpressionClaim({ turn: Number.MAX_SAFE_INTEGER, claim: pay('a', Number.MAX_SAFE_INTEGER) }),
    { turn: Number.MAX_SAFE_INTEGER, claim: pay('a', Number.MAX_SAFE_INTEGER) });
  assert.deepEqual(parseBribeExpression(pay('a', 1001)), pay('a', 1001));
});

void test('strict parsing validates decisive later subtrees, exact node fields and all safe positive minima', () => {
  const invalid: unknown[] = [null, [], {}, { kind: 'and', terms: [] }, { kind: 'or', terms: [pay()] },
    { kind: 'and', terms: [pay(), pay('b')], extra: true },
    { kind: 'payment', recipient: ' a', minimum: 1 }, { kind: 'payment', recipient: '', minimum: 1 },
    { kind: 'payment', recipient: 'a', minimum: 1, progress: 0 }, { kind: 'not', terms: [pay(), pay()] },
    ...[0, -1, 0.5, Number.NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '3'].map(minimum =>
      ({ kind: 'payment', recipient: 'a', minimum }))];
  for (const input of invalid) assert.throws(() => parseBribeExpression(input), BribeExpressionPromiseError);
  const decisive = group('or', pay('a', 1), { kind: 'payment', recipient: 'b', minimum: 0 });
  assert.throws(() => evaluateBribeExpression(decisive, progress('a', 1)), BribeExpressionPromiseError);
  assert.throws(() => evaluateBribeExpression(group('and', pay('a', 1), decisive), []), BribeExpressionPromiseError);
  assert.throws(() => [...bribeExpressionBranches(promise('bad-later', decisive, { progress: progress('a', 1) }))],
    BribeExpressionPromiseError);
  for (const input of [{ turn: 0, claim: pay() }, { turn: '2', claim: pay() }, { turn: 2, claim: pay(), privateSpice: 9 },
    { turn: 2 }, { claim: pay() }]) assert.throws(() => parseBribeExpressionClaim(input), BribeExpressionPromiseError);
});

void test('evaluation, public text and recipients retain nested whole meaning with exact recipient identities', () => {
  const claim = group('and', pay('a', 3), group('or', pay('b', 2), pay('a', 6)));
  assert.deepEqual(bribeExpressionRecipients(claim), ['a', 'b']);
  assert.equal(evaluateBribeExpression(claim, progress('a', 3)), false);
  assert.equal(evaluateBribeExpression(claim, progress('a', 6)), true);
  assert.equal(evaluateBribeExpression(claim, [...progress('a', 3), ...progress('b', 2)]), true);
  assert.equal(bribeExpressionText(claim, id => id.toUpperCase()),
    '(pay at least 3 spice to A in ordinary bribes AND (pay at least 2 spice to B in ordinary bribes OR pay at least 6 spice to A in ordinary bribes))');
});

void test('whole Yes keeps dynamic OR alternatives after partial payment and allows either actual route', () => {
  const original = promise('choice', group('or', pay('a', 3), pay('b', 2)));
  assert.deepEqual(candidates([], [original]), [[{ recipient: 'a', amount: 3 }], [{ recipient: 'b', amount: 2 }]]);
  const partial = recordBribeExpressionPayment([original], 'payer', 2, { recipient: 'a', amount: 1 });
  assert.deepEqual(partial[0].progress, progress('a', 1)); assert.equal(partial[0].fulfilled, undefined);
  assert.deepEqual(candidates([], partial), [[{ recipient: 'a', amount: 2 }], [{ recipient: 'b', amount: 2 }]]);
  assert.equal(recordBribeExpressionPayment(partial, 'payer', 2, { recipient: 'a', amount: 2 })[0].fulfilled, true);
  const byB = recordBribeExpressionPayment(partial, 'payer', 2, { recipient: 'b', amount: 2 });
  assert.equal(byB[0].fulfilled, true); assert.deepEqual([...bribeExpressionBranches(byB[0])], [[]]);
  assert.deepEqual(original.progress, []); assert.deepEqual(partial[0].progress, progress('a', 1));
});

void test('whole No to nested AND permits a completed conjunct and rejects completing either remaining alternative', () => {
  const original = promise('not-all', group('and', pay('a', 2), group('or', pay('b', 3), pay('c', 4))), { answer: false });
  assert.deepEqual([...bribeExpressionBranches(original)], [
    [{ recipient: 'a', minimum: 2, progress: 0, answer: false }],
    [{ recipient: 'b', minimum: 3, progress: 0, answer: false }, { recipient: 'c', minimum: 4, progress: 0, answer: false }],
  ]);
  const partial = recordBribeExpressionPayment([original], 'payer', 2, { recipient: 'a', amount: 2 });
  assert.equal(partial[0].fulfilled, undefined);
  assert.deepEqual([...bribeExpressionBranches(partial[0])], [[
    { recipient: 'b', minimum: 3, progress: 0, answer: false }, { recipient: 'c', minimum: 4, progress: 0, answer: false },
  ]]);
  assert.throws(() => recordBribeExpressionPayment(partial, 'payer', 2, { recipient: 'b', amount: 3 }), BribeExpressionPromiseError);
  assert.throws(() => recordBribeExpressionPayment(partial, 'payer', 2, { recipient: 'c', amount: 4 }), BribeExpressionPromiseError);
  const opposite = recordBribeExpressionPayment([original], 'payer', 2, { recipient: 'b', amount: 3 });
  assert.throws(() => recordBribeExpressionPayment(opposite, 'payer', 2, { recipient: 'a', amount: 2 }), BribeExpressionPromiseError);
});

void test('whole No to nested OR forbids its first leaf but allows one child of the remaining AND', () => {
  const original = promise('not-either', group('or', pay('a', 2), group('and', pay('b', 3), pay('c', 4))), { answer: false });
  assert.throws(() => recordBribeExpressionPayment([original], 'payer', 2, { recipient: 'a', amount: 2 }), BribeExpressionPromiseError);
  const partial = recordBribeExpressionPayment([original], 'payer', 2, { recipient: 'b', amount: 3 });
  assert.doesNotThrow(() => recordBribeExpressionPayment(partial, 'payer', 2, { recipient: 'a', amount: 1 }));
  assert.throws(() => recordBribeExpressionPayment(partial, 'payer', 2, { recipient: 'c', amount: 4 }), BribeExpressionPromiseError);
  assert.deepEqual(candidates([atomic('needs-c', 'c', 4)], partial), []);
  const noOr = promise('neither', group('or', pay('a', 2), pay('b', 3)), { answer: false });
  assert.deepEqual(candidates([atomic('needs-a', 'a', 2)], [noOr]), []);
  assert.deepEqual(candidates([], [noOr]), [[]]);
});

void test('same-recipient conjuncts share cumulative payments while different recipients require separate spice', () => {
  const original = promise('share', group('and', pay('a', 3), pay('a', 5), pay('b', 2)));
  assert.deepEqual(candidates([], [original]), [[{ recipient: 'a', amount: 5 }, { recipient: 'b', amount: 2 }]]);
  const partial = recordBribeExpressionPayment([original], 'payer', 2, { recipient: 'a', amount: 3 });
  assert.deepEqual(candidates([], partial), [[{ recipient: 'a', amount: 2 }, { recipient: 'b', amount: 2 }]]);
  assert.deepEqual([...bribeExpressionBranches(promise('same-cap', group('or', pay('a', 3), pay('a', 5)), { answer: false }))],
    [[{ recipient: 'a', minimum: 3, progress: 0, answer: false }]]);
});

void test('branches simplify already true leaves and keep whole No alternatives without a stored route', () => {
  const partial = promise('partly-true', group('and', pay('a', 3), pay('b', 2)), { progress: progress('a', 3) });
  assert.deepEqual([...bribeExpressionBranches(partial)], [[{ recipient: 'b', minimum: 2, progress: 0, answer: true }]]);
  assert.deepEqual([...bribeExpressionBranches({ ...partial, answer: false })],
    [[{ recipient: 'b', minimum: 2, progress: 0, answer: false }]]);
  const trueOr = promise('already-true', group('or', pay('a', 3), pay('b', 2)), { progress: progress('a', 3) });
  assert.deepEqual([...bribeExpressionBranches(trueOr)], [[]]);
  assert.deepEqual([...bribeExpressionBranches({ ...trueOr, answer: false })], []);
  const alternatives = promise('still-lazy', group('or', pay('a', 3), pay('b', 2)));
  const first = bribeExpressionBranches(alternatives);
  assert.deepEqual(first.next().value, [{ recipient: 'a', minimum: 3, progress: 0, answer: true }]);
  assert.equal('branch' in alternatives, false);
  const next = recordBribeExpressionPayment([alternatives], 'payer', 2, { recipient: 'b', amount: 2 });
  assert.equal(next[0].fulfilled, true); assert.equal('branch' in next[0], false);
});

void test('joint scalar and expression routes preserve each answer interval, caps and distinct recipient budgets', () => {
  const older = atomic('old-a', 'a', 8, { progress: 3 });
  const later = promise('later-route', group('or', pay('a', 5), pay('b', 3)));
  assert.deepEqual(candidates([older], [later]), [
    [{ recipient: 'a', amount: 5 }], [{ recipient: 'a', amount: 5 }, { recipient: 'b', amount: 3 }],
  ]);
  const cap = atomic('a-cap', 'a', 9, { progress: 4, answer: false });
  assert.deepEqual(candidates([older, cap], [later]), []);
  assert.deepEqual(candidates([cap], [later]), [[{ recipient: 'b', amount: 3 }]]);
  const notBoth = promise('not-both', group('and', pay('a', 5), pay('b', 3)), { answer: false });
  assert.deepEqual(candidates([older], [notBoth]), [[{ recipient: 'a', amount: 5 }]]);
  assert.deepEqual(candidates([older, atomic('also-b', 'b', 3)], [notBoth]), []);
  const second = promise('needs-c', group('and', pay('a', 2), pay('c', 4)));
  assert.deepEqual(candidates([older], [later, second]), [
    [{ recipient: 'a', amount: 5 }, { recipient: 'c', amount: 4 }],
    [{ recipient: 'a', amount: 5 }, { recipient: 'b', amount: 3 }, { recipient: 'c', amount: 4 }],
  ]);
  assert.deepEqual(candidates([], [promise('repeat-route', group('or', pay('a'), pay('a')))]), [[{ recipient: 'a', amount: 3 }]]);
});

void test('new answers exclude prior payments and terminal, other-payer, turn and recipient entries retain references', () => {
  const fulfilled = recordBribeExpressionPayment([promise('earlier', pay('a', 2))], 'payer', 2, { recipient: 'a', amount: 2 })[0];
  const later = promise('new-answer', pay('a', 2));
  const records = [fulfilled, promise('released', pay(), { released: true }), promise('old-turn', pay(), { turn: 1 }),
    promise('other', pay(), { player: 'other-payer' }), promise('other-recipient', pay('b')), later];
  assert.deepEqual(liveBribeExpressionPromises(records, 'payer', 2), [records[4], later]);
  assert.deepEqual(candidates([], [fulfilled, later]), [[{ recipient: 'a', amount: 2 }]]);
  const paid = recordBribeExpressionPayment(records, 'payer', 2, { recipient: 'a', amount: 1 });
  for (let index = 0; index < 5; index++) assert.equal(paid[index], records[index]);
  assert.deepEqual(paid[5].progress, progress('a', 1)); assert.deepEqual(later.progress, []);
  const unrelated = recordBribeExpressionPayment(records, 'absent', 2, { recipient: 'a', amount: 1 });
  records.forEach((record, index) => assert.equal(unrelated[index], record));
});

void test('rejected ordinary payments leave every whole-answer ledger unchanged and do not partly fulfill another promise', () => {
  const records = [promise('yes', pay('a', 3)), promise('no', group('or', pay('a', 3), pay('b', 2)), { answer: false })];
  const partial = recordBribeExpressionPayment(records, 'payer', 2, { recipient: 'a', amount: 2 });
  const before = structuredClone(partial);
  partial.forEach(entry => { entry.progress.forEach(Object.freeze); Object.freeze(entry.progress); Object.freeze(entry); });
  Object.freeze(partial);
  assert.throws(() => recordBribeExpressionPayment(partial, 'payer', 2, { recipient: 'a', amount: 1 }), BribeExpressionPromiseError);
  assert.deepEqual(partial, before); assert.equal(partial[0].fulfilled, undefined);
  assert.deepEqual(candidates([], partial), []); assert.deepEqual(partial, before);
});

void test('safe arithmetic rejects payment and total-route overflow including progress on nonselected leaves', () => {
  const maximum = Number.MAX_SAFE_INTEGER;
  const near = promise('near', pay('a', maximum), { progress: progress('a', maximum - 1) });
  assert.deepEqual(candidates([], [near]), [[{ recipient: 'a', amount: 1 }]]);
  assert.equal(recordBribeExpressionPayment([near], 'payer', 2, { recipient: 'a', amount: 1 })[0].progress[0].amount, maximum);
  assert.throws(() => recordBribeExpressionPayment([near], 'payer', 2, { recipient: 'a', amount: 2 }), BribeExpressionPromiseError);
  assert.deepEqual(candidates([], [promise('too-large', group('and', pay('a', maximum), pay('b', 1)))]), []);
  assert.deepEqual(candidates([], [promise('exact', group('and', pay('a', maximum - 1), pay('b', 1)))]),
    [[{ recipient: 'a', amount: maximum - 1 }, { recipient: 'b', amount: 1 }]]);
  const partial = promise('nonselected', group('and', pay('a', 1), pay('b', 2)), { progress: progress('a', maximum) });
  assert.deepEqual(candidates([atomic('requires-one-more', 'a', 1)], [partial]), []);
  assert.deepEqual(candidates([], [partial]), [[{ recipient: 'b', amount: 2 }]]);
});

void test('progress and event inputs require exact unique recipients, safe amounts and matching expression leaves', () => {
  const invalidProgress: unknown[] = [null, {}, progress('a', -1), progress('a', 0.5), progress('a', Number.MAX_SAFE_INTEGER + 1),
    [...progress('a', 1), ...progress('a', 2)], progress(' a', 1), [{ recipient: 'a', amount: 1, receipt: true }]];
  for (const input of invalidProgress)
    assert.throws(() => evaluateBribeExpression(pay(), input as BribeExpressionProgress), BribeExpressionPromiseError);
  for (const payment of [{ recipient: 'a', amount: 0 }, { recipient: 'a', amount: -1 }, { recipient: 'a', amount: 0.5 },
    { recipient: 'a', amount: Infinity }, { recipient: 'a', amount: Number.MAX_SAFE_INTEGER + 1 },
    { recipient: 'a ', amount: 1 }, { recipient: 'a', amount: 1, receipt: true }])
    assert.throws(() => recordBribeExpressionPayment([], 'payer', 2, payment), BribeExpressionPromiseError);
  assert.throws(() => candidates([], [promise('unmatched-progress', pay(), { progress: progress('b', 1) })]), BribeExpressionPromiseError);
});

void test('ledger validation binds unique events, participants, order and whole-answer terminal consistency', () => {
  const valid = [promise('live', pay(), { progress: progress('a', 2), order: 1 }),
    promise('fulfilled', pay(), { progress: progress('a', 3), fulfilled: true }),
    promise('closed-no', pay(), { answer: false, fulfilled: true }), promise('released', pay(), { released: true }),
    promise('asker-recipient', pay('asker'))];
  const before = structuredClone(valid);
  assert.doesNotThrow(() => validateBribeExpressionPromises(valid, seats));
  assert.doesNotThrow(() => validateBribeExpressionPromises(JSON.parse(JSON.stringify(valid)) as BribeExpressionPromise[], seats));
  const base = promise('event');
  const invalid: unknown[] = [null, {}, [null], [base, { ...base }],
    ...[{ event: '' }, { player: 'absent' }, { asker: 'absent' }, { asker: 'payer' }, { claim: pay('absent') }, { claim: pay('payer') },
      { answer: 'yes' }, { fulfilled: 1 }, { released: 1 }, { fulfilled: true }, { fulfilled: true, released: true },
      { progress: progress('a', 3) }, { answer: false, progress: progress('a', 3) },
      { answer: false, progress: progress('a', 3), released: true }, { turn: 0 }, { order: 0 }, { order: 1.5 }]
      .map(extra => [{ ...base, ...extra }])];
  for (const records of invalid)
    assert.throws(() => validateBribeExpressionPromises(records as BribeExpressionPromise[], seats), BribeExpressionPromiseError);
  assert.deepEqual(valid, before);
});
