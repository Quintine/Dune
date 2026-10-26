import assert from 'node:assert/strict';
import { viewGame, type Action, type Game } from '../game/engine';
import type { MixedActionExpression } from '../game/mixed-action-question';
import type { TruthFact, TruthQuestion } from '../game/truthtrance';
import { nextTruthBid, type TruthBidStep } from './fixture-truth-bid';
import { createTruthMixedAllianceFixture } from './fixture-truth-alliance-expression';
import { truthAllianceNexus } from './fixture-truth-alliance';
import {
  actTruthTurnAction, truthTurnActionInventory, truthTurnActionPlayer,
} from './fixture-truth-turn-action';
import type { TruthTurnPreparationLeaf } from './fixture-truth-turn-preparation';

export type TruthTurnAllianceLeaf = TruthTurnPreparationLeaf | { kind: 'alliance'; partner: string };
export type TruthTurnAllianceExpression = MixedActionExpression<TruthTurnAllianceLeaf>;
export type TruthTurnAllianceStep = TruthBidStep;
export const actTruthTurnAlliance = actTruthTurnAction;
export const truthTurnAllianceInventory = truthTurnActionInventory;
export const truthTurnAlliancePlayer = truthTurnActionPlayer;
export const truthTurnAllianceNexus = truthAllianceNexus;
export const truthTurnAllianceClean = (game: Game) => !game.truthtrance && !game.phaseOpening &&
  !game.response && !game.decision && !game.pendingTreacheryDiscard && !game.pendingShipment && !game.pendingRevival;
export const truthTurnAllianceFact = (fact: TruthFact): TruthTurnAllianceExpression => ({ kind: 'fact', fact });
export const truthTurnAlliancePartner = (partner: string): TruthTurnAllianceExpression =>
  ({ kind: 'action', action: { kind: 'alliance', partner } });
export const truthTurnAlliancePayment = (recipient: string, minimum = 2): TruthTurnAllianceExpression =>
  ({ kind: 'action', action: { kind: 'payment', recipient, minimum } });
export const truthTurnAllianceShip = (territory = 'polar_sink', minimum = 1): TruthTurnAllianceExpression =>
  ({ kind: 'action', action: { kind: 'ship', territory, minimum } });
export const truthTurnAllianceGroup = (kind: 'and' | 'or', ...terms: TruthTurnAllianceExpression[]): TruthTurnAllianceExpression =>
  ({ kind, terms });

/** Reuse the original H/A/E base33, two actual opening Truths, real first turn,
 * later Worm and native reciprocal invitation/acceptance. Only the raw question
 * changes; payment names the third seat so forming this pair leaves a legal
 * ordinary payment recipient. No played state or private progress is set. */
export function createTruthTurnAllianceFixture(options: {
  advanced?: boolean; consent?: 'none' | 'offered' | 'allied'; secondOffer?: boolean;
  mixed?: TruthTurnAllianceExpression;
} = {}) {
  const { mixed: suppliedMixed, ...sourceOptions } = options;
  const base = createTruthMixedAllianceFixture(sourceOptions), game = structuredClone(base.game);
  const asker = base.asker, target = base.target, partner = base.partner;
  const recipient = game.players.find(candidate => candidate.id !== target && candidate.id !== partner)!.id;
  const mixed = structuredClone(suppliedMixed ?? truthTurnAllianceGroup('and', truthTurnAlliancePartner(partner),
    truthTurnAlliancePayment(recipient), truthTurnAllianceShip()));
  const question = { kind: 'turnActions', target, turn: game.turn, mixed } satisfies TruthQuestion;
  const actions = structuredClone(base.sourceActions);
  const falseSpiceFact: TruthFact = { kind: 'spice', compare: 'gte', value: 11 };
  assert.ok(truthTurnAllianceNexus(game)); assert.equal(truthTurnAlliancePlayer(game, target).spice, 10);
  assert.ok(base.truths.every(truth => truthTurnAlliancePlayer(game, asker).hand.some(card => card.id === truth)));
  assert.equal(game.turnActionPromises?.length ?? 0, 0);
  assert.deepEqual(truthTurnAllianceInventory(game), base.originalCards);
  return {
    game, source: structuredClone(game), base, asker, target, partner, recipient,
    truths: structuredClone(base.truths), truth: base.truths[0], mixed, question,
    initial: base.initial, setup: base.setup, beforeStartingDeal: base.beforeStartingDeal, afterSetup: base.afterSetup,
    originalCards: base.originalCards, originalSpice: base.originalSpice, staging: base.staging,
    actions, sourceActions: actions, sourceActionCount: actions.length,
    sourceCounts: { inherited: base.sourceCounts.inherited, additionalInvitations: base.sourceCounts.additionalInvitations,
      selected: actions.length },
    spiceFact: base.spiceFact, falseSpiceFact, shieldFact: base.shieldFact, hajrFact: base.hajrFact,
    allianceAction: { type: 'alliance', target: partner } satisfies Action,
    breakAction: { type: 'alliance', target: null } satisfies Action,
    payment: { type: 'bribe', target: recipient, amount: 2 } satisfies Action,
    shipment: { type: 'ship', territory: 'polar_sink', sector: 0, amount: 1, elite: 0, allyPayment: 0 } satisfies Action,
    sourceDisclosure: `${base.sourceDisclosure} This adapter changes only the raw combined turn-action question. ` +
      'The native ordinary Nexus closing event alone freezes final membership. A proposal, temporary pair or own Ready is not that event. ' +
      'All source counts derive from original recorded arrays; no hand, card, cash, force, offer, alliance, clock, promise or receipt is installed.',
  };
}
export type TruthTurnAllianceFixture = ReturnType<typeof createTruthTurnAllianceFixture>;

export function declareTruthTurnAlliance(f: TruthTurnAllianceFixture, source = f.game, copy: 0 | 1 = 0,
  actions: TruthTurnAllianceStep[] = []) {
  const before = structuredClone(source), from = actions.length;
  let game = actTruthTurnAlliance(source, f.asker, { type: 'card', card: f.truths[copy] }, actions);
  while (game.truthtrance?.stage === 'priority') {
    const actor = game.players.find(candidate => !game.truthtrance!.passed.includes(candidate.id)); assert.ok(actor);
    game = actTruthTurnAlliance(game, actor.id, { type: 'truthPass' }, actions);
  }
  assert.equal(game.truthtrance?.stage, 'ask');
  return { game, before, actions, actionCount: actions.length - from };
}
export function askTruthTurnAlliance(game: Game, asker: string, target: string, mixed: TruthTurnAllianceExpression,
  actions: TruthTurnAllianceStep[] = []): Game {
  return actTruthTurnAlliance(game, asker, { type: 'truthAsk', question: {
    kind: 'turnActions', target, turn: game.turn, mixed: structuredClone(mixed),
  } }, actions);
}
export function answerTruthTurnAlliance(game: Game, target: string, answer: 'yes' | 'no' | 'unknown',
  actions: TruthTurnAllianceStep[] = []): Game {
  return actTruthTurnAlliance(game, target, { type: 'truthAnswer', answer }, actions);
}
export function bindTruthTurnAlliance(f: TruthTurnAllianceFixture, answer: 'yes' | 'no' = 'yes', mixed = f.mixed,
  source = f.game, copy: 0 | 1 = 0, actions: TruthTurnAllianceStep[] = []) {
  const from = actions.length, declared = declareTruthTurnAlliance(f, source, copy, actions);
  const asked = askTruthTurnAlliance(declared.game, f.asker, f.target, mixed, actions);
  const game = answerTruthTurnAlliance(asked, f.target, answer, actions);
  return { game, declared, asked, actions, actionCount: actions.length - from };
}
export function truthTurnAlliancePromise(game: Game, target = game.turnActionPromises?.[0]?.player ?? game.players[0].id) {
  const row = viewGame(game, target).turnActionPromises.find(candidate => candidate.player === target); assert.ok(row); return row;
}
export function nextTruthTurnAllianceNative(game: Game): TruthTurnAllianceStep | null {
  return nextTruthBid(game);
}
export function nextTruthTurnAlliance(game: Game): TruthTurnAllianceStep | null {
  if (game.truthtrance) return null;
  for (const player of game.players) {
    const guide = viewGame(game, player.id).turnActionGuide;
    if (guide) return { actor: player.id, action: guide.action };
  }
  return nextTruthTurnAllianceNative(game);
}
export function advanceTruthTurnAlliance(game: Game, until: (state: Game) => boolean,
  actions: TruthTurnAllianceStep[] = [], nativeOnly = false): Game {
  for (let count = 0; count < 1600; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The original alliance source ended before its requested native boundary');
    const next = nativeOnly ? nextTruthTurnAllianceNative(game) : nextTruthTurnAlliance(game);
    assert.ok(next, 'Supply the original Truthtrance question, answer or saved-card decision');
    game = actTruthTurnAlliance(game, next.actor, next.action, actions);
  }
  throw Error('The genuine combined alliance source did not reach its finite boundary');
}
export function settleTruthTurnAlliance(game: Game, actions: TruthTurnAllianceStep[] = []): Game {
  return advanceTruthTurnAlliance(game, truthTurnAllianceClean, actions);
}
export function closeTruthTurnAllianceNexus(game: Game, actions: TruthTurnAllianceStep[] = [], nativeOnly = false): Game {
  assert.ok(truthTurnAllianceNexus(game)); const turn = game.turn;
  return advanceTruthTurnAlliance(game, state => state.turn === turn && !state.nexus && truthTurnAllianceClean(state), actions, nativeOnly);
}
export function finishTruthTurnAlliance(game: Game, actions: TruthTurnAllianceStep[] = []): Game {
  const turn = game.turn;
  return advanceTruthTurnAlliance(game, state => state.turn === turn + 1 && state.phase === 0 && truthTurnAllianceClean(state), actions);
}
