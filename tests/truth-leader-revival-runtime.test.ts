import assert from 'node:assert/strict';
import test from 'node:test';
import { viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import {
  actTruthLeaderRevival as act, advanceTruthLeaderRevival as advance, answerTruthLeaderRevival as answer,
  askTruthLeaderRevival as ask, bindTruthLeaderRevival as bind, createTruthLeaderRevivalFixture as fixture,
  declareTruthLeaderRevival as declare, finishTruthLeaderRevival as finish, settleTruthLeaderRevival as settle,
  truthLeaderRevivalClean as clean, truthLeaderRevivalInventory as inventory, truthLeaderRevivalPlayer as player,
} from './fixture-truth-leader-revival';

function rejected(game: Game, actor: string, action: Action) {
  const before = structuredClone(game); assert.throws(() => act(game, actor, action)); assert.deepEqual(game, before);
}
const promise = (game: Game, target: string) => game.leaderRevivalPromises!.find(promise => promise.player === target)!;

for (const advanced of [false, true]) void test(`native ${advanced ? 'Advanced' : 'Basic'} named Tleilaxu Revival Yes follows real projectile death and original early return`, () => {
  const f = fixture({ advanced }); assert.equal(f.initial.status, 'lobby'); assert.equal(f.setup.status, 'setup');
  assert.deepEqual(f.game.expansions, ['ix']); assert.equal(f.originalCards.length, 47); assert.deepEqual(f.staging, []);
  assert.equal(f.sourceActionCount, f.sourceActions.length); assert.equal(f.sourceCount, f.sourceActions.length);
  assert.deepEqual(f.beforeStartingDeal.deck.slice(0, 4).map(card => card.id), f.deal);
  assert.equal(player(f.shipment.before, f.target).spice - player(f.shipment.after, f.target).spice, 1);
  assert.equal(player(f.afterBattle, f.target).leaders.find(leader => leader.id === f.leader)!.dead, true);
  assert.equal(player(f.game, f.target).leaders.filter(leader => !leader.dead).length, 4);
  assert.equal(player(f.game, f.target).revivalCycle, 0); assert.equal(f.quote.early, true); assert.equal(f.quote.cost, 2);
  assert.equal(player(f.game, f.target).tanks, 1); assert.equal(player(f.game, f.target).spice, 4);
  const before = structuredClone(f.game), bound = bind(f); assert.deepEqual(f.game, before);
  assert.ok(!promise(bound.game, f.target).fulfilled); rejected(bound.game, f.target, { type: 'ready' });
  const guide = viewGame(bound.game, f.target).leaderRevivalPromiseGuide; assert.ok(guide); assert.equal(guide.phase, 4);
  assert.equal(guide.action.type, 'reviveLeader'); assert.equal(guide.action.leader, f.leader);
  let game = act(bound.game, f.target, guide.action);
  if (game.pendingRevival) {
    assert.ok(!promise(game, f.target).fulfilled);
    assert.equal(player(game, f.target).leaders.find(leader => leader.id === f.leader)!.dead, true);
  }
  game = settle(game);
  assert.equal(player(game, f.target).leaders.find(leader => leader.id === f.leader)!.dead, false);
  assert.equal(player(game, f.target).leaders.find(leader => leader.id === f.leader)!.deaths, 1);
  assert.equal(player(game, f.target).spice, 2); assert.equal(player(game, f.target).leaderRevived, true);
  assert.equal(player(game, f.target).tanks, 1); assert.equal(player(game, f.target).revived, 0);
  assert.equal(promise(game, f.target).fulfilled, true);
  assert.equal(game.discard.filter(card => card.id === f.truth).length, 1);
  assert.deepEqual(inventory(finish(game)), f.originalCards);
});

void test('native named No rejects the exact ordinary leader return while an independent free force return stays legal', () => {
  const f = fixture(); let game = bind(f, 'no').game;
  rejected(game, f.target, f.revivalAction);
  game = settle(act(game, f.target, { type: 'revive', amount: 1, elite: 0 }));
  assert.ok(!promise(game, f.target).fulfilled); assert.equal(player(game, f.target).revived, 1);
  assert.equal(player(game, f.target).leaders.find(leader => leader.id === f.leader)!.dead, true);
  assert.equal(player(game, f.target).spice, 5, 'Original self free-revival bank1 stays separate');
  game = finish(game); assert.equal(promise(game, f.target).fulfilled, true); assert.deepEqual(inventory(game), f.originalCards);
});

void test('native Ghola can return the named leader without fulfilling or violating an ordinary-return No', () => {
  const f = fixture({ ghola: true }); let game = bind(f, 'no').game; assert.ok(f.ghola);
  game = settle(act(game, f.target, { type: 'card', card: f.ghola, leader: f.leader }));
  assert.equal(player(game, f.target).leaders.find(leader => leader.id === f.leader)!.dead, false);
  assert.equal(player(game, f.target).leaderRevived, false); assert.ok(!promise(game, f.target).fulfilled);
  assert.equal(player(game, f.target).spice, 5, 'Printed Ghola bank1 is distinct from an ordinary leader invoice');
  assert.equal(game.discard.filter(card => card.id === f.ghola).length, 1);
  game = finish(game); assert.equal(promise(game, f.target).fulfilled, true); assert.deepEqual(inventory(game), f.originalCards);
});

void test('native Ghola cannot erase the only named ordinary-return Yes witness', () => {
  const f = fixture({ ghola: true }), game = bind(f).game; assert.ok(f.ghola);
  rejected(game, f.target, { type: 'card', card: f.ghola, leader: f.leader });
  assert.ok(player(game, f.target).hand.some(card => card.id === f.ghola));
  assert.equal(player(game, f.target).leaders.find(leader => leader.id === f.leader)!.dead, true);
});

void test('native prior named ordinary return cannot satisfy a newly answered question about future returns', () => {
  const f = fixture(); let game = settle(act(f.game, f.target, f.revivalAction));
  assert.equal(player(game, f.target).spice, 2); assert.equal(player(game, f.target).leaderRevived, true);
  game = declare(f, game).game; game = ask(game, f.asker, f.target, f.leader);
  assert.deepEqual(viewGame(game, f.target).truthLeaderRevivalAnswers, ['no']);
  rejected(game, f.target, { type: 'truthAnswer', answer: 'yes' }); game = answer(game, f.target, 'no');
  assert.ok(!promise(game, f.target).fulfilled); assert.deepEqual(inventory(game), f.originalCards);
});

void test('native waiting Advanced named return keeps original Revival order and exposes its guide only when current', () => {
  const f = fixture({ advanced: true, window: 'waiting' }); assert.notEqual(f.game.revivalOrder!.remaining[0], f.target);
  let game = bind(f).game; assert.equal(viewGame(game, f.target).leaderRevivalPromiseGuide, null);
  game = advance(game, state => clean(state) && state.revivalOrder?.remaining[0] === f.target);
  const guide = viewGame(game, f.target).leaderRevivalPromiseGuide; assert.ok(guide);
  game = settle(act(game, f.target, guide.action)); assert.equal(promise(game, f.target).fulfilled, true);
  assert.deepEqual(inventory(game), f.originalCards);
});

void test('two original Truth copies require the same physical leader once at its native price', () => {
  const f = fixture(), declared = declare(f, f.game, { copies: 2 });
  let game = ask(declared.game, f.asker, f.target, f.leader); game = answer(game, f.target, 'yes');
  game = ask(game, f.asker, f.target, f.leader); assert.deepEqual(viewGame(game, f.target).truthLeaderRevivalAnswers, ['yes']);
  rejected(game, f.target, { type: 'truthAnswer', answer: 'no' }); game = answer(game, f.target, 'yes');
  const guide = viewGame(game, f.target).leaderRevivalPromiseGuide; assert.ok(guide); game = settle(act(game, f.target, guide.action));
  assert.ok(game.leaderRevivalPromises!.every(promise => promise.fulfilled)); assert.equal(player(game, f.target).spice, 2);
  assert.equal(player(game, f.target).leaders.find(leader => leader.id === f.leader)!.deaths, 1);
  for (const card of f.truths) assert.equal(game.discard.filter(held => held.id === card).length, 1);
  assert.deepEqual(inventory(game), f.originalCards);
});

void test('two original Truth copies cannot contradict a matching named ordinary-return No', () => {
  const f = fixture(), declared = declare(f, f.game, { copies: 2 });
  let game = ask(declared.game, f.asker, f.target, f.leader); game = answer(game, f.target, 'no');
  game = ask(game, f.asker, f.target, f.leader); assert.deepEqual(viewGame(game, f.target).truthLeaderRevivalAnswers, ['no']);
  rejected(game, f.target, { type: 'truthAnswer', answer: 'yes' }); game = answer(game, f.target, 'no');
  rejected(game, f.target, f.revivalAction); assert.equal(player(game, f.target).spice, 4);
  assert.deepEqual(inventory(game), f.originalCards);
});

void test('native joint force and named leader Yes preserve actual separate prices allowances and bank income', () => {
  const f = fixture(), declared = declare(f, f.game, { copies: 2 });
  let game = ask(declared.game, f.asker, f.target, f.leader); game = answer(game, f.target, 'yes');
  game = act(game, f.asker, { type: 'truthAsk', question: { kind: 'revival', target: f.target, turn: game.turn, counter: 'total', minimum: 1 } });
  game = act(game, f.target, { type: 'truthAnswer', answer: 'yes' });
  for (let count = 0; count < 4 && (!promise(game, f.target).fulfilled || !game.revivalPromises![0].fulfilled); count++) {
    const own = viewGame(game, f.target), guide = own.leaderRevivalPromiseGuide ?? own.revivalPromiseGuide; assert.ok(guide);
    game = settle(act(game, f.target, guide.action));
  }
  assert.equal(promise(game, f.target).fulfilled, true); assert.equal(game.revivalPromises![0].progress, 1);
  assert.equal(game.revivalPromises![0].fulfilled, true); assert.equal(player(game, f.target).leaderRevived, true);
  assert.equal(player(game, f.target).tanks, 0); assert.equal(player(game, f.target).revived, 1);
  assert.equal(player(game, f.target).freeForcesRevived, 1); assert.equal(player(game, f.target).spice, 3);
  assert.deepEqual(inventory(game), f.originalCards);
});

void test('native named Yes may prepare its price through an actual owned free-force return and Tleilaxu bank income', () => {
  const f = fixture(); let game = act(f.game, f.target, { type: 'bribe', target: f.asker, amount: 3 });
  assert.equal(player(game, f.target).spice, 1); game = bind(f, 'yes', f.leader, game).game;
  const preparation = viewGame(game, f.target).leaderRevivalPromiseGuide; assert.ok(preparation);
  assert.equal(preparation.action.type, 'revive'); assert.equal(preparation.action.amount, 1);
  game = settle(act(game, f.target, preparation.action));
  assert.equal(player(game, f.target).spice, 2); assert.equal(player(game, f.target).freeForcesRevived, 1);
  assert.equal(player(game, f.target).tanks, 0); assert.ok(!promise(game, f.target).fulfilled);
  assert.equal(player(game, f.target).leaders.find(leader => leader.id === f.leader)!.dead, true);
  const returned = viewGame(game, f.target).leaderRevivalPromiseGuide; assert.ok(returned); assert.equal(returned.action.type, 'reviveLeader');
  game = settle(act(game, f.target, returned.action));
  assert.equal(player(game, f.target).spice, 0); assert.equal(promise(game, f.target).fulfilled, true);
  assert.deepEqual(inventory(game), f.originalCards);
});

void test('native force No prevents using its forbidden free return to fund a named leader Yes', () => {
  const f = fixture(); let game = act(f.game, f.target, { type: 'bribe', target: f.asker, amount: 3 });
  game = declare(f, game, { copies: 2 }).game;
  game = act(game, f.asker, { type: 'truthAsk', question: { kind: 'revival', target: f.target, turn: game.turn, counter: 'total', minimum: 1 } });
  game = act(game, f.target, { type: 'truthAnswer', answer: 'no' });
  game = ask(game, f.asker, f.target, f.leader);
  assert.deepEqual(viewGame(game, f.target).truthLeaderRevivalAnswers, ['no']);
  rejected(game, f.target, { type: 'truthAnswer', answer: 'yes' }); game = answer(game, f.target, 'no');
  assert.equal(player(game, f.target).spice, 1); assert.equal(player(game, f.target).tanks, 1);
  assert.deepEqual(inventory(game), f.originalCards);
});

for (const permitted of [false, true]) void test(`native actually priced personal early leader quote ${permitted ? 'completes the named Yes' : 'stays blocked by a named No'}`, () => {
  const f = fixture({ advanced: true, window: 'waiting', bothDead: true });
  assert.equal(player(f.afterBattle, f.opponent).leaders.find(leader => leader.id === f.opponentLeader)!.dead, true);
  assert.equal(player(f.game, f.opponent).leaders.filter(leader => !leader.dead).length, 4);
  assert.equal(f.game.revivalOrder!.remaining[0], f.opponent);
  let game = act(f.game, f.opponent, { type: 'requestLeaderRevival', leader: f.opponentLeader });
  game = act(game, f.target, { type: 'quoteLeaderRevival', target: f.opponent, amount: 3 });
  const before = player(game, f.opponent).spice, payee = player(game, f.target).spice;
  game = declare(f, game).game; game = ask(game, f.asker, f.opponent, f.opponentLeader);
  game = answer(game, f.opponent, permitted ? 'yes' : 'no');
  if (permitted) {
    const guide = viewGame(game, f.opponent).leaderRevivalPromiseGuide; assert.ok(guide);
    assert.equal(guide.action.type, 'acceptLeaderRevival'); assert.equal(guide.action.leaderRevivalPrice, 3);
    game = settle(act(game, f.opponent, guide.action));
    assert.equal(player(game, f.opponent).leaders.find(leader => leader.id === f.opponentLeader)!.dead, false);
    assert.equal(player(game, f.opponent).spice, before - 3); assert.equal(player(game, f.target).spice, payee + 3);
    assert.equal(player(game, f.opponent).leaderRevived, true); assert.equal(promise(game, f.opponent).fulfilled, true);
  } else {
    rejected(game, f.opponent, { type: 'acceptLeaderRevival', leaderRevivalPrice: 3 });
    assert.equal(player(game, f.opponent).spice, before);
    assert.equal(player(game, f.opponent).leaders.find(leader => leader.id === f.opponentLeader)!.dead, true);
  }
  assert.deepEqual(inventory(game), f.originalCards);
});

void test('native named question ownership exact identity and guided event reject stale or foreign packets', () => {
  const f = fixture({ advanced: true }), declared = declare(f);
  rejected(declared.game, f.opponent, f.questionAction);
  rejected(declared.game, f.asker, { type: 'truthAsk', question: { ...f.question, turn: f.game.turn + 1 } });
  rejected(declared.game, f.asker, { type: 'truthAsk', question: { ...f.question, leader: 'atreides-0' } });
  let game = ask(declared.game, f.asker, f.target, f.leader);
  assert.deepEqual(viewGame(game, f.target).truthLeaderRevivalAnswers, ['yes', 'no']);
  assert.equal(viewGame(game, f.asker).truthLeaderRevivalAnswers, null);
  rejected(game, f.asker, { type: 'truthAnswer', answer: 'yes' }); game = answer(game, f.target, 'yes');
  const guide = viewGame(game, f.target).leaderRevivalPromiseGuide; assert.ok(guide); assert.ok(guide.action.leaderRevivalPromiseEvent);
  rejected(game, f.target, { ...guide.action, leaderRevivalPromiseEvent: 'stale-owned-leader-event' });
  rejected(game, f.opponent, guide.action);
  game = settle(act(game, f.target, guide.action)); rejected(game, f.target, guide.action);
  assert.deepEqual(inventory(game), f.originalCards);
});

void test('all four minimal policies offer a legal real named leader return at the current native opportunity', () => {
  const f = fixture(), game = bind(f).game;
  for (const difficulty of DIFFICULTIES) {
    const view = viewGame(game, f.target); view.players.find(player => player.id === f.target)!.bot = difficulty;
    const action = botActions(view).find(action => action.type === 'reviveLeader' && action.leader === f.leader); assert.ok(action, difficulty);
    const returned = settle(act(structuredClone(game), f.target, action));
    assert.equal(promise(returned, f.target).fulfilled, true); assert.equal(player(returned, f.target).spice, 2);
    assert.deepEqual(inventory(returned), f.originalCards);
  }
});
