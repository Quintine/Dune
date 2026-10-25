import assert from 'node:assert/strict';
import test from 'node:test';
import type { TruthFact } from '../game/truthtrance';
import {
  truthFactExpressionError as error, truthFactExpressionSize as size,
  TRUTH_FACT_MAX_NODES, TRUTH_FACT_MAX_DEPTH, TRUTH_FACT_MAX_TERMS,
  TRUTH_FACT_SIZE_ERROR, TRUTH_FACT_GROUP_ERROR,
} from '../game/truth-fact-expression';

const leaf = (): TruthFact => ({ kind: 'hand', name: 'Shield' });
const group = (kind: 'and' | 'or', count: number): TruthFact =>
  ({ kind, terms: Array.from({ length: count }, leaf) });

void test('fact structure counts group containers and retains every clause without mutation', () => {
  const fact: TruthFact = { kind: 'or', terms: [group('and', 3), group('or', 8)] };
  const before = structuredClone(fact);
  assert.deepEqual(size(fact), { nodes: 14, depth: 2 });
  assert.equal(error(fact), null);
  assert.deepEqual(fact, before);
  assert.deepEqual(size(leaf()), { nodes: 1, depth: 0 });
  assert.equal(error(leaf()), null);
});

void test('standalone AND and OR retain the existing two-through-eight term envelope', () => {
  for (const kind of ['and', 'or'] as const) {
    for (const count of [2, 3, 8]) assert.equal(error(group(kind, count)), null);
    for (const count of [0, 1, 9]) assert.equal(error(group(kind, count)), TRUTH_FACT_GROUP_ERROR);
  }
  assert.equal(TRUTH_FACT_MAX_TERMS, 8);
});

void test('nested fact editing shares the parser total-node and depth boundaries', () => {
  const maximum: TruthFact = { kind: 'and', terms: [group('and', 8), group('or', 5)] };
  assert.deepEqual(size(maximum), { nodes: TRUTH_FACT_MAX_NODES, depth: 2 });
  assert.equal(error(maximum), null);
  assert.equal(error({ kind: 'and', terms: [group('and', 8), group('or', 6)] }), TRUTH_FACT_SIZE_ERROR);
  let nested = leaf();
  for (let depth = 1; depth <= TRUTH_FACT_MAX_DEPTH + 1; depth++) {
    nested = { kind: depth % 2 ? 'and' : 'or', terms: [nested, leaf()] };
    assert.equal(size(nested).depth, depth);
    assert.equal(error(nested), depth <= TRUTH_FACT_MAX_DEPTH ? null : TRUTH_FACT_SIZE_ERROR);
  }
});

void test('structural validation does not replace entitled leaf eligibility checks', () => {
  const malformedGroup: TruthFact = { kind: 'or', terms: [leaf(), group('and', 1)] };
  assert.equal(error(malformedGroup), TRUTH_FACT_GROUP_ERROR);
  const invalidLeaf: TruthFact = { kind: 'and', terms: [leaf(), leaf(), { kind: 'spice', compare: 'gte', value: -1 }] };
  assert.equal(error(invalidLeaf), null, 'The common leaf validator owns numeric and target-specific eligibility');
});
