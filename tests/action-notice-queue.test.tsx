import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { AutomaticActionNotice } from '../components/automatic-action-notice';
import { advanceActionNotices, appendActionNotices, type AutomaticActionEvent } from '../lib/action-notice-queue';

const events = (first: number, count: number): AutomaticActionEvent[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `room:${first + index}`, seq: first + index,
    faction: index % 2 ? 'emperor' : 'atreides', name: `Action ${first + index}`,
  }));

void test('ordinary notices keep their public action and house without mutating inputs', () => {
  const incoming = events(10, 3), before = structuredClone(incoming);
  assert.deepEqual(appendActionNotices([], incoming, false), incoming.map(event => ({ ...event, count: 1 })));
  assert.deepEqual(incoming, before);
  assert.deepEqual(appendActionNotices([], [], false), []);
});

void test('a full log batch becomes three brief notices while accounting for every action', () => {
  const incoming = events(1, 250);
  const queue = appendActionNotices([], incoming, false);
  assert.equal(queue.length, 3);
  assert.deepEqual(queue.map(notice => notice.seq), [248, 249, 250]);
  assert.deepEqual(queue.map(notice => notice.count), [248, 1, 1]);
  assert.equal(queue.reduce((sum, notice) => sum + notice.count, 0), 250);
  assert.equal(queue[0].name, incoming[247].name);
  assert.equal(queue[0].faction, incoming[247].faction);
});

void test('incoming bursts preserve the visible notice and merge existing summaries without losing counts', () => {
  const queue = appendActionNotices([], events(1, 12), false);
  const active = queue[0], before = structuredClone(queue);
  const next = appendActionNotices(queue.slice(1), events(13, 20), true);
  assert.equal(next.length, 2);
  assert.deepEqual(next.map(notice => notice.seq), [31, 32]);
  assert.equal(active.count + next.reduce((sum, notice) => sum + notice.count, 0), 32);
  const again = appendActionNotices(next, events(33, 2), true);
  assert.deepEqual(again.map(notice => notice.seq), [33, 34]);
  assert.equal(active.count + again.reduce((sum, notice) => sum + notice.count, 0), 34);
  assert.deepEqual(queue, before);
});

void test('the initial render establishes a silent baseline and leaves a nonblocking accessible output', () => {
  const markup = renderToStaticMarkup(<AutomaticActionNotice events={events(1, 250)} />);
  assert.match(markup, /aria-label="Automatic action notices"/);
  assert.match(markup, /aria-pressed="true"/);
  assert.match(markup, /<output[^>]+aria-live="polite"/);
  assert.match(markup, /pointer-events-none/);
  assert.doesNotMatch(markup, /Action 250|earlier actions also completed|role="dialog"/);
});

void test('duplicate and stale snapshots do not replay, while new sequences remain ordered', () => {
  const old = events(1, 5), fresh = events(6, 3);
  const next = advanceActionNotices({ seenSeq: 5, pending: [] }, [...fresh.toReversed(), ...old, fresh[1]], { active: false, show: true });
  assert.equal(next.seenSeq, 8);
  assert.deepEqual(next.pending.map(notice => notice.seq), [6, 7, 8]);
  assert.deepEqual(next.pending.map(notice => notice.count), [1, 1, 1]);
  assert.deepEqual(advanceActionNotices({ ...next, pending: [] }, old, { active: false, show: true }), { seenSeq: 8, pending: [] });
});

void test('muted or hidden updates consume their sequences and clear pending feedback without later replay', () => {
  const initial = { seenSeq: 2, pending: appendActionNotices([], events(1, 2), false) };
  const quiet = advanceActionNotices(initial, events(1, 20), { active: true, show: false });
  assert.deepEqual(quiet, { seenSeq: 20, pending: [] });
  const shown = advanceActionNotices(quiet, events(1, 20), { active: false, show: true });
  assert.deepEqual(shown, quiet);
  const next = advanceActionNotices(shown, events(18, 4), { active: false, show: true });
  assert.deepEqual(next.pending, [{ ...events(21, 1)[0], faction: 'emperor', count: 1 }]);
  assert.equal(initial.pending.length, 2);
});
