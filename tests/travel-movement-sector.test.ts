import assert from 'node:assert/strict';
import test from 'node:test';
import { compileMixedActionExpression, type MixedActionExpression } from '../game/mixed-action-question';
import {
  needsMovementSectorProgress, parseTravelActionClaim, recordTravelMovement, travelBranches,
  travelPromiseValue, TravelPromiseError, validateTravelPromises,
  type TravelActionClaim, type TravelPromise,
} from '../game/travel-expression-promises';

type Expression = MixedActionExpression<TravelActionClaim>;
const move = (minimum: number, sector?: number): Expression => ({ kind: 'action', action: {
  kind: 'move', territory: 'imperial_basin', minimum, ...(sector === undefined ? {} : { sector }),
} });
const group = (kind: 'and' | 'or', ...terms: Expression[]): Expression => ({ kind, terms });
function promise(mixed: Expression, answer = true): TravelPromise {
  return { turn: 1, mixed, event: 'travel-sector', player: 'p', asker: 'a', answer,
    compiled: compileMixedActionExpression(mixed, () => 'yes', answer), shipment: { pending: true, event: null },
    progress: [], ...(needsMovementSectorProgress(mixed) ? { sectorProgress: [] } : {}),
    movementClosed: false, fulfilled: false, released: false };
}
void test('movement-sector leaves validate only printed sectors and preserve sectorless bytes', () => {
  const leaf = { kind: 'move', territory: 'imperial_basin', minimum: 1, sector: 9 };
  assert.deepEqual(parseTravelActionClaim(leaf), leaf);
  for (const invalid of [{ ...leaf, sector: 0 }, { ...leaf, sector: 9.5 }, { ...leaf, sector: '9' },
    { ...leaf, territory: 'nowhere' }, { ...leaf, extra: true }]) assert.throws(() => parseTravelActionClaim(invalid));
  const original = promise(move(1)); assert.ok(!Object.hasOwn(original, 'sectorProgress'));
  const [recorded] = recordTravelMovement([original], 'p', 1, { territory: 'imperial_basin', amount: 1, sector: 9 });
  assert.deepEqual(recorded.progress, [{ territory: 'imperial_basin', maximum: 1 }]);
  assert.ok(!Object.hasOwn(recorded, 'sectorProgress'));
});
void test('exact sector movement uses separate real maxima and never infers an unrecorded sector', () => {
  const p = promise(move(2, 9));
  let [next] = recordTravelMovement([p], 'p', 1, { territory: 'imperial_basin', amount: 3 });
  assert.equal(travelPromiseValue(next), false); assert.deepEqual(next.sectorProgress, []);
  [next] = recordTravelMovement([next], 'p', 1, { territory: 'imperial_basin', sector: 10, amount: 2 });
  assert.equal(travelPromiseValue(next), false); assert.deepEqual(next.sectorProgress, []);
  [next] = recordTravelMovement([next], 'p', 1, { territory: 'imperial_basin', sector: 9, amount: 1 });
  assert.deepEqual(next.progress, [{ territory: 'imperial_basin', maximum: 3 }]);
  assert.deepEqual(next.sectorProgress, [{ territory: 'imperial_basin', sector: 9, maximum: 1 }]);
  [next] = recordTravelMovement([next], 'p', 1, { territory: 'imperial_basin', sector: 9, amount: 2 });
  assert.equal(next.fulfilled, true); assert.equal(travelPromiseValue(next), true);
  validateTravelPromises([next], ['p', 'a']);
});
void test('two named sectors may be satisfied by distinct actual movements without summing their groups', () => {
  const p = promise(group('and', move(3, 9), move(2, 10)));
  assert.deepEqual([...travelBranches(p)], [[{ kind: 'move', territory: 'imperial_basin', minimum: 3, sector: 9, answer: true },
    { kind: 'move', territory: 'imperial_basin', minimum: 2, sector: 10, answer: true }]]);
  let [next] = recordTravelMovement([p], 'p', 1, { territory: 'imperial_basin', sector: 9, amount: 3 });
  assert.equal(next.fulfilled, false);
  [next] = recordTravelMovement([next], 'p', 1, { territory: 'imperial_basin', sector: 10, amount: 1 });
  assert.equal(next.fulfilled, false);
  [next] = recordTravelMovement([next], 'p', 1, { territory: 'imperial_basin', sector: 10, amount: 2 });
  assert.equal(next.fulfilled, true);
  assert.deepEqual(next.sectorProgress, [{ territory: 'imperial_basin', sector: 9, maximum: 3 },
    { territory: 'imperial_basin', sector: 10, maximum: 2 }]);
});
void test('whole No rejects an exact matching movement but permits another sector', () => {
  const p = promise(move(2, 9), false);
  const [other] = recordTravelMovement([p], 'p', 1, { territory: 'imperial_basin', sector: 10, amount: 2 });
  assert.throws(() => recordTravelMovement([other], 'p', 1, { territory: 'imperial_basin', sector: 9, amount: 2 }), TravelPromiseError);
  assert.equal(other.fulfilled, false);
});
void test('sector metadata is required only for an originally named exact movement and cannot be forged', () => {
  const p = promise(move(2, 9));
  assert.throws(() => { const incomplete = structuredClone(p); delete incomplete.sectorProgress; validateTravelPromises([incomplete], ['p', 'a']); });
  const forged = { ...p, progress: [{ territory: 'imperial_basin', maximum: 1 }],
    sectorProgress: [{ territory: 'imperial_basin', sector: 10, maximum: 1 }] };
  assert.throws(() => validateTravelPromises([forged], ['p', 'a']));
  const folded = promise(group('or', { kind: 'fact', fact: { kind: 'spice', compare: 'gte', value: 1 } }, move(2, 9)));
  assert.deepEqual(folded.sectorProgress, []);
});
void test('unrelated physical moves into recognized dynamic locations do not break a printed sector question', () => {
  const p = promise(move(2, 9));
  for (const territory of ['hidden_mobile_stronghold', 'cistern']) {
    const [next] = recordTravelMovement([p], 'p', 1, { territory, sector: 0, amount: 1 });
    assert.deepEqual(next, p);
    const [legacy] = recordTravelMovement([p], 'p', 1, { territory, amount: 1 });
    assert.deepEqual(legacy, p);
    assert.throws(() => recordTravelMovement([p], 'p', 1, { territory, sector: 1, amount: 1 }), TravelPromiseError);
    assert.throws(() => parseTravelActionClaim({ kind: 'move', territory, minimum: 1, sector: 0 }), TravelPromiseError);
  }
});
