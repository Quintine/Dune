import assert from 'node:assert/strict';
import { viewGame, type Action, type Game } from '../game/engine';
import type { MixedActionExpression } from '../game/mixed-action-question';
import type { RevivalExpressionLeaf } from '../game/revival-expression-promises';
import type { TruthFact } from '../game/truthtrance';
import {
  actTruthRevivalExpression, advanceTruthRevivalExpression, createTruthRevivalExpressionFixture,
  declareTruthRevivalExpression, finishTruthRevivalExpression, nextTruthRevivalExpression,
  settleTruthRevivalExpression, truthRevivalExpressionClean, truthRevivalExpressionInventory,
  truthRevivalExpressionPlayer, type TruthRevivalExpressionStep,
} from './fixture-truth-revival-expression';

export type TruthMixedRevivalExpression = MixedActionExpression<RevivalExpressionLeaf>;
export type TruthMixedRevivalStep = TruthRevivalExpressionStep;
export const actTruthMixedRevival = actTruthRevivalExpression;
export const advanceTruthMixedRevival = advanceTruthRevivalExpression;
export const finishTruthMixedRevival = finishTruthRevivalExpression;
export const nextTruthMixedRevival = nextTruthRevivalExpression;
export const settleTruthMixedRevival = settleTruthRevivalExpression;
export const truthMixedRevivalClean = truthRevivalExpressionClean;
export const truthMixedRevivalInventory = truthRevivalExpressionInventory;
export const truthMixedRevivalPlayer = truthRevivalExpressionPlayer;

export const truthMixedRevivalFact = (fact: TruthFact): TruthMixedRevivalExpression => ({ kind: 'fact', fact });
export const truthMixedRevivalForce = (minimum = 1, counter: 'total' | 'normal' | 'elite' = 'total'):
TruthMixedRevivalExpression => ({ kind: 'action', action: { kind: 'forces', counter, minimum } });
export const truthMixedRevivalLeader = (leader: string): TruthMixedRevivalExpression =>
  ({ kind: 'action', action: { kind: 'leader', leader } });
export const truthMixedRevivalGroup = (kind: 'and' | 'or', ...terms: TruthMixedRevivalExpression[]):
TruthMixedRevivalExpression => ({ kind, terms });

/** Original public H/A/T Ix47: the inherited paid shipment and actual projectile
 * kill reach T4, one tank counter and a cost2 personal early Hidar return. This
 * adapter changes only the raw question. It installs no played state or binding. */
export function createTruthMixedRevivalFixture(options: {
  advanced?: boolean; window?: 'active' | 'waiting'; ghola?: boolean; bothDead?: boolean;
  mixed?: TruthMixedRevivalExpression;
} = {}) {
  const { mixed: suppliedMixed, ...sourceOptions } = options;
  const base = createTruthRevivalExpressionFixture(sourceOptions);
  const spiceFact: TruthFact = { kind: 'spice', compare: 'gte', value: 4 };
  const falseSpiceFact: TruthFact = { kind: 'spice', compare: 'gte', value: 5 };
  const forecastFact: TruthFact = { kind: 'stormForecast', compare: 'gte', value: 1 };
  const mixed = structuredClone(suppliedMixed ?? truthMixedRevivalGroup('and', truthMixedRevivalFact(spiceFact),
    truthMixedRevivalForce(), truthMixedRevivalLeader(base.leader)));
  const question = { kind: 'mixedRevival' as const, target: base.target, turn: base.game.turn, mixed };
  return { ...base, revivalSource: base, mixed, question, spiceFact, falseSpiceFact, forecastFact,
    questionAction: { type: 'truthAsk', question } satisfies Action,
    sourceCounts: { inherited: base.sourceActions.length, postStorm: base.postStormSourceActions.length,
      phase3: base.phase3SourceActions.length },
    sourceDisclosure: `${base.sourceDisclosure} This thin mixed adapter changes only the original raw question: current facts and future ordinary typed force/named-leader returns share one AND/OR tree. It inherits every original action and freezes no fact or residual itself.` };
}
export type TruthMixedRevivalFixture = ReturnType<typeof createTruthMixedRevivalFixture>;

export function declareTruthMixedRevival(f: TruthMixedRevivalFixture, source = f.game,
  options: { copies?: 1 | 2 } = {}) {
  return declareTruthRevivalExpression(f.revivalSource, source, options);
}
export function askTruthMixedRevival(game: Game, asker: string, target: string, mixed: TruthMixedRevivalExpression,
  actions: TruthMixedRevivalStep[] = []): Game {
  return actTruthMixedRevival(game, asker, { type: 'truthAsk', question: {
    kind: 'mixedRevival', target, turn: game.turn, mixed: structuredClone(mixed),
  } }, actions);
}
export function answerTruthMixedRevival(game: Game, target: string, answer: 'yes' | 'no',
  actions: TruthMixedRevivalStep[] = []): Game {
  return actTruthMixedRevival(game, target, { type: 'truthAnswer', answer }, actions);
}
export function bindTruthMixedRevival(f: TruthMixedRevivalFixture, answer: 'yes' | 'no' = 'yes',
  mixed = f.mixed, source = f.game) {
  const declared = declareTruthMixedRevival(f, source), actions = [...declared.actions];
  const asked = askTruthMixedRevival(declared.game, f.asker, f.target, mixed, actions);
  const game = answerTruthMixedRevival(asked, f.target, answer, actions);
  return { game, declared, asked, actions, actionCount: actions.length };
}

/** Own public raw aggregate only; no private frozen clause or residual access. */
export function truthMixedRevivalPromise(game: Game,
  target = game.truthHistory?.at(-1)?.question.target ?? game.players[0].id) {
  const row = viewGame(game, target).mixedRevivalPromises.find(row => row.player === target);
  assert.ok(row, 'The respondent retains the original mixed question and whole-answer status');
  return row;
}
export function completeTruthMixedRevival(game: Game, target: string, actions: TruthMixedRevivalStep[] = []): Game {
  for (let count = 0; count < 4 && !truthMixedRevivalPromise(game, target).fulfilled; count++) {
    const guide = viewGame(game, target).revivalExpressionPromiseGuide;
    assert.ok(guide, 'The owned mixed Yes has an exact native ordinary return guide');
    assert.equal(guide.phase, game.phase);
    game = settleTruthMixedRevival(actTruthMixedRevival(game, target, guide.action, actions), actions);
  }
  assert.equal(truthMixedRevivalPromise(game, target).fulfilled, true);
  return game;
}
