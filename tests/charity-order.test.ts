import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CharityOrderError,
  charityOrderBlock as block,
  createCharityOrder as create,
  finishCharityOrder as finish,
  startCharityOrder as start,
  validateCharityOrder as validate,
  type CharityOrder,
  type CharityOrderContext,
} from '../game/charity-order';

function context(ready: readonly string[] = []): CharityOrderContext {
  return { turn: 3, order: ['c', 'a', 'b'], players: [{ id: 'a' }, { id: 'b' }, { id: 'c' }], ready };
}
function rejects(current: CharityOrderContext, frame: CharityOrder, action: () => unknown): void {
  const beforeContext = structuredClone(current), beforeFrame = structuredClone(frame);
  assert.throws(action, CharityOrderError);
  assert.deepEqual(current, beforeContext);
  assert.deepEqual(frame, beforeFrame);
}

void test('Charity preserves the actual rotated First Player order rather than roster order', () => {
  const current = context(), frame = create(current);
  assert.deepEqual(frame, { version: 1, turn: 3, order: ['c', 'a', 'b'], remaining: ['c', 'a', 'b'] });
  assert.equal(JSON.stringify(frame), '{"version":1,"turn":3,"order":["c","a","b"],"remaining":["c","a","b"]}');
  assert.deepEqual(start(current, frame, 'c'), frame);
  assert.equal(Object.hasOwn(start(current, frame, 'c'), 'started'), false);
  validate(current, frame);
  assert.equal(block(current, frame, 'c'), null);
  assert.match(block(current, frame, 'a')!, /Wait/);
  assert.match(block(current, frame, 'foreign')!, /seated/);
  const resumed = context(['c']);
  assert.deepEqual(create(resumed), { ...frame, remaining: ['a', 'b'] });
  assert.match(block(resumed, create(resumed), 'c')!, /finished/);
  assert.equal(block(resumed, create(resumed), 'a'), null);
});

void test('only the current seat finishes, consuming the pre-finish prefix before the caller appends ready', () => {
  const current = context(), frame = create(current);
  rejects(current, frame, () => finish(current, frame, 'a'));
  rejects(current, frame, () => start(current, frame, 'a'));
  rejects(current, frame, () => finish(current, frame, 'foreign'));
  const next = finish(current, frame, 'c');
  assert.deepEqual(next.remaining, ['a', 'b']);
  assert.deepEqual(current.ready, []);
  validate(context(['c']), next);
  rejects(current, frame, () => validate(current, next));
  rejects(current, frame, () => finish(context(['c']), frame, 'c'));
  const afterSecond = finish(context(['c']), next, 'a');
  validate(context(['c', 'a']), afterSecond);
  assert.deepEqual(afterSecond.remaining, ['b']);
  rejects(context(['c']), next, () => finish(context(['c']), next, 'c'));
});

void test('the final completed Charity frame stays valid and never reopens a seat', () => {
  const current = context(['c', 'a']), frame = create(current);
  const done = finish(current, frame, 'b'), completed = context(['c', 'a', 'b']);
  validate(completed, done);
  assert.deepEqual(done.remaining, []);
  assert.deepEqual(create(completed), done);
  for (const player of completed.order) {
    assert.match(block(completed, done, player)!, /complete/);
    rejects(completed, done, () => finish(completed, done, player));
  }
});

void test('the native context requires actual unique seats, their permutation and an exact completed prefix', () => {
  const base = context();
  for (const current of [
    { ...base, turn: 0 }, { ...base, turn: 1.5 }, { ...base, turn: Number.NaN },
    { ...base, players: [{ id: 'a' }] },
    { ...base, players: ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map(id => ({ id })) },
    { ...base, players: [{ id: 'a' }, { id: 'a' }, { id: 'c' }] },
    { ...base, players: [{ id: 'a' }, { id: 'b' }, { id: ' ' }] },
    { ...base, order: ['c', 'a'] }, { ...base, order: ['c', 'a', 'a'] },
    { ...base, order: ['c', 'a', 'foreign'] }, context(['a']), context(['c', 'b']),
    context(['c', 'c']), context(['c', 'a', 'b', 'foreign']),
    { ...base, claimed: ['foreign'] }, { ...base, claimed: ['c', 'c'] },
  ]) assert.throws(() => create(current), CharityOrderError);
  for (const current of [null, [], { ...base, players: undefined }, { ...base, order: 'c,a,b' },
    { ...base, ready: undefined }, { ...base, order: Array.from({ length: 3 }) },
    { ...base, players: Array.from({ length: 3 }) }, { ...base, ready: Array.from({ length: 1 }) }])
    assert.throws(() => create(current as unknown as CharityOrderContext), CharityOrderError);
  for (const order of [['b', 'a'], ['f', 'a', 'b', 'c', 'd', 'e']]) {
    const current = { turn: 1, order, players: [...order].reverse().map(id => ({ id })), ready: [] };
    validate(current, create(current));
  }
});

void test('stale, rearranged or extended frames cannot replace the original remaining suffix', () => {
  const current = context(['c']), frame = create(current);
  const missing = { ...frame } as Partial<CharityOrder>;
  delete missing.remaining;
  for (const value of [
    null, [], missing, { ...frame, extra: true }, { ...frame, started: false },
    { ...frame, version: 2 }, { ...frame, turn: 2 },
    { ...frame, order: ['a', 'c', 'b'] }, { ...frame, order: ['c', 'a', 'a'] },
    { ...frame, remaining: ['b', 'a'] }, { ...frame, remaining: ['a'] },
    { ...frame, remaining: ['c', 'a', 'b'] }, { ...frame, remaining: ['a', 'foreign'] },
  ]) rejects(current, frame, () => validate(current, value as unknown as CharityOrder));
  rejects(current, frame, () => validate({ ...current, turn: 4 }, frame));
  rejects(current, frame, () => validate({ ...current, order: ['a', 'c', 'b'], ready: [] }, frame));
  rejects(current, frame, () => finish(current, frame, ''));
});

void test('creation and finish detach both public arrays without changing the original context or frame', () => {
  const current = context(['c']), before = structuredClone(current);
  Object.freeze(current.order);
  Object.freeze(current.ready);
  Object.freeze(current.players);
  Object.freeze(current);
  const frame = create(current), original = structuredClone(frame);
  Object.freeze(frame.order);
  Object.freeze(frame.remaining);
  Object.freeze(frame);
  const next = finish(current, frame, 'a');
  assert.notEqual(frame.order, current.order);
  assert.notEqual(frame.remaining, current.order);
  assert.notEqual(frame.order, frame.remaining);
  assert.notEqual(next.order, frame.order);
  assert.notEqual(next.remaining, frame.remaining);
  next.order.pop();
  next.remaining.pop();
  assert.deepEqual(current, before);
  assert.deepEqual(frame, original);
});
