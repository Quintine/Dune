import assert from 'node:assert/strict';
import test from 'node:test';
import { Children, createElement, isValidElement, type ButtonHTMLAttributes, type MouseEvent, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ShipmentPromises } from '../components/shipment-promises';
import { createGame, joinGame, newPlayer, viewGame, type Action, type GameView } from '../game/engine';
import { baseDeck } from '../game/cards';

const shipment: Action = { type: 'ship', territory: 'carthag', sector: 11, amount: 3, elite: 0 };
type Props = Parameters<typeof ShipmentPromises>[0];

/** Controlled personalized UI projection, not an earned early Truthtrance or
 * preparation history. Native current-phase legality is separate engine proof. */
function controlledView(phase = 3, active: string | null = 'p'): GameView {
  const source = createGame('EARLYTRUTHCONTROLS', newPlayer('p', 'Respondent', 'emperor'));
  joinGame(source, newPlayer('a', 'Asker', 'atreides'));
  const game = viewGame(source, 'p');
  game.status = 'playing'; game.turn = 2; game.phase = phase; game.active = active;
  game.players.find(player => player.id === 'p')!.spice = 6;
  game.shipmentPromises = [{ player: 'p', asker: 'a', turn: 2, territory: 'carthag', minimum: 3, answer: true }];
  game.shipmentCompletion = null;
  game.shipmentPreparation = null;
  return game;
}
const markup = (game: GameView, busy = false) => renderToStaticMarkup(createElement(ShipmentPromises, {
  game, busy, act() { assert.fail('Rendering must not submit current preparation or early shipment'); },
}));
function actionButton(props: Props, label: string): ReactElement<ButtonHTMLAttributes<HTMLButtonElement>> {
  function find(node: ReactNode): ReactElement<ButtonHTMLAttributes<HTMLButtonElement>> | undefined {
    if (!isValidElement<{ children?: ReactNode; onClick?: unknown }>(node)) return;
    if (node.props.children === label && typeof node.props.onClick === 'function')
      return node as ReactElement<ButtonHTMLAttributes<HTMLButtonElement>>;
    return Children.toArray(node.props.children).map(find).find(Boolean);
  }
  const button = find(ShipmentPromises(props)); assert.ok(button, label); return button;
}
const click = (button: ReactElement<ButtonHTMLAttributes<HTMLButtonElement>>) =>
  button.props.onClick!({} as MouseEvent<HTMLButtonElement>);

void test('early active and waiting respondents see later-this-turn guidance without executable future shipment', () => {
  for (const phase of [0, 1, 2, 3, 4]) for (const active of ['p', 'a', null]) {
    const game = controlledView(phase, active);
    game.shipmentCompletion = { get actions(): Action[] { throw new Error('Early UI must not inspect future executable shipment actions'); } };
    const html = markup(game);
    assert.match(html, /shipment opportunity is later this turn, during Shipment and Movement/);
    assert.match(html, /needed spice, forces and cards available/);
    assert.match(html, /continue playing the current phase normally/);
    assert.match(html, /During your later Shipment and Movement turn/);
    assert.doesNotMatch(html, /other players finish|Suggested next step|<button|Cost:/);
    assert.match(html, /ship at least 3 physical forces from your reserves to Carthag/);
  }
});

void test('projected current charity forwards its exact action once and busy controls cannot submit', () => {
  const game = controlledView(2, null), charity: Action = { type: 'charity' };
  game.shipmentPreparation = { actions: [charity] };
  const sent: Action[] = [], props = { game, busy: false, act: (action: Action) => sent.push(action) };
  const html = markup(game);
  assert.match(html, /aria-label="Current shipment preparation"/);
  assert.match(html, /This preparation is available in the current phase/);
  assert.doesNotMatch(html, /Suggested next step|Ship 3 forces|Cost:/);
  const available = actionButton(props, 'Claim charity');
  assert.equal(available.props.disabled, false);
  click(available);
  assert.equal(sent.length, 1);
  assert.equal(sent[0], charity);
  const busy = actionButton({ ...props, busy: true }, 'Claim charity');
  assert.equal(busy.props.disabled, true);
  click(busy);
  assert.equal(sent.length, 1);
});

void test('current Revival preparation retains its projected force count and elite payload without revealing a future route', () => {
  const game = controlledView(4), revival: Action = { type: 'revive', amount: 3, elite: 1 };
  game.shipmentPreparation = { actions: [revival] };
  const sent: Action[] = [], props = { game, busy: false, act: (action: Action) => sent.push(action) };
  assert.match(markup(game), /Revive 3 forces in Revival/);
  assert.doesNotMatch(markup(game), /Ship 3 forces|Suggested next step|Cost:/);
  click(actionButton(props, 'Revive 3 forces in Revival'));
  assert.equal(sent[0], revival);
  assert.deepEqual(sent, [{ type: 'revive', amount: 3, elite: 1 }]);
  const busy = actionButton({ ...props, busy: true }, 'Revive 3 forces in Revival');
  assert.equal(busy.props.disabled, true); click(busy);
  assert.equal(sent.length, 1);
  game.shipmentPreparation = { actions: [shipment] };
  assert.doesNotMatch(markup(game), /<button|Current shipment preparation/,
    'An accidental future shipment in the preparation field must not become a current control');
  game.shipmentPreparation = { actions: [{ type: 'endMovement' }] };
  assert.doesNotMatch(markup(game), /<button|Current shipment preparation/);
});

void test('an owned preparation card is named and preserves its projected action while foreign or unknown cards stay unavailable', () => {
  const game = controlledView(4), card = baseDeck().find(card => card.effect === 'ghola'); assert.ok(card);
  const own = game.players.find(player => player.id === game.me)!;
  own.hand = [card];
  const action: Action = { type: 'card', card: card.id, amount: 3, elite: 1 };
  game.shipmentPreparation = { actions: [action] };
  const sent: Action[] = [], props = { game, busy: false, act: (value: Action) => sent.push(value) };
  assert.match(markup(game), new RegExp(`Play ${card.name}`));
  click(actionButton(props, `Play ${card.name}`));
  assert.equal(sent[0], action);
  own.hand = [];
  assert.doesNotMatch(markup(game), /<button|Current shipment preparation/);
});

void test('phase-five shipment guidance retains its original private completion and ignores obsolete early preparation', () => {
  const game = controlledView(5);
  game.shipmentCompletion = { actions: [shipment] } as NonNullable<GameView['shipmentCompletion']>;
  game.shipmentPreparation = { actions: [{ type: 'charity' }] };
  const sent: Action[] = [], props = { game, busy: false, act: (action: Action) => sent.push(action) };
  const html = markup(game);
  assert.match(html, /Suggested next step · private/);
  assert.match(html, /Ship 3 forces to Carthag, sector 11/);
  assert.match(html, /Cost: 3 spice/);
  assert.doesNotMatch(html, /Current shipment preparation|Claim charity|opportunity is later this turn/);
  click(actionButton(props, 'Ship 3 forces to Carthag, sector 11'));
  assert.equal(sent[0], shipment);
  game.active = 'a'; game.shipmentCompletion = null;
  assert.match(markup(game), /Your shipment turn is still ahead/);
  assert.doesNotMatch(markup(game), /<button|Suggested next step/);
});

void test('early grouped promises retain the original question and own-answer filtering without exposing normalized private facts', () => {
  const game = controlledView();
  game.shipmentPromises = [
    { player: 'p', asker: 'a', turn: 2, answer: true,
      claim: { op: 'and', terms: [{ constant: 'yes' }, { territory: 'carthag', minimum: 3 }] },
      mixed: { kind: 'and', terms: [
        { kind: 'fact', fact: { kind: 'spice', compare: 'gte', value: 1 } },
        { kind: 'shipment', territory: 'carthag', minimum: 3 },
      ] } },
    { player: 'a', asker: 'p', turn: 2, answer: false, territory: 'arrakeen', minimum: 19 },
  ];
  Object.defineProperty(game.players.find(player => player.id === 'a')!, 'hand', {
    get() { assert.fail('Shipment guidance must not inspect another player hand'); },
  });
  const html = markup(game);
  assert.match(html, /You answered Yes to/);
  assert.match(html, /AND/); assert.match(html, /Carthag/);
  assert.doesNotMatch(html, /constant|Arrakeen|19 physical|You answered No/);
  assert.doesNotMatch(html, /<button|Suggested next step/);
});
