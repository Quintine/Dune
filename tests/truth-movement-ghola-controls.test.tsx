import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MovementPromises } from '../components/movement-promises';
import { NullentropySearch } from '../components/nullentropy-box';
import { viewGame, type Action, type Game } from '../game/engine';
import {
  createTruthMovementGholaFixture, createTruthMovementBoxGholaFixture,
  actTruthMovementGhola as act, advanceTruthMovementGhola as advance,
  truthMovementGholaClean as clean, truthMovementGholaPlayer as player,
  type TruthMovementGholaFixture,
} from './fixture-truth-movement-ghola';

type Props = Parameters<typeof MovementPromises>[0];
type Control = { children?: unknown; disabled?: boolean; onClick: () => void };
function controls(node: unknown): Control[] {
  if (Array.isArray(node)) return node.flatMap(controls);
  if (!node || typeof node !== 'object' || !('props' in node)) return [];
  const props = (node as ReactElement<{ children?: unknown; disabled?: boolean; onClick?: () => void }>).props;
  return [...(props.onClick ? [{ ...props, onClick: props.onClick }] : []), ...controls(props.children)];
}
const markup = (props: Props) => renderToStaticMarkup(createElement(MovementPromises, props));
type Source = Pick<TruthMovementGholaFixture, 'game' | 'asker' | 'target' | 'truthStep' | 'askStep'>;

/** Actual declaration, answer and native discard controls; no installed policy. */
function bind(f: Source): Game {
  let game = act(f.game, f.asker, f.truthStep.action);
  while (game.truthtrance?.stage === 'priority') {
    const p = game.players.find(p => !game.truthtrance!.passed.includes(p.id)); assert.ok(p);
    game = act(game, p.id, { type: 'truthPass' });
  }
  game = act(game, f.asker, f.askStep.action);
  assert.ok(viewGame(game, f.target).truthMovementAnswers?.includes('yes'));
  game = act(game, f.target, { type: 'truthAnswer', answer: 'yes' });
  return advance(game, clean);
}
function clickCurrent(game: Game, actor: string, label: string): Action {
  const sent: Action[] = [], props = { game: viewGame(game, actor), busy: false,
    act: (action: Action) => { sent.push(action); } };
  const available = controls(MovementPromises(props));
  assert.equal(available.length, 1); assert.equal(available[0].children, label);
  assert.equal(available[0].disabled, false);
  assert.match(markup(props), /Yes: you must make a ground movement of at least 20 physical forces to Carthag/);
  assert.match(markup(props), /a shipment can prepare that move but does not fulfill it/);
  const busy = controls(MovementPromises({ ...props, busy: true }));
  assert.equal(busy.length, 1); assert.equal(busy[0].disabled, true);
  busy[0].onClick(); assert.deepEqual(sent, []);
  assert.match(markup({ ...props, busy: true }), /Your ground-movement promises/);
  available[0].onClick(); assert.deepEqual(sent, props.game.movementPromisePolicy);
  assert.equal(sent[0], props.game.movementPromisePolicy![0]);
  return sent[0];
}
function assertWaitingForNativeControl(game: Game, actor: string) {
  const props = { game: viewGame(game, actor), busy: false,
    act() { assert.fail('A suspended native response must not submit movement'); } };
  assert.equal(props.game.movementPromisePolicy, null);
  assert.equal(controls(MovementPromises(props)).length, 0);
  assert.match(markup(props), /Your ground-movement promises/);
  assert.doesNotMatch(markup(props), /<button/);
}
const normalRevival = (game: Game, actor: string) => {
  const p = player(game, actor);
  return { revived: p.revived, freeForcesRevived: p.freeForcesRevived, leaderRevived: p.leaderRevived };
};

void test('real held Ghola guidance returns a Tank before shipment and only the later ground move fulfills Yes', () => {
  const f = createTruthMovementGholaFixture(); let game = bind(f);
  const allowances = normalRevival(game, f.target);
  const ghola = clickCurrent(game, f.target,
    'Play Ghola to return 1 force to reserves for the required movement');
  assert.deepEqual(ghola, f.gholaStep.action);
  // UI-only phase projection checks timing, not an earned early-rule source.
  const early = viewGame(game, f.target); early.phase = 4;
  const earlyProps = { game: early, busy: false, act() { assert.fail('Do not offer a future Ghola control early'); } };
  assert.equal(controls(MovementPromises(earlyProps)).length, 0);
  assert.match(markup(earlyProps), /Your Movement turn is still ahead/);
  game = act(game, f.target, ghola); game = advance(game, clean);
  assert.equal(player(game, f.target).reserves, 10); assert.equal(player(game, f.target).tanks, 0);
  assert.deepEqual(normalRevival(game, f.target), allowances);
  assert.equal(game.movementPromises![0].fulfilled, undefined);
  const shipment = clickCurrent(game, f.target,
    'Ship 10 forces to Arrakeen, sector 10, before the required movement');
  assert.deepEqual(shipment, f.shipment);
  game = advance(act(game, f.target, shipment), clean);
  assert.equal(player(game, f.target).spice, 0);
  assert.equal(game.movementPromises![0].fulfilled, undefined);
  const move = clickCurrent(game, f.target, 'Move 20 forces to Carthag, sector 11');
  assert.equal(move.type, 'move');
  game = act(game, f.target, move);
  assert.equal(game.movementPromises![0].fulfilled, true);
  assert.equal(MovementPromises({ game: viewGame(game, f.target), busy: false, act() {} }), null);
});

void test('a controlled original counter keeps real Ghola income pending and suspends guidance until native controls finish', () => {
  const f = createTruthMovementGholaFixture({ tleilaxu: true });
  // Explicit conserved prior acquisition; do not invent a conditional window
  // when no other player actually holds an eligible counter.
  const index = f.game.deck.findIndex(card => card.effect === 'karama'); assert.ok(index >= 0);
  player(f.game, f.asker).hand.push(f.game.deck.splice(index, 1)[0]);
  let game = bind(f);
  const originalIncome = player(game, 'tleilaxu').spice, allowances = normalRevival(game, f.target);
  const ghola = clickCurrent(game, f.target,
    'Play Ghola to return 1 force to reserves for the required movement');
  game = act(game, f.target, ghola);
  assert.equal(player(game, f.target).reserves, 10);
  assert.deepEqual(normalRevival(game, f.target), allowances);
  assert.equal(player(game, 'tleilaxu').spice, originalIncome, 'The real income remains conditional');
  assert.ok(game.response || game.pendingTreacheryDiscard);
  assertWaitingForNativeControl(game, f.target);
  game = advance(game, state => !state.pendingTreacheryDiscard);
  assert.equal(game.response?.kind, 'revivalIncome');
  assertWaitingForNativeControl(game, f.target);
  game = advance(game, clean);
  assert.equal(player(game, 'tleilaxu').spice, originalIncome + 1);
  assert.equal(game.movementPromises![0].fulfilled, undefined);
  clickCurrent(game, f.target, 'Ship 10 forces to Arrakeen, sector 10, before the required movement');
});

void test('real known Ghola Box guidance pays once and forwards its original private selection before force return', () => {
  const f = createTruthMovementBoxGholaFixture(); let game = bind(f);
  const box = clickCurrent(game, f.target, 'Pay 2 spice and search with Nullentropy Box');
  assert.deepEqual(box, f.boxStep.action);
  game = act(game, f.target, box);
  assert.equal(player(game, f.target).spice, 11);
  const view = viewGame(game, f.target), paid = { game: view, busy: false, act() {} };
  const html = markup(paid);
  assert.match(html, /fee is paid only once/); assert.doesNotMatch(html, /Pay 2 spice and search with/);
  const inspection = renderToStaticMarkup(createElement(NullentropySearch, paid));
  assert.match(inspection, /Take Tleilaxu Ghola and finish search/);
  assert.match(inspection, /Take Truthtrance and finish search/);
  const selection = clickCurrent(game, f.target, 'Choose Tleilaxu Ghola in your paid Box search');
  assert.deepEqual(selection, { type: 'decision', event: view.nullentropy!.search!.event, card: f.ghola });
  game = advance(act(game, f.target, selection), clean);
  assert.equal(game.pendingNullentropy, null); assert.equal(player(game, f.target).spice, 11);
  const ghola = clickCurrent(game, f.target,
    'Play Ghola to return 1 force to reserves for the required movement');
  game = advance(act(game, f.target, ghola), clean);
  assert.equal(game.movementPromises![0].fulfilled, undefined);
  const shipment = clickCurrent(game, f.target,
    'Ship 10 forces to Arrakeen, sector 10, before the required movement');
  game = advance(act(game, f.target, shipment), clean);
  assert.equal(player(game, f.target).spice, 1);
  const move = clickCurrent(game, f.target, 'Move 20 forces to Carthag, sector 11');
  game = act(game, f.target, move); assert.equal(game.movementPromises![0].fulfilled, true);
});
