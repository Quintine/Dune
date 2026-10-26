import assert from 'node:assert/strict';
import { type Action, type Game } from '../game/engine';
import type { TruthQuestion } from '../game/truthtrance';
import {
  actTruthBid, advanceTruthBid, createTruthBidFixture, truthBidClean, truthBidInventory,
  truthBidPlayer, type TruthBidStep,
} from './fixture-truth-bid';
import {
  settleTruthTravel, truthTravelGroup, truthTravelMove, truthTravelShip,
  type TruthTravelExpression,
} from './fixture-truth-travel';

export type TruthTravelOrderStep = TruthBidStep;
export const actTruthTravelOrder = actTruthBid;
export const truthTravelOrderClean = truthBidClean;
export const truthTravelOrderInventory = truthBidInventory;
export const truthTravelOrderPlayer = truthBidPlayer;
export const settleTruthTravelOrder = settleTruthTravel;

/** The existing public H/A/E base33 start genuinely deals both printed
 * Truthtrances to Harkonnen. Continue its actual auction/Revival and Harkonnen
 * movement ending until Atreides' first unused native turn. Only the inherited
 * unopened deal/ordinary lots/Spice selections and scalar lotteries are used.
 * No hand, card custody, wallet, army, played clock, promise or receipt is set. */
export function createTruthTravelOrderFixture() {
  const base = createTruthBidFixture({ window: 'waiting' });
  const actions = structuredClone(base.sourceActions), suffixFrom = actions.length;
  const game = advanceTruthBid(structuredClone(base.game), state => state.turn === 1 && state.phase === 5 &&
    state.active === base.opponent && truthBidClean(state), actions);
  const asker = base.asker, target = base.opponent, observer = base.target;
  assert.equal(game.advanced, false); assert.deepEqual(game.expansions, []);
  assert.deepEqual(truthBidPlayer(game, asker).hand.map(card => card.id), base.truths);
  assert.equal(base.truths.length, 2); assert.equal(new Set(base.truths).size, 2);
  assert.equal(truthBidPlayer(game, target).shipped, false); assert.equal(truthBidPlayer(game, target).moved, 0);
  assert.deepEqual(truthBidPlayer(game, target).forces, { 'arrakeen:10': 10 });
  assert.equal(truthBidPlayer(game, target).reserves, 10);
  assert.ok(!game.movementRemaining?.includes(asker)); assert.ok(game.movementRemaining?.includes(target));
  assert.equal(game.travelPromises?.length ?? 0, 0); assert.equal(game.shipmentPromises?.length ?? 0, 0);
  assert.equal(game.movementPromises?.length ?? 0, 0); assert.equal(game.movementExpressionPromises?.length ?? 0, 0);
  assert.deepEqual(truthBidInventory(game), base.originalCards);
  const mixed = truthTravelGroup('or', truthTravelShip(), truthTravelMove());
  return {
    game, source: structuredClone(game), base, asker, target, observer, truths: structuredClone(base.truths),
    setup: base.setup, afterSetup: base.afterSetup, beforeStartingDeal: base.beforeStartingDeal,
    originalCards: base.originalCards, originalSpice: base.originalSpice,
    dealOrder: base.dealOrder, spiceOrder: base.spiceOrder,
    actions, sourceActions: actions, sourceActionCount: actions.length, sourceCount: actions.length,
    continuation: structuredClone(actions.slice(suffixFrom)),
    sourceCounts: { inheritedBidding: suffixFrom, nativeContinuation: actions.length - suffixFrom, selected: actions.length },
    mixed,
    travelQuestion: { kind: 'travel', target, turn: game.turn, mixed } satisfies TruthQuestion,
    shipmentQuestion: { kind: 'shipment', target, territory: 'polar_sink', minimum: 1 } satisfies TruthQuestion,
    movementQuestion: { kind: 'movement', target, territory: 'imperial_basin', minimum: 1 } satisfies TruthQuestion,
    shipment: { type: 'ship', territory: 'polar_sink', sector: 0, amount: 1, elite: 0, allyPayment: 0 } satisfies Action,
    alternativeShipment: { type: 'ship', territory: 'arrakeen', sector: 10, amount: 1, elite: 0, allyPayment: 0 } satisfies Action,
    move: { type: 'move', from: 'arrakeen:10', territory: 'imperial_basin', sector: 9, amount: 1 } satisfies Action,
    alternativeMove: { type: 'move', from: 'arrakeen:10', territory: 'carthag', sector: 11, amount: 1 } satisfies Action,
    end: { type: 'endMovement' } satisfies Action,
    sourceDisclosure: `${base.sourceDisclosure} This adapter continues the recorded original auction, normal Revival and ` +
      'Harkonnen endMovement to clean phase5 Atreides. Both native opening Truthtrances remain physically in Harkonnen custody; ' +
      'each later declaration uses a distinct genuine card. All selected action counts come from actual recorded arrays. ' +
      'No native stopping card is present to demonstrate an opponent-caused loss of the final route, so this source proves ' +
      'actual accepted-order binding and native compatibility, without claiming an opponent-release path.',
  };
}
export type TruthTravelOrderFixture = ReturnType<typeof createTruthTravelOrderFixture>;

export function declareTruthTravelOrder(f: TruthTravelOrderFixture, source = f.game, copy: 0 | 1 = 0,
  actions: TruthTravelOrderStep[] = []) {
  const before = structuredClone(source), from = actions.length;
  let game = actTruthTravelOrder(source, f.asker, { type: 'card', card: f.truths[copy] }, actions);
  while (game.truthtrance?.stage === 'priority') {
    const actor = game.players.find(player => !game.truthtrance!.passed.includes(player.id)); assert.ok(actor);
    game = actTruthTravelOrder(game, actor.id, { type: 'truthPass' }, actions);
  }
  assert.equal(game.truthtrance?.stage, 'ask');
  return { game, before, actions, steps: structuredClone(actions.slice(from)), actionCount: actions.length - from };
}
export function askTruthTravelOrder(game: Game, asker: string, question: TruthQuestion,
  actions: TruthTravelOrderStep[] = []): Game {
  return actTruthTravelOrder(game, asker, { type: 'truthAsk', question: structuredClone(question) }, actions);
}
export function answerTruthTravelOrder(game: Game, target: string, answer: 'yes' | 'no',
  actions: TruthTravelOrderStep[] = []): Game {
  return actTruthTravelOrder(game, target, { type: 'truthAnswer', answer }, actions);
}
export function bindTruthTravelOrder(f: TruthTravelOrderFixture, source: Game, copy: 0 | 1,
  question: TruthQuestion, answer: 'yes' | 'no' = 'yes', actions: TruthTravelOrderStep[] = []) {
  const declared = declareTruthTravelOrder(f, source, copy, actions);
  const asked = askTruthTravelOrder(declared.game, f.asker, question, actions);
  const game = answerTruthTravelOrder(asked, f.target, answer, actions);
  return { game, declared, asked, actions };
}
export function truthTravelOrderQuestion(f: TruthTravelOrderFixture, mixed: TruthTravelExpression): TruthQuestion {
  return { kind: 'travel', target: f.target, turn: f.game.turn, mixed: structuredClone(mixed) };
}
