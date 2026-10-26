import assert from 'node:assert/strict';
import { viewGame, type Action, type Game } from '../game/engine';
import type { MixedActionExpression } from '../game/mixed-action-question';
import type { TravelActionClaim } from '../game/travel-expression-promises';
import type { TruthFact } from '../game/truthtrance';
import { nextStrongholdFactionsNativeStep } from './fixture-stronghold-factions';
import {
  actTruthMixedMovement, createTruthMixedMovementFixture, truthMixedMovementClean,
  truthMixedMovementInventory, truthMixedMovementPlayer, type TruthMixedMovementStep,
} from './fixture-truth-mixed-movement';
import { createTruthMovementWaitingFixture } from './fixture-truth-movement-waiting';

export type TruthTravelExpression = MixedActionExpression<TravelActionClaim>;
export type TruthTravelStep = TruthMixedMovementStep;
export const actTruthTravel = actTruthMixedMovement;
export const truthTravelClean = truthMixedMovementClean;
export const truthTravelInventory = truthMixedMovementInventory;
export const truthTravelPlayer = truthMixedMovementPlayer;
export const truthTravelFact = (fact: TruthFact): TruthTravelExpression => ({ kind: 'fact', fact });
export const truthTravelShip = (territory = 'polar_sink', minimum = 1): TruthTravelExpression =>
  ({ kind: 'action', action: { kind: 'ship', territory, minimum } });
export const truthTravelMove = (territory = 'imperial_basin', minimum = 1): TruthTravelExpression =>
  ({ kind: 'action', action: { kind: 'move', territory, minimum } });
export const truthTravelGroup = (kind: 'and' | 'or', ...terms: TruthTravelExpression[]): TruthTravelExpression =>
  ({ kind, terms });

/** One original public Basic base33 start. Active stops immediately before the
 * source's paid Polar Sink shipment; shipped retains that one actual action.
 * Waiting replays the original unopened deal reversal and native phase prefix.
 * Charity is only an explicitly unsupported-window source for a boundary test.
 * Every selected count comes from the corresponding recorded action array. */
export function createTruthTravelFixture(options: {
  hajr?: boolean; window?: 'active' | 'waiting' | 'shipped' | 'charity'; mixed?: TruthTravelExpression;
} = {}) {
  const window = options.window ?? 'active';
  const activeSource = window === 'waiting' ? null : createTruthMixedMovementFixture({
    hajr: options.hajr, window: window === 'charity' ? 'charity' : 'active',
  });
  const waitingSource = window === 'waiting' ? createTruthMovementWaitingFixture({ hajr: options.hajr }) : null;
  const original = activeSource ?? waitingSource!;
  let game = structuredClone(original.game), actions = structuredClone(original.actions);
  let shipmentIndex: number | null = null;
  if (window === 'active') {
    assert.ok(activeSource);
    shipmentIndex = activeSource.actions.findIndex(step => step.actor === activeSource.shipmentStep.actor &&
      JSON.stringify(step.action) === JSON.stringify(activeSource.shipmentStep.action));
    assert.ok(shipmentIndex >= 0, 'The source records its original paid shipment explicitly');
    game = structuredClone(activeSource.beforeShipment);
    actions = structuredClone(activeSource.actions.slice(0, shipmentIndex));
  }
  const asker = original.asker, target = original.target;
  const shipmentAction: Action = waitingSource ? structuredClone(waitingSource.shipment) :
    structuredClone(activeSource!.shipmentStep.action);
  const firstMove: Action = waitingSource ? structuredClone(waitingSource.move) : structuredClone(activeSource!.firstMove);
  const secondMove: Action = waitingSource
    ? { type: 'move', from: 'arrakeen:10', territory: 'imperial_basin', sector: 9, amount: 1 }
    : structuredClone(activeSource!.secondMove);
  const shipmentTerritory = String(shipmentAction.territory), movementTerritory = String(firstMove.territory);
  const mixed = options.mixed ?? truthTravelGroup('and', truthTravelShip(shipmentTerritory), truthTravelMove(movementTerritory));
  const question = { kind: 'travel' as const, target, turn: game.turn, mixed };
  const hajrCard = original.setup.deck.find(card => card.effect === 'hajr'); assert.ok(hajrCard);
  const projectile = original.setup.deck.find(card => card.kind === 'projectile'); assert.ok(projectile);
  const hajrFact: TruthFact = { kind: 'hand', name: hajrCard.name };
  const projectileFact: TruthFact = { kind: 'hand', name: projectile.name };
  const spiceFact: TruthFact = { kind: 'spice', compare: 'gte', value: truthTravelPlayer(game, target).spice };
  assert.equal(game.advanced, false); assert.deepEqual(game.expansions, []);
  assert.ok(truthTravelClean(game)); assert.equal(game.pendingShipment ?? null, null);
  assert.ok(truthTravelPlayer(game, asker).hand.some(card => card.id === original.truth));
  assert.deepEqual(truthTravelInventory(game), original.originalCards);
  assert.equal(game.travelPromises?.length ?? 0, 0);
  return {
    game, source: structuredClone(game), base: original, activeSource, waitingSource, window,
    asker, target, truth: original.truth, card: original.truth, hajr: original.hajr,
    setup: original.setup, lobby: original.lobby, beforeStartingDeal: original.beforeStartingDeal,
    afterSetup: original.afterSetup, beforeShipment: activeSource?.beforeShipment ?? null,
    originalCards: original.originalCards, originalSpice: original.originalSpice,
    dealOrder: original.dealOrder, spiceOrder: original.spiceOrder, startingPositions: original.startingPositions,
    actions, sourceActions: actions, sourceActionCount: actions.length, sourceCount: actions.length,
    sourceCounts: { selected: actions.length, inherited: original.sourceActionCount, shipment: shipmentIndex },
    mixed, question, hajrFact, projectileFact, spiceFact,
    shipmentAction, shipmentStep: { actor: target, action: shipmentAction },
    shipmentTerritory, movementTerritory, firstMove, secondMove, sameDestinationMove: { ...firstMove },
    shipmentCost: waitingSource ? waitingSource.shipmentCost : 2,
    hajrAction: original.hajr ? { type: 'card', card: original.hajr } satisfies Action : null,
    declaration: { type: 'card', card: original.truth } satisfies Action,
    questionAction: { type: 'truthAsk', question } satisfies Action,
    currentMove: waitingSource?.currentMove ?? null,
    currentEnd: { type: 'endMovement' } satisfies Action,
    sourceDisclosure: `${'sourceDisclosure' in original ? original.sourceDisclosure : original.staging.join(' ')} ` +
      `This travel adapter selects only the recorded ${window} native prefix and original raw structured question. ` +
      'Its shipment leaves all refer to one future original reserve shipment after answering, and ground leaves refer to actual native ground groups. ' +
      'The source has one actually dealt Truthtrance, so simultaneous prior scalar-plus-travel answers are outside this fixture. ' +
      'No additional physical card, dealt hand, purse, force, played clock, promise, receipt or compiled fact is installed.',
  };
}
export type TruthTravelFixture = ReturnType<typeof createTruthTravelFixture>;

export function declareTruthTravel(f: TruthTravelFixture, source = f.game) {
  const before = structuredClone(source), actions: TruthTravelStep[] = [];
  let game = actTruthTravel(source, f.asker, f.declaration, actions);
  const opened = structuredClone(game);
  while (game.truthtrance?.stage === 'priority') {
    const actor = game.players.find(player => !game.truthtrance!.passed.includes(player.id)); assert.ok(actor);
    game = actTruthTravel(game, actor.id, { type: 'truthPass' }, actions);
  }
  assert.equal(game.truthtrance?.stage, 'ask');
  return { game, before, opened, actions, actionCount: actions.length };
}
export function askTruthTravel(game: Game, asker: string, target: string, mixed: TruthTravelExpression,
  actions: TruthTravelStep[] = []): Game {
  return actTruthTravel(game, asker, { type: 'truthAsk', question: {
    kind: 'travel', target, turn: game.turn, mixed: structuredClone(mixed),
  } }, actions);
}
export function answerTruthTravel(game: Game, target: string, answer: 'yes' | 'no', actions: TruthTravelStep[] = []): Game {
  return actTruthTravel(game, target, { type: 'truthAnswer', answer }, actions);
}
export function bindTruthTravel(f: TruthTravelFixture, answer: 'yes' | 'no' = 'yes', mixed = f.mixed, source = f.game) {
  const declared = declareTruthTravel(f, source), actions = [...declared.actions];
  const asked = askTruthTravel(declared.game, f.asker, f.target, mixed, actions);
  const game = answerTruthTravel(asked, f.target, answer, actions);
  return { game, declared, asked, actions, actionCount: actions.length };
}

/** The private aggregate exposes the original question and its status only. */
export function truthTravelPromise(game: Game, target = game.travelPromises?.[0]?.player ?? game.players[0].id) {
  const row = viewGame(game, target).travelPromises.find(promise => promise.player === target);
  assert.ok(row, 'The respondent retains the raw travel question and aggregate answer');
  return row;
}
export function nextTruthTravel(game: Game): TruthTravelStep | null {
  if (game.truthtrance) return null;
  for (const player of game.players) {
    const guide = viewGame(game, player.id).travelPromiseGuide;
    if (guide) return { actor: player.id, action: guide.action };
  }
  return nextStrongholdFactionsNativeStep(game);
}
export function advanceTruthTravel(game: Game, until: (state: Game) => boolean, actions: TruthTravelStep[] = []): Game {
  for (let count = 0; count < 800; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The original travel source ended before its requested native boundary');
    const next = nextTruthTravel(game); assert.ok(next, 'Supply the original Truthtrance question or answer');
    game = actTruthTravel(game, next.actor, next.action, actions);
  }
  throw Error('The original travel source did not reach its finite boundary');
}
export function settleTruthTravel(game: Game, actions: TruthTravelStep[] = []): Game {
  return advanceTruthTravel(game, state => truthTravelClean(state) && !state.pendingShipment, actions);
}
export function completeTruthTravel(game: Game, target = game.travelPromises?.[0]?.player ?? game.players[0].id,
  actions: TruthTravelStep[] = []): Game {
  for (let count = 0; count < 16; count++) {
    const promise = truthTravelPromise(game, target);
    if (promise.fulfilled || promise.released) return game;
    game = settleTruthTravel(game, actions);
    const guide = viewGame(game, target).travelPromiseGuide; assert.ok(guide, 'The accepted travel answer has a native completion');
    game = settleTruthTravel(actTruthTravel(game, target, guide.action, actions), actions);
  }
  throw Error('The exact original native travel guide did not settle the accepted aggregate');
}
export function finishTruthTravel(game: Game, target = game.travelPromises?.[0]?.player ?? game.players[0].id,
  actions: TruthTravelStep[] = []): Game {
  game = settleTruthTravel(game, actions);
  assert.equal(game.phase, 5); assert.equal(game.active, target);
  game = settleTruthTravel(actTruthTravel(game, target, { type: 'endMovement' }, actions), actions);
  assert.ok(!game.movementRemaining?.includes(target), 'Only actual owner endMovement closes this native interval');
  return game;
}
