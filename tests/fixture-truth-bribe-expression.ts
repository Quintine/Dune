import assert from 'node:assert/strict';
import type { Action, Game } from '../game/engine';
import { parseBribeExpression, type BribeExpression } from '../game/bribe-expression-promises';
import {
  actTruthBribe, advanceTruthBribe, answerTruthBribe, declareTruthBribe, finishTruthBribe,
  nextTruthBribe, settleTruthBribe, truthBribeBalances, truthBribeClean, truthBribeDeferred,
  truthBribeInventory, truthBribePlayer, createTruthBribeFixture,
  type TruthBribeStep, type TruthBribeTransition,
} from './fixture-truth-bribe';
import { createMentatBribeFixture } from './fixture-mentat-bribes';

export type TruthBribeExpressionStep = TruthBribeStep;
export type TruthBribeExpressionTransition = TruthBribeTransition;
export const actTruthBribeExpression = actTruthBribe;
export const nextTruthBribeExpression = nextTruthBribe;
export const advanceTruthBribeExpression = advanceTruthBribe;
export const settleTruthBribeExpression = settleTruthBribe;
export const finishTruthBribeExpression = finishTruthBribe;
export const truthBribeExpressionClean = truthBribeClean;
export const truthBribeExpressionPlayer = truthBribePlayer;
export const truthBribeExpressionInventory = truthBribeInventory;
export const truthBribeExpressionBalances = truthBribeBalances;
export const truthBribeExpressionDeferred = truthBribeDeferred;

/** The original public H/A/E base33 source supplies the exact unopened deals,
 * ordinary auctions and ten spendable Emperor spice. Phase7/8 follows its real
 * Collection/Mentat controls. Only the question changes: no played clock,
 * purse, hand, receipt, answer or promise is installed by this adapter. */
export function createTruthBribeExpressionFixture(options: {
  advanced?: boolean; window?: 'waiting' | 'active'; phase?: 3 | 7 | 8; claim?: BribeExpression;
} = {}) {
  const phase = options.phase ?? 3;
  const base = phase === 8 ? createMentatBribeFixture({ advanced: options.advanced }) :
    createTruthBribeFixture({ advanced: options.advanced, window: options.window, phase });
  const claim = parseBribeExpression(options.claim ?? { kind: 'and', terms: [
    { kind: 'payment', recipient: base.asker, minimum: 3 },
    { kind: 'payment', recipient: base.opponent, minimum: 2 },
  ] });
  const question = { kind: 'bribeExpression' as const, target: base.target, turn: base.game.turn, claim };
  return { ...base, base, phase, claim, question, questionAction: { type: 'truthAsk', question } as Action,
    sourceDisclosure: `${base.sourceDisclosure} This thin adapter changes only the grouped ordinary-payment question; each recipient starts at zero future payment progress after its real answer.` };
}
export type TruthBribeExpressionFixture = ReturnType<typeof createTruthBribeExpressionFixture>;
export function declareTruthBribeExpression(f: TruthBribeExpressionFixture, state = f.game,
  options: { copies?: 1 | 2 } = {}) {
  return declareTruthBribe(f, state, options);
}
export function askTruthBribeExpression(game: Game, asker: string, target: string, claim: BribeExpression,
  actions: TruthBribeExpressionStep[] = []): Game {
  return actTruthBribeExpression(game, asker, { type: 'truthAsk', question: {
    kind: 'bribeExpression', target, turn: game.turn, claim: parseBribeExpression(claim),
  } }, actions);
}
export const answerTruthBribeExpression = answerTruthBribe;
export function bindTruthBribeExpression(f: TruthBribeExpressionFixture, answer: 'yes' | 'no' = 'yes',
  claim = f.claim, state = f.game) {
  const declared = declareTruthBribeExpression(f, state), actions = [...declared.actions];
  const asked = askTruthBribeExpression(declared.game, f.asker, f.target, claim, actions);
  const game = answerTruthBribeExpression(asked, f.target, answer, actions);
  return { game, declared, asked, actions, actionCount: actions.length };
}

/** Preserve the actual opening boundary. A question asked after opening waits
 * through the next real Storm and Collection; an earlier payment is credited
 * at this turn's opening. The adapter never collects receipts itself. */
export function completeTruthBribeExpression(f: TruthBribeExpressionFixture, state = f.game) {
  let game = state; const turn = game.turn, late = game.phase === 8;
  const actions: TruthBribeExpressionStep[] = [];
  const transition = (until: (state: Game) => boolean): TruthBribeExpressionTransition => {
    const before = structuredClone(game), from = actions.length;
    game = advanceTruthBribeExpression(game, until, actions);
    return { before, steps: structuredClone(actions.slice(from)), after: structuredClone(game) };
  };
  const boundary = () => transition(state => state.turn === turn + 1 && state.phase === 0 && truthBribeExpressionClean(state));
  const nextTurnBefore = late ? boundary() : null;
  const openingTurn = turn + Number(late);
  const collection = transition(state => state.turn === openingTurn && state.phase === 7 && truthBribeExpressionClean(state));
  const mentat = transition(state => state.turn === openingTurn && state.phase === 8 && truthBribeExpressionClean(state));
  const nextTurn = nextTurnBefore ?? boundary();
  assert.deepEqual(truthBribeExpressionInventory(game), f.originalCards);
  return { game, collection, mentat, nextTurn, actions, actionCount: actions.length };
}
