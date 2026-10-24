import assert from 'node:assert/strict';
import type { Action } from '../game/engine';
import {
  actTruthMovement, advanceTruthMovement, createTruthMovementFixture,
  truthMovementClean, truthMovementInventory, truthMovementPlayer,
  type TruthMovementStep,
} from './fixture-truth-movement';

export const actTruthMovementWaiting = actTruthMovement;
export const truthMovementWaitingClean = truthMovementClean;
export const truthMovementWaitingInventory = truthMovementInventory;
export const truthMovementWaitingPlayer = truthMovementPlayer;

/** Original public setup with the two unopened deal positions reversed. The
 * active Atreides owns Truthtrance; Emperor has not taken its movement turn.
 * The original factory's later setup/phase/shipment suffix is not reused or
 * counted: every continuation below is performed from this unopened snapshot. */
export function createTruthMovementWaitingFixture(options: { hajr?: boolean } = {}) {
  const base = createTruthMovementFixture(options);
  const asker = 'atreides', target = 'emperor';
  let game = structuredClone(base.beforeStartingDeal);
  assert.equal(game.status, 'setup');
  assert.ok(game.players.every(player => player.hand.length === 0));
  assert.equal(game.deck[0].id, base.targetCard);
  assert.equal(game.deck[1].id, base.truth);
  [game.deck[0], game.deck[1]] = [game.deck[1], game.deck[0]];
  const beforeStartingDeal = structuredClone(game);
  const dealOrder = [
    ...structuredClone(base.dealOrder),
    { position: 0, from: 1, card: base.truth },
  ];
  const start = base.actions.findIndex(step => step.action.type === 'start');
  assert.ok(start >= 0);
  const actions: TruthMovementStep[] = structuredClone(base.actions.slice(0, start + 1));
  game = advanceTruthMovement(game, state => state.status === 'playing', actions);
  const afterSetup = structuredClone(game);
  assert.deepEqual(truthMovementPlayer(game, asker).hand.map(card => card.id), [base.truth]);
  assert.deepEqual(truthMovementPlayer(game, target).hand.map(card => card.id), [base.targetCard]);
  assert.deepEqual(truthMovementInventory(game), base.originalCards);
  const startingPositions = Object.fromEntries(game.players.map(player => [player.id, {
    forces: structuredClone(player.forces), reserves: player.reserves, spice: player.spice,
  }]));
  const spiceOrder = base.spiceOrder.map(({ position, card }) => {
    const from = game.spiceDeck.findIndex((candidate, index) => index >= position &&
      JSON.stringify(candidate) === JSON.stringify(card));
    assert.ok(from >= position, 'Choose the same original unopened ordinary Spice card');
    const selected = game.spiceDeck.splice(from, 1)[0]; game.spiceDeck.splice(position, 0, selected);
    return { position, from, card: structuredClone(selected) };
  });
  assert.deepEqual(game.spiceDeck.map(card => JSON.stringify(card)).sort(), base.originalSpice);
  game = advanceTruthMovement(game, state => state.turn === 1 && state.phase === 5 &&
    state.active === asker && truthMovementClean(state), actions);
  const current = truthMovementPlayer(game, asker), waiting = truthMovementPlayer(game, target);
  assert.equal(game.advanced, false); assert.deepEqual(game.expansions, []);
  assert.ok(game.movementRemaining?.includes(asker)); assert.ok(game.movementRemaining?.includes(target));
  assert.equal(current.shipped, false); assert.equal(current.moved, 0);
  assert.deepEqual(current.forces, { 'arrakeen:10': 10 }); assert.equal(current.reserves, 10);
  assert.equal(waiting.shipped, false); assert.equal(waiting.moved, 0);
  assert.deepEqual(waiting.forces, {}); assert.equal(waiting.reserves, 20);
  assert.equal(current.spice, startingPositions[asker].spice);
  assert.equal(waiting.spice, startingPositions[target].spice);
  assert.equal(game.movementPromises, undefined); assert.ok(!game.truthtrance);
  assert.deepEqual(truthMovementInventory(game), base.originalCards);
  return {
    game, source: structuredClone(game), base, lobby: base.lobby, setup: base.setup,
    beforeStartingDeal, afterSetup, actions, sourceActionCount: actions.length,
    asker, target, truth: base.truth, hajr: base.hajr, targetCard: base.targetCard,
    dealOrder, spiceOrder, originalCards: base.originalCards, originalSpice: base.originalSpice,
    startingPositions, balances: Object.fromEntries(game.players.map(player => [player.id, player.spice])),
    claim: { kind: 'movement' as const, target, territory: 'carthag', minimum: 1 },
    currentMove: { type: 'move', from: 'arrakeen:10', territory: 'carthag', sector: 11, amount: 10 } satisfies Action,
    currentEnd: { type: 'endMovement' } satisfies Action,
    shipment: { type: 'ship', territory: 'arrakeen', sector: 10, amount: 1, elite: 0, allyPayment: 0 } satisfies Action,
    shipmentCost: 1,
    move: { type: 'move', from: 'arrakeen:10', territory: 'carthag', sector: 11, amount: 1 } satisfies Action,
    staging: [
      'Original public Basic Atreides/Emperor create/join/readiness/start precede an unopened two-position deal reversal: Atreides receives original Truthtrance and Emperor original Hajr (or the explicitly requested original projectile). Actual setup and native Storm/Spice/Charity/Bidding/Revival continue from that snapshot, with only the same two unopened ordinary Spice positions and native scalar lotteries selected. The recorded action prefix includes only that real start and these new continuations, excluding the original factory suffix. Atreides retains its native ten Arrakeen forces and ten reserves; waiting Emperor retains zero board forces, twenty reserves and its native wallet. No dealt hand, wallet, force, phase clock, pending receipt, question or promise is installed. This source stops before any question, answer, active-player shipment/move or waiting-player turn. The suggested active move/end and later Emperor city1 shipment/ground1 remain actual caller actions.',
    ],
  };
}
export type TruthMovementWaitingFixture = ReturnType<typeof createTruthMovementWaitingFixture>;
