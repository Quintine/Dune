import assert from 'node:assert/strict';
import { viewGame, type Action, type Game } from '../game/engine';
import type { AllianceExpression } from '../game/alliance-expression-promises';
import type { AllianceActionClaim } from '../game/mixed-alliance-question';
import type { MixedActionExpression } from '../game/mixed-action-question';
import type { TruthFact } from '../game/truthtrance';
import {
  actTruthAlliance, advanceTruthAlliance, answerTruthAlliance, closeTruthAllianceNexus,
  createTruthAllianceFixture, declareTruthAlliance, finishTruthAlliance, nextTruthAlliance,
  settleTruthAlliance, truthAllianceClean, truthAllianceInventory, truthAllianceNexus,
  truthAlliancePlayer, type TruthAllianceStep,
} from './fixture-truth-alliance';

export type TruthAllianceExpressionStep = TruthAllianceStep;
export type TruthMixedAllianceExpression = MixedActionExpression<AllianceActionClaim>;
export const actTruthAllianceExpression = actTruthAlliance;
export const advanceTruthAllianceExpression = advanceTruthAlliance;
export const answerTruthAllianceExpression = answerTruthAlliance;
export const closeTruthAllianceExpressionNexus = closeTruthAllianceNexus;
export const finishTruthAllianceExpression = finishTruthAlliance;
export const nextTruthAllianceExpression = nextTruthAlliance;
export const settleTruthAllianceExpression = settleTruthAlliance;
export const truthAllianceExpressionClean = truthAllianceClean;
export const truthAllianceExpressionInventory = truthAllianceInventory;
export const truthAllianceExpressionNexus = truthAllianceNexus;
export const truthAllianceExpressionPlayer = truthAlliancePlayer;
export const actTruthMixedAlliance = actTruthAlliance;
export const advanceTruthMixedAlliance = advanceTruthAlliance;
export const answerTruthMixedAlliance = answerTruthAlliance;
export const closeTruthMixedAllianceNexus = closeTruthAllianceNexus;
export const finishTruthMixedAlliance = finishTruthAlliance;
export const nextTruthMixedAlliance = nextTruthAlliance;
export const settleTruthMixedAlliance = settleTruthAlliance;
export const truthMixedAllianceClean = truthAllianceClean;
export const truthMixedAllianceInventory = truthAllianceInventory;
export const truthMixedAllianceNexus = truthAllianceNexus;
export const truthMixedAlliancePlayer = truthAlliancePlayer;

export const truthAllianceExpressionPartner = (partner: string): AllianceExpression => ({ kind: 'partner', partner });
export const truthAllianceExpressionGroup = (kind: 'and' | 'or', ...terms: AllianceExpression[]): AllianceExpression =>
  ({ kind, terms });
export const truthMixedAllianceFact = (fact: TruthFact): TruthMixedAllianceExpression => ({ kind: 'fact', fact });
export const truthMixedAlliancePartner = (partner: string): TruthMixedAllianceExpression =>
  ({ kind: 'action', action: { partner } });
export const truthMixedAllianceGroup = (kind: 'and' | 'or', ...terms: TruthMixedAllianceExpression[]): TruthMixedAllianceExpression =>
  ({ kind, terms });

type SourceOptions = Parameters<typeof createTruthAllianceFixture>[0] & { secondOffer?: boolean };

/** Thin original H/A/E base33 adapter. The optional second invitation is an
 * actual Harkonnen action after the original Worm and native Atreides offer.
 * No played hand, purse, offer, alliance, promise or answer-time fact is set. */
export function createTruthAllianceExpressionFixture(options: SourceOptions & { claim?: AllianceExpression } = {}) {
  const { claim: suppliedClaim, secondOffer = false, ...sourceOptions } = options;
  const base = createTruthAllianceFixture(sourceOptions);
  const actions = structuredClone(base.sourceActions);
  let game = base.game;
  let secondInvitation: { before: Game; steps: TruthAllianceStep[]; after: Game } | null = null;
  if (secondOffer) {
    const before = structuredClone(game), from = actions.length;
    game = actTruthAlliance(game, base.asker, { type: 'alliance', target: base.target }, actions);
    assert.equal(game.allianceOffers[base.asker], base.target);
    secondInvitation = { before, steps: structuredClone(actions.slice(from)), after: structuredClone(game) };
  }
  const claim = structuredClone(suppliedClaim ?? truthAllianceExpressionGroup('or',
    truthAllianceExpressionPartner(base.asker), truthAllianceExpressionPartner(base.opponent)));
  const question = { kind: 'allianceExpression' as const, target: base.target, turn: game.turn, claim };
  assert.deepEqual(truthAllianceInventory(game), base.originalCards);
  return { ...base, game, sourceGame: structuredClone(game), allianceSource: base, claim, question,
    questionAction: { type: 'truthAsk', question } satisfies Action,
    secondOffer, secondInvitation, actions, sourceActions: structuredClone(actions), sourceActionCount: actions.length,
    sourceCounts: { inherited: base.sourceActionCount, additionalInvitations: Number(secondOffer) },
    sourceDisclosure: `${base.sourceDisclosure} This adapter changes only the raw final-partner expression and, if requested, adds one real Harkonnen invitation. It installs no aggregate or compiled branch.` };
}
export type TruthAllianceExpressionFixture = ReturnType<typeof createTruthAllianceExpressionFixture>;

export function declareTruthAllianceExpression(f: TruthAllianceExpressionFixture, source = f.game,
  options: { copies?: 1 | 2 } = {}) {
  return declareTruthAlliance(f.allianceSource, source, options);
}
export function askTruthAllianceExpression(game: Game, asker: string, target: string, claim: AllianceExpression,
  actions: TruthAllianceStep[] = []): Game {
  return actTruthAlliance(game, asker, { type: 'truthAsk', question: {
    kind: 'allianceExpression', target, turn: game.turn, claim: structuredClone(claim),
  } }, actions);
}
export function bindTruthAllianceExpression(f: TruthAllianceExpressionFixture, answer: 'yes' | 'no' = 'yes',
  claim = f.claim, source = f.game) {
  const declared = declareTruthAllianceExpression(f, source), actions = [...declared.actions];
  const asked = askTruthAllianceExpression(declared.game, f.asker, f.target, claim, actions);
  const game = answerTruthAlliance(asked, f.target, answer, actions);
  return { game, declared, asked, actions, actionCount: actions.length };
}
export function truthAllianceExpressionPromise(game: Game,
  target = game.truthHistory?.at(-1)?.question.target ?? game.players[0].id) {
  const row = viewGame(game, target).allianceExpressionPromises.find(row => row.player === target);
  assert.ok(row, 'The respondent retains the original whole final-partner question and aggregate');
  return row;
}

export function createTruthMixedAllianceFixture(options: SourceOptions & { mixed?: TruthMixedAllianceExpression } = {}) {
  const { mixed: suppliedMixed, ...sourceOptions } = options;
  const base = createTruthAllianceExpressionFixture(sourceOptions);
  const shield = base.setup.deck.find(card => card.kind === 'shield');
  const hajr = base.setup.deck.find(card => card.effect === 'hajr');
  assert.ok(shield && hajr, 'Original unopened base33 supplies printed current-fact identities');
  const shieldFact: TruthFact = { kind: 'hand', name: shield.name };
  const hajrFact: TruthFact = { kind: 'hand', name: hajr.name };
  const spiceFact: TruthFact = { kind: 'spice', compare: 'gte', value: 10 };
  const forecastFact: TruthFact = { kind: 'stormForecast', compare: 'gte', value: 1 };
  const mixed = structuredClone(suppliedMixed ?? truthMixedAllianceGroup('and', truthMixedAllianceFact(spiceFact),
    truthMixedAllianceGroup('or', truthMixedAlliancePartner(base.asker), truthMixedAlliancePartner(base.opponent))));
  const question = { kind: 'mixedAlliance' as const, target: base.target, turn: base.game.turn, mixed };
  return { ...base, expressionSource: base, mixed, question, shieldFact, hajrFact, spiceFact, forecastFact,
    questionAction: { type: 'truthAsk', question } satisfies Action,
    sourceDisclosure: `${base.sourceDisclosure} Current facts and final actual partnership share one raw AND/OR question. Facts and residual clauses are never staged.` };
}
export type TruthMixedAllianceFixture = ReturnType<typeof createTruthMixedAllianceFixture>;

export function declareTruthMixedAlliance(f: TruthMixedAllianceFixture, source = f.game,
  options: { copies?: 1 | 2 } = {}) {
  return declareTruthAllianceExpression(f.expressionSource, source, options);
}
export function askTruthMixedAlliance(game: Game, asker: string, target: string, mixed: TruthMixedAllianceExpression,
  actions: TruthAllianceStep[] = []): Game {
  return actTruthAlliance(game, asker, { type: 'truthAsk', question: {
    kind: 'mixedAlliance', target, turn: game.turn, mixed: structuredClone(mixed),
  } }, actions);
}
export function bindTruthMixedAlliance(f: TruthMixedAllianceFixture, answer: 'yes' | 'no' = 'yes',
  mixed = f.mixed, source = f.game) {
  const declared = declareTruthMixedAlliance(f, source), actions = [...declared.actions];
  const asked = askTruthMixedAlliance(declared.game, f.asker, f.target, mixed, actions);
  const game = answerTruthAlliance(asked, f.target, answer, actions);
  return { game, declared, asked, actions, actionCount: actions.length };
}
export function truthMixedAlliancePromise(game: Game,
  target = game.truthHistory?.at(-1)?.question.target ?? game.players[0].id) {
  const row = viewGame(game, target).mixedAlliancePromises.find(row => row.player === target);
  assert.ok(row, 'The respondent retains the original mixed question and whole-answer aggregate');
  return row;
}
