import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createRevivalOrder as create, finishRevivalOrder as finish, revivalOrderBlock as blocked,
  startRevivalOrder as start, validateRevivalOrder as validate,
  RevivalOrderError, type RevivalOrder, type RevivalOrderContext,
} from '../game/revival-order';

const context = (ready: string[] = []): RevivalOrderContext => ({ turn: 3,
  order: ['first', 'next', 'last'], ready });
function rejects(context: RevivalOrderContext, frame: RevivalOrder, run: () => unknown) {
  const beforeContext = structuredClone(context), beforeFrame = structuredClone(frame);
  assert.throws(run, RevivalOrderError);
  assert.deepEqual(context, beforeContext); assert.deepEqual(frame, beforeFrame);
}

void test('a Revival frame retains the supplied physical order and resumes only its completed prefix', () => {
  const current = context(), frame = create(current);
  assert.deepEqual(frame, { version: 1, turn: 3, original: ['first', 'next', 'last'],
    remaining: ['first', 'next', 'last'], completed: [], started: false });
  validate(current, frame);
  assert.notEqual(frame.original, current.order); assert.notEqual(frame.remaining, current.order);
  assert.notEqual(frame.original, frame.remaining); assert.notEqual(frame.completed, current.ready);
  const resumed = context(['first']), continuation = create(resumed);
  validate(resumed, continuation);
  assert.deepEqual(continuation.remaining, ['next', 'last']); assert.deepEqual(continuation.completed, ['first']);
  assert.equal(blocked(resumed, continuation, 'next'), null);
  assert.match(blocked(resumed, continuation, 'first')!, /finished/);
  assert.match(blocked(resumed, continuation, 'last')!, /Wait/);
  assert.match(blocked(resumed, continuation, 'foreign')!, /seated/);
});

void test('only the current faction may start and repeated accepted self requests remain an immutable no-op stamp', () => {
  const current = context(), frame = create(current), before = structuredClone(frame);
  assert.equal(blocked(current, frame, 'first'), null);
  rejects(current, frame, () => start(current, frame, 'next'));
  rejects(current, frame, () => start(current, frame, 'foreign'));
  const started = start(current, frame, 'first'); validate(current, started);
  assert.equal(started.started, true); assert.deepEqual(frame, before);
  assert.notEqual(started, frame);
  for (const key of ['original', 'remaining', 'completed'] as const) assert.notEqual(started[key], frame[key]);
  const repeated = start(current, started, 'first');
  assert.deepEqual(repeated, started); assert.notEqual(repeated, started);
  for (const key of ['original', 'remaining', 'completed'] as const) assert.notEqual(repeated[key], started[key]);
  repeated.remaining.pop(); repeated.original.pop(); repeated.completed.push('changed-output-only');
  assert.deepEqual(started.remaining, ['first', 'next', 'last']); assert.deepEqual(started.completed, []);
  assert.deepEqual(current.order, ['first', 'next', 'last']); assert.deepEqual(current.ready, []);
});

void test('finishing either a pass or a started opportunity advances one physical seat and clears the next start stamp', () => {
  const current = context(), frame = create(current), afterPass = finish(current, frame, 'first');
  assert.equal(afterPass.started, false); assert.deepEqual(afterPass.remaining, ['next', 'last']);
  assert.deepEqual(afterPass.completed, ['first']); validate(context(['first']), afterPass);
  rejects(current, frame, () => finish(current, frame, 'next'));
  rejects(current, frame, () => finish(current, frame, 'foreign'));
  const secondContext = context(['first']), second = start(secondContext, afterPass, 'next');
  const afterRequest = finish(secondContext, second, 'next');
  validate(context(['first', 'next']), afterRequest);
  assert.deepEqual(afterRequest.remaining, ['last']); assert.deepEqual(afterRequest.completed, ['first', 'next']);
  assert.equal(afterRequest.started, false); assert.equal(second.started, true);
  assert.deepEqual(second.remaining, ['next', 'last']); assert.deepEqual(current.ready, []);
});

void test('the final completion is a legal unstarted transient and cannot reopen or finish a completed faction', () => {
  const current = context(['first', 'next']), frame = start(current, create(current), 'last');
  const done = finish(current, frame, 'last'), completedContext = context(['first', 'next', 'last']);
  validate(completedContext, done);
  assert.deepEqual(done.remaining, []); assert.deepEqual(done.completed, completedContext.order); assert.equal(done.started, false);
  assert.deepEqual(create(completedContext), done);
  for (const player of completedContext.order) {
    assert.match(blocked(completedContext, done, player)!, /complete/);
    rejects(completedContext, done, () => start(completedContext, done, player));
    rejects(completedContext, done, () => finish(completedContext, done, player));
  }
  rejects(completedContext, done, () => validate(completedContext, { ...done, started: true }));
});

void test('invalid turn, physical roster and non-prefix ready contexts reject before constructing an order', () => {
  for (const current of [
    { ...context(), turn: 0 }, { ...context(), turn: 1.5 }, { ...context(), turn: NaN },
    { ...context(), order: ['only'] }, { ...context(), order: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] },
    { ...context(), order: ['first', 'first'] }, { ...context(), order: ['first', ' '] },
    context(['next']), context(['first', 'last']), context(['first', 'first']), context(['foreign']),
    context(['first', 'next', 'last', 'foreign']),
  ]) assert.throws(() => create(current), RevivalOrderError);
  for (const current of [null, [], { turn: 1, order: ['a', 'b'] },
    { turn: 1, order: 'a,b', ready: [] }, { turn: 1, order: ['a', 2], ready: [] }])
    assert.throws(() => create(current as unknown as RevivalOrderContext), RevivalOrderError);
  const six = { turn: 1, order: ['i', 't', 'c', 'r', 'e', 'm'], ready: [] };
  validate(six, create(six));
});

void test('malformed, stale or rearranged frames cannot replace the original ordered partition', () => {
  const current = context(['first']), frame = create(current);
  const withoutStarted = { ...frame } as Partial<RevivalOrder>; delete withoutStarted.started;
  for (const value of [
    null, [], withoutStarted, { ...frame, extra: true }, { ...frame, version: 2 }, { ...frame, turn: 2 },
    { ...frame, original: ['next', 'first', 'last'] }, { ...frame, original: ['first', 'next', 'next'] },
    { ...frame, remaining: ['last', 'next'] }, { ...frame, remaining: ['next'] },
    { ...frame, completed: [] }, { ...frame, completed: ['first', 'next'] },
    { ...frame, started: 'yes' }, { ...frame, remaining: ['next', 'foreign'] },
  ]) rejects(current, frame, () => validate(current, value as unknown as RevivalOrder));
  rejects(current, frame, () => start(current, frame, ''));
  rejects(current, frame, () => finish(current, frame, ' '));
  rejects(current, frame, () => validate({ ...current, turn: 4 }, frame));
  rejects(current, frame, () => validate({ ...current, order: ['next', 'first', 'last'], ready: [] }, frame));
});

void test('finish consumes the pre-finish ready prefix and returns detached arrays for the atomic caller update', () => {
  const current = context(['first']), frame = start(current, create(current), 'next');
  rejects(current, frame, () => finish({ ...current, ready: ['first', 'next'] }, frame, 'next'));
  rejects(current, frame, () => finish(current, frame, 'first'));
  const next = finish(current, frame, 'next');
  for (const key of ['original', 'remaining', 'completed'] as const) assert.notEqual(next[key], frame[key]);
  validate({ ...current, ready: [...current.ready, 'next'] }, next);
  next.original.pop(); next.remaining.pop(); next.completed.pop();
  assert.deepEqual(frame.original, ['first', 'next', 'last']); assert.deepEqual(frame.remaining, ['next', 'last']);
  assert.deepEqual(frame.completed, ['first']); assert.deepEqual(current.ready, ['first']);
});
