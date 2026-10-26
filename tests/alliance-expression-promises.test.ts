import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ALLIANCE_EXPRESSION_MAX_DEPTH, ALLIANCE_EXPRESSION_MAX_LEAVES,
  AllianceExpressionPromiseError, allianceExpressionOutcomes, allianceExpressionPromisesMatch,
  allianceExpressionText, evaluateAllianceExpression, findAllianceExpressionPlans,
  liveAllianceExpressionPromises, parseAllianceExpression, parseAllianceExpressionClaim,
  validateAllianceExpressionPromises, type AllianceAction, type AllianceExpression,
  type AllianceExpressionContext, type AllianceExpressionPromise,
} from '../game/alliance-expression-promises';
import { findAlliancePromisePlan, type AllianceOpportunity, type AlliancePromise } from '../game/alliance-promises';
import { quoteNexusAlliance } from '../game/nexus-alliance';

const seats = ['respondent', 'partner-a', 'partner-b', 'partner-c', 'asker'];
const opportunity = (): AllianceOpportunity => ({ turn: 2, source: 'original-worm-nexus' });
const leaf = (partner: string): AllianceExpression => ({ kind: 'partner', partner });
const group = (kind: 'and' | 'or', ...terms: AllianceExpression[]): AllianceExpression => ({ kind, terms });
const either = () => group('or', leaf('partner-a'), leaf('partner-b'));
function promise(event: string, claim = either(), extra: Partial<AllianceExpressionPromise> = {}): AllianceExpressionPromise {
  return { event, turn: 2, source: 'original-worm-nexus', player: 'respondent', asker: 'asker', claim, answer: true, ...extra };
}
function scalar(event: string, partner: string, answer: boolean): AlliancePromise {
  return { event, turn: 2, source: 'original-worm-nexus', player: 'respondent', asker: 'asker', partner, answer };
}
function context(): AllianceExpressionContext {
  return { players: seats.map(id => ({ id, ally: null })), offers: {} };
}
function action(state: AllianceExpressionContext, actor: string, target: string | null): AllianceExpressionContext {
  const quoted = quoteNexusAlliance({ ...state, actor, target });
  return { players: state.players.map(seat => ({ ...seat, ally: quoted.allies[seat.id] })), offers: quoted.offers };
}
function invitations(): AllianceExpressionContext {
  return action(action(context(), 'partner-a', 'respondent'), 'partner-b', 'respondent');
}
function execute(state: AllianceExpressionContext, plan: AllianceAction[]): AllianceExpressionContext {
  return plan.reduce((current, step) => action(current, 'respondent', step.target), state);
}
const finalAlly = (state: AllianceExpressionContext) => state.players.find(seat => seat.id === 'respondent')!.ally;
function freeze(value: unknown): void {
  if (!value || typeof value !== 'object') return;
  for (const child of Object.values(value as Record<string, unknown>)) freeze(child);
  Object.freeze(value);
}

void test('alliance expression claims retain full nesting and exact public partner text without private metadata', () => {
  const claim = { turn: 2, claim: group('and', either(), leaf('partner-a')) };
  const parsed = parseAllianceExpressionClaim(claim);
  assert.deepEqual(parsed, claim); assert.notEqual(parsed.claim, claim.claim);
  assert.equal(allianceExpressionText(parsed.claim, id => id === 'partner-a' ? 'Atreides' : 'Emperor'),
    '((be allied with Atreides when this Nexus ends OR be allied with Emperor when this Nexus ends) AND be allied with Atreides when this Nexus ends)');
  for (const turn of [0, -1, 1.5, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1, '2', null])
    assert.throws(() => parseAllianceExpressionClaim({ ...claim, turn }), AllianceExpressionPromiseError);
  for (const extra of [{ source: 'private-source' }, { event: 'private-event' }, { answer: true }])
    assert.throws(() => parseAllianceExpressionClaim({ ...claim, ...extra }), AllianceExpressionPromiseError);
});

void test('full alliance parsing enforces all branches, two-child groups, sixteen leaves and four grouping levels', () => {
  assert.equal(ALLIANCE_EXPRESSION_MAX_LEAVES, 16); assert.equal(ALLIANCE_EXPRESSION_MAX_DEPTH, 4);
  const nested = (depth: number): AllianceExpression => depth === 0 ? leaf('partner-a') :
    group('and', nested(depth - 1), leaf('partner-b'));
  assert.deepEqual(parseAllianceExpression(nested(4)), nested(4));
  assert.deepEqual(parseAllianceExpression(group('or', ...Array.from({ length: 16 }, () => leaf('partner-a')))),
    group('or', ...Array.from({ length: 16 }, () => leaf('partner-a'))));
  const invalid: unknown[] = [null, [], {}, { kind: 'partner', partner: '' }, { kind: 'partner', partner: ' partner-a' },
    { kind: 'partner', partner: 'partner-a ' }, { kind: 'partner', partner: null },
    { kind: 'partner', partner: 'partner-a', source: 'private' }, { kind: 'and', terms: [] },
    { kind: 'or', terms: [leaf('partner-a')] }, { kind: 'not', terms: [leaf('partner-a'), leaf('partner-b')] },
    { kind: 'or', terms: [leaf('partner-a'), { kind: 'partner', partner: 2 }] },
    group('or', ...Array.from({ length: 17 }, () => leaf('partner-a'))), nested(5),
    group('and', ...Array.from({ length: 9 }, () => either()))];
  for (const value of invalid) assert.throws(() => parseAllianceExpression(value), AllianceExpressionPromiseError);
  const hiddenInvalid = { kind: 'or', terms: [leaf('partner-a'), { kind: 'partner', partner: '' }] } as AllianceExpression;
  assert.throws(() => evaluateAllianceExpression(hiddenInvalid, 'partner-a'), AllianceExpressionPromiseError);
});

void test('positive final truth uses one native partner and a whole No negates the whole nested question', () => {
  const both = group('and', leaf('partner-a'), leaf('partner-b'));
  for (const ally of [null, 'partner-a', 'partner-b', 'partner-c']) {
    assert.equal(evaluateAllianceExpression(both, ally), false);
    assert.equal(allianceExpressionPromisesMatch([promise('no-both', both, { answer: false })], 'respondent', opportunity(), ally), true);
    assert.equal(evaluateAllianceExpression(either(), ally), ally === 'partner-a' || ally === 'partner-b');
  }
  const nested = group('and', either(), group('or', leaf('partner-b'), leaf('partner-c')));
  assert.equal(evaluateAllianceExpression(nested, 'partner-a'), false);
  assert.equal(evaluateAllianceExpression(nested, 'partner-b'), true);
  assert.equal(evaluateAllianceExpression(group('and', leaf('partner-a'), leaf('partner-a')), 'partner-a'), true);
});

void test('truth-compatible outcomes keep current membership first and intersect scalar and whole answers', () => {
  const state = action(invitations(), 'respondent', 'partner-b');
  const records = [promise('either')];
  assert.deepEqual(allianceExpressionOutcomes([], records, 'respondent', opportunity(), state), ['partner-b', 'partner-a']);
  assert.deepEqual(allianceExpressionOutcomes([scalar('no-b', 'partner-b', false)], records, 'respondent', opportunity(), state), ['partner-a']);
  assert.deepEqual(allianceExpressionOutcomes([], [promise('whole-no', either(), { answer: false })],
    'respondent', opportunity(), context()), [null, 'partner-c', 'asker']);
  assert.deepEqual(allianceExpressionOutcomes([], records, 'absent', opportunity(), state), []);
});

void test('two actual incoming invitations produce both canonical owned OR routes and leave manual alternatives available', () => {
  const state = invitations(); const records = [promise('either')];
  const plans = findAllianceExpressionPlans([], records, 'respondent', opportunity(), state);
  assert.deepEqual(plans, [[{ type: 'alliance', target: 'partner-a' }], [{ type: 'alliance', target: 'partner-b' }]]);
  for (const plan of plans) {
    const completed = execute(state, plan);
    assert.equal(allianceExpressionPromisesMatch(records, 'respondent', opportunity(), finalAlly(completed)), true);
    const selected = finalAlly(completed)!;
    assert.equal(completed.players.find(seat => seat.id === selected)!.ally, 'respondent');
  }
  const manual = action(state, 'respondent', 'partner-b');
  assert.equal(finalAlly(manual), 'partner-b');
  assert.equal(allianceExpressionPromisesMatch(records, 'respondent', opportunity(), finalAlly(manual)), true);
  assert.equal(records[0].fulfilled, undefined, 'No branch is stored or fulfilled before actual Nexus close');
});

void test('missing, own, withdrawn or occupied-partner offers cannot invent foreign consent', () => {
  const records = [promise('either')];
  assert.deepEqual(findAllianceExpressionPlans([], records, 'respondent', opportunity(), context()), []);
  const ownOffer = action(context(), 'respondent', 'partner-a');
  assert.deepEqual(findAllianceExpressionPlans([], records, 'respondent', opportunity(), ownOffer), []);
  const oneWithdrawn = action(invitations(), 'partner-a', null);
  assert.deepEqual(findAllianceExpressionPlans([], records, 'respondent', opportunity(), oneWithdrawn),
    [[{ type: 'alliance', target: 'partner-b' }]]);
  const bothWithdrawn = action(oneWithdrawn, 'partner-b', null);
  assert.deepEqual(findAllianceExpressionPlans([], records, 'respondent', opportunity(), bothWithdrawn), []);
  const occupied = action(action(action(context(), 'partner-a', 'respondent'), 'partner-c', 'partner-a'), 'partner-a', 'partner-c');
  assert.deepEqual(findAllianceExpressionPlans([], records, 'respondent', opportunity(), occupied), []);
});

void test('whole OR No can require exactly None while allowing an interim pair until the owned break', () => {
  const anyPartner = group('or', ...seats.filter(id => id !== 'respondent').map(leaf));
  const records = [promise('no-one', anyPartner, { answer: false })];
  const paired = action(invitations(), 'respondent', 'partner-a');
  assert.equal(allianceExpressionPromisesMatch(records, 'respondent', opportunity(), finalAlly(paired)), false);
  assert.deepEqual(allianceExpressionOutcomes([], records, 'respondent', opportunity(), paired), [null]);
  const plans = findAllianceExpressionPlans([], records, 'respondent', opportunity(), paired);
  assert.deepEqual(plans, [[{ type: 'alliance', target: null }]]);
  assert.equal(allianceExpressionPromisesMatch(records, 'respondent', opportunity(), finalAlly(execute(paired, plans[0]))), true);
  assert.equal(records[0].fulfilled, undefined); assert.equal(records[0].released, undefined);
});

void test('whole AND No retains a matching held pair and all other currently owned final routes', () => {
  const state = action(invitations(), 'respondent', 'partner-a');
  const records = [promise('not-both', group('and', leaf('partner-a'), leaf('partner-b')), { answer: false })];
  const plans = findAllianceExpressionPlans([], records, 'respondent', opportunity(), state);
  assert.deepEqual(plans, [[], [{ type: 'alliance', target: null }],
    [{ type: 'alliance', target: null }, { type: 'alliance', target: 'partner-b' }]]);
  assert.deepEqual(allianceExpressionOutcomes([], records, 'respondent', opportunity(), state),
    ['partner-a', null, 'partner-b', 'partner-c', 'asker']);
  for (const plan of plans) assert.equal(allianceExpressionPromisesMatch(records, 'respondent', opportunity(), finalAlly(execute(state, plan))), true);
});

void test('joint scalar and whole-expression contradictions have no outcome or invented branch', () => {
  const state = invitations();
  const cases = [
    { scalars: [scalar('yes-a', 'partner-a', true)], expressions: [promise('no-either', either(), { answer: false })] },
    { scalars: [scalar('no-a', 'partner-a', false)], expressions: [promise('yes-a-twice', group('and', leaf('partner-a'), leaf('partner-a')))] },
    { scalars: [], expressions: [promise('yes-both', group('and', leaf('partner-a'), leaf('partner-b')))] },
    { scalars: [], expressions: [promise('yes-either'), promise('no-either', either(), { answer: false })] },
  ];
  for (const selected of cases) {
    assert.deepEqual(allianceExpressionOutcomes(selected.scalars, selected.expressions, 'respondent', opportunity(), state), []);
    assert.deepEqual(findAllianceExpressionPlans(selected.scalars, selected.expressions, 'respondent', opportunity(), state), []);
  }
});

void test('no live expression preserves the original scalar planner exactly, including no-op and absent-owner behavior', () => {
  const old = [promise('old', either(), { source: 'older-nexus' }), promise('released', either(), { released: true })];
  for (const state of [context(), invitations(), action(invitations(), 'respondent', 'partner-a')])
    for (const records of [[], [scalar('yes-a', 'partner-a', true)], [scalar('no-a', 'partner-a', false)]]) {
      const expected = findAlliancePromisePlan(records, 'respondent', opportunity(), state);
      assert.deepEqual(findAllianceExpressionPlans(records, old, 'respondent', opportunity(), state), expected === null ? [] : [expected]);
    }
  assert.deepEqual(findAllianceExpressionPlans([], [], 'absent', opportunity(), context()), []);
});

void test('original turn, Nexus source, owner and terminal state isolate the live whole-expression records', () => {
  const live = promise('live');
  const records = [live, promise('old-turn', leaf('partner-c'), { turn: 1 }),
    promise('other-source', leaf('partner-c'), { source: 'other-worm-same-turn' }),
    promise('other-owner', leaf('partner-c'), { player: 'partner-a' }),
    promise('fulfilled', leaf('partner-c'), { fulfilled: true }), promise('released', leaf('partner-c'), { released: true })];
  assert.deepEqual(liveAllianceExpressionPromises(records, 'respondent', opportunity()), [live]);
  assert.equal(allianceExpressionPromisesMatch(records, 'respondent', opportunity(), 'partner-a'), true);
  assert.equal(allianceExpressionPromisesMatch(records, 'respondent', opportunity(), 'partner-c'), false);
  assert.deepEqual(findAllianceExpressionPlans([], records, 'respondent', opportunity(), invitations()),
    [[{ type: 'alliance', target: 'partner-a' }], [{ type: 'alliance', target: 'partner-b' }]]);
});

void test('expression records validate source, unique event, every personal partner and terminal flags without mutating inputs', () => {
  const records = [promise('live'), promise('done', leaf('partner-a'), { fulfilled: true }),
    promise('released-no', leaf('asker'), { answer: false, released: true })];
  const state = invitations(), scalars = [scalar('no-c', 'partner-c', false)];
  const before = structuredClone({ records, state, scalars });
  freeze(records); freeze(state); freeze(scalars);
  assert.doesNotThrow(() => validateAllianceExpressionPromises(records, seats));
  assert.doesNotThrow(() => validateAllianceExpressionPromises(JSON.parse(JSON.stringify(records)) as AllianceExpressionPromise[], seats));
  parseAllianceExpressionClaim({ turn: 2, claim: records[0].claim });
  allianceExpressionText(records[0].claim); evaluateAllianceExpression(records[0].claim, 'partner-a');
  allianceExpressionOutcomes(scalars, records, 'respondent', opportunity(), state);
  findAllianceExpressionPlans(scalars, records, 'respondent', opportunity(), state);
  assert.deepEqual({ records, state, scalars }, before);
  const base = promise('event');
  const invalid: unknown[] = [null, {}, [null], [base, { ...base }],
    ...[{ event: '' }, { event: ' event' }, { source: '' }, { source: ' source' },
      { player: 'missing' }, { asker: 'missing' }, { asker: 'respondent' }, { answer: 'yes' },
      { turn: 0 }, { fulfilled: 1 }, { released: 'true' }, { fulfilled: true, released: true },
      { claim: group('or', leaf('partner-a'), leaf('missing')) },
      { claim: group('or', leaf('partner-a'), leaf('respondent')) }].map(extra => [{ ...base, ...extra }])];
  for (const value of invalid)
    assert.throws(() => validateAllianceExpressionPromises(value as AllianceExpressionPromise[], seats), AllianceExpressionPromiseError);
  assert.deepEqual({ records, state, scalars }, before);
});
