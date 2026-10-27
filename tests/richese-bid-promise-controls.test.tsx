import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RicheseBidPromiseFields, richeseBidMinimumError } from '../components/richese-bid-promise-fields';
import { RicheseBidPromiseGuide, RicheseBidPromisePanel, type RicheseBidPromisePanelProps } from '../components/richese-bid-promise-panel';
import type { Action } from '../game/engine';

type ElementProps = { children?: ReactNode; [key: string]: unknown };
function elements(node: ReactNode): ReactElement<ElementProps>[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<ElementProps>(node)) return [];
  return [node, ...elements(node.props.children)];
}
function edit(props: Parameters<typeof RicheseBidPromiseFields>[0], minimum: number) {
  const input = elements(RicheseBidPromiseFields(props)).find(element =>
    element.props.id === 'truth-richese-bid-minimum' && typeof element.props.onChange === 'function');
  assert.ok(input);
  (input.props.onChange as (event: { currentTarget: { valueAsNumber: number } }) => void)({ currentTarget: { valueAsNumber: minimum } });
}
function projected(type: 'bid' | 'pass' | 'zero' = 'bid'): { props: RicheseBidPromisePanelProps; sent: Action[] } {
  const sent: Action[] = [];
  const props: RicheseBidPromisePanelProps = {
    promises: [{ id: 'receipt-1', turn: 2, event: 'lot-1', minimum: 4, answer: type === 'bid' }],
    guide: { action: { type: 'richeseBid', event: 'lot-1', richeseBidPromiseId: 'receipt-1',
      amount: type === 'bid' ? 4 : type === 'zero' ? 0 : null, allyPayment: 0 } },
    game: { turn: 2, richeseAuction: { event: 'lot-1', method: type === 'zero' ? 'silent' : 'onceAround' } }, busy: false,
    act(action) { sent.push(action); },
  };
  return { props, sent };
}

void test('Richese Once Around condition accepts only positive safe integer minima', () => {
  const changes: number[] = [], props = { minimum: 4, disabled: false, onMinimum: (value: number) => changes.push(value) };
  const html = renderToStaticMarkup(createElement(RicheseBidPromiseFields, props));
  assert.match(html, /Once Around/);
  assert.match(html, /Earlier declarations do not count/);
  for (const value of [1, 7, Number.MAX_SAFE_INTEGER]) edit(props, value);
  assert.deepEqual(changes, [1, 7, Number.MAX_SAFE_INTEGER]);
  for (const value of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.ok(richeseBidMinimumError(value)); edit(props, value);
  }
  edit({ ...props, disabled: true }, 8);
  assert.equal(changes.length, 3);
});

void test('owned receipt panel explains binding, fulfilled and released answers', () => {
  const { props } = projected();
  props.promises.push(
    { id: 'no', event: 'lot-1', turn: 2, minimum: 8, answer: false },
    { id: 'done', event: 'lot-1', turn: 2, minimum: 2, answer: true, fulfilled: true },
    { id: 'released', event: 'lot-1', turn: 2, minimum: 12, answer: true, released: true },
  );
  const html = renderToStaticMarkup(createElement(RicheseBidPromisePanel, props));
  assert.match(html, /Your Once Around bid promises/);
  assert.match(html, /No forbids a qualifying bid/);
  assert.match(html, /Fulfilled: this commitment is complete/);
  assert.match(html, /Released: this commitment is no longer possible/);
  assert.doesNotMatch(html, /receipt-1|lot-1/);
});

void test('guide sends the exact server action and rejects busy, stale or completed receipts', () => {
  for (const type of ['bid', 'pass'] as const) {
    const { props, sent } = projected(type);
    const button = RicheseBidPromiseGuide(props); assert.ok(button);
    button.props.onClick();
    assert.deepEqual(sent, [props.guide!.action]);
    assert.equal(sent[0], props.guide!.action);
    const stale = RicheseBidPromiseGuide(props); assert.ok(stale);
    props.game.richeseAuction!.event = 'later-lot'; stale.props.onClick();
    assert.equal(sent.length, 1);
    assert.equal(RicheseBidPromiseGuide(props), null);
  }
  const { props, sent } = projected();
  const button = RicheseBidPromiseGuide(props); assert.ok(button);
  props.busy = true; button.props.onClick();
  assert.deepEqual(sent, []);
  const busyButton = RicheseBidPromiseGuide(props); assert.ok(busyButton);
  assert.equal(busyButton.props.disabled, true);
  props.busy = false;
  const completed = RicheseBidPromiseGuide(props); assert.ok(completed);
  props.promises[0].fulfilled = true; completed.props.onClick();
  assert.deepEqual(sent, []);
  assert.equal(RicheseBidPromiseGuide(props), null);
  props.promises[0].fulfilled = false;
  props.game.turn = 3;
  assert.equal(RicheseBidPromiseGuide(props), null);
});

void test('Silent question and private receipt explain sealed submissions without showing lot or receipt identifiers', () => {
  const fields = renderToStaticMarkup(createElement(RicheseBidPromiseFields, {
    minimum: 4, disabled: false, method: 'silent', onMinimum() {},
  }));
  assert.match(fields, /Silent auction/);
  assert.match(fields, /unsubmitted sealed bid/);
  assert.match(fields, /submitted amounts remain private until bids are revealed/);
  const { props } = projected('zero');
  const panel = renderToStaticMarkup(createElement(RicheseBidPromisePanel, props));
  assert.match(panel, /Your Silent bid promises/);
  assert.match(panel, /Submit zero spice while honoring your answer/);
  assert.match(panel, /Your submitted amount remains private until all bids are revealed/);
  assert.doesNotMatch(panel, /receipt-1|lot-1/);
});

void test('Silent zero guide submits the exact quoted action and refuses a stale event', () => {
  const { props, sent } = projected('zero');
  const button = RicheseBidPromiseGuide(props); assert.ok(button);
  button.props.onClick();
  assert.deepEqual(sent, [props.guide!.action]);
  assert.equal(sent[0].amount, 0);
  const stale = RicheseBidPromiseGuide(props); assert.ok(stale);
  props.game.richeseAuction!.event = 'later-lot';
  stale.props.onClick();
  assert.equal(sent.length, 1);
  assert.equal(RicheseBidPromiseGuide(props), null);
});
