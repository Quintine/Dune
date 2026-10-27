import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createRevivalOrder, finishRevivalOrder, reorderSaphoRevivalOrder,
  saphoRevivalOrderEvent, startRevivalOrder, validateRevivalOrder,
  type RevivalOrder, type RevivalOrderContext,
} from '../game/revival-order';

const context = (ready: string[] = []): RevivalOrderContext => ({ turn: 4,
  order: ['a', 'b', 'c', 'd'], ready });
function reorder(ctx: RevivalOrderContext, order: RevivalOrder, player: string, mode: 'first' | 'last') {
  return reorderSaphoRevivalOrder(ctx, order, { event: saphoRevivalOrderEvent(ctx, order), player, mode });
}

void test('started Revival suspends last and resumes the same started opportunity after intervening turns', () => {
  const ctx = context(), original = startRevivalOrder(ctx, createRevivalOrder(ctx), 'a');
  const choice = reorder(ctx, original, 'a', 'last');
  assert.equal(choice.suspended, 'a'); assert.equal(choice.afterCurrent, undefined);
  assert.equal(choice.order.version, 3); assert.ok(choice.order.version === 3);
  assert.deepEqual(choice.order.remaining, ['b', 'c', 'd', 'a']);
  assert.deepEqual(choice.order.paused, ['a']); assert.equal(choice.order.started, false);
  assert.equal(original.version, 1); assert.equal(original.started, true);
  let order: RevivalOrder = choice.order;
  for (const [index, player] of ['b', 'c', 'd'].entries()) {
    const before = context(['b', 'c', 'd'].slice(0, index));
    order = finishRevivalOrder(before, startRevivalOrder(before, order, player), player);
  }
  assert.equal(order.version, 3); assert.ok(order.version === 3);
  assert.deepEqual(order.remaining, ['a']); assert.deepEqual(order.paused, ['a']);
  assert.equal(order.started, true);
  const finished = finishRevivalOrder(context(['b', 'c', 'd']), order, 'a');
  validateRevivalOrder(context(['b', 'c', 'd', 'a']), finished);
  assert.ok(finished.version === 3); assert.deepEqual(finished.paused, []);
  assert.equal(finished.started, false);
});

void test('suspension preserves earlier version-two uses and a later reordered paused turn retains its started lock', () => {
  const ctx = context();
  const first = reorder(ctx, createRevivalOrder(ctx), 'd', 'first').order;
  assert.equal(first.version, 2);
  const active = startRevivalOrder(ctx, first, 'd');
  const suspended = reorder(ctx, active, 'd', 'last').order;
  assert.ok(first.version === 2 && suspended.version === 3);
  assert.deepEqual(suspended.uses[0], first.uses[0]);
  assert.deepEqual(suspended.paused, ['d']);
  const resumed = reorder(ctx, suspended, 'd', 'first').order;
  assert.ok(resumed.version === 3); assert.equal(resumed.started, true);
  assert.equal(resumed.remaining[0], 'd'); assert.deepEqual(resumed.paused, ['d']);
  const restored = JSON.parse(JSON.stringify(resumed)) as RevivalOrder;
  validateRevivalOrder(ctx, restored);
  const done = finishRevivalOrder(ctx, restored, 'd');
  assert.ok(done.version === 3); assert.deepEqual(done.paused, []);
  validateRevivalOrder(context(['d']), done);
});

void test('suspension rejects stale, no-op and forged receipts without changing either input', () => {
  const ctx = context(), fresh = createRevivalOrder(ctx);
  const old = saphoRevivalOrderEvent(ctx, fresh), active = startRevivalOrder(ctx, fresh, 'a');
  const before = structuredClone(active);
  assert.throws(() => reorderSaphoRevivalOrder(ctx, active, { event: old, player: 'a', mode: 'last' }));
  assert.throws(() => reorder(ctx, active, 'a', 'first'));
  assert.deepEqual(active, before);
  const frame = reorder(ctx, active, 'a', 'last').order; assert.ok(frame.version === 3);
  for (const bad of [
    { ...frame, paused: [] }, { ...frame, paused: ['a', 'a'] },
    { ...frame, paused: ['foreign'] }, { ...frame, remaining: ['a', 'b', 'c', 'd'] },
    { ...frame, uses: frame.uses.map(use => ({ ...use, suspended: undefined })) },
  ]) assert.throws(() => validateRevivalOrder(ctx, bad as RevivalOrder));
  assert.deepEqual(active, before);
});
