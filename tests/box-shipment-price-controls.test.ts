import assert from 'node:assert/strict';
import test from 'node:test';
import { Children, createElement, isValidElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NullentropyBox, NullentropySearch } from '../components/nullentropy-box';
import { createGame, joinGame, newPlayer, viewGame, type Action, type GameView } from '../game/engine';
import { baseDeck } from '../game/cards';
import { richeseCards } from '../game/richese-cards';

// Controlled owner projections supplement the native Box/price source suite.
// They prove presentation and the actual hook-free selection callback only;
// no paid Game state, original cost identity or refund receipt is installed.
function projected(paid = false) {
  const game = createGame('BOXSHIPMENTPRICECONTROLS', newPlayer('a', 'Atreides', 'atreides'), false, ['choam']);
  joinGame(game, newPlayer('r', 'Richese', 'richese'));
  joinGame(game, newPlayer('g', 'Guild', 'guild'));
  const view = viewGame(game, 'a');
  const box = richeseCards().find(card => card.effect === 'nullentropyBox');
  const cost = baseDeck().find(card => card.effect === 'karama'), other = baseDeck().find(card => card.kind === 'shield');
  assert.ok(box && cost && other);
  view.status = 'playing'; view.phase = 5; view.active = 'a';
  view.karamaShipping = { owner: 'r', player: 'g' };
  view.nullentropy = {
    card: box, blocked: null,
    search: paid ? { event: 'controlled-paid-box-event', cards: [cost, other] } : null,
  };
  if (paid) view.decision = { kind: 'nullentropy', player: 'a' };
  return { game: view, box, cost, other };
}
function boxMarkup(game: GameView, busy = false) {
  // NullentropyBox owns useId: always enter it through the React renderer.
  return renderToStaticMarkup(createElement(NullentropyBox, { game, busy, act() {} }));
}
function searchMarkup(game: GameView, busy = false) {
  return renderToStaticMarkup(createElement(NullentropySearch, { game, busy, act() {} }));
}
function labelText(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  return Children.toArray(node).map(child => isValidElement<{ children?: ReactNode }>(child)
    ? labelText(child.props.children)
    : typeof child === 'string' || typeof child === 'number' ? String(child) : '').join('');
}
function click(node: ReactNode, label: string): boolean {
  for (const child of Children.toArray(node)) {
    if (!isValidElement<{ children?: ReactNode; onClick?: () => void }>(child)) continue;
    if (labelText(child.props.children) === label && child.props.onClick) { child.props.onClick(); return true; }
    if (click(child.props.children, label)) return true;
  }
  return false;
}
function select(game: GameView, name: string, busy = false): Action[] {
  const actions: Action[] = [];
  // This leaf is hook-free; only its real selection handler is invoked.
  click(NullentropySearch({ game, busy, act(action) { actions.push(action); } }), `Take ${name} and finish search`);
  return actions;
}
function guidance(html: string) {
  assert.match(html, /Provisional refund rule/);
  assert.match(html, /purchased shipping price, the player who bought it and its shipment beneficiary stay unchanged/);
  assert.match(html, /Recovering its original card cost prevents a refund if the Guild later stops that shipment with special Karama/);
  assert.match(html, /even after that card is discarded again/);
  assert.match(html, /Taking another card leaves any still-unclaimed cost under its usual refund rule/);
}

void test('active purchased shipping price guidance is persistent before Box payment without showing discard candidates', () => {
  const f = projected();
  for (let render = 0; render < 3; render++) {
    const html = boxMarkup(f.game); guidance(html);
    assert.match(html, /Pay 2 spice to the bank to privately search/);
    assert.match(html, /Pay 2 spice and search privately/);
    assert.match(html, /There is no free cancellation after seeing the cards/);
    assert.doesNotMatch(html, new RegExp(`Take ${f.cost.name}|Take ${f.other.name}|controlled-paid-box-event`));
  }
});

void test('paid Box reminder and entitled selection panel retain the same provisional price and refund explanation', () => {
  const f = projected(true);
  for (let render = 0; render < 3; render++) {
    guidance(boxMarkup(f.game)); guidance(searchMarkup(f.game));
    assert.match(boxMarkup(f.game), /Your Nullentropy Box search is paid/);
    assert.match(searchMarkup(f.game), /You have paid 2 spice/);
    assert.match(searchMarkup(f.game), /These discard cards are visible only to you during this paid search/);
    assert.match(searchMarkup(f.game), /Inspection does not select a card/);
  }
});

void test('the actual paid search callbacks select either entitled card with only the unchanged event and card', () => {
  const f = projected(true), event = f.game.nullentropy!.search!.event;
  assert.deepEqual(select(f.game, f.cost.name), [{ type: 'decision', event, card: f.cost.id }]);
  assert.deepEqual(select(f.game, f.other.name), [{ type: 'decision', event, card: f.other.id }]);
  assert.deepEqual(select(f.game, 'Unshown card'), []);
  for (const card of [f.cost, f.other])
    assert.equal(Object.keys(select(f.game, card.name)[0]).sort().join(','), 'card,event,type');
});

void test('busy controls preserve the two-spice fee and guide while suppressing actual paid selections', () => {
  const before = projected(), paid = projected(true);
  const html = boxMarkup(before.game, true); guidance(html);
  assert.match(html, /disabled=""[^>]*>Pay 2 spice and search privately/);
  assert.deepEqual(select(paid.game, paid.cost.name, true), []);
  assert.deepEqual(select(paid.game, paid.other.name, true), []);
  guidance(searchMarkup(paid.game, true));
});

void test('existing prepay blocks and full-hand guidance coexist with the purchased-price notice', () => {
  const f = projected();
  f.game.nullentropy!.blocked = 'Finish the current owned preparation before paying.';
  f.game.nullentropy!.fullHandExchange = true;
  const html = boxMarkup(f.game); guidance(html);
  assert.match(html, /Finish the current owned preparation before paying/);
  assert.match(html, /disabled=""[^>]*>Pay 2 spice and search privately/);
  assert.match(html, /Provisional full-hand exchange/);
  const paid = projected(true); paid.game.nullentropy!.fullHandExchange = true;
  assert.match(searchMarkup(paid.game), /Provisional full-hand exchange/); guidance(searchMarkup(paid.game));
});

void test('the price notice is conditional on an active public grant and a paid search remains owner-only', () => {
  const before = projected(); before.game.karamaShipping = null;
  assert.doesNotMatch(boxMarkup(before.game), /Provisional refund rule|Recovering its original card cost/);
  const paid = projected(true); paid.game.karamaShipping = null;
  assert.doesNotMatch(boxMarkup(paid.game), /Provisional refund rule/);
  assert.doesNotMatch(searchMarkup(paid.game), /Provisional refund rule/);
  paid.game.me = 'g'; assert.equal(searchMarkup(paid.game), ''); assert.deepEqual(select(paid.game, paid.cost.name), []);
  paid.game.me = 'a'; paid.game.decision = null;
  assert.equal(searchMarkup(paid.game), ''); assert.deepEqual(select(paid.game, paid.cost.name), []);
});

void test('prepay guidance never inspects discard faces or an unprojected physical shipping cost', () => {
  const f = projected();
  Object.defineProperty(f.game, 'discard', { get() { throw Error('The prepay panel inspected discard faces'); } });
  Object.defineProperty(f.game.karamaShipping!, 'card', { get() { throw Error('The price cost is not public projection'); } });
  guidance(boxMarkup(f.game));
});
