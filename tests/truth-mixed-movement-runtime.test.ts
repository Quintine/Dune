import assert from 'node:assert/strict';
import test from 'node:test';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { viewGame, type Action, type Game } from '../game/engine';
import { truthFactAnswer } from '../game/truthtrance';
import { truthKnowledgeOf } from '../game/truthtrance-knowledge';
import {
  actTruthMixedMovement as act, advanceTruthMixedMovement as advance,
  answerTruthMixedMovement as answer, askTruthMixedMovement as ask, bindTruthMixedMovement as bind,
  completeTruthMixedMovement as complete, createTruthMixedMovementFixture as fixture,
  declareTruthMixedMovement as declare, finishTruthMixedMovement as finish, settleTruthMixedMovement as settle,
  truthMixedMovementClean as clean, truthMixedMovementFact as fact, truthMixedMovementGroup as group,
  truthMixedMovementInventory as inventory, truthMixedMovementMove as move, truthMixedMovementPlayer as player,
  truthMixedMovementPromise as promise, type TruthMixedMovementExpression,
} from './fixture-truth-mixed-movement';

const maximum = (game: Game, territory: string) =>
  promise(game).progress.find(entry => entry.territory === territory)?.maximum ?? 0;
function rejected(game: Game, actor: string, action: Action) {
  const before = structuredClone(game); assert.throws(() => act(game, actor, action)); assert.deepEqual(game, before);
}
function physicalTruthOnce(game: Game, truth: string) {
  assert.equal(game.discard.filter(card => card.id === truth).length, 1);
}

for (const advanced of [false, true]) void test(`native ${advanced ? 'Advanced' : 'Basic'} mixed Hajr fact AND two moves freezes custody before real Hajr disposal`, () => {
  const f = fixture({ advanced }); assert.equal(f.setup.status, 'setup'); assert.equal(f.originalCards.length, 33);
  assert.equal(f.sourceActionCount, advanced ? 23 : 20); assert.equal(f.sourceActionCount, f.sourceActions.length);
  assert.deepEqual(f.game.expansions, []); assert.deepEqual(f.beforeStartingDeal.deck.slice(0, 2).map(card => card.id), f.deal);
  assert.equal(player(f.shipment.before, f.target).spice - player(f.shipment.after, f.target).spice, 2);
  assert.deepEqual(player(f.game, f.target).forces, { 'arrakeen:10': 10, 'polar_sink:0': 1 });
  assert.equal(truthFactAnswer(player(f.game, f.target), f.hajrFact), 'yes');
  const source = structuredClone(f.game); let game = bind(f).game; assert.deepEqual(f.game, source);
  assert.deepEqual(promise(game).mixed, f.mixed); assert.deepEqual(promise(game).progress, []);
  physicalTruthOnce(game, f.truth); rejected(game, f.target, { type: 'endMovement' });
  if (advanced) rejected(game, f.target, f.hajrAction!);
  game = settle(act(game, f.target, f.firstMove));
  assert.equal(maximum(game, 'imperial_basin'), 1); assert.equal(maximum(game, 'carthag'), 0);
  assert.ok(!promise(game).fulfilled && !promise(game).released);
  const guide = viewGame(game, f.target).movementExpressionPromiseGuide; assert.ok(guide);
  assert.equal(guide.action.type, 'card'); assert.equal(guide.action.card, f.hajr);
  const progress = structuredClone(promise(game).progress);
  game = settle(act(game, f.target, guide.action));
  assert.equal(truthFactAnswer(player(game, f.target), f.hajrFact), 'no');
  assert.equal(game.discard.filter(card => card.id === f.hajr).length, 1);
  assert.deepEqual(promise(game).progress, progress, 'Physical Hajr grants an allowance without moving a force');
  assert.ok(!promise(game).fulfilled, 'Discarding the formerly held Hajr cannot rewrite the frozen true fact');
  rejected(game, f.target, { type: 'endMovement' });
  game = settle(act(game, f.target, f.secondMove));
  assert.equal(promise(game).fulfilled, true); assert.equal(maximum(game, 'carthag'), 1);
  assert.equal(player(game, f.target).moved, 2); assert.equal(player(game, f.target).forces['arrakeen:10'], 8);
  game = finish(game, f.target); physicalTruthOnce(game, f.truth); assert.deepEqual(inventory(game), f.originalCards);
});

void test('native true held Hajr OR future move is immediate Yes with no residual movement binding', () => {
  const f = fixture(), mixed = group('or', fact(f.hajrFact), move()), declared = declare(f);
  const asked = ask(declared.game, f.asker, f.target, mixed);
  assert.deepEqual(viewGame(asked, f.target).truthMixedMovementAnswers, ['yes']);
  rejected(asked, f.target, { type: 'truthAnswer', answer: 'no' });
  let game = answer(asked, f.target, 'yes');
  assert.equal(promise(game).fulfilled, true); assert.deepEqual(promise(game).progress, []);
  assert.deepEqual(promise(game).mixed, mixed); assert.equal(game.movementExpressionPromises?.length ?? 0, 0);
  assert.equal(viewGame(game, f.target).movementExpressionPromiseGuide, null);
  physicalTruthOnce(game, f.truth); game = finish(game, f.target);
  assert.equal(player(game, f.target).moved, 0); assert.ok(player(game, f.target).hand.some(card => card.id === f.hajr));
  assert.deepEqual(inventory(game), f.originalCards);
});

void test('native false held projectile OR future movement Yes requires an actual qualifying ground group', () => {
  const f = fixture(), mixed = group('or', fact(f.projectileFact), move());
  assert.equal(truthFactAnswer(player(f.game, f.target), f.projectileFact), 'no');
  let game = bind(f, 'yes', mixed).game;
  assert.ok(!promise(game).fulfilled); assert.deepEqual(promise(game).progress, []);
  rejected(game, f.target, { type: 'endMovement' });
  game = settle(act(game, f.target, f.firstMove));
  assert.equal(promise(game).fulfilled, true); assert.equal(maximum(game, 'imperial_basin'), 1);
  assert.equal(player(game, f.target).forces['imperial_basin:9'], 1);
  assert.deepEqual(inventory(finish(game, f.target)), f.originalCards);
});

void test('native actual projectile makes false Hajr AND future movement immediate No and leaves either movement legal', () => {
  const f = fixture({ hajr: false }), mixed = group('and', fact(f.hajrFact), move()), declared = declare(f);
  assert.equal(player(f.game, f.target).hand.find(card => card.id === f.targetCard)?.kind, 'projectile');
  assert.equal(truthFactAnswer(player(f.game, f.target), f.hajrFact), 'no');
  const asked = ask(declared.game, f.asker, f.target, mixed);
  assert.deepEqual(viewGame(asked, f.target).truthMixedMovementAnswers, ['no']);
  rejected(asked, f.target, { type: 'truthAnswer', answer: 'yes' });
  const bound = answer(asked, f.target, 'no');
  assert.equal(promise(bound).fulfilled, true); assert.equal(bound.movementExpressionPromises?.length ?? 0, 0);
  for (const action of [f.firstMove, f.secondMove]) {
    const moved = settle(act(bound, f.target, action));
    assert.equal(player(moved, f.target).moved, 1); assert.equal(promise(moved).fulfilled, true);
    assert.deepEqual(promise(moved).progress, []); assert.deepEqual(inventory(finish(moved, f.target)), f.originalCards);
  }
  physicalTruthOnce(bound, f.truth);
});

void test('native true Hajr AND future movement No blocks its qualifying move until actual owner finish', () => {
  const f = fixture(); let game = bind(f, 'no', group('and', fact(f.hajrFact), move())).game;
  rejected(game, f.target, f.firstMove); assert.ok(!promise(game).fulfilled);
  game = settle(act(game, f.target, f.secondMove));
  assert.equal(player(game, f.target).forces['carthag:11'], 1); assert.deepEqual(promise(game).progress, []);
  assert.ok(!promise(game).fulfilled); game = finish(game, f.target);
  assert.equal(promise(game).fulfilled, true); assert.deepEqual(inventory(game), f.originalCards);
});

void test('native actual projectile fact cannot supply a missing second movement allowance for mixed AND Yes', () => {
  const f = fixture({ hajr: false }), mixed = group('and', fact(f.projectileFact), move(), move('carthag'));
  assert.equal(truthFactAnswer(player(f.game, f.target), f.projectileFact), 'yes');
  const asked = ask(declare(f).game, f.asker, f.target, mixed);
  assert.deepEqual(viewGame(asked, f.target).truthMixedMovementAnswers, ['no']);
  rejected(asked, f.target, { type: 'truthAnswer', answer: 'yes' });
  let game = answer(asked, f.target, 'no'); game = settle(act(game, f.target, f.firstMove));
  assert.equal(maximum(game, 'imperial_basin'), 1); assert.ok(!promise(game).fulfilled);
  game = finish(game, f.target); assert.equal(promise(game).fulfilled, true);
  assert.deepEqual(inventory(game), f.originalCards);
});

void test('native mixed future OR retains both actual destinations instead of selecting a residual branch in advance', () => {
  const f = fixture(), mixed = group('or', group('and', fact(f.hajrFact), move()), move('carthag'));
  const bound = bind(f, 'yes', mixed).game;
  for (const action of [f.firstMove, f.secondMove]) {
    const game = settle(act(bound, f.target, action));
    assert.equal(promise(game).fulfilled, true); assert.equal(maximum(game, String(action.territory)), 1);
    assert.deepEqual(inventory(finish(game, f.target)), f.originalCards);
  }
});

void test('native mixed thresholds retain maximum actual group rather than adding two smaller Hajr moves', () => {
  const f = fixture(), mixed = group('and', fact(f.hajrFact), move(), move('imperial_basin', 2));
  let game = bind(f, 'no', mixed).game;
  game = settle(act(game, f.target, f.firstMove)); game = settle(act(game, f.target, f.hajrAction!));
  game = settle(act(game, f.target, f.sameDestinationMove));
  assert.equal(player(game, f.target).forces['imperial_basin:9'], 2);
  assert.deepEqual(promise(game).progress, [{ territory: 'imperial_basin', maximum: 1 }]);
  assert.ok(!promise(game).fulfilled); game = finish(game, f.target);
  assert.equal(promise(game).fulfilled, true); assert.deepEqual(inventory(game), f.originalCards);
});

void test('native newly answered mixed movement excludes actual movement before the answer', () => {
  const f = fixture(); let game = settle(act(f.game, f.target, f.firstMove));
  game = bind(f, 'yes', group('and', fact(f.hajrFact), group('or', move(), move('carthag'))), game).game;
  assert.deepEqual(promise(game).progress, []); assert.ok(!promise(game).fulfilled);
  rejected(game, f.target, { type: 'endMovement' });
  const guide = viewGame(game, f.target).movementExpressionPromiseGuide; assert.ok(guide);
  assert.equal(guide.action.type, 'card'); assert.equal(guide.action.card, f.hajr);
  game = settle(act(game, f.target, guide.action)); game = settle(act(game, f.target, f.secondMove));
  assert.deepEqual(promise(game).progress, [{ territory: 'carthag', maximum: 1 }]);
  assert.equal(promise(game).fulfilled, true); assert.deepEqual(inventory(finish(game, f.target)), f.originalCards);
});

for (const answerValue of ['yes', 'no'] as const) void test(`native unknown non-Fremen forecast uses the conservative whole ${answerValue} movement constraint`, () => {
  const f = fixture(), p = player(f.game, f.target);
  assert.equal(p.faction, 'atreides'); assert.equal(truthKnowledgeOf(f.game, p).stormForecast, null);
  assert.equal(truthFactAnswer(p, f.forecastFact, truthKnowledgeOf(f.game, p)), 'unknown');
  const mixed = group(answerValue === 'yes' ? 'or' : 'and', fact(f.forecastFact), move());
  const asked = ask(declare(f).game, f.asker, f.target, mixed);
  assert.deepEqual(viewGame(asked, f.target).truthMixedMovementAnswers, [answerValue]);
  rejected(asked, f.target, { type: 'truthAnswer', answer: answerValue === 'yes' ? 'no' : 'yes' });
  let game = answer(asked, f.target, answerValue);
  assert.ok(!promise(game).fulfilled); assert.deepEqual(promise(game).progress, []);
  if (answerValue === 'yes') {
    rejected(game, f.target, { type: 'endMovement' }); game = settle(act(game, f.target, f.firstMove));
    assert.equal(promise(game).fulfilled, true); assert.equal(maximum(game, 'imperial_basin'), 1);
  } else rejected(game, f.target, f.firstMove);
  game = finish(game, f.target); assert.equal(promise(game).fulfilled, true);
  physicalTruthOnce(game, f.truth); assert.deepEqual(inventory(game), f.originalCards);
});

void test('native mixed projection retains only the owned raw question and aggregate while hiding frozen residual facts', () => {
  const f = fixture(), bound = bind(f), game = bound.game;
  for (const actor of [f.target, f.asker]) {
    const view = viewGame(game, actor);
    assert.ok(!('mixedMovementQuestions' in view)); assert.deepEqual(view.movementExpressionPromises, []);
    assert.deepEqual(view.truthHistory.at(-1)?.question, f.question);
    assert.equal(view.truthHistory.at(-1)?.answer, 'yes');
    if (actor === f.asker) {
      assert.deepEqual(view.mixedMovementPromises, []); assert.equal(view.movementExpressionPromiseGuide, null);
      assert.equal(view.truthMixedMovementAnswers, null);
    } else {
      const row = promise(game);
      const required = ['answer', 'asker', 'event', 'mixed', 'player', 'progress', 'turn'];
      const allowed = [...required, 'fulfilled', 'released'];
      assert.ok(required.every(key => Object.keys(row).includes(key)));
      assert.ok(Object.keys(row).every(key => allowed.includes(key)), 'The aggregate excludes every internal binding or frozen clause');
      assert.deepEqual(row.mixed, f.mixed); assert.deepEqual(row.progress, []);
      assert.equal(row.asker, f.asker); assert.equal(row.player, f.target); assert.equal(row.turn, game.turn);
      assert.ok(view.movementExpressionPromiseGuide?.action.movementExpressionPromiseEvent);
    }
  }
  assert.ok(game.movementExpressionPromises?.length, 'Only the internal game retains the native binding');
  const residual = game.movementExpressionPromises![0];
  assert.equal(residual.event, promise(game).event);
  assert.ok(!JSON.stringify(promise(game)).includes('"claim"'));
});

void test('native exact mixed movement guides keep ownership event and nested wire packets authoritative', () => {
  const f = fixture(), declared = declare(f);
  assert.ok(viewGame(declared.game, f.asker).truthMixedMovementTargets.includes(f.target));
  rejected(declared.game, f.target, f.questionAction);
  rejected(declared.game, f.asker, { type: 'truthAsk', question: { ...f.question, turn: f.game.turn + 1 } });
  const asked = ask(declared.game, f.asker, f.target, f.mixed);
  assert.equal(viewGame(asked, f.asker).truthMixedMovementAnswers, null);
  rejected(asked, f.asker, { type: 'truthAnswer', answer: 'yes' });
  let game = answer(asked, f.target, 'yes');
  const guide = viewGame(game, f.target).movementExpressionPromiseGuide; assert.ok(guide);
  assert.equal(guide.action.type, 'move'); assert.ok(guide.action.forces);
  assert.equal(guide.action.movementExpressionPromiseEvent, promise(game).event);
  rejected(game, f.asker, guide.action);
  rejected(game, f.target, { ...guide.action, movementExpressionPromiseEvent: 'stale-mixed-movement-event' });
  const wire: Action = JSON.parse(JSON.stringify(guide.action));
  const modified = structuredClone(wire), forces = modified.forces as Record<string, number>;
  const origin = Object.keys(forces)[0]; assert.ok(origin); forces[origin] += 1;
  rejected(game, f.target, modified);
  const event = promise(game).event; game = settle(act(game, f.target, wire));
  assert.equal(promise(game).event, event); assert.ok(promise(game).progress.length > 0);
  rejected(game, f.target, wire); game = complete(game, f.target); rejected(game, f.target, guide.action);
  assert.equal(promise(game).fulfilled, true); assert.deepEqual(inventory(finish(game, f.target)), f.originalCards);
});

void test('all four minimal policies answer the mixed question and follow the exact native Hajr movement guides', () => {
  const f = fixture(), asked = ask(declare(f).game, f.asker, f.target, f.mixed);
  for (const difficulty of DIFFICULTIES) {
    let game = structuredClone(asked);
    const answering = viewGame(game, f.target); answering.players.find(candidate => candidate.id === f.target)!.bot = difficulty;
    const answerAction = botActions(answering).find(action => action.type === 'truthAnswer'); assert.ok(answerAction, difficulty);
    assert.equal(answerAction.answer, 'yes', difficulty);
    assert.ok(answering.truthMixedMovementAnswers?.includes('yes'));
    game = act(game, f.target, answerAction);
    for (let count = 0; count < 8 && !promise(game).fulfilled; count++) {
      const view = viewGame(game, f.target); view.players.find(candidate => candidate.id === f.target)!.bot = difficulty;
      const guide = view.movementExpressionPromiseGuide; assert.ok(guide, difficulty);
      const action = botActions(view).find(action => action.movementExpressionPromiseEvent === guide.action.movementExpressionPromiseEvent);
      assert.ok(action, difficulty); assert.deepEqual(action, guide.action);
      game = settle(act(game, f.target, action));
    }
    assert.equal(promise(game).fulfilled, true, difficulty); physicalTruthOnce(game, f.truth);
    assert.equal(player(game, f.target).moved, 2); assert.equal(game.discard.filter(card => card.id === f.hajr).length, 1);
    assert.deepEqual(inventory(finish(game, f.target)), f.originalCards);
  }
});

void test('native Charity mixed promise follows original Bidding Revival paid shipment and actual ground movement', () => {
  const f = fixture({ window: 'charity' }); assert.equal(f.game.phase, 2); assert.equal(f.game.turn, 1);
  assert.equal(f.sourceActionCount, 13); assert.equal(f.sourceActionCount, f.sourceActions.length);
  assert.ok(f.sourceActionCount < f.sourceCounts.inheritedActive);
  const mixed: TruthMixedMovementExpression = group('and', fact(f.hajrFact), move(), move('carthag'));
  let game = bind(f, 'yes', mixed).game; assert.deepEqual(promise(game).progress, []);
  rejected(game, f.target, f.firstMove); rejected(game, f.target, f.hajrAction!);
  const actions: { actor: string; action: Action }[] = [];
  game = advance(game, state => state.phase === 5 && state.active === f.target && clean(state), actions);
  assert.ok(actions.some(step => step.action.type === 'passBid')); assert.ok(actions.some(step => step.action.type === 'ready'));
  assert.equal(player(game, f.target).shipped, false); assert.deepEqual(promise(game).progress, []);
  const before = player(game, f.target).spice;
  game = settle(act(game, f.target, f.shipmentStep.action, actions), actions);
  assert.equal(before - player(game, f.target).spice, 2); assert.equal(player(game, f.target).forces['polar_sink:0'], 1);
  assert.deepEqual(promise(game).progress, [], 'The real reserve shipment is not a ground move');
  game = complete(game, f.target, actions); assert.equal(promise(game).fulfilled, true);
  assert.equal(maximum(game, 'imperial_basin'), 1); assert.equal(maximum(game, 'carthag'), 1);
  assert.deepEqual(inventory(finish(game, f.target, actions)), f.originalCards);
});
