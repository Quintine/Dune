import assert from 'node:assert/strict';
import { viewGame, type Game } from '../game/engine';
import { TERRITORIES } from '../game/board';
import type { ShipmentExpression } from '../game/shipment-promises';
import type { TruthQuestion } from '../game/truthtrance';
import {
  createTruthTraitorDecisionFixture,
  actTruthTraitorDecision,
  advanceTruthTraitorDecision,
  truthTraitorDecisionClean,
  truthTraitorDecisionInventory,
  truthTraitorDecisionPlayer,
  type TruthTraitorDecisionStep,
} from './fixture-truth-traitor-decision';

export type TruthShipmentExpressionStep = TruthTraitorDecisionStep;
export type TruthShipmentExpressionScenario = {
  id: string;
  expression: ShipmentExpression;
  answer: 'yes' | 'no';
};
export const actTruthShipmentExpression = actTruthTraitorDecision;
export const truthShipmentExpressionClean = truthTraitorDecisionClean;
export const truthShipmentExpressionInventory = truthTraitorDecisionInventory;
export const truthShipmentExpressionPlayer = truthTraitorDecisionPlayer;
const leaf = (territory = 'arrakeen', minimum = 1): ShipmentExpression => ({ territory, minimum });

/** The original one-force Arrakeen shipment determines every selected answer.
 * AND No retains true earlier clauses; OR Yes needs the final destination. */
export function truthShipmentExpressionScenario(
  op: 'and' | 'or' = 'and', count = 3, answer: 'yes' | 'no' = 'yes',
): TruthShipmentExpressionScenario {
  assert.ok(Number.isInteger(count) && count >= 3 && count <= 16);
  const alternatives = TERRITORIES.filter(place => place.id !== 'arrakeen');
  const terms = op === 'and'
    ? Array.from({ length: count }, (_, index) => leaf('arrakeen', answer === 'no' && index === count - 1 ? 2 : 1))
    : [...alternatives.slice(0, count - 1).map(place => leaf(place.id)), leaf('arrakeen', answer === 'yes' ? 1 : 2)];
  return { id: `${count}-${op}-${answer}`, expression: { op, terms }, answer };
}

export function truthShipmentExpressionNestedScenario(
  op: 'and' | 'or' = 'and', answer: 'yes' | 'no' = 'yes',
): TruthShipmentExpressionScenario {
  const decisive = leaf('arrakeen', answer === 'yes' ? 1 : 2);
  const expression: ShipmentExpression = op === 'and'
    ? { op, terms: [leaf(), { op: 'or', terms: [leaf('carthag'), leaf('sietch_tabr'), decisive] }, leaf()] }
    : { op, terms: [leaf('carthag'), { op: 'and', terms: [leaf(), leaf(), decisive] }, leaf('sietch_tabr')] };
  return { id: `nested-${op}-${answer}`, expression, answer };
}

export function truthShipmentExpressionDepthScenario(depth = 4): TruthShipmentExpressionScenario {
  let expression = leaf();
  for (let level = 0; level < depth; level++) expression = level % 2 === 0
    ? { op: 'and', terms: [leaf(), expression] }
    : { op: 'or', terms: [leaf('carthag'), expression] };
  return { id: `depth-${depth}`, expression, answer: 'yes' };
}

/** Reuse the genuine two-seat Basic source only through its beforeShipment
 * boundary. The prefix excludes that original shipment and every later battle
 * action. No postdeal hand, wallet, army, clock or promise is installed. */
export function createTruthShipmentExpressionFixture() {
  const base = createTruthTraitorDecisionFixture();
  const shipmentIndex = base.actions.findIndex(step => step.actor === base.shipmentStep.actor &&
    JSON.stringify(step.action) === JSON.stringify(base.shipmentStep.action));
  assert.ok(shipmentIndex >= 0);
  const actions = structuredClone(base.actions.slice(0, shipmentIndex));
  const game = structuredClone(base.beforeShipment);
  assert.equal(game.phase, 5); assert.equal(game.active, base.target);
  assert.ok(truthShipmentExpressionClean(game)); assert.equal(game.pendingShipment ?? null, null);
  assert.equal(truthShipmentExpressionPlayer(game, base.target).shipped, false);
  assert.equal(truthShipmentExpressionPlayer(game, base.target).reserves, 20);
  assert.ok(truthShipmentExpressionPlayer(game, base.asker).hand.some(card => card.id === base.card));
  assert.deepEqual(truthShipmentExpressionInventory(game), base.originalCards);
  const scenario = truthShipmentExpressionScenario();
  const question: Extract<TruthQuestion, { kind: 'shipment' }> = {
    kind: 'shipment', target: base.target, claim: scenario.expression,
  };
  const declarationStep: TruthShipmentExpressionStep = { actor: base.asker, action: { type: 'card', card: base.card } };
  const askStep: TruthShipmentExpressionStep = { actor: base.asker, action: { type: 'truthAsk', question } };
  const answerStep: TruthShipmentExpressionStep = { actor: base.target, action: { type: 'truthAnswer', answer: scenario.answer } };
  const continuationStep: TruthShipmentExpressionStep = { actor: base.target, action: { type: 'endMovement' } };
  return {
    game, source: structuredClone(game), base, beforeShipment: structuredClone(game),
    lobby: base.lobby, setup: base.setup, beforeStartingDeal: base.beforeStartingDeal,
    afterSetup: base.afterSetup, initial: base.initial, deal: base.deal, dealOrder: base.dealOrder,
    spiceOrder: base.spiceOrder, originalSpice: base.originalSpice, originalCards: base.originalCards,
    originalInventory: base.originalCards, asker: base.asker, target: base.target,
    card: base.card, truth: base.card, ordinary: base.ordinary, location: base.location,
    scenario, expression: scenario.expression, question, declarationStep, askStep, answerStep,
    shipmentStep: structuredClone(base.shipmentStep), continuationStep,
    actions, steps: actions, sourceActionCount: actions.length,
    sourceCounts: { shipment: shipmentIndex, completeBase: base.sourceActionCount },
    staging: [...base.staging.slice(0, 2),
      'Only the original action prefix through Emperor’s unused active reserve-shipment turn is retained. Atreides has genuinely ended Movement. Truthtrance declaration, priority, the full pure shipment question, answer, original paid one-force Arrakeen delivery and Emperor endMovement remain caller actions. No later source shipment or battle action is counted as prefix evidence.'],
  };
}
export type TruthShipmentExpressionFixture = ReturnType<typeof createTruthShipmentExpressionFixture>;

export function declareTruthShipmentExpression(fixture: TruthShipmentExpressionFixture) {
  const before = structuredClone(fixture.game), actions: TruthShipmentExpressionStep[] = [];
  const declaration = structuredClone(fixture.declarationStep);
  const game = actTruthShipmentExpression(before, declaration.actor, declaration.action, actions);
  assert.equal(game.truthtrance?.stage, 'priority');
  return { game, before, declaration, opened: structuredClone(game), actions };
}

export function passTruthShipmentExpressionPriority(game: Game, actions: TruthShipmentExpressionStep[] = []): Game {
  for (let count = 0; game.truthtrance?.stage === 'priority' && count < game.players.length; count++) {
    const actor = game.players.find(player => !game.truthtrance!.passed.includes(player.id)); assert.ok(actor);
    game = actTruthShipmentExpression(game, actor.id, { type: 'truthPass' }, actions);
  }
  assert.equal(game.truthtrance?.stage, 'ask');
  return game;
}

export function askTruthShipmentExpression(fixture: TruthShipmentExpressionFixture, expression = fixture.expression) {
  const declared = declareTruthShipmentExpression(fixture), actions = declared.actions;
  let game = passTruthShipmentExpressionPriority(declared.game, actions);
  const beforeQuestion = structuredClone(game);
  const question: TruthShipmentExpressionStep = { actor: fixture.asker, action: { type: 'truthAsk', question: {
    kind: 'shipment', target: fixture.target, claim: structuredClone(expression),
  } } };
  game = actTruthShipmentExpression(game, question.actor, question.action, actions);
  assert.equal(game.truthtrance?.stage, 'answer');
  return { ...declared, game, beforeQuestion, question, actions };
}

export function answerTruthShipmentExpression(game: Game, answer: 'yes' | 'no', actions: TruthShipmentExpressionStep[] = []) {
  const target = game.truthtrance?.question?.target; assert.ok(target);
  assert.ok(viewGame(game, target).truthShipmentAnswers!.includes(answer));
  return actTruthShipmentExpression(game, target, { type: 'truthAnswer', answer }, actions);
}

/** Settle original shipment responses only; actual delivery remains explicit. */
export function settleTruthShipmentExpression(game: Game, actions: TruthShipmentExpressionStep[] = []) {
  return advanceTruthTraitorDecision(game, state => truthShipmentExpressionClean(state) && !state.pendingShipment, actions);
}

export function finishTruthShipmentExpression(
  fixture: TruthShipmentExpressionFixture, scenario: TruthShipmentExpressionScenario = fixture.scenario,
) {
  const asked = askTruthShipmentExpression(fixture, scenario.expression), actions = asked.actions;
  let game = answerTruthShipmentExpression(asked.game, scenario.answer, actions);
  const answerStep = actions.at(-1)!, bound = structuredClone(game);
  const shipmentStep = structuredClone(fixture.shipmentStep);
  game = actTruthShipmentExpression(game, shipmentStep.actor, shipmentStep.action, actions);
  const declaredShipment = structuredClone(game);
  game = settleTruthShipmentExpression(game, actions);
  return { ...asked, asked: asked.game, game, answerStep, bound, shipmentStep, declaredShipment, actions };
}
