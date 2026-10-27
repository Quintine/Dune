import assert from 'node:assert/strict';
import test from 'node:test';
import { compileMixedActionExpression, type MixedActionExpression } from '../game/mixed-action-question';
import { needsMovementSectorProgress } from '../game/travel-expression-promises';
import {
  parseTurnActionLeaf, recordTurnActionMovement, turnActionBranches, turnActionValue, TurnActionError,
  validateTurnActionPromises, type TurnActionLeaf, type TurnActionPromise,
} from '../game/turn-action-promises';

type Expression = MixedActionExpression<TurnActionLeaf>;
const move = (minimum: number, sector?: number): Expression => ({ kind: 'action', action: {
  kind: 'move', territory: 'imperial_basin', minimum, ...(sector === undefined ? {} : { sector }),
} });
const group = (kind: 'and' | 'or', ...terms: Expression[]): Expression => ({ kind, terms });
function promise(mixed: Expression, answer = true): TurnActionPromise {
  return { turn: 1, mixed, event: 'turn-movement-sector', player: 'p', asker: 'a', answer,
    compiled: compileMixedActionExpression(mixed, () => 'yes', answer), shipment: { pending: true, event: null },
    progress: [], ...(needsMovementSectorProgress(mixed) ? { sectorProgress: [] } : {}), payments: [],
    transportClosed: false, paymentClosed: false, fulfilled: false, released: false };
}
void test('turn-action movement parser accepts exact printed sectors and rejects unprinted choices', () => {
  const leaf = { kind: 'move', territory: 'imperial_basin', minimum: 1, sector: 9 };
  assert.deepEqual(parseTurnActionLeaf(leaf), leaf);
  assert.throws(() => parseTurnActionLeaf({ ...leaf, sector: 0 }));
  assert.throws(() => parseTurnActionLeaf({ ...leaf, sector: 9.5 }));
  assert.throws(() => parseTurnActionLeaf({ ...leaf, extra: true }));
});
void test('whole turn-action distinguishes original sector from general maxima without guessing old events', () => {
  const p = promise(move(2, 9));
  let [next] = recordTurnActionMovement([p], 'p', 1, { territory: 'imperial_basin', amount: 3 });
  assert.equal(turnActionValue(next), false); assert.deepEqual(next.sectorProgress, []);
  [next] = recordTurnActionMovement([next], 'p', 1, { territory: 'imperial_basin', sector: 10, amount: 2 });
  assert.equal(turnActionValue(next), false); assert.deepEqual(next.sectorProgress, []);
  [next] = recordTurnActionMovement([next], 'p', 1, { territory: 'imperial_basin', sector: 9, amount: 2 });
  assert.deepEqual(next.progress, [{ territory: 'imperial_basin', maximum: 3 }]);
  assert.deepEqual(next.sectorProgress, [{ territory: 'imperial_basin', sector: 9, maximum: 2 }]);
  assert.equal(next.fulfilled, true); validateTurnActionPromises([next], ['p', 'a']);
});
void test('distinct positive sector movements stay separate branches and can occur as separate groups', () => {
  const p = promise(group('and', move(3, 9), move(2, 10)));
  assert.deepEqual([...turnActionBranches(p)], [[{ kind: 'move', territory: 'imperial_basin', minimum: 3, sector: 9, answer: true },
    { kind: 'move', territory: 'imperial_basin', minimum: 2, sector: 10, answer: true }]]);
  let [next] = recordTurnActionMovement([p], 'p', 1, { territory: 'imperial_basin', sector: 9, amount: 3 });
  assert.equal(next.fulfilled, false);
  [next] = recordTurnActionMovement([next], 'p', 1, { territory: 'imperial_basin', sector: 10, amount: 2 });
  assert.equal(next.fulfilled, true);
  assert.deepEqual(next.sectorProgress, [{ territory: 'imperial_basin', sector: 9, maximum: 3 },
    { territory: 'imperial_basin', sector: 10, maximum: 2 }]);
});
void test('broad and exact movement conditions retain separate thresholds and actual destinations', () => {
  const p = promise(group('and', move(3), move(2, 9)));
  assert.equal([...turnActionBranches(p)][0].length, 2);
  let [next] = recordTurnActionMovement([p], 'p', 1, { territory: 'imperial_basin', sector: 9, amount: 2 });
  assert.equal(next.fulfilled, false);
  [next] = recordTurnActionMovement([next], 'p', 1, { territory: 'imperial_basin', sector: 10, amount: 3 });
  assert.equal(next.fulfilled, true);
});
void test('whole No forbids only its actual named sector and sectorless records keep their original shape', () => {
  const p = promise(move(2, 9), false);
  const [other] = recordTurnActionMovement([p], 'p', 1, { territory: 'imperial_basin', sector: 10, amount: 2 });
  assert.throws(() => recordTurnActionMovement([other], 'p', 1, { territory: 'imperial_basin', sector: 9, amount: 2 }), TurnActionError);
  const generic = promise(move(2));
  const [accepted] = recordTurnActionMovement([generic], 'p', 1, { territory: 'imperial_basin', sector: 10, amount: 2 });
  assert.ok(!Object.hasOwn(accepted, 'sectorProgress'));
  assert.deepEqual(accepted.progress, [{ territory: 'imperial_basin', maximum: 2 }]);
});
void test('exact-sector records require their own ledger and cannot invent another sector maximum', () => {
  const p = promise(move(2, 9));
  assert.throws(() => { const missing = structuredClone(p); delete missing.sectorProgress; validateTurnActionPromises([missing], ['p', 'a']); });
  const forged = { ...p, progress: [{ territory: 'imperial_basin', maximum: 1 }],
    sectorProgress: [{ territory: 'imperial_basin', sector: 10, maximum: 1 }] };
  assert.throws(() => validateTurnActionPromises([forged], ['p', 'a']));
});
void test('unrelated native dynamic-location movement leaves printed sector conditions intact', () => {
  const p = promise(move(2, 9));
  for (const territory of ['hidden_mobile_stronghold', 'cistern']) {
    const [next] = recordTurnActionMovement([p], 'p', 1, { territory, sector: 0, amount: 1 });
    assert.deepEqual(next, p);
    const [legacy] = recordTurnActionMovement([p], 'p', 1, { territory, amount: 1 });
    assert.deepEqual(legacy, p);
    assert.throws(() => recordTurnActionMovement([p], 'p', 1, { territory, sector: 1, amount: 1 }), TurnActionError);
    assert.throws(() => parseTurnActionLeaf({ kind: 'move', territory, minimum: 1, sector: 0 }), TurnActionError);
  }
});
