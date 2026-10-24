import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MovementPromises } from '../components/movement-promises';
import { NullentropySearch } from '../components/nullentropy-box';
import { viewGame, type Action, type Game } from '../game/engine';
import { createTruthMovementWaitingFixture, actTruthMovementWaiting as act } from './fixture-truth-movement-waiting';
import { createTruthMovementWaitingBoxFixture } from './fixture-truth-movement-waiting-box';

function buttons(node: unknown): { onClick: () => void }[] {
  if (Array.isArray(node)) return node.flatMap(buttons);
  if (!node || typeof node !== 'object' || !('props' in node)) return [];
  const props = (node as ReactElement<{ children?: unknown; onClick?: () => void }>).props;
  return [...(props.onClick ? [{ onClick: props.onClick }] : []), ...buttons(props.children)];
}
function pass(game: Game) {
  if (game.pendingTreacheryDiscard?.reaction) {
    const event = game.pendingTreacheryDiscard.batch.event;
    for (const p of game.players) game = act(game, p.id, { type: 'semutaPass', event });
  }
  return game;
}
function bind(f: { game: Game; asker: string; target: string; truth: string; claim: Record<string, unknown> }) {
  let game = act(f.game, f.asker, { type: 'card', card: f.truth });
  for (const p of game.players) if (!game.truthtrance!.passed.includes(p.id)) game = act(game, p.id, { type: 'truthPass' });
  game = act(game, f.asker, { type: 'truthAsk', question: f.claim });
  return pass(act(game, f.target, { type: 'truthAnswer', answer: 'yes' }));
}
void test('persistent waiting guidance has no premature movement button and becomes executable on the real turn', () => {
  const f = createTruthMovementWaitingFixture({ hajr: false }); let game = bind(f);
  const actions: Action[] = [], submit = (action: Action) => { actions.push(action); };
  const props = { game: viewGame(game, f.target), act: submit, busy: false };
  assert.match(renderToStaticMarkup(createElement(MovementPromises, props)), /Your Movement turn is still ahead/);
  assert.equal(buttons(MovementPromises(props)).length, 0);
  game = act(game, f.asker, f.currentMove); game = act(game, f.asker, f.currentEnd);
  const own = { ...props, game: viewGame(game, f.target) };
  assert.doesNotMatch(renderToStaticMarkup(createElement(MovementPromises, own)), /turn is still ahead/);
  buttons(MovementPromises({ ...own, busy: true }))[0].onClick(); assert.equal(actions.length, 0);
  buttons(MovementPromises(own))[0].onClick(); assert.equal(actions[0].type, 'ship');
  game = act(game, f.target, actions[0]); assert.equal(game.movementPromises![0].fulfilled, undefined);
});
void test('a waiting paid owner gets only its original paid choice; after selection the future action button disappears', () => {
  const f = createTruthMovementWaitingBoxFixture(); let game = bind(f);
  game = act(game, f.target, { type: 'card', card: f.box });
  const actions: Action[] = [], props = { game: viewGame(game, f.target), act(action: Action) { actions.push(action); }, busy: false };
  const html = renderToStaticMarkup(createElement(MovementPromises, props));
  assert.match(html, /already-paid Box search can finish now/); assert.match(html, /Choose Truthtrance in your paid Box search/);
  const search = renderToStaticMarkup(createElement(NullentropySearch, props));
  assert.equal((search.match(/Take Truthtrance and finish search/g) ?? []).length, 2);
  buttons(MovementPromises({ ...props, busy: true }))[0].onClick(); assert.equal(actions.length, 0);
  buttons(MovementPromises(props))[0].onClick();
  assert.equal(actions[0].type, 'decision'); assert.equal(actions[0].event, game.pendingNullentropy!.event);
  game = pass(act(game, f.target, actions[0])); assert.equal(game.active, f.active);
  const waiting = { ...props, game: viewGame(game, f.target) };
  assert.equal(buttons(MovementPromises(waiting)).length, 0);
  assert.match(renderToStaticMarkup(createElement(MovementPromises, waiting)), /turn is still ahead/);
});
