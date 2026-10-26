import assert from 'node:assert/strict';
import test from 'node:test';
import { viewGame } from '../game/engine';
import {
  createTruthRevivalExpressionFixture as fixture, declareTruthRevivalExpression as declare,
  askTruthRevivalExpression as ask, answerTruthRevivalExpression as answer,
  bindTruthRevivalExpression as bind, actTruthRevivalExpression as act,
  settleTruthRevivalExpression as settle, finishTruthRevivalExpression as finish,
  truthRevivalExpressionPlayer as player, truthRevivalExpressionInventory as inventory,
} from './fixture-truth-revival-expression';

void test('grouped Yes retains whole progress through actual bribe and owned income preparation', () => {
  const f = fixture(); let game = declare(f, f.game, { copies: 2 }).game;
  game = answer(ask(game, f.asker, f.target, f.claim), f.target, 'yes');
  game = act(game, f.asker, { type: 'truthAsk', question: {
    kind: 'bribe', target: f.target, turn: game.turn, recipient: f.opponent, minimum: 4,
  } });
  assert.deepEqual(viewGame(game, f.target).truthBribeAnswers, ['no']);
  game = answer(game, f.target, 'no');
  const before = structuredClone(game);
  assert.throws(() => act(game, f.target, { type: 'bribe', target: f.opponent, amount: 4 }));
  assert.deepEqual(game, before);
  game = act(game, f.target, { type: 'bribe', target: f.opponent, amount: 3 });
  let guide = viewGame(game, f.target).revivalExpressionPromiseGuide; assert.ok(guide);
  assert.equal(guide.action.type, 'revive');
  game = settle(act(game, f.target, guide.action));
  assert.equal(player(game, f.target).spice, 2);
  assert.equal(game.revivalExpressionPromises![0].progress.total, 1);
  assert.ok(!game.revivalExpressionPromises![0].fulfilled);
  guide = viewGame(game, f.target).revivalExpressionPromiseGuide; assert.ok(guide);
  assert.equal(guide.action.type, 'reviveLeader');
  game = settle(act(game, f.target, guide.action));
  assert.equal(player(game, f.target).spice, 0);
  assert.equal(game.revivalExpressionPromises![0].fulfilled, true);
  assert.equal(player(game, f.opponent).bribes, 3);
  game = finish(game); assert.ok(!game.bribePromises![0].fulfilled);
  assert.deepEqual(inventory(game), f.originalCards);
});

void test('prior funded Bribe Yes excludes an impossible later grouped AND Yes', () => {
  const f = fixture(); let game = declare(f, f.game, { copies: 2 }).game;
  game = act(game, f.asker, { type: 'truthAsk', question: {
    kind: 'bribe', target: f.target, turn: game.turn, recipient: f.opponent, minimum: 4,
  } });
  game = answer(game, f.target, 'yes'); game = ask(game, f.asker, f.target, f.claim);
  assert.deepEqual(viewGame(game, f.target).truthRevivalExpressionAnswers, ['no']);
  const before = structuredClone(game);
  assert.throws(() => answer(game, f.target, 'yes')); assert.deepEqual(game, before);
  game = answer(game, f.target, 'no');
  const guide = viewGame(game, f.target).bribePromiseGuide; assert.ok(guide);
  game = act(game, f.target, guide.action); assert.equal(player(game, f.target).spice, 0);
  game = finish(game); assert.equal(game.revivalExpressionPromises![0].fulfilled, true);
  assert.equal(game.bribePromises![0].fulfilled, true);
  assert.deepEqual(inventory(game), f.originalCards);
});

void test('partial ordinary forces preserve a grouped OR until the alternate real leader return', () => {
  const f = fixture(), claim = { kind: 'or' as const, terms: [
    { kind: 'forces' as const, counter: 'normal' as const, minimum: 2 }, { kind: 'leader' as const, leader: f.leader },
  ] };
  let game = bind(f, 'yes', claim).game;
  game = settle(act(game, f.target, { type: 'revive', amount: 1, elite: 0 }));
  assert.equal(game.revivalExpressionPromises![0].progress.normal, 1);
  assert.ok(!game.revivalExpressionPromises![0].fulfilled);
  const guide = viewGame(game, f.target).revivalExpressionPromiseGuide; assert.ok(guide);
  assert.equal(guide.action.type, 'reviveLeader');
  game = settle(act(game, f.target, guide.action));
  assert.equal(game.revivalExpressionPromises![0].fulfilled, true);
  assert.deepEqual(game.revivalExpressionPromises![0].progress.leaders, [f.leader]);
  assert.deepEqual(inventory(finish(game)), f.originalCards);
});

void test('earlier native shipment funding excludes a later grouped AND beyond the shared purse', () => {
  const f = fixture(); let game = declare(f, f.game, { copies: 2 }).game;
  game = act(game, f.asker, { type: 'truthAsk', question: {
    kind: 'shipment', target: f.target, claim: { territory: 'arrakeen', minimum: 4 },
  } });
  game = answer(game, f.target, 'yes'); game = ask(game, f.asker, f.target, f.claim);
  assert.deepEqual(viewGame(game, f.target).truthRevivalExpressionAnswers, ['no']);
  const before = structuredClone(game);
  assert.throws(() => answer(game, f.target, 'yes')); assert.deepEqual(game, before);
  game = answer(game, f.target, 'no');
  assert.equal(game.shipmentPromises![0].answer, true);
  assert.ok(!game.shipmentPromises![0].released);
  assert.deepEqual(inventory(game), f.originalCards);
});

void test('earlier grouped AND reserves its real native return budget before a later shipment answer', () => {
  const f = fixture(); let game = declare(f, f.game, { copies: 2 }).game;
  game = answer(ask(game, f.asker, f.target, f.claim), f.target, 'yes');
  game = act(game, f.asker, { type: 'truthAsk', question: {
    kind: 'shipment', target: f.target, claim: { territory: 'arrakeen', minimum: 4 },
  } });
  assert.deepEqual(viewGame(game, f.target).truthShipmentAnswers, ['no']);
  game = answer(game, f.target, 'no');
  for (let count = 0; count < 3 && !game.revivalExpressionPromises![0].fulfilled; count++) {
    const guide = viewGame(game, f.target).revivalExpressionPromiseGuide; assert.ok(guide);
    game = settle(act(game, f.target, guide.action));
  }
  assert.equal(game.revivalExpressionPromises![0].fulfilled, true);
  assert.equal(player(game, f.target).spice, 3);
  assert.ok(!game.shipmentPromises![0].fulfilled);
  assert.deepEqual(inventory(game), f.originalCards);
});
