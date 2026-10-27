import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CharityOrderError,
  charityOrderBlock as block,
  createCharityOrder as create,
  finishCharityOrder as finish,
  reorderSaphoCharityOrder as reorder,
  saphoCharityOrderEvent as event,
  startCharityOrder as start,
  validateCharityOrder as validate,
  type CharityOrder,
  type CharityOrderContext,
} from '../game/charity-order';

function context(ready: readonly string[] = [], claimed?: readonly string[]): CharityOrderContext {
  return { turn: 5, order: ['a', 'b', 'c', 'd'],
    players: ['a', 'b', 'c', 'd'].map(id => ({ id })), ready,
    ...(claimed === undefined ? {} : { claimed }) };
}
function use(ctx: CharityOrderContext, frame: CharityOrder, player: string, mode: 'first' | 'last') {
  return reorder(ctx, frame, { event: event(ctx, frame), player, mode });
}
function rejects(ctx: CharityOrderContext, frame: CharityOrder, action: () => unknown): void {
  const before = structuredClone({ ctx, frame });
  assert.throws(action, CharityOrderError);
  assert.deepEqual({ ctx, frame }, before);
}

void test('native claim receipts start version-one Charity without adding or changing stored fields', () => {
  const ctx = context([], []), frame = create(ctx), beforeEvent = event(ctx, frame);
  const quoted = start(ctx, frame, 'a');
  assert.equal(JSON.stringify(quoted), '{"version":1,"turn":5,"order":["a","b","c","d"],"remaining":["a","b","c","d"]}');
  assert.notEqual(quoted, frame);
  const claimed = context([], ['a']);
  validate(claimed, quoted);
  assert.notEqual(event(claimed, quoted), beforeEvent);
  const done = finish(claimed, quoted, 'a');
  assert.equal(JSON.stringify(done), '{"version":1,"turn":5,"order":["a","b","c","d"],"remaining":["b","c","d"]}');
  validate(context(['a'], ['a']), done);
  assert.equal(event(context(['a'], ['a']), done), event(context(['a'], []), done),
    'a completed seat claim does not start the next opportunity');
});

void test('unstarted first and last upgrade only actual changed opportunities and retain physical order', () => {
  const ctx = context([], []), frame = create(ctx), originalEvent = event(ctx, frame);
  const first = use(ctx, frame, 'd', 'first');
  assert.equal(first.order.version, 2);
  assert.equal(first.afterCurrent, undefined);
  assert.deepEqual(first.order.remaining, ['d', 'a', 'b', 'c']);
  assert.deepEqual(first.order.order, ctx.order);
  assert.ok(first.order.version === 2);
  assert.deepEqual(first.order.uses, [{ event: originalEvent, player: 'd', mode: 'first', completed: [], started: false }]);
  const last = use(ctx, first.order, 'd', 'last');
  assert.deepEqual(last.order.remaining, ['a', 'b', 'c', 'd']);
  assert.notEqual(event(ctx, last.order), originalEvent, 'independent uses retain a new revision even when queue returns');
  validate(ctx, last.order);
  assert.equal(frame.version, 1);
});

void test('an accepted claim, including canceled BG Charity, locks the current actor ahead of a reordered tail', () => {
  const fresh = context([], []), frame = create(fresh), stale = event(fresh, frame);
  // claimed records native acceptance, not the eventual payout or cancellation outcome.
  const claimed = context([], ['a']);
  rejects(claimed, frame, () => reorder(claimed, frame, { event: stale, player: 'd', mode: 'first' }));
  rejects(claimed, frame, () => use(claimed, frame, 'a', 'first'));
  rejects(claimed, frame, () => use(claimed, frame, 'a', 'last'));
  const first = use(claimed, frame, 'd', 'first');
  assert.equal(first.afterCurrent, 'a');
  assert.deepEqual(first.order.remaining, ['a', 'd', 'b', 'c']);
  assert.ok(first.order.version === 2 && first.order.started);
  assert.equal(block(claimed, first.order, 'a'), null);
  assert.match(block(claimed, first.order, 'd')!, /Wait/);
  const last = use(claimed, first.order, 'b', 'last');
  assert.equal(last.afterCurrent, 'a');
  assert.deepEqual(last.order.remaining, ['a', 'd', 'c', 'b']);
  rejects(claimed, first.order, () => use(claimed, first.order, 'd', 'first'));
  validate(claimed, last.order);
});

void test('version-two native claims and finishes advance actual reordered completions without changing physical order', () => {
  const initial = context([], []), first = use(initial, create(initial), 'd', 'first').order;
  const pendingClaim = start(initial, first, 'd');
  assert.ok(pendingClaim.version === 2 && pendingClaim.started);
  const accepted = context([], ['d']);
  validate(accepted, pendingClaim);
  const afterD = finish(accepted, pendingClaim, 'd'), later = context(['d'], ['d']);
  validate(later, afterD);
  assert.ok(afterD.version === 2);
  assert.deepEqual(afterD.completed, ['d']);
  assert.equal(afterD.started, false);
  const changed = use(later, afterD, 'a', 'last').order;
  assert.deepEqual(changed.remaining, ['b', 'c', 'a']);
  const afterB = finish(later, changed, 'b'), completed = context(['d', 'b'], ['d']);
  validate(completed, afterB);
  assert.deepEqual(afterB.order, ['a', 'b', 'c', 'd']);
  assert.deepEqual(afterB.remaining, ['c', 'a']);
  assert.match(block(completed, afterB, 'd')!, /finished/);
  rejects(completed, afterB, () => finish(completed, afterB, 'd'));
});

void test('no-op, completed, foreign or stale Sapho choices cannot spend a scheduling opportunity', () => {
  const ctx = context([], []), frame = create(ctx);
  rejects(ctx, frame, () => use(ctx, frame, 'a', 'first'));
  rejects(ctx, frame, () => use(ctx, frame, 'd', 'last'));
  rejects(ctx, frame, () => use(ctx, frame, 'foreign', 'first'));
  const changed = use(ctx, frame, 'd', 'first').order;
  rejects(ctx, changed, () => reorder(ctx, changed, { event: event(ctx, frame), player: 'b', mode: 'last' }));
  const afterD = finish(ctx, changed, 'd'), later = context(['d'], []);
  rejects(later, afterD, () => use(later, afterD, 'd', 'first'));
  rejects(later, afterD, () => validate({ ...later, turn: 6 }, afterD));
  assert.ok(afterD.version === 2);
  rejects(later, afterD, () => validate(later, { ...afterD, started: true }));
  rejects(later, afterD, () => validate(context(['d'], ['a']), afterD));
});

void test('independent repeated uses and native transitions retain detached history and survive JSON', () => {
  const ctx = context([], []);
  let frame = create(ctx);
  for (let index = 0; index < 4; index++) frame = use(ctx, frame, 'b', index % 2 ? 'last' : 'first').order;
  assert.ok(frame.version === 2);
  assert.equal(frame.uses.length, 4);
  assert.equal(new Set(frame.uses.map(use => use.event)).size, 4);
  const restored = JSON.parse(JSON.stringify(frame)) as CharityOrder;
  validate(ctx, restored);
  assert.equal(event(ctx, restored), event(ctx, frame));
  const changed = use(ctx, restored, 'd', 'first').order;
  assert.ok(changed.version === 2 && restored.version === 2);
  assert.notEqual(changed.order, restored.order);
  assert.notEqual(changed.remaining, restored.remaining);
  assert.notEqual(changed.completed, restored.completed);
  assert.notEqual(changed.uses[0].completed, restored.uses[0].completed);
  changed.order.pop();
  changed.remaining.pop();
  changed.completed.push('output-only');
  changed.uses[0].completed.push('output-only');
  validate(ctx, restored);
  assert.deepEqual(ctx.ready, []);
  assert.deepEqual(ctx.claimed, []);
});
