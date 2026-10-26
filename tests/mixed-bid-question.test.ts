import assert from 'node:assert/strict';
import test from 'node:test';
import { mixedBidMinimum, parseBidActionClaim, type BidActionClaim } from '../game/mixed-bid-question';
import { compileMixedActionExpression, type CompiledMixedAction, type MixedActionExpression } from '../game/mixed-action-question';
import type { TruthFact } from '../game/truthtrance';

type Compiled = CompiledMixedAction<BidActionClaim>;
const bid = (minimum: number): Compiled => ({ kind: 'action', action: { minimum } });
const group = (kind: 'and' | 'or', ...terms: Compiled[]): Compiled => ({ kind, terms });
function evaluate(node: Compiled, maximum: number): boolean {
  if (node.kind === 'constant') return node.value;
  if (node.kind === 'action') return maximum >= node.action.minimum;
  return node.kind === 'and' ? node.terms.every(term => evaluate(term, maximum)) : node.terms.some(term => evaluate(term, maximum));
}
void test('strict bid leaves reject metadata and unsafe thresholds while retaining uncapped exact whole amounts', () => {
  for (const minimum of [1, 4, 11, Number.MAX_SAFE_INTEGER]) assert.deepEqual(parseBidActionClaim({ minimum }), { minimum });
  for (const value of [null, [], {}, { minimum: 0 }, { minimum: -1 }, { minimum: 1.5 }, { minimum: NaN },
    { minimum: Infinity }, { minimum: Number.MAX_SAFE_INTEGER + 1 }, { minimum: '4' },
    { minimum: 4, lot: 1 }, { minimum: 4, turn: 1 }, { minimum: 4, amount: 4 }]) assert.throws(() => parseBidActionClaim(value));
});
void test('same-lot reduction preserves every compound Yes and whole No over actual future declaration maxima', () => {
  const trees = [group('and', bid(4), bid(7)), group('or', bid(4), bid(7)),
    group('and', group('or', bid(3), bid(8)), group('or', bid(6), bid(9))),
    group('or', group('and', bid(3), bid(8)), group('and', bid(6), bid(9)))];
  for (const tree of trees) for (const bids of [[], [1], [3, 5], [2, 6, 8], [4, 7, 10], [11]]) {
    const maximum = Math.max(0, ...bids), expected = evaluate(tree, maximum), actual = maximum >= mixedBidMinimum(tree);
    assert.equal(actual, expected); assert.equal(!actual, !expected);
  }
});
void test('compound thresholds never sum bids or imply a purchase or extra opportunity', () => {
  const both = group('and', bid(4), bid(7));
  assert.equal(mixedBidMinimum(both), 7); assert.equal(evaluate(both, Math.max(3, 4)), false);
  assert.equal(evaluate(both, 7), true); assert.equal(evaluate(group('or', bid(4), bid(7)), 4), true);
  assert.equal(mixedBidMinimum(group('or', bid(Number.MAX_SAFE_INTEGER), bid(11))), 11);
});
void test('frozen facts determine only the necessary exact native bid obligation', () => {
  const fact: TruthFact = { kind: 'spice', compare: 'gte', value: 10 };
  const mixed: MixedActionExpression<BidActionClaim> = { kind: 'and', terms: [
    { kind: 'fact', fact }, { kind: 'or', terms: [{ kind: 'action', action: { minimum: 4 } }, { kind: 'action', action: { minimum: 7 } }] },
  ] };
  const residual = compileMixedActionExpression(mixed, () => 'yes', true); assert.equal(mixedBidMinimum(residual), 4);
  assert.deepEqual(compileMixedActionExpression(mixed, () => 'no', false), { kind: 'constant', value: false });
  const raw = structuredClone(mixed); mixedBidMinimum(residual); assert.deepEqual(mixed, raw);
});
void test('unknown fact compilation keeps the conservative exact bid constraint for each definite answer', () => {
  const fact: TruthFact = { kind: 'stormForecast', compare: 'gte', value: 1 };
  for (const answer of [true, false]) {
    const mixed: MixedActionExpression<BidActionClaim> = { kind: answer ? 'or' : 'and', terms: [
      { kind: 'fact', fact }, { kind: 'action', action: { minimum: 4 } },
    ] };
    assert.equal(mixedBidMinimum(compileMixedActionExpression(mixed, () => 'unknown', answer)), 4);
  }
});
void test('constant or empty groups cannot masquerade as a native threshold', () => {
  for (const node of [{ kind: 'constant', value: true }, { kind: 'constant', value: false },
    { kind: 'and', terms: [] }, { kind: 'or', terms: [] }] as Compiled[]) assert.throws(() => mixedBidMinimum(node));
});
