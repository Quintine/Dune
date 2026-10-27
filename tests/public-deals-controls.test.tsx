import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PublicDealList, PublicDeals } from '../components/public-deals';
import type { Action, GameView } from '../game/engine';

type Element = ReactElement<{ children?: ReactNode; [key: string]: unknown }>;
function elements(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<{ children?: ReactNode; [key: string]: unknown }>(node)) return [];
  return [node, ...elements(node.props.children)];
}
const offer = { id: 'deal-1', from: 'a', to: 'b', terms: 'Pay 3 spice later', turn: 2, status: 'offered', releaseVotes: [] };
const base = {
  status: 'playing', me: 'a', roomControl: null,
  players: [
    { id: 'a', name: 'Alice', faction: 'atreides', ally: 'c' },
    { id: 'b', name: 'Basil', faction: 'harkonnen' },
    { id: 'c', name: 'Chani', faction: 'fremen', ally: 'a' },
    { id: 'd', name: 'Duncan', faction: 'guild', bot: 'Medium' },
    { id: 'e', name: 'Emperor', faction: 'emperor', ally: 'b' },
  ],
  deals: [offer],
} as unknown as GameView;
const record = (calls: Action[]) => (action: Action) => { calls.push(action); };
function actions(game: GameView, calls: Action[], disabled = false) {
  return elements(PublicDealList({ game, act: record(calls), disabled }))
    .filter(element => typeof element.props.onClick === 'function');
}
function click(nodes: Element[], label: string) {
  const node = nodes.find(element => element.props.children === label);
  assert.ok(node, `Missing ${label}`);
  (node.props.onClick as () => void)();
}
function render(game: GameView, busy = false) {
  return renderToStaticMarkup(createElement(PublicDeals, { game, act() {}, busy }));
}

void test('deal form exposes human non-allied recipients and clearly describes limits', () => {
  const html = render(base);
  assert.match(html, /Public deals/);
  assert.match(html, /Basil · Harkonnen/);
  assert.match(html, /Emperor · Emperor/);
  assert.doesNotMatch(html, /Chani · Fremen/);
  assert.doesNotMatch(html, /Duncan · Spacing Guild/);
  assert.match(html, /cannot automatically enforce free-text promises/);
  assert.match(html, /does not automatically transfer spice/);
  assert.match(html, /Do not trade cards, forces, leaders or faction powers/);
  assert.match(html, /maxlength="500"/i);
  assert.match(html, /Alice \(Atreides\) → Basil \(Harkonnen\)/);
  assert.match(html, /Offer public deal/);
  assert.equal(render({ ...base, status: 'lobby' }), '');
  assert.doesNotMatch(render({ ...base, status: 'finished' }), /Offer public deal/);
  assert.doesNotMatch(render({ ...base, me: 'd' }), /Offer public deal/);
  assert.ok((render(base, true).match(/disabled=""/g) ?? []).length >= 3);
});

void test('offer actions are available only to the corresponding parties', () => {
  const calls: Action[] = [];
  click(actions(base, calls), 'Withdraw offer');
  const recipient = { ...base, me: 'b' };
  assert.match(render(recipient), /your response requested/);
  const choices = actions(recipient, calls);
  click(choices, 'Accept deal');
  click(choices, 'Decline deal');
  assert.deepEqual(calls, [
    { type: 'dealWithdraw', deal: 'deal-1' },
    { type: 'dealRespond', deal: 'deal-1', accept: true },
    { type: 'dealRespond', deal: 'deal-1', accept: false },
  ]);
  assert.equal(actions({ ...base, me: 'e' }, calls).length, 0);
  assert.ok(actions(recipient, calls, true).every(node => node.props.disabled));
});

void test('either party can request, agree to, or withdraw mutual release', () => {
  const calls: Action[] = [];
  const active = { ...offer, status: 'active' as const, releaseVotes: [] };
  const current = { ...base, deals: [active] } as unknown as GameView;
  click(actions(current, calls), 'Request release of deal');
  const requested = { ...current, deals: [{ ...active, releaseVotes: ['a'] }] } as unknown as GameView;
  assert.match(render({ ...requested, me: 'b' }), /your response requested/);
  click(actions(requested, calls), 'Withdraw release request');
  click(actions({ ...requested, me: 'b' }, calls), 'Agree to release deal');
  assert.equal(actions({ ...requested, me: 'c' }, calls).length, 0);
  assert.deepEqual(calls, [
    { type: 'dealRelease', deal: 'deal-1', agree: true },
    { type: 'dealRelease', deal: 'deal-1', agree: false },
    { type: 'dealRelease', deal: 'deal-1', agree: true },
  ]);
  const html = render(requested);
  assert.match(html, /Release requested by Alice/);
  assert.match(html, /Both parties must agree/);
});

void test('all statuses and public text remain readable without treating text as markup', () => {
  const game = { ...base, deals: [
    { ...offer, terms: '<b>example</b>', status: 'active' },
    { ...offer, id: 'deal-2', status: 'released', releaseVotes: ['a', 'b'] },
    { ...offer, id: 'deal-3', status: 'declined' },
    { ...offer, id: 'deal-4', status: 'withdrawn' },
  ] } as unknown as GameView;
  const html = render(game);
  assert.match(html, /&lt;b&gt;example&lt;\/b&gt;/);
  for (const status of ['active', 'released', 'declined', 'withdrawn']) assert.match(html, new RegExp(status));
  assert.equal(actions({ ...game, status: 'finished' }, []).length, 0);
});
