import assert from 'node:assert/strict';
import test from 'node:test';
import {
  saphoExtortionEvent,
  validateSaphoExtortion,
  reorderSaphoExtortion,
  SaphoExtortionError,
  type SaphoExtortionContext,
  type SaphoExtortionOrder,
} from '../game/sapho-extortion';

const initial = (): SaphoExtortionContext => ({
  owner: 'm', token: 'original-extortion-token', turn: 3,
  stormOrder: ['a', 'm', 'b', 'c', 'd'], queue: ['a', 'b', 'c', 'd'], cursor: 0,
});
const move = (context: SaphoExtortionContext, player: string, mode: 'first' | 'last'): SaphoExtortionContext => ({
  ...context, ...reorderSaphoExtortion(context, { event: saphoExtortionEvent(context), player, mode }),
});
const clone = <T>(value: T): T => structuredClone(value);

// These are public finite-order inputs. Changing a cursor represents the
// caller's already-completed native opportunity; no payment or card custody
// claim is established by this pure adapter.
void test('Sapho Extortion records the original owner-excluded storm queue and an immutable first-position use', () => {
  const context = initial(), before = clone(context);
  Object.freeze(context.queue); Object.freeze(context.stormOrder); Object.freeze(context);
  assert.equal(saphoExtortionEvent(context), 'saphoExtortion:["original-extortion-token",3,0,0]');
  const result = reorderSaphoExtortion(context, { event: saphoExtortionEvent(context), player: 'd', mode: 'first' });
  assert.deepEqual(result.queue, ['d', 'a', 'b', 'c']);
  assert.deepEqual(result.order.original, ['a', 'b', 'c', 'd']);
  assert.equal(result.order.version, 1);
  assert.deepEqual(result.order.uses, [{ event: saphoExtortionEvent(context), player: 'd', mode: 'first', cursor: 0 }]);
  validateSaphoExtortion({ ...context, ...result });
  assert.deepEqual(context, before);
  assert.notEqual(result.queue, context.queue);
});

void test('later first and last uses preserve completed payers and the relative order of every other pending payer', () => {
  const first = move(initial(), 'd', 'first');
  const afterCompleted = { ...first, cursor: 1 }, before = clone(afterCompleted);
  const next = move(afterCompleted, 'b', 'first');
  assert.deepEqual(next.queue, ['d', 'b', 'a', 'c']);
  assert.equal(next.queue[0], afterCompleted.queue[0]);
  assert.deepEqual(next.queue.filter(player => player !== 'b'), afterCompleted.queue.filter(player => player !== 'b'));
  const last = move(next, 'a', 'last');
  assert.deepEqual(last.queue, ['d', 'b', 'c', 'a']);
  assert.deepEqual(last.queue.filter(player => player !== 'a'), next.queue.filter(player => player !== 'a'));
  assert.deepEqual(last.order!.uses.map(use => use.cursor), [0, 1, 1]);
  assert.equal(saphoExtortionEvent(last), 'saphoExtortion:["original-extortion-token",3,1,3]');
  validateSaphoExtortion(last);
  assert.deepEqual(afterCompleted, before);
});

void test('a fresh repeated use by the same pending holder has its own revision while recovered-card custody stays external', () => {
  const context = initial(), originalEvent = saphoExtortionEvent(context);
  const first = move(context, 'b', 'first');
  assert.deepEqual(first.queue, ['b', 'a', 'c', 'd']);
  const last = move(first, 'b', 'last');
  assert.deepEqual(last.queue, ['a', 'c', 'd', 'b']);
  assert.equal(last.order!.uses.length, 2);
  assert.notEqual(last.order!.uses[0].event, last.order!.uses[1].event);
  const reused = move(last, 'b', 'first');
  assert.deepEqual(reused.queue, ['b', 'a', 'c', 'd']);
  assert.equal(reused.order!.uses.length, 3);
  validateSaphoExtortion(reused);
  assert.throws(() => reorderSaphoExtortion(last, { event: originalEvent, player: 'b', mode: 'first' }), /expired/);
  reused.order!.uses[0].player = 'c';
  assert.equal(first.order!.uses[0].player, 'b', 'A later result must not alias earlier history records');
});

void test('current-first, already-last, completed, owner and foreign payer requests are unavailable', () => {
  const context = { ...initial(), cursor: 1 }, before = clone(context);
  for (const [player, mode] of [['b', 'first'], ['d', 'last'], ['a', 'first'], ['m', 'first'], ['outsider', 'last']] as const)
    assert.throws(() => reorderSaphoExtortion(context, { event: saphoExtortionEvent(context), player, mode }), SaphoExtortionError);
  for (const cursor of [3, 4]) {
    const ended = { ...context, cursor };
    validateSaphoExtortion(ended);
    for (const mode of ['first', 'last'] as const)
      assert.throws(() => reorderSaphoExtortion(ended, { event: saphoExtortionEvent(ended), player: 'd', mode }), SaphoExtortionError);
  }
  assert.deepEqual(context, before);
});

void test('history replay rejects altered original order, queue, event revision and decreasing or future cursors', () => {
  const first = move({ ...initial(), cursor: 1 }, 'c', 'first');
  const valid = move({ ...first, cursor: 2 }, 'd', 'first');
  assert.deepEqual(valid.queue, ['a', 'c', 'd', 'b']);
  validateSaphoExtortion(valid);
  const changes: ((context: SaphoExtortionContext & { order: SaphoExtortionOrder }) => void)[] = [
    context => { context.order.original.reverse(); },
    context => { context.queue = ['a', 'd', 'c', 'b']; },
    context => { context.order.uses[1].event = context.order.uses[0].event; },
    context => { context.order.uses[1].cursor = 0;
      context.order.uses[1].event = 'saphoExtortion:["original-extortion-token",3,0,1]'; },
    context => { context.order.uses[1].cursor = 3;
      context.order.uses[1].event = 'saphoExtortion:["original-extortion-token",3,3,1]'; },
    context => { context.order.uses[0].player = 'a'; },
    context => { context.order.uses.pop(); },
    context => { context.token = 'another-extortion-token'; },
    context => { context.turn++; },
    context => { Object.assign(context.order.uses[0], { extra: undefined }); },
    context => { Object.assign(context.order, { version: 2 }); },
  ];
  for (const change of changes) {
    const invalid = clone(valid) as SaphoExtortionContext & { order: SaphoExtortionOrder };
    change(invalid);
    assert.throws(() => validateSaphoExtortion(invalid), SaphoExtortionError);
    assert.throws(() => saphoExtortionEvent(invalid), SaphoExtortionError);
  }
});

void test('unstamped queues retain exact storm order and malformed public membership or cursors reject', () => {
  const context = initial();
  for (const invalid of [
    { ...context, owner: 'missing' }, { ...context, token: '' },
    { ...context, turn: 0 }, { ...context, turn: Number.MAX_SAFE_INTEGER + 1 },
    { ...context, stormOrder: ['a', 'm', 'b', 'c', 'c'] },
    { ...context, queue: ['b', 'a', 'c', 'd'] },
    { ...context, queue: ['a', 'b', 'c'] }, { ...context, queue: ['a', 'b', 'c', 'm'] },
    { ...context, queue: ['a', 'b', 'c', 'c'] },
    ...[-1, 0.5, NaN, Infinity, 5, Number.MAX_SAFE_INTEGER + 1].map(cursor => ({ ...context, cursor })),
  ]) assert.throws(() => validateSaphoExtortion(invalid), SaphoExtortionError);
  assert.throws(() => reorderSaphoExtortion(context, {
    event: saphoExtortionEvent(context), player: 'b', mode: 'middle',
  } as unknown as Parameters<typeof reorderSaphoExtortion>[1]), /first or last/);
});

void test('native completion and a different original Extortion token invalidate an earlier public event', () => {
  const context = initial(), event = saphoExtortionEvent(context);
  const afterCompletion = { ...context, cursor: 1 };
  assert.equal(saphoExtortionEvent(afterCompletion), 'saphoExtortion:["original-extortion-token",3,1,0]');
  assert.throws(() => reorderSaphoExtortion(afterCompletion, { event, player: 'c', mode: 'first' }), /expired/);
  const anotherToken = { ...context, token: 'second-original-token' };
  assert.notEqual(saphoExtortionEvent(anotherToken), event);
  assert.throws(() => reorderSaphoExtortion(anotherToken, { event, player: 'c', mode: 'first' }), /expired/);
  const completed = { ...move(afterCompletion, 'd', 'first'), cursor: 4 };
  validateSaphoExtortion(completed);
  assert.equal(completed.queue.length, 4, 'Reordering never creates another payer or payment opportunity');
});
