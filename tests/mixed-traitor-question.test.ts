import assert from 'node:assert/strict';
import test from 'node:test';
import {
  compileMixedActionExpression, mixedActionExpressionSize, MixedActionQuestionError,
  parseMixedActionExpression, type CompiledMixedAction, type MixedActionExpression,
} from '../game/mixed-action-question';
import {
  MIXED_TRAITOR_MAX_DEPTH, MIXED_TRAITOR_MAX_LEAVES, mixedTraitorRequirement,
  parseTraitorActionClaim, type MixedTraitorClaim, type TraitorActionClaim,
} from '../game/mixed-traitor-question';
import {
  bindTraitorDecisionPromise, TraitorDecisionError, traitorDecisionChoices,
  type TraitorDecisionContext,
} from '../game/traitor-decision-promises';
import type { TruthAnswer, TruthFact } from '../game/truthtrance';

type Expression = MixedActionExpression<TraitorActionClaim>;
type Compiled = CompiledMixedAction<TraitorActionClaim>;
const action = (call: boolean): Expression & Compiled => ({ kind: 'action', action: { call } });
const fact = (value = 5): Expression => ({ kind: 'fact', fact: { kind: 'spice', compare: 'gte', value } });
const group = (kind: 'and' | 'or', ...terms: Expression[]): Expression => ({ kind, terms });
const compiledGroup = (kind: 'and' | 'or', ...terms: Compiled[]): Compiled => ({ kind, terms });
const constant = (value: boolean): Compiled => ({ kind: 'constant', value });
const parse = (input: unknown): Expression => parseMixedActionExpression(input,
  value => structuredClone(value) as TruthFact, parseTraitorActionClaim);
const context = (canReveal: boolean): TraitorDecisionContext => ({
  turn: 4, battle: 'battle-event-7', player: 'harkonnen', beneficiary: 'atreides',
  target: 'emperor', leader: 'aramsham', canReveal,
});

void test('strict Traitor leaves copy only the original native Reveal or Decline and metadata stays on the question', () => {
  for (const call of [false, true]) {
    const original = { call };
    const parsed = parseTraitorActionClaim(original);
    assert.deepEqual(parsed, original);
    assert.notEqual(parsed, original);
  }
  const claim: MixedTraitorClaim = {
    battle: 'battle-event-7', territory: 'arrakeen', mixed: group('and', fact(), action(true)),
  };
  assert.deepEqual(parse(claim.mixed), claim.mixed);
  assert.deepEqual(Object.keys(parseTraitorActionClaim({ call: false })), ['call']);
});

void test('strict Traitor leaves reject source, frozen values, wrappers, groups and malformed booleans even after decisive facts', () => {
  const invalid: unknown[] = [null, [], {}, true, { call: undefined }, { call: null },
    { call: 0 }, { call: 'false' }, { call: Object(false) },
    { call: true, battle: 'battle-event-7' }, { call: false, territory: 'arrakeen' },
    { call: true, target: 'emperor' }, { call: true, turn: 4 }, { call: true, leader: 'aramsham' },
    { call: true, event: 'private-link' }, { call: false, answer: true },
    { call: true, fulfilled: true }, { call: true, released: false }, { call: true, canReveal: true },
    { kind: 'constant', value: true }, { kind: 'fact', fact: { kind: 'spice', compare: 'gte', value: 5 } },
    { kind: 'action', action: { call: true } }, { kind: 'and', terms: [{ call: true }, { call: false }] },
    { kind: 'or', terms: [] }];
  for (const value of invalid) {
    assert.throws(() => parseTraitorActionClaim(value), TraitorDecisionError);
    for (const kind of ['and', 'or'] as const) assert.throws(() => parse(group(kind, fact(),
      { kind: 'action', action: value } as Expression)), TraitorDecisionError);
  }
});

void test('both whole answers retain exact truth tables through every nested AND or OR combination and constants', () => {
  const cases: { node: Compiled; decline: boolean; reveal: boolean }[] = [
    { node: constant(false), decline: false, reveal: false },
    { node: constant(true), decline: true, reveal: true },
    { node: action(false), decline: true, reveal: false },
    { node: action(true), decline: false, reveal: true },
  ];
  for (const outer of ['and', 'or'] as const) for (const inner of ['and', 'or'] as const) {
    for (const first of [false, true]) for (const second of [false, true]) for (const third of [false, true]) {
      const evaluate = (choice: boolean) => {
        const left = inner === 'and' ? choice === first && choice === second : choice === first || choice === second;
        return outer === 'and' ? left && choice === third : left || choice === third;
      };
      cases.push({ node: compiledGroup(outer, compiledGroup(inner, action(first), action(second)), action(third)),
        decline: evaluate(false), reveal: evaluate(true) });
    }
  }
  for (const { node, decline, reveal } of cases) for (const answer of [false, true]) {
    const expected = decline !== answer && reveal !== answer ? { possible: false }
      : { possible: true, call: decline === answer && reveal === answer ? null : reveal === answer };
    assert.deepEqual(mixedTraitorRequirement(node, answer), expected, JSON.stringify({ node, answer }));
  }
  assert.throws(() => mixedTraitorRequirement(action(true), 'yes' as unknown as boolean), TraitorDecisionError);
});

void test('opposite-call correlations use both logical choices while a forced Decline remains binding after native eligibility changes', () => {
  const tautology = compiledGroup('or', action(true), action(false));
  const contradiction = compiledGroup('and', action(true), action(false));
  assert.deepEqual(mixedTraitorRequirement(tautology, true), { possible: true, call: null });
  assert.deepEqual(mixedTraitorRequirement(tautology, false), { possible: false });
  assert.deepEqual(mixedTraitorRequirement(contradiction, false), { possible: true, call: null });
  assert.deepEqual(mixedTraitorRequirement(contradiction, true), { possible: false });
  assert.deepEqual(traitorDecisionChoices(context(false), []), [false]);
  const required = mixedTraitorRequirement(compiledGroup('and', constant(true), action(false)), true);
  assert.deepEqual(required, { possible: true, call: false });
  assert(required.possible && required.call !== null);
  const promises = bindTraitorDecisionPromise(context(false), [], 'beneGesserit', required.call);
  assert.deepEqual(traitorDecisionChoices(context(false), promises), [false]);
  assert.deepEqual(traitorDecisionChoices(context(true), promises), [false], 'A later matching card cannot erase the original Decline');
  assert.deepEqual(mixedTraitorRequirement(action(true), true), { possible: true, call: true },
    'Current native eligibility remains the caller’s separate intersection');
});

void test('compilation snapshots every current fact before exact native reduction without mutating the public or compiled trees', () => {
  const mixed = group('and', group('or', fact(5), action(false)), group('or', fact(9), action(true)));
  const before = structuredClone(mixed), reads: number[] = [];
  const residual = compileMixedActionExpression(mixed, current => {
    assert(current.kind === 'spice');
    reads.push(current.value);
    return current.value === 5 ? 'yes' : 'no';
  }, true);
  assert.deepEqual(reads, [5, 9]);
  assert.deepEqual(residual, action(true));
  const frozen = structuredClone(residual);
  assert.deepEqual(mixedTraitorRequirement(residual, true), { possible: true, call: true });
  assert.deepEqual(mixedTraitorRequirement(residual, false), { possible: true, call: false });
  assert.deepEqual(mixed, before);
  assert.deepEqual(residual, frozen);
  const decisiveReads: number[] = [];
  const decisive = compileMixedActionExpression(group('or', fact(5), group('and', fact(9), action(false))), current => {
    assert(current.kind === 'spice'); decisiveReads.push(current.value); return 'yes';
  }, true);
  assert.deepEqual(decisiveReads, [5, 9]);
  assert.deepEqual(mixedTraitorRequirement(decisive, true), { possible: true, call: null });
});

void test('unknown facts keep the conservative false-for-Yes or true-for-No snapshot without guessing their correlations', () => {
  for (const answer of [false, true]) for (const call of [false, true]) for (const kind of ['and', 'or'] as const) {
    const raw = group(kind, fact(), action(call));
    const before = structuredClone(raw);
    const snapshots: TruthAnswer[] = [];
    const compiled = compileMixedActionExpression(raw, () => { snapshots.push('unknown'); return 'unknown'; }, answer);
    const permitsAction = answer ? kind === 'or' : kind === 'and';
    assert.deepEqual(mixedTraitorRequirement(compiled, answer), permitsAction
      ? { possible: true, call: answer ? call : !call } : { possible: false });
    assert.deepEqual(snapshots, ['unknown']);
    assert.deepEqual(raw, before);
  }
});

void test('mixed Traitor questions retain the generic sixteen-leaf and depth-four budgets including embedded fact groups', () => {
  assert.equal(MIXED_TRAITOR_MAX_LEAVES, 16);
  assert.equal(MIXED_TRAITOR_MAX_DEPTH, 4);
  const atLeaves = group('and', fact(), ...Array.from({ length: 15 }, () => action(true)));
  assert.deepEqual(parse(atLeaves), atLeaves);
  assert.equal(mixedActionExpressionSize(atLeaves).leaves, 16);
  assert.throws(() => parse(group('and', atLeaves, action(false))), MixedActionQuestionError);
  const embedded: Expression = { kind: 'fact', fact: { kind: 'or', terms:
    Array.from({ length: 15 }, () => ({ kind: 'spice', compare: 'gte', value: 5 })),
  } };
  assert.deepEqual(parse(group('or', embedded, action(false))), group('or', embedded, action(false)));
  assert.throws(() => parse(group('and', embedded, action(false), action(true))), MixedActionQuestionError);
  let atDepth = group('and', fact(), action(true));
  for (let depth = 1; depth < 4; depth++) atDepth = group('or', action(false), atDepth);
  assert.equal(mixedActionExpressionSize(atDepth).depth, 4);
  assert.deepEqual(parse(atDepth), atDepth);
  assert.throws(() => parse(group('and', action(true), atDepth)), MixedActionQuestionError);
});
