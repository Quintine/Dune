import assert from 'node:assert/strict';
import test from 'node:test';
import { compileMixedActionExpression, type MixedActionExpression } from '../game/mixed-action-question';
import {
  TurnActionError, closeTurnActionStormDial, finishTurnActionTurn, parseTurnActionLeaf,
  recordTurnActionStormDial, turnActionBranches, turnActionStormDialChoices, turnActionValue,
  validateTurnActionPromises, type TurnActionBranchLeaf, type TurnActionLeaf, type TurnActionPromise,
} from '../game/turn-action-promises';

const source = (turn = 2, player = 'dialer') => JSON.stringify(['stormDial', turn, player]);
const dial = (value: number, turn = 2): MixedActionExpression<TurnActionLeaf> =>
  ({ kind: 'action', action: { kind: 'stormDial', source: source(turn), value } });
const group = (kind: 'and' | 'or', ...terms: MixedActionExpression<TurnActionLeaf>[]): MixedActionExpression<TurnActionLeaf> =>
  ({ kind, terms });
function promise(mixed: MixedActionExpression<TurnActionLeaf>, answer = true, turn = 2): TurnActionPromise {
  return { turn, mixed, event: 'promise', player: 'dialer', asker: 'asker', answer,
    compiled: compileMixedActionExpression(mixed, () => 'yes', answer),
    shipment: { pending: false, event: null }, progress: [], payments: [], transportClosed: true,
    paymentClosed: false, fulfilled: false, released: false,
    stormDial: { source: source(turn), closed: false, actual: null } };
}
const branches = (row: TurnActionPromise) => [...turnActionBranches(row)];

void test('storm-dial leaves use a canonical original actor and the turn’s actual numeric bounds', () => {
  assert.deepEqual(parseTurnActionLeaf({ kind: 'stormDial', source: source(1), value: 0 }),
    { kind: 'stormDial', source: source(1), value: 0 });
  assert.deepEqual(parseTurnActionLeaf({ kind: 'stormDial', source: source(2), value: 3 }),
    { kind: 'stormDial', source: source(2), value: 3 });
  for (const claim of [
    { kind: 'stormDial', source: source(2), value: 0 },
    { kind: 'stormDial', source: source(2), value: 4 },
    { kind: 'stormDial', source: source(1), value: 21 },
    { kind: 'stormDial', source: 'not-json', value: 1 },
    { kind: 'stormDial', source: source(1), value: 1, privateValue: 2 },
  ]) assert.throws(() => parseTurnActionLeaf(claim), TurnActionError);
});

void test('boolean alternatives share exactly one dial and reject contradictory or exhausted ranges', () => {
  assert.deepEqual(branches(promise(group('and', dial(1), dial(2)))), []);
  assert.deepEqual(branches(promise(group('or', dial(1), dial(2), dial(3)), false)), []);
  const row = promise(group('and', dial(1), dial(2)), false);
  const alternatives = branches(row);
  assert.equal(alternatives.length, 2);
  for (const branch of alternatives) assert.ok(turnActionStormDialChoices(branch, source()).length > 0);
  const signed: TurnActionBranchLeaf[] = [
    { kind: 'stormDial', source: source(), value: 1, answer: true },
    { kind: 'stormDial', source: source(), value: 2, answer: false },
  ];
  assert.deepEqual(turnActionStormDialChoices(signed, source()), [1]);
  assert.deepEqual(turnActionStormDialChoices([...signed, { kind: 'stormDial', source: source(), value: 1, answer: false }], source()), []);
  assert.equal(turnActionStormDialChoices([], source(1)).length, 21);
});

void test('the native sealed value settles the whole answer and a No cannot be evaded', () => {
  const yes = promise(dial(2));
  const [satisfied] = recordTurnActionStormDial([yes], 'dialer', 2, source(), 2);
  assert.equal(satisfied.fulfilled, true);
  assert.deepEqual(satisfied.stormDial, { source: source(), closed: true, actual: 2 });
  assert.equal(turnActionValue(satisfied), true);
  const no = promise(dial(2), false);
  assert.throws(() => recordTurnActionStormDial([no], 'dialer', 2, source(), 2), TurnActionError);
  assert.equal(no.stormDial?.actual, null);
  const [satisfiedNo] = recordTurnActionStormDial([no], 'dialer', 2, source(), 1);
  assert.equal(satisfiedNo.fulfilled, true);
  assert.equal(turnActionValue(satisfiedNo), false);
  validateTurnActionPromises([satisfied, satisfiedNo].map((row, index) => ({ ...row, event: `event:${index}` })), ['dialer', 'asker']);
});

void test('a closed missing dial stays absent and an unsatisfied Yes releases only at actual turn expiry', () => {
  const [closedYes] = closeTurnActionStormDial([promise(dial(3))], 'dialer', 2, source());
  assert.equal(closedYes.stormDial?.actual, null);
  assert.equal(closedYes.fulfilled, false);
  assert.deepEqual(branches(closedYes), []);
  const [expired] = finishTurnActionTurn([closedYes], 'dialer', 2);
  assert.equal(expired.released, true);
  const [closedNo] = closeTurnActionStormDial([promise(dial(3), false)], 'dialer', 2, source());
  assert.equal(closedNo.fulfilled, true);
  assert.equal(closedNo.stormDial?.actual, null);
});

void test('stored stages bind original leaves to the respondent and preserve legacy promises', () => {
  const original = promise(dial(2));
  validateTurnActionPromises([JSON.parse(JSON.stringify(original))], ['dialer', 'asker']);
  const wrong = { ...original, stormDial: { source: source(2, 'asker'), closed: false, actual: null } };
  assert.throws(() => validateTurnActionPromises([wrong], ['dialer', 'asker']), TurnActionError);
  assert.throws(() => validateTurnActionPromises([{ ...original, stormDial: undefined }], ['dialer', 'asker']), TurnActionError);
  assert.throws(() => recordTurnActionStormDial([original], 'asker', 2, source(), 2), TurnActionError);
  const legacy = promise({ kind: 'action', action: { kind: 'payment', recipient: 'other', minimum: 1 } });
  delete legacy.stormDial;
  validateTurnActionPromises([legacy], ['dialer', 'asker', 'other']);
});
