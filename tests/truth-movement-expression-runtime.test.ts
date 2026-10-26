import assert from 'node:assert/strict';
import test from 'node:test';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { viewGame, type Action, type Game } from '../game/engine';
import type { MovementExpression } from '../game/movement-expression-promises';
import { createTruthMovementAdvancedFixture } from './fixture-truth-movement-advanced';
import {
  actTruthMovementExpression as act, advanceTruthMovementExpression as advance,
  answerTruthMovementExpression as answer, askTruthMovementExpression as ask,
  bindTruthMovementExpression as bind, completeTruthMovementExpression as complete,
  createTruthMovementExpressionFixture as fixture, declareTruthMovementExpression as declare,
  finishTruthMovementExpression as finish, settleTruthMovementExpression as settle,
  truthMovementExpressionClean as clean, truthMovementExpressionInventory as inventory,
  truthMovementExpressionPlayer as player,
} from './fixture-truth-movement-expression';

const move = (territory = 'imperial_basin', minimum = 1): MovementExpression => ({ kind: 'move', territory, minimum });
const both = (): MovementExpression => ({ kind: 'and', terms: [move(), move('carthag')] });
const either = (): MovementExpression => ({ kind: 'or', terms: [move(), move('carthag')] });
const promise = (game: Game, target = 'atreides') => game.movementExpressionPromises!.find(row => row.player === target)!;
const maximum = (game: Game, territory: string, target = 'atreides') =>
  promise(game, target).progress.find(entry => entry.territory === territory)?.maximum ?? 0;
function rejected(game: Game, actor: string, action: Action) {
  const before = structuredClone(game); assert.throws(() => act(game, actor, action)); assert.deepEqual(game, before);
}

for (const advanced of [false, true]) void test(`native ${advanced ? 'Advanced' : 'Basic'} movement AND uses two actual groups and the original Hajr`, () => {
  const f = fixture({ advanced }); assert.equal(f.setup.status, 'setup'); assert.equal(f.originalCards.length, 33);
  assert.deepEqual(f.game.expansions, []); assert.equal(f.sourceActionCount, f.sourceActions.length);
  assert.deepEqual(f.beforeStartingDeal.deck.slice(0, 2).map(card => card.id), f.deal);
  assert.equal(player(f.shipment.before, f.target).spice - player(f.shipment.after, f.target).spice, 2);
  assert.deepEqual(player(f.game, f.target).forces, { 'arrakeen:10': 10, 'polar_sink:0': 1 });
  const source = structuredClone(f.game), bound = bind(f); assert.deepEqual(f.game, source);
  let game = bound.game; assert.deepEqual(promise(game).progress, []);
  rejected(game, f.target, { type: 'endMovement' });
  if (advanced) rejected(game, f.target, f.hajrAction!);
  game = settle(act(game, f.target, f.firstMove));
  assert.equal(player(game, f.target).moved, 1); assert.equal(maximum(game, 'imperial_basin'), 1);
  assert.equal(maximum(game, 'carthag'), 0); assert.ok(!promise(game).fulfilled && !promise(game).released);
  rejected(game, f.target, { type: 'endMovement' });
  const guide = viewGame(game, f.target).movementExpressionPromiseGuide; assert.ok(guide);
  assert.equal(guide.phase, 5); assert.equal(guide.action.type, 'card'); assert.equal(guide.action.card, f.hajr);
  const progress = structuredClone(promise(game).progress);
  game = settle(act(game, f.target, guide.action));
  assert.deepEqual(promise(game).progress, progress, 'An actual Hajr disposal grants movement without moving a force');
  assert.equal(game.discard.filter(card => card.id === f.hajr).length, 1);
  game = settle(act(game, f.target, f.secondMove));
  assert.equal(promise(game).fulfilled, true); assert.equal(maximum(game, 'carthag'), 1);
  assert.equal(player(game, f.target).forces['arrakeen:10'], 8);
  assert.equal(player(game, f.target).forces['imperial_basin:9'], 1);
  assert.equal(player(game, f.target).forces['carthag:11'], 1);
  assert.equal(player(game, f.target).moved, 2);
  game = finish(game, f.target); assert.equal(game.discard.filter(card => card.id === f.truth).length, 1);
  assert.deepEqual(inventory(game), f.originalCards);
});

void test('native movement OR Yes accepts the manually chosen alternate actual destination', () => {
  const f = fixture(); let game = bind(f, 'yes', either()).game;
  const guide = viewGame(game, f.target).movementExpressionPromiseGuide; assert.ok(guide);
  assert.equal(guide.action.type, 'move');
  const alternate = guide.action.territory === 'imperial_basin' ? f.secondMove : f.firstMove;
  assert.notEqual(alternate.territory, guide.action.territory);
  game = settle(act(game, f.target, alternate));
  assert.equal(promise(game).fulfilled, true); assert.equal(maximum(game, String(alternate.territory)), 1);
  assert.ok(player(game, f.target).hand.some(card => card.id === f.hajr));
  assert.deepEqual(inventory(finish(game, f.target)), f.originalCards);
});

for (const first of ['imperial_basin', 'carthag']) void test(`native movement AND No permits ${first} first and blocks only whole completion`, () => {
  const f = fixture(); let game = bind(f, 'no').game;
  const firstMove = first === 'imperial_basin' ? f.firstMove : f.secondMove;
  const secondMove = first === 'imperial_basin' ? f.secondMove : f.firstMove;
  game = settle(act(game, f.target, firstMove));
  assert.equal(maximum(game, first), 1); assert.ok(!promise(game).fulfilled);
  game = settle(act(game, f.target, f.hajrAction!)); rejected(game, f.target, secondMove);
  assert.equal(maximum(game, String(secondMove.territory)), 0);
  game = finish(game, f.target); assert.equal(promise(game).fulfilled, true);
  assert.deepEqual(inventory(game), f.originalCards);
});

void test('native movement OR No rejects either actual ground group until owner finish', () => {
  const f = fixture(); let game = bind(f, 'no', either()).game;
  rejected(game, f.target, f.firstMove); rejected(game, f.target, f.secondMove);
  assert.deepEqual(promise(game).progress, []); assert.ok(!promise(game).fulfilled);
  game = finish(game, f.target); assert.equal(promise(game).fulfilled, true);
  assert.equal(player(game, f.target).moved, 0); assert.deepEqual(inventory(game), f.originalCards);
});

void test('native repeated destination thresholds share the actual largest group and never sum two smaller Hajr moves', () => {
  const f = fixture(), claim: MovementExpression = { kind: 'and', terms: [move(), move('imperial_basin', 2)] };
  let game = bind(f, 'no', claim).game;
  game = settle(act(game, f.target, f.firstMove));
  assert.deepEqual(promise(game).progress, [{ territory: 'imperial_basin', maximum: 1 }]);
  game = settle(act(game, f.target, f.hajrAction!));
  game = settle(act(game, f.target, f.sameDestinationMove));
  assert.equal(player(game, f.target).forces['imperial_basin:9'], 2);
  assert.deepEqual(promise(game).progress, [{ territory: 'imperial_basin', maximum: 1 }]);
  assert.ok(!promise(game).fulfilled); game = finish(game, f.target);
  assert.equal(promise(game).fulfilled, true); assert.deepEqual(inventory(game), f.originalCards);
  let yes = bind(f, 'yes', claim).game;
  yes = settle(act(yes, f.target, { ...f.firstMove, amount: 2 }));
  assert.equal(promise(yes).fulfilled, true);
  assert.deepEqual(promise(yes).progress, [{ territory: 'imperial_basin', maximum: 2 }]);
  assert.ok(player(yes, f.target).hand.some(card => card.id === f.hajr));
  assert.deepEqual(inventory(finish(yes, f.target)), f.originalCards);
});

void test('native prior ground movement is excluded from a newly answered whole expression', () => {
  const f = fixture(); let game = settle(act(f.game, f.target, f.firstMove));
  assert.equal(player(game, f.target).moved, 1); assert.equal(player(game, f.target).forces['imperial_basin:9'], 1);
  game = bind(f, 'yes', either(), game).game;
  assert.deepEqual(promise(game).progress, []); assert.ok(!promise(game).fulfilled);
  rejected(game, f.target, { type: 'endMovement' });
  const guide = viewGame(game, f.target).movementExpressionPromiseGuide; assert.ok(guide);
  assert.equal(guide.action.type, 'card'); assert.equal(guide.action.card, f.hajr);
  game = settle(act(game, f.target, guide.action)); assert.deepEqual(promise(game).progress, []);
  game = settle(act(game, f.target, f.secondMove));
  assert.deepEqual(promise(game).progress, [{ territory: 'carthag', maximum: 1 }]);
  assert.equal(promise(game).fulfilled, true); assert.deepEqual(inventory(finish(game, f.target)), f.originalCards);
});

void test('native no-Hajr feasibility offers No for distinct-destination AND while OR retains either Yes route', () => {
  const f = fixture({ hajr: false }), declared = declare(f);
  let game = ask(declared.game, f.asker, f.target, both());
  assert.deepEqual(viewGame(game, f.target).truthMovementExpressionAnswers, ['no']);
  rejected(game, f.target, { type: 'truthAnswer', answer: 'yes' });
  game = answer(game, f.target, 'no'); game = settle(act(game, f.target, f.firstMove));
  assert.ok(!promise(game).fulfilled); assert.equal(promise(finish(game, f.target)).fulfilled, true);
  const orQuestion = ask(declared.game, f.asker, f.target, either());
  assert.deepEqual(viewGame(orQuestion, f.target).truthMovementExpressionAnswers, ['yes', 'no']);
  const yes = complete(answer(orQuestion, f.target, 'yes'), f.target);
  assert.equal(promise(yes).fulfilled, true); assert.deepEqual(inventory(finish(yes, f.target)), f.originalCards);
});

void test('native exact nested movement guide accepts wire objects and rejects stale foreign or modified packets', () => {
  const f = fixture(), declared = declare(f);
  assert.ok(viewGame(declared.game, f.asker).truthMovementExpressionTargets.includes(f.target));
  rejected(declared.game, f.target, f.questionAction);
  rejected(declared.game, f.asker, { type: 'truthAsk', question: { ...f.question, turn: f.game.turn + 1 } });
  const asked = ask(declared.game, f.asker, f.target, f.claim);
  assert.equal(viewGame(asked, f.asker).truthMovementExpressionAnswers, null);
  rejected(asked, f.asker, { type: 'truthAnswer', answer: 'yes' });
  let game = answer(asked, f.target, 'yes');
  const guide = viewGame(game, f.target).movementExpressionPromiseGuide; assert.ok(guide);
  assert.equal(guide.action.type, 'move'); assert.ok(guide.action.forces);
  assert.ok(guide.action.movementExpressionPromiseEvent);
  assert.deepEqual(viewGame(game, f.target).movementExpressionPromises, [promise(game)]);
  rejected(game, f.asker, guide.action);
  rejected(game, f.target, { ...guide.action, movementExpressionPromiseEvent: 'stale-whole-movement-event' });
  const wire: Action = JSON.parse(JSON.stringify(guide.action));
  const modified = structuredClone(wire), forces = modified.forces as Record<string, number>;
  const origin = Object.keys(forces)[0]; assert.ok(origin); forces[origin] += 1;
  rejected(game, f.target, modified);
  const event = promise(game).event; game = settle(act(game, f.target, wire));
  assert.equal(promise(game).event, event); assert.ok(promise(game).progress.length > 0);
  rejected(game, f.target, wire);
  game = complete(game, f.target); rejected(game, f.target, guide.action);
  assert.deepEqual(inventory(finish(game, f.target)), f.originalCards);
});

void test('all four minimal policies take the canonical native movement guide through real Hajr and complete AND', () => {
  const f = fixture(), bound = bind(f).game;
  for (const difficulty of DIFFICULTIES) {
    let game = structuredClone(bound);
    for (let count = 0; count < 8 && !promise(game).fulfilled; count++) {
      const view = viewGame(game, f.target); view.players.find(candidate => candidate.id === f.target)!.bot = difficulty;
      const guide = view.movementExpressionPromiseGuide; assert.ok(guide, difficulty);
      const action = botActions(view).find(action => action.movementExpressionPromiseEvent === guide.action.movementExpressionPromiseEvent);
      assert.ok(action, difficulty); assert.deepEqual(action, guide.action);
      game = settle(act(game, f.target, action));
    }
    assert.equal(promise(game).fulfilled, true, difficulty); assert.equal(player(game, f.target).moved, 2);
    assert.equal(game.discard.filter(card => card.id === f.hajr).length, 1);
    assert.deepEqual(inventory(finish(game, f.target)), f.originalCards);
  }
});

void test('native Charity whole movement promise follows actual Bidding Revival shipment and owner movement', () => {
  const f = fixture({ window: 'charity' }); assert.equal(f.game.phase, 2); assert.equal(f.game.turn, 1);
  assert.equal(f.sourceCount, f.sourceActions.length); assert.ok(f.afterSetupActionCount! < f.sourceCount);
  assert.ok(f.sourceActionCount < f.sourceCounts.inheritedActive);
  assert.equal(player(f.game, f.target).shipped, false); assert.equal(player(f.game, f.target).moved, 0);
  let game = bind(f).game; assert.deepEqual(promise(game).progress, []);
  rejected(game, f.target, f.firstMove); rejected(game, f.target, f.hajrAction!);
  const actions: { actor: string; action: Action }[] = [];
  game = advance(game, state => state.phase === 5 && state.active === f.target && clean(state), actions);
  assert.ok(actions.some(step => step.action.type === 'passBid'));
  assert.ok(actions.some(step => step.action.type === 'ready'));
  assert.deepEqual(promise(game).progress, []); assert.equal(player(game, f.target).shipped, false);
  game = settle(act(game, f.target, f.shipmentStep.action, actions), actions);
  assert.equal(player(game, f.target).forces['polar_sink:0'], 1);
  assert.deepEqual(promise(game).progress, [], 'The native reserve shipment contributes no ground-movement progress');
  game = complete(game, f.target, actions); assert.equal(promise(game).fulfilled, true);
  assert.equal(maximum(game, 'imperial_basin'), 1); assert.equal(maximum(game, 'carthag'), 1);
  assert.deepEqual(inventory(finish(game, f.target, actions)), f.originalCards);
});

void test('native original Advanced Fremen grouped progress waits for the actual range response and physical commitment', () => {
  const f = createTruthMovementAdvancedFixture({ targetFaction: 'fremen', hajr: false });
  assert.ok(f.twoStepMove && f.twoStepDestination);
  let game = act(f.game, f.asker, f.declaration);
  while (game.truthtrance?.stage === 'priority') {
    const actor = game.players.find(candidate => !game.truthtrance!.passed.includes(candidate.id)); assert.ok(actor);
    game = act(game, actor.id, { type: 'truthPass' });
  }
  const claim: MovementExpression = { kind: 'or', terms: [
    move(f.twoStepDestination), move(f.twoStepDestination, 2),
  ] };
  game = answer(ask(game, f.asker, f.target, claim), f.target, 'yes');
  const before = structuredClone(player(game, f.target));
  game = act(game, f.target, f.twoStepMove);
  assert.equal(game.response?.kind, 'fremenMovement');
  assert.deepEqual(promise(game, f.target).progress, []);
  assert.ok(!promise(game, f.target).fulfilled);
  assert.deepEqual(player(game, f.target).forces, before.forces);
  assert.deepEqual(player(game, f.target).elites, before.elites);
  game = settle(game);
  assert.deepEqual(promise(game, f.target).progress, [{ territory: f.twoStepDestination, maximum: 1 }]);
  assert.equal(promise(game, f.target).fulfilled, true);
  const destination = `${f.twoStepDestination}:${String(f.twoStepMove.sector)}`;
  assert.equal(player(game, f.target).forces[destination], 1);
  assert.equal(player(game, f.target).elites!.forces[destination], 1);
  assert.deepEqual(inventory(finish(game, f.target)), f.originalCards);
});
