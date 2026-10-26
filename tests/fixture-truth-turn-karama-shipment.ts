import assert from 'node:assert/strict';
import { type Action, type Game } from '../game/engine';
import type { MixedActionExpression } from '../game/mixed-action-question';
import type { TruthFact, TruthQuestion } from '../game/truthtrance';
import { windowCardOpportunity } from '../game/window-card-play';
import {
  actTruthTurnKarama, advanceTruthTurnKarama, closeTruthTurnKaramaLot, createTruthTurnKaramaFixture,
  declareTruthTurnKarama, finishTruthTurnKarama, nextTruthTurnKarama, nextTruthTurnKaramaNative,
  settleTruthTurnKarama, truthTurnKaramaClean, truthTurnKaramaInventory, truthTurnKaramaPlayer,
  truthTurnKaramaPromise, truthTurnKaramaTraitors, type TruthTurnKaramaLeaf, type TruthTurnKaramaStep,
} from './fixture-truth-turn-karama';

export type TruthTurnKaramaShipmentLeaf = TruthTurnKaramaLeaf |
  { kind: 'windowCardPlay'; effect: 'karamaShipment'; source: string };
export type TruthTurnKaramaShipmentExpression = MixedActionExpression<TruthTurnKaramaShipmentLeaf>;
export type TruthTurnKaramaShipmentStep = TruthTurnKaramaStep;
export const actTruthTurnKaramaShipment = actTruthTurnKarama;
export const truthTurnKaramaShipmentClean = truthTurnKaramaClean;
export const truthTurnKaramaShipmentPlayer = truthTurnKaramaPlayer;
export const truthTurnKaramaShipmentInventory = truthTurnKaramaInventory;
export const truthTurnKaramaShipmentTraitors = truthTurnKaramaTraitors;
export const truthTurnKaramaShipmentPromise = truthTurnKaramaPromise;
export const nextTruthTurnKaramaShipment = nextTruthTurnKarama;
export const nextTruthTurnKaramaShipmentNative = nextTruthTurnKaramaNative;
export const advanceTruthTurnKaramaShipment = advanceTruthTurnKarama;
export const settleTruthTurnKaramaShipment = settleTruthTurnKarama;
export const finishTruthTurnKaramaShipment = finishTruthTurnKarama;
export const truthTurnKaramaShipmentFact = (fact: TruthFact): TruthTurnKaramaShipmentExpression => ({ kind: 'fact', fact });
export const truthTurnKaramaShipmentPlay = (source: string): TruthTurnKaramaShipmentExpression =>
  ({ kind: 'action', action: { kind: 'windowCardPlay', effect: 'karamaShipment', source } });
export const truthTurnKaramaShipmentPayment = (recipient: string, minimum = 2): TruthTurnKaramaShipmentExpression =>
  ({ kind: 'action', action: { kind: 'payment', recipient, minimum } });
export const truthTurnKaramaShipmentShip = (territory = 'polar_sink', minimum = 1): TruthTurnKaramaShipmentExpression =>
  ({ kind: 'action', action: { kind: 'ship', territory, minimum } });
export const truthTurnKaramaShipmentGroup = (kind: 'and' | 'or', ...terms: TruthTurnKaramaShipmentExpression[]): TruthTurnKaramaShipmentExpression =>
  ({ kind, terms });

/** Original H/A/E two-Truth source, followed only by native passes/readiness
 * and actual prior Movement endings. The optional earlier printed auction use
 * really spends that original card; it supplies no shipment-role receipt. */
export function createTruthTurnKaramaShipmentFixture(options: {
  beneficiary?: 'own' | 'foreign'; advanced?: boolean; priorAuctionSpend?: boolean;
} = {}) {
  const base = createTruthTurnKaramaFixture({ advanced: options.advanced, window: 'active' });
  const kind = options.beneficiary ?? 'own', beneficiary = kind === 'own' ? base.target : base.asker;
  const priorAuctionSpend = options.priorAuctionSpend ?? false;
  let game = structuredClone(base.game); const actions = structuredClone(base.sourceActions), inherited = actions.length;
  let auctionCost: { before: Game; steps: TruthTurnKaramaShipmentStep[]; after: Game } | null = null;
  if (priorAuctionSpend) {
    const before = structuredClone(game), from = actions.length;
    game = actTruthTurnKaramaShipment(game, base.target, base.purchase, actions);
    game = settleTruthTurnKaramaShipment(game, actions);
    auctionCost = { before, steps: structuredClone(actions.slice(from)), after: structuredClone(game) };
    assert.equal(game.discard.filter(card => card.id === base.karama).length, 1);
    assert.ok(truthTurnKaramaShipmentPlayer(game, base.target).hand.some(card => card.id === base.lotCard));
  }
  const beforeAuctionClose = structuredClone(game), closeAt = actions.length;
  game = closeTruthTurnKaramaLot(game, base, actions);
  const auctionClose = { before: beforeAuctionClose, steps: structuredClone(actions.slice(closeAt)), after: structuredClone(game) };
  game = advanceTruthTurnKaramaShipment(game,
    state => state.phase === 5 && state.active === beneficiary && truthTurnKaramaShipmentClean(state), actions, true);
  const opportunity = windowCardOpportunity(game, 'karamaShipment'); assert.ok(opportunity?.effect === 'karamaShipment');
  assert.equal(opportunity.recipient, beneficiary);
  assert.equal(opportunity.source, JSON.stringify(['karamaShipment', game.turn, beneficiary, 'original']));
  assert.equal(truthTurnKaramaShipmentPlayer(game, beneficiary).shipped, false); assert.equal(game.karamaShipping, null);
  assert.deepEqual(truthTurnKaramaShipmentPlayer(game, base.asker).hand.map(card => card.id), base.truths);
  assert.equal(truthTurnKaramaShipmentPlayer(game, base.target).hand.some(card => card.id === base.karama), !priorAuctionSpend);
  assert.deepEqual(truthTurnKaramaShipmentInventory(game), base.originalCards);
  assert.deepEqual(truthTurnKaramaShipmentTraitors(game), base.originalTraitors);
  const source = opportunity.source, asker = base.asker, target = base.target, recipient = asker;
  const mixed = truthTurnKaramaShipmentGroup('and', truthTurnKaramaShipmentPlay(source), truthTurnKaramaShipmentPayment(recipient));
  const question = { kind: 'turnActions', target, turn: game.turn, mixed } satisfies TruthQuestion;
  const spiceFact: TruthFact = { kind: 'spice', compare: 'eq', value: truthTurnKaramaShipmentPlayer(game, target).spice };
  const grant: Action = { type: 'card', card: base.karama, mode: 'shipment', target: beneficiary };
  const shipment: Action = { type: 'ship', territory: 'polar_sink', sector: 0, amount: 1, elite: 0, allyPayment: 0 };
  return { game, base, initial: base.initial, setup: base.setup, afterSetup: base.afterSetup,
    beforeStartingDeal: base.beforeStartingDeal, asker, target, recipient, observer: base.observer,
    truths: base.truths, truth: base.truth, karama: base.karama, card: base.karama,
    beneficiary, kind, priorAuctionSpend, opportunity, source, effect: 'karamaShipment' as const,
    mixed, question, spiceFact, grant, shipment, ownGrant: { ...grant, target } satisfies Action,
    payment: { type: 'bribe', target: recipient, amount: 2 } satisfies Action,
    endMovement: { type: 'endMovement' } satisfies Action,
    auctionCost, beforeAuctionClose, auctionClose, originalCards: base.originalCards,
    originalTraitors: base.originalTraitors, originalSpice: base.originalSpice,
    actions, sourceActions: actions, sourceActionCount: actions.length,
    sourceCounts: { inherited, nativeContinuation: actions.length - inherited, selected: actions.length,
      actualPriorAuctionCost: auctionCost?.steps.length ?? 0, actualAuctionClose: auctionClose.steps.length },
    sourceDisclosure: `${base.sourceDisclosure} Actually finish the ordinary auction using native passes, readiness and any original responses; ` +
      `stop at ${kind === 'own' ? 'Emperor' : 'Harkonnen'}'s real original unused Shipment turn. ` +
      (priorAuctionSpend ? 'Before advancing, Emperor actually spends its original printed Karama for the original free auction card; the later Shipment source still has no future printed card or receipt. '
        : 'Emperor retains its original printed Karama; Harkonnen retains both actual opening Truthtrances. ') +
      'Only original array-recorded actions are continued. A later actual printed price spend is independent of delivery; its native desert tariff halves from two to one. No hand, wallet, army, phase, shipment, price grant, cost or promise is installed.',
  };
}
export type TruthTurnKaramaShipmentFixture = ReturnType<typeof createTruthTurnKaramaShipmentFixture>;
export function declareTruthTurnKaramaShipment(f: TruthTurnKaramaShipmentFixture, source = f.game, copy: 0 | 1 = 0,
  actions: TruthTurnKaramaShipmentStep[] = []) {
  return declareTruthTurnKarama(f.base, source, copy, actions);
}
export function askTruthTurnKaramaShipment(game: Game, asker: string, target: string, mixed: TruthTurnKaramaShipmentExpression,
  actions: TruthTurnKaramaShipmentStep[] = []): Game {
  return actTruthTurnKaramaShipment(game, asker, { type: 'truthAsk', question: {
    kind: 'turnActions', target, turn: game.turn, mixed: structuredClone(mixed),
  } }, actions);
}
export function answerTruthTurnKaramaShipment(game: Game, target: string, answer: 'yes' | 'no' | 'unknown',
  actions: TruthTurnKaramaShipmentStep[] = []): Game {
  return actTruthTurnKaramaShipment(game, target, { type: 'truthAnswer', answer }, actions);
}
export function bindTruthTurnKaramaShipment(f: TruthTurnKaramaShipmentFixture, answer: 'yes' | 'no' = 'yes', mixed = f.mixed,
  source = f.game, copy: 0 | 1 = 0, actions: TruthTurnKaramaShipmentStep[] = []) {
  const declared = declareTruthTurnKaramaShipment(f, source, copy, actions);
  const asked = askTruthTurnKaramaShipment(declared.game, f.asker, f.target, mixed, actions);
  return { game: answerTruthTurnKaramaShipment(asked, f.target, answer, actions), declared, asked, actions };
}
export function closeTruthTurnKaramaShipment(game: Game, f: TruthTurnKaramaShipmentFixture,
  actions: TruthTurnKaramaShipmentStep[] = []): Game {
  return advanceTruthTurnKaramaShipment(game, state => truthTurnKaramaShipmentClean(state) &&
    !windowCardOpportunity(state, 'karamaShipment', f.source), actions, true);
}
