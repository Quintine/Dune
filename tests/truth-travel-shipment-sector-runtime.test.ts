import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TravelPromiseGuideButton } from '../components/travel-promises';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { viewGame, type Action, type Game } from '../game/engine';
import { declareTruthTurnAction, settleTruthTurnAction, truthTurnActionInventory, truthTurnActionPlayer } from './fixture-truth-turn-action';
import {
  actTruthShipmentSector as act, createTruthShipmentSectorFixture as fixture,
  sectorShipment, type TruthShipmentSectorFixture,
} from './fixture-truth-shipment-sector';

/** Uses the genuine Basic fixture's original setup, dealt Truth and actual
 * Shipment and Movement turn; only its real native sectors are selected. */
function bind(f: TruthShipmentSectorFixture, answer: 'yes' | 'no', mixed: unknown = f.mixed) {
  const declared = declareTruthTurnAction(f.base).game;
  const asked = act(declared, f.asker, { type: 'truthAsk', question: {
    kind: 'travel', target: f.target, turn: declared.turn, mixed: structuredClone(mixed),
  } } as Action);
  assert.ok(viewGame(asked, f.target).truthTravelAnswers?.includes(answer));
  const game = act(asked, f.target, { type: 'truthAnswer', answer });
  return { asked, game };
}
function rejected(game: Game, actor: string, action: Action) {
  const before = structuredClone(game); assert.throws(() => act(game, actor, action)); assert.deepEqual(game, before);
}
function row(game: Game, owner: string) {
  const result = game.travelPromises?.find(promise => promise.player === owner);
  assert.ok(result); return result;
}

void test('standalone travel Yes binds the one native reserve shipment to the exact sector', () => {
  const f = fixture(), bound = bind(f, 'yes'); let game = bound.game;
  assert.deepEqual(row(game, f.target).mixed, f.mixed);
  assert.ok(!viewGame(game, f.observer).travelPromises.some(promise => promise.player === f.target));
  rejected(game, f.target, f.shipment(f.alternative));
  rejected(game, f.target, { type: 'endMovement' });
  const view = viewGame(game, f.target), guide = view.travelPromiseGuide;
  assert.ok(guide); assert.equal(guide.action.type, 'ship');
  assert.equal(guide.action.territory, f.territory); assert.equal(guide.action.sector, f.sector);
  const sent: Action[] = [], props = { game: view, busy: false, act: (next: Action) => sent.push(next) };
  const button = TravelPromiseGuideButton(props); assert.ok(button); assert.equal(button.props.disabled, false);
  assert.match(renderToStaticMarkup(createElement(TravelPromiseGuideButton, props)), new RegExp(`sector ${f.sector}`, 'i'));
  button.props.onClick(); assert.deepEqual(sent, [guide.action]);
  for (const difficulty of DIFFICULTIES) {
    const bot = viewGame(game, f.target);
    bot.players.find(player => player.id === f.target)!.bot = difficulty;
    assert.deepEqual(botActions(bot)[0], guide.action);
  }
  const before = truthTurnActionPlayer(game, f.target);
  const reserves = before.reserves, spice = before.spice;
  game = settleTruthTurnAction(act(game, f.target, guide.action));
  assert.equal(row(game, f.target).shipment.event?.sector, f.sector);
  assert.equal(row(game, f.target).fulfilled, true);
  assert.equal(truthTurnActionPlayer(game, f.target).forces[`${f.territory}:${f.sector}`], 1);
  assert.equal(truthTurnActionPlayer(game, f.target).reserves, reserves - 1);
  assert.equal(truthTurnActionPlayer(game, f.target).spice, spice - 2);
  assert.equal(game.discard.filter(card => card.id === f.truths[0]).length, 1);
  assert.deepEqual(truthTurnActionInventory(game), f.originalCards);
});

void test('standalone travel No forbids the named sector and permits another real sector', () => {
  const f = fixture(); let game = bind(f, 'no').game;
  rejected(game, f.target, f.shipment(f.sector));
  game = settleTruthTurnAction(act(game, f.target, f.shipment(f.alternative)));
  assert.equal(truthTurnActionPlayer(game, f.target).forces[`${f.territory}:${f.alternative}`], 1);
  assert.equal(row(game, f.target).shipment.event?.sector, f.alternative);
  game = settleTruthTurnAction(act(game, f.target, { type: 'endMovement' }));
  assert.equal(row(game, f.target).fulfilled, true);
  assert.deepEqual(truthTurnActionInventory(game), f.originalCards);
});

void test('standalone travel OR accepts either actual sector through the single shipment', () => {
  const f = fixture();
  const mixed = { kind: 'or', terms: [f.mixed, sectorShipment(f.territory, f.alternative)] };
  const bound = bind(f, 'yes', mixed).game;
  for (const sector of [f.sector, f.alternative]) {
    const game = settleTruthTurnAction(act(bound, f.target, f.shipment(sector)));
    assert.equal(row(game, f.target).fulfilled, true);
    assert.equal(row(game, f.target).shipment.event?.sector, sector);
    assert.equal(truthTurnActionPlayer(game, f.target).reserves, 9);
    assert.deepEqual(truthTurnActionInventory(game), f.originalCards);
  }
});
