import assert from 'node:assert/strict';
import { viewGame, type Action, type Game } from '../game/engine';
import type { MixedActionExpression } from '../game/mixed-action-question';
import type { MovementClaim } from '../game/movement-promises';
import type { TruthFact } from '../game/truthtrance';
import {
  actTruthMovementExpression, advanceTruthMovementExpression, completeTruthMovementExpression,
  createTruthMovementExpressionFixture, declareTruthMovementExpression, finishTruthMovementExpression,
  nextTruthMovementExpression, settleTruthMovementExpression, truthMovementExpressionClean,
  truthMovementExpressionInventory, truthMovementExpressionPlayer, type TruthMovementExpressionStep,
} from './fixture-truth-movement-expression';

export type TruthMixedMovementExpression = MixedActionExpression<MovementClaim>;
export type TruthMixedMovementStep = TruthMovementExpressionStep;
export const actTruthMixedMovement = actTruthMovementExpression;
export const advanceTruthMixedMovement = advanceTruthMovementExpression;
export const completeTruthMixedMovement = completeTruthMovementExpression;
export const finishTruthMixedMovement = finishTruthMovementExpression;
export const nextTruthMixedMovement = nextTruthMovementExpression;
export const settleTruthMixedMovement = settleTruthMovementExpression;
export const truthMixedMovementClean = truthMovementExpressionClean;
export const truthMixedMovementInventory = truthMovementExpressionInventory;
export const truthMixedMovementPlayer = truthMovementExpressionPlayer;

export const truthMixedMovementFact = (fact: TruthFact): TruthMixedMovementExpression => ({ kind: 'fact', fact });
export const truthMixedMovementMove = (territory = 'imperial_basin', minimum = 1): TruthMixedMovementExpression =>
  ({ kind: 'action', action: { territory, minimum } });
export const truthMixedMovementGroup = (kind: 'and' | 'or', ...terms: TruthMixedMovementExpression[]): TruthMixedMovementExpression =>
  ({ kind, terms });

/** Thin raw-question adapter: original Basic20/Advanced23 base33 starts and
 * their Charity13 prefix retain every real deal, resource and native control. */
export function createTruthMixedMovementFixture(options: {
  advanced?: boolean; hajr?: boolean; window?: 'active' | 'charity'; mixed?: TruthMixedMovementExpression;
} = {}) {
  const base = createTruthMovementExpressionFixture(options);
  const hajr = base.setup.deck.find(card => card.effect === 'hajr');
  const projectile = base.setup.deck.find(card => card.kind === 'projectile');
  assert.ok(hajr && projectile, 'The unopened base33 component inventory supplies both printed fact identities');
  const hajrFact: TruthFact = { kind: 'hand', name: hajr.name };
  const projectileFact: TruthFact = { kind: 'hand', name: projectile.name };
  const forecastFact: TruthFact = { kind: 'stormForecast', compare: 'gte', value: 1 };
  const mixed = options.mixed ?? truthMixedMovementGroup('and', truthMixedMovementFact(hajrFact),
    truthMixedMovementMove(), truthMixedMovementMove('carthag'));
  const question = { kind: 'mixedMovement' as const, target: base.target, turn: base.game.turn, mixed };
  return { ...base, movementSource: base, mixed, question, hajrFact, projectileFact, forecastFact,
    questionAction: { type: 'truthAsk', question } satisfies Action,
    sourceDisclosure: `${base.sourceDisclosure} This mixed adapter changes only the original raw question: current facts and future physical ground moves share its AND/OR tree. No fact answer, compiled residual, promise, progress or additional card is installed.` };
}
export type TruthMixedMovementFixture = ReturnType<typeof createTruthMixedMovementFixture>;

export function declareTruthMixedMovement(f: TruthMixedMovementFixture, source = f.game) {
  return declareTruthMovementExpression(f.movementSource, source);
}
export function askTruthMixedMovement(game: Game, asker: string, target: string, mixed: TruthMixedMovementExpression,
  actions: TruthMixedMovementStep[] = []): Game {
  return actTruthMixedMovement(game, asker, { type: 'truthAsk', question: {
    kind: 'mixedMovement', target, turn: game.turn, mixed: structuredClone(mixed),
  } }, actions);
}
export function answerTruthMixedMovement(game: Game, target: string, answer: 'yes' | 'no',
  actions: TruthMixedMovementStep[] = []): Game {
  return actTruthMixedMovement(game, target, { type: 'truthAnswer', answer }, actions);
}
export function bindTruthMixedMovement(f: TruthMixedMovementFixture, answer: 'yes' | 'no' = 'yes',
  mixed = f.mixed, source = f.game) {
  const declared = declareTruthMixedMovement(f, source), actions = [...declared.actions];
  const asked = askTruthMixedMovement(declared.game, f.asker, f.target, mixed, actions);
  const game = answerTruthMixedMovement(asked, f.target, answer, actions);
  return { game, declared, asked, actions, actionCount: actions.length };
}

/** Public aggregate only: this accessor intentionally never reads the private
 * frozen facts or the internal residual movement-expression record. */
export function truthMixedMovementPromise(game: Game, target = game.players[0].id) {
  const row = viewGame(game, target).mixedMovementPromises.find(row => row.player === target);
  assert.ok(row, 'The respondent retains the raw mixed question and whole-answer status');
  return row;
}
