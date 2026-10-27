import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { GameView } from '../game/engine';
import { TwoPlayerControls } from '../components/two-player-controls';

const base = {
  code: 'TWOPLAY2', status: 'lobby', host: 'a', me: 'a', expansions: [],
  players: [
    { id: 'a', name: 'Ali', faction: 'atreides', ready: true },
    { id: 'b', name: 'Bea', faction: 'harkonnen', ready: false },
    { id: 'c', name: 'Ali', faction: 'emperor', ready: false },
  ],
  twoPlayerControllers: { version: 1, controllers: [
    { id: 'one', seats: ['a', 'c'] }, { id: 'two', seats: ['b'] },
  ] },
  controlledFactionSeats: [
    { id: 'a', name: 'Ali', faction: 'atreides' },
    { id: 'c', name: 'Ali', faction: 'emperor' },
  ],
} as unknown as GameView;
const noop = () => {};
function render(game: GameView, pendingEntry = false) {
  return renderToStaticMarkup(createElement(TwoPlayerControls, {
    game, disabled: pendingEntry, pendingEntry, entryRoom: game.code, entryProblem: '',
    retryDisabled: false, onModeChange: noop, onSwitch: noop, onAdd: noop, onRetry: noop,
  }));
}

void test('faction selector only offers the authenticated controller seats', () => {
  const html = render(base);
  assert.match(html, /Active faction/);
  assert.match(html, /value="a"/);
  assert.match(html, /value="c"/);
  assert.doesNotMatch(html, /<option[^>]*value="b"/);
  assert.match(html, /Player 2: Harkonnen \(not ready\) — needs a second faction/);
});

void test('second faction choices omit taken factions and disabled expansions', () => {
  const html = render({ ...base, me: 'b', controlledFactionSeats: [{ id: 'b', name: 'Bea', faction: 'harkonnen' }] });
  assert.match(html, /Add your second faction/);
  assert.match(html, /value="fremen"/);
  assert.doesNotMatch(html, /<option[^>]*value="atreides"/);
  assert.doesNotMatch(html, /<option[^>]*value="ixians"/);
});

void test('an unresolved request stays visible with an explicit retry', () => {
  const html = render(base, true);
  assert.match(html, /Retry saved second-faction request/);
  assert.match(html, /never retried automatically/);
  assert.match(html, /<select[^>]*disabled/);
});
