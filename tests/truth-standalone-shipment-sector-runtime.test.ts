import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ShipmentPromises } from '../components/shipment-promises';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { viewGame, type Action, type Game } from '../game/engine';
import { liveShipmentPromises, matchesShipment } from '../game/shipment-promises';
import { declareTruthTurnAction, settleTruthTurnAction, truthTurnActionInventory, truthTurnActionPlayer } from './fixture-truth-turn-action';
import { actTruthShipmentSector as act, createTruthShipmentSectorFixture as fixture,
  type TruthShipmentSectorFixture } from './fixture-truth-shipment-sector';

function asked(f: TruthShipmentSectorFixture): Game {
  const declared = declareTruthTurnAction(f.base).game;
  return act(declared, f.asker, { type: 'truthAsk', question: {
    kind: 'shipment', target: f.target, territory: f.territory, minimum: 1, sector: f.sector,
  } });
}
function rejected(game: Game, actor: string, action: Action) {
  const before = structuredClone(game); assert.throws(() => act(game, actor, action)); assert.deepEqual(game, before);
}

void test('standalone exact-sector shipment Yes exposes the native witness and all bot profiles honor it', () => {
  const f = fixture(), question = asked(f);
  assert.ok(viewGame(question, f.target).truthShipmentAnswers?.includes('yes'));
  let game = act(question, f.target, { type: 'truthAnswer', answer: 'yes' });
  assert.equal(game.shipmentPromises?.[0].sector, f.sector);
  const view = viewGame(game, f.target), witness = view.shipmentCompletion?.actions[0]; assert.ok(witness);
  assert.equal(witness.type, 'ship'); assert.equal(witness.territory, f.territory); assert.equal(witness.sector, f.sector);
  assert.ok(Number(witness.amount) >= 1);
  const html = renderToStaticMarkup(createElement(ShipmentPromises, { game: view, busy: false, act() {} }));
  assert.match(html, /Suggested next step/); assert.match(html, new RegExp(`sector ${f.sector}`));
  assert.match(html, /Cost:/);
  for (const difficulty of DIFFICULTIES) {
    const bot = viewGame(game, f.target); bot.players.find(player => player.id === f.target)!.bot = difficulty;
    assert.deepEqual(botActions(bot)[0], witness);
  }
  rejected(game, f.target, f.shipment(f.alternative));
  const beforeSpice = truthTurnActionPlayer(game, f.target).spice, beforeReserves = truthTurnActionPlayer(game, f.target).reserves;
  game = settleTruthTurnAction(act(game, f.target, witness));
  const count = Number(witness.amount);
  assert.equal(truthTurnActionPlayer(game, f.target).forces[`${f.territory}:${f.sector}`], count);
  assert.equal(truthTurnActionPlayer(game, f.target).reserves, beforeReserves - count);
  assert.equal(truthTurnActionPlayer(game, f.target).spice, beforeSpice - count * 2);
  assert.equal(game.shipmentPromises?.[0].fulfilled, true);
  assert.deepEqual(truthTurnActionInventory(game), f.originalCards);
});

void test('standalone No excludes the named sector, permits another sector and keeps all bot candidates legal', () => {
  const f = fixture(), question = asked(f);
  assert.ok(viewGame(question, f.target).truthShipmentAnswers?.includes('no'));
  let game = act(question, f.target, { type: 'truthAnswer', answer: 'no' });
  const promises = liveShipmentPromises(game.shipmentPromises ?? [], f.target, game.turn);
  assert.equal(promises.length, 1); assert.equal(promises[0].sector, f.sector);
  rejected(game, f.target, f.shipment(f.sector));
  for (const difficulty of DIFFICULTIES) {
    const bot = viewGame(game, f.target); bot.players.find(player => player.id === f.target)!.bot = difficulty;
    for (const action of botActions(bot)) {
      if (action.type !== 'ship' && !(action.type === 'guildShip' && action.from === 'reserves')) continue;
      const shipment = { territory: String(action.territory), sector: Number(action.sector), amount: Number(action.amount) };
      assert.ok(promises.every(promise => matchesShipment(promise, shipment) === promise.answer));
    }
  }
  const beforeSpice = truthTurnActionPlayer(game, f.target).spice;
  game = settleTruthTurnAction(act(game, f.target, f.shipment(f.alternative)));
  assert.equal(truthTurnActionPlayer(game, f.target).forces[`${f.territory}:${f.alternative}`], 1);
  assert.equal(truthTurnActionPlayer(game, f.target).spice, beforeSpice - 2);
  assert.equal(game.shipmentPromises?.[0].fulfilled, true);
  assert.deepEqual(truthTurnActionInventory(game), f.originalCards);
});
