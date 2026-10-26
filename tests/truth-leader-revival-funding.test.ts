import assert from 'node:assert/strict';
import test from 'node:test';
import { viewGame } from '../game/engine';
import {
  createTruthLeaderRevivalFixture as fixture, declareTruthLeaderRevival as declare,
  askTruthLeaderRevival as ask, answerTruthLeaderRevival as answer,
  actTruthLeaderRevival as act, settleTruthLeaderRevival as settle,
  finishTruthLeaderRevival as finish, truthLeaderRevivalPlayer as player,
  truthLeaderRevivalInventory as inventory,
} from './fixture-truth-leader-revival';

void test('an earlier funded Bribe Yes retains its purse before a named leader answer', () => {
  const f = fixture(); let game = declare(f, f.game, { copies: 2 }).game;
  game = act(game, f.asker, { type: 'truthAsk', question: {
    kind: 'bribe', target: f.target, turn: game.turn, recipient: f.opponent, minimum: 4,
  } });
  game = answer(game, f.target, 'yes');
  game = ask(game, f.asker, f.target, f.leader);
  assert.deepEqual(viewGame(game, f.target).truthLeaderRevivalAnswers, ['no']);
  const before = structuredClone(game);
  assert.throws(() => answer(game, f.target, 'yes')); assert.deepEqual(game, before);
  game = answer(game, f.target, 'no');
  const payment = viewGame(game, f.target).bribePromiseGuide; assert.ok(payment);
  game = act(game, f.target, payment.action);
  assert.equal(player(game, f.target).spice, 0); assert.equal(player(game, f.opponent).bribes, 4);
  game = finish(game);
  assert.equal(game.bribePromises![0].fulfilled, true);
  assert.equal(game.leaderRevivalPromises![0].fulfilled, true);
  assert.equal(player(game, f.target).leaders.find(leader => leader.id === f.leader)!.dead, true);
  assert.deepEqual(inventory(game), f.originalCards);
});

void test('earlier named Yes limits a later bribe and preserves the actual self-income preparation', () => {
  const f = fixture(); let game = declare(f, f.game, { copies: 2 }).game;
  game = answer(ask(game, f.asker, f.target, f.leader), f.target, 'yes');
  game = act(game, f.asker, { type: 'truthAsk', question: {
    kind: 'bribe', target: f.target, turn: game.turn, recipient: f.opponent, minimum: 4,
  } });
  assert.deepEqual(viewGame(game, f.target).truthBribeAnswers, ['no']);
  game = answer(game, f.target, 'no');
  const before = structuredClone(game);
  assert.throws(() => act(game, f.target, { type: 'bribe', target: f.opponent, amount: 4 }));
  assert.deepEqual(game, before);
  game = act(game, f.target, { type: 'bribe', target: f.opponent, amount: 3 });
  assert.equal(player(game, f.target).spice, 1);
  let guide = viewGame(game, f.target).leaderRevivalPromiseGuide; assert.ok(guide);
  assert.equal(guide.action.type, 'revive');
  game = settle(act(game, f.target, guide.action));
  assert.equal(player(game, f.target).spice, 2);
  assert.ok(!game.leaderRevivalPromises![0].fulfilled);
  guide = viewGame(game, f.target).leaderRevivalPromiseGuide; assert.ok(guide);
  assert.equal(guide.action.type, 'reviveLeader');
  game = settle(act(game, f.target, guide.action));
  assert.equal(player(game, f.target).spice, 0);
  assert.equal(game.leaderRevivalPromises![0].fulfilled, true);
  assert.equal(player(game, f.opponent).bribes, 3);
  game = finish(game);
  assert.ok(!game.bribePromises![0].fulfilled, 'The turn-wide bribe No outlasts Revival');
  assert.equal(game.bribePromises![0].progress, 3);
  assert.deepEqual(inventory(game), f.originalCards);
});
