import assert from 'node:assert/strict';
import { viewGame, type Action, type Game } from '../game/engine';
import type { MixedActionExpression } from '../game/mixed-action-question';
import type { TruthFact, TruthQuestion } from '../game/truthtrance';
import { createHajrReplayFixture, hajrReplayMove } from './fixture-hajr-replay';
import { actTruthMovementBox, truthMovementBoxInventory, truthMovementBoxPlayer } from './fixture-truth-movement-box';
import { nextRicheseStrongholdsNativeStep } from './fixture-richese-strongholds';
import { truthTurnThumperSpice, truthTurnThumperTraitors } from './fixture-truth-turn-thumper';

export type TruthBoxPlayLeaf = { kind: 'cardPlay'; effect: 'nullentropyBox' } |
  { kind: 'payment'; recipient: string; minimum: number } | { kind: 'ship'; territory: string; minimum: number };
export type TruthBoxPlayExpression = MixedActionExpression<TruthBoxPlayLeaf>;
export type TruthBoxPlayStep = { actor: string; action: Action };
export const actTruthBoxPlay = actTruthMovementBox;
export const truthBoxPlayPlayer = truthMovementBoxPlayer;
export const truthBoxPlayInventory = truthMovementBoxInventory;
export const truthBoxPlaySpice = truthTurnThumperSpice;
export const truthBoxPlayTraitors = truthTurnThumperTraitors;
export const truthBoxPlayClean = (game: Game) => !game.phaseOpening && !game.response && !game.decision &&
  !game.truthtrance && !game.pendingTreacheryDiscard && !game.pendingNullentropy && !game.pendingShipment;
export const truthBoxPlayUse = (): TruthBoxPlayExpression => ({ kind: 'action', action: { kind: 'cardPlay', effect: 'nullentropyBox' } });
export const truthBoxPlayFact = (fact: TruthFact): TruthBoxPlayExpression => ({ kind: 'fact', fact });
export const truthBoxPlayPayment = (recipient: string, minimum = 2): TruthBoxPlayExpression =>
  ({ kind: 'action', action: { kind: 'payment', recipient, minimum } });
export const truthBoxPlayShip = (territory = 'polar_sink', minimum = 1): TruthBoxPlayExpression =>
  ({ kind: 'action', action: { kind: 'ship', territory, minimum } });
export const truthBoxPlayGroup = (kind: 'and' | 'or', ...terms: TruthBoxPlayExpression[]): TruthBoxPlayExpression => ({ kind, terms });

/** Original controls only. The actual paid private selection is left to the
 * caller; no free discard inspection or selected-card promise is introduced. */
export function nextTruthBoxPlayNative(game: Game): TruthBoxPlayStep | null {
  if (game.truthtrance || game.pendingNullentropy) return null;
  return nextRicheseStrongholdsNativeStep(game);
}
export function nextTruthBoxPlay(game: Game): TruthBoxPlayStep | null {
  if (game.truthtrance || game.pendingNullentropy) return null;
  for (const player of game.players) {
    const guide = viewGame(game, player.id).turnActionGuide;
    if (guide) return { actor: player.id, action: guide.action };
  }
  return nextTruthBoxPlayNative(game);
}
export function advanceTruthBoxPlay(game: Game, until: (state: Game) => boolean,
  actions: TruthBoxPlayStep[] = [], nativeOnly = false): Game {
  for (let count = 0; count < 1800; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The original Box chronology ended before its requested boundary');
    const step = nativeOnly ? nextTruthBoxPlayNative(game) : nextTruthBoxPlay(game);
    assert.ok(step, 'Supply the actual Truthtrance, paid Box selection or native sealed plan');
    game = actTruthBoxPlay(game, step.actor, step.action, actions);
  }
  throw Error('The original Box chronology did not reach its finite boundary');
}
export function settleTruthBoxPlay(game: Game, actions: TruthBoxPlayStep[] = []): Game {
  return advanceTruthBoxPlay(game, truthBoxPlayClean, actions, true);
}
export function finishTruthBoxPlay(game: Game, actions: TruthBoxPlayStep[] = []): Game {
  const turn = game.turn;
  return advanceTruthBoxPlay(game, state => state.turn === turn + 1, actions, true);
}

/** Exact native prefix of the existing public Richese/Emperor/Guild source.
 * Box is bought from the real cache for1 and Hajr in the real normal auction
 * for1. Stop BEFORE its recorded six-spice shipment, retaining Emperor8.
 * Basic's real Semuta marker is deliberately retained. */
export function createTruthBoxPlayFixture(options: { advanced?: boolean; multiple?: boolean; late?: boolean } = {}) {
  const advanced = options.advanced ?? false, multiple = options.multiple ?? false, late = options.late ?? false;
  const base = createHajrReplayFixture({ advanced, truthForGuild: true, truthForRichese: true });
  const shipmentIndex = base.actions.findIndex(step => step.actor === base.shipmentStep.actor &&
    step.action.type === 'ship' && step.action.territory === base.shipmentStep.action.territory && step.action.amount === 3);
  assert.ok(shipmentIndex >= base.acquiredActionCount);
  let game = structuredClone(base.beforeShipment); const actions = structuredClone(base.actions.slice(0, shipmentIndex));
  const inheritedActions = actions.length, target = base.owner, asker = 'guild', recipient = asker;
  assert.ok(base.guildTruth && base.richeseTruth);
  const truths = [base.guildTruth, base.richeseTruth], truthHolders = [asker, 'richese'];
  const originalCards = truthBoxPlayInventory(base.setup), originalSpice = truthBoxPlaySpice(base.setup), originalTraitors = truthBoxPlayTraitors(base.setup);
  assert.equal(truthBoxPlayPlayer(game, target).spice, 8); assert.equal(truthBoxPlayPlayer(game, target).shipped, false);
  assert.ok(truthBoxPlayPlayer(game, target).hand.some(card => card.id === base.box));
  assert.equal(game.discard.length, 0, 'No played cost or discard is inserted in the original prefix');
  const sourcePreparation: { before: Game; steps: TruthBoxPlayStep[]; after: Game } | null = multiple ? (() => {
    const before = structuredClone(game), from = actions.length;
    game = settleTruthBoxPlay(actTruthBoxPlay(game, target,
      { type: 'ship', territory: 'imperial_basin', sector: 9, amount: 1, elite: 0, allyPayment: 0 }, actions), actions);
    game = settleTruthBoxPlay(actTruthBoxPlay(game, target, hajrReplayMove(game, 'imperial_basin:9'), actions), actions);
    game = settleTruthBoxPlay(actTruthBoxPlay(game, target, { type: 'card', card: base.hajr }, actions), actions);
    assert.equal(truthBoxPlayPlayer(game, target).spice, 6); assert.equal(truthBoxPlayPlayer(game, target).moved, 1);
    assert.equal(game.discard.filter(card => card.id === base.hajr).length, 1);
    return { before, steps: structuredClone(actions.slice(from)), after: structuredClone(game) };
  })() : null;
  if (late) game = advanceTruthBoxPlay(game, state => state.phase === 8 && truthBoxPlayClean(state), actions, true);
  assert.ok(truthBoxPlayClean(game)); assert.equal(game.advanced, advanced); assert.equal(!!game.semutaPreview, !advanced);
  assert.ok(truthBoxPlayPlayer(game, target).hand.some(card => card.id === base.box));
  for (const [index, truth] of truths.entries()) assert.ok(truthBoxPlayPlayer(game, truthHolders[index]).hand.some(card => card.id === truth));
  assert.deepEqual(truthBoxPlayInventory(game), originalCards); assert.deepEqual(truthBoxPlaySpice(game), originalSpice);
  assert.deepEqual(truthBoxPlayTraitors(game), originalTraitors); assert.equal(game.turnActionPromises?.length ?? 0, 0);
  const spiceFact: TruthFact = { kind: 'spice', compare: 'eq', value: truthBoxPlayPlayer(game, target).spice };
  const mixed = truthBoxPlayGroup('and', truthBoxPlayUse(), truthBoxPlayPayment(recipient));
  const question: TruthQuestion = { kind: 'turnActions', target, turn: game.turn, mixed };
  return { game, source: structuredClone(game), base, advanced, multiple, late, asker, target, recipient,
    truths, truthHolders, truth: truths[0], box: base.box, hajr: base.hajr, boxFee: 2, spiceFact, mixed, question,
    setup: base.setup, afterSetup: base.afterSetup, beforeStartingDeal: base.beforeStartingDeal,
    originalCards, originalSpice, originalTraitors, sourcePreparation,
    actions, sourceActions: actions, sourceActionCount: actions.length,
    sourceCounts: { inherited: inheritedActions, nativeContinuation: actions.length - inheritedActions, selected: actions.length,
      paidCacheBids: actions.filter(step => step.actor === target && step.action.type === 'richeseBid' && step.action.amount === 1).length,
      paidOrdinaryBids: actions.filter(step => step.actor === target && step.action.type === 'bid' && step.action.amount === 1).length },
    boxAction: { type: 'card', card: base.box } satisfies Action,
    payment: { type: 'bribe', target: recipient, amount: 2 } satisfies Action,
    shipment: { type: 'ship', territory: 'polar_sink', sector: 0, amount: 1, elite: 0, allyPayment: 0 } satisfies Action,
    end: { type: 'endMovement' } satisfies Action,
    sourceDisclosure: 'Genuine public Richese/Emperor/Guild setup with original selected-CHOAM deck and Richese cache. ' +
      'Only the two original unopened Guild/Richese Truth deals, original unopened Hajr/Spice positions and scalar lotteries are selected. ' +
      'The exact actual cache1/normal1 action prefix stops before the older fixture’s desert shipment, preserving Emperor8 and unused shipment. ' +
      'Optional multiple-choice preparation actually ships one ordinary force for2, completes one move and plays the original Hajr; Advanced uses its earned immediate timing. ' +
      'Basic retains its native Semuta preview and actual declined fresh-discard acknowledgements. A future answered Truth supplies its real disposal before Box activation. ' +
      'No selected recovery or hidden recovered-card effect is promised or forecast. No played hand, purse, force, phase, receipt or marker is installed. Counts derive from actual arrays.',
  };
}
export type TruthBoxPlayFixture = ReturnType<typeof createTruthBoxPlayFixture>;
export function declareTruthBoxPlay(f: TruthBoxPlayFixture, source = f.game, copy: 0 | 1 = 0, actions: TruthBoxPlayStep[] = []) {
  const asker = f.truthHolders[copy]; let game = actTruthBoxPlay(source, asker, { type: 'card', card: f.truths[copy] }, actions);
  while (game.truthtrance?.stage === 'priority') {
    const actor = game.players.find(player => !game.truthtrance!.passed.includes(player.id)); assert.ok(actor);
    game = actTruthBoxPlay(game, actor.id, { type: 'truthPass' }, actions);
  }
  assert.equal(game.truthtrance?.stage, 'ask'); return { game, asker, actions };
}
export function askTruthBoxPlay(game: Game, asker: string, question: TruthQuestion, actions: TruthBoxPlayStep[] = []): Game {
  return actTruthBoxPlay(game, asker, { type: 'truthAsk', question: structuredClone(question) }, actions);
}
export function answerTruthBoxPlay(game: Game, target: string, answer: 'yes' | 'no', actions: TruthBoxPlayStep[] = []): Game {
  return actTruthBoxPlay(game, target, { type: 'truthAnswer', answer }, actions);
}
export function bindTruthBoxPlay(f: TruthBoxPlayFixture, answer: 'yes' | 'no' = 'yes', question: TruthQuestion = f.question,
  source = f.game, copy: 0 | 1 = 0, actions: TruthBoxPlayStep[] = []) {
  const declared = declareTruthBoxPlay(f, source, copy, actions), asked = askTruthBoxPlay(declared.game, declared.asker, question, actions);
  return { game: answerTruthBoxPlay(asked, f.target, answer, actions), declared, asked, actions };
}
export function truthBoxPlayPromise(game: Game, target = game.turnActionPromises?.[0]?.player ?? 'emperor') {
  const row = viewGame(game, target).turnActionPromises.findLast(promise => promise.player === target); assert.ok(row); return row;
}
/** Caller chooses only after actual payment has opened the private search. */
export function chooseTruthBoxPlay(game: Game, target: string, selected: string, actions: TruthBoxPlayStep[] = []): Game {
  const search = viewGame(game, target).nullentropy?.search; assert.ok(search);
  assert.ok(search.cards.some(card => card.id === selected));
  return actTruthBoxPlay(game, target, { type: 'decision', event: search.event, card: selected }, actions);
}
