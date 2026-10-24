import assert from 'node:assert/strict';
import { viewGame, type Action, type Game } from '../game/engine';
import { location, splitLocation } from '../game/board';
import {
  actHajrReplay, advanceHajrReplay, createHajrReplayFixture, hajrReplayClean,
  hajrReplayMove, hajrReplayPlayer, nextHajrReplayStep, type HajrReplayStep,
} from './fixture-hajr-replay';

export type TruthMovementBoxStep = HajrReplayStep;
export const actTruthMovementBox = actHajrReplay;
export const truthMovementBoxPlayer = hajrReplayPlayer;
export const truthMovementBoxClean = hajrReplayClean;
export function truthMovementBoxInventory(game: Game) {
  const cards = [...game.deck, ...game.discard, ...(game.richeseCache ?? []), ...(game.richeseRemoved ?? []),
    ...(game.auction?.cards.slice(game.auction.index) ?? []), ...game.players.flatMap(player => player.hand)];
  const ids = cards.map(card => card.id).sort();
  assert.equal(new Set(ids).size, ids.length, 'Every original physical card has one current location');
  return ids;
}
export const truthMovementBoxBalances = (game: Game) => Object.fromEntries(game.players.map(player => [player.id, player.spice]));

/** Native source responses only; the caller owns the question, paid private
 * selection and the active respondent's movement, including its ending. */
export function nextTruthMovementBoxStep(game: Game): TruthMovementBoxStep | null {
  if (game.truthtrance || game.pendingNullentropy) return null;
  if (game.phase === 5 && game.active === 'emperor' && hajrReplayClean(game)) return null;
  return nextHajrReplayStep(game);
}
export function advanceTruthMovementBox(game: Game, until: (state: Game) => boolean,
  actions: TruthMovementBoxStep[] = []): Game {
  for (let count = 0; count < 600; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The original Box/movement programme ended before its next control');
    const next = nextTruthMovementBoxStep(game);
    assert.ok(next, 'Supply the original Truthtrance, paid Box selection or active movement choice');
    game = actHajrReplay(game, next.actor, next.action, actions);
  }
  throw Error('The original Box/movement programme did not reach its finite boundary');
}

/** Public Basic setup and original purchases/forces only. The first actual Hajr
 * is spent and both earned movements are completed, so another ground move
 * requires recovery and replay of that same physical card. No question, Box
 * payment, private search, promise or third movement is submitted here. */
export function createTruthMovementBoxFixture() {
  const fixture = createHajrReplayFixture({ truthForGuild: true });
  const owner = fixture.owner, target = owner, asker = 'guild', truth = fixture.guildTruth;
  assert.ok(truth);
  let game = structuredClone(fixture.game);
  const originalCards = truthMovementBoxInventory(fixture.setup);
  const actions: TruthMovementBoxStep[] = structuredClone(fixture.actions);
  const act = (actor: string, action: Action) => { game = actHajrReplay(game, actor, action, actions); };
  const reach = () => { game = advanceHajrReplay(game, hajrReplayClean, actions); };
  const balances = truthMovementBoxBalances(game);
  const beforeHajr = structuredClone(game);
  act(owner, { type: 'card', card: fixture.hajr }); reach();
  const afterHajr = structuredClone(game);
  const moves: { before: Game; step: TruthMovementBoxStep; after: Game }[] = [];
  let from = fixture.source;
  for (let count = 0; count < 2; count++) {
    const before = structuredClone(game), step: TruthMovementBoxStep = { actor: owner, action: hajrReplayMove(game, from) };
    act(step.actor, step.action); reach();
    moves.push({ before, step: structuredClone(step), after: structuredClone(game) });
    from = location(String(step.action.territory), Number(step.action.sector));
  }
  const source = structuredClone(game), own = hajrReplayPlayer(game);
  const ownView = viewGame(game, owner).players.find(player => player.id === owner)!;
  assert.equal(game.advanced, false); assert.equal(game.phase, 5); assert.equal(game.active, owner);
  assert.equal(own.moved, 2); assert.equal(ownView.movesAllowed, 2); assert.equal(ownView.hajrPlays, 1);
  assert.equal(own.spice, 2, 'The genuine purchases and shipment retain exactly the printed Box fee');
  assert.ok(own.hand.some(card => card.id === fixture.box));
  assert.equal(game.discard.filter(card => card.id === fixture.hajr).length, 1);
  assert.ok(!own.hand.some(card => card.id === fixture.hajr));
  assert.ok(hajrReplayPlayer(game, asker).hand.some(card => card.id === truth));
  assert.ok(!game.truthtrance && !game.pendingNullentropy && !game.pendingTreacheryDiscard);
  assert.equal(game.movementPromises, undefined);
  assert.deepEqual(truthMovementBoxBalances(game), balances);
  assert.deepEqual(truthMovementBoxInventory(game), originalCards);
  const proposedThirdMove = hajrReplayMove(game, from);
  const destination = splitLocation(location(String(proposedThirdMove.territory), Number(proposedThirdMove.sector)));
  const claim = { kind: 'movement' as const, target, territory: destination.territory, minimum: 1 };
  return {
    game, source, fixture, lobby: fixture.lobby, setup: fixture.setup, beforeStartingDeal: fixture.beforeStartingDeal,
    startingDealSelection: fixture.startingDealSelection, afterSetup: fixture.afterSetup,
    acquired: fixture.acquired, beforeShipment: fixture.beforeShipment, shipmentStep: fixture.shipmentStep,
    afterShipment: fixture.afterShipment, beforeHajr, afterHajr, moves,
    owner, target, asker, truth, hajr: fixture.hajr, box: fixture.box, boxFee: 2,
    claim, proposedThirdMove, thirdOrigin: from, destination, originalCards,
    actions, sourceActionCount: actions.length, balances,
    staging: [
      ...fixture.staging,
      'One original unopened Guild starting-deal slot receives original Truthtrance. The native source actually buys Box for1 and Hajr for1 and ships three physical Emperor forces at its original six-spice desert tariff. Actual Basic Hajr plus two ordinary one-force movements exhaust the two current allowances while leaving exactly two owned spice and the held Box. The first Hajr is physically discarded once and publicly used; native Semuta acknowledgements finish that same original cost. No dealt hand, wallet, force, clock, bonus, promise or pending receipt is installed. This source stops before the Truthtrance declaration/answer and before paying for the Box. The later real definite Truthtrance answer naturally adds another eligible discard, so the paid search can have multiple actual cards without an injected distractor.',
    ],
  };
}
export type TruthMovementBoxFixture = ReturnType<typeof createTruthMovementBoxFixture>;
