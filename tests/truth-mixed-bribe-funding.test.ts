import assert from 'node:assert/strict';
import test from 'node:test';
import { viewGame } from '../game/engine';
import { truthFactAnswer, type TruthFact } from '../game/truthtrance';
import {
  actTruthLeaderRevival as act, createTruthLeaderRevivalFixture as fixture,
  declareTruthLeaderRevival as declare, finishTruthLeaderRevival as finish,
  settleTruthLeaderRevival as settle, truthLeaderRevivalInventory as inventory,
  truthLeaderRevivalPlayer as player,
} from './fixture-truth-leader-revival';
import {
  answerTruthMixedBribe as answer, askTruthMixedBribe as ask, truthMixedBribeFact as fact,
  truthMixedBribeGroup as group, truthMixedBribePayment as payment, truthMixedBribePromise as promise,
} from './fixture-truth-mixed-bribe';

for (const first of ['bribe', 'revival'] as const) void test(`native mixed current spice and payments retain actual native leader funding with ${first} accepted first`, () => {
  // This original H/A/T Ix47 source really pays for a shipment, loses Hidar
  // to the original projectile, and reaches next-turn native Revival with4.
  // No purse, death, hand, clock or commitment is installed by this supplement.
  const f = fixture(); assert.equal(f.originalCards.length, 47); assert.deepEqual(f.staging, []);
  assert.equal(f.sourceActionCount, f.sourceActions.length); assert.equal(f.game.phase, 4); assert.equal(f.game.turn, 2);
  assert.equal(player(f.game, f.target).spice, 4); assert.equal(player(f.game, f.target).leaders.find(disc => disc.id === f.leader)!.dead, true);
  const spiceFact: TruthFact = { kind: 'spice', compare: 'gte', value: 4 };
  const mixed = group('and', fact(spiceFact), payment(f.asker, 1), payment(f.opponent, 1));
  assert.equal(truthFactAnswer(player(f.game, f.target), spiceFact), 'yes');
  let game = declare(f, f.game, { copies: 2 }).game;
  const bribe = () => { game = answer(ask(game, f.asker, f.target, mixed), f.target, 'yes'); };
  const revival = () => {
    game = act(game, f.asker, { type: 'truthAsk', question: f.question });
    assert.deepEqual(viewGame(game, f.target).truthLeaderRevivalAnswers, ['yes', 'no']);
    game = answer(game, f.target, 'yes');
  };
  if (first === 'bribe') { bribe(); revival(); } else { revival(); bribe(); }
  const before = structuredClone(game);
  // Actual free force revival can prepare one spice, still insufficient for
  // H3 together with the owed A1 payment and this named leader's native2.
  assert.throws(() => act(game, f.target, { type: 'bribe', target: f.asker, amount: 3 })); assert.deepEqual(game, before);
  game = act(game, f.target, { type: 'bribe', target: f.asker, amount: 1 });
  assert.equal(player(game, f.target).spice, 3); assert.equal(truthFactAnswer(player(game, f.target), spiceFact), 'no');
  assert.deepEqual(promise(game, f.target).progress, [{ recipient: f.asker, amount: 1 }]);
  assert.ok(!promise(game, f.target).fulfilled); assert.ok(!game.leaderRevivalPromises![0].fulfilled);
  game = act(game, f.target, { type: 'bribe', target: f.opponent, amount: 1 });
  assert.equal(player(game, f.target).spice, 2); assert.equal(promise(game, f.target).fulfilled, true);
  const guide = viewGame(game, f.target).leaderRevivalPromiseGuide; assert.ok(guide);
  assert.equal(guide.action.type, 'reviveLeader'); assert.equal(guide.action.leader, f.leader);
  game = settle(act(game, f.target, guide.action)); assert.equal(player(game, f.target).spice, 0);
  assert.equal(game.leaderRevivalPromises![0].fulfilled, true); assert.equal(promise(game, f.target).fulfilled, true);
  assert.equal(player(game, f.target).leaders.find(disc => disc.id === f.leader)!.dead, false);
  assert.equal(player(game, f.asker).bribes, 1); assert.equal(player(game, f.opponent).bribes, 1);
  for (const truth of f.truths) assert.equal(game.discard.filter(card => card.id === truth).length, 1);
  assert.deepEqual(inventory(finish(game)), f.originalCards);
});
