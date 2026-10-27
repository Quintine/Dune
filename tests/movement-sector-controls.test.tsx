import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MovementClaimFields } from '../components/movement-claim-fields';
import { MovementExpressionFields } from '../components/movement-expression-fields';
import { MixedMovementFields } from '../components/mixed-movement-fields';
import { TravelClaimFields } from '../components/travel-claim-fields';
import { TurnActionFields } from '../components/turn-action-fields';
import { TERRITORIES } from '../game/board';
import { createGame, joinGame, newPlayer, viewGame, type GameView } from '../game/engine';
import type { MovementClaim } from '../game/movement-promises';
import type { MovementExpression } from '../game/movement-expression-promises';
import type { MixedActionExpression } from '../game/mixed-action-question';
import type { TravelActionClaim } from '../game/travel-expression-promises';
import type { TurnActionLeaf } from '../game/turn-action-promises';

type Element = ReactElement<{ children?: ReactNode; [key: string]: unknown }>;
const destination = TERRITORIES.find(item => item.id === 'imperial_basin')!;
assert.ok(destination.sectors.includes(9));
function elements(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<{ children?: ReactNode; [key: string]: unknown }>(node)) return [];
  return [node, ...elements(node.props.children)];
}
function select(tree: ReactNode, id: string, chosen: string) {
  const field = elements(tree).find(item => item.props.id === id); assert.ok(field, id);
  (field.props.onChange as (event: { currentTarget: { value: string } }) => void)({ currentTarget: { value: chosen } });
}
/** Controlled projection exercises editing, not actual movement legality. */
function projection(): GameView {
  const game = createGame('MOVEMENTSECTOR', newPlayer('p', 'Atreides', 'atreides'));
  joinGame(game, newPlayer('a', 'Emperor', 'emperor'));
  const view = viewGame(game, 'p'); view.status = 'playing'; view.turn = 1; view.phase = 5;
  view.active = 'p'; view.movementRemaining = ['p']; return view;
}

void test('standalone movement editor selects or clears an exact printed sector and resets on territory change', () => {
  let value: MovementClaim = { territory: destination.id, minimum: 2 };
  const props = () => ({ id: 'plain', value, onChange(next: MovementClaim) { value = next; } });
  const tree = () => MovementClaimFields(props());
  assert.match(renderToStaticMarkup(createElement(MovementClaimFields, props())), /Any sector in this territory/);
  select(tree(), 'plain-sector', '9'); assert.equal(value.sector, 9);
  select(tree(), 'plain-sector', ''); assert.deepEqual(value, { territory: destination.id, minimum: 2 });
  select(tree(), 'plain-sector', '9'); select(tree(), 'plain-territory', 'arrakeen');
  assert.deepEqual(value, { territory: 'arrakeen', minimum: 2 });
});

void test('movement-expression editor keeps exact-sector values through grouping and clears changed destination', () => {
  let value: MovementExpression = { kind: 'move', territory: destination.id, minimum: 2 };
  const tree = () => MovementExpressionFields({ value, territories: TERRITORIES, disabled: false, onChange(next) { value = next; } });
  select(tree(), 'truth-movement-expression-1-sector', '9');
  assert.deepEqual(value, { kind: 'move', territory: destination.id, minimum: 2, sector: 9 });
  const wrap = elements(tree()).find(item => item.props['data-movement-expression-control'] === 'and-1'); assert.ok(wrap);
  (wrap.props.onClick as () => void)();
  const current = (): MovementExpression => value;
  const grouped = current(); assert.equal(grouped.kind, 'and');
  if (grouped.kind !== 'and') throw Error('Expected the new expression group');
  assert.deepEqual(grouped.terms[0], { kind: 'move', territory: destination.id, minimum: 2, sector: 9 });
  select(tree(), 'truth-movement-expression-1.1-territory', 'arrakeen');
  const updated = current();
  if (updated.kind !== 'and') throw Error('Expected the same expression group');
  assert.deepEqual(updated.terms[0], { kind: 'move', territory: 'arrakeen', minimum: 2 });
});

void test('mixed movement editor selects the target sector and clears it when the territory changes', () => {
  const game = projection(); let value: MixedActionExpression<MovementClaim> = { kind: 'action', action: { territory: destination.id, minimum: 1 } };
  const tree = () => MixedMovementFields({ game, value, target: 'p', disabled: false, onChange(next) { value = next; } });
  select(tree(), 'truth-mixed-movement-1-sector', '9');
  assert.deepEqual(value, { kind: 'action', action: { territory: destination.id, minimum: 1, sector: 9 } });
  select(tree(), 'truth-mixed-movement-1-territory', 'arrakeen');
  assert.deepEqual(value, { kind: 'action', action: { territory: 'arrakeen', minimum: 1 } });
});

void test('travel and whole-turn action editors choose movement sectors and clear sectors on action changes', () => {
  const game = projection();
  let travel: MixedActionExpression<TravelActionClaim> = { kind: 'action', action: { kind: 'move', territory: destination.id, minimum: 1 } };
  const travelTree = () => TravelClaimFields({ game, value: travel, target: 'p', disabled: false, onChange(next) { travel = next; } });
  select(travelTree(), 'truth-travel-1-sector', '9');
  assert.deepEqual(travel, { kind: 'action', action: { kind: 'move', territory: destination.id, minimum: 1, sector: 9 } });
  select(travelTree(), 'truth-travel-1-action', 'ship');
  assert.deepEqual(travel, { kind: 'action', action: { kind: 'ship', territory: destination.id, minimum: 1 } });
  select(travelTree(), 'truth-travel-1-sector', '9'); select(travelTree(), 'truth-travel-1-action', 'move');
  assert.deepEqual(travel, { kind: 'action', action: { kind: 'move', territory: destination.id, minimum: 1 } });
  let whole: MixedActionExpression<TurnActionLeaf> = { kind: 'action', action: { kind: 'move', territory: destination.id, minimum: 1 } };
  const wholeTree = () => TurnActionFields({ game, value: whole, target: 'p', disabled: false, onChange(next) { whole = next; } });
  select(wholeTree(), 'truth-turn-action-1-sector', '9');
  assert.deepEqual(whole, { kind: 'action', action: { kind: 'move', territory: destination.id, minimum: 1, sector: 9 } });
  select(wholeTree(), 'truth-turn-action-1-territory', 'arrakeen');
  assert.deepEqual(whole, { kind: 'action', action: { kind: 'move', territory: 'arrakeen', minimum: 1 } });
});
