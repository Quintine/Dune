import assert from 'node:assert/strict';
import test from 'node:test';
import { compileMixedActionExpression, type MixedActionExpression } from '../game/mixed-action-question';
import {
  finishTravelTurn,
  liveTravelPromises,
  parseTravelActionClaim,
  recordTravelMovement,
  recordTravelShipment,
  travelBranches,
  travelPromiseValue,
  TravelPromiseError,
  validateTravelPromises,
  type TravelActionClaim,
  type TravelBranchLeaf,
  type TravelPromise,
} from '../game/travel-expression-promises';

type Expression = MixedActionExpression<TravelActionClaim>;
const action = (kind: 'ship' | 'move', territory = 'carthag', minimum = 3): Expression => ({
  kind: 'action', action: { kind, territory, minimum },
});
const fact = (): Expression => ({ kind: 'fact', fact: { kind: 'spice', compare: 'gte', value: 5 } });
const group = (kind: 'and' | 'or', ...terms: Expression[]): Expression => ({ kind, terms });
const leaf = (kind: 'ship' | 'move', territory = 'carthag', minimum = 3, answer = true): TravelBranchLeaf =>
  ({ kind, territory, minimum, answer });
function promise(mixed: Expression, answer = true, event = 'travel:1'): TravelPromise {
  return {
    turn: 1, mixed, event, player: 'respondent', asker: 'asker', answer,
    compiled: compileMixedActionExpression(mixed, () => 'yes', answer),
    shipment: { pending: true, event: null }, progress: [], movementClosed: false,
    fulfilled: false, released: false,
  };
}
const event = (territory = 'carthag', amount = 3) => ({ territory, amount });

void test('travel action leaves use native destination/minimum validation and reject every extra field', () => {
  for (const kind of ['ship', 'move'] as const) {
    const original = { kind, territory: 'carthag', minimum: 3 };
    assert.deepEqual(parseTravelActionClaim(original), original);
    assert.notEqual(parseTravelActionClaim(original), original);
    for (const invalid of [null, [], {}, { ...original, kind: 'revive' },
      { ...original, minimum: 0 }, { ...original, minimum: 21 }, { ...original, minimum: 1.5 },
      { ...original, minimum: '3' }, { ...original, territory: 'not-a-territory' },
      { ...original, turn: 1 }, { ...original, answer: true }, { ...original, maximum: 3 },
      { ...original, claim: { territory: 'carthag', minimum: 3 } }])
      assert.throws(() => parseTravelActionClaim(invalid), TravelPromiseError);
  }
});

void test('whole Yes AND requires both native events while OR keeps either alternative available', () => {
  const and = promise(group('and', action('ship'), action('move', 'arrakeen', 2)));
  const or = promise(group('or', action('ship'), action('move', 'arrakeen', 2)));
  assert.deepEqual([...travelBranches(and)], [[leaf('ship'), leaf('move', 'arrakeen', 2)]]);
  assert.deepEqual([...travelBranches(or)], [[leaf('ship')], [leaf('move', 'arrakeen', 2)]]);
  const shipped = recordTravelShipment([and, or], 'respondent', 1, event());
  assert.equal(travelPromiseValue(shipped[0]), false);
  assert.equal(shipped[0].fulfilled, false);
  assert.equal(shipped[1].fulfilled, true);
  assert.deepEqual([...travelBranches(shipped[0])], [[leaf('move', 'arrakeen', 2)]]);
  const moved = recordTravelMovement(shipped, 'respondent', 1, event('arrakeen', 2));
  assert.equal(moved[0].fulfilled, true);
  assert.deepEqual([...travelBranches(moved[0])], [[]]);
  assert.equal(liveTravelPromises(moved, 'respondent', 1).length, 0);
  assert.equal(and.shipment.pending, true);
  assert.deepEqual(and.progress, []);
});

void test('whole No applies De Morgan and permits changing branches after a real action', () => {
  const andNo = promise(group('and', action('ship'), action('move', 'arrakeen', 2)), false);
  const orNo = promise(group('or', action('ship'), action('move', 'arrakeen', 2)), false);
  assert.deepEqual([...travelBranches(andNo)], [[leaf('ship', 'carthag', 3, false)],
    [leaf('move', 'arrakeen', 2, false)]]);
  assert.deepEqual([...travelBranches(orNo)], [[leaf('ship', 'carthag', 3, false),
    leaf('move', 'arrakeen', 2, false)]]);
  const shipped = recordTravelShipment([andNo], 'respondent', 1, event());
  assert.equal(shipped[0].fulfilled, false);
  assert.deepEqual([...travelBranches(shipped[0])], [[leaf('move', 'arrakeen', 2, false)]]);
  const before = structuredClone(shipped);
  assert.throws(() => recordTravelMovement(shipped, 'respondent', 1, event('arrakeen', 2)), TravelPromiseError);
  assert.deepEqual(shipped, before);
  assert.throws(() => recordTravelShipment([orNo], 'respondent', 1, event()), TravelPromiseError);
  const skipped = recordTravelShipment([andNo], 'respondent', 1, null);
  assert.ok([...travelBranches(skipped[0])].some(branch => branch.length === 0),
    'Skipping the shipment leaves an unrestricted completion, regardless of redundant narrower DNF branches');
  assert.doesNotThrow(() => recordTravelMovement(skipped, 'respondent', 1, event('arrakeen', 2)));
});

void test('nested branches keep all signed alternatives and remove impossible positive shipment conjunctions', () => {
  const asked = group('and', group('or', action('ship'), action('move')),
    group('or', action('ship', 'arrakeen', 2), action('move', 'arrakeen', 4)));
  const branches = [...travelBranches(promise(asked))];
  assert.deepEqual(branches, [
    [leaf('ship'), leaf('move', 'arrakeen', 4)],
    [leaf('move'), leaf('ship', 'arrakeen', 2)],
    [leaf('move'), leaf('move', 'arrakeen', 4)],
  ]);
  assert.deepEqual([...travelBranches(promise(group('and', action('ship'), action('ship', 'arrakeen'))))], []);
  const no = [...travelBranches(promise(asked, false))];
  assert.deepEqual(no, [
    [leaf('ship', 'carthag', 3, false), leaf('move', 'carthag', 3, false)],
    [leaf('ship', 'arrakeen', 2, false), leaf('move', 'arrakeen', 4, false)],
  ]);
});

void test('same-destination signed bounds keep strongest minimum or lowest negative cap', () => {
  const asked = group('and', action('move', 'carthag', 2), action('move', 'carthag', 5));
  assert.deepEqual([...travelBranches(promise(asked))], [[leaf('move', 'carthag', 5)]]);
  const negative = promise(group('or', action('move', 'carthag', 2), action('move', 'carthag', 5)), false);
  assert.deepEqual([...travelBranches(negative)], [[leaf('move', 'carthag', 2, false)]]);
  const atCap = recordTravelMovement([negative], 'respondent', 1, event('carthag', 1));
  assert.equal(atCap[0].progress[0].maximum, 1);
  assert.deepEqual([...travelBranches(atCap[0])], [[leaf('move', 'carthag', 2, false)]]);
  assert.throws(() => recordTravelMovement(atCap, 'respondent', 1, event('carthag', 2)), TravelPromiseError);
});

void test('shipment leaves share one event and later answers receive no earlier shipment or movement', () => {
  const expression = group('or', action('ship', 'carthag', 5), action('move', 'arrakeen', 5));
  const old = promise(expression);
  const shipped = recordTravelShipment([old], 'respondent', 1, event('carthag', 4));
  const moved = recordTravelMovement(shipped, 'respondent', 1, event('arrakeen', 4));
  const fresh = promise(expression, true, 'travel:2');
  fresh.shipment.pending = false;
  const otherPlayer = { ...promise(expression, true, 'travel:3'), player: 'other' };
  const otherTurn = { ...promise(expression, true, 'travel:4'), turn: 2 };
  const list = [moved[0], fresh, otherPlayer, otherTurn];
  const next = recordTravelMovement(list, 'respondent', 1, event('arrakeen', 3));
  assert.deepEqual(next[0].progress, [{ territory: 'arrakeen', maximum: 4 }]);
  assert.deepEqual(next[1].progress, [{ territory: 'arrakeen', maximum: 3 }]);
  assert.equal(next[2], otherPlayer);
  assert.equal(next[3], otherTurn);
  const repeatedShipment = recordTravelShipment(next, 'respondent', 1, event('carthag', 20));
  assert.equal(repeatedShipment[0].shipment.event?.amount, 4);
  assert.equal(repeatedShipment[1].shipment.event, null);
  assert.deepEqual([...travelBranches(repeatedShipment[1])], [[leaf('move', 'arrakeen', 5)]]);
});

void test('only the largest physical movement group counts and event updates are immutable', () => {
  const original = promise(action('move', 'carthag', 5));
  const once = recordTravelMovement([original], 'respondent', 1, event('carthag', 3));
  const twice = recordTravelMovement(once, 'respondent', 1, event('carthag', 3));
  assert.equal(travelPromiseValue(twice[0]), false);
  assert.equal(twice[0], once[0]);
  assert.equal(twice[0].progress[0].maximum, 3);
  assert.deepEqual(recordTravelMovement(twice, 'respondent', 1, event('carthag', 0)), twice);
  assert.equal(recordTravelMovement(twice, 'respondent', 1, event('arrakeen', 20))[0], twice[0]);
  const complete = recordTravelMovement(twice, 'respondent', 1, event('carthag', 5));
  assert.equal(complete[0].fulfilled, true);
  assert.deepEqual(original.progress, []);
  assert.equal(once[0].progress[0].maximum, 3);
});

void test('frozen known and unknown facts constrain only the whole selected answer', () => {
  for (const answer of [true, false]) {
    for (const factAnswer of ['yes', 'no', 'unknown'] as const) {
      for (const kind of ['and', 'or'] as const) {
        const mixed = group(kind, fact(), action('move'));
        const record = promise(mixed, answer);
        record.compiled = compileMixedActionExpression(mixed, () => factAnswer, answer);
        assert.deepEqual(record.mixed, mixed);
        if (record.compiled.kind === 'constant') {
          assert.equal(travelPromiseValue(record), record.compiled.value);
          assert.deepEqual([...travelBranches(record)], record.compiled.value === answer ? [[]] : []);
          if (record.compiled.value === answer) {
            record.fulfilled = true;
            validateTravelPromises([record], ['respondent', 'asker']);
          }
        } else {
          assert.deepEqual([...travelBranches(record)], [[leaf('move', 'carthag', 3, answer)]]);
        }
      }
    }
  }
});

void test('turn closure rejects unmet Yes, fulfills compatible No and folds every closed opportunity', () => {
  const yes = promise(group('or', action('ship'), action('move')));
  const before = structuredClone(yes);
  assert.throws(() => finishTravelTurn([yes], 'respondent', 1), TravelPromiseError);
  assert.deepEqual(yes, before);
  const no = promise(group('and', action('ship'), action('move')), false);
  const closed = finishTravelTurn([no], 'respondent', 1);
  assert.equal(closed[0].fulfilled, true);
  assert.equal(closed[0].movementClosed, true);
  assert.equal(closed[0].shipment.pending, false);
  validateTravelPromises(closed, ['respondent', 'asker']);
  assert.equal(recordTravelMovement(closed, 'respondent', 1, event())[0], closed[0]);
  const projectedClosed = { ...yes, movementClosed: true, shipment: { pending: false, event: null } };
  assert.deepEqual([...travelBranches(projectedClosed)], []);
  assert.deepEqual([...travelBranches({ ...projectedClosed, answer: false })], [[]]);
  const released = { ...yes, released: true };
  const finishedRelease = finishTravelTurn([released], 'respondent', 1)[0];
  assert.equal(finishedRelease.released, true);
  assert.equal(finishedRelease.fulfilled, false);
  assert.deepEqual([...travelBranches(finishedRelease)], [[]]);
});

void test('stored structure, whole-answer progress and strict native events reject malformed input', () => {
  const original = promise(group('and', action('ship'), action('move')));
  validateTravelPromises([original], ['respondent', 'asker']);
  const corruptions: unknown[] = [
    { ...original, turn: 0 }, { ...original, answer: 'yes' }, { ...original, fulfilled: undefined },
    { ...original, fulfilled: true, released: true },
    { ...original, shipment: { pending: true, event: event() } },
    { ...original, shipment: { pending: false, event: { ...event(), elite: 1 } } },
    { ...original, progress: [{ territory: 'carthag', maximum: 21 }] },
    { ...original, progress: [{ territory: 'arrakeen', maximum: 3 }] },
    { ...original, progress: [{ territory: 'carthag', maximum: 1 }, { territory: 'carthag', maximum: 2 }] },
    { ...original, compiled: { kind: 'constant', value: 'unknown' } },
    { ...original, compiled: { kind: 'action', action: { kind: 'move', territory: 'arrakeen', minimum: 3 } } },
    { ...original, compiled: { kind: 'and', terms: [] } },
    { ...original, mixed: { kind: 'constant', value: true } },
    { ...original, mixed: fact() },
  ];
  for (const corrupted of corruptions)
    assert.throws(() => travelPromiseValue(corrupted as TravelPromise));
  for (const record of [{ ...original, event: '' }, { ...original, asker: 'respondent' },
    { ...original, player: 'missing' }, { ...original, fulfilled: true }])
    assert.throws(() => validateTravelPromises([record], ['respondent', 'asker']), TravelPromiseError);
  assert.throws(() => validateTravelPromises([original, original], ['respondent', 'asker']), TravelPromiseError);
  for (const invalid of [{ ...event(), amount: 21 }, { ...event(), amount: -1 },
    { ...event(), amount: 2.5 }, { ...event(), amount: '3' },
    { ...event(), territory: 'missing' }, { ...event(), elite: 1 }]) {
    assert.throws(() => recordTravelMovement([original], 'respondent', 1, invalid as never), TravelPromiseError);
    assert.throws(() => recordTravelShipment([original], 'respondent', 1, invalid as never), TravelPromiseError);
  }
  const violatedNo = { ...original, answer: false,
    shipment: { pending: false, event: event() }, progress: [{ territory: 'carthag', maximum: 3 }] };
  assert.throws(() => validateTravelPromises([violatedNo], ['respondent', 'asker']), TravelPromiseError);
});
