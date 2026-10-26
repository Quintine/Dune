import assert from 'node:assert/strict';
import { viewGame, type Action, type Game } from '../game/engine';
import type { TruthQuestion } from '../game/truthtrance';
import { beforeIxSpiceDraw, orderIxSpiceCards } from './fixture-ix-spice-cards';
import { createTruthTurnAmalFixture, closeTruthTurnAmal, settleTruthTurnAmal,
  truthTurnAmalFact, truthTurnAmalGroup, truthTurnAmalPayment,
  type TruthTurnAmalExpression } from './fixture-truth-turn-amal';
import { actTruthTurnThumper, createTruthTurnThumperFixture, nextTruthTurnThumperNative,
  truthTurnThumperClean, truthTurnThumperInventory, truthTurnThumperPlayer, truthTurnThumperSpice,
  truthTurnThumperTraitors, type TruthTurnThumperStep } from './fixture-truth-turn-thumper';

export type TruthCharityPaymentsStep = TruthTurnThumperStep;
export type TruthCharityPaymentsKind = 'turnActions' | 'bribe' | 'bribeExpression' | 'mixedBribe';
export const actTruthCharityPayments = actTruthTurnThumper;
export const truthCharityPaymentsClean = truthTurnThumperClean;
export const truthCharityPaymentsPlayer = truthTurnThumperPlayer;
export const truthCharityPaymentsInventory = truthTurnThumperInventory;
export const truthCharityPaymentsTraitors = truthTurnThumperTraitors;
export const truthCharityPaymentsSpice = truthTurnThumperSpice;
export const truthCharityPaymentsFact = truthTurnAmalFact;
export const truthCharityPaymentsGroup = truthTurnAmalGroup;
export const truthCharityPaymentsPayment = truthTurnAmalPayment;
export const truthCharityPaymentsShip = (territory = 'polar_sink', minimum = 1): TruthTurnAmalExpression =>
  ({ kind: 'action', action: { kind: 'ship', territory, minimum } });
export const nextTruthCharityPaymentsNative = nextTruthTurnThumperNative;
export function nextTruthCharityPayments(game: Game): TruthCharityPaymentsStep | null {
  if (game.truthtrance) return null;
  for (const player of game.players) {
    const view = viewGame(game, player.id), guide = view.turnActionGuide ?? view.bribePromiseGuide;
    if (guide) return { actor: player.id, action: guide.action };
  }
  return nextTruthCharityPaymentsNative(game);
}
export function advanceTruthCharityPayments(game: Game, until: (state: Game) => boolean,
  actions: TruthCharityPaymentsStep[] = [], nativeOnly = false): Game {
  for (let count = 0; count < 1900; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The original Charity/payment source ended before its native boundary');
    const step = nativeOnly ? nextTruthCharityPaymentsNative(game) : nextTruthCharityPayments(game);
    assert.ok(step, 'Supply the actual Truthtrance question or original private plan');
    game = actTruthCharityPayments(game, step.actor, step.action, actions);
  }
  throw Error('The native Charity/payment chronology did not reach its finite boundary');
}
export function settleTruthCharityPayments(game: Game, actions: TruthCharityPaymentsStep[] = []): Game {
  return advanceTruthCharityPayments(game, truthCharityPaymentsClean, actions, true);
}
export function reachTruthCharityPaymentsClaim(game: Game, actions: TruthCharityPaymentsStep[] = []): Game {
  return advanceTruthCharityPayments(game, state => state.phase === 2 && truthCharityPaymentsClean(state), actions, true);
}

/** Genuine selected-Ix original deals only. Every smaller purse is earned by
 * actual Amal; no poverty, receipt, claim marker or pass list is assigned. */
export function createTruthCharityPaymentsFixture(options: {
  source?: 'amalOpening' | 'afterAmal' | 'thumper' | 'phase2'; advanced?: boolean;
} = {}) {
  const sourceKind = options.source ?? 'amalOpening';
  const amal = sourceKind === 'thumper' ? null : createTruthTurnAmalFixture({ phase: 1, advanced: options.advanced });
  const thumper = sourceKind === 'thumper' ? createTruthTurnThumperFixture({ advanced: options.advanced }) : null;
  const base = amal ?? thumper!;
  let game = structuredClone(base.game); const actions = structuredClone(base.sourceActions), inherited = actions.length;
  let reduction: { before: Game; steps: TruthCharityPaymentsStep[]; after: Game } | null = null;
  let spiceOrder: ReturnType<typeof orderIxSpiceCards> = [];
  if (sourceKind === 'afterAmal' || sourceKind === 'phase2') {
    assert.ok(amal); const before = structuredClone(game), from = actions.length;
    game = actTruthCharityPayments(game, base.target, amal.nativeAction, actions);
    game = settleTruthTurnAmal(game, actions); game = closeTruthTurnAmal(game, amal, actions);
    reduction = { before, steps: structuredClone(actions.slice(from)), after: structuredClone(game) };
    assert.equal(truthCharityPaymentsPlayer(game, base.target).spice, 5); assert.equal(beforeIxSpiceDraw(game), true);
    spiceOrder = orderIxSpiceCards(game, [{ territory: 'hagga_basin' }, ...(base.advanced ? [{ territory: 'broken_land' }] : [])]);
    if (sourceKind === 'phase2') game = reachTruthCharityPaymentsClaim(game, actions);
  }
  const asker = base.asker, target = base.target, recipient = asker, observer = base.observer;
  const minimum = sourceKind === 'thumper' ? 11 : 6;
  const printed = sourceKind === 'amalOpening' || sourceKind === 'thumper'
    ? { kind: 'action', action: { kind: 'windowCardPlay', effect: base.effect, source: base.source } } as const : null;
  const mixed = printed ? truthCharityPaymentsGroup('and', printed, truthCharityPaymentsPayment(recipient, minimum))
    : truthCharityPaymentsPayment(recipient, minimum);
  const question = { kind: 'turnActions', target, turn: game.turn, mixed } satisfies TruthQuestion;
  const spiceFact = { kind: 'spice', compare: 'eq', value: truthCharityPaymentsPlayer(game, target).spice } as const;
  assert.deepEqual(truthCharityPaymentsPlayer(game, asker).hand.map(card => card.id), base.truths);
  assert.notEqual(truthCharityPaymentsPlayer(game, target).charityTurn, game.turn);
  assert.deepEqual(truthCharityPaymentsInventory(game), base.originalCards);
  assert.deepEqual(truthCharityPaymentsTraitors(game), base.originalTraitors);
  assert.deepEqual(truthCharityPaymentsSpice(game), base.originalSpice);
  return { game, base, amal, thumper, sourceKind, initial: base.initial, setup: base.setup, afterSetup: base.afterSetup,
    beforeStartingDeal: base.beforeStartingDeal, asker, target, recipient, observer, advanced: base.advanced,
    truths: base.truths, truth: base.truth, card: base.card, effect: base.effect, cardSource: base.source,
    nativeAction: base.nativeAction, printed, minimum, mixed, question, spiceFact, reduction, spiceOrder,
    payment: { type: 'bribe', target: recipient, amount: minimum } satisfies Action,
    charity: { type: 'charity' } satisfies Action,
    originalCards: base.originalCards, originalTraitors: base.originalTraitors, originalSpice: base.originalSpice,
    actions, sourceActions: actions, sourceActionCount: actions.length,
    sourceCounts: { inherited, nativeContinuation: actions.length - inherited, selected: actions.length,
      actualAmalReduction: reduction?.steps.length ?? 0 },
    sourceDisclosure: `${base.sourceDisclosure} This adapter follows only actual printed Amal, global opening passes and original native phase controls when requested. ` +
      'The ordinary phase2 Charity remains unclaimed. Smaller purses come from the real all-seat halving, not assigned wealth. Later prepayments, one actual claim, later installments and ordinary shipment remain caller controls. All future recipients share the same physical purse and one current-turn native claim.',
  };
}
export type TruthCharityPaymentsFixture = ReturnType<typeof createTruthCharityPaymentsFixture>;
export function truthCharityPaymentsQuestion(f: TruthCharityPaymentsFixture, kind: TruthCharityPaymentsKind,
  minimum = f.minimum, recipient = f.recipient): TruthQuestion {
  if (kind === 'bribe') return { kind, target: f.target, turn: f.game.turn, recipient, minimum };
  if (kind === 'bribeExpression') return { kind, target: f.target, turn: f.game.turn, claim: { kind: 'payment', recipient, minimum } };
  if (kind === 'mixedBribe') return { kind, target: f.target, turn: f.game.turn, mixed: { kind: 'and', terms: [
    { kind: 'fact', fact: f.spiceFact }, { kind: 'action', action: { recipient, minimum } },
  ] } };
  return { kind, target: f.target, turn: f.game.turn, mixed: truthCharityPaymentsPayment(recipient, minimum) };
}
export function declareTruthCharityPayments(f: TruthCharityPaymentsFixture, source = f.game, copy: 0 | 1 = 0,
  actions: TruthCharityPaymentsStep[] = []) {
  let game = actTruthCharityPayments(source, f.asker, { type: 'card', card: f.truths[copy] }, actions);
  while (game.truthtrance?.stage === 'priority') {
    const actor = game.players.find(player => !game.truthtrance!.passed.includes(player.id)); assert.ok(actor);
    game = actTruthCharityPayments(game, actor.id, { type: 'truthPass' }, actions);
  }
  assert.equal(game.truthtrance?.stage, 'ask'); return { game, actions };
}
export function askTruthCharityPayments(game: Game, asker: string, question: TruthQuestion, actions: TruthCharityPaymentsStep[] = []): Game {
  return actTruthCharityPayments(game, asker, { type: 'truthAsk', question: structuredClone(question) }, actions);
}
export function answerTruthCharityPayments(game: Game, target: string, answer: 'yes' | 'no' | 'unknown', actions: TruthCharityPaymentsStep[] = []): Game {
  return actTruthCharityPayments(game, target, { type: 'truthAnswer', answer }, actions);
}
export function bindTruthCharityPayments(f: TruthCharityPaymentsFixture, answer: 'yes' | 'no' = 'yes', question: TruthQuestion = f.question,
  source = f.game, copy: 0 | 1 = 0, actions: TruthCharityPaymentsStep[] = []) {
  const declared = declareTruthCharityPayments(f, source, copy, actions), asked = askTruthCharityPayments(declared.game, f.asker, question, actions);
  return { game: answerTruthCharityPayments(asked, f.target, answer, actions), declared, asked, actions };
}
export function truthCharityPaymentsPromise(game: Game, kind: TruthCharityPaymentsKind = 'turnActions', target = game.truthHistory!.at(-1)!.question.target) {
  const row = kind === 'bribe' ? game.bribePromises?.find(candidate => candidate.player === target)
    : kind === 'bribeExpression' ? game.bribeExpressionPromises?.find(candidate => candidate.player === target)
      : kind === 'mixedBribe' ? viewGame(game, target).mixedBribePromises.find(candidate => candidate.player === target)
        : viewGame(game, target).turnActionPromises.find(candidate => candidate.player === target);
  assert.ok(row); return row;
}
export function finishTruthCharityPayments(game: Game, actions: TruthCharityPaymentsStep[] = []): Game {
  const turn = game.turn;
  return advanceTruthCharityPayments(game, state => state.turn === turn + 1 && state.phase === 0 && !!state.phaseOpening &&
    !state.response && !state.decision && !state.truthtrance && !state.pendingTreacheryDiscard, actions);
}
