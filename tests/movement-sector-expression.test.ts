import assert from 'node:assert/strict';
import test from 'node:test';
import { MOBILE_STRONGHOLD } from '../game/board';
import {
  MovementExpressionPromiseError,
  evaluateMovementExpression,
  movementExpressionSectors,
  movementExpressionText,
  parseMovementExpression,
  recordMovementExpressionEvent,
  validateMovementExpressionPromises,
  type MovementExpression,
  type MovementExpressionPromise,
} from '../game/movement-expression-promises';

const move = (sector?: number, minimum = 3): MovementExpression => ({
  kind: 'move', territory: 'wind_pass', minimum, ...(sector === undefined ? {} : { sector }),
});
const group = (kind: 'and' | 'or', ...terms: MovementExpression[]): MovementExpression => ({ kind, terms });
const promise = (claim: MovementExpression, answer = true): MovementExpressionPromise => ({
  event: 'move-expression', turn: 2, player: 'p', asker: 'a', answer, claim, progress: [],
  ...(movementExpressionSectors(claim).length ? { sectorProgress: [] } : {}),
});

void test('sector-aware movement expressions parse printed sectors and preserve legacy leaves', () => {
  assert.deepEqual(parseMovementExpression(move(15)), move(15));
  assert.deepEqual(parseMovementExpression(move()), move());
  assert.deepEqual(movementExpressionSectors(group('or', move(15), move(14), move(15), move())), [
    { territory: 'wind_pass', sector: 15 }, { territory: 'wind_pass', sector: 14 },
  ]);
  assert.match(movementExpressionText(move(15)), /Wind Pass.*sector 15/i);
  for (const invalid of [
    { kind: 'move', territory: 'wind_pass', minimum: 1, sector: 19 },
    { kind: 'move', territory: 'wind_pass', minimum: 1, sector: 15.5 },
    { kind: 'move', territory: 'wind_pass', minimum: 1, sector: null },
    { kind: 'move', territory: 'wind_pass', minimum: 1, sector: 15, extra: true },
  ]) assert.throws(() => parseMovementExpression(invalid), MovementExpressionPromiseError);
});

void test('territory-wide progress never invents an exact sector for an older record', () => {
  const territoryProgress = [{ territory: 'wind_pass', maximum: 8 }];
  assert.equal(evaluateMovementExpression(move(), territoryProgress), true);
  assert.equal(evaluateMovementExpression(move(15), territoryProgress), false);
  assert.equal(evaluateMovementExpression(move(15), territoryProgress,
    [{ territory: 'wind_pass', sector: 14, maximum: 8 }]), false);
  assert.equal(evaluateMovementExpression(move(15), territoryProgress,
    [{ territory: 'wind_pass', sector: 15, maximum: 3 }]), true);
  const record = promise(move(15), false);
  const [result] = recordMovementExpressionEvent([record], 'p', 2, { territory: 'wind_pass', amount: 8 });
  assert.deepEqual(result.progress, territoryProgress);
  assert.deepEqual(result.sectorProgress, []);
  validateMovementExpressionPromises([result], ['p', 'a']);
});

void test('separate actual sectors each keep a per-group maximum, never a sum', () => {
  const record = promise(group('and', move(14, 4), move(15, 3)));
  const afterFirst = recordMovementExpressionEvent([record], 'p', 2,
    { territory: 'wind_pass', sector: 14, amount: 4 });
  const afterSmall = recordMovementExpressionEvent(afterFirst, 'p', 2,
    { territory: 'wind_pass', sector: 15, amount: 2 });
  const afterRepeat = recordMovementExpressionEvent(afterSmall, 'p', 2,
    { territory: 'wind_pass', sector: 15, amount: 2 });
  assert.equal(afterRepeat[0].fulfilled, undefined);
  assert.deepEqual(afterRepeat[0].progress, [{ territory: 'wind_pass', maximum: 4 }]);
  assert.deepEqual(afterRepeat[0].sectorProgress, [
    { territory: 'wind_pass', sector: 14, maximum: 4 },
    { territory: 'wind_pass', sector: 15, maximum: 2 },
  ]);
  const [done] = recordMovementExpressionEvent(afterRepeat, 'p', 2,
    { territory: 'wind_pass', sector: 15, amount: 3 });
  assert.equal(done.fulfilled, true);
  assert.deepEqual(done.progress, [{ territory: 'wind_pass', maximum: 4 }]);
  assert.deepEqual(done.sectorProgress, [
    { territory: 'wind_pass', sector: 14, maximum: 4 },
    { territory: 'wind_pass', sector: 15, maximum: 3 },
  ]);
  validateMovementExpressionPromises([done], ['p', 'a']);
});

void test('No blocks an actual named sector but permits an unrelated sector', () => {
  const record = promise(group('or', move(14, 3), move(15, 4)), false);
  const [other] = recordMovementExpressionEvent([record], 'p', 2,
    { territory: 'wind_pass', sector: 16, amount: 8 });
  assert.deepEqual(other.progress, [{ territory: 'wind_pass', maximum: 8 }]);
  assert.deepEqual(other.sectorProgress, []);
  assert.throws(() => recordMovementExpressionEvent([other], 'p', 2,
    { territory: 'wind_pass', sector: 14, amount: 3 }), MovementExpressionPromiseError);
  assert.throws(() => recordMovementExpressionEvent([other], 'p', 2,
    { territory: 'wind_pass', sector: 15, amount: 4 }), MovementExpressionPromiseError);
  validateMovementExpressionPromises([other], ['p', 'a']);
});

void test('legacy records keep their existing shape and malformed sector progress is rejected', () => {
  const [legacy] = recordMovementExpressionEvent([promise(move())], 'p', 2,
    { territory: 'wind_pass', sector: 14, amount: 3 });
  assert.deepEqual(legacy.progress, [{ territory: 'wind_pass', maximum: 3 }]);
  assert.equal(Object.hasOwn(legacy, 'sectorProgress'), false);
  assert.equal(legacy.fulfilled, true);
  validateMovementExpressionPromises(JSON.parse(JSON.stringify([legacy])), ['p', 'a']);
  const missing = promise(move(14)); delete missing.sectorProgress;
  const invalid = [
    missing,
    { ...promise(move()), sectorProgress: [] },
    { ...promise(move(14)), progress: [{ territory: 'wind_pass', maximum: 3 }],
      sectorProgress: [{ territory: 'wind_pass', sector: 15, maximum: 3 }] },
    { ...promise(move(14)), progress: [{ territory: 'wind_pass', maximum: 2 }],
      sectorProgress: [{ territory: 'wind_pass', sector: 14, maximum: 3 }] },
    { ...promise(move(14)), progress: [{ territory: 'wind_pass', maximum: 3 }],
      sectorProgress: [{ territory: 'wind_pass', sector: 14, maximum: 1 },
        { territory: 'wind_pass', sector: 14, maximum: 2 }] },
  ];
  for (const row of invalid) assert.throws(() => validateMovementExpressionPromises([row], ['p', 'a']), MovementExpressionPromiseError);
  assert.throws(() => recordMovementExpressionEvent([promise(move(14))], 'p', 2,
    { territory: 'wind_pass', sector: 19, amount: 1 }), MovementExpressionPromiseError);
});

void test('unrelated dynamic stronghold entry events retain native structural validity', () => {
  const row = promise(move(14));
  const untouched = recordMovementExpressionEvent([row], 'p', 2,
    { territory: MOBILE_STRONGHOLD, sector: 0, amount: 1 });
  assert.equal(untouched[0], row);
  assert.deepEqual(untouched[0].progress, []);
  assert.deepEqual(untouched[0].sectorProgress, []);
  assert.throws(() => recordMovementExpressionEvent([], 'p', 2,
    { territory: MOBILE_STRONGHOLD, sector: 1, amount: 1 }), MovementExpressionPromiseError);
});
