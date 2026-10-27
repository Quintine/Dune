import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CharityOrderError, createCharityOrder, finishCharityOrder,
  reorderSaphoCharityOrder, saphoCharityOrderEvent, startCharityOrder,
  validateCharityOrder, type CharityOrder, type CharityOrderContext,
} from '../game/charity-order';

const order = ['a', 'b', 'c', 'd'];
function context(ready: string[] = [], claimed: string[] = []): CharityOrderContext {
  return { turn: 5, order, players: order.map(id => ({ id })), ready, claimed };
}
function use(ctx: CharityOrderContext, frame: CharityOrder, player: string, mode: 'first' | 'last') {
  return reorderSaphoCharityOrder(ctx, frame, { event: saphoCharityOrderEvent(ctx, frame), player, mode });
}

void test('a started Charity claim can pause last and resume the same started opportunity', () => {
  const initial = context(), frame = createCharityOrder(initial), claimed = context([], ['a']);
  assert.equal(JSON.stringify(frame), '{"version":1,"turn":5,"order":["a","b","c","d"],"remaining":["a","b","c","d"]}');
  const result = use(claimed, frame, 'a', 'last');
  assert.equal(result.suspended, 'a'); assert.equal(result.afterCurrent, undefined);
  assert.ok(result.order.version === 3);
  assert.deepEqual(result.order.remaining, ['b', 'c', 'd', 'a']);
  assert.deepEqual(result.order.paused, ['a']); assert.equal(result.order.started, false);
  validateCharityOrder(claimed, result.order);
  let current = result.order as CharityOrder, ready: string[] = [];
  for (const actor of ['b', 'c', 'd']) {
    current = finishCharityOrder(context(ready, ['a']), current, actor);
    ready = [...ready, actor];
  }
  assert.ok(current.version === 3); assert.equal(current.started, true);
  assert.deepEqual(current.paused, ['a']);
  current = finishCharityOrder(context(ready, ['a']), current, 'a');
  assert.ok(current.version === 3); assert.deepEqual(current.paused, []);
  assert.deepEqual(current.remaining, []); assert.equal(current.started, false);
  validateCharityOrder(context([...ready, 'a'], ['a']), current);
});

void test('a prior version-two Sapho order retains its history when the current claimant suspends', () => {
  const ctx = context(), original = createCharityOrder(ctx);
  const prior = use(ctx, original, 'd', 'first').order;
  assert.ok(prior.version === 2); const saved = JSON.stringify(prior);
  const started = startCharityOrder(ctx, prior, 'd');
  const claimed = context([], ['d']); validateCharityOrder(claimed, started);
  const result = use(claimed, started, 'd', 'last');
  assert.ok(result.order.version === 3); assert.equal(result.order.uses.length, 2);
  assert.deepEqual(result.order.uses[0], prior.uses[0]);
  assert.deepEqual(result.order.remaining, ['a', 'b', 'c', 'd']);
  assert.equal(JSON.stringify(prior), saved);
  validateCharityOrder(claimed, JSON.parse(JSON.stringify(result.order)) as CharityOrder);
});

void test('a paused claimant moved first by another genuine use resumes with its claim still spent', () => {
  const claimed = context([], ['a']);
  const paused = use(claimed, createCharityOrder(context()), 'a', 'last').order;
  const resumed = use(claimed, paused, 'a', 'first').order;
  assert.ok(resumed.version === 3); assert.equal(resumed.remaining[0], 'a');
  assert.equal(resumed.started, true); assert.deepEqual(resumed.paused, ['a']);
  const complete = finishCharityOrder(claimed, resumed, 'a');
  assert.ok(complete.version === 3); assert.deepEqual(complete.paused, []);
  validateCharityOrder(context(['a'], ['a']), complete);
});

void test('started first, stale requests, altered custody and impossible history reject without mutation', () => {
  const ctx = context([], ['a']), original = createCharityOrder(context());
  const old = saphoCharityOrderEvent(context(), original);
  const before = structuredClone({ ctx, original });
  assert.throws(() => use(ctx, original, 'a', 'first'), CharityOrderError);
  assert.throws(() => reorderSaphoCharityOrder(ctx, original, { event: old, player: 'a', mode: 'last' }), CharityOrderError);
  const paused = use(ctx, original, 'a', 'last').order; assert.ok(paused.version === 3);
  assert.throws(() => validateCharityOrder(context(), paused), CharityOrderError);
  assert.throws(() => validateCharityOrder(ctx, { ...paused, paused: [] }), CharityOrderError);
  assert.throws(() => validateCharityOrder(ctx, { ...paused, remaining: ['c', 'b', 'd', 'a'] }), CharityOrderError);
  assert.deepEqual({ ctx, original }, before);
});
