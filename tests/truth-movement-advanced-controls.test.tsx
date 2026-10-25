import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Truthtrance } from '../components/truthtrance';
import { MovementPromises } from '../components/movement-promises';
import { viewGame, type Action } from '../game/engine';
import { createTruthMovementAdvancedFixture, askTruthMovementAdvanced,
  actTruthMovement as act } from './fixture-truth-movement-advanced';

function callbacks(node: unknown): (() => void)[] {
  if (Array.isArray(node)) return node.flatMap(callbacks);
  if (!node || typeof node !== 'object' || !('props' in node)) return [];
  const props = (node as ReactElement<{ children?: unknown; onClick?: () => void }>).props;
  return [...(props.onClick ? [props.onClick] : []), ...callbacks(props.children)];
}

void test('genuine Advanced movement answers and persistent guidance connect to a real physical move', () => {
  const f = createTruthMovementAdvancedFixture();
  let g = askTruthMovementAdvanced(f.game, f.asker, f.truthtrance, f.target);
  const answers = renderToStaticMarkup(createElement(Truthtrance,
    { game: viewGame(g, f.target), busy: false, act() {} }));
  assert.match(answers, />Answer Yes<\/button>/); assert.match(answers, />Answer No<\/button>/);
  g = act(g, f.target, { type: 'truthAnswer', answer: 'yes' });
  const view = viewGame(g, f.target), actions: Action[] = [];
  const props = { game: view, busy: false, act: (action: Action) => { actions.push(action); } };
  const html = renderToStaticMarkup(createElement(MovementPromises, props));
  assert.match(html, /Your ground-movement promises/); assert.match(html, /Move 6 forces to Carthag/);
  callbacks(MovementPromises(props))[0]();
  assert.deepEqual(actions, view.movementPromisePolicy);
  g = act(g, f.target, actions[0]); assert.equal(g.movementPromises![0].fulfilled, true);
  callbacks(MovementPromises({ ...props, busy: true }))[0](); assert.equal(actions.length, 1);
  assert.equal(MovementPromises({ ...props, game: viewGame(g, f.asker) }), null);
});
