import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TravelClaimFields, travelClaimInputError } from '../components/travel-claim-fields';
import { createGame, joinGame, newPlayer, viewGame, type GameView } from '../game/engine';
import type { MixedActionExpression } from '../game/mixed-action-question';
import type { TravelActionClaim } from '../game/travel-expression-promises';

type Expression = MixedActionExpression<TravelActionClaim>;
type Element = ReactElement<{ children?: ReactNode; [key: string]: unknown }>;
const ship = (sector?: number): Expression => ({ kind: 'action', action: {
  kind: 'ship', territory: 'imperial_basin', minimum: 1, ...(sector === undefined ? {} : { sector }),
} });
/** Controlled public projection exercises the editor, not the server's phase eligibility. */
function projection(): GameView {
  const game = createGame('TRAVELSECTOR', newPlayer('p', 'Atreides', 'atreides'));
  joinGame(game, newPlayer('a', 'Emperor', 'emperor'));
  const view = viewGame(game, 'p');
  view.status = 'playing'; view.turn = 1; view.phase = 5; view.active = 'p';
  return view;
}
function elements(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<{ children?: ReactNode; [key: string]: unknown }>(node)) return [];
  return [node, ...elements(node.props.children)];
}
void test('travel shipment editor chooses a printed sector or any sector and resets it on territory changes', () => {
  const game = projection(); let value: Expression = ship();
  const tree = () => TravelClaimFields({ game, value, target: 'p', disabled: false, onChange(next) { value = next; } });
  const select = (suffix: string, chosen: string) => {
    const element = elements(tree()).find(item => item.props.id === `truth-travel-1-${suffix}`); assert.ok(element);
    (element.props.onChange as (event: { currentTarget: { value: string } }) => void)({ currentTarget: { value: chosen } });
  };
  assert.equal(travelClaimInputError(value, game, 'p'), null);
  const html = renderToStaticMarkup(createElement(TravelClaimFields, { game, value, target: 'p', disabled: false, onChange() {} }));
  assert.match(html, /Any sector in this territory/);
  assert.match(html, /Sector 9/);
  select('sector', '9'); assert.deepEqual(value, ship(9));
  assert.equal(travelClaimInputError(value, game, 'p'), null);
  select('sector', '18'); assert.deepEqual(value, ship(9));
  assert.notEqual(travelClaimInputError(ship(18), game, 'p'), null);
  select('sector', ''); assert.deepEqual(value, ship());
  select('sector', '10'); select('territory', 'arrakeen');
  assert.deepEqual(value, { kind: 'action', action: { kind: 'ship', territory: 'arrakeen', minimum: 1 } });
});

void test('switching to movement removes the shipment-only sector and disabled fields cannot change the question', () => {
  const game = projection(); let value: Expression = ship(9);
  const tree = (disabled = false) => TravelClaimFields({ game, value, target: 'p', disabled, onChange(next) { value = next; } });
  const action = () => {
    const element = elements(tree()).find(item => item.props.id === 'truth-travel-1-action'); assert.ok(element);
    return element;
  };
  (action().props.onChange as (event: { currentTarget: { value: string } }) => void)({ currentTarget: { value: 'move' } });
  assert.deepEqual(value, { kind: 'action', action: { kind: 'move', territory: 'imperial_basin', minimum: 1 } });
  assert.equal(travelClaimInputError(value, game, 'p'), null);
  assert.equal(elements(tree()).some(item => item.props.id === 'truth-travel-1-sector'), false);
  (action().props.onChange as (event: { currentTarget: { value: string } }) => void)({ currentTarget: { value: 'ship' } });
  assert.deepEqual(value, ship());
  const disabledSector = elements(tree(true)).find(item => item.props.id === 'truth-travel-1-sector'); assert.ok(disabledSector);
  (disabledSector.props.onChange as (event: { currentTarget: { value: string } }) => void)({ currentTarget: { value: '9' } });
  assert.deepEqual(value, ship());
});
