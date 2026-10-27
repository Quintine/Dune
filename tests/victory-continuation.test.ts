import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createVictoryContinuation, validateVictoryContinuation, voteVictoryContinuation,
  MAX_VICTORY_EXTRA_STRONGHOLDS, VictoryContinuationError,
  type VictoryContinuation, type VictoryContinuationChoice,
} from '../game/victory-continuation';

const source = () => createVictoryContinuation({ event: 'victory:5', turn: 5, resume: 'mentat',
  order: ['a', 'b', 'c', 'd', 'e'], sides: [['c', 'a'], ['a', 'c'], ['d']] });
function reject(frame: VictoryContinuation, choice: VictoryContinuationChoice) {
  const before = structuredClone(frame);
  assert.throws(() => voteVictoryContinuation(frame, choice), VictoryContinuationError);
  assert.deepEqual(frame, before);
}

void test('allied rows are deduplicated and every qualifying member votes in public order', () => {
  const frame = source();
  assert.deepEqual(frame.sides, [['a', 'c'], ['d']]);
  assert.deepEqual(frame.voters, ['a', 'c', 'd']);
  assert.deepEqual(frame.accepted, []);
  assert.equal(frame.extraStrongholds, null);
  validateVictoryContinuation(frame);
});

for (const extra of [0, 3, MAX_VICTORY_EXTRA_STRONGHOLDS]) void test(
  `the exact shared proposal of ${extra} extra strongholds requires every qualifier's acceptance`, () => {
    const initial = source(), original = structuredClone(initial);
    const first = voteVictoryContinuation(initial, { event: initial.event, player: 'a', choice: 'continue', extraStrongholds: extra });
    assert.equal(first.outcome, 'pending');
    if (first.outcome !== 'pending') return;
    assert.deepEqual(initial, original);
    assert.deepEqual(first.frame.accepted, ['a']);
    assert.equal(first.frame.extraStrongholds, extra);
    const restored = JSON.parse(JSON.stringify(first.frame)) as VictoryContinuation;
    validateVictoryContinuation(restored);
    const second = voteVictoryContinuation(restored, { event: initial.event, player: 'c', choice: 'continue' });
    assert.equal(second.outcome, 'pending');
    if (second.outcome !== 'pending') return;
    assert.deepEqual(second.frame.accepted, ['a', 'c']);
    assert.deepEqual(voteVictoryContinuation(second.frame, { event: initial.event, player: 'd', choice: 'continue' }),
      { outcome: 'continue', extraStrongholds: extra });
  },
);

void test('any qualifying participant may choose the original victory instead', () => {
  const frame = source();
  assert.deepEqual(voteVictoryContinuation(frame, { event: frame.event, player: 'a', choice: 'finish' }), { outcome: 'finish' });
  const first = voteVictoryContinuation(frame, { event: frame.event, player: 'a', choice: 'continue', extraStrongholds: 1 });
  assert.equal(first.outcome, 'pending');
  if (first.outcome !== 'pending') return;
  assert.deepEqual(voteVictoryContinuation(first.frame, { event: frame.event, player: 'c', choice: 'finish' }), { outcome: 'finish' });
});

void test('stale events, non-voters and unauthorized proposal changes reject without changing the receipt', () => {
  const frame = source();
  for (const choice of [
    { event: 'old', player: 'a', choice: 'continue', extraStrongholds: 0 },
    { event: frame.event, player: 'b', choice: 'continue', extraStrongholds: 0 },
    { event: frame.event, player: 'c', choice: 'continue', extraStrongholds: 0 },
    { event: frame.event, player: 'a', choice: 'continue' },
    { event: frame.event, player: 'a', choice: 'continue', extraStrongholds: -1 },
    { event: frame.event, player: 'a', choice: 'continue', extraStrongholds: 21 },
    { event: frame.event, player: 'a', choice: 'continue', extraStrongholds: 0.5 },
    { event: frame.event, player: 'a', choice: 'finish', extraStrongholds: 1 },
  ] as VictoryContinuationChoice[]) reject(frame, choice);
  const first = voteVictoryContinuation(frame, { event: frame.event, player: 'a', choice: 'continue', extraStrongholds: 2 });
  assert.equal(first.outcome, 'pending');
  if (first.outcome !== 'pending') return;
  reject(first.frame, { event: frame.event, player: 'a', choice: 'continue' });
  reject(first.frame, { event: frame.event, player: 'c', choice: 'continue', extraStrongholds: 3 });
});

void test('unsupported source profiles and forged saved receipts are rejected', () => {
  const frame = source(), snapshot = structuredClone(frame);
  assert.throws(() => createVictoryContinuation({ event: 'turn10', turn: 10, resume: 'mentat',
    order: ['a', 'b', 'c'], sides: [['a', 'b'], ['c']] }), VictoryContinuationError);
  assert.throws(() => createVictoryContinuation({ event: 'solos', turn: 2, resume: 'mentat',
    order: ['a', 'b'], sides: [['a'], ['b']] }), VictoryContinuationError);
  assert.throws(() => createVictoryContinuation({ event: 'overlap', turn: 2, resume: 'mentat',
    order: ['a', 'b', 'c'], sides: [['a', 'b'], ['b', 'c']] }), VictoryContinuationError);
  for (const forged of [
    { ...frame, extraStrongholds: 0 },
    { ...frame, accepted: ['c'], extraStrongholds: 0 },
    { ...frame, voters: ['a', 'd'] },
    { ...frame, sides: [['a', 'c'], ['a', 'd']] },
    { ...frame, turn: 10 },
    { ...frame, accepted: ['a', 'c', 'd'], extraStrongholds: 0 },
    { ...frame, extra: true },
  ]) assert.throws(() => validateVictoryContinuation(forged as VictoryContinuation), VictoryContinuationError);
  assert.deepEqual(frame, snapshot);
});
