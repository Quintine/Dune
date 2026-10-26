import assert from 'node:assert/strict';
import test from 'node:test';
import { viewGame } from '../game/engine';
import type { BribeExpression } from '../game/bribe-expression-promises';
import {
  actTruthLeaderRevival as act, createTruthLeaderRevivalFixture as fixture,
  declareTruthLeaderRevival as declare, finishTruthLeaderRevival as finish,
  settleTruthLeaderRevival as settle, truthLeaderRevivalInventory as inventory,
  truthLeaderRevivalPlayer as player,
} from './fixture-truth-leader-revival';
import { askTruthBribeExpression as ask, answerTruthBribeExpression as answer } from './fixture-truth-bribe-expression';

for (const first of ['bribe', 'revival'] as const) void test(`native grouped payment progress retains shared ordinary leader funding with ${first} accepted first`, () => {
  // Inherit the original H/A/T Ix47 shipment/projectile-death/next-Storm
  // source. T owns four real spice and a dead native Hidar; no purse, disc,
  // question or promise is installed by this funding supplement.
  const f = fixture(); assert.equal(f.originalCards.length, 47); assert.deepEqual(f.staging, []);
  assert.equal(f.sourceActionCount, f.sourceActions.length); assert.equal(player(f.game, f.target).spice, 4);
  const claim: BribeExpression = { kind: 'and', terms: [
    { kind: 'payment', recipient: f.asker, minimum: 1 },
    { kind: 'payment', recipient: f.opponent, minimum: 1 },
  ] };
  let game = declare(f, f.game, { copies: 2 }).game;
  const bribe = () => { game = answer(ask(game, f.asker, f.target, claim), f.target, 'yes'); };
  const revival = () => {
    game = act(game, f.asker, { type: 'truthAsk', question: f.question });
    assert.deepEqual(viewGame(game, f.target).truthLeaderRevivalAnswers, ['yes', 'no']);
    game = answer(game, f.target, 'yes');
  };
  if (first === 'bribe') { bribe(); revival(); } else { revival(); bribe(); }
  const before = structuredClone(game);
  // T's actual free force return can prepare one owned spice; even that
  // native income cannot rescue H3 while A1 and the leader's2 remain due.
  assert.throws(() => act(game, f.target, { type: 'bribe', target: f.asker, amount: 3 })); assert.deepEqual(game, before);
  game = act(game, f.target, { type: 'bribe', target: f.asker, amount: 1 });
  assert.equal(player(game, f.target).spice, 3);
  assert.deepEqual(game.bribeExpressionPromises![0].progress, [{ recipient: f.asker, amount: 1 }]);
  assert.ok(!game.bribeExpressionPromises![0].fulfilled); assert.ok(!game.leaderRevivalPromises![0].fulfilled);
  game = act(game, f.target, { type: 'bribe', target: f.opponent, amount: 1 });
  assert.equal(player(game, f.target).spice, 2); assert.equal(game.bribeExpressionPromises![0].fulfilled, true);
  const guide = viewGame(game, f.target).leaderRevivalPromiseGuide; assert.ok(guide);
  assert.equal(guide.action.type, 'reviveLeader'); assert.equal(guide.action.leader, f.leader);
  game = settle(act(game, f.target, guide.action));
  assert.equal(player(game, f.target).spice, 0); assert.equal(game.leaderRevivalPromises![0].fulfilled, true);
  assert.equal(player(game, f.target).leaders.find(disc => disc.id === f.leader)!.dead, false);
  assert.equal(player(game, f.asker).bribes, 1); assert.equal(player(game, f.opponent).bribes, 1);
  for (const card of f.truths) assert.equal(game.discard.filter(held => held.id === card).length, 1);
  assert.deepEqual(inventory(finish(game)), f.originalCards);
});
