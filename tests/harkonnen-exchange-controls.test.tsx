import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { HarkonnenExchangeInspection } from '../components/harkonnen-exchange-inspection';
import { createGame, joinGame, newPlayer, viewGame, type GameView } from '../game/engine';
import { baseDeck } from '../game/cards';

function view() {
  const game = createGame('INSPECTION', newPlayer('h', 'Harkonnen', 'harkonnen'));
  joinGame(game, newPlayer('e', 'Emperor', 'emperor'));
  const result = viewGame(game, 'h');
  result.harkonnenExchangeInspection = {
    owner: 'h', target: 'e', turn: 3, phase: 3, kind: 'draw',
    cards: baseDeck().filter(card => card.name === 'Shield').slice(0, 1),
  };
  return result;
}
const render = (game: GameView) => renderToStaticMarkup(createElement(HarkonnenExchangeInspection, { game }));

void test('private exchange record offers readable cards and inspection without a return confirmation', () => {
  const html = render(view());
  assert.match(html, /Your Harkonnen inspection · Turn 3/);
  assert.match(html, /Cards you took and inspected from Emperor/);
  assert.match(html, /may have changed hands since/);
  assert.match(html, /Shield/);
  assert.match(html, /Inspect card: Shield/);
  assert.doesNotMatch(html, /Return cards|Confirm|Acknowledge/);
});

void test('legacy history describes held cards without inventing their source', () => {
  const game = view(); game.harkonnenExchangeInspection!.kind = 'return';
  const html = render(game);
  assert.match(html, /Cards in your hand before the automatic return to Emperor/);
  assert.doesNotMatch(html, /Cards you took/);
});

void test('absent and mismatched-owner records render no private card information', () => {
  const game = view(); game.me = 'e'; assert.equal(render(game), '');
  game.me = 'h'; game.harkonnenExchangeInspection = null; assert.equal(render(game), '');
});
