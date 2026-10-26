import assert from 'node:assert/strict';
import test from 'node:test';
import { viewGame, type Action, type Game } from '../game/engine';
import {
  createTruthRevivalFixture as fixture, declareTruthRevival as declare,
  actTruthRevival as act, askTruthRevival as ask, answerTruthRevival as answer,
  advanceTruthRevival as advance, finishTruthRevival as finish,
  truthRevivalClean as clean, truthRevivalPlayer as player, truthRevivalInventory as inventory,
} from './fixture-truth-revival';

function reject(game: Game, actor: string, action: Action) {
  const before = structuredClone(game);
  assert.throws(() => act(game, actor, action));
  assert.deepEqual(game, before);
}
const shipmentQuestion = (target: string) => ({ kind: 'shipment', target,
  claim: { territory: 'arrakeen', minimum: 3 } });

void test('earlier actual shipment Yes reserves its three spice when a later ordinary Revival question is answered', () => {
  const f = fixture();
  let game = declare(f, f.game, { copies: 2 }).game;
  game = act(game, f.asker, { type: 'truthAsk', question: shipmentQuestion(f.target) });
  assert.ok(viewGame(game, f.target).truthShipmentAnswers?.includes('yes'));
  game = answer(game, f.target, 'yes');
  game = ask(game, f.asker, f.target, 3);
  assert.deepEqual(viewGame(game, f.target).truthRevivalAnswers, ['no']);
  reject(game, f.target, { type: 'truthAnswer', answer: 'yes' });
  game = answer(game, f.target, 'no');
  game = act(game, f.target, { type: 'revive', amount: 1, elite: 0 });
  assert.equal(player(game, f.target).spice, 4);
  assert.equal(game.revivalPromises![0].progress, 1);
  reject(game, f.target, { type: 'revive', amount: 2, elite: 0 });
  game = finish(game);
  game = advance(game, state => state.phase === 5 && state.active === f.target && clean(state));
  game = act(game, f.target, { type: 'ship', territory: 'arrakeen', sector: 10, amount: 3, elite: 0, allyPayment: 0 });
  game = advance(game, clean);
  assert.equal(player(game, f.target).spice, 1);
  assert.equal(player(game, f.target).forces['arrakeen:10'], 3);
  assert.ok(game.shipmentPromises!.every(promise => promise.fulfilled));
  assert.ok(game.revivalPromises!.every(promise => promise.fulfilled));
  assert.deepEqual(inventory(game), f.originalCards);
});

void test('earlier ordinary Revival Yes excludes an unaffordable later shipment Yes before the public answer', () => {
  const f = fixture();
  let game = declare(f, f.game, { copies: 2 }).game;
  game = ask(game, f.asker, f.target, 3);
  game = answer(game, f.target, 'yes');
  game = act(game, f.asker, { type: 'truthAsk', question: shipmentQuestion(f.target) });
  assert.deepEqual(viewGame(game, f.target).truthShipmentAnswers, ['no']);
  reject(game, f.target, { type: 'truthAnswer', answer: 'yes' });
  game = answer(game, f.target, 'no');
  const guide = viewGame(game, f.target).revivalPromiseGuide; assert.ok(guide);
  game = act(game, f.target, guide.action);
  assert.equal(player(game, f.target).spice, 0);
  assert.equal(player(game, f.target).tanks, 0);
  assert.ok(game.revivalPromises![0].fulfilled);
  game = finish(game);
  game = advance(game, state => state.phase === 5 && state.active === f.target && clean(state));
  game = act(game, f.target, { type: 'endMovement' });
  assert.ok(game.shipmentPromises!.every(promise => promise.fulfilled));
  assert.deepEqual(inventory(game), f.originalCards);
});
