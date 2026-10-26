import assert from 'node:assert/strict';
import { viewGame, type Action, type Game } from '../game/engine';
import { nextStrongholdFactionsNativeStep } from './fixture-stronghold-factions';
import { createTruthMovementEarlyFixture } from './fixture-truth-movement-early';
import {
  createTruthMovementNativeEarlyFixture, nextTruthMovementNativeEarlyStep,
  type TruthMovementNativeEarlyAuction, type TruthMovementNativeEarlyRoster,
} from './fixture-truth-movement-native-early';
import { createTruthMixedMovementFixture } from './fixture-truth-mixed-movement';
import { createTruthRevivalEarlyFixture } from './fixture-truth-revival-early';
import {
  actTruthTravel, truthTravelClean, truthTravelFact, truthTravelGroup,
  truthTravelInventory, truthTravelMove, truthTravelPlayer, truthTravelPromise,
  truthTravelShip, type TruthTravelExpression, type TruthTravelStep,
} from './fixture-truth-travel';

export type TruthTravelEarlyStep = TruthTravelStep;
export const actTruthTravelEarly = actTruthTravel;
export const truthTravelEarlyClean = truthTravelClean;
export const truthTravelEarlyInventory = truthTravelInventory;
export const truthTravelEarlyPlayer = truthTravelPlayer;
export const truthTravelEarlyPromise = truthTravelPromise;
export { truthTravelFact, truthTravelGroup, truthTravelMove, truthTravelShip };
export type { TruthTravelExpression };

/** Replay current native controls. A private guide always belongs to this
 * phase and event; the source's real auction and response controls do the rest. */
export function nextTruthTravelEarly(game: Game,
  auction: TruthMovementNativeEarlyAuction = {}): TruthTravelEarlyStep | null {
  if (game.truthtrance) return null;
  for (const player of game.players) {
    const guide = viewGame(game, player.id).travelPromiseGuide;
    if (guide) return { actor: player.id, action: guide.action };
  }
  if (game.players.some(player => ['richese', 'choam', 'ecaz', 'moritani', 'ixians', 'tleilaxu'].includes(player.faction)))
    return nextTruthMovementNativeEarlyStep(game, auction);
  if (!game.response && !game.phaseOpening && game.decision?.kind === 'revivalStop')
    return { actor: game.decision.player, action: { type: 'decision', decline: true } };
  return nextStrongholdFactionsNativeStep(game);
}
export function advanceTruthTravelEarly(game: Game, until: (state: Game) => boolean,
  actions: TruthTravelEarlyStep[] = [], auction: TruthMovementNativeEarlyAuction = {}): Game {
  for (let count = 0; count < 1800; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The original early travel source ended before its native boundary');
    const next = nextTruthTravelEarly(game, auction);
    assert.ok(next, 'Supply the actual Truthtrance question, answer or owned movement before continuing');
    game = actTruthTravelEarly(game, next.actor, next.action, actions);
  }
  throw Error('The original early travel source did not reach its finite boundary');
}
export function settleTruthTravelEarly(game: Game, actions: TruthTravelEarlyStep[] = [],
  auction: TruthMovementNativeEarlyAuction = {}): Game {
  return advanceTruthTravelEarly(game, state => truthTravelEarlyClean(state) && !state.pendingShipment &&
    !state.pendingRevival, actions, auction);
}

/** Original sources only. Earlier snapshots exclude the later factory suffix;
 * unopened Spice selections are reapplied before their real phase controls.
 * The earned Revival source includes a real paid shipment and Storm casualties,
 * so its previous-turn shipment flag needs no controlled installation. */
export function createTruthTravelEarlyFixture(options: {
  source?: 'classic' | 'hajr' | 'native' | 'revival'; phase?: 0 | 1 | 2 | 3 | 4;
  advanced?: boolean; hajr?: boolean; poor?: boolean; roster?: TruthMovementNativeEarlyRoster;
  targetKarama?: boolean; minimum?: number; mixed?: TruthTravelExpression;
} = {}) {
  const kind = options.source ?? 'classic', phase = options.phase ?? 2;
  const classicSource = kind === 'classic'
    ? createTruthMovementEarlyFixture({ phase: phase < 2 ? 0 : 2 }) : null;
  const hajrSource = kind === 'hajr'
    ? createTruthMixedMovementFixture({ advanced: options.advanced, hajr: options.hajr, window: 'charity' }) : null;
  const nativeSource = kind === 'native' ? createTruthMovementNativeEarlyFixture({ roster: options.roster }) : null;
  const revivalSource = kind === 'revival' ? createTruthRevivalEarlyFixture({
    advanced: options.advanced, phase: phase === 4 ? 3 : phase, poor: options.poor,
    targetKarama: options.targetKarama,
  }) : null;
  const original = classicSource ?? hajrSource ?? nativeSource ?? revivalSource!;
  let game = structuredClone(original.game), actions: TruthTravelEarlyStep[] = structuredClone(original.actions);
  const initialPrefixCount = actions.length;
  const selectedSpice: { position: number; from: number; card: Game['spiceDeck'][number] }[] = [];
  if (phase < 2 && (hajrSource || nativeSource)) {
    const base = hajrSource ?? nativeSource!;
    assert.ok(base.afterSetupActionCount !== null);
    game = structuredClone(base.afterSetup);
    actions = structuredClone(base.actions.slice(0, base.afterSetupActionCount));
    for (const { position, card } of base.spiceOrder) {
      const from = game.spiceDeck.findIndex((candidate, index) => index >= position &&
        JSON.stringify(candidate) === JSON.stringify(card));
      assert.ok(from >= position, 'Select the same original still-unopened Spice card');
      const selected = game.spiceDeck.splice(from, 1)[0]; game.spiceDeck.splice(position, 0, selected);
      selectedSpice.push({ position, from, card: structuredClone(selected) });
    }
  }
  if (game.phase !== phase) game = advanceTruthTravelEarly(game,
    state => state.phase === phase && truthTravelEarlyClean(state), actions);
  const asker = original.asker, target = original.target;
  const truth = classicSource?.truth ?? hajrSource?.truth ?? nativeSource?.truth ?? revivalSource!.truth;
  const originalCards = original.originalCards;
  const minimum = options.minimum ?? (hajrSource ? 1 : revivalSource ? 2 : 8);
  const shipmentAction: Action = hajrSource
    ? { type: 'ship', territory: 'polar_sink', sector: 0, amount: minimum, elite: 0, allyPayment: 0 }
    : { type: 'ship', territory: 'arrakeen', sector: 10, amount: minimum, elite: 0, allyPayment: 0 };
  const firstMove: Action = hajrSource
    ? { type: 'move', from: 'arrakeen:10', territory: 'imperial_basin', sector: 9, amount: minimum }
    : { type: 'move', from: 'arrakeen:10', territory: 'carthag', sector: 11, amount: minimum };
  const secondMove: Action = { type: 'move', from: 'arrakeen:10', territory: 'carthag', sector: 11, amount: minimum };
  const mixed = options.mixed ?? truthTravelGroup('and',
    truthTravelShip(String(shipmentAction.territory), minimum), truthTravelMove(String(firstMove.territory), minimum));
  const question = { kind: 'travel' as const, target, turn: game.turn, mixed };
  assert.equal(game.status, 'playing'); assert.equal(game.phase, phase);
  assert.ok(truthTravelEarlyClean(game));
  assert.equal(game.travelPromises?.length ?? 0, 0);
  assert.deepEqual(truthTravelEarlyInventory(game), originalCards);
  assert.ok(truthTravelEarlyPlayer(game, asker).hand.some(card => card.id === truth));
  const sourceDisclosure = 'sourceDisclosure' in original ? original.sourceDisclosure : original.staging.join(' ');
  return {
    game, source: structuredClone(game), kind, phase, base: original,
    classicSource, hajrSource, nativeSource, revivalSource,
    asker, target, truth, card: truth, hajr: hajrSource?.hajr ?? null,
    setup: original.setup, lobby: original.lobby, beforeStartingDeal: original.beforeStartingDeal,
    afterSetup: original.afterSetup, originalCards, originalSpice: original.originalSpice,
    dealOrder: original.dealOrder, spiceOrder: original.spiceOrder, selectedSpice,
    actions, sourceActions: actions, sourceActionCount: actions.length,
    sourceCounts: { inherited: initialPrefixCount, selected: actions.length,
      setup: actions.findIndex(step => step.action.type === 'start') + 1,
      priorShipments: actions.filter(step => step.actor === target && step.action.type === 'ship').length,
      priorRevivals: actions.filter(step => step.actor === target && step.action.type === 'revive').length },
    minimum, mixed, question, shipmentAction, firstMove, secondMove,
    shipmentCost: minimum * (hajrSource ? 2 : 1),
    declaration: { type: 'card', card: truth } satisfies Action,
    questionAction: { type: 'truthAsk', question } satisfies Action,
    hajrAction: hajrSource?.hajr ? { type: 'card', card: hajrSource.hajr } satisfies Action : null,
    currentEnd: { type: 'endMovement' } satisfies Action,
    sourceDisclosure: `${sourceDisclosure} This early travel adapter retains only the recorded ${actions.length}-action ` +
      `phase${phase} prefix. The caller supplies the whole travel question, answer and all later real actions. ` +
      'No card, dealt hand, wallet, army, clock, ready list, old shipment flag, promise or receipt is installed.',
  };
}
export type TruthTravelEarlyFixture = ReturnType<typeof createTruthTravelEarlyFixture>;

export function declareTruthTravelEarly(f: TruthTravelEarlyFixture, source = f.game,
  actions: TruthTravelEarlyStep[] = []) {
  let game = actTruthTravelEarly(source, f.asker, f.declaration, actions);
  const opened = structuredClone(game);
  while (game.truthtrance?.stage === 'priority') {
    const player = game.players.find(player => !game.truthtrance!.passed.includes(player.id)); assert.ok(player);
    game = actTruthTravelEarly(game, player.id, { type: 'truthPass' }, actions);
  }
  assert.equal(game.truthtrance?.stage, 'ask');
  return { game, opened, actions };
}
export function askTruthTravelEarly(f: TruthTravelEarlyFixture, source = f.game,
  mixed = f.mixed, actions: TruthTravelEarlyStep[] = []) {
  const declared = declareTruthTravelEarly(f, source, actions);
  assert.ok(viewGame(declared.game, f.asker).truthTravelTargets.includes(f.target));
  const game = actTruthTravelEarly(declared.game, f.asker, { type: 'truthAsk', question: {
    kind: 'travel', target: f.target, turn: source.turn, mixed: structuredClone(mixed),
  } }, actions);
  return { game, declared, actions };
}
export function bindTruthTravelEarly(f: TruthTravelEarlyFixture, answer: 'yes' | 'no' = 'yes',
  mixed = f.mixed, source = f.game, actions: TruthTravelEarlyStep[] = []) {
  const asked = askTruthTravelEarly(f, source, mixed, actions);
  assert.ok(viewGame(asked.game, f.target).truthTravelAnswers?.includes(answer));
  const game = settleTruthTravelEarly(actTruthTravelEarly(asked.game, f.target,
    { type: 'truthAnswer', answer }, actions), actions);
  return { game, asked, actions, actionCount: actions.length };
}
export function reachTruthTravelEarlyMovement(f: TruthTravelEarlyFixture, game: Game,
  actions: TruthTravelEarlyStep[] = [], auction: TruthMovementNativeEarlyAuction = {}) {
  return advanceTruthTravelEarly(game, state => state.phase === 5 && state.active === f.target &&
    truthTravelEarlyClean(state) && !state.pendingShipment, actions, auction);
}
export function finishTruthTravelEarly(f: TruthTravelEarlyFixture, game: Game,
  actions: TruthTravelEarlyStep[] = []): Game {
  game = settleTruthTravelEarly(game, actions);
  assert.equal(game.phase, 5); assert.equal(game.active, f.target);
  game = settleTruthTravelEarly(actTruthTravelEarly(game, f.target, f.currentEnd, actions), actions);
  assert.ok(!game.movementRemaining?.includes(f.target));
  return game;
}
export function completeTruthTravelEarly(f: TruthTravelEarlyFixture, game: Game,
  actions: TruthTravelEarlyStep[] = []): Game {
  return advanceTruthTravelEarly(game, state => {
    const row = truthTravelEarlyPromise(state, f.target);
    return !!row.fulfilled || !!row.released;
  }, actions);
}
