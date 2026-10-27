import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SaphoTruthOrderError, createSaphoTruthOrder, passSaphoTruthOrder,
  quoteSaphoTruthOrder, reorderSaphoTruthOrder, validateSaphoTruthOrder,
} from '../game/sapho-truth-order';

const original = [
  { player: 'a', card: 'a1', source: 'printed' },
  { player: 'a', card: 'a2', source: 'shrine' },
  { player: 'b', card: 'b1', source: 'printed' },
  { player: 'c', card: 'c1', source: 'printed' },
];
const frame = () => createSaphoTruthOrder(original, 'opaque-event')!;

void test('the public window is created from distinct committed holders, never their hidden hands', () => {
  assert.equal(createSaphoTruthOrder([], 'empty'), null);
  assert.equal(createSaphoTruthOrder(original.slice(0, 2), 'one-holder'), null);
  assert.deepEqual(frame(), { event: 'opaque-event', revision: 0, holders: ['a', 'b', 'c'], passed: [] });
  assert.deepEqual(quoteSaphoTruthOrder(frame(), original, 'a'), { event: 'opaque-event', revision: 0, modes: ['last'] });
  assert.deepEqual(quoteSaphoTruthOrder(frame(), original, 'b'), { event: 'opaque-event', revision: 0, modes: ['first', 'last'] });
  assert.deepEqual(quoteSaphoTruthOrder(frame(), original, 'c'), { event: 'opaque-event', revision: 0, modes: ['first'] });
});

void test('first and last move the entire group, preserving every original row and internal card order', () => {
  const before = structuredClone(original), start = frame();
  const first = reorderSaphoTruthOrder(start, original, { event: start.event, revision: 0, player: 'b', mode: 'first' });
  assert.deepEqual(first.queue.map(row => row.card), ['b1', 'a1', 'a2', 'c1']);
  assert.deepEqual(first.frame, { event: 'opaque-event', revision: 1, holders: ['a', 'b', 'c'], passed: ['b'], protectedFirst: 'b' });
  assert.equal(first.done, false);
  assert.deepEqual(original, before);
  const last = reorderSaphoTruthOrder(first.frame, first.queue, { event: start.event, revision: 1, player: 'a', mode: 'last' });
  assert.deepEqual(last.queue.map(row => row.card), ['b1', 'c1', 'a1', 'a2']);
  assert.deepEqual(last.queue.filter(row => row.player === 'a'), before.slice(0, 2));
  assert.deepEqual(last.frame.passed, ['b', 'a']);
  assert.deepEqual(last.frame.holders, ['a', 'b', 'c']);
});

void test('every public holder may pass independently, and only the last response completes the window', () => {
  const first = passSaphoTruthOrder(frame(), original, { event: 'opaque-event', revision: 0, player: 'c' });
  assert.equal(first.done, false);
  const second = passSaphoTruthOrder(first.frame, first.queue, { event: 'opaque-event', revision: 1, player: 'a' });
  assert.equal(second.done, false);
  const third = passSaphoTruthOrder(second.frame, second.queue, { event: 'opaque-event', revision: 2, player: 'b' });
  assert.equal(third.done, true);
  assert.deepEqual(third.queue, original);
  assert.deepEqual(third.frame.passed, ['c', 'a', 'b']);
});

void test('expired events, stale revisions and duplicate or outsider responses leave the input unchanged', () => {
  const initial = frame(), first = passSaphoTruthOrder(initial, original, { event: 'opaque-event', revision: 0, player: 'a' });
  const before = structuredClone(first);
  for (const request of [
    { event: 'other', revision: 1, player: 'b' },
    { event: 'opaque-event', revision: 0, player: 'b' },
    { event: 'opaque-event', revision: 1, player: 'a' },
    { event: 'opaque-event', revision: 1, player: 'outsider' },
  ]) assert.throws(() => passSaphoTruthOrder(first.frame, first.queue, request), SaphoTruthOrderError);
  assert.deepEqual(first, before);
});

void test('no-op choices and malformed orders reject without consuming an opportunity', () => {
  const initial = frame(), before = structuredClone(initial);
  for (const request of [
    { event: initial.event, revision: 0, player: 'a', mode: 'first' as const },
    { event: initial.event, revision: 0, player: 'c', mode: 'last' as const },
  ]) assert.throws(() => reorderSaphoTruthOrder(initial, original, request), SaphoTruthOrderError);
  assert.deepEqual(initial, before);
  assert.throws(() => createSaphoTruthOrder([original[0], original[2], original[1]], 'event'), /together/);
  assert.throws(() => validateSaphoTruthOrder({ ...initial, passed: ['a'], revision: 0 }, original), /revision/);
  assert.throws(() => validateSaphoTruthOrder({ ...initial, holders: ['a', 'b', 'd'] }, original), /original Truth holder/);
  assert.throws(() => validateSaphoTruthOrder({ ...initial, passed: ['outsider'], revision: 1 }, original), /original holders/);
});

void test('JSON round-trip preserves the event, revision and grouped ordering without private data in the frame', () => {
  const initial = frame(), moved = reorderSaphoTruthOrder(initial, original, { event: initial.event, revision: 0, player: 'c', mode: 'first' });
  const restored = JSON.parse(JSON.stringify(moved)) as typeof moved;
  assert.doesNotMatch(JSON.stringify(restored.frame), /a1|a2|b1|c1|shrine/);
  validateSaphoTruthOrder(restored.frame, restored.queue);
  assert.deepEqual(quoteSaphoTruthOrder(restored.frame, restored.queue, 'a'), { event: 'opaque-event', revision: 1, modes: ['last'] });
});

void test('an earlier first choice is protected when another holder later obtains and plays Sapho', () => {
  const initial = frame();
  const first = reorderSaphoTruthOrder(initial, original, { event: initial.event, revision: 0, player: 'b', mode: 'first' });
  // A second physical use is possible after another player claims the same
  // discarded Sapho through Semuta. It may not displace the first holder.
  assert.deepEqual(quoteSaphoTruthOrder(first.frame, first.queue, 'c').modes, []);
  assert.throws(() => reorderSaphoTruthOrder(first.frame, first.queue,
    { event: initial.event, revision: 1, player: 'c', mode: 'first' }), /protects/);
  assert.deepEqual(quoteSaphoTruthOrder(first.frame, first.queue, 'a').modes, ['last']);
  const opposite = reorderSaphoTruthOrder(first.frame, first.queue,
    { event: initial.event, revision: 1, player: 'a', mode: 'last' });
  assert.deepEqual(opposite.queue.map(row => row.player), ['b','c','a','a']);
  assert.equal(opposite.frame.protectedFirst, 'b');
  assert.equal(opposite.frame.protectedLast, 'a');
  assert.deepEqual(quoteSaphoTruthOrder(opposite.frame, opposite.queue, 'c').modes, []);
  validateSaphoTruthOrder(opposite.frame, opposite.queue);
});

void test('an earlier last choice remains protected, and legacy frames need no protection fields', () => {
  const initial = frame();
  const last = reorderSaphoTruthOrder(initial, original, { event: initial.event, revision: 0, player: 'b', mode: 'last' });
  assert.equal(last.frame.protectedLast, 'b');
  assert.deepEqual(last.queue.map(row => row.player), ['a','a','c','b']);
  assert.deepEqual(quoteSaphoTruthOrder(last.frame,last.queue,'c').modes, ['first']);
  assert.throws(() => reorderSaphoTruthOrder(last.frame,last.queue,
    {event:initial.event,revision:1,player:'c',mode:'last'}), /protects/);
  const first = reorderSaphoTruthOrder(last.frame,last.queue,
    {event:initial.event,revision:1,player:'c',mode:'first'});
  assert.deepEqual(first.queue.map(row => row.player), ['c','a','a','b']);
  assert.equal(first.frame.protectedFirst,'c'); assert.equal(first.frame.protectedLast,'b');
  assert.throws(() => validateSaphoTruthOrder(first.frame,[...first.queue].reverse()), /together|protected/);
  const legacy = JSON.parse(JSON.stringify(initial)) as typeof initial;
  assert.equal(legacy.protectedFirst,undefined); assert.equal(legacy.protectedLast,undefined);
  validateSaphoTruthOrder(legacy,original);
});
