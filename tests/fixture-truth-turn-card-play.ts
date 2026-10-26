import assert from 'node:assert/strict';
import { viewGame, type Action, type Game } from '../game/engine';
import type { MixedActionExpression } from '../game/mixed-action-question';
import type { TruthFact, TruthQuestion } from '../game/truthtrance';
import { createTruthTravelFixture } from './fixture-truth-travel';
import { createTruthMixedMovementFixture } from './fixture-truth-mixed-movement';
import { createTruthMovementGholaFixture } from './fixture-truth-movement-ghola';
import { createTruthRevivalFixture } from './fixture-truth-revival';
import { createTruthLeaderRevivalFixture } from './fixture-truth-leader-revival';
import { location } from '../game/board';
import {
  actHajrReplay, advanceHajrReplay, createHajrReplayFixture, hajrReplayClean, hajrReplayMove,
} from './fixture-hajr-replay';
import { nextRicheseStrongholdsNativeStep } from './fixture-richese-strongholds';
import { actTruthMovement, truthMovementInventory, truthMovementPlayer, type TruthMovementStep } from './fixture-truth-movement';
import type { TruthTurnCombatLeaf } from './fixture-truth-turn-combat';

export type TruthTurnCardPlayLeaf = TruthTurnCombatLeaf | { kind: 'cardPlay'; effect: 'hajr' | 'ghola' };
export type TruthTurnCardPlayExpression = MixedActionExpression<TruthTurnCardPlayLeaf>;
export type TruthTurnCardPlayStep = TruthMovementStep;
export const actTruthTurnCardPlay = actTruthMovement;
export const truthTurnCardPlayInventory = truthMovementInventory;
export const truthTurnCardPlayPlayer = truthMovementPlayer;
export const truthTurnCardPlayClean = (game: Game) => !game.truthtrance && !game.response && !game.decision &&
  !game.phaseOpening && !game.pendingTreacheryDiscard && !game.pendingShipment && !game.pendingRevival;
export const truthTurnCardPlayFact = (fact: TruthFact): TruthTurnCardPlayExpression => ({ kind: 'fact', fact });
export const truthTurnCardPlayUse = (effect: 'hajr' | 'ghola'): TruthTurnCardPlayExpression =>
  ({ kind: 'action', action: { kind: 'cardPlay', effect } });
export const truthTurnCardPlayPayment = (recipient: string, minimum = 2): TruthTurnCardPlayExpression =>
  ({ kind: 'action', action: { kind: 'payment', recipient, minimum } });
export const truthTurnCardPlayShip = (territory = 'polar_sink', minimum = 1): TruthTurnCardPlayExpression =>
  ({ kind: 'action', action: { kind: 'ship', territory, minimum } });
export const truthTurnCardPlayForce = (minimum = 2, counter: 'total' | 'normal' | 'elite' = 'total'):
TruthTurnCardPlayExpression => ({ kind: 'action', action: { kind: 'forces', minimum, counter } });
export const truthTurnCardPlayGroup = (kind: 'and' | 'or', ...terms: TruthTurnCardPlayExpression[]): TruthTurnCardPlayExpression =>
  ({ kind, terms });

/** The supported Advanced original avoids Basic Richese's Semuta preview.
 * Stop after move1 then its actual Hajr, preserving one native movement for
 * after the future paid Box recovery. The Box itself supplies no Hajr timing. */
function createSupportedHajrReplaySource() {
  const base = createHajrReplayFixture({ advanced: true, truthForGuild: true });
  const actions = structuredClone(base.actions), inherited = actions.length;
  let game = structuredClone(base.game);
  const firstMove = hajrReplayMove(game, base.source);
  game = actHajrReplay(game, base.owner, firstMove, actions);
  game = advanceHajrReplay(game, hajrReplayClean, actions);
  game = actHajrReplay(game, base.owner, { type: 'card', card: base.hajr }, actions);
  game = advanceHajrReplay(game, hajrReplayClean, actions);
  const truth = base.guildTruth; assert.ok(truth);
  const originalCards = truthMovementInventory(base.setup);
  assert.equal(game.advanced, true); assert.ok(!game.semutaPreview);
  assert.equal(truthMovementPlayer(game, base.owner).moved, 1);
  assert.equal(truthMovementPlayer(game, base.owner).hajrPlays, 1);
  assert.equal(truthMovementPlayer(game, base.owner).spice, 2);
  assert.ok(truthMovementPlayer(game, base.owner).hand.some(card => card.id === base.box));
  assert.equal(game.discard.filter(card => card.id === base.hajr).length, 1);
  assert.deepEqual(truthMovementInventory(game), originalCards);
  return { ...base, game, actions, asker: 'guild', target: base.owner, truth, originalCards,
    firstMove, secondMoveFrom: location(String(firstMove.territory), Number(firstMove.sector)),
    sourceActionCount: actions.length,
    sourceCounts: { inherited, nativeContinuation: actions.length - inherited, selected: actions.length },
    sourceDisclosure: `${base.staging.join(' ')} This is the original Advanced preview with Guild's unopened Truthtrance deal. ` +
      'A real first typed movement is followed immediately by the first actual Hajr, which is now physically discarded. ' +
      'The source stops at moved1/max2 with the owned Box and its exact two-spice fee. After a future answer, Box recovery must precede ' +
      'the second real movement that earns new Advanced timing for replay. No Basic Semuta composition or installed timing window is claimed.',
  };
}

/** Every option selects an existing genuine original source or its exact
 * earlier action prefix. Native deals, casualties, purchases and already used
 * Hajr all remain physical chronology; no played state is installed. */
export function createTruthTurnCardPlayFixture(options: {
  source?: 'hajr' | 'gholaForces' | 'gholaRevival' | 'gholaLeader' | 'hajrReplay';
  advanced?: boolean; early?: boolean; mixed?: TruthTurnCardPlayExpression;
} = {}) {
  const sourceKind = options.source ?? 'hajr', requestedAdvanced = options.advanced ?? false;
  assert.ok(!requestedAdvanced || sourceKind !== 'gholaForces',
    'Use the genuine typed Revival source for Advanced Ghola');
  const basicHajr = sourceKind === 'hajr' && !requestedAdvanced ? createTruthTravelFixture({ window: options.early ? 'charity' : 'active' }) : null;
  const advancedHajr = sourceKind === 'hajr' && requestedAdvanced ? createTruthMixedMovementFixture({ advanced: true, window: 'active' }) : null;
  const gholaForces = sourceKind === 'gholaForces' ? createTruthMovementGholaFixture() : null;
  const gholaRevival = sourceKind === 'gholaRevival' ? createTruthRevivalFixture({ targetGhola: true, advanced: requestedAdvanced }) : null;
  const gholaLeader = sourceKind === 'gholaLeader' ? createTruthLeaderRevivalFixture({ ghola: true, advanced: requestedAdvanced }) : null;
  const hajrReplay = sourceKind === 'hajrReplay' ? createSupportedHajrReplaySource() : null;
  const original = basicHajr ?? advancedHajr ?? gholaForces ?? gholaRevival ?? gholaLeader ?? hajrReplay!;
  const game = structuredClone(original.game), actions = structuredClone(original.actions), advanced = game.advanced;
  const asker = original.asker, target = original.target, recipient = asker;
  const effect: 'hajr' | 'ghola' = sourceKind === 'hajr' || sourceKind === 'hajrReplay' ? 'hajr' : 'ghola';
  const hajr = basicHajr?.hajr ?? advancedHajr?.hajr ?? hajrReplay?.hajr ?? null;
  const ghola = gholaForces?.ghola ?? gholaRevival?.ghola ?? gholaLeader?.ghola ?? null;
  const card = effect === 'hajr' ? hajr : ghola; assert.ok(card);
  const truths = structuredClone(gholaRevival?.truths ?? gholaLeader?.truths ?? [original.truth]);
  const mixed = structuredClone(options.mixed ?? (hajrReplay ? truthTurnCardPlayUse(effect)
    : truthTurnCardPlayGroup('and', truthTurnCardPlayUse(effect), truthTurnCardPlayPayment(recipient))));
  const question = { kind: 'turnActions', target, turn: game.turn, mixed } satisfies TruthQuestion;
  const spiceFact: TruthFact = { kind: 'spice', compare: 'eq', value: truthMovementPlayer(game, target).spice };
  const firstMove: Action = basicHajr?.firstMove ?? advancedHajr?.firstMove ??
    { type: 'move', from: 'arrakeen:10', territory: 'imperial_basin', sector: 9, amount: 1 };
  const cardAction: Action = effect === 'hajr' ? { type: 'card', card } : gholaLeader
    ? { type: 'card', card, leader: gholaLeader.leader }
    : { type: 'card', card, amount: 1, elite: advanced ? 1 : 0 };
  const sourceDisclosure = 'sourceDisclosure' in original ? original.sourceDisclosure : original.staging.join(' ');
  assert.ok(truthTurnCardPlayClean(game)); assert.equal(game.turnActionPromises?.length ?? 0, 0);
  assert.ok(truths.every(truth => truthMovementPlayer(game, asker).hand.some(held => held.id === truth)));
  assert.deepEqual(truthMovementInventory(game), original.originalCards);
  return {
    game, source: structuredClone(game), sourceKind, effect, advanced, early: options.early ?? false,
    basicHajr, advancedHajr, gholaForces, gholaRevival, gholaLeader, hajrReplay,
    asker, target, recipient, truth: truths[0], truths, card, hajr, ghola, mixed, question, spiceFact,
    setup: original.setup, afterSetup: original.afterSetup, beforeStartingDeal: original.beforeStartingDeal,
    originalCards: original.originalCards, actions, sourceActions: actions, sourceActionCount: actions.length,
    sourceCounts: { selected: actions.length, inherited: original.actions.length },
    cardAction, firstMove,
    payment: { type: 'bribe', target: recipient, amount: 2 } satisfies Action,
    shipment: { type: 'ship', territory: 'polar_sink', sector: 0, amount: 1, elite: 0, allyPayment: 0 } satisfies Action,
    end: { type: 'endMovement' } satisfies Action,
    ordinaryForces: { type: 'revive', amount: 2, elite: 0 } satisfies Action,
    leader: gholaLeader?.leader ?? null, box: hajrReplay?.box ?? null,
    sourceDisclosure: `${sourceDisclosure} This adapter changes only the raw turn-action question. Future accepted printed-role play ` +
      'must occur after the actual answer; earlier use, recovery, an ordinary return or another role of the same card is not a new Hajr/Ghola play. ' +
      'All selected source counts derive from recorded arrays. No played hand, purse, army, casualty, clock, card, answer or receipt is installed.',
  };
}
export type TruthTurnCardPlayFixture = ReturnType<typeof createTruthTurnCardPlayFixture>;

export function declareTruthTurnCardPlay(f: TruthTurnCardPlayFixture, source = f.game, copy: 0 | 1 = 0,
  actions: TruthTurnCardPlayStep[] = []) {
  const before = structuredClone(source), from = actions.length;
  let game = actTruthTurnCardPlay(source, f.asker, { type: 'card', card: f.truths[copy] }, actions);
  while (game.truthtrance?.stage === 'priority') {
    const actor = game.players.find(candidate => !game.truthtrance!.passed.includes(candidate.id)); assert.ok(actor);
    game = actTruthTurnCardPlay(game, actor.id, { type: 'truthPass' }, actions);
  }
  assert.equal(game.truthtrance?.stage, 'ask'); return { game, before, actions, actionCount: actions.length - from };
}
export function askTruthTurnCardPlay(game: Game, asker: string, target: string, mixed: TruthTurnCardPlayExpression,
  actions: TruthTurnCardPlayStep[] = []): Game {
  return actTruthTurnCardPlay(game, asker, { type: 'truthAsk', question: {
    kind: 'turnActions', target, turn: game.turn, mixed: structuredClone(mixed),
  } }, actions);
}
export function answerTruthTurnCardPlay(game: Game, target: string, answer: 'yes' | 'no',
  actions: TruthTurnCardPlayStep[] = []): Game {
  return actTruthTurnCardPlay(game, target, { type: 'truthAnswer', answer }, actions);
}
export function bindTruthTurnCardPlay(f: TruthTurnCardPlayFixture, answer: 'yes' | 'no' = 'yes', mixed = f.mixed,
  source = f.game, copy: 0 | 1 = 0, actions: TruthTurnCardPlayStep[] = []) {
  const from = actions.length, declared = declareTruthTurnCardPlay(f, source, copy, actions);
  const asked = askTruthTurnCardPlay(declared.game, f.asker, f.target, mixed, actions);
  const game = answerTruthTurnCardPlay(asked, f.target, answer, actions);
  return { game, declared, asked, actions, actionCount: actions.length - from };
}
export function truthTurnCardPlayPromise(game: Game, target = game.turnActionPromises?.[0]?.player ?? game.players[0].id) {
  const row = viewGame(game, target).turnActionPromises.findLast(promise => promise.player === target); assert.ok(row); return row;
}
export function nextTruthTurnCardPlayNative(game: Game): TruthTurnCardPlayStep | null {
  if (game.truthtrance || game.pendingNullentropy) return null;
  return nextRicheseStrongholdsNativeStep(game);
}
export function nextTruthTurnCardPlay(game: Game): TruthTurnCardPlayStep | null {
  if (game.truthtrance) return null;
  for (const player of game.players) {
    const guide = viewGame(game, player.id).turnActionGuide;
    if (guide) return { actor: player.id, action: guide.action };
  }
  return nextTruthTurnCardPlayNative(game);
}
export function advanceTruthTurnCardPlay(game: Game, until: (state: Game) => boolean,
  actions: TruthTurnCardPlayStep[] = [], nativeOnly = false): Game {
  for (let count = 0; count < 1800; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The original card-play source ended before its requested native boundary');
    const next = nativeOnly ? nextTruthTurnCardPlayNative(game) : nextTruthTurnCardPlay(game);
    assert.ok(next, 'Supply the original Truthtrance, paid private selection or unsealed native battle');
    game = actTruthTurnCardPlay(game, next.actor, next.action, actions);
  }
  throw Error('The genuine card-play source did not reach its finite boundary');
}
export function settleTruthTurnCardPlay(game: Game, actions: TruthTurnCardPlayStep[] = []): Game {
  return advanceTruthTurnCardPlay(game, truthTurnCardPlayClean, actions);
}
export function finishTruthTurnCardPlay(game: Game, actions: TruthTurnCardPlayStep[] = []): Game {
  const turn = game.turn;
  return advanceTruthTurnCardPlay(game, state => state.turn === turn + 1 && state.phase === 0 && truthTurnCardPlayClean(state), actions);
}
