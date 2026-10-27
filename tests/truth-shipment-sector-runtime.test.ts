import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TurnActionGuideButton } from '../components/turn-action-promises';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { viewGame, type Action, type Game } from '../game/engine';
import { declareTruthTurnAction, settleTruthTurnAction, truthTurnActionInventory, truthTurnActionPlayer } from './fixture-truth-turn-action';
import {
  actTruthShipmentSector as act, askTruthShipmentSector as ask, bindTruthShipmentSector as bind,
  createTruthShipmentSectorFixture as fixture, sectorShipment,
} from './fixture-truth-shipment-sector';

function rejected(game: Game, actor: string, action: Action) {
  const before = structuredClone(game); assert.throws(() => act(game, actor, action)); assert.deepEqual(game, before);
}
function row(game: Game, player: string) {
  const promise = game.turnActionPromises?.find(item => item.player === player);
  assert.ok(promise); return promise;
}

void test('Yes binds an actual original reserve shipment to the exact sector and shares its private native guide', () => {
  const f = fixture(), asked = bind(f, 'yes'); let game = asked.game;
  assert.ok(viewGame(asked.asked, f.target).truthTurnActionAnswers?.includes('yes'));
  assert.deepEqual(row(game, f.target).mixed, f.mixed);
  assert.ok(!viewGame(game, f.observer).turnActionPromises.some(item => item.player === f.target));
  rejected(game, f.target, f.shipment(f.alternative));
  rejected(game, f.target, { type: 'endMovement' });
  const view = viewGame(game, f.target), guide = view.turnActionGuide; assert.ok(guide);
  assert.equal(guide.action.type, 'ship'); assert.equal(guide.action.territory, f.territory);
  assert.equal(guide.action.sector, f.sector); assert.equal(guide.action.amount, 1);
  const sent: Action[] = [], props = { game: view, busy: false, act: (next: Action) => sent.push(next) };
  const button = TurnActionGuideButton(props); assert.ok(button); assert.equal(button.props.disabled, false);
  assert.match(renderToStaticMarkup(createElement(TurnActionGuideButton, props)), /ship|shipment/i);
  button.props.onClick(); assert.deepEqual(sent, [guide.action]);
  for (const difficulty of DIFFICULTIES) {
    const bot = viewGame(game, f.target);
    bot.players.find(player => player.id === f.target)!.bot = difficulty;
    assert.deepEqual(botActions(bot)[0], guide.action);
  }
  const spice = truthTurnActionPlayer(game, f.target).spice, reserves = truthTurnActionPlayer(game, f.target).reserves;
  game = settleTruthTurnAction(act(game, f.target, guide.action));
  assert.equal(truthTurnActionPlayer(game, f.target).forces[`${f.territory}:${f.sector}`], 1);
  assert.equal(truthTurnActionPlayer(game, f.target).reserves, reserves - 1);
  assert.equal(truthTurnActionPlayer(game, f.target).spice, spice - 2);
  assert.equal(row(game, f.target).shipment.event?.sector, f.sector);
  assert.equal(row(game, f.target).fulfilled, true);
  assert.equal(game.discard.filter(card => card.id === f.truths[0]).length, 1);
  assert.deepEqual(truthTurnActionInventory(game), f.originalCards);
});

void test('No forbids only the named sector and permits another legal sector of the same territory', () => {
  const f = fixture(); let game = bind(f, 'no').game;
  rejected(game, f.target, f.shipment(f.sector));
  game = settleTruthTurnAction(act(game, f.target, f.shipment(f.alternative)));
  assert.equal(truthTurnActionPlayer(game, f.target).forces[`${f.territory}:${f.alternative}`], 1);
  assert.equal(row(game, f.target).shipment.event?.sector, f.alternative);
  assert.equal(row(game, f.target).fulfilled, true);
  assert.deepEqual(truthTurnActionInventory(game), f.originalCards);
});

void test('invalid printed sector is rejected without consuming the Truthtrance', () => {
  const f = fixture(), declared = declareTruthTurnAction(f.base).game;
  rejected(declared, f.asker, { type: 'truthAsk', question: { kind: 'turnActions', target: f.target,
    turn: declared.turn, mixed: sectorShipment(f.territory, 0) } });
  assert.ok(truthTurnActionPlayer(declared, f.asker).hand.some(card => card.id === f.truths[0]));
});

void test('two original Truthtrances cannot require two different sectors in the single shipment', () => {
  const f = fixture(); let game = bind(f, 'yes').game;
  game = declareTruthTurnAction(f.base, game, 1).game;
  game = ask(game, f, sectorShipment(f.territory, f.alternative));
  const answers = viewGame(game, f.target).truthTurnActionAnswers;
  assert.ok(answers?.includes('no')); assert.ok(!answers?.includes('yes'));
  rejected(game, f.target, { type: 'truthAnswer', answer: 'yes' });
  game = act(game, f.target, { type: 'truthAnswer', answer: 'no' });
  rejected(game, f.target, f.shipment(f.alternative));
  game = settleTruthTurnAction(act(game, f.target, f.shipment(f.sector)));
  assert.equal(game.turnActionPromises?.filter(item => item.player === f.target).length, 2);
  assert.ok(game.turnActionPromises?.filter(item => item.player === f.target).every(item => item.fulfilled));
  assert.deepEqual(truthTurnActionInventory(game), f.originalCards);
});

void test('an OR answer can be satisfied by either exact sector without inventing another shipment', () => {
  const f = fixture();
  const mixed = { kind: 'or', terms: [f.mixed, sectorShipment(f.territory, f.alternative)] };
  let game = bind(f, 'yes', mixed).game;
  game = settleTruthTurnAction(act(game, f.target, f.shipment(f.alternative)));
  assert.equal(row(game, f.target).fulfilled, true);
  assert.equal(row(game, f.target).shipment.event?.sector, f.alternative);
  assert.equal(truthTurnActionPlayer(game, f.target).reserves, 9);
  assert.deepEqual(truthTurnActionInventory(game), f.originalCards);
});
