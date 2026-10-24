import assert from 'node:assert/strict';
import type { Action, Game } from '../game/engine';
import {
  actHajrReplay, advanceHajrReplay, createHajrReplayFixture,
  hajrReplayClean, hajrReplayPlayer, type HajrReplayStep,
} from './fixture-hajr-replay';
import { truthMovementBoxInventory } from './fixture-truth-movement-box';

export const actTruthMovementWaitingBox = actHajrReplay;
export const truthMovementWaitingBoxClean = hajrReplayClean;
export const truthMovementWaitingBoxPlayer = hajrReplayPlayer;
export const truthMovementWaitingBoxInventory = truthMovementBoxInventory;

/** Genuine public purchases, first movement turn and an actual spent fact
 * question create an ordinary discard before a later waiting-owner promise.
 * The caller still owns the Guild question/answer, Box payment/choice, Richese
 * turn completion and Emperor's later shipment and ground movement. */
export function createTruthMovementWaitingBoxFixture() {
  const base = createHajrReplayFixture({ truthForGuild: true, truthForRichese: true });
  const target = base.owner, asker = 'guild', active = 'richese';
  const truth = base.guildTruth, richeseTruth = base.richeseTruth;
  assert.ok(truth && richeseTruth); assert.notEqual(truth, richeseTruth);
  let game = structuredClone(base.acquired);
  const actions: HajrReplayStep[] = structuredClone(base.actions.slice(0, base.acquiredActionCount));
  const act = (actor: string, action: Action) => { game = actHajrReplay(game, actor, action, actions); };
  const reach = (until: (game: Game) => boolean) => { game = advanceHajrReplay(game, until, actions); };
  reach(state => state.phase === 5 && state.active === active && hajrReplayClean(state));
  const beforeFact = structuredClone(game), factStart = actions.length;
  const factQuestion = { kind: 'fact' as const, target,
    fact: { kind: 'spice' as const, compare: 'gte' as const, value: 0 } };
  assert.ok(hajrReplayPlayer(game, active).hand.some(card => card.id === richeseTruth));
  act(active, { type: 'card', card: richeseTruth });
  for (const player of game.players)
    if (!game.truthtrance!.passed.includes(player.id)) act(player.id, { type: 'truthPass' });
  act(active, { type: 'truthAsk', question: factQuestion });
  act(target, { type: 'truthAnswer', answer: 'yes' });
  reach(hajrReplayClean);
  const factActions = structuredClone(actions.slice(factStart));
  const owner = hajrReplayPlayer(game, target), originalCards = truthMovementBoxInventory(base.setup);
  assert.equal(game.status, 'playing'); assert.equal(game.advanced, false);
  assert.equal(game.phase, 5); assert.equal(game.active, active);
  assert.ok(game.movementRemaining?.includes(target)); assert.notEqual(game.active, target);
  assert.equal(owner.shipped, false); assert.equal(owner.moved, 0);
  assert.deepEqual(owner.forces, {}); assert.equal(owner.reserves, 20);
  assert.equal(owner.spice, 8, 'The original Box1/Hajr1 purchases leave the native eight-spice wallet');
  assert.ok(owner.hand.some(card => card.id === base.box));
  assert.ok(owner.hand.some(card => card.id === base.hajr));
  assert.ok(hajrReplayPlayer(game, asker).hand.some(card => card.id === truth));
  assert.equal(game.discard.filter(card => card.id === richeseTruth).length, 1);
  assert.equal(game.discard.filter(card => card.id === truth).length, 0);
  assert.equal(game.movementPromises, undefined); assert.ok(!game.pendingNullentropy && !game.truthtrance);
  assert.deepEqual(truthMovementBoxInventory(game), originalCards);
  return {
    game, source: structuredClone(game), base, lobby: base.lobby, setup: base.setup,
    beforeStartingDeal: base.beforeStartingDeal, startingDealSelection: base.startingDealSelection,
    afterSetup: base.afterSetup, beforePurchases: base.beforePurchases, acquired: base.acquired,
    beforeFact, factQuestion, factActions, actions, sourceActionCount: actions.length,
    target, owner: target, asker, active, truth, richeseTruth, box: base.box, hajr: base.hajr,
    originalCards, balances: Object.fromEntries(game.players.map(player => [player.id, player.spice])),
    boxFee: 2, shipmentCost: 1, expectedPaidChoices: [richeseTruth, truth],
    claim: { kind: 'movement' as const, target, territory: 'carthag', minimum: 1 },
    currentEnd: { type: 'endMovement' } satisfies Action,
    shipment: { type: 'ship', territory: 'arrakeen', sector: 10, amount: 1, elite: 0, allyPayment: 0 } satisfies Action,
    move: { type: 'move', from: 'arrakeen:10', territory: 'carthag', sector: 11, amount: 1 } satisfies Action,
    staging: [
      'Original public bare Basic Richese/Emperor/Guild setup selects the two distinct original unopened Truthtrance deals for Richese and Guild, ordinary Spice/Hajr positions and native scalar lotteries only. Emperor actually buys Box1 and Hajr1. The recorded prefix stops at those acquisitions and continues through actual phase controls to Richese\'s first movement turn, before Emperor acts; the original factory\'s later movement/shipment suffix is excluded. Active Richese genuinely plays its original Truth on the current nonnegative-spice fact, Emperor answers Yes and the original neutral discard continuation completes. That physical Truth remains in discard; Guild still holds its distinct original Truth, and Emperor retains bought Box/Hajr, all twenty reserves, zero board forces and its native eight-spice wallet. No hand, wallet, force, queue, active player, phase, promise or pending receipt is installed. The caller\'s later definite Guild answer naturally supplies the second ordinary paid-search candidate. The source stops before that question/answer, any Box fee/choice or Richese turn ending. Neither Truth candidate is a movement card: a valid ordinary paid selection can preserve the future ordinary shipment and ground move.',
    ],
  };
}
export type TruthMovementWaitingBoxFixture = ReturnType<typeof createTruthMovementWaitingBoxFixture>;
