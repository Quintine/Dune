import assert from 'node:assert/strict';
import { viewGame, type Game } from '../game/engine';
import type { TruthAnswer, TruthFact, TruthQuestion } from '../game/truthtrance';
import {
  createTruthMovementEarlyFixture,
  actTruthMovementEarly,
  truthMovementEarlyClean,
  truthMovementEarlyPlayer,
  truthMovementEarlyInventory,
  type TruthMovementEarlyStep,
} from './fixture-truth-movement-early';

export type TruthFactExpressionStep = TruthMovementEarlyStep;
export type TruthFactExpressionScenario = {
  id: string;
  fact: TruthFact;
  answer: 'yes' | 'no';
};
export const actTruthFactExpression = actTruthMovementEarly;
export const truthFactExpressionClean = truthMovementEarlyClean;
export const truthFactExpressionPlayer = truthMovementEarlyPlayer;
export const truthFactExpressionInventory = truthMovementEarlyInventory;

/** These predicates describe the genuine Emperor starting position below.
 * Basic Emperor uses total physical forces; no elite split is invented. */
export function truthFactExpressionFacts(): { trueFacts: TruthFact[]; falseFacts: TruthFact[] } {
  return {
    trueFacts: [
      { kind: 'spice', compare: 'gte', value: 10 },
      { kind: 'handCount', name: 'Baliset', compare: 'gte', value: 1 },
      { kind: 'handCount', name: 'Shield', compare: 'eq', value: 0 },
      { kind: 'handInventory', category: 'all', compare: 'eq', value: 1 },
      { kind: 'forceCount', zone: { kind: 'reserves' }, counter: 'total', compare: 'eq', value: 20 },
      { kind: 'forceCount', zone: { kind: 'tanks' }, counter: 'total', compare: 'eq', value: 0 },
      { kind: 'forceCount', zone: { kind: 'location', territory: 'arrakeen', sector: 10 },
        counter: 'total', compare: 'eq', value: 0 },
      { kind: 'handInventory', category: 'worthless', compare: 'eq', value: 1 },
    ],
    falseFacts: [
      { kind: 'spice', compare: 'gte', value: 11 },
      { kind: 'handCount', name: 'Baliset', compare: 'gte', value: 2 },
      { kind: 'handCount', name: 'Shield', compare: 'gte', value: 1 },
      { kind: 'handInventory', category: 'all', compare: 'eq', value: 0 },
      { kind: 'forceCount', zone: { kind: 'reserves' }, counter: 'total', compare: 'gte', value: 21 },
      { kind: 'forceCount', zone: { kind: 'tanks' }, counter: 'total', compare: 'gte', value: 1 },
      { kind: 'forceCount', zone: { kind: 'location', territory: 'arrakeen', sector: 10 },
        counter: 'total', compare: 'gte', value: 1 },
      { kind: 'handInventory', category: 'weapon', compare: 'gte', value: 1 },
    ],
  };
}

/** Build three through eight clauses from original, independently known facts.
 * The decisive final clause also exercises evaluation beyond the old second row. */
export function truthFactExpressionScenario(
  kind: 'and' | 'or' = 'and',
  count = 3,
  answer: 'yes' | 'no' = 'yes',
): TruthFactExpressionScenario {
  assert.ok(Number.isInteger(count) && count >= 3 && count <= 8);
  const { trueFacts, falseFacts } = truthFactExpressionFacts();
  const terms = (kind === 'and' ? trueFacts : falseFacts).slice(0, count);
  if (kind === 'and' && answer === 'no') terms[count - 1] = falseFacts[count - 1];
  if (kind === 'or' && answer === 'yes') terms[count - 1] = trueFacts[count - 1];
  return { id: `${count}-${kind}-${answer}`, fact: { kind, terms }, answer };
}

export function truthFactExpressionNestedScenario(
  kind: 'and' | 'or' = 'and',
  answer: 'yes' | 'no' = 'yes',
): TruthFactExpressionScenario {
  const { trueFacts, falseFacts } = truthFactExpressionFacts();
  const fact: TruthFact = kind === 'and'
    ? { kind: 'and', terms: [trueFacts[0], { kind: 'or', terms: [falseFacts[0], falseFacts[1],
      answer === 'yes' ? trueFacts[2] : falseFacts[2]] }, trueFacts[3]] }
    : { kind: 'or', terms: [falseFacts[0], { kind: 'and', terms: [trueFacts[0], trueFacts[1],
      answer === 'yes' ? trueFacts[2] : falseFacts[2]] }, falseFacts[3]] };
  return { id: `nested-${kind}-${answer}`, fact, answer };
}

/** Original public Basic A/E/H/G setup, followed by its actual two zero Storm
 * dials and one Emperor Ready. No postdeal hand, wallet, army, phase, response,
 * question, answer or discard is installed. Only the inherited unopened deck
 * positions and original scalar lotteries are selected. */
export function createTruthFactExpressionFixture() {
  const base = createTruthMovementEarlyFixture({ phase: 0 });
  let game = structuredClone(base.game);
  const actions: TruthFactExpressionStep[] = structuredClone(base.actions);
  const beforeStormControls = structuredClone(game);
  assert.equal(game.stormPending, null);
  for (const actor of game.stormDialers)
    game = actTruthFactExpression(game, actor, { type: 'stormDial', amount: 0 }, actions);
  game = actTruthFactExpression(game, base.target, { type: 'ready' }, actions);
  assert.equal(game.status, 'playing'); assert.equal(game.advanced, false);
  assert.equal(game.turn, 1); assert.equal(game.phase, 0); assert.equal(game.stormPending, 0);
  assert.deepEqual(game.ready, [base.target]); assert.deepEqual(game.expansions, []);
  assert.equal(game.response ?? null, null); assert.ok(truthFactExpressionClean(game));
  const target = truthFactExpressionPlayer(game, base.target);
  assert.equal(target.spice, 10); assert.equal(target.reserves, 20); assert.equal(target.tanks, 0);
  assert.deepEqual(target.forces, {}); assert.deepEqual(target.hand.map(card => card.name), ['Baliset']);
  assert.ok(truthFactExpressionPlayer(game, base.asker).hand.some(card => card.id === base.card));
  assert.ok(truthFactExpressionPlayer(game, base.counterHolder).hand.some(card => card.id === base.karama));
  assert.equal(base.originalCards.length, 33);
  assert.deepEqual(truthFactExpressionInventory(game), base.originalCards);
  const scenario = truthFactExpressionScenario();
  const question: TruthQuestion = { kind: 'fact', target: base.target, fact: scenario.fact };
  const declarationStep: TruthFactExpressionStep = { actor: base.asker,
    action: { type: 'card', card: base.card } };
  const askStep: TruthFactExpressionStep = { actor: base.asker, action: { type: 'truthAsk', question } };
  const answerStep: TruthFactExpressionStep = { actor: base.target,
    action: { type: 'truthAnswer', answer: scenario.answer } };
  const continuationStep: TruthFactExpressionStep = { actor: base.asker, action: { type: 'ready' } };
  return {
    game, source: structuredClone(game), base, beforeStormControls,
    lobby: base.lobby, setup: base.setup, beforeStartingDeal: base.beforeStartingDeal,
    afterSetup: base.afterSetup, deal: base.deal, dealOrder: base.dealOrder,
    spiceOrder: base.spiceOrder, originalCards: base.originalCards, originalTreachery: base.originalTreachery,
    originalSpice: base.originalSpice, asker: base.asker, target: base.target,
    counterHolder: base.counterHolder, guild: base.guild, card: base.card, truth: base.card, karama: base.karama,
    scenario, fact: scenario.fact, question, declarationStep, askStep, answerStep, continuationStep,
    actions, sourceActionCount: actions.length,
    stormSteps: structuredClone(actions.slice(base.sourceActionCount)),
    sourceCounts: { setup: base.sourceActionCount, storm: actions.length },
    staging: [...base.staging,
      'The current-fact source additionally takes the two native zero Storm dials and Emperor Ready, retaining turn 1 Storm with that nonempty Ready list. Questions concern only Emperor’s original Baliset, ten spice, twenty total reserves, zero Tanks and empty Arrakis positions. Truthtrance declaration, every priority pass, authored question, aggregate answer, physical discard and later Atreides Ready remain caller actions.'],
  };
}
export type TruthFactExpressionFixture = ReturnType<typeof createTruthFactExpressionFixture>;

export function passTruthFactExpressionPriority(game: Game, actions: TruthFactExpressionStep[] = []): Game {
  for (let count = 0; game.truthtrance?.stage === 'priority' && count < game.players.length; count++) {
    const actor = game.players.find(player => !game.truthtrance!.passed.includes(player.id)); assert.ok(actor);
    game = actTruthFactExpression(game, actor.id, { type: 'truthPass' }, actions);
  }
  assert.equal(game.truthtrance?.stage, 'ask');
  return game;
}

export function declareTruthFactExpression(fixture: TruthFactExpressionFixture) {
  const before = structuredClone(fixture.game), actions: TruthFactExpressionStep[] = [];
  const declaration = structuredClone(fixture.declarationStep);
  const game = actTruthFactExpression(before, declaration.actor, declaration.action, actions);
  assert.equal(game.truthtrance?.stage, 'priority');
  return { game, before, declaration, opened: structuredClone(game), actions };
}

export function askTruthFactExpression(fixture: TruthFactExpressionFixture, fact: TruthFact = fixture.fact) {
  const declared = declareTruthFactExpression(fixture), actions = declared.actions;
  let game = passTruthFactExpressionPriority(declared.game, actions);
  const beforeQuestion = structuredClone(game);
  const question: TruthFactExpressionStep = { actor: fixture.asker,
    action: { type: 'truthAsk', question: { kind: 'fact', target: fixture.target, fact: structuredClone(fact) } } };
  game = actTruthFactExpression(game, question.actor, question.action, actions);
  assert.equal(game.truthtrance?.stage, 'answer');
  return { ...declared, game, beforeQuestion, question, actions };
}

export function answerTruthFactExpression(
  game: Game, answer: TruthAnswer, actions: TruthFactExpressionStep[] = [],
): Game {
  const target = game.truthtrance?.question?.target; assert.ok(target);
  assert.equal(viewGame(game, target).truthAnswer, answer);
  return actTruthFactExpression(game, target, { type: 'truthAnswer', answer }, actions);
}

export function finishTruthFactExpression(
  fixture: TruthFactExpressionFixture,
  scenario: TruthFactExpressionScenario = fixture.scenario,
) {
  const asked = askTruthFactExpression(fixture, scenario.fact), actions = asked.actions;
  const game = answerTruthFactExpression(asked.game, scenario.answer, actions);
  const answerStep = actions.at(-1)!;
  assert.ok(truthFactExpressionClean(game));
  return { ...asked, asked: asked.game, game, answerStep, actions };
}
