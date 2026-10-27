import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createRevivalOrder as create, finishRevivalOrder as finish, startRevivalOrder as start,
  validateRevivalOrder as validate, revivalOrderBlock as block,
  saphoRevivalOrderEvent as event, reorderSaphoRevivalOrder as reorder,
  RevivalOrderError, type RevivalOrder, type RevivalOrderContext,
} from '../game/revival-order';

const context = (ready: string[] = []): RevivalOrderContext => ({ turn: 5,
  order: ['a', 'b', 'c', 'd'], ready });
function use(ctx: RevivalOrderContext, frame: RevivalOrder, player: string, mode: 'first' | 'last') {
  return reorder(ctx, frame, { event: event(ctx, frame), player, mode });
}
function rejects(ctx: RevivalOrderContext, frame: RevivalOrder, run: () => unknown) {
  const before = structuredClone({ ctx, frame });
  assert.throws(run, RevivalOrderError); assert.deepEqual({ ctx, frame }, before);
}

void test('ordinary Revival creation, partial start and finish keep exact version-one bytes without a Sapho history', () => {
  const ctx = context(), frame = create(ctx);
  assert.equal(JSON.stringify(frame), '{"version":1,"turn":5,"original":["a","b","c","d"],"remaining":["a","b","c","d"],"completed":[],"started":false}');
  const started = start(ctx, frame, 'a'); assert.equal(started.version, 1);
  assert.equal(Object.hasOwn(started, 'uses'), false); assert.equal(started.started, true);
  const done = finish(ctx, started, 'a'); validate(context(['a']), done);
  assert.equal(JSON.stringify(done), '{"version":1,"turn":5,"original":["a","b","c","d"],"remaining":["b","c","d"],"completed":["a"],"started":false}');
  assert.deepEqual(create(context(['a'])), done); assert.equal(frame.started, false);
});

void test('Sapho first upgrades only an actual changed opportunity and preserves every physical seat', () => {
  const ctx = context(), frame = create(ctx), beforeEvent = event(ctx, frame);
  const result = use(ctx, frame, 'd', 'first');
  assert.equal(result.order.version, 2); assert.equal(result.afterCurrent, undefined);
  assert.deepEqual(result.order.remaining, ['d', 'a', 'b', 'c']); assert.deepEqual(result.order.original, ctx.order);
  assert.deepEqual(result.order.completed, []); validate(ctx, result.order);
  assert.ok(result.order.version === 2);
  assert.deepEqual(result.order.uses, [{ event: beforeEvent, player: 'd', mode: 'first', completed: [], started: false }]);
  assert.notEqual(event(ctx, result.order), beforeEvent);
  rejects(ctx, result.order, () => reorder(ctx, result.order, { event: beforeEvent, player: 'b', mode: 'last' }));
  assert.equal(frame.version, 1); assert.deepEqual(frame.remaining, ctx.order);
});

void test('Sapho last moves the whole unstarted opportunity and rejects already-held, completed and foreign positions', () => {
  const ctx = context(), frame = create(ctx), result = use(ctx, frame, 'a', 'last');
  assert.deepEqual(result.order.remaining, ['b', 'c', 'd', 'a']); validate(ctx, result.order);
  rejects(ctx, frame, () => use(ctx, frame, 'a', 'first'));
  rejects(ctx, frame, () => use(ctx, frame, 'd', 'last'));
  rejects(ctx, frame, () => use(ctx, frame, 'foreign', 'first'));
  const later = context(['a']), laterFrame = create(later);
  rejects(later, laterFrame, () => use(later, laterFrame, 'a', 'first'));
  const done = create(context(['a', 'b', 'c', 'd']));
  rejects(context(['a', 'b', 'c', 'd']), done, () => use(context(['a', 'b', 'c', 'd']), done, 'd', 'first'));
});

void test('a started current actor locks its entire opportunity while another faction can become first after it', () => {
  const ctx = context(), fresh = create(ctx), old = event(ctx, fresh), frame = start(ctx, fresh, 'a');
  assert.notEqual(event(ctx, frame), old);
  rejects(ctx, frame, () => reorder(ctx, frame, { event: old, player: 'd', mode: 'first' }));
  rejects(ctx, frame, () => use(ctx, frame, 'a', 'first'));
  const paused = use(ctx, frame, 'a', 'last');
  assert.equal(paused.suspended, 'a');
  assert.deepEqual(paused.order.remaining, ['b', 'c', 'd', 'a']);
  assert.equal(paused.order.started, false);
  const first = use(ctx, frame, 'd', 'first');
  assert.equal(first.afterCurrent, 'a'); assert.equal(first.order.started, true);
  assert.deepEqual(first.order.remaining, ['a', 'd', 'b', 'c']);
  assert.equal(block(ctx, first.order, 'a'), null); assert.match(block(ctx, first.order, 'd')!, /Wait/);
  rejects(ctx, first.order, () => use(ctx, first.order, 'd', 'first'));
  const last = use(ctx, first.order, 'b', 'last');
  assert.equal(last.afterCurrent, 'a'); assert.deepEqual(last.order.remaining, ['a', 'd', 'c', 'b']);
  validate(ctx, last.order); assert.equal(start(ctx, last.order, 'a').started, true);
});

void test('later Sapho uses advance only the actual changed completion prefix and never reopen a finished faction', () => {
  const ctx = context(), first = use(ctx, create(ctx), 'd', 'first').order;
  const afterD = finish(ctx, start(ctx, first, 'd'), 'd'), later = context(['d']);
  validate(later, afterD); assert.deepEqual(afterD.remaining, ['a', 'b', 'c']);
  const afterUse = use(later, afterD, 'a', 'last').order;
  validate(later, afterUse); assert.deepEqual(afterUse.remaining, ['b', 'c', 'a']);
  assert.ok(afterUse.version === 2); assert.deepEqual(afterUse.uses[1].completed, ['d']);
  rejects(later, afterUse, () => use(later, afterUse, 'd', 'first'));
  rejects(ctx, first, () => validate(context(['a']), { ...afterD, completed: ['a'] }));
  const afterB = finish(later, afterUse, 'b'), finalContext = context(['d', 'b']);
  validate(finalContext, afterB); assert.deepEqual(afterB.remaining, ['c', 'a']);
  rejects(finalContext, afterB, () => validate(context(['b', 'd']), { ...afterB, completed: ['b', 'd'] }));
});

void test('genuine repeated recovered-card uses retain independent history revisions and survive JSON without an arbitrary cap', () => {
  const ctx = context(); let frame = create(ctx);
  // Physical card recovery/spend is authorized by the engine, outside this pure
  // scheduling helper. Each supplied declaration names a fresh current event.
  for (let index = 0; index < 6; index++) frame = use(ctx, frame, 'b', index % 2 ? 'last' : 'first').order;
  assert.ok(frame.version === 2); assert.equal(frame.uses.length, 6);
  assert.equal(new Set(frame.uses.map(use => use.event)).size, 6);
  const restored = JSON.parse(JSON.stringify(frame)) as RevivalOrder;
  validate(ctx, restored); assert.equal(event(ctx, restored), event(ctx, frame));
  const started = start(ctx, restored, 'a');
  assert.ok(started.version === 2); assert.deepEqual(started.uses, frame.uses);
  const done = finish(ctx, started, 'a'); validate(context(['a']), done);
  assert.ok(done.version === 2); assert.deepEqual(done.uses, frame.uses);
});

void test('recorded started actors cannot be unlocked by later history entries or a changed final frame before completion', () => {
  const ctx = context(), first = use(ctx, start(ctx, create(ctx), 'a'), 'd', 'first').order;
  const second = use(ctx, first, 'b', 'last').order; assert.ok(second.version === 2);
  rejects(ctx, second, () => validate(ctx, { ...second, started: false }));
  const forged = structuredClone(second); forged.uses[1].started = false;
  // Even a matching replacement event cannot erase the earlier started lock.
  forged.uses[1].event = `saphoRevival:${JSON.stringify([5, ctx.order, first.remaining, [], false, 1])}`;
  forged.started = false;
  rejects(ctx, second, () => validate(ctx, forged));
  const completed = finish(ctx, second, 'a'), later = context(['a']);
  validate(later, completed); assert.equal(completed.started, false);
  const changed = use(later, completed, 'c', 'first').order;
  validate(later, changed); assert.deepEqual(changed.remaining, ['c', 'd', 'b']);
});

void test('malformed history, stale boundaries and altered queues reject without repairing or mutating either input', () => {
  const ctx = context(), frame = use(ctx, create(ctx), 'd', 'first').order; assert.ok(frame.version === 2);
  const originalUse = frame.uses[0];
  for (const value of [
    { ...frame, uses: [] }, { ...frame, uses: null }, { ...frame, extra: true },
    { ...frame, uses: [{ ...originalUse, extra: true }] },
    { ...frame, uses: [{ ...originalUse, completed: ['b'] }] },
    { ...frame, uses: [{ ...originalUse, completed: ['a', 'a'] }] },
    { ...frame, uses: [{ ...originalUse, player: 'foreign' }] },
    { ...frame, uses: [{ ...originalUse, mode: 'last' }] },
    { ...frame, uses: [{ ...originalUse, event: `${originalUse.event}:stale` }] },
    { ...frame, remaining: ['d', 'b', 'a', 'c'] },
    { ...frame, remaining: ['d', 'a', 'b', 'b'] },
    { ...frame, completed: ['d'], remaining: ['a', 'b', 'c'] },
  ]) rejects(ctx, frame, () => validate(ctx, value as unknown as RevivalOrder));
  rejects(ctx, frame, () => validate({ ...ctx, turn: 6 }, frame));
  rejects(ctx, frame, () => reorder(ctx, frame, { event: event(ctx, frame), player: 'c', mode: 'middle' } as never));
  rejects(ctx, frame, () => reorder(ctx, frame, { event: event(ctx, frame), player: 'c', mode: 'first', extra: true } as never));
});

void test('reordered snapshots and start/finish copies preserve independent original, queue and per-use arrays', () => {
  const ctx = context(), frame = use(ctx, create(ctx), 'd', 'first').order;
  const changed = use(ctx, frame, 'a', 'last').order;
  assert.ok(frame.version === 2 && changed.version === 2);
  assert.notEqual(changed.original, frame.original); assert.notEqual(changed.remaining, frame.remaining);
  assert.notEqual(changed.completed, frame.completed); assert.notEqual(changed.uses, frame.uses);
  assert.notEqual(changed.uses[0], frame.uses[0]); assert.notEqual(changed.uses[0].completed, frame.uses[0].completed);
  changed.original.pop(); changed.remaining.pop(); changed.completed.push('output-only'); changed.uses[0].completed.push('output-only');
  validate(ctx, frame); assert.deepEqual(frame.remaining, ['d', 'a', 'b', 'c']);
  assert.deepEqual(frame.uses[0].completed, []); assert.deepEqual(ctx.order, ['a', 'b', 'c', 'd']);
});
