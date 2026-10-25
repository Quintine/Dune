import assert from 'node:assert/strict';
import { viewGame, type Action, type Game } from '../game/engine';
import type { PlanClaim } from '../game/battle-promises';
import type { TruthAnswer, TruthQuestion } from '../game/truthtrance';
import {
  createTruthTraitorDecisionFixture,
  actTruthTraitorDecision,
  truthTraitorDecisionClean,
  truthTraitorDecisionPlayer,
  truthTraitorDecisionInventory,
  type TruthTraitorDecisionStep,
} from './fixture-truth-traitor-decision';

export type TruthPlanExpressionStep = TruthTraitorDecisionStep;
export type TruthPlanExpressionScenario = {
  id: string;
  claim: PlanClaim;
  answer: 'yes' | 'no';
  plan: Action;
  contradictingPlan: Action;
};
export const actTruthPlanExpression = actTruthTraitorDecision;
export const truthPlanExpressionClean = truthTraitorDecisionClean;
export const truthPlanExpressionPlayer = truthTraitorDecisionPlayer;
export const truthPlanExpressionInventory = truthTraitorDecisionInventory;

/** Stop at the genuine source's earned beforePlans boundary. The prefix omits
 * its last two actual seal actions, rather than installing a new battle. */
export function createTruthPlanExpressionFixture() {
  const base = createTruthTraitorDecisionFixture();
  assert.deepEqual(base.actions.slice(-base.planSteps.length), base.planSteps);
  const actions = structuredClone(base.actions.slice(0, -base.planSteps.length));
  const game = structuredClone(base.beforePlans);
  assert.equal(game.status, 'playing'); assert.equal(game.advanced, false);
  assert.equal(game.phase, 6); assert.equal(game.turn, 1); assert.deepEqual(game.expansions, []);
  assert.ok(game.battle && !game.battle.revealed && !Object.keys(game.battle.plans).length);
  assert.ok(truthPlanExpressionClean(game));
  const projectile = truthPlanExpressionPlayer(game, base.target).hand.find(card => card.id === base.ordinary);
  assert.ok(projectile && projectile.kind === 'projectile');
  assert.ok(truthPlanExpressionPlayer(game, base.asker).hand.some(card => card.id === base.card));
  assert.deepEqual(truthPlanExpressionInventory(game), base.originalCards);
  const claim: PlanClaim = { kind: 'and', terms: [
    { kind: 'dial', compare: 'eq', value: 0 },
    { kind: 'weapon', name: null },
    { kind: 'defense', name: null },
  ] };
  const question: Extract<TruthQuestion, { kind: 'battlePlan' }> = {
    kind: 'battlePlan', target: base.target, territory: base.territory, claim,
  };
  const declarationStep: TruthPlanExpressionStep = { actor: base.asker,
    action: { type: 'card', card: base.card } };
  const askStep: TruthPlanExpressionStep = { actor: base.asker, action: { type: 'truthAsk', question } };
  const answerStep: TruthPlanExpressionStep = { actor: base.target, action: { type: 'truthAnswer', answer: 'yes' } };
  const targetPlan = structuredClone(base.targetPlan);
  const ownPlan = structuredClone(base.ownPlan);
  const projectilePlan: Action = { ...targetPlan, weapon: projectile.id };
  return {
    game, source: structuredClone(game), beforePlans: structuredClone(game), base,
    initial: base.initial, lobby: base.lobby, setup: base.setup,
    beforeStartingDeal: base.beforeStartingDeal, afterSetup: base.afterSetup,
    beforeShipment: base.beforeShipment, shipment: base.shipment, beforeBattle: base.beforeBattle,
    beforePreparation: base.beforePreparation,
    asker: base.asker, target: base.target, card: base.card, truth: base.card,
    ordinary: base.ordinary, projectile, territory: base.territory, sector: base.sector, event: base.event,
    targetPlan, ownPlan, projectilePlan,
    targetPlanStep: { actor: base.target, action: targetPlan },
    ownPlanStep: { actor: base.asker, action: ownPlan },
    projectilePlanStep: { actor: base.target, action: projectilePlan },
    claim, question, declarationStep, askStep, answerStep,
    deal: base.deal, dealOrder: base.dealOrder, spiceOrder: base.spiceOrder,
    originalCards: base.originalCards, originalInventory: base.originalCards,
    originalTraitors: base.originalTraitors, originalSpice: base.originalSpice,
    actions, steps: actions, sourceActionCount: actions.length,
    sourceCounts: { beforePlans: actions.length, inheritedReveal: base.sourceActionCount },
    staging: [
      ...base.staging.slice(0, 2),
      'Use the inherited actual Storm, Spice Blow, Charity, Bidding, Revival, paid Emperor shipment and battle preparation actions. Stop at its earned beforePlans snapshot; the exposed action prefix omits precisely its two later seal actions. Neither private plan is installed.',
      'Atreides still holds its original Truthtrance and Emperor its original projectile. Declaration, priority, whole question, definite answer, one discard and the original zero-dial unarmed or actual projectile plan remain caller-owned actions.',
    ],
  };
}
export type TruthPlanExpressionFixture = ReturnType<typeof createTruthPlanExpressionFixture>;

/** Both original plans are feasible; their weapon slot changes the aggregate. */
export function truthPlanExpressionClaims(fixture: TruthPlanExpressionFixture): {
  closedTrue: PlanClaim[]; projectileFalse: PlanClaim[];
} {
  return {
    closedTrue: [
      { kind: 'dial', compare: 'eq', value: 0 },
      { kind: 'weapon', name: null },
      { kind: 'defense', name: null },
      { kind: 'support', compare: 'eq', value: 0 },
      { kind: 'leader', leader: fixture.base.leaders.emperor },
      { kind: 'kwisatz', use: false },
      { kind: 'dial', compare: 'lte', value: 1 },
      { kind: 'support', compare: 'lte', value: 0 },
    ],
    projectileFalse: [
      { kind: 'dial', compare: 'gte', value: 1 },
      { kind: 'weapon', name: null },
      { kind: 'leader', leader: null },
      { kind: 'kwisatz', use: true },
      { kind: 'support', compare: 'gte', value: 1 },
      { kind: 'dial', compare: 'eq', value: 1 },
      { kind: 'weapon', name: null },
      { kind: 'leader', leader: null },
    ],
  };
}

export function truthPlanExpressionScenario(fixture: TruthPlanExpressionFixture,
  kind: 'and' | 'or' = 'and', count = 3, answer: 'yes' | 'no' = 'yes',
): TruthPlanExpressionScenario {
  assert.ok(Number.isInteger(count) && count >= 3 && count <= 8);
  const { closedTrue, projectileFalse } = truthPlanExpressionClaims(fixture);
  return {
    id: `${count}-${kind}-${answer}`,
    claim: { kind, terms: (kind === 'and' ? closedTrue : projectileFalse).slice(0, count) }, answer,
    plan: structuredClone(answer === 'yes' ? fixture.targetPlan : fixture.projectilePlan),
    contradictingPlan: structuredClone(answer === 'yes' ? fixture.projectilePlan : fixture.targetPlan),
  };
}

export function truthPlanExpressionNestedScenario(fixture: TruthPlanExpressionFixture,
  kind: 'and' | 'or' = 'and', answer: 'yes' | 'no' = 'yes',
): TruthPlanExpressionScenario {
  const { closedTrue, projectileFalse } = truthPlanExpressionClaims(fixture);
  const claim: PlanClaim = kind === 'and'
    ? { kind: 'and', terms: [closedTrue[0], { kind: 'or', terms: [
      projectileFalse[0], projectileFalse[2], closedTrue[1],
    ] }, closedTrue[2]] }
    : { kind: 'or', terms: [projectileFalse[0], { kind: 'and', terms: closedTrue.slice(0, 3) }, projectileFalse[2]] };
  return { ...truthPlanExpressionScenario(fixture, kind, 3, answer), id: `nested-${kind}-${answer}`, claim };
}

export function passTruthPlanExpressionPriority(game: Game, actions: TruthPlanExpressionStep[] = []): Game {
  for (let count = 0; game.truthtrance?.stage === 'priority' && count < game.players.length; count++) {
    const actor = game.players.find(player => !game.truthtrance!.passed.includes(player.id)); assert.ok(actor);
    game = actTruthPlanExpression(game, actor.id, { type: 'truthPass' }, actions);
  }
  assert.equal(game.truthtrance?.stage, 'ask');
  return game;
}

export function declareTruthPlanExpression(fixture: TruthPlanExpressionFixture) {
  const before = structuredClone(fixture.game), actions: TruthPlanExpressionStep[] = [];
  const declaration = structuredClone(fixture.declarationStep);
  const game = actTruthPlanExpression(before, declaration.actor, declaration.action, actions);
  assert.equal(game.truthtrance?.stage, 'priority');
  return { game, before, declaration, opened: structuredClone(game), actions };
}

/** Raw native Ask source for SSR and actual edit/callback runtime proof. */
export function createTruthPlanExpressionAskSource(fixture: TruthPlanExpressionFixture) {
  const declared = declareTruthPlanExpression(fixture);
  const game = passTruthPlanExpressionPriority(declared.game, declared.actions);
  return { ...declared, game, beforeQuestion: structuredClone(game) };
}

export function askTruthPlanExpression(fixture: TruthPlanExpressionFixture, claim: PlanClaim = fixture.claim) {
  const source = createTruthPlanExpressionAskSource(fixture), actions = source.actions;
  const question: TruthPlanExpressionStep = { actor: fixture.asker, action: { type: 'truthAsk', question: {
    kind: 'battlePlan', target: fixture.target, territory: fixture.territory, claim: structuredClone(claim),
  } } };
  const game = actTruthPlanExpression(source.game, question.actor, question.action, actions);
  assert.equal(game.truthtrance?.stage, 'answer');
  return { ...source, game, question, actions };
}

export function answerTruthPlanExpression(game: Game, answer: TruthAnswer,
  actions: TruthPlanExpressionStep[] = []): Game {
  const target = game.truthtrance?.question?.target; assert.ok(target);
  assert.ok(viewGame(game, target).truthBattleAnswers?.includes(answer));
  return actTruthPlanExpression(game, target, { type: 'truthAnswer', answer }, actions);
}

export function sealTruthPlanExpression(game: Game, fixture: TruthPlanExpressionFixture,
  plan: Action = fixture.targetPlan, actions: TruthPlanExpressionStep[] = []) {
  game = actTruthPlanExpression(game, fixture.target, plan, actions);
  const afterTargetPlan = structuredClone(game);
  game = actTruthPlanExpression(game, fixture.asker, fixture.ownPlan, actions);
  assert.ok(game.battle?.revealed);
  return { game, afterTargetPlan, actions };
}

export function finishTruthPlanExpression(fixture: TruthPlanExpressionFixture,
  scenario: TruthPlanExpressionScenario = truthPlanExpressionScenario(fixture)) {
  const asked = askTruthPlanExpression(fixture, scenario.claim), actions = asked.actions;
  const answered = answerTruthPlanExpression(asked.game, scenario.answer, actions);
  assert.ok(truthPlanExpressionClean(answered));
  const sealed = sealTruthPlanExpression(answered, fixture, scenario.plan, actions);
  return { ...asked, asked: asked.game, answered, ...sealed, scenario };
}
