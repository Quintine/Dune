import assert from 'node:assert/strict';
import test from 'node:test';
import { viewGame, type Action, type Game } from '../game/engine';
import {
  actTruthMixedRevival as act, answerTruthMixedRevival as answer, askTruthMixedRevival as ask,
  completeTruthMixedRevival as complete, createTruthMixedRevivalFixture as fixture,
  declareTruthMixedRevival as declare, finishTruthMixedRevival as finish,
  settleTruthMixedRevival as settle, truthMixedRevivalFact as fact,
  truthMixedRevivalForce as force, truthMixedRevivalGroup as group,
  truthMixedRevivalInventory as inventory, truthMixedRevivalLeader as leader,
  truthMixedRevivalPlayer as player, truthMixedRevivalPromise as promise,
} from './fixture-truth-mixed-revival';

function rejected(game: Game, actor: string, action: Action) {
  const before = structuredClone(game); assert.throws(() => act(game, actor, action)); assert.deepEqual(game, before);
}
function truthsOnce(game: Game, truths: string[]) {
  for (const truth of truths) assert.equal(game.discard.filter(card => card.id === truth).length, 1);
}

void test('two original Truths retain scalar force No while mixed OR Yes follows the real alternate leader', () => {
  const f = fixture(); let game = declare(f, f.game, { copies: 2 }).game;
  game = act(game, f.asker, { type: 'truthAsk', question: {
    kind: 'revival', target: f.target, turn: game.turn, counter: 'total', minimum: 1,
  } });
  game = answer(game, f.target, 'no');
  game = ask(game, f.asker, f.target, group('and', fact(f.spiceFact), group('or', force(), leader(f.leader))));
  assert.deepEqual(viewGame(game, f.target).truthMixedRevivalAnswers, ['yes', 'no']);
  game = answer(game, f.target, 'yes');
  const guide = viewGame(game, f.target).revivalExpressionPromiseGuide; assert.ok(guide);
  assert.equal(guide.action.type, 'reviveLeader'); game = settle(act(game, f.target, guide.action));
  assert.equal(promise(game).fulfilled, true); assert.equal(game.revivalPromises![0].progress, 0);
  assert.equal(player(game, f.target).tanks, 1); assert.equal(player(game, f.target).spice, 2);
  game = finish(game); assert.equal(game.revivalPromises![0].fulfilled, true);
  truthsOnce(game, f.truths); assert.deepEqual(inventory(game), f.originalCards);
});

void test('two original Truths retain scalar leader No while mixed OR Yes returns only the real free force', () => {
  const f = fixture(); let game = declare(f, f.game, { copies: 2 }).game;
  game = act(game, f.asker, { type: 'truthAsk', question: {
    kind: 'leaderRevival', target: f.target, turn: game.turn, leader: f.leader,
  } });
  game = answer(game, f.target, 'no');
  game = answer(ask(game, f.asker, f.target,
    group('and', fact(f.spiceFact), group('or', force(), leader(f.leader)))), f.target, 'yes');
  const guide = viewGame(game, f.target).revivalExpressionPromiseGuide; assert.ok(guide);
  assert.equal(guide.action.type, 'revive'); game = settle(act(game, f.target, guide.action));
  assert.equal(promise(game).fulfilled, true); assert.deepEqual(promise(game).progress.leaders, []);
  assert.equal(player(game, f.target).spice, 5); rejected(game, f.target, f.revivalAction);
  game = finish(game); assert.equal(game.leaderRevivalPromises![0].fulfilled, true);
  assert.equal(player(game, f.target).leaders.find(disc => disc.id === f.leader)!.dead, true);
  truthsOnce(game, f.truths); assert.deepEqual(inventory(game), f.originalCards);
});

void test('two original Truths share one native leader invoice between an earlier named Yes and mixed AND Yes', () => {
  const f = fixture(); let game = declare(f, f.game, { copies: 2 }).game;
  game = act(game, f.asker, { type: 'truthAsk', question: {
    kind: 'leaderRevival', target: f.target, turn: game.turn, leader: f.leader,
  } });
  game = answer(game, f.target, 'yes'); game = answer(ask(game, f.asker, f.target, f.mixed), f.target, 'yes');
  game = complete(game, f.target);
  assert.equal(game.leaderRevivalPromises![0].fulfilled, true); assert.equal(promise(game).fulfilled, true);
  assert.equal(player(game, f.target).spice, 3); assert.equal(player(game, f.target).leaderRevived, true);
  assert.equal(player(game, f.target).freeForcesRevived, 1);
  assert.equal(player(game, f.target).leaders.find(disc => disc.id === f.leader)!.deaths, 1);
  truthsOnce(game, f.truths); assert.deepEqual(inventory(game), f.originalCards);
});

void test('two original Truths preserve an earlier mixed AND Yes against a contradictory later scalar force No', () => {
  const f = fixture(); let game = declare(f, f.game, { copies: 2 }).game;
  game = answer(ask(game, f.asker, f.target, f.mixed), f.target, 'yes');
  game = act(game, f.asker, { type: 'truthAsk', question: {
    kind: 'revival', target: f.target, turn: game.turn, counter: 'total', minimum: 1,
  } });
  assert.deepEqual(viewGame(game, f.target).truthRevivalAnswers, ['yes']);
  rejected(game, f.target, { type: 'truthAnswer', answer: 'no' });
  game = answer(game, f.target, 'yes'); game = complete(game, f.target);
  assert.equal(game.revivalPromises![0].fulfilled, true); assert.equal(game.revivalPromises![0].progress, 1);
  assert.equal(promise(game).fulfilled, true); assert.equal(player(game, f.target).spice, 3);
  truthsOnce(game, f.truths); assert.deepEqual(inventory(game), f.originalCards);
});

void test('earlier original Bribe Yes reserves T4 before a later mixed ordinary AND answer', () => {
  const f = fixture(); let game = declare(f, f.game, { copies: 2 }).game;
  game = act(game, f.asker, { type: 'truthAsk', question: {
    kind: 'bribe', target: f.target, turn: game.turn, recipient: f.opponent, minimum: 4,
  } });
  game = answer(game, f.target, 'yes'); game = ask(game, f.asker, f.target, f.mixed);
  assert.deepEqual(viewGame(game, f.target).truthMixedRevivalAnswers, ['no']);
  rejected(game, f.target, { type: 'truthAnswer', answer: 'yes' }); game = answer(game, f.target, 'no');
  const guide = viewGame(game, f.target).bribePromiseGuide; assert.ok(guide);
  game = act(game, f.target, guide.action); assert.equal(player(game, f.target).spice, 0);
  assert.equal(player(game, f.opponent).bribes, 4); game = finish(game);
  assert.equal(promise(game).fulfilled, true); assert.equal(game.bribePromises![0].fulfilled, true);
  truthsOnce(game, f.truths); assert.deepEqual(inventory(game), f.originalCards);
});

void test('earlier mixed T4 fact and AND Yes retain their budget through a real bribe3 free-force bank1 and leader2', () => {
  const f = fixture(); let game = declare(f, f.game, { copies: 2 }).game;
  game = answer(ask(game, f.asker, f.target, f.mixed), f.target, 'yes');
  game = act(game, f.asker, { type: 'truthAsk', question: {
    kind: 'bribe', target: f.target, turn: game.turn, recipient: f.opponent, minimum: 4,
  } });
  assert.deepEqual(viewGame(game, f.target).truthBribeAnswers, ['no']); game = answer(game, f.target, 'no');
  rejected(game, f.target, { type: 'bribe', target: f.opponent, amount: 4 });
  game = act(game, f.target, { type: 'bribe', target: f.opponent, amount: 3 });
  assert.equal(player(game, f.target).spice, 1);
  let guide = viewGame(game, f.target).revivalExpressionPromiseGuide; assert.ok(guide); assert.equal(guide.action.type, 'revive');
  game = settle(act(game, f.target, guide.action)); assert.equal(player(game, f.target).spice, 2);
  assert.equal(promise(game).progress.normal, 1); assert.equal(promise(game).fulfilled, false);
  guide = viewGame(game, f.target).revivalExpressionPromiseGuide; assert.ok(guide); assert.equal(guide.action.type, 'reviveLeader');
  game = settle(act(game, f.target, guide.action)); assert.equal(player(game, f.target).spice, 0);
  assert.equal(promise(game).fulfilled, true); assert.equal(player(game, f.opponent).bribes, 3);
  game = finish(game); assert.ok(!game.bribePromises![0].fulfilled, 'The actual turn-wide bribe No outlasts Revival');
  truthsOnce(game, f.truths); assert.deepEqual(inventory(game), f.originalCards);
});

void test('earlier original shipment funding excludes a later mixed AND beyond the original shared purse', () => {
  const f = fixture(); let game = declare(f, f.game, { copies: 2 }).game;
  game = act(game, f.asker, { type: 'truthAsk', question: {
    kind: 'shipment', target: f.target, claim: { territory: 'arrakeen', minimum: 4 },
  } });
  game = answer(game, f.target, 'yes'); game = ask(game, f.asker, f.target, f.mixed);
  assert.deepEqual(viewGame(game, f.target).truthMixedRevivalAnswers, ['no']);
  rejected(game, f.target, { type: 'truthAnswer', answer: 'yes' }); game = answer(game, f.target, 'no');
  assert.equal(game.shipmentPromises![0].answer, true); assert.ok(!game.shipmentPromises![0].released);
  truthsOnce(game, f.truths); assert.deepEqual(inventory(game), f.originalCards);
});

void test('earlier mixed AND reserves one real return invoice before a later original shipment answer', () => {
  const f = fixture(); let game = declare(f, f.game, { copies: 2 }).game;
  game = answer(ask(game, f.asker, f.target, f.mixed), f.target, 'yes');
  game = act(game, f.asker, { type: 'truthAsk', question: {
    kind: 'shipment', target: f.target, claim: { territory: 'arrakeen', minimum: 4 },
  } });
  assert.deepEqual(viewGame(game, f.target).truthShipmentAnswers, ['no']); game = answer(game, f.target, 'no');
  game = complete(game, f.target); assert.equal(promise(game).fulfilled, true);
  assert.equal(player(game, f.target).spice, 3); assert.ok(!game.shipmentPromises![0].fulfilled);
  truthsOnce(game, f.truths); assert.deepEqual(inventory(game), f.originalCards);
});
