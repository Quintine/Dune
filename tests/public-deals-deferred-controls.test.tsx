import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PublicDealList, PublicDeals, publicDealOfferAction, publicDealRequests } from '../components/public-deals';
import type { Action, GameView } from '../game/engine';

type Element = ReactElement<{ children?: ReactNode; [key: string]: unknown }>;
function elements(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<{ children?: ReactNode; [key: string]: unknown }>(node)) return [];
  return [node, ...elements(node.props.children)];
}
const payment = { kind: 'deferredBribe', payer: 'a', recipient: 'b', amount: 3, dueTurn: 2 } as const;
const deal = { id: 'deal', from: 'a', to: 'b', terms: 'A promise.', turn: 2,
  status: 'active', releaseVotes: [], payment, paymentStatus: 'pending' };
const base = { status: 'playing', turn: 2, me: 'a', roomControl: null,
  players: [{ id: 'a', name: 'Alice', faction: 'atreides' }, { id: 'b', name: 'Basil', faction: 'harkonnen' }],
  deals: [deal], deferredDealPaymentOptions: { deal: { blocked: null } },
} as unknown as GameView;
const html = (game: GameView) => renderToStaticMarkup(createElement(PublicDealList, { game, act() {}, disabled: false }));
function buttons(game: GameView, calls: Action[], disabled = false) {
  return elements(PublicDealList({ game, act: action => calls.push(action), disabled }))
    .filter(element => typeof element.props.onClick === 'function');
}
const find = (nodes: Element[], text: string) => nodes.find(node => node.props.children === text);

void test('an offer binds the exact deferred gross payment, due turn and distinct participants', () => {
  assert.deepEqual(publicDealOfferAction(['b'], ' Terms ', payment, 'a'),
    { type: 'dealOffer', target: 'b', terms: 'Terms', payment });
  for (const bad of [
    { ...payment, payer: 'b' }, { ...payment, recipient: 'outside' },
    { ...payment, amount: 0 }, { ...payment, amount: 1.5 },
    { ...payment, dueTurn: 0 }, { ...payment, dueTurn: 1.5 },
  ]) assert.equal(publicDealOfferAction(['b'], 'Terms', bad, 'a'), null);
});

void test('only the payer can pay a pending active term through its exact deal', () => {
  const calls: Action[] = [];
  const markup = html(base);
  assert.match(markup, /Deferred payment term/);
  assert.match(markup, /exactly 3 spice/);
  assert.match(markup, /end of turn 2/);
  assert.match(markup, /Payment status: pending/);
  assert.match(markup, /next Mentat opening/);
  assert.match(markup, /Bureaucrat/);
  const button = find(buttons(base, calls), 'Pay agreed amount');
  assert.ok(button); assert.equal(button.props.disabled, false);
  (button.props.onClick as () => void)();
  assert.deepEqual(calls, [{ type: 'dealPay', deal: 'deal' }]);
  assert.equal(find(buttons({ ...base, me: 'b' }, calls), 'Pay agreed amount'), undefined);
  assert.equal(find(buttons({ ...base, deals: [{ ...deal, paymentStatus: 'paid' }] } as unknown as GameView, calls), 'Pay agreed amount'), undefined);
  assert.equal(find(buttons({ ...base, deals: [{ ...deal, status: 'released', paymentStatus: 'released' }] } as unknown as GameView, calls), 'Pay agreed amount'), undefined);
});

void test('payer sees the server reason and cannot initiate an unavailable payment', () => {
  const calls: Action[] = [];
  const blocked = { ...base, deferredDealPaymentOptions: { deal: { blocked: 'Finish the current decision.' } } } as unknown as GameView;
  assert.match(html(blocked), /Finish the current decision/);
  const button = find(buttons(blocked, calls), 'Pay agreed amount');
  assert.ok(button); assert.equal(button.props.disabled, true);
  assert.equal(find(buttons(base, calls, true), 'Pay agreed amount')?.props.disabled, true);
  const unknown = { ...base, deferredDealPaymentOptions: {} } as unknown as GameView;
  assert.equal(find(buttons(unknown, calls), 'Pay agreed amount')?.props.disabled, true);
  assert.deepEqual(calls, []);
});

void test('a pending payment opens the payer’s persistent request panel and remains until resolved', () => {
  assert.deepEqual(publicDealRequests(base), [['payment', 'deal']]);
  assert.match(renderToStaticMarkup(createElement(PublicDeals, { game: base, act() {}, busy: false })), /Public deals · payment due/);
  assert.deepEqual(publicDealRequests({ ...base, me: 'b' }), []);
  const requested = { ...base, deals: [{ ...deal, releaseVotes: ['b'] }] } as unknown as GameView;
  assert.deepEqual(publicDealRequests(requested), [['release', 'deal', 'b'], ['payment', 'deal']]);
  const paid = { ...base, deals: [{ ...deal, paymentStatus: 'paid' }] } as unknown as GameView;
  assert.deepEqual(publicDealRequests(paid), []);
  assert.doesNotMatch(renderToStaticMarkup(createElement(PublicDeals, { game: paid, act() {}, busy: false })), /Public deals · payment due/);
  const voided = { ...base, deals: [{ ...deal, paymentStatus: 'void' }] } as unknown as GameView;
  assert.deepEqual(publicDealRequests(voided), []);
});

void test('deferred final acceptance does not require an immediate bribe window, but an expired offer cannot be accepted', () => {
  const offered = { ...deal, status: 'offered', paymentStatus: undefined };
  const game = { ...base, me: 'b', bribeOptions: { blocked: 'Finish the current decision.' }, deals: [offered] } as unknown as GameView;
  const calls: Action[] = [];
  const accept = find(buttons(game, calls), 'Accept deal');
  assert.ok(accept); assert.equal(accept.props.disabled, false);
  (accept.props.onClick as () => void)();
  assert.deepEqual(calls, [{ type: 'dealRespond', deal: 'deal', accept: true }]);
  const expired = { ...game, turn: 3 };
  assert.match(html(expired), /due turn has passed/);
  assert.equal(find(buttons(expired, calls), 'Accept deal')?.props.disabled, true);
  assert.equal(find(buttons(expired, calls), 'Decline deal')?.props.disabled, false);
});
