import assert from 'node:assert/strict';
import test from 'node:test';
import {
  reorderSaphoMovementOrder, saphoMovementOrderEvent, SaphoMovementOrderError,
  type SaphoMovementOrderContext,
} from '../game/sapho-movement-order';

function context(currentStarted = false): SaphoMovementOrderContext {
  return {
    queue: {
      event: 'movement:3', eligible: ['done', 'current', 'later', 'holder'],
      remaining: ['current', 'later', 'holder'], completed: ['done'],
      current: 'current', currentStarted, protectedLast: 'holder',
    },
    started: currentStarted ? ['done', 'current', 'holder'] : ['done', 'holder'],
    guild: null,
  };
}
function change(input: SaphoMovementOrderContext, player = 'holder', mode: 'first' | 'last' = 'first') {
  return reorderSaphoMovementOrder(input, { event: saphoMovementOrderEvent(input), player, mode });
}

void test('suspended holder resumes its existing started turn when First becomes current', () => {
  const input = context(), before = structuredClone(input), result = change(input);
  assert.deepEqual(result.next.remaining, ['holder', 'current', 'later']);
  assert.deepEqual(result.next.completed, ['done']);
  assert.equal(result.next.current, 'holder');
  assert.equal(result.next.currentStarted, true);
  assert.equal(result.next.protectedLast, null);
  assert.equal(result.afterCurrent, null);
  assert.equal(result.suspended, undefined);
  assert.deepEqual(input, before);
});

void test('another started actor finishes before the suspended holder resumes', () => {
  const input = context(true), before = structuredClone(input), result = change(input);
  assert.deepEqual(result.next.remaining, ['current', 'holder', 'later']);
  assert.deepEqual(result.next.completed, ['done']);
  assert.equal(result.next.current, 'current');
  assert.equal(result.next.currentStarted, true);
  assert.equal(result.next.protectedLast, null);
  assert.equal(result.afterCurrent, 'current');
  assert.deepEqual(input, before);
});

void test('only the same holder can replace its protected suspended Last', () => {
  const input = context(), before = structuredClone(input);
  assert.throws(() => change(input, 'later', 'first'), SaphoMovementOrderError);
  assert.throws(() => change(input, 'later', 'last'), SaphoMovementOrderError);
  assert.throws(() => change(input, 'holder', 'last'), SaphoMovementOrderError);
  assert.throws(() => reorderSaphoMovementOrder(input,
    { event: 'movement:4', player: 'holder', mode: 'first' }), SaphoMovementOrderError);
  assert.deepEqual(input, before);
});

void test('unrelated started tails and inconsistent current start are rejected', () => {
  const unrelated = context(); unrelated.started = ['done', 'later', 'holder'];
  assert.throws(() => saphoMovementOrderEvent(unrelated), SaphoMovementOrderError);
  const noProtection = context(); noProtection.queue = { ...noProtection.queue, protectedLast: null };
  assert.throws(() => saphoMovementOrderEvent(noProtection), SaphoMovementOrderError);
  const badCurrent = context(); badCurrent.started = ['current', 'holder'];
  assert.throws(() => saphoMovementOrderEvent(badCurrent), SaphoMovementOrderError);
});

void test('a granted current Guild turn cannot be displaced by suspended First', () => {
  const granted = context();
  granted.guild = { player: 'current', granted: true, locked: false };
  assert.throws(() => change(granted), SaphoMovementOrderError);
  const currentStarted = context(true);
  currentStarted.guild = { player: 'current', granted: true, locked: false };
  assert.equal(change(currentStarted).afterCurrent, 'current');
});
