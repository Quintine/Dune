import assert from 'node:assert/strict';
import { viewGame, type Action, type Game } from '../game/engine';
import type { MixedActionExpression } from '../game/mixed-action-question';
import type { TruthFact } from '../game/truthtrance';
import {
  actTruthBribeExpression, advanceTruthBribeExpression, completeTruthBribeExpression,
  createTruthBribeExpressionFixture, declareTruthBribeExpression, finishTruthBribeExpression,
  nextTruthBribeExpression, settleTruthBribeExpression, truthBribeExpressionBalances,
  truthBribeExpressionClean, truthBribeExpressionDeferred, truthBribeExpressionInventory,
  truthBribeExpressionPlayer, type TruthBribeExpressionStep, type TruthBribeExpressionTransition,
} from './fixture-truth-bribe-expression';

export type TruthMixedBribeExpression = MixedActionExpression<{ recipient: string; minimum: number }>;
export type TruthMixedBribeStep = TruthBribeExpressionStep;
export type TruthMixedBribeTransition = TruthBribeExpressionTransition;
export const actTruthMixedBribe = actTruthBribeExpression;
export const advanceTruthMixedBribe = advanceTruthBribeExpression;
export const finishTruthMixedBribe = finishTruthBribeExpression;
export const nextTruthMixedBribe = nextTruthBribeExpression;
export const settleTruthMixedBribe = settleTruthBribeExpression;
export const truthMixedBribeBalances = truthBribeExpressionBalances;
export const truthMixedBribeClean = truthBribeExpressionClean;
export const truthMixedBribeDeferred = truthBribeExpressionDeferred;
export const truthMixedBribeInventory = truthBribeExpressionInventory;
export const truthMixedBribePlayer = truthBribeExpressionPlayer;

export const truthMixedBribeFact = (fact: TruthFact): TruthMixedBribeExpression => ({ kind: 'fact', fact });
export const truthMixedBribePayment = (recipient: string, minimum = 3): TruthMixedBribeExpression =>
  ({ kind: 'action', action: { recipient, minimum } });
export const truthMixedBribeGroup = (kind: 'and' | 'or', ...terms: TruthMixedBribeExpression[]): TruthMixedBribeExpression =>
  ({ kind, terms });

/** Original H/A/E base33 Basic20/Advanced23 prefix, or its actual Collection/
 * Mentat continuation. Only the raw question changes. E retains its original
 * Shield and ten spice; no played clock, purse, hand, answer or promise is set. */
export function createTruthMixedBribeFixture(options: {
  advanced?: boolean; window?: 'waiting' | 'active'; phase?: 3 | 7 | 8; mixed?: TruthMixedBribeExpression;
} = {}) {
  const base = createTruthBribeExpressionFixture(options);
  const shield = base.setup.deck.find(card => card.kind === 'shield');
  const hajr = base.setup.deck.find(card => card.effect === 'hajr');
  assert.ok(shield && hajr, 'The unopened base33 inventory supplies printed current-fact identities');
  const shieldFact: TruthFact = { kind: 'hand', name: shield.name };
  const hajrFact: TruthFact = { kind: 'hand', name: hajr.name };
  const spiceFact: TruthFact = { kind: 'spice', compare: 'gte', value: 10 };
  const forecastFact: TruthFact = { kind: 'stormForecast', compare: 'gte', value: 1 };
  const mixed = structuredClone(options.mixed ?? truthMixedBribeGroup('and', truthMixedBribeFact(spiceFact),
    truthMixedBribePayment(base.asker, 3), truthMixedBribePayment(base.opponent, 2)));
  const question = { kind: 'mixedBribe' as const, target: base.target, turn: base.game.turn, mixed };
  return { ...base, bribeSource: base, mixed, question, shieldFact, hajrFact, spiceFact, forecastFact,
    questionAction: { type: 'truthAsk', question } satisfies Action,
    sourceCounts: { inherited: base.sourceActionCount, basicBidding: 20, advancedBidding: 23,
      basicMentat: 32, advancedMentat: 35 },
    sourceDisclosure: `${base.sourceDisclosure} This thin mixed adapter changes only the original raw question: current facts and future ordinary cumulative payments share one AND/OR tree. No frozen answer, compiled residual, promise or progress is installed.` };
}
export type TruthMixedBribeFixture = ReturnType<typeof createTruthMixedBribeFixture>;

export function declareTruthMixedBribe(f: TruthMixedBribeFixture, source = f.game, options: { copies?: 1 | 2 } = {}) {
  return declareTruthBribeExpression(f.bribeSource, source, options);
}
export function askTruthMixedBribe(game: Game, asker: string, target: string, mixed: TruthMixedBribeExpression,
  actions: TruthMixedBribeStep[] = []): Game {
  return actTruthMixedBribe(game, asker, { type: 'truthAsk', question: {
    kind: 'mixedBribe', target, turn: game.turn, mixed: structuredClone(mixed),
  } }, actions);
}
export function answerTruthMixedBribe(game: Game, target: string, answer: 'yes' | 'no',
  actions: TruthMixedBribeStep[] = []): Game {
  return actTruthMixedBribe(game, target, { type: 'truthAnswer', answer }, actions);
}
export function bindTruthMixedBribe(f: TruthMixedBribeFixture, answer: 'yes' | 'no' = 'yes',
  mixed = f.mixed, source = f.game) {
  const declared = declareTruthMixedBribe(f, source), actions = [...declared.actions];
  const asked = askTruthMixedBribe(declared.game, f.asker, f.target, mixed, actions);
  const game = answerTruthMixedBribe(asked, f.target, answer, actions);
  return { game, declared, asked, actions, actionCount: actions.length };
}
export function completeTruthMixedBribe(f: TruthMixedBribeFixture, source = f.game) {
  return completeTruthBribeExpression(f.bribeSource, source);
}

/** The public original question and whole answer only. This accessor never
 * reads private frozen clauses or the internal native residual binding. */
export function truthMixedBribePromise(game: Game, target = game.truthHistory?.at(-1)?.question.target ?? game.players[0].id) {
  const row = viewGame(game, target).mixedBribePromises.find(row => row.player === target);
  assert.ok(row, 'The respondent retains the original mixed question and whole-answer status');
  return row;
}
