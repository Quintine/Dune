import assert from 'node:assert/strict';
import test from 'node:test';
import { viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import type { RevivalExpression } from '../game/revival-expression-promises';
import {
  actTruthRevivalExpression as act, advanceTruthRevivalExpression as advance,
  answerTruthRevivalExpression as answer, askTruthRevivalExpression as ask,
  bindTruthRevivalExpression as bind, createTruthRevivalExpressionFixture as fixture,
  declareTruthRevivalExpression as declare, finishTruthRevivalExpression as finish,
  settleTruthRevivalExpression as settle, truthRevivalExpressionClean as clean,
  truthRevivalExpressionInventory as inventory, truthRevivalExpressionPlayer as player,
} from './fixture-truth-revival-expression';

const force = (minimum = 1): RevivalExpression => ({ kind: 'forces', counter: 'total', minimum });
const leader = (id: string): RevivalExpression => ({ kind: 'leader', leader: id });
const both = (id: string): RevivalExpression => ({ kind: 'and', terms: [force(), leader(id)] });
const either = (id: string): RevivalExpression => ({ kind: 'or', terms: [force(), leader(id)] });
const progress0 = { total: 0, normal: 0, elite: 0, leaders: [] };
const promise = (game: Game, target: string) => game.revivalExpressionPromises!.find(row => row.player === target)!;
function rejected(game: Game, actor: string, action: Action) {
  const before = structuredClone(game); assert.throws(() => act(game, actor, action)); assert.deepEqual(game, before);
}
function complete(game: Game, target: string): Game {
  for (let count = 0; count < 4 && !promise(game, target).fulfilled; count++) {
    const guide = viewGame(game, target).revivalExpressionPromiseGuide; assert.ok(guide);
    assert.equal(guide.phase, 4); game = settle(act(game, target, guide.action));
  }
  assert.equal(promise(game, target).fulfilled, true); return game;
}

for (const advanced of [false, true]) void test(`native ${advanced ? 'Advanced' : 'Basic'} grouped Revival AND follows actual force then named leader returns`, () => {
  const f = fixture({ advanced }); assert.equal(f.setup.status, 'setup'); assert.deepEqual(f.game.expansions, ['ix']);
  assert.equal(f.originalCards.length, 47); assert.deepEqual(f.staging, []);
  assert.equal(f.sourceCount, f.sourceActions.length); assert.equal(f.sourceActionCount, f.sourceActions.length);
  assert.deepEqual(f.beforeStartingDeal.deck.slice(0, 4).map(card => card.id), f.deal);
  assert.equal(f.base.question.kind, 'leaderRevival'); assert.equal(f.question.kind, 'revivalExpression');
  assert.equal(player(f.shipment.before, f.target).spice - player(f.shipment.after, f.target).spice, 1);
  assert.equal(player(f.afterBattle, f.target).leaders.find(disc => disc.id === f.leader)!.dead, true);
  assert.equal(player(f.game, f.target).tanks, 1); assert.equal(player(f.game, f.target).spice, 4);
  const before = structuredClone(f.game), bound = bind(f); assert.deepEqual(f.game, before);
  assert.deepEqual(promise(bound.game, f.target).progress, progress0);
  rejected(bound.game, f.target, { type: 'ready' });
  let game = act(bound.game, f.target, { type: 'revive', amount: 1, elite: 0 });
  if (game.pendingRevival) assert.deepEqual(promise(game, f.target).progress, progress0);
  game = settle(game);
  assert.deepEqual(promise(game, f.target).progress, { total: 1, normal: 1, elite: 0, leaders: [] });
  assert.ok(!promise(game, f.target).fulfilled); assert.equal(player(game, f.target).spice, 5);
  assert.equal(player(game, f.target).freeForcesRevived, 1); assert.equal(player(game, f.target).tanks, 0);
  rejected(game, f.target, { type: 'ready' });
  const guide = viewGame(game, f.target).revivalExpressionPromiseGuide; assert.ok(guide);
  assert.equal(guide.phase, 4); assert.equal(guide.action.type, 'reviveLeader'); assert.equal(guide.action.leader, f.leader);
  game = settle(act(game, f.target, guide.action));
  assert.deepEqual(promise(game, f.target).progress, { total: 1, normal: 1, elite: 0, leaders: [f.leader] });
  assert.equal(promise(game, f.target).fulfilled, true); assert.equal(player(game, f.target).spice, 3);
  assert.equal(player(game, f.target).leaders.find(disc => disc.id === f.leader)!.deaths, 1);
  assert.equal(player(game, f.target).leaders.find(disc => disc.id === f.leader)!.dead, false);
  if (advanced) assert.deepEqual(game.revivalOrder!.original, f.game.revivalOrder!.original);
  assert.equal(game.discard.filter(card => card.id === f.truth).length, 1);
  assert.deepEqual(inventory(finish(game)), f.originalCards);
});

void test('native grouped OR Yes accepts a manual ordinary route different from its guide', () => {
  const f = fixture(), claim = either(f.leader); let game = bind(f, 'yes', claim).game;
  const guide = viewGame(game, f.target).revivalExpressionPromiseGuide; assert.ok(guide);
  assert.ok(guide.action.type === 'revive' || guide.action.type === 'reviveLeader');
  const manual: Action = guide.action.type === 'revive' ? f.revivalAction : { type: 'revive', amount: 1, elite: 0 };
  assert.notEqual(manual.type, guide.action.type); game = settle(act(game, f.target, manual));
  assert.equal(promise(game, f.target).fulfilled, true);
  assert.equal(promise(game, f.target).progress.total, manual.type === 'revive' ? 1 : 0);
  assert.deepEqual(promise(game, f.target).progress.leaders, manual.type === 'reviveLeader' ? [f.leader] : []);
  assert.deepEqual(inventory(finish(game)), f.originalCards);
});

for (const first of ['forces', 'leader'] as const) void test(`native grouped AND No permits ${first} first and rejects only completion of the whole expression`, () => {
  const f = fixture(); let game = bind(f, 'no').game;
  const forceAction: Action = { type: 'revive', amount: 1, elite: 0 };
  game = settle(act(game, f.target, first === 'forces' ? forceAction : f.revivalAction));
  assert.ok(!promise(game, f.target).fulfilled);
  assert.equal(promise(game, f.target).progress.total, first === 'forces' ? 1 : 0);
  assert.deepEqual(promise(game, f.target).progress.leaders, first === 'leader' ? [f.leader] : []);
  rejected(game, f.target, first === 'forces' ? f.revivalAction : forceAction);
  game = finish(game); assert.equal(promise(game, f.target).fulfilled, true);
  assert.deepEqual(inventory(game), f.originalCards);
});

void test('native grouped OR No rejects either ordinary return while permitting native phase completion', () => {
  const f = fixture(); let game = bind(f, 'no', either(f.leader)).game;
  rejected(game, f.target, { type: 'revive', amount: 1, elite: 0 }); rejected(game, f.target, f.revivalAction);
  assert.deepEqual(promise(game, f.target).progress, progress0);
  game = finish(game); assert.equal(promise(game, f.target).fulfilled, true);
  assert.equal(player(game, f.target).spice, 4); assert.deepEqual(inventory(game), f.originalCards);
});

void test('native nested whole No retains its outer AND after an inner OR becomes true', () => {
  const f = fixture(), claim: RevivalExpression = { kind: 'and', terms: [either(f.leader), leader(f.leader)] };
  let game = bind(f, 'no', claim).game;
  game = settle(act(game, f.target, { type: 'revive', amount: 1, elite: 0 }));
  assert.equal(promise(game, f.target).progress.total, 1); assert.ok(!promise(game, f.target).fulfilled);
  rejected(game, f.target, f.revivalAction);
  game = finish(game); assert.equal(promise(game, f.target).fulfilled, true); assert.deepEqual(inventory(game), f.originalCards);
});

void test('native prior ordinary force return is excluded from a newly answered grouped expression', () => {
  const f = fixture(); let game = settle(act(f.game, f.target, { type: 'revive', amount: 1, elite: 0 }));
  assert.equal(player(game, f.target).revived, 1); assert.equal(player(game, f.target).spice, 5);
  game = bind(f, 'yes', either(f.leader), game).game;
  assert.deepEqual(promise(game, f.target).progress, progress0); assert.ok(!promise(game, f.target).fulfilled);
  game = settle(act(game, f.target, f.revivalAction));
  assert.deepEqual(promise(game, f.target).progress, { ...progress0, leaders: [f.leader] });
  assert.equal(promise(game, f.target).fulfilled, true); assert.deepEqual(inventory(game), f.originalCards);
});

void test('native original Ghola return is excluded from grouped ordinary leader progress and No', () => {
  const f = fixture({ ghola: true }); assert.ok(f.ghola);
  let game = bind(f, 'no', either(f.leader)).game;
  game = settle(act(game, f.target, { type: 'card', card: f.ghola, leader: f.leader }));
  assert.equal(player(game, f.target).leaders.find(disc => disc.id === f.leader)!.dead, false);
  assert.equal(player(game, f.target).leaderRevived, false); assert.equal(player(game, f.target).spice, 5);
  assert.deepEqual(promise(game, f.target).progress, progress0); assert.ok(!promise(game, f.target).fulfilled);
  rejected(game, f.target, { type: 'revive', amount: 1, elite: 0 });
  game = finish(game); assert.equal(promise(game, f.target).fulfilled, true);
  assert.equal(game.discard.filter(card => card.id === f.ghola).length, 1); assert.deepEqual(inventory(game), f.originalCards);
});

void test('two original Truths keep scalar force No and a dynamic grouped OR Yes jointly legal', () => {
  const f = fixture(); let game = declare(f, f.game, { copies: 2 }).game;
  game = act(game, f.asker, { type: 'truthAsk', question: { kind: 'revival', target: f.target, turn: game.turn, counter: 'total', minimum: 1 } });
  game = act(game, f.target, { type: 'truthAnswer', answer: 'no' });
  game = ask(game, f.asker, f.target, either(f.leader));
  assert.deepEqual(viewGame(game, f.target).truthRevivalExpressionAnswers, ['yes', 'no']);
  game = answer(game, f.target, 'yes');
  const guide = viewGame(game, f.target).revivalExpressionPromiseGuide; assert.ok(guide);
  assert.equal(guide.action.type, 'reviveLeader'); game = settle(act(game, f.target, guide.action));
  assert.equal(promise(game, f.target).fulfilled, true); assert.equal(game.revivalPromises![0].progress, 0);
  assert.equal(player(game, f.target).tanks, 1); assert.equal(player(game, f.target).spice, 2);
  game = finish(game); assert.equal(game.revivalPromises![0].fulfilled, true);
  for (const card of f.truths) assert.equal(game.discard.filter(held => held.id === card).length, 1);
  assert.deepEqual(inventory(game), f.originalCards);
});

void test('two original Truths reject a scalar No contradicting an existing grouped AND Yes', () => {
  const f = fixture(); let game = declare(f, f.game, { copies: 2 }).game;
  game = answer(ask(game, f.asker, f.target, both(f.leader)), f.target, 'yes');
  game = act(game, f.asker, { type: 'truthAsk', question: { kind: 'revival', target: f.target, turn: game.turn, counter: 'total', minimum: 1 } });
  assert.deepEqual(viewGame(game, f.target).truthRevivalAnswers, ['yes']);
  rejected(game, f.target, { type: 'truthAnswer', answer: 'no' });
  game = act(game, f.target, { type: 'truthAnswer', answer: 'yes' }); game = complete(game, f.target);
  assert.equal(game.revivalPromises![0].fulfilled, true); assert.equal(game.revivalPromises![0].progress, 1);
  assert.equal(player(game, f.target).spice, 3); assert.deepEqual(inventory(game), f.originalCards);
});

void test('native post-Storm grouped Yes persists through real Spice charity bidding and ordered Revival', () => {
  const f = fixture({ advanced: true, window: 'waiting' });
  assert.equal(f.postStorm.phase, 1); assert.equal(f.postStorm.turn, 2);
  assert.equal(f.postStormSourceActions.length, f.postStormActionCount); assert.deepEqual(f.postStorm, f.storm.after);
  assert.deepEqual(f.sourceActions.slice(f.postStormActionCount, f.phase3ActionCount), f.bidding.steps);
  let game = bind(f, 'yes', f.claim, f.postStorm).game;
  assert.deepEqual(promise(game, f.target).progress, progress0);
  game = advance(game, state => state.phase === 4 && clean(state) && state.revivalOrder?.remaining[0] === f.target);
  assert.deepEqual(promise(game, f.target).progress, progress0); assert.equal(player(game, f.target).spice, 4);
  game = complete(game, f.target); assert.equal(player(game, f.target).spice, 3);
  assert.deepEqual(inventory(finish(game)), f.originalCards);
});

void test('native waiting grouped promise retains original order and rejects stale foreign question and guide packets', () => {
  const f = fixture({ advanced: true, window: 'waiting' }), declared = declare(f);
  rejected(declared.game, f.opponent, f.questionAction);
  rejected(declared.game, f.asker, { type: 'truthAsk', question: { ...f.question, turn: f.game.turn + 1 } });
  let game = ask(declared.game, f.asker, f.target, f.claim);
  assert.equal(viewGame(game, f.asker).truthRevivalExpressionAnswers, null);
  assert.deepEqual(viewGame(game, f.target).truthRevivalExpressionAnswers, ['yes', 'no']);
  rejected(game, f.asker, { type: 'truthAnswer', answer: 'yes' }); game = answer(game, f.target, 'yes');
  assert.equal(viewGame(game, f.target).revivalExpressionPromiseGuide, null);
  game = advance(game, state => clean(state) && state.revivalOrder?.remaining[0] === f.target);
  assert.deepEqual(game.revivalOrder!.original, f.game.revivalOrder!.original);
  const guide = viewGame(game, f.target).revivalExpressionPromiseGuide; assert.ok(guide);
  assert.ok(guide.action.revivalExpressionPromiseEvent);
  rejected(game, f.target, { ...guide.action, revivalExpressionPromiseEvent: 'stale-grouped-revival-event' });
  rejected(game, f.opponent, guide.action);
  game = complete(game, f.target); rejected(game, f.target, guide.action); assert.deepEqual(inventory(game), f.originalCards);
});

void test('all four minimal policies offer legal native grouped returns until the whole AND is fulfilled', () => {
  const f = fixture(), bound = bind(f).game;
  for (const difficulty of DIFFICULTIES) {
    let game = structuredClone(bound);
    for (let count = 0; count < 4 && !promise(game, f.target).fulfilled; count++) {
      const view = viewGame(game, f.target); view.players.find(player => player.id === f.target)!.bot = difficulty;
      const guide = view.revivalExpressionPromiseGuide; assert.ok(guide, difficulty);
      const action = botActions(view).find(action => action.revivalExpressionPromiseEvent === guide.action.revivalExpressionPromiseEvent);
      assert.ok(action, difficulty); game = settle(act(game, f.target, action));
    }
    assert.equal(promise(game, f.target).fulfilled, true, difficulty);
    assert.equal(player(game, f.target).spice, 3); assert.equal(player(game, f.target).tanks, 0);
    assert.deepEqual(inventory(game), f.originalCards);
  }
});
