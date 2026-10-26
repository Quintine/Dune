import assert from 'node:assert/strict';
import { viewGame, type Action, type Game } from '../game/engine';
import type { MixedActionExpression } from '../game/mixed-action-question';
import type { RevivalExpressionLeaf } from '../game/revival-expression-promises';
import type { TruthFact, TruthQuestion } from '../game/truthtrance';
import {
  actTruthBid, createTruthBidFixture, nextTruthBid, truthBidClean, truthBidInventory, truthBidPlayer,
  type TruthBidStep,
} from './fixture-truth-bid';
import { createTruthMixedRevivalFixture, nextTruthMixedRevival } from './fixture-truth-mixed-revival';
import { createTruthRevivalEarlyFixture, reachTruthRevivalEarlyOpportunity } from './fixture-truth-revival-early';
import type { TruthTurnActionClaim } from './fixture-truth-turn-action';

export type TruthTurnPreparationLeaf = TruthTurnActionClaim | { kind: 'bid'; lot: number; minimum: number }
  | RevivalExpressionLeaf;
export type TruthTurnPreparationExpression = MixedActionExpression<TruthTurnPreparationLeaf>;
export type TruthTurnPreparationStep = TruthBidStep;
export const actTruthTurnPreparation = actTruthBid;
export const truthTurnPreparationInventory = truthBidInventory;
export const truthTurnPreparationPlayer = truthBidPlayer;
export const truthTurnPreparationClean = (game: Game) => truthBidClean(game) && !game.pendingShipment && !game.pendingRevival;
export const truthTurnPreparationFact = (fact: TruthFact): TruthTurnPreparationExpression => ({ kind: 'fact', fact });
export const truthTurnPreparationBid = (lot = 1, minimum = 3): TruthTurnPreparationExpression =>
  ({ kind: 'action', action: { kind: 'bid', lot, minimum } });
export const truthTurnPreparationForce = (minimum = 2, counter: 'total' | 'normal' | 'elite' = 'total'):
TruthTurnPreparationExpression => ({ kind: 'action', action: { kind: 'forces', counter, minimum } });
export const truthTurnPreparationLeader = (leader: string): TruthTurnPreparationExpression =>
  ({ kind: 'action', action: { kind: 'leader', leader } });
export const truthTurnPreparationPayment = (recipient: string, minimum = 2): TruthTurnPreparationExpression =>
  ({ kind: 'action', action: { kind: 'payment', recipient, minimum } });
export const truthTurnPreparationShip = (territory = 'polar_sink', minimum = 1): TruthTurnPreparationExpression =>
  ({ kind: 'action', action: { kind: 'ship', territory, minimum } });
export const truthTurnPreparationGroup = (kind: 'and' | 'or', ...terms: TruthTurnPreparationExpression[]):
TruthTurnPreparationExpression => ({ kind, terms });

/** Existing genuinely dealt two-Truth sources only. The bid adapter adds a
 * real Harkonnen bid and Atreides pass so the Emperor can declare while a real
 * opposing bidder still owns the next turn. Force casualties and Hidar's death
 * remain the source's actual shipment/Storm and original projectile history. */
export function createTruthTurnPreparationFixture(options: {
  source?: 'bid' | 'forces' | 'leader'; advanced?: boolean; mixed?: TruthTurnPreparationExpression;
  beforeRevival?: boolean; targetKarama?: boolean;
} = {}) {
  const sourceKind = options.source ?? 'bid';
  const bidSource = sourceKind === 'bid' ? createTruthBidFixture({ window: 'waiting', advanced: options.advanced, targetKarama: options.targetKarama }) : null;
  const forceSource = sourceKind === 'forces' ? createTruthRevivalEarlyFixture({ phase: 3, advanced: options.advanced, targetKarama: options.targetKarama }) : null;
  const leaderSource = sourceKind === 'leader' ? createTruthMixedRevivalFixture({ advanced: options.advanced }) : null;
  const original = bidSource ?? forceSource ?? leaderSource!;
  const actions = structuredClone(original.sourceActions), inheritedCount = actions.length;
  let game = structuredClone(original.game);
  if (bidSource) {
    game = actTruthTurnPreparation(game, bidSource.asker, { type: 'bid', amount: 1, allyPayment: 0 }, actions);
    game = actTruthTurnPreparation(game, bidSource.opponent, { type: 'passBid' }, actions);
    assert.equal(game.auction?.active, bidSource.target); assert.ok(!game.auction?.passed.includes(bidSource.asker));
  }
  if (forceSource && !options.beforeRevival) game = reachTruthRevivalEarlyOpportunity(game, forceSource.target, actions);
  const asker = original.asker, target = original.target, recipient = asker;
  const observer = game.players.find(candidate => candidate.id !== asker && candidate.id !== target)!.id;
  const truths = structuredClone(original.truths), lot = game.auction ? game.auction.index + 1 : null;
  const mixed = structuredClone(options.mixed ?? (bidSource
    ? truthTurnPreparationGroup('and', truthTurnPreparationBid(lot!), truthTurnPreparationPayment(recipient), truthTurnPreparationShip())
    : forceSource ? truthTurnPreparationGroup('and', truthTurnPreparationForce(), truthTurnPreparationPayment(recipient))
      : truthTurnPreparationGroup('and', truthTurnPreparationLeader(leaderSource!.leader), truthTurnPreparationPayment(recipient))));
  const question = { kind: 'turnActions', target, turn: game.turn, mixed } satisfies TruthQuestion;
  assert.ok(truthTurnPreparationClean(game)); assert.equal(game.turnActionPromises?.length ?? 0, 0);
  assert.ok(truths.every(truth => truthBidPlayer(game, asker).hand.some(card => card.id === truth)));
  assert.deepEqual(truthBidInventory(game), original.originalCards);
  return {
    game, source: structuredClone(game), sourceKind, bidSource, forceSource, leaderSource,
    asker, target, recipient, observer, truths, truth: truths[0], lot, mixed, question,
    setup: original.setup, afterSetup: original.afterSetup, beforeStartingDeal: original.beforeStartingDeal,
    originalCards: original.originalCards, originalSpice: original.originalSpice,
    actions, sourceActions: actions, sourceActionCount: actions.length,
    sourceCounts: { inherited: inheritedCount, nativeContinuation: actions.length - inheritedCount, selected: actions.length },
    bid: { type: 'bid', amount: 3, allyPayment: 0 } satisfies Action,
    payment: { type: 'bribe', target: recipient, amount: 2 } satisfies Action,
    shipment: { type: 'ship', territory: 'polar_sink', sector: 0, amount: 1, elite: 0, allyPayment: 0 } satisfies Action,
    forceAction: { type: 'revive', amount: 1, elite: 0 } satisfies Action,
    leader: leaderSource?.leader ?? null,
    leaderAction: leaderSource ? structuredClone(leaderSource.revivalAction) : null,
    sourceDisclosure: `${original.sourceDisclosure} This adapter retains only native recorded continuations and changes the raw question. ` +
      'Bid maxima describe actual future declarations in this original ordinary lot, and Revival counts describe actual ordinary future returns. ' +
      'No played hand, card, cash, force, death, clock, promise, frozen fact or event progress is installed.',
  };
}
export type TruthTurnPreparationFixture = ReturnType<typeof createTruthTurnPreparationFixture>;

export function declareTruthTurnPreparation(f: TruthTurnPreparationFixture, source = f.game, copy: 0 | 1 = 0,
  actions: TruthTurnPreparationStep[] = []) {
  const before = structuredClone(source), from = actions.length;
  let game = actTruthTurnPreparation(source, f.asker, { type: 'card', card: f.truths[copy] }, actions);
  while (game.truthtrance?.stage === 'priority') {
    const actor = game.players.find(candidate => !game.truthtrance!.passed.includes(candidate.id)); assert.ok(actor);
    game = actTruthTurnPreparation(game, actor.id, { type: 'truthPass' }, actions);
  }
  assert.equal(game.truthtrance?.stage, 'ask');
  return { game, before, actions, actionCount: actions.length - from };
}
export function askTruthTurnPreparation(game: Game, asker: string, target: string, mixed: TruthTurnPreparationExpression,
  actions: TruthTurnPreparationStep[] = []): Game {
  return actTruthTurnPreparation(game, asker, { type: 'truthAsk', question: {
    kind: 'turnActions', target, turn: game.turn, mixed: structuredClone(mixed),
  } }, actions);
}
export function answerTruthTurnPreparation(game: Game, target: string, answer: 'yes' | 'no',
  actions: TruthTurnPreparationStep[] = []): Game {
  return actTruthTurnPreparation(game, target, { type: 'truthAnswer', answer }, actions);
}
export function bindTruthTurnPreparation(f: TruthTurnPreparationFixture, answer: 'yes' | 'no' = 'yes', mixed = f.mixed,
  source = f.game, copy: 0 | 1 = 0, actions: TruthTurnPreparationStep[] = []) {
  const from = actions.length, declared = declareTruthTurnPreparation(f, source, copy, actions);
  const asked = askTruthTurnPreparation(declared.game, f.asker, f.target, mixed, actions);
  const game = answerTruthTurnPreparation(asked, f.target, answer, actions);
  return { game, declared, asked, actions, actionCount: actions.length - from };
}
export function truthTurnPreparationPromise(game: Game, target = game.turnActionPromises?.[0]?.player ?? game.players[0].id) {
  const promise = viewGame(game, target).turnActionPromises.find(row => row.player === target); assert.ok(promise); return promise;
}
export function nextTruthTurnPreparationNative(game: Game): TruthTurnPreparationStep | null {
  return game.expansions.includes('ix') ? nextTruthMixedRevival(game) : nextTruthBid(game);
}
export function nextTruthTurnPreparation(game: Game): TruthTurnPreparationStep | null {
  if (game.truthtrance) return null;
  for (const player of game.players) {
    const guide = viewGame(game, player.id).turnActionGuide;
    if (guide) return { actor: player.id, action: guide.action };
  }
  return nextTruthTurnPreparationNative(game);
}
export function advanceTruthTurnPreparation(game: Game, until: (state: Game) => boolean,
  actions: TruthTurnPreparationStep[] = [], nativeOnly = false): Game {
  for (let count = 0; count < 1800; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The original native preparation source ended before its requested boundary');
    const step = nativeOnly ? nextTruthTurnPreparationNative(game) : nextTruthTurnPreparation(game);
    assert.ok(step, 'Supply the real current Truthtrance question or answer before continuing');
    game = actTruthTurnPreparation(game, step.actor, step.action, actions);
  }
  throw Error('The genuine preparation source did not reach its finite boundary');
}
export function settleTruthTurnPreparation(game: Game, actions: TruthTurnPreparationStep[] = []): Game {
  return advanceTruthTurnPreparation(game, truthTurnPreparationClean, actions);
}
export function finishTruthTurnPreparation(game: Game, actions: TruthTurnPreparationStep[] = []): Game {
  const turn = game.turn;
  return advanceTruthTurnPreparation(game, state => state.turn === turn + 1 && state.phase === 0 && truthTurnPreparationClean(state), actions);
}
