import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MovementPromises } from '../components/movement-promises';
import { MovementClaimFields } from '../components/movement-claim-fields';
import { Truthtrance } from '../components/truthtrance';
import { viewGame, type Action } from '../game/engine';
import { createTruthMovementFixture, actTruthMovement as act } from './fixture-truth-movement';

function question() {
  const f = createTruthMovementFixture(); let game = act(f.game, f.asker, f.truthStep.action);
  for (const p of game.players) if (!game.truthtrance!.passed.includes(p.id)) game = act(game, p.id, { type: 'truthPass' });
  game = act(game, f.asker, { type: 'truthAsk', question: { kind: 'movement', target: f.target, territory: 'carthag', minimum: 6 } });
  return { f, game };
}
function clickables(node: unknown): { children?: unknown; disabled?: boolean; onClick: () => void }[] {
  if (Array.isArray(node)) return node.flatMap(clickables);
  if (!node || typeof node !== 'object' || !('props' in node)) return [];
  const props = (node as ReactElement<{ children?: unknown; disabled?: boolean; onClick?: () => void }>).props;
  return [...(props.onClick ? [{ ...props, onClick: props.onClick }] : []), ...clickables(props.children)];
}
void test('the actual movement question shows truthful feasible answers and its continuing No semantics', () => {
  const { f, game } = question(), view = viewGame(game, f.target);
  const html = renderToStaticMarkup(createElement(Truthtrance, { game: view, act() {}, busy: false }));
  assert.match(html, /before your Shipment and Movement turn ends/);
  assert.match(html, /No forbids every matching move through later Hajr or Ornithopter/);
  assert.match(html, />Answer Yes<\/button>/); assert.match(html, />Answer No<\/button>/);
  assert.doesNotMatch(html, />I don’t know yet<\/button>/);
  assert.equal(viewGame(game, f.asker).truthMovementAnswers, null);
});
void test('persistent promise controls submit the actual private witness and respect busy state', () => {
  const { f, game: asked } = question();
  const game = act(asked, f.target, { type: 'truthAnswer', answer: 'yes' });
  const view = viewGame(game, f.target), actions: Action[] = [];
  const props = { game: view, act: (action: Action) => { actions.push(action); }, busy: false };
  const html = renderToStaticMarkup(createElement(MovementPromises, props));
  assert.match(html, /Your ground-movement promises/); assert.match(html, /Move 6 forces to Carthag/);
  clickables(MovementPromises(props))[0].onClick();
  assert.deepEqual(actions, view.movementPromisePolicy);
  const next = act(game, f.target, actions[0]); assert.equal(next.movementPromises![0].fulfilled, true);
  clickables(MovementPromises({ ...props, busy: true }))[0].onClick(); assert.equal(actions.length, 1);
  assert.equal(MovementPromises({ ...props, game: viewGame(game, f.asker) }), null);
  assert.equal(viewGame(game, f.asker).movementPromisePolicy, null);
});
void test('movement authoring fields describe ground forces and reject invalid physical minima', () => {
  const html = renderToStaticMarkup(createElement(MovementClaimFields, {
    id: 'movement', value: { territory: 'carthag', minimum: 0 }, onChange() {},
  }));
  assert.match(html, /Ground-movement destination/); assert.match(html, /Minimum physical forces in one ground move/);
  assert.match(html, /aria-invalid="true"/); assert.doesNotMatch(html, /from reserves|shipment conditions/);
});
