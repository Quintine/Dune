import assert from 'node:assert/strict';
import test from 'node:test';
import { viewGame } from '../game/engine';
import { truthFactAnswer } from '../game/truthtrance';
import {
  actTruthAllianceExpression as act, answerTruthAllianceExpression as answer,
  askTruthAllianceExpression as ask, askTruthMixedAlliance as askMixed,
  closeTruthAllianceExpressionNexus as close, createTruthAllianceExpressionFixture as fixture,
  createTruthMixedAllianceFixture as mixedFixture, declareTruthAllianceExpression as declare,
  declareTruthMixedAlliance as declareMixed, truthAllianceExpressionInventory as inventory,
  truthAllianceExpressionPlayer as player, truthAllianceExpressionPromise as promise,
  truthMixedAlliancePromise as mixedPromise,
} from './fixture-truth-alliance-expression';

void test('two original Truths preserve prior scalar alliance No while a later whole OR Yes takes the other real partner', () => {
  const f = fixture({ secondOffer: true }); let game = declare(f, f.game, { copies: 2 }).game;
  game = act(game, f.asker, { type: 'truthAsk', question: {
    kind: 'alliance', target: f.target, turn: game.turn, partner: f.partner,
  } });
  game = answer(game, f.target, 'no'); game = ask(game, f.asker, f.target, f.claim);
  assert.deepEqual(viewGame(game, f.target).truthAllianceExpressionAnswers, ['yes', 'no']);
  game = answer(game, f.target, 'yes');
  assert.equal(viewGame(game, f.target).alliancePromises.length, 1);
  assert.equal(viewGame(game, f.target).allianceExpressionPromises.length, 1);
  assert.notEqual(viewGame(game, f.target).alliancePromises[0].event, promise(game).event);
  const guide = viewGame(game, f.target).alliancePromiseGuide; assert.ok(guide);
  assert.equal(guide.action.type, 'alliance'); assert.equal(guide.action.target, f.asker);
  game = act(game, f.target, guide.action); assert.equal(player(game, f.target).ally, f.asker);
  assert.ok(!game.alliancePromises![0].fulfilled && !promise(game).fulfilled);
  game = close(game); assert.equal(game.alliancePromises![0].fulfilled, true); assert.equal(promise(game).fulfilled, true);
  for (const truth of f.truths) assert.equal(game.discard.filter(card => card.id === truth).length, 1);
  assert.deepEqual(inventory(game), f.originalCards);
});

void test('two original Truths share one real final partner between earlier scalar Yes and later mixed OR Yes at actual close', () => {
  const f = mixedFixture({ secondOffer: true }); let game = declareMixed(f, f.game, { copies: 2 }).game;
  game = act(game, f.asker, { type: 'truthAsk', question: {
    kind: 'alliance', target: f.target, turn: game.turn, partner: f.partner,
  } });
  game = answer(game, f.target, 'yes'); game = askMixed(game, f.asker, f.target, f.mixed);
  assert.deepEqual(viewGame(game, f.target).truthMixedAllianceAnswers, ['yes']); game = answer(game, f.target, 'yes');
  assert.equal(viewGame(game, f.target).alliancePromises.length, 1);
  assert.deepEqual(viewGame(game, f.target).allianceExpressionPromises, []);
  assert.notEqual(viewGame(game, f.target).alliancePromises[0].event, mixedPromise(game).event);
  const guide = viewGame(game, f.target).alliancePromiseGuide; assert.ok(guide);
  assert.equal(guide.action.type, 'alliance'); assert.equal(guide.action.target, f.partner);
  game = act(game, f.target, guide.action); assert.equal(player(game, f.target).ally, f.partner);
  assert.ok(!game.alliancePromises![0].fulfilled); assert.equal(mixedPromise(game).fulfilled, false);
  game = close(game); assert.equal(game.alliancePromises![0].fulfilled, true); assert.equal(mixedPromise(game).fulfilled, true);
  for (const truth of f.truths) assert.equal(game.discard.filter(card => card.id === truth).length, 1);
  assert.deepEqual(inventory(game), f.originalCards);
});

void test('two original Truths pay the earlier native bribe before a later mixed OR accepts its manual alternative without thawing the spice fact', () => {
  const f = mixedFixture({ secondOffer: true }); let game = declareMixed(f, f.game, { copies: 2 }).game;
  game = act(game, f.asker, { type: 'truthAsk', question: {
    kind: 'bribe', target: f.target, turn: game.turn, recipient: f.partner, minimum: 3,
  } });
  assert.ok(viewGame(game, f.target).truthBribeAnswers?.includes('yes')); game = answer(game, f.target, 'yes');
  game = askMixed(game, f.asker, f.target, f.mixed);
  assert.ok(viewGame(game, f.target).truthMixedAllianceAnswers?.includes('yes')); game = answer(game, f.target, 'yes');
  assert.equal(player(game, f.target).spice, 10); assert.equal(mixedPromise(game).fulfilled, false);
  const payment = viewGame(game, f.target).bribePromiseGuide; assert.ok(payment);
  const recipientSpice = player(game, f.partner).spice;
  game = act(game, f.target, payment.action); assert.equal(player(game, f.target).spice, 7);
  assert.equal(player(game, f.partner).spice, recipientSpice); assert.equal(player(game, f.partner).bribes, 3);
  assert.equal(game.bribePromises![0].fulfilled, true);
  assert.equal(truthFactAnswer(player(game, f.target), f.spiceFact), 'no'); assert.equal(mixedPromise(game).fulfilled, false);
  const guide = viewGame(game, f.target).alliancePromiseGuide; assert.ok(guide); assert.equal(guide.action.type, 'alliance');
  const alternative = guide.action.target === f.asker ? f.partner : f.asker;
  game = act(game, f.target, { type: 'alliance', target: alternative }); assert.equal(player(game, f.target).ally, alternative);
  assert.equal(mixedPromise(game).fulfilled, false); game = close(game); assert.equal(mixedPromise(game).fulfilled, true);
  assert.equal(game.bribePromises![0].fulfilled, true); assert.equal(player(game, f.partner).bribes, 3);
  for (const truth of f.truths) assert.equal(game.discard.filter(card => card.id === truth).length, 1);
  assert.deepEqual(inventory(game), f.originalCards);
});

void test('two original Truths preserve an earlier whole Yes against a later contradictory scalar alliance No', () => {
  const f = fixture({ secondOffer: true }); let game = declare(f, f.game, { copies: 2 }).game;
  game = ask(game, f.asker, f.target, { kind: 'partner', partner: f.partner });
  game = answer(game, f.target, 'yes');
  game = act(game, f.asker, { type: 'truthAsk', question: {
    kind: 'alliance', target: f.target, turn: game.turn, partner: f.partner,
  } });
  assert.deepEqual(viewGame(game, f.target).truthAllianceAnswers, ['yes']);
  const before = structuredClone(game);
  assert.throws(() => answer(game, f.target, 'no')); assert.deepEqual(game, before);
  game = answer(game, f.target, 'yes');
  const guide = viewGame(game, f.target).alliancePromiseGuide; assert.ok(guide);
  assert.equal(guide.action.target, f.partner); game = act(game, f.target, guide.action);
  assert.ok(!promise(game).fulfilled && !game.alliancePromises![0].fulfilled);
  game = close(game); assert.equal(promise(game).fulfilled, true); assert.equal(game.alliancePromises![0].fulfilled, true);
  for (const truth of f.truths) assert.equal(game.discard.filter(card => card.id === truth).length, 1);
  assert.deepEqual(inventory(game), f.originalCards);
});
