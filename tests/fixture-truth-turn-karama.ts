import assert from 'node:assert/strict';
import { viewGame, type Action, type Game } from '../game/engine';
import type { MixedActionExpression } from '../game/mixed-action-question';
import type { TruthFact, TruthQuestion } from '../game/truthtrance';
import { windowCardOpportunity } from '../game/window-card-play';
import { actTruthBid, createTruthBidFixture, nextTruthBid, truthBidClean, truthBidInventory, truthBidPlayer,
  type TruthBidStep } from './fixture-truth-bid';
import { truthTraitorDecisionTraitors } from './fixture-truth-traitor-decision';
import type { TruthTurnWindowCardLeaf } from './fixture-truth-turn-window-card';

export type TruthTurnKaramaLeaf = TruthTurnWindowCardLeaf |
  { kind: 'windowCardPlay'; effect: 'karamaAuction'; source: string };
export type TruthTurnKaramaExpression = MixedActionExpression<TruthTurnKaramaLeaf>;
export type TruthTurnKaramaStep = TruthBidStep;
export const actTruthTurnKarama = actTruthBid;
export const truthTurnKaramaPlayer = truthBidPlayer;
export const truthTurnKaramaInventory = truthBidInventory;
export const truthTurnKaramaTraitors = truthTraitorDecisionTraitors;
export const truthTurnKaramaClean = (game: Game) => truthBidClean(game) && !game.pendingRevival && !game.pendingShipment;
export const truthTurnKaramaFact = (fact: TruthFact): TruthTurnKaramaExpression => ({ kind: 'fact', fact });
export const truthTurnKaramaPlay = (source: string): TruthTurnKaramaExpression =>
  ({ kind: 'action', action: { kind: 'windowCardPlay', effect: 'karamaAuction', source } });
export const truthTurnKaramaPayment = (recipient: string, minimum = 2): TruthTurnKaramaExpression =>
  ({ kind: 'action', action: { kind: 'payment', recipient, minimum } });
export const truthTurnKaramaBid = (lot = 1, minimum = 3): TruthTurnKaramaExpression =>
  ({ kind: 'action', action: { kind: 'bid', lot, minimum } });
export const truthTurnKaramaGroup = (kind: 'and' | 'or', ...terms: TruthTurnKaramaExpression[]): TruthTurnKaramaExpression =>
  ({ kind, terms });

/** Thin genuine original H/A/E base33 adapter. The live-opponent variant
 * follows original Basic waiting23 by a real H bid1 and A pass: E can really bid,
 * then buy immediately while H still owns the next native bidder turn. */
export function createTruthTurnKaramaFixture(options: {
  window?: 'active' | 'waiting'; advanced?: boolean; liveOpponent?: boolean;
} = {}) {
  const liveOpponent = options.liveOpponent ?? false;
  const base = createTruthBidFixture({ targetKarama: true, advanced: options.advanced,
    window: liveOpponent ? 'waiting' : options.window ?? 'active' });
  let game = structuredClone(base.game); const actions = structuredClone(base.sourceActions), inherited = actions.length;
  if (liveOpponent) {
    game = actTruthTurnKarama(game, base.asker, { type: 'bid', amount: 1, allyPayment: 0 }, actions);
    game = actTruthTurnKarama(game, base.opponent, { type: 'passBid' }, actions);
    assert.equal(game.auction?.active, base.target); assert.equal(game.auction?.bidder, base.asker);
    assert.equal(game.auction?.passed.includes(base.asker), false);
  }
  assert.ok(base.karama && game.auction);
  const opportunity = windowCardOpportunity(game, 'karamaAuction'); assert.ok(opportunity);
  const source = opportunity.source, lot = game.auction.index + 1, asker = base.asker, target = base.target, recipient = asker;
  assert.equal(source, `ordinary-auction:${game.turn}:${lot}`);
  const mixed = truthTurnKaramaGroup('and', truthTurnKaramaPlay(source), truthTurnKaramaPayment(recipient));
  const question = { kind: 'turnActions', target, turn: game.turn, mixed } satisfies TruthQuestion;
  const originalTraitors = truthTurnKaramaTraitors(game);
  assert.equal(originalTraitors.length, 15); assert.deepEqual(truthTurnKaramaInventory(game), base.originalCards);
  assert.deepEqual(truthTurnKaramaPlayer(game, asker).hand.map(card => card.id), base.truths);
  assert.deepEqual(truthTurnKaramaPlayer(game, target).hand.map(card => card.id), [base.karama]);
  const spiceFact: TruthFact = { kind: 'spice', compare: 'eq', value: truthTurnKaramaPlayer(game, target).spice };
  return { game, base, initial: base.initial, setup: base.setup, afterSetup: base.afterSetup,
    beforeStartingDeal: base.beforeStartingDeal, asker, target, recipient, observer: base.opponent,
    truths: structuredClone(base.truths), truth: base.truth, karama: base.karama, card: base.karama,
    effect: 'karamaAuction' as const, source, opportunity, lot, lotCard: base.lotCard, lotCards: base.lotCards,
    advanced: base.advanced, window: base.window, liveOpponent, mixed, question, spiceFact,
    purchase: { type: 'card', card: base.karama, mode: 'purchase' } satisfies Action,
    karamaPayment: { type: 'decision', karama: true, card: base.karama } satisfies Action,
    spicePayment: { type: 'decision', karama: false } satisfies Action,
    bid: { type: 'bid', amount: 3, allyPayment: 0 } satisfies Action,
    payment: { type: 'bribe', target: recipient, amount: 2 } satisfies Action,
    originalCards: base.originalCards, originalTraitors, originalSpice: base.originalSpice,
    actions, sourceActions: actions, sourceActionCount: actions.length,
    sourceCounts: { inherited, nativeContinuation: actions.length - inherited, selected: actions.length },
    sourceDisclosure: `${base.sourceDisclosure} This adapter changes only the raw printed-Karama/current-lot question. ` +
      'The original held Karama opens the native Atreides auction-inspection response; all three real response passes remain in the recorded source prefix. ' +
      (liveOpponent ? 'Actually bid1 with original Harkonnen and pass with Atreides, leaving the original H bidder live when Emperor acts. ' : '') +
      'Both original H Truthtrances and the original Emperor Karama retain physical custody. No hand, purse, army, lot, bid, invoice, cancellation response, cost receipt or promise is installed.',
  };
}
export type TruthTurnKaramaFixture = ReturnType<typeof createTruthTurnKaramaFixture>;

export function declareTruthTurnKarama(f: TruthTurnKaramaFixture, source = f.game, copy: 0 | 1 = 0,
  actions: TruthTurnKaramaStep[] = []) {
  let game = actTruthTurnKarama(source, f.asker, { type: 'card', card: f.truths[copy] }, actions);
  while (game.truthtrance?.stage === 'priority') {
    const actor = game.players.find(player => !game.truthtrance!.passed.includes(player.id)); assert.ok(actor);
    game = actTruthTurnKarama(game, actor.id, { type: 'truthPass' }, actions);
  }
  assert.equal(game.truthtrance?.stage, 'ask'); return { game, actions };
}
export function askTruthTurnKarama(game: Game, asker: string, target: string, mixed: TruthTurnKaramaExpression,
  actions: TruthTurnKaramaStep[] = []): Game {
  return actTruthTurnKarama(game, asker, { type: 'truthAsk', question: {
    kind: 'turnActions', target, turn: game.turn, mixed: structuredClone(mixed),
  } }, actions);
}
export function answerTruthTurnKarama(game: Game, target: string, answer: 'yes' | 'no' | 'unknown',
  actions: TruthTurnKaramaStep[] = []): Game {
  return actTruthTurnKarama(game, target, { type: 'truthAnswer', answer }, actions);
}
export function bindTruthTurnKarama(f: TruthTurnKaramaFixture, answer: 'yes' | 'no' = 'yes', mixed = f.mixed,
  source = f.game, copy: 0 | 1 = 0, actions: TruthTurnKaramaStep[] = []) {
  const declared = declareTruthTurnKarama(f, source, copy, actions);
  const asked = askTruthTurnKarama(declared.game, f.asker, f.target, mixed, actions);
  return { game: answerTruthTurnKarama(asked, f.target, answer, actions), declared, asked, actions };
}
export function truthTurnKaramaPromise(game: Game, target = game.turnActionPromises![0].player) {
  const row = viewGame(game, target).turnActionPromises.find(candidate => candidate.player === target); assert.ok(row); return row;
}
export function nextTruthTurnKaramaNative(game: Game): TruthTurnKaramaStep | null {
  return nextTruthBid(game);
}
export function nextTruthTurnKarama(game: Game): TruthTurnKaramaStep | null {
  if (game.truthtrance) return null;
  for (const player of game.players) {
    const guide = viewGame(game, player.id).turnActionGuide;
    if (guide) return { actor: player.id, action: guide.action };
  }
  return nextTruthTurnKaramaNative(game);
}
export function advanceTruthTurnKarama(game: Game, until: (state: Game) => boolean,
  actions: TruthTurnKaramaStep[] = [], nativeOnly = false): Game {
  for (let count = 0; count < 1400; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The original Karama-auction source ended before its native boundary');
    const step = nativeOnly ? nextTruthTurnKaramaNative(game) : nextTruthTurnKarama(game);
    assert.ok(step, 'Supply the actual Truthtrance or original unfunded Karama invoice choice');
    game = actTruthTurnKarama(game, step.actor, step.action, actions);
  }
  throw Error('The original Karama-auction source did not reach its finite boundary');
}
export function settleTruthTurnKarama(game: Game, actions: TruthTurnKaramaStep[] = []): Game {
  return advanceTruthTurnKarama(game, truthTurnKaramaClean, actions, true);
}
export function winTruthTurnKaramaBid(game: Game, f: TruthTurnKaramaFixture, amount = 3,
  actions: TruthTurnKaramaStep[] = []): Game {
  game = advanceTruthTurnKarama(game, state => state.auction?.active === f.target && truthTurnKaramaClean(state), actions, true);
  game = actTruthTurnKarama(game, f.target, { type: 'bid', amount, allyPayment: 0 }, actions);
  return reachTruthTurnKaramaInvoice(game, f, actions);
}
/** A new bid reopens both other original bidders. Actually pass each remaining
 * native turn before stopping at the winning Emperor's printed-card invoice. */
export function reachTruthTurnKaramaInvoice(game: Game, f: TruthTurnKaramaFixture,
  actions: TruthTurnKaramaStep[] = []): Game {
  return advanceTruthTurnKarama(game, state => !state.response && !state.phaseOpening && !state.pendingTreacheryDiscard &&
    state.decision?.kind === 'auctionPayment' && state.decision.player === f.target, actions, true);
}
export function closeTruthTurnKaramaLot(game: Game, f: TruthTurnKaramaFixture, actions: TruthTurnKaramaStep[] = []): Game {
  return advanceTruthTurnKarama(game, state => truthTurnKaramaClean(state) &&
    windowCardOpportunity(state, 'karamaAuction')?.source !== f.source, actions, true);
}
export function finishTruthTurnKarama(game: Game, actions: TruthTurnKaramaStep[] = []): Game {
  const turn = game.turn;
  return advanceTruthTurnKarama(game, state => state.turn === turn + 1 && state.phase === 0 && truthTurnKaramaClean(state), actions);
}
