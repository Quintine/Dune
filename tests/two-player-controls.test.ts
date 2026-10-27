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
    onAddBot: noop, onAddControlledBot: noop,
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

void test('host may add a computer opponent when the second controller slot is empty', () => {
  const game = {
    ...base,
    players: [base.players[0]],
    twoPlayerControllers: { version: 1 as const, controllers: [{ id: 'a', seats: ['a'] }] },
    controlledFactionSeats: [{ id: 'a', name: 'Ali', faction: 'atreides' as const }],
  };
  const html = render(game);
  assert.match(html, /Add an AI player/);
  assert.match(html, /The AI plays each faction independently/);
  for (const difficulty of ['Easy', 'Medium', 'Hard', 'Brutal'])
    assert.match(html, new RegExp(`value="${difficulty}"`));
  assert.match(html, /value="harkonnen"/);
  assert.doesNotMatch(html, /<option[^>]*value="atreides"/);
});

void test('host adds the second AI faction only for an incomplete AI controller', () => {
  const human = base.players[0];
  const ai = { ...base.players[1], bot: 'Hard' as const };
  const game = {
    ...base,
    players: [human, ai],
    twoPlayerControllers: { version: 1 as const, controllers: [
      { id: 'a', seats: ['a'] }, { id: 'b', seats: ['b'] },
    ] },
    controlledFactionSeats: [{ id: 'a', name: 'Ali', faction: 'atreides' as const }],
  };
  const html = render(game);
  assert.match(html, /Player 2 \(AI\): Harkonnen/);
  assert.match(html, /Add the AI player’s second faction/);
  assert.match(html, /Add AI second faction/);
  assert.doesNotMatch(html, /<option[^>]*value="harkonnen"/);
  const nonHost = render({ ...game, me: 'b' });
  assert.doesNotMatch(nonHost, /Add AI second faction/);
  const complete = render({ ...game, twoPlayerControllers: { version: 1, controllers: [
    { id: 'a', seats: ['a'] }, { id: 'b', seats: ['b', 'c'] },
  ] } });
  assert.doesNotMatch(complete, /Add AI second faction/);
});

void test('a human opponent does not expose controls to add an AI faction to their seat', () => {
  const game = {
    ...base,
    twoPlayerControllers: { version: 1 as const, controllers: [
      { id: 'a', seats: ['a', 'c'] }, { id: 'b', seats: ['b'] },
    ] },
  };
  assert.doesNotMatch(render(game), /Add AI second faction|Add an AI player/);
});
