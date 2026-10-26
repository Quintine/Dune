import assert from 'node:assert/strict';
import test from 'node:test';
import { viewGame } from '../game/engine';
import {
  createTruthAllianceFixture as fixture, bindTruthAlliance as bind,
  declareTruthAlliance as declare, askTruthAlliance as ask, answerTruthAlliance as answer,
  actTruthAlliance as act, closeTruthAllianceNexus as close, truthAlliancePlayer as player,
  truthAllianceInventory as inventory,
} from './fixture-truth-alliance';

for (const answer of ['yes', 'no'] as const) void test(`controlled prior foreign shipment impossibility settles before a still-owned Alliance ${answer}`, () => {
  const f = fixture(), bound = bind(f, answer);
  const controlled = structuredClone(bound.game);
  // Only this prior debt is controlled: it represents the already-lost funded
  // route after a foreign event. Nexus, cards, invitation and answer are earned.
  controlled.shipmentPromises = [{ turn: controlled.turn, player: f.target, asker: f.asker,
    claim: { territory: 'carthag', minimum: 20 }, answer: true }];
  const game = act(controlled, f.partner, { type: 'bribe', target: f.asker, amount: 1 });
  assert.equal(game.shipmentPromises![0].released, true);
  const promise = game.alliancePromises![0];
  assert.ok(!promise.fulfilled && !promise.released);
  const guide = viewGame(game, f.target).alliancePromiseGuide; assert.ok(guide);
  assert.equal(guide.action.type, answer === 'yes' ? 'alliance' : 'ready');
  assert.deepEqual(inventory(game), f.originalCards);
});

void test('two original Truth cards preserve an owed native bribe before accepting its named Nexus partner', () => {
  const f = fixture();
  let game = declare(f, f.game, { copies: 2 }).game;
  game = act(game, f.asker, { type: 'truthAsk', question: {
    kind: 'bribe', target: f.target, turn: game.turn, recipient: f.partner, minimum: 3,
  } });
  assert.ok(viewGame(game, f.target).truthBribeAnswers?.includes('yes'));
  game = answer(game, f.target, 'yes');
  game = ask(game, f.asker, f.target, f.partner);
  assert.ok(viewGame(game, f.target).truthAllianceAnswers?.includes('yes'));
  game = answer(game, f.target, 'yes');
  assert.equal(viewGame(game, f.target).alliancePromiseGuide, null);
  const payment = viewGame(game, f.target).bribePromiseGuide; assert.ok(payment);
  const before = player(game, f.partner).spice;
  game = act(game, f.target, payment.action);
  assert.equal(player(game, f.target).spice, 7);
  assert.equal(player(game, f.partner).spice, before);
  assert.equal(player(game, f.partner).bribes, 3);
  assert.ok(game.bribePromises![0].fulfilled);
  const acceptance = viewGame(game, f.target).alliancePromiseGuide; assert.ok(acceptance);
  game = act(game, f.target, acceptance.action);
  assert.equal(player(game, f.target).ally, f.partner);
  assert.ok(!game.alliancePromises![0].fulfilled);
  game = close(game);
  assert.ok(game.alliancePromises![0].fulfilled);
  assert.equal(player(game, f.partner).bribes, 3);
  assert.deepEqual(inventory(game), f.originalCards);
});
