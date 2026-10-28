import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PublicDealList, PublicDeals, publicDealOfferAction } from '../components/public-deals';
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
  assert.match(html, /Chani · Fremen \(allied with a selected party\)/);
  assert.doesNotMatch(html, /Duncan · Spacing Guild/);
  assert.match(html, /cannot automatically enforce free-text promises/);
  assert.match(html, /free-text terms do not automatically transfer spice/);
  assert.match(html, /Include a spice payment/);
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
  assert.match(html, /All parties must agree/);
});

void test('the form keeps the legacy packet for one seat and sends all selected seats for multiparty offers', () => {
  assert.deepEqual(publicDealOfferAction(['b'], '  Terms  '), { type: 'dealOffer', target: 'b', terms: 'Terms' });
  assert.deepEqual(publicDealOfferAction(['b', 'e'], 'Terms'), { type: 'dealOffer', targets: ['b', 'e'], terms: 'Terms' });
  assert.equal(publicDealOfferAction([], 'Terms'), null);
  assert.equal(publicDealOfferAction(['b', 'b'], 'Terms'), null);
  assert.equal(publicDealOfferAction(['b'], '  '), null);
  assert.equal(publicDealOfferAction(['b'], 'x'.repeat(501)), null);
});

void test('an optional gross bribe is bound to two distinct participants', () => {
  const payment = { kind: 'immediateBribe' as const, payer: 'a', recipient: 'b', amount: 3 };
  assert.deepEqual(publicDealOfferAction(['b'], ' Terms ', payment, 'a'),
    { type: 'dealOffer', target: 'b', terms: 'Terms', payment });
  const thirdPartyPayment = { ...payment, payer: 'b', recipient: 'e' };
  assert.deepEqual(publicDealOfferAction(['b', 'e'], 'Terms', thirdPartyPayment, 'a'),
    { type: 'dealOffer', targets: ['b', 'e'], terms: 'Terms', payment: thirdPartyPayment });
  for (const invalid of [
    { ...payment, payer: 'outsider' }, { ...payment, recipient: 'outsider' },
    { ...payment, payer: 'b' }, { ...payment, amount: 0 }, { ...payment, amount: 1.5 },
    { ...payment, amount: Number.MAX_SAFE_INTEGER + 1 },
  ]) assert.equal(publicDealOfferAction(['b'], 'Terms', invalid, 'a'), null);
  assert.equal(publicDealOfferAction(['b'], 'Terms', payment), null);
});

void test('all players can review the gross payment and only final acceptance is held at a blocked payment window', () => {
  const payment = { kind: 'immediateBribe' as const, payer: 'b', recipient: 'a', amount: 3 };
  const multi = { ...offer, participants: ['a', 'b', 'e'], acceptVotes: ['a'], payment };
  const game = { ...base, players: base.players.map(player =>
    player.id === 'b' || player.id === 'e' ? { ...player, ally: null } : player),
  bribeOptions: { blocked: 'Finish the current decision before paying a bribe.', available: 987, incoming: 0, targets: [] },
  deals: [multi] } as unknown as GameView;
  const html = render({ ...game, me: 'b' });
  assert.match(html, /Immediate payment term/);
  assert.match(html, /Basil \(Harkonnen\) pays 3 spice to Alice \(Atreides\)/);
  assert.match(html, /payer loses the gross amount immediately/);
  assert.match(html, /Bureaucrat may divert two spice/);
  assert.doesNotMatch(html, /987/);
  const first = actions({ ...game, me: 'b' }, []);
  assert.equal(first.find(node => node.props.children === 'Accept deal')?.props.disabled, false);
  const lastGame = { ...game, me: 'e', deals: [{ ...multi, acceptVotes: ['a', 'b'] }] } as unknown as GameView;
  const last = actions(lastGame, []);
  assert.equal(last.find(node => node.props.children === 'Accept deal')?.props.disabled, true);
  assert.equal(last.find(node => node.props.children === 'Decline deal')?.props.disabled, false);
  assert.match(render(lastGame), /Final acceptance must wait: Finish the current decision before paying a bribe/);
  const unblocked = { ...lastGame, bribeOptions: { ...lastGame.bribeOptions, blocked: null } } as GameView;
  assert.equal(actions(unblocked, []).find(node => node.props.children === 'Accept deal')?.props.disabled, false);
});

void test('multiparty offers expose all pending consent and let an accepted recipient decline', () => {
  const multi = {
    ...offer, participants: ['a', 'b', 'e'], acceptVotes: ['a', 'b'],
  };
  const game = { ...base, players: base.players.map(player =>
    player.id === 'b' || player.id === 'e' ? { ...player, ally: null } : player), deals: [multi] } as unknown as GameView;
  const html = render(game);
  assert.match(html, /Alice \(Atreides\) → Basil \(Harkonnen\), Emperor \(Emperor\)/);
  assert.match(html, /Accepted by Alice \(Atreides\), Basil \(Harkonnen\)/);
  assert.match(html, /Waiting for Emperor \(Emperor\)/);
  const calls: Action[] = [];
  const accepted = actions({ ...game, me: 'b' }, calls);
  assert.equal(accepted.length, 1);
  click(accepted, 'Decline deal');
  assert.doesNotMatch(render({ ...game, me: 'b' }), /your response requested/);
  const waiting = { ...game, me: 'e' };
  assert.match(render(waiting), /your response requested/);
  click(actions(waiting, calls), 'Accept deal');
  assert.deepEqual(calls, [
    { type: 'dealRespond', deal: 'deal-1', accept: false },
    { type: 'dealRespond', deal: 'deal-1', accept: true },
  ]);
  assert.equal(actions({ ...game, me: 'c' }, calls).length, 0);
});

void test('an offer remains declinable when new alliances make acceptance unavailable', () => {
  const multi = { ...offer, participants: ['a', 'b', 'e'], acceptVotes: ['a'] };
  const game = { ...base, me: 'e', deals: [multi] } as unknown as GameView;
  const choices = actions(game, []);
  assert.equal(choices.find(node => node.props.children === 'Accept deal')?.props.disabled, true);
  assert.equal(choices.find(node => node.props.children === 'Decline deal')?.props.disabled, false);
  assert.match(render(game), /Acceptance is unavailable while any participants are allied/);
});

void test('all multiparty signatories participate in mutual release', () => {
  const multi = {
    ...offer, participants: ['a', 'b', 'e'], acceptVotes: ['a', 'b', 'e'],
    status: 'active', releaseVotes: ['a', 'b'],
  };
  const game = { ...base, deals: [multi] } as unknown as GameView;
  const calls: Action[] = [];
  assert.match(render({ ...game, me: 'e' }), /your response requested/);
  click(actions({ ...game, me: 'e' }, calls), 'Agree to release deal');
  click(actions({ ...game, me: 'b' }, calls), 'Withdraw release request');
  assert.deepEqual(calls, [
    { type: 'dealRelease', deal: 'deal-1', agree: true },
    { type: 'dealRelease', deal: 'deal-1', agree: false },
  ]);
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
