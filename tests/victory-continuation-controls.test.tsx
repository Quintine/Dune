import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { VictoryContinuation, VictoryContinuationButton } from '../components/victory-continuation';
import { createGame, joinGame, newPlayer, viewGame, type Action, type GameView } from '../game/engine';

/** Controlled public projections exercise the actual panel and callbacks;
 * they do not assert an authoritative voting or victory transition. */
function projected(viewer: 'a' | 'b' | 'c', extra: number | null, actor: 'a' | 'b' = 'a'): GameView {
  const source = createGame('VOTEUI', newPlayer('a', 'Atreides', 'atreides'), true);
  joinGame(source, newPlayer('b', 'Emperor', 'emperor'));
  joinGame(source, newPlayer('c', 'Guild', 'guild'));
  const view = viewGame(source, viewer);
  view.victoryContinuation = {
    event: 'public-vote-event', actor, voters: ['a', 'b'], sides: [['a'], ['b', 'c']], extra, maxExtra: 20,
  };
  return view;
}
function html(game: GameView, busy = false): string {
  return renderToStaticMarkup(createElement(VictoryContinuation, { game, busy, act() {} }));
}
function click(mode: 'finish' | 'continue' | 'accept', busy = false, extra?: number): Action[] {
  const actions: Action[] = [];
  VictoryContinuationButton({ event: 'public-vote-event', mode, extra, busy,
    act(action) { actions.push(action); }, children: 'Choose' }).props.onClick();
  return actions;
}

void test('proposal controls display the public sides and a selectable increase', () => {
  const view = projected('a', null), before = structuredClone(view), output = html(view);
  assert.match(output, /aria-label="Simultaneous victory decision"/);
  assert.match(output, /Atreides; Emperor and Guild/);
  assert.match(output, /unanimously agree to play another turn/);
  assert.match(output, /Increase the stronghold targets by/);
  assert.match(output, /type="number" min="0" max="20"/);
  assert.match(output, /Choose zero to keep the existing targets/);
  assert.match(output, /Propose another turn/);
  assert.match(output, /Finish the game/);
  assert.deepEqual(view, before);
});

void test('proposal acceptance explains exact increase and non-actors wait', () => {
  const responder = html(projected('b', 2, 'b'));
  assert.match(responder, /Proposal: Continue and increase the stronghold targets by 2/);
  assert.match(responder, /Agree to continue/);
  assert.match(responder, /Finish the game/);
  assert.doesNotMatch(responder, /Propose another turn|type="number"/);
  const waiting = html(projected('a', 0, 'b'));
  assert.match(waiting, /Continue with the current stronghold targets/);
  assert.match(waiting, /Waiting for Emperor to decide/);
  assert.doesNotMatch(waiting, /<button/);
});

void test('buttons send only event-bound choices and respect busy state', () => {
  assert.deepEqual(click('continue', false, 3), [{ type: 'victoryContinuation', event: 'public-vote-event', mode: 'continue', extra: 3 }]);
  assert.deepEqual(click('accept'), [{ type: 'victoryContinuation', event: 'public-vote-event', mode: 'accept' }]);
  assert.deepEqual(click('finish'), [{ type: 'victoryContinuation', event: 'public-vote-event', mode: 'finish' }]);
  for (const mode of ['finish', 'continue', 'accept'] as const) assert.deepEqual(click(mode, true, 2), []);
  assert.match(html(projected('a', null), true), /disabled=""/);
});

void test('the panel is absent when no continuation vote is projected', () => {
  const view = projected('a', null);
  view.victoryContinuation = null;
  assert.equal(html(view), '');
});
