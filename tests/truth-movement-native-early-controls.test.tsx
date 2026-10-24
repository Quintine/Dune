import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MovementPromises } from '../components/movement-promises';
import { viewGame, type Action, type Game } from '../game/engine';
import {
  createTruthMovementNativeEarlyFixture, actTruthMovementNativeEarly as act,
  advanceTruthMovementNativeEarly as advance, truthMovementNativeEarlyClean as clean,
  type TruthMovementNativeEarlyFixture,
} from './fixture-truth-movement-native-early';

type Props = Parameters<typeof MovementPromises>[0];
type Control = { children?: unknown; disabled?: boolean; onClick: () => void };
function controls(node: unknown): Control[] {
  if (Array.isArray(node)) return node.flatMap(controls);
  if (!node || typeof node !== 'object' || !('props' in node)) return [];
  const props = (node as ReactElement<{ children?: unknown; disabled?: boolean; onClick?: () => void }>).props;
  return [...(props.onClick ? [{ ...props, onClick: props.onClick }] : []), ...controls(props.children)];
}
const markup = (props: Props) => renderToStaticMarkup(createElement(MovementPromises, props));

/** Real source controls bind the answer and decline the original discard
 * reaction. No promise, native auction, submitted bid or policy is installed. */
function bind(f: TruthMovementNativeEarlyFixture): Game {
  let game = act(f.game, f.asker, f.declarationStep.action);
  while (game.truthtrance?.stage === 'priority') {
    const player = game.players.find(player => !game.truthtrance!.passed.includes(player.id)); assert.ok(player);
    game = act(game, player.id, { type: 'truthPass' });
  }
  game = act(game, f.asker, f.askStep.action);
  assert.ok(viewGame(game, f.target).truthMovementAnswers?.includes('yes'));
  game = act(game, f.target, { type: 'truthAnswer', answer: 'yes' });
  while (game.pendingTreacheryDiscard?.reaction?.stage === 'offer') {
    const pending = game.pendingTreacheryDiscard, reaction = pending.reaction;
    assert.ok(reaction?.stage === 'offer');
    const player = game.players.find(player => !reaction.passed.includes(player.id)); assert.ok(player);
    game = act(game, player.id, { type: 'semutaPass', event: pending.batch.event });
  }
  assert.ok(clean(game), 'Finish the original Truthtrance and Semuta controls before the native auction');
  assert.equal(game.phase, 2);
  return game;
}

function nativeControl(method: 'onceAround' | 'silent') {
  const f = createTruthMovementNativeEarlyFixture();
  const game = advance(bind(f), state => state.phase === 3 && clean(state) && !!state.richeseAuction &&
    !state.richeseAuction.outcome && (method === 'silent'
      ? !Object.hasOwn(state.richeseAuction.sealed, f.target)
      : state.richeseAuction.active === f.target), [], { method, card: 'richese-nullentropy-box' });
  const lot = game.richeseAuction!;
  assert.equal(lot.method, method); assert.equal(lot.source, 'cache');
  const expected: Action = { type: 'richeseBid', event: lot.event,
    amount: method === 'silent' ? 0 : null, allyPayment: 0 };
  const view = viewGame(game, f.target);
  assert.deepEqual(view.movementPromisePolicy, [expected]);
  const sent: Action[] = [], props = { game: view, busy: false, act: (action: Action) => { sent.push(action); } };
  const html = markup(props);
  assert.match(html, /Your Movement turn is still ahead/);
  assert.match(html, /movement controls appear on your turn/);
  assert.match(html, /Yes: you must make a ground movement of at least 8 physical forces to Carthag/);
  assert.match(html, /a shipment can prepare that move but does not fulfill it/);
  assert.doesNotMatch(html, />Ship \d|>Move \d|>Use Ornithopter and move|>Finish movement while honoring No/);
  const button = controls(MovementPromises(props));
  assert.equal(button.length, 1); assert.equal(button[0].disabled, false);
  assert.equal(button[0].children, method === 'silent'
    ? 'Submit zero in this Silent auction and preserve later movement'
    : 'Pass this Richese bid and preserve later movement');
  const busy = controls(MovementPromises({ ...props, busy: true }));
  assert.equal(busy.length, 1); assert.equal(busy[0].disabled, true);
  busy[0].onClick(); assert.deepEqual(sent, []);
  assert.match(markup({ ...props, busy: true }), /Your Movement turn is still ahead/);
  button[0].onClick(); assert.deepEqual(sent, [expected]);
  assert.equal(sent[0], view.movementPromisePolicy![0], 'Forward the actual event-bound private policy action');
  const next = act(game, f.target, sent[0]);
  assert.equal(next.movementPromises![0].released, undefined);
  assert.equal(next.movementPromises![0].fulfilled, undefined);
  if (method === 'silent') assert.equal(next.richeseAuction!.sealed[f.target], 0);
  else assert.ok(next.richeseAuction!.passed.includes(f.target));
  const waiting = { ...props, game: viewGame(next, f.target) };
  assert.deepEqual(waiting.game.movementPromisePolicy, []);
  assert.equal(controls(MovementPromises(waiting)).length, 0);
  const after = markup(waiting);
  assert.match(after, /Your ground-movement promises/);
  assert.match(after, /Your Movement turn is still ahead/);
  assert.match(after, /Yes: you must make a ground movement of at least 8 physical forces to Carthag/);
  assert.doesNotMatch(after, /<button/);
}

void test('real Once Around movement guidance submits only the current native pass and retains its notice', () => {
  nativeControl('onceAround');
});
void test('real Silent movement guidance submits zero with the original native event and retains its notice', () => {
  nativeControl('silent');
});
