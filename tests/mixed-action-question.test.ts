import assert from 'node:assert/strict';
import test from 'node:test';
import {
  compileMixedActionExpression,
  mixedActionExpressionText,
  MixedActionQuestionError,
  parseMixedActionExpression,
  type CompiledMixedAction,
  type MixedActionExpression,
  type MixedActionExpressionLimits,
} from '../game/mixed-action-question';
import { parseMovementClaim, type MovementClaim } from '../game/movement-promises';
import type { TruthAnswer, TruthFact } from '../game/truthtrance';

type Expression = MixedActionExpression<MovementClaim>;
type Compiled = CompiledMixedAction<MovementClaim>;
const fact = (value = 5): Expression => ({
  kind: 'fact', fact: { kind: 'spice', compare: 'gte', value },
});
const action = (territory = 'carthag', minimum = 3): Expression => ({
  kind: 'action', action: { territory, minimum },
});
const group = (kind: 'and' | 'or', ...terms: Expression[]): Expression => ({ kind, terms });

// Fixtures isolate the shared budget; the caller retains the authoritative fact decoder.
const decodeFact = (input: unknown): TruthFact => structuredClone(input) as TruthFact;
const decodeAction = (input: unknown): MovementClaim => {
  assert(input && typeof input === 'object' && !Array.isArray(input));
  assert.equal(Object.keys(input).sort().join(','), 'minimum,territory');
  return parseMovementClaim(input);
};
const decode = (input: unknown, limits?: MixedActionExpressionLimits): Expression =>
  parseMixedActionExpression(input, decodeFact, decodeAction, limits);
const compile = (input: Expression, factAnswer: TruthAnswer, answer = true): Compiled =>
  compileMixedActionExpression(input, () => factAnswer, answer);
const compiledAction = (territory = 'carthag', minimum = 3): Compiled => ({
  kind: 'action', action: { territory, minimum },
});
const constant = (value: boolean): Compiled => ({ kind: 'constant', value });

function evaluate(compiled: Compiled, values: Readonly<Record<string, boolean>>): boolean {
  if (compiled.kind === 'constant') return compiled.value;
  if (compiled.kind === 'action') return values[compiled.action.territory] ?? false;
  const terms = compiled.terms.map(term => evaluate(term, values));
  return compiled.kind === 'and' ? terms.every(Boolean) : terms.some(Boolean);
}

function assertPureResidual(compiled: Compiled): void {
  if (compiled.kind !== 'and' && compiled.kind !== 'or') return;
  assert(compiled.terms.length >= 2);
  for (const term of compiled.terms) {
    assert.notEqual(term.kind, 'constant');
    assertPureResidual(term);
  }
}

void test('mixed action parsing requires both families and preserves raw nested grouping', () => {
  const original = group('and', fact(), group('or', action(), action('arrakeen', 2)));
  const parsed = decode(original);
  assert.deepEqual(parsed, original);
  assert.notEqual(parsed, original);
  if ('terms' in parsed && 'terms' in original) {
    assert.notEqual(parsed.terms, original.terms);
    assert.notEqual(parsed.terms[0], original.terms[0]);
  }
  for (const input of [fact(), action(), group('and', fact(), fact(10)),
    group('or', action(), action('arrakeen'))])
    assert.throws(() => decode(input), MixedActionQuestionError);
});

void test('mixed action public parsing rejects frozen constants, metadata and malformed groups everywhere', () => {
  const invalid: unknown[] = [null, [], {}, { kind: 'and', terms: [] },
    { kind: 'or', terms: [fact()] }, { kind: 'xor', terms: [fact(), action()] },
    { kind: 'and', terms: [fact(), action()], answer: true },
    { ...fact(), value: true }, { ...action(), target: 'player' },
    { kind: 'constant', value: true }, { constant: 'no' },
    { kind: 'fact', fact: { kind: 'spice', compare: 'gte', value: 5 }, constant: 'yes' },
    { kind: 'action', action: { territory: 'carthag', minimum: 3 }, turn: 1 }];
  for (const input of invalid) {
    assert.throws(() => decode(input), MixedActionQuestionError);
    assert.throws(() => decode(group('or', fact(), action(), input as Expression)));
  }
  for (const input of [{ territory: 'carthag', minimum: 3, target: 'player' },
    { territory: 'carthag', minimum: 3, turn: 1 },
    { kind: 'constant', value: true },
    { kind: 'and', terms: [{ territory: 'carthag', minimum: 3 }] }])
    assert.throws(() => decode(group('and', fact(), { kind: 'action', action: input } as Expression)));
});

void test('decisive current-fact siblings cannot hide invalid action or fact subtrees', () => {
  const forbidden = new Error('This fact is unavailable.');
  for (const kind of ['and', 'or'] as const) {
    for (const reverse of [false, true]) {
      const invalid = action('missing', 3);
      const terms = reverse ? [invalid, fact()] : [fact(), invalid];
      assert.throws(() => decode(group(kind, ...terms)));
      const input = group(kind, fact(), action(), fact(10));
      assert.throws(() => parseMixedActionExpression(input, value => {
        const decoded = decodeFact(value);
        if (decoded.kind === 'spice' && decoded.value === 10) throw forbidden;
        return decoded;
      }, decodeAction), error => error === forbidden);
    }
  }
  const badAction = new Error('This action is unavailable.');
  assert.throws(() => parseMixedActionExpression(group('or', fact(), action()), decodeFact,
    () => { throw badAction; }), error => error === badAction);
});

void test('one sixteen-leaf budget includes every nested TruthFact leaf rather than wrappers or groups', () => {
  assert.doesNotThrow(() => decode(group('and',
    ...Array.from({ length: 15 }, () => fact()), action())));
  assert.throws(() => decode(group('and',
    ...Array.from({ length: 16 }, () => fact()), action())), MixedActionQuestionError);
  const embedded: Expression = { kind: 'fact', fact: {
    kind: 'or', terms: [
      { kind: 'spice', compare: 'gte', value: 5 },
      { kind: 'and', terms: [
        { kind: 'spice', compare: 'gte', value: 10 },
        { kind: 'spice', compare: 'gte', value: 15 },
      ] },
    ],
  } };
  assert.doesNotThrow(() => decode(group('or',
    ...Array.from({ length: 5 }, () => embedded), action())));
  assert.throws(() => decode(group('or',
    ...Array.from({ length: 5 }, () => embedded), fact(), action())), MixedActionQuestionError);
});

void test('one four-level budget includes nested current-fact AND/OR and supports explicit smaller limits', () => {
  const embedded: Expression = { kind: 'fact', fact: { kind: 'and', terms: [
    { kind: 'spice', compare: 'gte', value: 5 },
    { kind: 'spice', compare: 'gte', value: 10 },
  ] } };
  let nested: Expression = embedded;
  for (let depth = 0; depth < 3; depth++) nested = group('or', action(), nested);
  assert.doesNotThrow(() => decode(nested));
  assert.throws(() => decode(group('and', action(), nested)), MixedActionQuestionError);
  const simple = group('and', fact(), action());
  assert.deepEqual(decode(simple, { maxDepth: 1, maxLeaves: 2 }), simple);
  assert.throws(() => decode(simple, { maxDepth: 0 }), MixedActionQuestionError);
  assert.throws(() => decode(simple, { maxLeaves: 1 }), MixedActionQuestionError);
  assert.throws(() => decode(group('and', embedded, action()), { maxDepth: 1 }), MixedActionQuestionError);
  for (const limits of [{ maxDepth: -1 }, { maxDepth: 1.5 }, { maxLeaves: 0 },
    { maxLeaves: Infinity }, { maxLeaves: Number.MAX_SAFE_INTEGER + 1 }])
    assert.throws(() => decode(simple, limits), MixedActionQuestionError);
});

void test('known facts fold whole AND/OR questions independently of the selected Yes or No answer', () => {
  for (const answer of [false, true]) {
    assert.deepEqual(compile(group('and', fact(), action()), 'yes', answer), compiledAction());
    assert.deepEqual(compile(group('and', fact(), action()), 'no', answer), constant(false));
    assert.deepEqual(compile(group('or', fact(), action()), 'yes', answer), constant(true));
    assert.deepEqual(compile(group('or', fact(), action()), 'no', answer), compiledAction());
  }
});

void test('unknown facts conservatively constrain whole Yes and whole No for AND and OR', () => {
  for (const answer of [false, true]) {
    const and = compile(group('and', fact(), action()), 'unknown', answer);
    const or = compile(group('or', fact(), action()), 'unknown', answer);
    assert.deepEqual(and, answer ? constant(false) : compiledAction());
    assert.deepEqual(or, answer ? compiledAction() : constant(true));
    for (const actualFact of [false, true]) for (const actualAction of [false, true]) {
      // Any accepted residual guarantees the whole selected answer for either unknown outcome.
      if (evaluate(and, { carthag: actualAction }) === answer)
        assert.equal(actualFact && actualAction, answer);
      if (evaluate(or, { carthag: actualAction }) === answer)
        assert.equal(actualFact || actualAction, answer);
    }
  }
});

void test('nested unknown clauses keep every whole-No alternative without negating individual actions', () => {
  const asked = group('and', action(), group('or', fact(), action('arrakeen')));
  const compiled = compile(asked, 'unknown', false);
  assert.deepEqual(compiled, compiledAction());
  assert.equal(evaluate(compiled, { carthag: false, arrakeen: true }), false);
  assert.equal(evaluate(compiled, { carthag: true, arrakeen: false }), true);
  const alternate = compile(group('or', fact(), group('and', action(), action('arrakeen'))), 'no', false);
  assert.deepEqual(alternate, { kind: 'and', terms: [compiledAction(), compiledAction('arrakeen')] });
  assert.equal(evaluate(alternate, { carthag: true, arrakeen: false }), false);
  assert.equal(evaluate(alternate, { carthag: false, arrakeen: true }), false);
  assert.equal(evaluate(alternate, { carthag: true, arrakeen: true }), true);
});

void test('all facts are answered once before decisive folding, including later nested branches', () => {
  const asked = group('or', fact(1), group('and', fact(2), action()), fact(3));
  const seen: number[] = [];
  assert.deepEqual(compileMixedActionExpression(asked, current => {
    assert.equal(current.kind, 'spice');
    if (current.kind !== 'spice') throw new Error('Unexpected fact.');
    seen.push(current.value);
    return current.value === 1 ? 'yes' : 'no';
  }, true), constant(true));
  assert.deepEqual(seen, [1, 2, 3]);
  const invalidLater = new Error('Answer-time fact failure.');
  assert.throws(() => compileMixedActionExpression(asked, current => {
    if (current.kind === 'spice' && current.value === 3) throw invalidLater;
    return 'yes';
  }, true), error => error === invalidLater);
});

void test('snapshot compilation survives later current-fact changes and JSON without retaining callbacks', () => {
  let spice = 7;
  let calls = 0;
  const answerFact = (current: TruthFact): TruthAnswer => {
    calls++;
    assert.equal(current.kind, 'spice');
    return current.kind === 'spice' && spice >= current.value ? 'yes' : 'no';
  };
  const asked = decode(group('or', fact(), action()));
  const frozen = compileMixedActionExpression(asked, answerFact, true);
  assert.equal(calls, 1);
  spice = 0;
  assert.deepEqual(frozen, constant(true));
  assert.deepEqual(JSON.parse(JSON.stringify(frozen)) as Compiled, constant(true));
  assert.equal(calls, 1);
  assert.deepEqual(compileMixedActionExpression(asked, answerFact, true), compiledAction());
  assert.equal(calls, 2);
  const negative = compileMixedActionExpression(group('and', fact(), action()), answerFact, false);
  spice = 20;
  assert.deepEqual(negative, constant(false));
});

void test('folding removes all internal constants and singleton groups while retaining multi-action choices', () => {
  const asked = group('and', fact(1), group('or', fact(2), action(), action('arrakeen')),
    group('and', fact(3), action('polar_sink')));
  const compiled = compileMixedActionExpression(asked, current =>
    current.kind === 'spice' && current.value === 2 ? 'no' : 'yes', true);
  assert.deepEqual(compiled, { kind: 'and', terms: [
    { kind: 'or', terms: [compiledAction(), compiledAction('arrakeen')] },
    compiledAction('polar_sink'),
  ] });
  assertPureResidual(compiled);
  const entirelyKnown = group('or', group('and', fact(), fact()), group('and', fact(), action()));
  assert.deepEqual(compile(entirelyKnown, 'no'), constant(false));
  assert.deepEqual(compile(entirelyKnown, 'yes'), constant(true));
});

void test('public text retains every original clause after private folding and trees stay immutable', () => {
  const original = group('or', fact(5), group('and', action(), action('arrakeen', 2)));
  const snapshot = structuredClone(original);
  const freeze = (node: Expression): void => {
    if (node.kind === 'fact') Object.freeze(node.fact);
    else if (node.kind === 'action') Object.freeze(node.action);
    else { node.terms.forEach(freeze); Object.freeze(node.terms); }
    Object.freeze(node);
  };
  freeze(original);
  assert.deepEqual(decode(original), snapshot);
  assert.deepEqual(compile(original, 'yes'), constant(true));
  const text = mixedActionExpressionText(original,
    current => current.kind === 'spice' ? `have at least ${current.value} spice` : 'current fact',
    move => `move at least ${move.minimum} to ${move.territory}`);
  assert.equal(text, '(have at least 5 spice OR (move at least 3 to carthag AND move at least 2 to arrakeen))');
  assert.deepEqual(original, snapshot);
  assert.equal(text.includes('constant'), false);
});
