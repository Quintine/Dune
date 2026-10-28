import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createGame, joinGame, newPlayer, viewGame } from '../game/engine';
import { EarlyRicheseBidPromises } from '../components/early-richese-bid-promises';

void test('waiting receipts explain only the current player’s live unattached cache bid answers', () => {
  const game = createGame('EARLYWAIT', newPlayer('e', 'Emperor', 'emperor'), false, ['choam']);
  joinGame(game, newPlayer('r', 'Richese', 'richese'));
  const view = viewGame(game, 'e');
  view.ownEarlyRicheseBidPromises = [
    { id: 'private-id', player: 'e', asker: 'r', turn: view.turn, minimum: 4, answer: true },
    { id: 'negative-id', player: 'e', asker: 'r', turn: view.turn, minimum: 7, answer: false },
    { id: 'other-id', player: 'r', asker: 'e', turn: view.turn, minimum: 9, answer: true },
    { id: 'done-id', player: 'e', asker: 'r', turn: view.turn, minimum: 11, answer: true, fulfilled: true },
    { id: 'release-id', player: 'e', asker: 'r', turn: view.turn, minimum: 12, answer: true, released: true },
    { id: 'bound-id', player: 'e', asker: 'r', turn: view.turn, minimum: 13, answer: true, boundEvent: 'private-lot' },
    { id: 'old-id', player: 'e', asker: 'r', turn: view.turn + 1, minimum: 14, answer: true },
  ];
  const html = renderToStaticMarkup(createElement(EarlyRicheseBidPromises, { game: view }));
  assert.match(html, /You answered Yes to bidding at least 4 spice/);
  assert.match(html, /You answered No to bidding at least 7 spice/);
  assert.match(html, /Waiting for the first Richese cache auction/);
  assert.match(html, /Its card and method are not yet decided/);
  assert.doesNotMatch(html, /at least (9|11|12|13|14) spice/);
  assert.doesNotMatch(html, /private-id|negative-id|other-id|private-lot|<button/);
  view.ownEarlyRicheseBidPromises = view.ownEarlyRicheseBidPromises.filter(row => !!row.boundEvent || row.fulfilled || row.released || row.turn !== view.turn);
  assert.equal(renderToStaticMarkup(createElement(EarlyRicheseBidPromises, { game: view })), '');
});
