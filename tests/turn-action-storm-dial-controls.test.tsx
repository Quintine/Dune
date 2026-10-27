import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TurnActionFields, turnActionInputError } from '../components/turn-action-fields';
import { TurnActionGuideButton } from '../components/turn-action-promises';
import { createGame, joinGame, newPlayer, viewGame, type Action, type GameView } from '../game/engine';
import type { MixedActionExpression } from '../game/mixed-action-question';
import type { TurnActionLeaf } from '../game/turn-action-promises';

type Expression = MixedActionExpression<TurnActionLeaf>;
type Element = ReactElement<{ children?: ReactNode; [key: string]: unknown }>;
const dial = (turn: number, value: number): Expression => ({ kind: 'action', action: {
  kind: 'stormDial', source: JSON.stringify(['stormDial', turn, 'p']), value,
} });
/** Controlled public projection: this exercises controls, not native setup. */
function projection(turn: number): GameView {
  const game = createGame('STORMDIALCONTROL', newPlayer('p', 'Dialer', 'atreides'));
  joinGame(game, newPlayer('a', 'Asker', 'emperor'));
  const view = viewGame(game, 'p');
  view.status = 'playing'; view.turn = turn; view.phase = 0; view.advanced = false;
  view.stormPending = null; view.stormDialers = ['p', 'a']; view.stormSubmitted = [];
  return view;
}
function elements(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<{ children?: ReactNode; [key: string]: unknown }>(node)) return [];
  return [node, ...elements(node.props.children)];
}
void test('editor selects the exact original Storm dial and enforces native turn ranges', () => {
  for (const [turn, min, max] of [[1, 0, 20], [2, 1, 3]] as const) {
    const game = projection(turn); let value: Expression = { kind: 'action', action: { kind: 'ship', territory: 'carthag', minimum: 1 } };
    const tree = TurnActionFields({ game, value, target: 'p', disabled: false, onChange(next) { value = next; } });
    const select = elements(tree).find(element => element.props.id === 'truth-turn-action-1-action'); assert.ok(select);
    (select.props.onChange as (event: { currentTarget: { value: string } }) => void)({ currentTarget: { value: 'stormDial' } });
    assert.deepEqual(value, dial(turn, min));
    assert.equal(turnActionInputError(value, game, 'p'), null);
    assert.equal(turnActionInputError(dial(turn, max), game, 'p'), null);
    assert.notEqual(turnActionInputError(dial(turn, max + 1), game, 'p'), null);
    assert.notEqual(turnActionInputError(dial(turn, min - 1), game, 'p'), null);
    const html = renderToStaticMarkup(createElement(TurnActionFields, { game, value, target: 'p', disabled: false, onChange() {} }));
    assert.match(html, /Exact Storm dial value/); assert.match(html, /remain sealed/);
    game.stormSubmitted = ['p'];
    assert.notEqual(turnActionInputError(value, game, 'p'), null);
  }
});
void test('native Storm guide dispatches exact current owner action and rejects stale submission', () => {
  const view = projection(1), event = 'controlled-dial-promise', mixed = dial(1, 7);
  view.turnActionPromises = [{ event, player: 'p', asker: 'a', turn: 1, mixed, answer: true, fulfilled: false, released: false }];
  const action: Action = { type: 'stormDial', amount: 7, turnActionPromiseEvent: event, turnActionPromisePhase: 0 };
  view.turnActionGuide = { event, action };
  const sent: Action[] = [], props = { game: view, busy: false, act: (next: Action) => sent.push(next) };
  const button = TurnActionGuideButton(props); assert.ok(button); assert.equal(button.props.disabled, false);
  assert.match(renderToStaticMarkup(createElement(TurnActionGuideButton, props)), /Submit Storm dial 7/);
  button.props.onClick(); assert.deepEqual(sent, [action]);
  view.stormSubmitted = ['p']; button.props.onClick(); assert.deepEqual(sent, [action]);
});
void test('other player sealing a dial does not expose or invalidate this owner’s current guide', () => {
  const view = projection(1), event = 'controlled-dial-promise', mixed = dial(1, 7);
  view.turnActionPromises = [{ event, player: 'p', asker: 'a', turn: 1, mixed, answer: true, fulfilled: false, released: false }];
  const action: Action = { type: 'stormDial', amount: 7, turnActionPromiseEvent: event, turnActionPromisePhase: 0 };
  view.turnActionGuide = { event, action };
  const sent: Action[] = [], button = TurnActionGuideButton({ game: view, busy: false, act: next => sent.push(next) }); assert.ok(button);
  view.stormSubmitted = ['a']; button.props.onClick(); assert.deepEqual(sent, [action]);
  assert.equal(view.stormRevealed, null); assert.equal('stormDials' in view, false);
});
