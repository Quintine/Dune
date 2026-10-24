import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MovementPromises } from '../components/movement-promises';
import { Truthtrance } from '../components/truthtrance';
import { ShipmentPromises } from '../components/shipment-promises';
import { viewGame, type Action } from '../game/engine';
import { createTruthMovementShipmentFixture, actTruthMovementShipment as act } from './fixture-truth-movement-shipment';

function buttons(node: unknown): { onClick: () => void }[] {
  if (Array.isArray(node)) return node.flatMap(buttons);
  if (!node || typeof node !== 'object' || !('props' in node)) return [];
  const props = (node as ReactElement<{ children?: unknown; onClick?: () => void }>).props;
  return [...(props.onClick ? [{ onClick: props.onClick }] : []), ...buttons(props.children)];
}
void test('pre-shipment answers and persistent guidance submit the real reinforcement while busy controls submit nothing', () => {
  const f = createTruthMovementShipmentFixture({ hajr: false });
  let game = act(f.game, f.asker, { type: 'card', card: f.truth });
  for (const p of game.players) if (!game.truthtrance!.passed.includes(p.id)) game = act(game, p.id, { type: 'truthPass' });
  game = act(game, f.asker, { type: 'truthAsk', question: f.claim });
  const answer = renderToStaticMarkup(createElement(Truthtrance, { game: viewGame(game, f.target), act() {}, busy: false }));
  assert.match(answer, /Answer Yes/); assert.match(answer, /Answer No/);
  game = act(game, f.target, { type: 'truthAnswer', answer: 'yes' });
  const actions: Action[] = [], props = { game: viewGame(game, f.target), act(action: Action) { actions.push(action); }, busy: false };
  const html = renderToStaticMarkup(createElement(MovementPromises, props));
  assert.match(html, /Ship 1 forces to Arrakeen, sector 10, before the required movement/);
  assert.match(html, /shipment can prepare that move but does not fulfill it/);
  buttons(MovementPromises({ ...props, busy: true }))[0].onClick(); assert.equal(actions.length, 0);
  buttons(MovementPromises(props))[0].onClick(); assert.deepEqual(actions, props.game.movementPromisePolicy);
  game = act(game, f.target, actions[0]); assert.equal(game.movementPromises![0].fulfilled, undefined);
  const moved = viewGame(game, f.target); assert.equal(moved.movementPromisePolicy![0].type, 'move');
  assert.match(renderToStaticMarkup(createElement(MovementPromises, { ...props, game: moved })), /Move 11 forces to Carthag/);
});
void test('a controlled conserved second question keeps one joint next-step control and both readable obligations', () => {
  const f = createTruthMovementShipmentFixture({ hajr: false }), source = structuredClone(f.game);
  const index = source.deck.findIndex(card => card.effect === 'truthtrance'); assert.ok(index >= 0);
  const extra = source.deck.splice(index, 1)[0]; source.players.find(p => p.id === f.asker)!.hand.push(extra);
  let game = source;
  for (const [card, question, answer] of [[f.truth, { kind: 'shipment', target: f.target, territory: 'arrakeen', minimum: 1 }, 'yes'],
    [extra.id, f.claim, 'no']] as const) {
    game = act(game, f.asker, { type: 'card', card });
    for (const p of game.players) if (!game.truthtrance!.passed.includes(p.id)) game = act(game, p.id, { type: 'truthPass' });
    game = act(game, f.asker, { type: 'truthAsk', question });
    game = act(game, f.target, { type: 'truthAnswer', answer });
  }
  const props = { game: viewGame(game, f.target), act() {}, busy: false };
  const shipment = renderToStaticMarkup(createElement(ShipmentPromises, props));
  assert.match(shipment, /both sets of answers possible/); assert.doesNotMatch(shipment, /Suggested next step/);
  assert.match(renderToStaticMarkup(createElement(MovementPromises, props)), /Ship 1 forces to Arrakeen/);
});
