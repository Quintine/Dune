import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MovementPromises } from '../components/movement-promises';
import { NullentropySearch } from '../components/nullentropy-box';
import { viewGame, type Action } from '../game/engine';
import { createTruthMovementBoxFixture, actTruthMovementBox as act } from './fixture-truth-movement-box';

function clickables(node: unknown): { children?: unknown; onClick: () => void }[] {
  if (Array.isArray(node)) return node.flatMap(clickables);
  if (!node || typeof node !== 'object' || !('props' in node)) return [];
  const props = (node as ReactElement<{ children?: unknown; onClick?: () => void }>).props;
  return [...(props.onClick ? [{ ...props, onClick: props.onClick }] : []), ...clickables(props.children)];
}
function bound(answer = 'yes') {
  const f = createTruthMovementBoxFixture(); let game = act(f.game, f.asker, { type: 'card', card: f.truth });
  for (const p of game.players) if (!game.truthtrance!.passed.includes(p.id)) game = act(game, p.id, { type: 'truthPass' });
  game = act(game, f.asker, { type: 'truthAsk', question: f.claim });
  game = act(game, f.target, { type: 'truthAnswer', answer });
  if (game.pendingTreacheryDiscard?.reaction) {
    const event = game.pendingTreacheryDiscard.batch.event;
    for (const p of game.players) game = act(game, p.id, { type: 'semutaPass', event });
  }
  return { f, game };
}
void test('persistent Box guidance pays once then submits the original required paid selection without hiding other faces', () => {
  const { f, game: source } = bound(), actions: Action[] = [];
  const submit = (action: Action) => { actions.push(action); };
  const before = { game: viewGame(source, f.target), act: submit, busy: false };
  assert.match(renderToStaticMarkup(createElement(MovementPromises, before)), /Pay 2 spice and search with Nullentropy Box/);
  clickables(MovementPromises({ ...before, busy: true }))[0].onClick(); assert.equal(actions.length, 0);
  clickables(MovementPromises(before))[0].onClick(); assert.deepEqual(actions.pop(), { type: 'card', card: f.box });
  const game = act(source, f.target, { type: 'card', card: f.box }), view = viewGame(game, f.target);
  const paid = { game: view, act: submit, busy: false };
  const html = renderToStaticMarkup(createElement(MovementPromises, paid));
  assert.match(html, /Choose Hajr in your paid Box search/); assert.match(html, /fee is paid only once/);
  assert.doesNotMatch(html, /Pay 2 spice and search with/);
  const inspection = renderToStaticMarkup(createElement(NullentropySearch, paid));
  assert.match(inspection, /Take Hajr and finish search/); assert.match(inspection, /Take Truthtrance and finish search/);
  clickables(MovementPromises({ ...paid, busy: true }))[0].onClick(); assert.equal(actions.length, 0);
  clickables(MovementPromises(paid))[0].onClick();
  assert.deepEqual(actions, [{ type: 'decision', event: view.nullentropy!.search!.event, card: f.hajr }]);
  const next = act(game, f.target, actions[0]); assert.equal(next.pendingNullentropy, null);
  assert.equal(next.players.find(p => p.id === f.target)!.spice, 0);
  assert.equal(MovementPromises({ ...paid, game: viewGame(game, f.asker) }), null);
});
void test('No remains readable during a paid search without an invalid End movement button', () => {
  const { f, game: source } = bound('no'), game = act(source, f.target, { type: 'card', card: f.box });
  const props = { game: viewGame(game, f.target), act() { assert.fail('Rendering cannot submit.'); }, busy: false };
  const html = renderToStaticMarkup(createElement(MovementPromises, props));
  assert.match(html, /No: you must not/); assert.match(html, /paid Box search must finish before moving/);
  assert.equal(clickables(MovementPromises(props)).length, 0);
  assert.match(renderToStaticMarkup(createElement(NullentropySearch, props)), /Take Hajr and finish search/);
});
