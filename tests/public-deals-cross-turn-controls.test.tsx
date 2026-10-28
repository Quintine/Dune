import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { createElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as jsxRuntime from 'react/jsx-runtime';
import ts from 'typescript';
import * as catalog from '../game/catalog';
import * as publicDeals from '../game/public-deals';
import { PublicDealList, PublicDeals, publicDealOfferAction, publicDealRequests } from '../components/public-deals';
import type { Action, GameView } from '../game/engine';

type Element = ReactElement<{ children?: ReactNode; [key: string]: unknown }>;
function elements(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<{ children?: ReactNode; [key: string]: unknown }>(node)) return [];
  return [node, ...elements(node.props.children)];
}
const payment = { kind: 'deferredBribe', payer: 'a', recipient: 'b', amount: 3, dueTurn: 5 } as const;
const deal = { id: 'deal', from: 'a', to: 'b', terms: 'A promise.', turn: 2,
  status: 'active', releaseVotes: [], payment, paymentStatus: 'pending' };
const base = { status: 'playing', turn: 2, me: 'a', roomControl: null,
  players: [{ id: 'a', name: 'Alice', faction: 'atreides' }, { id: 'b', name: 'Basil', faction: 'harkonnen' }],
  deals: [deal], deferredDealPaymentOptions: { deal: { blocked: null } },
} as unknown as GameView;
const buttons = (game: GameView, calls: Action[]) => elements(PublicDealList({ game, act: action => calls.push(action), disabled: false }))
  .filter(element => typeof element.props.onClick === 'function');
const find = (nodes: Element[], label: string) => nodes.find(node => node.props.children === label);
const html = (game: GameView) => renderToStaticMarkup(createElement(PublicDealList, { game, act() {}, disabled: false }));

void test('offers accept a whole current or future deadline without an invented maximum', () => {
  for (const dueTurn of [2, 5, 1_000_000]) {
    assert.deepEqual(publicDealOfferAction(['b'], ' Terms ', { ...payment, dueTurn }, 'a', 2),
      { type: 'dealOffer', target: 'b', terms: 'Terms', payment: { ...payment, dueTurn } });
  }
  for (const dueTurn of [0, 1, 1.5, NaN, Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(publicDealOfferAction(['b'], 'Terms', { ...payment, dueTurn }, 'a', 2), null);
  }
});

void test('future offers remain acceptable through the deadline, then can only be declined', () => {
  const offered = { ...deal, status: 'offered', paymentStatus: undefined };
  const game = { ...base, me: 'b', bribeOptions: { blocked: 'Finish the current decision.' }, deals: [offered] } as unknown as GameView;
  const calls: Action[] = [];
  for (const turn of [2, 5]) {
    assert.equal(find(buttons({ ...game, turn }, calls), 'Accept deal')?.props.disabled, false);
    assert.doesNotMatch(html({ ...game, turn }), /due turn has passed/);
  }
  const expired = { ...game, turn: 6 };
  assert.match(html(expired), /due turn has passed/);
  assert.equal(find(buttons(expired, calls), 'Accept deal')?.props.disabled, true);
  assert.equal(find(buttons(expired, calls), 'Decline deal')?.props.disabled, false);
});

void test('a future pending payment stays visible and can be paid early when projected legal', () => {
  const calls: Action[] = [];
  assert.match(html(base), /on or before the end of turn 5/);
  assert.match(html(base), /Payment status: pending/);
  const pay = find(buttons(base, calls), 'Pay agreed amount');
  assert.ok(pay); assert.equal(pay.props.disabled, false);
  (pay.props.onClick as () => void)();
  assert.deepEqual(calls, [{ type: 'dealPay', deal: 'deal' }]);
  const blocked = { ...base, deferredDealPaymentOptions: { deal: { blocked: 'Finish the current decision.' } } } as unknown as GameView;
  assert.match(html(blocked), /Finish the current decision/);
  assert.equal(find(buttons(blocked, calls), 'Pay agreed amount')?.props.disabled, true);
});

void test('payment attention starts on the due turn while future payment remains in history', () => {
  assert.deepEqual(publicDealRequests(base), []);
  const future = renderToStaticMarkup(createElement(PublicDeals, { game: base, act() {}, busy: false }));
  assert.doesNotMatch(future, /Public deals · payment due/);
  assert.match(future, /Payment status: pending/);
  for (const turn of [5, 6]) assert.deepEqual(publicDealRequests({ ...base, turn }), [['payment', 'deal']]);
  const released = { ...base, deals: [{ ...deal, status: 'released', paymentStatus: 'released' }] } as unknown as GameView;
  assert.deepEqual(publicDealRequests({ ...released, turn: 5 }), []);
  const withRelease = { ...base, deals: [{ ...deal, releaseVotes: ['b'] }] } as unknown as GameView;
  assert.deepEqual(publicDealRequests(withRelease), [['release', 'deal', 'b']]);
});

/** Exercise the real controlled form callbacks without claiming browser hydration. */
function controller(game: GameView) {
  const states: unknown[] = [], sent: Action[] = [];
  let cursor = 0;
  const exports: { PublicDeals?: typeof PublicDeals } = {};
  runInNewContext(ts.transpileModule(readFileSync(new URL('../components/public-deals.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, {
    exports,
    require(name: string) {
      if (name === 'react/jsx-runtime') return jsxRuntime;
      if (name === 'react') return {
        useState(initial: unknown) {
          const index = cursor++;
          if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;
          return [states[index], (next: unknown) => { states[index] = typeof next === 'function' ? next(states[index]) : next; }];
        },
        useRef: () => ({ current: null }), useEffect: () => {},
      };
      if (name === '@/components/ui/button') return { Button: 'button' };
      if (name === '@/game/catalog') return catalog;
      if (name === '@/game/public-deals') return publicDeals;
      throw new Error(`Unexpected import ${name}`);
    },
  });
  assert.ok(exports.PublicDeals);
  const render = () => { cursor = 0; return elements(exports.PublicDeals!({ game, busy: false, act: action => sent.push(action) })); };
  return { render, sent };
}

void test('the authoring form selects and validates a cross-turn deadline', () => {
  const ui = controller(base);
  const check = (index: number) => {
    const input = ui.render().filter(element => element.type === 'input' && element.props.type === 'checkbox')[index];
    assert.ok(input);
    (input.props.onChange as (event: { target: { checked: boolean } }) => void)({ target: { checked: true } });
  };
  const choose = (index: number, value: string) => {
    const select = ui.render().filter(element => element.type === 'select')[index]; assert.ok(select);
    (select.props.onChange as (event: { target: { value: string } }) => void)({ target: { value } });
  };
  check(0); check(1); choose(0, 'deferredBribe'); choose(1, 'a'); choose(2, 'b');
  const textarea = ui.render().find(element => element.type === 'textarea'); assert.ok(textarea);
  (textarea.props.onChange as (event: { target: { value: string } }) => void)({ target: { value: 'Terms' } });
  const editDue = (value: string) => {
    const input = ui.render().find(element => element.type === 'input' && element.props.type === 'number' && element.props.min === 2);
    assert.ok(input); assert.equal(input.props.max, undefined);
    (input.props.onChange as (event: { target: { value: string } }) => void)({ target: { value } });
  };
  editDue('5');
  const form = ui.render().find(element => element.type === 'form'); assert.ok(form);
  (form.props.onSubmit as (event: { preventDefault(): void }) => void)({ preventDefault() {} });
  assert.deepEqual(JSON.parse(JSON.stringify(ui.sent[0])), { type: 'dealOffer', target: 'b', terms: 'Terms', payment: { ...payment, amount: 1 } });
  editDue('1');
  const submit = ui.render().find(element => element.type === 'button' && element.props.type === 'submit');
  assert.ok(submit); assert.equal(submit.props.disabled, true);
  const invalidForm = ui.render().find(element => element.type === 'form'); assert.ok(invalidForm);
  (invalidForm.props.onSubmit as (event: { preventDefault(): void }) => void)({ preventDefault() {} });
  assert.equal(ui.sent.length, 1);
});
