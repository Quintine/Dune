import assert from 'node:assert/strict';
import test from 'node:test';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { viewGame, type Action, type Game } from '../game/engine';
import { truthFactAnswer } from '../game/truthtrance';
import { truthKnowledgeOf } from '../game/truthtrance-knowledge';
import {
  actTruthMixedRevival as act, advanceTruthMixedRevival as advance,
  answerTruthMixedRevival as answer, askTruthMixedRevival as ask,
  bindTruthMixedRevival as bind, completeTruthMixedRevival as complete,
  createTruthMixedRevivalFixture as fixture, declareTruthMixedRevival as declare,
  finishTruthMixedRevival as finish, settleTruthMixedRevival as settle,
  truthMixedRevivalClean as clean, truthMixedRevivalFact as fact,
  truthMixedRevivalForce as force, truthMixedRevivalGroup as group,
  truthMixedRevivalInventory as inventory, truthMixedRevivalLeader as leader,
  truthMixedRevivalPlayer as player, truthMixedRevivalPromise as promise,
} from './fixture-truth-mixed-revival';

const progress0 = { total: 0, normal: 0, elite: 0, leaders: [] };
const forceAction: Action = { type: 'revive', amount: 1, elite: 0 };
function rejected(game: Game, actor: string, action: Action) {
  const before = structuredClone(game); assert.throws(() => act(game, actor, action)); assert.deepEqual(game, before);
}
function truthOnce(game: Game, truth: string) {
  assert.equal(game.discard.filter(card => card.id === truth).length, 1);
}

for (const advanced of [false, true]) void test(`native ${advanced ? 'Advanced' : 'Basic'} mixed Revival freezes original T4 before real force income and named leader debit`, () => {
  const f = fixture({ advanced }); assert.equal(f.initial.status, 'lobby'); assert.equal(f.setup.status, 'setup');
  assert.deepEqual(f.game.expansions, ['ix']); assert.equal(f.originalCards.length, 47); assert.deepEqual(f.staging, []);
  assert.equal(f.sourceActionCount, advanced ? 108 : 102); assert.equal(f.sourceActionCount, f.sourceActions.length);
  assert.equal(f.sourceCounts.inherited, f.sourceActionCount);
  assert.deepEqual(f.beforeStartingDeal.deck.slice(0, 4).map(card => card.id), f.deal);
  assert.equal(f.revivalSource.question.kind, 'revivalExpression'); assert.equal(f.question.kind, 'mixedRevival');
  assert.equal(player(f.shipment.before, f.target).spice - player(f.shipment.after, f.target).spice, 1);
  assert.equal(player(f.afterBattle, f.target).leaders.find(disc => disc.id === f.leader)!.dead, true);
  assert.equal(player(f.game, f.target).leaders.filter(disc => !disc.dead).length, 4);
  assert.equal(player(f.game, f.target).revivalCycle, 0); assert.equal(f.quote.early, true); assert.equal(f.quote.cost, 2);
  assert.equal(player(f.game, f.target).tanks, 1); assert.equal(player(f.game, f.target).spice, 4);
  assert.equal(truthFactAnswer(player(f.game, f.target), f.spiceFact), 'yes');
  const before = structuredClone(f.game), bound = bind(f); assert.deepEqual(f.game, before);
  assert.deepEqual(promise(bound.game).mixed, f.mixed); assert.deepEqual(promise(bound.game).progress, progress0);
  rejected(bound.game, f.target, { type: 'ready' });
  let game = act(bound.game, f.target, forceAction);
  if (game.pendingRevival) assert.deepEqual(promise(game).progress, progress0);
  game = settle(game);
  assert.deepEqual(promise(game).progress, { total: 1, normal: 1, elite: 0, leaders: [] });
  assert.equal(promise(game).fulfilled, false); assert.equal(player(game, f.target).spice, 5);
  assert.equal(player(game, f.target).freeForcesRevived, 1); assert.equal(player(game, f.target).tanks, 0);
  rejected(game, f.target, { type: 'ready' });
  const guide = viewGame(game, f.target).revivalExpressionPromiseGuide; assert.ok(guide);
  assert.equal(guide.phase, 4); assert.equal(guide.action.type, 'reviveLeader'); assert.equal(guide.action.leader, f.leader);
  assert.equal(guide.action.revivalExpressionPromiseEvent, promise(game).event);
  game = settle(act(game, f.target, guide.action));
  assert.deepEqual(promise(game).progress, { total: 1, normal: 1, elite: 0, leaders: [f.leader] });
  assert.equal(promise(game).fulfilled, true); assert.equal(promise(game).released, false);
  assert.equal(player(game, f.target).spice, 3); assert.equal(truthFactAnswer(player(game, f.target), f.spiceFact), 'no');
  assert.equal(player(game, f.target).leaderRevived, true);
  assert.equal(player(game, f.target).leaders.find(disc => disc.id === f.leader)!.deaths, 1);
  assert.equal(player(game, f.target).leaders.find(disc => disc.id === f.leader)!.dead, false);
  if (advanced) assert.deepEqual(game.revivalOrder!.original, f.game.revivalOrder!.original);
  truthOnce(game, f.truth); assert.deepEqual(inventory(finish(game)), f.originalCards);
});

void test('native true current fact OR return answers Yes immediately with no native Revival binding', () => {
  const f = fixture(), mixed = group('or', fact(f.spiceFact), leader(f.leader));
  const asked = ask(declare(f).game, f.asker, f.target, mixed);
  assert.deepEqual(viewGame(asked, f.target).truthMixedRevivalAnswers, ['yes']);
  rejected(asked, f.target, { type: 'truthAnswer', answer: 'no' });
  let game = answer(asked, f.target, 'yes'); assert.equal(promise(game).fulfilled, true);
  assert.equal(game.revivalExpressionPromises?.length ?? 0, 0);
  assert.equal(viewGame(game, f.target).revivalExpressionPromiseGuide, null);
  assert.deepEqual(promise(game).mixed, mixed); assert.deepEqual(promise(game).progress, progress0);
  game = finish(game); assert.equal(player(game, f.target).spice, 4); assert.equal(player(game, f.target).revived, 0);
  assert.equal(player(game, f.target).leaders.find(disc => disc.id === f.leader)!.dead, true);
  truthOnce(game, f.truth); assert.deepEqual(inventory(game), f.originalCards);
});

void test('native false current fact AND return answers No immediately while the real return remains legal', () => {
  const f = fixture(), mixed = group('and', fact(f.falseSpiceFact), force());
  assert.equal(truthFactAnswer(player(f.game, f.target), f.falseSpiceFact), 'no');
  const asked = ask(declare(f).game, f.asker, f.target, mixed);
  assert.deepEqual(viewGame(asked, f.target).truthMixedRevivalAnswers, ['no']);
  rejected(asked, f.target, { type: 'truthAnswer', answer: 'yes' });
  let game = answer(asked, f.target, 'no'); assert.equal(promise(game).fulfilled, true);
  assert.equal(game.revivalExpressionPromises?.length ?? 0, 0);
  game = settle(act(game, f.target, forceAction)); assert.equal(player(game, f.target).spice, 5);
  assert.equal(truthFactAnswer(player(game, f.target), f.falseSpiceFact), 'yes');
  assert.deepEqual(promise(game).progress, progress0); assert.equal(promise(game).fulfilled, true);
  truthOnce(game, f.truth); assert.deepEqual(inventory(finish(game)), f.originalCards);
});

void test('native false current fact OR return Yes requires the actual ordinary return', () => {
  const f = fixture(); let game = bind(f, 'yes', group('or', fact(f.falseSpiceFact), leader(f.leader))).game;
  assert.equal(promise(game).fulfilled, false); assert.deepEqual(promise(game).progress, progress0);
  rejected(game, f.target, { type: 'ready' }); game = settle(act(game, f.target, f.revivalAction));
  assert.equal(promise(game).fulfilled, true); assert.deepEqual(promise(game).progress, { ...progress0, leaders: [f.leader] });
  assert.equal(player(game, f.target).spice, 2); truthOnce(game, f.truth);
  assert.deepEqual(inventory(finish(game)), f.originalCards);
});

void test('native true current fact AND return No forbids that exact ordinary event until the real deadline', () => {
  const f = fixture(); let game = bind(f, 'no', group('and', fact(f.spiceFact), force())).game;
  rejected(game, f.target, forceAction); assert.equal(promise(game).fulfilled, false);
  game = settle(act(game, f.target, f.revivalAction)); assert.equal(player(game, f.target).spice, 2);
  assert.equal(truthFactAnswer(player(game, f.target), f.spiceFact), 'no');
  rejected(game, f.target, forceAction); assert.deepEqual(promise(game).progress, { ...progress0, leaders: [f.leader] });
  game = finish(game); assert.equal(promise(game).fulfilled, true); assert.equal(player(game, f.target).tanks, 1);
  assert.deepEqual(inventory(game), f.originalCards);
});

for (const answerValue of ['yes', 'no'] as const) void test(`native unknown non-Fremen forecast uses the conservative whole ${answerValue} ordinary-return constraint`, () => {
  const f = fixture(), p = player(f.game, f.target);
  assert.equal(p.faction, 'tleilaxu'); assert.equal(truthKnowledgeOf(f.game, p).stormForecast, null);
  assert.equal(truthFactAnswer(p, f.forecastFact, truthKnowledgeOf(f.game, p)), 'unknown');
  const mixed = group(answerValue === 'yes' ? 'or' : 'and', fact(f.forecastFact), leader(f.leader));
  const asked = ask(declare(f).game, f.asker, f.target, mixed);
  assert.deepEqual(viewGame(asked, f.target).truthMixedRevivalAnswers, [answerValue]);
  rejected(asked, f.target, { type: 'truthAnswer', answer: answerValue === 'yes' ? 'no' : 'yes' });
  let game = answer(asked, f.target, answerValue); assert.equal(promise(game).fulfilled, false);
  if (answerValue === 'yes') {
    game = settle(act(game, f.target, f.revivalAction)); assert.equal(promise(game).fulfilled, true);
    assert.deepEqual(promise(game).progress.leaders, [f.leader]);
  } else {
    rejected(game, f.target, f.revivalAction); game = settle(act(game, f.target, forceAction));
    assert.equal(promise(game).progress.normal, 1); assert.equal(promise(game).fulfilled, false);
  }
  game = finish(game); assert.equal(promise(game).fulfilled, true); truthOnce(game, f.truth);
  assert.deepEqual(inventory(game), f.originalCards);
});

void test('native mixed OR preserves the manual force or leader alternative instead of pinning its guide', () => {
  const f = fixture(), mixed = group('or', group('and', fact(f.spiceFact), force()), leader(f.leader));
  let game = bind(f, 'yes', mixed).game;
  const guide = viewGame(game, f.target).revivalExpressionPromiseGuide; assert.ok(guide);
  assert.ok(guide.action.type === 'revive' || guide.action.type === 'reviveLeader');
  const manual = guide.action.type === 'revive' ? f.revivalAction : forceAction;
  assert.notEqual(manual.type, guide.action.type); game = settle(act(game, f.target, manual));
  assert.equal(promise(game).fulfilled, true);
  assert.equal(promise(game).progress.total, manual.type === 'revive' ? 1 : 0);
  assert.deepEqual(promise(game).progress.leaders, manual.type === 'reviveLeader' ? [f.leader] : []);
  rejected(game, f.target, guide.action); assert.deepEqual(inventory(finish(game)), f.originalCards);
});

void test('native mixed partial normal returns retain a larger force OR until the real alternate leader return', () => {
  const f = fixture(), mixed = group('and', fact(f.spiceFact), group('or', force(2, 'normal'), leader(f.leader)));
  let game = bind(f, 'yes', mixed).game; game = settle(act(game, f.target, forceAction));
  assert.equal(promise(game).progress.normal, 1); assert.equal(promise(game).fulfilled, false);
  const guide = viewGame(game, f.target).revivalExpressionPromiseGuide; assert.ok(guide);
  assert.equal(guide.action.type, 'reviveLeader'); game = settle(act(game, f.target, guide.action));
  assert.equal(promise(game).fulfilled, true); assert.equal(promise(game).progress.total, 1);
  assert.deepEqual(promise(game).progress.leaders, [f.leader]); assert.equal(player(game, f.target).spice, 3);
  assert.deepEqual(inventory(finish(game)), f.originalCards);
});

for (const first of ['forces', 'leader'] as const) void test(`native mixed whole AND No permits ${first} first and rejects only whole completion`, () => {
  const f = fixture(); let game = bind(f, 'no').game;
  game = settle(act(game, f.target, first === 'forces' ? forceAction : f.revivalAction));
  assert.equal(promise(game).fulfilled, false); assert.equal(promise(game).progress.total, first === 'forces' ? 1 : 0);
  assert.deepEqual(promise(game).progress.leaders, first === 'leader' ? [f.leader] : []);
  rejected(game, f.target, first === 'forces' ? f.revivalAction : forceAction);
  game = finish(game); assert.equal(promise(game).fulfilled, true); assert.deepEqual(inventory(game), f.originalCards);
});

void test('native mixed whole OR No forbids both qualifying ordinary returns through the native deadline', () => {
  const f = fixture(), mixed = group('or', fact(f.falseSpiceFact), force(), leader(f.leader));
  let game = bind(f, 'no', mixed).game;
  rejected(game, f.target, forceAction); rejected(game, f.target, f.revivalAction);
  assert.deepEqual(promise(game).progress, progress0); game = finish(game);
  assert.equal(promise(game).fulfilled, true); assert.equal(player(game, f.target).spice, 4);
  assert.deepEqual(inventory(game), f.originalCards);
});

void test('native prior ordinary returns start outside a newly answered mixed interval', () => {
  const f = fixture(); let game = settle(act(f.game, f.target, forceAction));
  assert.equal(player(game, f.target).revived, 1); assert.equal(player(game, f.target).spice, 5);
  const mixed = group('and', fact(f.spiceFact), group('or', force(), leader(f.leader)));
  game = bind(f, 'yes', mixed, game).game;
  assert.deepEqual(promise(game).progress, progress0); assert.equal(promise(game).fulfilled, false);
  game = settle(act(game, f.target, f.revivalAction));
  assert.deepEqual(promise(game).progress, { ...progress0, leaders: [f.leader] });
  assert.equal(promise(game).fulfilled, true); assert.deepEqual(inventory(game), f.originalCards);
});

void test('native original Ghola stays outside the mixed ordinary-return progress and No restriction', () => {
  const f = fixture({ ghola: true }); assert.ok(f.ghola);
  let game = bind(f, 'no', group('and', fact(f.spiceFact), group('or', force(), leader(f.leader)))).game;
  game = settle(act(game, f.target, { type: 'card', card: f.ghola, leader: f.leader }));
  assert.equal(player(game, f.target).leaders.find(disc => disc.id === f.leader)!.dead, false);
  assert.equal(player(game, f.target).leaderRevived, false); assert.equal(player(game, f.target).spice, 5);
  assert.deepEqual(promise(game).progress, progress0); assert.equal(promise(game).fulfilled, false);
  rejected(game, f.target, forceAction); game = finish(game); assert.equal(promise(game).fulfilled, true);
  assert.equal(game.discard.filter(card => card.id === f.ghola).length, 1); assert.deepEqual(inventory(game), f.originalCards);
});

void test('native mixed projection exposes only owned raw question aggregate and filters its pure residual', () => {
  const f = fixture(), game = bind(f).game;
  for (const actor of [f.target, f.asker, f.opponent]) {
    const view = viewGame(game, actor); assert.ok(!('mixedRevivalQuestions' in view));
    assert.deepEqual(view.revivalExpressionPromises, []); assert.equal(view.truthMixedRevivalAnswers, null);
    assert.deepEqual(view.truthHistory.at(-1)?.question, f.question); assert.equal(view.truthHistory.at(-1)?.answer, 'yes');
    if (actor !== f.target) {
      assert.deepEqual(view.mixedRevivalPromises, []); assert.equal(view.revivalExpressionPromiseGuide, null);
    } else {
      const row = promise(game);
      assert.deepEqual(Object.keys(row).sort(), ['answer', 'asker', 'event', 'fulfilled', 'mixed', 'player', 'progress', 'released', 'turn']);
      assert.deepEqual(row.mixed, f.mixed); assert.deepEqual(row.progress, progress0);
      assert.equal(row.player, f.target); assert.equal(row.asker, f.asker); assert.equal(row.turn, game.turn);
      assert.equal(typeof row.answer, 'boolean'); assert.equal(typeof row.fulfilled, 'boolean'); assert.equal(typeof row.released, 'boolean');
      assert.ok(view.revivalExpressionPromiseGuide?.action.revivalExpressionPromiseEvent);
      assert.ok(!JSON.stringify(row).includes('"claim"'));
    }
  }
  assert.equal(game.revivalExpressionPromises?.length, 1);
  assert.equal(game.revivalExpressionPromises![0].event, promise(game).event);
});

void test('native mixed question and guide preserve exact owner turn event and JSON packets', () => {
  const f = fixture(), declared = declare(f);
  assert.ok(viewGame(declared.game, f.asker).truthMixedRevivalTargets.includes(f.target));
  rejected(declared.game, f.opponent, f.questionAction);
  rejected(declared.game, f.asker, { type: 'truthAsk', question: { ...f.question, turn: f.game.turn + 1 } });
  rejected(declared.game, f.asker, { type: 'truthAsk', question: { ...f.question,
    mixed: group('and', fact(f.spiceFact), leader('atreides-0')) } });
  let game = ask(declared.game, f.asker, f.target, f.mixed);
  assert.equal(viewGame(game, f.asker).truthMixedRevivalAnswers, null);
  assert.deepEqual(viewGame(game, f.target).truthMixedRevivalAnswers, ['yes', 'no']);
  rejected(game, f.asker, { type: 'truthAnswer', answer: 'yes' }); game = answer(game, f.target, 'yes');
  const guide = viewGame(game, f.target).revivalExpressionPromiseGuide; assert.ok(guide); assert.equal(guide.phase, 4);
  assert.equal(guide.action.revivalExpressionPromiseEvent, promise(game).event);
  rejected(game, f.opponent, guide.action);
  rejected(game, f.target, { ...guide.action, revivalExpressionPromiseEvent: 'stale-mixed-revival-event' });
  rejected(game, f.target, { ...guide.action, amount: 20, elite: 0 });
  const wire: Action = JSON.parse(JSON.stringify(guide.action)); game = settle(act(game, f.target, wire));
  rejected(game, f.target, wire); game = complete(game, f.target);
  rejected(game, f.target, wire); rejected(finish(game), f.target, wire);
  truthOnce(game, f.truth); assert.deepEqual(inventory(game), f.originalCards);
});

void test('native mixed post-Storm Yes crosses real Spice Charity Bidding and original ordered Revival', () => {
  const f = fixture({ advanced: true, window: 'waiting' });
  assert.equal(f.postStorm.turn, 2); assert.equal(f.postStorm.phase, 1);
  assert.equal(f.sourceCounts.postStorm, 83); assert.deepEqual(f.postStorm, f.storm.after);
  assert.equal(f.postStormSourceActions.length, f.postStormActionCount);
  assert.deepEqual(f.sourceActions.slice(f.postStormActionCount, f.phase3ActionCount), f.bidding.steps);
  let game = bind(f, 'yes', f.mixed, f.postStorm).game;
  assert.deepEqual(promise(game).progress, progress0); assert.equal(viewGame(game, f.target).revivalExpressionPromiseGuide, null);
  const actions: { actor: string; action: Action }[] = [];
  game = advance(game, state => state.phase === 4 && clean(state) && state.revivalOrder?.remaining[0] === f.target, actions);
  assert.ok(actions.some(step => step.action.type === 'passBid')); assert.ok(actions.some(step => step.action.type === 'ready'));
  assert.deepEqual(game.revivalOrder!.original, f.game.revivalOrder!.original);
  assert.deepEqual(promise(game).progress, progress0); assert.equal(player(game, f.target).spice, 4);
  game = complete(game, f.target); assert.equal(player(game, f.target).spice, 3);
  assert.deepEqual(inventory(finish(game)), f.originalCards);
});

void test('native waiting mixed Yes exposes the common guide only at its original owned opportunity', () => {
  const f = fixture({ advanced: true, window: 'waiting' }); assert.notEqual(f.game.revivalOrder!.remaining[0], f.target);
  let game = bind(f).game; assert.equal(viewGame(game, f.target).revivalExpressionPromiseGuide, null);
  rejected(game, f.target, forceAction); rejected(game, f.target, f.revivalAction);
  game = advance(game, state => clean(state) && state.revivalOrder?.remaining[0] === f.target);
  assert.deepEqual(game.revivalOrder!.original, f.game.revivalOrder!.original);
  game = complete(game, f.target); assert.equal(promise(game).fulfilled, true);
  assert.equal(player(game, f.target).spice, 3); assert.deepEqual(inventory(game), f.originalCards);
});

for (const permitted of [false, true]) void test(`native mixed personally priced early leader ${permitted ? 'Yes pays the real quote' : 'No rejects the real acceptance'}`, () => {
  const f = fixture({ advanced: true, window: 'waiting', bothDead: true });
  assert.equal(player(f.afterBattle, f.opponent).leaders.find(disc => disc.id === f.opponentLeader)!.dead, true);
  assert.equal(player(f.game, f.opponent).leaders.filter(disc => !disc.dead).length, 4);
  assert.equal(f.game.revivalOrder!.remaining[0], f.opponent);
  let game = act(f.game, f.opponent, { type: 'requestLeaderRevival', leader: f.opponentLeader });
  game = act(game, f.target, { type: 'quoteLeaderRevival', target: f.opponent, amount: 3 });
  const before = player(game, f.opponent).spice, payee = player(game, f.target).spice;
  game = declare(f, game).game;
  game = ask(game, f.asker, f.opponent, group('and', fact({ kind: 'spice', compare: 'gte', value: 3 }), leader(f.opponentLeader)));
  game = answer(game, f.opponent, permitted ? 'yes' : 'no');
  if (permitted) {
    const guide = viewGame(game, f.opponent).revivalExpressionPromiseGuide; assert.ok(guide);
    assert.equal(guide.action.type, 'acceptLeaderRevival'); assert.equal(guide.action.leaderRevivalPrice, 3);
    assert.equal(guide.action.revivalExpressionPromiseEvent, promise(game, f.opponent).event);
    rejected(game, f.opponent, { ...guide.action, leaderRevivalPrice: 2 });
    game = settle(act(game, f.opponent, guide.action));
    assert.equal(player(game, f.opponent).spice, before - 3); assert.equal(player(game, f.target).spice, payee + 3);
    assert.equal(player(game, f.opponent).leaderRevived, true); assert.equal(promise(game, f.opponent).fulfilled, true);
    assert.deepEqual(promise(game, f.opponent).progress.leaders, [f.opponentLeader]);
  } else {
    rejected(game, f.opponent, { type: 'acceptLeaderRevival', leaderRevivalPrice: 3 });
    assert.equal(player(game, f.opponent).spice, before);
    assert.equal(player(game, f.opponent).leaders.find(disc => disc.id === f.opponentLeader)!.dead, true);
  }
  assert.deepEqual(inventory(game), f.originalCards);
});

void test('all four minimal policies actually answer mixed Yes and perform exact native ordinary return guides', () => {
  const f = fixture(), asked = ask(declare(f).game, f.asker, f.target, f.mixed);
  for (const difficulty of DIFFICULTIES) {
    let game = structuredClone(asked);
    const answering = viewGame(game, f.target); answering.players.find(seat => seat.id === f.target)!.bot = difficulty;
    const answerAction = botActions(answering).find(action => action.type === 'truthAnswer'); assert.ok(answerAction, difficulty);
    assert.equal(answerAction.answer, 'yes', difficulty); assert.ok(answering.truthMixedRevivalAnswers?.includes('yes'));
    game = act(game, f.target, answerAction);
    for (let count = 0; count < 4 && !promise(game).fulfilled; count++) {
      const view = viewGame(game, f.target); view.players.find(seat => seat.id === f.target)!.bot = difficulty;
      const guide = view.revivalExpressionPromiseGuide; assert.ok(guide, difficulty);
      const action = botActions(view).find(action => action.revivalExpressionPromiseEvent === guide.action.revivalExpressionPromiseEvent);
      assert.ok(action, difficulty); assert.deepEqual(action, guide.action); game = settle(act(game, f.target, action));
    }
    assert.equal(promise(game).fulfilled, true, difficulty); assert.equal(player(game, f.target).spice, 3);
    assert.equal(player(game, f.target).tanks, 0); assert.equal(player(game, f.target).freeForcesRevived, 1);
    assert.deepEqual(promise(game).progress, { total: 1, normal: 1, elite: 0, leaders: [f.leader] });
    truthOnce(game, f.truth); assert.deepEqual(inventory(game), f.originalCards);
  }
});
