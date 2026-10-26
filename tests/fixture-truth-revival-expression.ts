import assert from 'node:assert/strict';
import { viewGame, type Action, type Game } from '../game/engine';
import { parseRevivalExpression, type RevivalExpression } from '../game/revival-expression-promises';
import {
  actTruthLeaderRevival, createTruthLeaderRevivalFixture, declareTruthLeaderRevival,
  nextTruthLeaderRevival, truthLeaderRevivalClean, truthLeaderRevivalInventory,
  truthLeaderRevivalPlayer, type TruthLeaderRevivalStep,
} from './fixture-truth-leader-revival';

export type TruthRevivalExpressionStep = TruthLeaderRevivalStep;
export const actTruthRevivalExpression = actTruthLeaderRevival;
export const truthRevivalExpressionClean = truthLeaderRevivalClean;
export const truthRevivalExpressionInventory = truthLeaderRevivalInventory;
export const truthRevivalExpressionPlayer = truthLeaderRevivalPlayer;

export function nextTruthRevivalExpression(game: Game): TruthRevivalExpressionStep | null {
  if (game.truthtrance) return null;
  for (const player of game.players) {
    const guide = viewGame(game, player.id).revivalExpressionPromiseGuide;
    if (guide?.phase === game.phase) return { actor: player.id, action: guide.action };
  }
  return nextTruthLeaderRevival(game);
}
export function advanceTruthRevivalExpression(game: Game, until: (state: Game) => boolean,
  actions: TruthRevivalExpressionStep[] = []): Game {
  for (let count = 0; count < 1600; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished');
    const step = nextTruthRevivalExpression(game); assert.ok(step, 'The original grouped Revival source needs a legal native step');
    game = actTruthRevivalExpression(game, step.actor, step.action, actions);
  }
  throw Error('The original grouped Revival source did not reach its finite boundary');
}
export function settleTruthRevivalExpression(game: Game, actions: TruthRevivalExpressionStep[] = []): Game {
  return advanceTruthRevivalExpression(game, truthRevivalExpressionClean, actions);
}
export function finishTruthRevivalExpression(game: Game, actions: TruthRevivalExpressionStep[] = []): Game {
  const turn = game.turn;
  return advanceTruthRevivalExpression(game,
    state => state.turn === turn && state.phase === 5 && truthRevivalExpressionClean(state), actions);
}

/** Thin source adapter: the complete public H/A/T Ix47 setup, original deals,
 * real paid shipment/projectile death and next Storm are inherited unchanged.
 * The question alone changes; no physical state or promise is installed. */
export function createTruthRevivalExpressionFixture(options: {
  advanced?: boolean; window?: 'active' | 'waiting'; ghola?: boolean; bothDead?: boolean;
  claim?: RevivalExpression;
} = {}) {
  const { claim: suppliedClaim, ...sourceOptions } = options;
  const base = createTruthLeaderRevivalFixture(sourceOptions);
  const claim = parseRevivalExpression(suppliedClaim ?? { kind: 'and', terms: [
    { kind: 'forces', counter: 'total', minimum: 1 }, { kind: 'leader', leader: base.leader },
  ] });
  const question = { kind: 'revivalExpression' as const, target: base.target, turn: base.game.turn, claim };
  return { ...base, base, claim, question, questionAction: { type: 'truthAsk', question } as Action,
    postStormSourceActions: structuredClone(base.sourceActions.slice(0, base.postStormActionCount)),
    phase3SourceActions: structuredClone(base.sourceActions.slice(0, base.phase3ActionCount)),
    sourceDisclosure: `${base.sourceDisclosure} This adapter inherits the exact original action prefix and changes only the grouped ordinary Revival question; its progress starts after the actual answer.` };
}
export type TruthRevivalExpressionFixture = ReturnType<typeof createTruthRevivalExpressionFixture>;
export function declareTruthRevivalExpression(f: TruthRevivalExpressionFixture, state = f.game,
  options: { copies?: 1 | 2 } = {}) {
  return declareTruthLeaderRevival(f.base, state, options);
}
export function askTruthRevivalExpression(game: Game, asker: string, target: string, claim: RevivalExpression,
  actions: TruthRevivalExpressionStep[] = []): Game {
  return actTruthRevivalExpression(game, asker, { type: 'truthAsk', question: {
    kind: 'revivalExpression', target, turn: game.turn, claim: parseRevivalExpression(claim),
  } }, actions);
}
export function answerTruthRevivalExpression(game: Game, target: string, answer: 'yes' | 'no',
  actions: TruthRevivalExpressionStep[] = []): Game {
  return actTruthRevivalExpression(game, target, { type: 'truthAnswer', answer }, actions);
}
export function bindTruthRevivalExpression(f: TruthRevivalExpressionFixture, answer: 'yes' | 'no' = 'yes',
  claim = f.claim, state = f.game) {
  const declared = declareTruthRevivalExpression(f, state), actions = [...declared.actions];
  const asked = askTruthRevivalExpression(declared.game, f.asker, f.target, claim, actions);
  const game = answerTruthRevivalExpression(asked, f.target, answer, actions);
  return { game, declared, asked, actions, actionCount: actions.length };
}
