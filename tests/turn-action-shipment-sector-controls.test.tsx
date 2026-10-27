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
const ship = (sector?: number): Expression => ({ kind: 'action', action: {
  kind: 'ship', territory: 'imperial_basin', minimum: 1, ...(sector === undefined ? {} : { sector }),
} });
/** Controlled public projection: control validation, not native setup. */
function projection(): GameView {
  const game = createGame('SECTORCONTROLS', newPlayer('p', 'Atreides', 'atreides'));
  joinGame(game, newPlayer('a', 'Emperor', 'emperor'));
  const view = viewGame(game, 'p');
  view.status = 'playing'; view.turn = 1; view.phase = 5; view.active = 'p';
  view.movementRemaining = ['p']; view.storm = 1;
  const me = view.players.find(player => player.id === 'p'); assert.ok(me);
  me.shipped = false; me.reserves = 10; me.spice = 10;
  return view;
}
function elements(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<{ children?: ReactNode; [key: string]: unknown }>(node)) return [];
  return [node, ...elements(node.props.children)];
}
void test('shipment editor supports any printed sector or a specific sector and clears it on territory change', () => {
  const game = projection(); let value: Expression = ship();
  const tree = () => TurnActionFields({ game, value, target: 'p', disabled: false, onChange(next) { value = next; } });
  const select = (suffix: string, chosen: string) => {
    const element = elements(tree()).find(item => item.props.id === `truth-turn-action-1-${suffix}`); assert.ok(element);
    (element.props.onChange as (event: { currentTarget: { value: string } }) => void)({ currentTarget: { value: chosen } });
  };
  assert.equal(turnActionInputError(value, game, 'p'), null);
  assert.match(renderToStaticMarkup(createElement(TurnActionFields, { game, value, target: 'p', disabled: false, onChange() {} })), /Any sector in this territory/);
  select('sector', '9'); assert.deepEqual(value, ship(9)); assert.equal(turnActionInputError(value, game, 'p'), null);
  assert.notEqual(turnActionInputError(ship(0), game, 'p'), null);
  select('sector', ''); assert.deepEqual(value, ship());
  select('sector', '10'); select('territory', 'arrakeen');
  assert.deepEqual(value, { kind: 'action', action: { kind: 'ship', territory: 'arrakeen', minimum: 1 } });
});
void test('the native exact-sector guide dispatches its quoted shipment and rejects stale sources', () => {
  for (const mutate of [
    (view: GameView) => { view.storm = 9; },
    (view: GameView) => { view.players.find(player => player.id === 'p')!.shipped = true; },
    (view: GameView) => { view.players.find(player => player.id === 'p')!.reserves = 0; },
    (view: GameView) => { view.players.find(player => player.id === 'p')!.spice = 0; },
    (view: GameView) => { view.players.find(player => player.id === 'a')!.forces = { 'imperial_basin:9': 1 }; },
  ]) {
    const game = projection(), event = 'controlled-sector-promise', mixed = ship(9);
    game.turnActionPromises = [{ event, player: 'p', asker: 'a', turn: 1, mixed, answer: true, fulfilled: false, released: false }];
    const action: Action = { type: 'ship', territory: 'imperial_basin', sector: 9, amount: 1, elite: 0, allyPayment: 0,
      turnActionPromiseEvent: event, turnActionPromisePhase: 5 };
    game.turnActionGuide = { event, action };
    const sent: Action[] = [], props = { game, busy: false, act: (next: Action) => sent.push(next) };
    const button = TurnActionGuideButton(props); assert.ok(button); assert.equal(button.props.disabled, false);
    assert.match(renderToStaticMarkup(createElement(TurnActionGuideButton, props)), /Imperial Basin, sector 9/);
    button.props.onClick(); assert.deepEqual(sent, [action]);
    mutate(game); button.props.onClick(); assert.deepEqual(sent, [action]);
  }
});
