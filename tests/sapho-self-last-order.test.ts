import assert from 'node:assert/strict';
import test from 'node:test';
import {
  reorderSaphoMovementOrder, saphoMovementOrderEvent, SaphoMovementOrderError,
  type SaphoMovementOrderContext,
} from '../game/sapho-movement-order';

function context(): SaphoMovementOrderContext {
  return {
    queue: {
      event: 'movement:3', eligible: ['done', 'active', 'later', 'last'],
      remaining: ['active', 'later', 'last'], completed: ['done'],
      current: 'active', currentStarted: true, protectedLast: null,
    },
    started: ['done', 'active'], guild: null, allowStartedLast: true,
  };
}
function request(input: SaphoMovementOrderContext, player = 'active', mode: 'first' | 'last' = 'last') {
  return reorderSaphoMovementOrder(input, { event: saphoMovementOrderEvent(input), player, mode });
}
function reject(input: SaphoMovementOrderContext, player = 'active', mode: 'first' | 'last' = 'last', event?: string) {
  const before = structuredClone(input);
  assert.throws(() => reorderSaphoMovementOrder(input, {
    event: event ?? saphoMovementOrderEvent(input), player, mode,
  }), SaphoMovementOrderError);
  assert.deepEqual(input, before);
}

void test('a Basic started actor suspends the same opportunity at a protected last position', () => {
  const input = context(), before = structuredClone(input), event = saphoMovementOrderEvent(input);
  const result = request(input);
  assert.equal(result.event, event);
  assert.equal(result.afterCurrent, null);
  assert.equal(result.suspended, 'active');
  assert.deepEqual(result.next, {
    event: 'movement:3', eligible: ['done', 'active', 'later', 'last'],
    remaining: ['later', 'last', 'active'], completed: ['done'],
    current: 'later', currentStarted: false, protectedLast: 'active',
  });
  assert.deepEqual(input, before);
  assert.notEqual(result.next.eligible, input.queue.eligible);
  assert.notEqual(result.next.completed, input.queue.completed);
  assert.notEqual(result.next.remaining, input.queue.remaining);
});

void test('started self-last needs explicit Basic admission and cannot create a first or duplicate turn', () => {
  const input = context();
  reject({ ...input, allowStartedLast: undefined });
  reject({ ...input, allowStartedLast: false });
  reject(input, 'active', 'first');
  reject(input, 'done');
  const alone = context();
  alone.queue = { ...alone.queue, eligible: ['done', 'active'], remaining: ['active'], completed: ['done'] };
  reject(alone);
  const advanced = context();
  advanced.guild = { player: 'last', granted: false, locked: false };
  assert.equal(request(advanced).next.protectedLast, 'active');
  const proposed = request(input);
  const already = { ...input, queue: proposed.next, started: ['done', 'active'] };
  assert.throws(() => saphoMovementOrderEvent(already), SaphoMovementOrderError);
});

void test('a started actor is bound to its current phase, actor and whole remaining tail', () => {
  const input = context(), event = saphoMovementOrderEvent(input);
  assert.notEqual(event, input.queue.event);
  const changed = context();
  changed.queue = { ...changed.queue, remaining: ['active', 'last', 'later'] };
  reject(changed, 'active', 'last', event);
  const nextPhase = context(); nextPhase.queue = { ...nextPhase.queue, event: 'movement:4' };
  reject(nextPhase, 'active', 'last', event);
  const changedActor = context();
  changedActor.queue = { ...changedActor.queue, remaining: ['later', 'active', 'last'], current: 'later' };
  changedActor.started = ['done', 'later'];
  reject(changedActor, 'later', 'last', event);
  const invalid = context(); invalid.started = ['active', 'later'];
  assert.throws(() => saphoMovementOrderEvent(invalid), SaphoMovementOrderError);
});

void test('explicit admission does not change another player’s existing queued-turn reorder', () => {
  const input = context(), before = structuredClone(input);
  const result = request(input, 'last', 'first');
  assert.equal(result.afterCurrent, 'active');
  assert.equal(result.suspended, undefined);
  assert.deepEqual(result.next.remaining, ['active', 'last', 'later']);
  assert.equal(result.next.currentStarted, true);
  assert.deepEqual(input, before);
});
