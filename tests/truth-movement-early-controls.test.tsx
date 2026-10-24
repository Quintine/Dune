import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MovementPromises } from '../components/movement-promises';
import { baseDeck } from '../game/cards';
import { createGame, joinGame, newPlayer, viewGame, type Action, type GameView } from '../game/engine';
import { createTruthMovementEarlyFixture, actTruthMovementEarly as act } from './fixture-truth-movement-early';

type Props = Parameters<typeof MovementPromises>[0];
type Control = { children?: unknown; disabled?: boolean; onClick: () => void };
function controls(node: unknown): Control[] {
  if (Array.isArray(node)) return node.flatMap(controls);
  if (!node || typeof node !== 'object' || !('props' in node)) return [];
  const props = (node as ReactElement<{ children?: unknown; disabled?: boolean; onClick?: () => void }>).props;
  return [...(props.onClick ? [{ ...props, onClick: props.onClick }] : []), ...controls(props.children)];
}
const markup = (props: Props) => renderToStaticMarkup(createElement(MovementPromises, props));

/** Controlled personalized UI projections for label/dispatch boundaries only.
 * They do not establish earned Charity, Tanks, bids, cards or early feasibility.
 * The separate original-source case below binds a real early answer. */
function projectedView(phase: number, policy: Action[] | null = null, active: string | null = 'a'): GameView {
  const source = createGame('EARLYMOVEMENTCONTROLS', newPlayer('p', 'Respondent', 'emperor'));
  joinGame(source, newPlayer('a', 'Asker', 'atreides'));
  const game = viewGame(source, 'p');
  game.status = 'playing'; game.turn = 1; game.phase = phase; game.active = active;
  game.movementPromises = [{ player: 'p', asker: 'a', turn: 1,
    territory: 'carthag', minimum: 8, answer: true }];
  game.movementPromisePolicy = policy;
  return game;
}
function assertCurrentControl(game: GameView, action: Action, label: string) {
  const sent: Action[] = [], props = { game, busy: false, act: (value: Action) => { sent.push(value); } };
  const html = markup(props);
  assert.match(html, /Your Movement turn is still ahead/);
  assert.match(html, /Complete any current preparation below before confirming readiness/);
  assert.match(html, /Yes: you must make a ground movement of at least 8 physical forces to Carthag/);
  assert.match(html, /a shipment can prepare that move but does not fulfill it/);
  assert.doesNotMatch(html, />Ship \d|>Move \d|>Use Ornithopter and move|>Finish movement while honoring No/);
  const available = controls(MovementPromises(props));
  assert.equal(available.length, 1); assert.equal(available[0].children, label);
  assert.equal(available[0].disabled, false);
  available[0].onClick(); assert.equal(sent.length, 1); assert.equal(sent[0], action);
  const busy = controls(MovementPromises({ ...props, busy: true }));
  assert.equal(busy.length, 1); assert.equal(busy[0].disabled, true);
  busy[0].onClick(); assert.equal(sent.length, 1, 'A stale busy handler cannot submit again');
  assert.match(markup({ ...props, busy: true }), /Your ground-movement promises/);
  return props;
}

void test('real early Charity binding exposes only current readiness and keeps its obligation readable after submission', () => {
  const f = createTruthMovementEarlyFixture();
  let game = act(f.game, f.asker, { type: 'card', card: f.truth });
  for (const player of game.players)
    if (!game.truthtrance!.passed.includes(player.id)) game = act(game, player.id, { type: 'truthPass' });
  game = act(game, f.asker, { type: 'truthAsk', question: f.claim });
  game = act(game, f.target, { type: 'truthAnswer', answer: 'yes' });
  if (game.pendingTreacheryDiscard?.reaction) {
    const event = game.pendingTreacheryDiscard.batch.event;
    for (const player of game.players) game = act(game, player.id, { type: 'semutaPass', event });
  }
  assert.equal(game.phase, 2);
  const view = viewGame(game, f.target), next = view.movementPromisePolicy?.[0];
  assert.deepEqual(next, { type: 'ready' });
  const sent: Action[] = [], props = { game: view, busy: false, act: (action: Action) => { sent.push(action); } };
  const before = markup(props);
  assert.match(before, /Your Movement turn is still ahead/);
  assert.match(before, /Finish this preparation phase while preserving your promises/);
  assert.equal(controls(MovementPromises(props)).length, 1);
  assert.doesNotMatch(before, />Ship \d|>Move \d|>Finish movement while honoring No/);
  controls(MovementPromises({ ...props, busy: true }))[0].onClick(); assert.equal(sent.length, 0);
  controls(MovementPromises(props))[0].onClick(); assert.deepEqual(sent, [next]);
  game = act(game, f.target, sent[0]); assert.ok(game.ready.includes(f.target));
  const waiting = { ...props, game: viewGame(game, f.target) };
  assert.equal(controls(MovementPromises(waiting)).length, 0);
  const after = markup(waiting);
  assert.match(after, /Your Movement turn is still ahead/);
  assert.match(after, /Yes: you must make a ground movement of at least 8 physical forces to Carthag/);
  assert.match(after, /needed forces, spice and cards available/);
});

void test('projected Charity and Revival controls forward only their current preparation with busy protection', () => {
  const charity: Action = { type: 'charity' };
  assertCurrentControl(projectedView(2, [charity], null), charity, 'Claim Charity for your later movement');
  const revival: Action = { type: 'revive', amount: 3, elite: 1 };
  assertCurrentControl(projectedView(4, [revival], null), revival, 'Revive 3 forces for your later movement');
});

void test('projected Charity and Revival readiness remains a current control while later movement stays deferred', () => {
  for (const phase of [2, 4]) {
    const ready: Action = { type: 'ready' };
    assertCurrentControl(projectedView(phase, [ready], null), ready,
      'Finish this preparation phase while preserving your promises');
  }
});

void test('the current bid-pass control preserves its exact action without offering a future shipment', () => {
  const pass: Action = { type: 'passBid' };
  assertCurrentControl(projectedView(3, [pass], 'p'), pass, 'Pass this bid and preserve later movement');
});

void test('current auction guidance distinguishes original cash and physical Karama payment decisions', () => {
  const cash: Action = { type: 'decision', karama: false }, cashView = projectedView(3, [cash], 'p');
  cashView.decision = { kind: 'auctionPayment', player: cashView.me };
  assertCurrentControl(cashView, cash, 'Pay the current auction price');
  const card = baseDeck().find(card => card.effect === 'karama'); assert.ok(card);
  const payment: Action = { type: 'decision', karama: true, card: card.id };
  const cardView = projectedView(3, [payment], 'p');
  cardView.decision = { kind: 'auctionPayment', player: cardView.me };
  cardView.players.find(player => player.id === cardView.me)!.hand = [card];
  assertCurrentControl(cardView, payment, `Use ${card.name} for the current auction payment`);
});

void test('early notices persist without a current control and cannot turn future movement policy into an early action', () => {
  const future: Action[] = [
    { type: 'ship', territory: 'arrakeen', sector: 10, amount: 8, elite: 0, allyPayment: 0 },
    { type: 'move', from: 'arrakeen:10', territory: 'carthag', sector: 11, amount: 8 },
    { type: 'endMovement' },
    { type: 'card', card: 'future-hajr' },
  ];
  for (const phase of [0, 1, 2, 3, 4]) for (const policy of [null, ...future.map(action => [action])]) {
    const props = { game: projectedView(phase, policy), busy: false,
      act() { assert.fail('An early notice cannot execute a later shipment or move'); } };
    assert.equal(controls(MovementPromises(props)).length, 0);
    const html = markup(props);
    assert.match(html, /Your Movement turn is still ahead/);
    assert.match(html, /movement controls appear on your turn/);
    assert.match(html, /Yes: you must make a ground movement of at least 8 physical forces to Carthag/);
    assert.doesNotMatch(html, /<button/);
  }
});

void test('an out-of-phase preparation or foreign auction payment never becomes an owned early control', () => {
  for (const [phase, action] of [[2, { type: 'revive', amount: 1 }], [4, { type: 'charity' }],
    [3, { type: 'ready' }]] satisfies [number, Action][]) {
    const props = { game: projectedView(phase, [action]), busy: false, act() { assert.fail('Wrong preparation phase'); } };
    assert.equal(controls(MovementPromises(props)).length, 0);
  }
  const foreign = projectedView(3, [{ type: 'decision', karama: false }]);
  foreign.decision = { kind: 'auctionPayment', player: 'a' };
  assert.equal(controls(MovementPromises({ game: foreign, busy: false,
    act() { assert.fail('A foreign invoice cannot become an owned control'); } })).length, 0);
});
