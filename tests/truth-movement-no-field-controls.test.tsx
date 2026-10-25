import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MovementPromises } from '../components/movement-promises';
import { viewGame, type Action } from '../game/engine';
import { askTruthMovementAdvanced as ask } from './fixture-truth-movement-advanced';
import { createTruthMovementNoFieldFixture as fixture, actTruthMovementNoField as act,
  advanceTruthMovementNoField as advance, truthMovementNoFieldClean as clean } from './fixture-truth-movement-no-field';

function callbacks(node: unknown): (() => void)[] {
  if (Array.isArray(node)) return node.flatMap(callbacks);
  if (!node || typeof node !== 'object' || !('props' in node)) return [];
  const props = (node as ReactElement<{ children?: unknown; onClick?: () => void }>).props;
  return [...(props.onClick ? [props.onClick] : []), ...callbacks(props.children)];
}
void test('persistent native No-Field guidance submits the actual current reveal then offers physical movement', () => {
  const f = fixture({ advanced: true });
  let g = ask(f.game, f.asker, f.truthtrance, f.target, 5, 'arrakeen');
  g = advance(act(g, f.target, { type: 'truthAnswer', answer: 'yes' }), clean);
  const view = viewGame(g, f.target), actions: Action[] = [];
  const props = { game: view, busy: false, act: (action: Action) => { actions.push(action); } };
  const html = renderToStaticMarkup(createElement(MovementPromises, props));
  assert.match(html, /Reveal your No-Field to prepare physical forces/);
  callbacks(MovementPromises(props))[0](); assert.deepEqual(actions, view.movementPromisePolicy);
  g = act(g, f.target, actions[0]); assert.ok(!g.movementPromises![0].fulfilled);
  assert.match(renderToStaticMarkup(createElement(MovementPromises,
    { ...props, game: viewGame(g, f.target) })), /Move 5 forces to Arrakeen/);
  callbacks(MovementPromises({ ...props, busy: true }))[0](); assert.equal(actions.length, 1);
});
