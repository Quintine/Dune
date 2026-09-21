import test from 'node:test';
import assert from 'node:assert/strict';
import { Children, isValidElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ActionNoticeCard, AutomaticActionNotice } from '../components/automatic-action-notice';
import { Button } from '../components/ui/button';
import { advanceActionNotices, appendActionNotices, initialActionNotices, updateActionNotices, type AutomaticActionEvent } from '../lib/action-notice-queue';

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

void test('a full log batch becomes three notices while accounting for every action', () => {
  const incoming = events(1, 250);
  const queue = appendActionNotices([], incoming, false);
  assert.equal(queue.length, 3);
  assert.deepEqual(queue.map(notice => notice.seq), [248, 249, 250]);
  assert.deepEqual(queue.map(notice => notice.count), [248, 1, 1]);
  assert.equal(queue.reduce((sum, notice) => sum + notice.count, 0), 250);
  assert.equal(queue[0].name, incoming[247].name);
  assert.equal(queue[0].faction, incoming[247].faction);
});

void test('unread action text survives new bursts and each Continue advances only the local queue', () => {
  const initial = initialActionNotices(events(1, 4));
  assert.deepEqual(initial, { seenSeq: 4, pending: [], active: null });
  const shown = updateActionNotices(initial, { type: 'events', events: events(1, 7), enabled: true, visible: true });
  assert.equal(shown.active?.seq, 5);
  const before = structuredClone(shown);
  const burst = updateActionNotices(shown, { type: 'events', events: events(8, 250), enabled: true, visible: true });
  assert.deepEqual(burst.active, shown.active);
  assert.equal(burst.pending.length, 2);
  assert.equal((burst.active?.count ?? 0) + burst.pending.reduce((sum, notice) => sum + notice.count, 0), 253);
  assert.deepEqual(shown, before);
  const first = updateActionNotices(burst, { type: 'continue' });
  assert.deepEqual(first.active, burst.pending[0]);
  assert.deepEqual(first.pending, burst.pending.slice(1));
  const second = updateActionNotices(first, { type: 'continue' });
  assert.deepEqual(second.active, burst.pending[1]);
  const finished = updateActionNotices(second, { type: 'continue' });
  assert.deepEqual(finished, { seenSeq: 257, pending: [], active: null });
  assert.deepEqual(updateActionNotices(finished, { type: 'events', events: events(1, 257), enabled: true, visible: true }), finished);
});

void test('backgrounding retains the unread notice while discarding pending and hidden events without replay', () => {
  const shown = updateActionNotices(initialActionNotices([]), { type: 'events', events: events(1, 3), enabled: true, visible: true });
  const hidden = updateActionNotices(shown, { type: 'hide' });
  assert.deepEqual(hidden.active, shown.active);
  assert.deepEqual(hidden.pending, []);
  const updated = updateActionNotices(hidden, { type: 'events', events: events(1, 20), enabled: true, visible: false });
  assert.deepEqual(updated, { seenSeq: 20, pending: [], active: shown.active });
  const returned = updateActionNotices(updated, { type: 'events', events: events(1, 20), enabled: true, visible: true });
  assert.deepEqual(returned, updated);
  const dismissed = updateActionNotices(returned, { type: 'continue' });
  assert.deepEqual(dismissed, { seenSeq: 20, pending: [], active: null });
});

void test('turning notices off clears unread content and consumes muted updates without replay', () => {
  const shown = updateActionNotices(initialActionNotices([]), { type: 'events', events: events(1, 3), enabled: true, visible: true });
  assert.deepEqual(updateActionNotices(shown, { type: 'clear' }), { seenSeq: 3, pending: [], active: null });
  const muted = updateActionNotices(shown, { type: 'events', events: events(1, 20), enabled: false, visible: true });
  assert.deepEqual(muted, { seenSeq: 20, pending: [], active: null });
  assert.deepEqual(updateActionNotices(muted, { type: 'events', events: events(1, 20), enabled: true, visible: true }), muted);
});

void test('an action card exposes a readable local Continue button without modal or automatic focus behavior', () => {
  let continued = 0;
  const notice = { ...events(1, 1)[0], name: 'Shipment completed', count: 8 };
  const card = ActionNoticeCard({ notice, onContinue: () => { continued++; } });
  const markup = renderToStaticMarkup(card);
  assert.match(markup, /Atreides/);
  assert.match(markup, /Shipment completed/);
  assert.match(markup, /7 earlier actions.*table chronicle/);
  assert.match(markup, /pointer-events-auto/);
  assert.match(markup, /text-base/);
  assert.match(markup, /<button[^>]*type="button"[^>]*>Continue<\/button>/);
  assert.doesNotMatch(markup, /text-xs|autofocus|aria-modal|role="dialog"/);
  const control = Children.toArray(card.props.children).filter(isValidElement).find(child => child.type === Button);
  assert.ok(control);
  (control.props as { onClick: () => void }).onClick();
  assert.equal(continued, 1);
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
