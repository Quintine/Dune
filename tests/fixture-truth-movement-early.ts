import assert from 'node:assert/strict';
import type { Action } from '../game/engine';
import {
  createTruthtranceEarlyShipmentFixture, actTruthtranceEarlyShipment,
  advanceTruthtranceEarlyShipment, nextTruthtranceEarlyShipmentStep,
  truthtranceEarlyShipmentClean, truthtranceEarlyShipmentPlayer,
  type TruthtranceEarlyShipmentStep,
} from './fixture-truthtrance-early-shipment';
import { truthMovementInventory } from './fixture-truth-movement';

export type TruthMovementEarlyStep = TruthtranceEarlyShipmentStep;
export const actTruthMovementEarly = actTruthtranceEarlyShipment;
export const advanceTruthMovementEarly = advanceTruthtranceEarlyShipment;
export const nextTruthMovementEarlyStep = nextTruthtranceEarlyShipmentStep;
export const truthMovementEarlyClean = truthtranceEarlyShipmentClean;
export const truthMovementEarlyPlayer = truthtranceEarlyShipmentPlayer;
export const truthMovementEarlyInventory = truthMovementInventory;

/** Genuine original Basic setup, before the selected early movement question.
 * Phase0 uses only the real setup prefix and unopened ordinary Spice selection;
 * phase2 retains the original Storm/Spice continuation through clean Charity.
 * The caller owns the question, subsequent auction and later shipment/move. */
export function createTruthMovementEarlyFixture(options: { phase?: 0 | 2 } = {}) {
  const base = createTruthtranceEarlyShipmentFixture(), phase = options.phase ?? 2;
  const game = structuredClone(phase === 0 ? base.afterSetup : base.game);
  const count = phase === 0 ? base.afterSetupActionCount : base.sourceActionCount;
  const actions: TruthMovementEarlyStep[] = structuredClone(base.actions.slice(0, count));
  const spiceOrder = phase === 0 ? base.spiceOrder.map(({ position, card }) => {
    const from = game.spiceDeck.findIndex((candidate, index) => index >= position &&
      JSON.stringify(candidate) === JSON.stringify(card));
    assert.ok(from >= position, 'Select the same original unopened ordinary Spice card');
    const selected = game.spiceDeck.splice(from, 1)[0]; game.spiceDeck.splice(position, 0, selected);
    return { position, from, card: structuredClone(selected) };
  }) : structuredClone(base.spiceOrder);
  assert.equal(game.status, 'playing'); assert.equal(game.advanced, false);
  assert.equal(game.turn, 1); assert.equal(game.phase, phase);
  assert.deepEqual(game.expansions, []); assert.ok(truthMovementEarlyClean(game));
  const owner = truthMovementEarlyPlayer(game, base.target);
  assert.equal(owner.spice, 10); assert.equal(owner.reserves, 20); assert.equal(owner.tanks, 0);
  assert.deepEqual(owner.forces, {}); assert.equal(owner.shipped, false); assert.equal(owner.moved, 0);
  assert.ok(truthMovementEarlyPlayer(game, base.asker).hand.some(card => card.id === base.card));
  assert.ok(truthMovementEarlyPlayer(game, base.counterHolder).hand.some(card => card.id === base.karama));
  assert.equal(game.truthtrance ?? null, null); assert.equal(game.movementPromises, undefined);
  assert.deepEqual(truthMovementInventory(game), base.originalTreachery);
  const claim = { kind: 'movement' as const, target: base.target, territory: 'carthag', minimum: 8 };
  return {
    game, source: structuredClone(game), base, phase,
    lobby: base.lobby, setup: base.setup, beforeStartingDeal: base.beforeStartingDeal,
    afterSetup: base.afterSetup, afterSetupActionCount: base.afterSetupActionCount,
    beforeSpiceOrder: base.beforeSpiceOrder, spiceOrder, deal: base.deal, dealOrder: base.dealOrder,
    originalCards: base.originalTreachery, originalTreachery: base.originalTreachery, originalSpice: base.originalSpice,
    asker: base.asker, target: base.target, counterHolder: base.counterHolder, guild: base.guild,
    truth: base.card, card: base.card, karama: base.karama, claim, question: claim,
    actions, sourceActionCount: actions.length,
    sourceCounts: { storm: base.afterSetupActionCount, charity: base.sourceActionCount },
    balances: Object.fromEntries(game.players.map(player => [player.id, player.spice])),
    declarationStep: { actor: base.asker, action: { type: 'card', card: base.card } } satisfies TruthMovementEarlyStep,
    askStep: { actor: base.asker, action: { type: 'truthAsk', question: claim } } satisfies TruthMovementEarlyStep,
    bid: { type: 'bid', amount: 2, allyPayment: 0 } satisfies Action,
    payment: { type: 'decision', karama: false } satisfies Action,
    purchaseCost: 2,
    shipment: { type: 'ship', territory: 'arrakeen', sector: 10, amount: 8, elite: 0, allyPayment: 0 } satisfies Action,
    shipmentCost: 8,
    move: { type: 'move', from: 'arrakeen:10', territory: 'carthag', sector: 11, amount: 8 } satisfies Action,
    endMovement: { type: 'endMovement' } satisfies Action,
    staging: [
      `Original public Basic Atreides/Emperor/Harkonnen/Guild setup selects only the original five unopened deal positions, one ordinary unopened Spice position and native scalar lotteries. Atreides genuinely holds Truthtrance, Emperor Baliset, Harkonnen Karama/Shield and Guild Snooper. The phase${phase} source uses exactly its original ${actions.length}-action prefix: ${phase === 0 ? 'the Charity factory suffix is excluded, and the same still-unopened ordinary Spice position is selected before any Storm/Spice continuation' : 'actual Storm/Spice controls reach clean Charity before any question or Bidding'}. Emperor retains its printed ten spice, twenty reserves, zero board forces and no Tanks. The suggested future normal purchase2, city shipment8 and eight-force ground movement remain caller actions; no purchase, question, answer, dealt hand, wallet, army, phase clock, queue or receipt is installed. The movement predicate concerns the later ground event, not the preceding shipment.`,
    ],
  };
}
export type TruthMovementEarlyFixture = ReturnType<typeof createTruthMovementEarlyFixture>;
