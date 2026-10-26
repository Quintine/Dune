import assert from 'node:assert/strict';
import test from 'node:test';
import { PlanClaimError } from '../game/battle-promises';
import {
  MIXED_BATTLE_MAX_DEPTH, MIXED_BATTLE_MAX_LEAVES, MIXED_BATTLE_MAX_NODES,
  MIXED_BATTLE_MAX_TERMS, parseBattleActionClaim, type MixedBattleActionClaim,
  type MixedBattleClaim,
} from '../game/mixed-battle-question';
import {
  mixedActionExpressionSize, MixedActionQuestionError, parseMixedActionExpression,
  type MixedActionExpression,
} from '../game/mixed-action-question';
import { CHEAP_HERO_TRAITOR } from '../game/traitors';
import type { TruthFact } from '../game/truthtrance';

type Expression = MixedActionExpression<MixedBattleActionClaim>;
const leaders = ['atreides-paul', 'emperor-burseg'] as const;
const limits = {
  maxNodes: MIXED_BATTLE_MAX_NODES,
  maxTerms: MIXED_BATTLE_MAX_TERMS,
  maxDepth: MIXED_BATTLE_MAX_DEPTH,
  maxLeaves: MIXED_BATTLE_MAX_LEAVES,
};
const fact = (): Expression => ({ kind: 'fact', fact: { kind: 'spice', compare: 'gte', value: 5 } });
const action = (claim: MixedBattleActionClaim = { kind: 'dial', compare: 'gte', value: 2.5 }): Expression =>
  ({ kind: 'action', action: claim });
const group = (kind: 'and' | 'or', ...terms: Expression[]): Expression => ({ kind, terms });
const parse = (input: unknown): Expression => parseMixedActionExpression(input,
  value => structuredClone(value) as TruthFact, value => parseBattleActionClaim(value, leaders), limits);

void test('mixed battle leaves retain exact native types and current-battle metadata stays on the question', () => {
  const leaves: MixedBattleActionClaim[] = [
    { kind: 'dial', compare: 'gte', value: 2.5 },
    { kind: 'support', compare: 'lte', value: 3 },
    { kind: 'weapon', name: 'Gom Jabbar' },
    { kind: 'defense', name: 'Shield' },
    { kind: 'leader', leader: leaders[0] },
    { kind: 'kwisatz', use: true },
  ];
  for (const leaf of leaves) {
    const parsed = parseBattleActionClaim(leaf, leaders);
    assert.deepEqual(parsed, leaf);
    assert.notEqual(parsed, leaf);
  }
  const question: MixedBattleClaim = {
    battle: 'battle-event-7', territory: 'arrakeen', mixed: group('and', fact(), ...leaves.map(action)),
  };
  assert.deepEqual(parse(question.mixed), question.mixed);
  assert.deepEqual(leaders, ['atreides-paul', 'emperor-burseg']);
});

void test('mixed battle parsing rejects groups, wrappers, metadata, missing fields and unknown keys as action leaves', () => {
  const invalid: unknown[] = [null, [], {}, { kind: 'unknown' },
    { kind: 'and', terms: [{ kind: 'dial', compare: 'gte', value: 2 }, { kind: 'kwisatz', use: false }] },
    { kind: 'or', terms: [] }, { kind: 'constant', value: true },
    { kind: 'fact', fact: { kind: 'spice', compare: 'gte', value: 5 } },
    action(), { kind: 'dial', value: 2 }, { kind: 'support', compare: 'gte' },
    { kind: 'weapon' }, { kind: 'defense' }, { kind: 'leader' }, { kind: 'kwisatz' },
    { kind: 'dial', compare: 'gte', value: 2, battle: 'battle-event-7' },
    { kind: 'support', compare: 'eq', value: 2, territory: 'arrakeen' },
    { kind: 'weapon', name: 'Gom Jabbar', target: 'player-e' },
    { kind: 'defense', name: 'Shield', answer: true },
    { kind: 'leader', leader: leaders[0], turn: 1 }, { kind: 'kwisatz', use: true, frozen: true },
  ];
  for (const value of invalid) assert.throws(() => parseBattleActionClaim(value, leaders), PlanClaimError);
});

void test('mixed battle leaves reuse native half-dial, whole support, named-card, leader and Kwisatz bounds', () => {
  for (const kind of ['dial', 'support'] as const) for (const compare of ['eq', 'gte', 'lte'] as const)
    for (const value of kind === 'dial' ? [0, 0.5, 39.5, 40] : [0, 1, 39, 40])
      assert.deepEqual(parseBattleActionClaim({ kind, compare, value }, leaders), { kind, compare, value });
  for (const kind of ['weapon', 'defense'] as const)
    assert.deepEqual(parseBattleActionClaim({ kind, name: null }, leaders), { kind, name: null });
  for (const leader of [null, leaders[1], CHEAP_HERO_TRAITOR])
    assert.deepEqual(parseBattleActionClaim({ kind: 'leader', leader }, leaders), { kind: 'leader', leader });
  assert.deepEqual(parseBattleActionClaim({ kind: 'kwisatz', use: false }, leaders), { kind: 'kwisatz', use: false });
  const invalid: unknown[] = [
    ...[-0.5, 0.25, 40.5, NaN, Infinity, '2'].map(value => ({ kind: 'dial', compare: 'eq', value })),
    ...[-1, 0.5, 41, NaN, Infinity, '2'].map(value => ({ kind: 'support', compare: 'gte', value })),
    { kind: 'dial', compare: 'gt', value: 2 }, { kind: 'weapon', name: 'Unprinted Weapon' },
    { kind: 'defense', name: 1 }, { kind: 'leader', leader: 'unpublished-leader' },
    { kind: 'leader', leader: 1 }, { kind: 'kwisatz', use: 'yes' },
  ];
  for (const value of invalid) assert.throws(() => parseBattleActionClaim(value, leaders), PlanClaimError);
});

void test('a decisive earlier fact cannot hide an invalid late native battle leaf', () => {
  for (const kind of ['and', 'or'] as const) for (const invalid of [
    { kind: 'dial', compare: 'gte', value: 0.25 },
    { kind: 'weapon', name: 'Gom Jabbar', battle: 'forged-event' },
    { kind: 'and', terms: [{ kind: 'leader', leader: null }, { kind: 'kwisatz', use: false }] },
  ]) {
    const input = group(kind, fact(), group('or', action(), { kind: 'action', action: invalid } as Expression));
    assert.throws(() => parse(input), PlanClaimError);
  }
});

void test('mixed battle shares the native sixteen-node budget across facts, actions and all logical groups', () => {
  assert.deepEqual(limits, { maxNodes: 16, maxTerms: 8, maxDepth: 4, maxLeaves: 16 });
  const embedded = (length: number): Expression => ({ kind: 'fact', fact: { kind: 'or', terms:
    Array.from({ length }, () => ({ kind: 'spice', compare: 'gte', value: 5 })),
  } });
  const atLimit = group('and', embedded(7), ...Array.from({ length: 7 }, () => action()));
  assert.deepEqual(mixedActionExpressionSize(atLimit), { nodes: 16, leaves: 14, depth: 2, maxTerms: 8 });
  assert.deepEqual(parse(atLimit), atLimit);
  const overLimit = group('or', ...Array.from({ length: 7 }, () => action()), embedded(8));
  assert.equal(mixedActionExpressionSize(overLimit).leaves, 15);
  assert.throws(() => parse(overLimit), MixedActionQuestionError);
  let atDepthLimit = group('and', fact(), action());
  for (let depth = 1; depth < 4; depth++) atDepthLimit = group('or', action(), atDepthLimit);
  assert.deepEqual(parse(atDepthLimit), atDepthLimit);
  assert.throws(() => parse(group('and', action(), atDepthLimit)), MixedActionQuestionError);
});

void test('mixed battle applies the native eight-term limit to outer groups and every embedded fact group', () => {
  const eight = group('and', fact(), ...Array.from({ length: 7 }, () => action()));
  assert.deepEqual(parse(eight), eight);
  const wideFact: Expression = { kind: 'fact', fact: { kind: 'or', terms:
    Array.from({ length: 9 }, () => ({ kind: 'spice', compare: 'gte', value: 5 })),
  } };
  for (const input of [group('or', fact(), ...Array.from({ length: 8 }, () => action())),
    group('or', fact(), action(), wideFact)]) {
    assert(mixedActionExpressionSize(input).nodes < 16);
    assert.throws(() => parse(input), MixedActionQuestionError);
  }
});
