import assert from 'node:assert/strict';
import { viewGame, type Action, type Game } from '../game/engine';
import type { MixedActionExpression } from '../game/mixed-action-question';
import type { TruthFact, TruthQuestion } from '../game/truthtrance';
import { buyDistransPrebidLot, createDistransPrebidFixture, distransPrebidInventory, distransPrebidUntouched, nextDistransPrebidStep,
  type DistransPrebidCapacity } from './fixture-distrans-prebid';
import { actSaphoStartedMovement, createSaphoStartedMovementFixture, nextSaphoStartedMovementStep } from './fixture-sapho-started-movement';
import { truthTurnThumperSpice, truthTurnThumperTraitors } from './fixture-truth-turn-thumper';

export type TruthTransferOrderEffect = 'distrans' | 'juiceOfSapho';
export type TruthTransferOrderLeaf = { kind: 'cardPlay'; effect: TruthTransferOrderEffect } |
  { kind: 'payment'; recipient: string; minimum: number } | { kind: 'ship'; territory: string; minimum: number };
export type TruthTransferOrderExpression = MixedActionExpression<TruthTransferOrderLeaf>;
export type TruthTransferOrderStep = { actor: string; action: Action };
export const actTruthTransferOrderPlay = actSaphoStartedMovement;
export const truthTransferOrderPlayInventory = distransPrebidInventory;
export const truthTransferOrderPlaySpice = truthTurnThumperSpice;
export const truthTransferOrderPlayTraitors = truthTurnThumperTraitors;
export const truthTransferOrderPlayPlayer = (game: Game, actor: string) => {
  const player = game.players.find(candidate => candidate.id === actor); assert.ok(player); return player;
};
export const truthTransferOrderPlayClean = (game: Game) => !game.phaseOpening && !game.response && !game.decision &&
  !game.truthtrance && !game.pendingTreacheryDiscard && !game.pendingNullentropy && !game.pendingShipment && !game.currentAuctionSale;
export const truthTransferOrderPlayUse = (effect: TruthTransferOrderEffect): TruthTransferOrderExpression =>
  ({ kind: 'action', action: { kind: 'cardPlay', effect } });
export const truthTransferOrderPlayFact = (fact: TruthFact): TruthTransferOrderExpression => ({ kind: 'fact', fact });
export const truthTransferOrderPlayPayment = (recipient: string, minimum = 2): TruthTransferOrderExpression =>
  ({ kind: 'action', action: { kind: 'payment', recipient, minimum } });
export const truthTransferOrderPlayShip = (territory = 'polar_sink', minimum = 1): TruthTransferOrderExpression =>
  ({ kind: 'action', action: { kind: 'ship', territory, minimum } });
export const truthTransferOrderPlayGroup = (kind: 'and' | 'or', ...terms: TruthTransferOrderExpression[]): TruthTransferOrderExpression =>
  ({ kind, terms });

export function nextTruthTransferOrderPlayNative(game: Game): TruthTransferOrderStep | null {
  if (game.truthtrance || game.pendingNullentropy) return null;
  return game.players.some(player => player.id === 'r') ? nextDistransPrebidStep(game) : nextSaphoStartedMovementStep(game);
}
export function nextTruthTransferOrderPlay(game: Game): TruthTransferOrderStep | null {
  if (game.truthtrance || game.pendingNullentropy) return null;
  for (const player of game.players) {
    const guide = viewGame(game, player.id).turnActionGuide;
    if (guide) return { actor: player.id, action: guide.action };
  }
  return nextTruthTransferOrderPlayNative(game);
}
export function advanceTruthTransferOrderPlay(game: Game, until: (state: Game) => boolean,
  actions: TruthTransferOrderStep[] = [], nativeOnly = false): Game {
  for (let count = 0; count < 1800; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The original transfer/order source ended before its requested boundary');
    const step = nativeOnly ? nextTruthTransferOrderPlayNative(game) : nextTruthTransferOrderPlay(game);
    assert.ok(step, 'Supply the original Truthtrance, paid private selection or sealed native plan');
    game = actTruthTransferOrderPlay(game, step.actor, step.action, actions);
  }
  throw Error('The original transfer/order source did not reach its finite boundary');
}
export function settleTruthTransferOrderPlay(game: Game, actions: TruthTransferOrderStep[] = []): Game {
  return advanceTruthTransferOrderPlay(game, truthTransferOrderPlayClean, actions, true);
}
export function finishTruthTransferOrderPlay(game: Game, actions: TruthTransferOrderStep[] = []): Game {
  const turn = game.turn;
  return advanceTruthTransferOrderPlay(game, state => state.turn === turn + 1, actions, true);
}

/** Real public cache purchases plus original unopened Truth deals. The card
 * question does not select a transfer recipient/card or an order option. */
export function createTruthTransferOrderPlayFixture(options: {
  source?: 'distrans' | 'sapho'; advanced?: boolean; capacity?: DistransPrebidCapacity; guildTake?: boolean; recoveredDistrans?: boolean;
} = {}) {
  const sourceKind = options.source ?? 'distrans', advanced = options.advanced ?? false;
  const distrans = sourceKind === 'distrans' ? createDistransPrebidFixture({ advanced, capacity: options.capacity, truthFor: ['r', 'a'] }) : null;
  const sapho = sourceKind === 'sapho' ? createSaphoStartedMovementFixture({ advanced, guildTake: options.guildTake,
    truthFor: ['richese', 'guild'] }) : null;
  const base = distrans ?? sapho!;
  let game = structuredClone(base.game); const actions = structuredClone(base.actions);
  const target = distrans ? distrans.holder : sapho!.owner, asker = distrans ? 'a' : 'richese', recipient = asker;
  const selected = base.startingTruthSelection;
  const ordered = [...selected].sort((left, right) => Number(right.actor === asker) - Number(left.actor === asker));
  const truths = ordered.map(row => row.card), truthHolders = ordered.map(row => row.actor);
  assert.equal(truths.length, 2); assert.equal(truthHolders[0], asker);
  const effect: TruthTransferOrderEffect = distrans ? 'distrans' : 'juiceOfSapho', card = base.card;
  const originalCards = truthTransferOrderPlayInventory(base.setup), originalSpice = truthTransferOrderPlaySpice(base.setup);
  const originalTraitors = truthTransferOrderPlayTraitors(base.setup);
  let recovery: { before: Game; firstPlay: TruthTransferOrderStep; box: string; acquisition: TruthTransferOrderStep[];
    beforeRecovery: Game; paid: Game; afterRecovery: Game; outgoingPurchase: ReturnType<typeof buyDistransPrebidLot>['purchase']; after: Game } | null = null;
  if (options.recoveredDistrans) {
    assert.ok(distrans && distrans.capacity === 'ordinary', 'Use the original ordinary Distrans source for this one real replay');
    const before = structuredClone(game), firstPlay: TruthTransferOrderStep = { actor: target, action: distrans.action };
    game = settleTruthTransferOrderPlay(actTruthTransferOrderPlay(game, target, firstPlay.action, actions), actions);
    const turn = game.turn;
    game = advanceTruthTransferOrderPlay(game, state => state.turn === turn + 1 && !state.phaseOpening && !state.response &&
      state.decision?.kind === 'richeseCache', actions, true);
    const box = game.richeseCache?.find(held => held.effect === 'nullentropyBox'); assert.ok(box);
    const from = actions.length;
    game = actTruthTransferOrderPlay(game, game.decision!.player, { type: 'decision', event: game.richeseBidding!.event,
      card: box.id, method: 'onceAround', direction: 'counterclockwise' }, actions);
    for (let count = 0; count < 200 && !(truthTransferOrderPlayPlayer(game, target).hand.some(held => held.id === box.id) && distransPrebidUntouched(game)); count++) {
      const lot = game.richeseAuction;
      const step = truthTransferOrderPlayClean(game) && lot?.cardId === box.id && !lot.outcome && lot.active === target && lot.bid === 0
        ? { actor: target, action: { type: 'richeseBid', event: lot.event, amount: 1, allyPayment: 0 } satisfies Action }
        : nextTruthTransferOrderPlayNative(game);
      assert.ok(step); game = actTruthTransferOrderPlay(game, step.actor, step.action, actions);
    }
    assert.ok(distransPrebidUntouched(game)); assert.ok(truthTransferOrderPlayPlayer(game, target).hand.some(held => held.id === box.id));
    const acquisition = structuredClone(actions.slice(from)), beforeRecovery = structuredClone(game);
    assert.deepEqual(game.discard.map(held => held.id), [card]);
    game = actTruthTransferOrderPlay(game, target, { type: 'card', card: box.id }, actions); const paid = structuredClone(game);
    game = settleTruthTransferOrderPlay(game, actions); const afterRecovery = structuredClone(game);
    assert.ok(truthTransferOrderPlayPlayer(game, target).hand.some(held => held.id === card));
    assert.equal(truthTransferOrderPlayPlayer(beforeRecovery, target).spice - truthTransferOrderPlayPlayer(game, target).spice, 2);
    const bought = buyDistransPrebidLot(game, target, actions); game = bought.game;
    recovery = { before, firstPlay, box: box.id, acquisition, beforeRecovery, paid, afterRecovery,
      outgoingPurchase: bought.purchase, after: structuredClone(game) };
  }
  for (const [index, truth] of truths.entries()) assert.ok(truthTransferOrderPlayPlayer(game, truthHolders[index]).hand.some(held => held.id === truth));
  assert.ok(truthTransferOrderPlayPlayer(game, target).hand.some(held => held.id === card));
  assert.ok(truthTransferOrderPlayClean(game)); assert.equal(!!game.semutaPreview, !advanced);
  assert.equal(game.turnActionPromises?.length ?? 0, 0); assert.deepEqual(truthTransferOrderPlayInventory(game), originalCards);
  assert.deepEqual(truthTransferOrderPlaySpice(game), originalSpice); assert.deepEqual(truthTransferOrderPlayTraitors(game), originalTraitors);
  const spiceFact: TruthFact = { kind: 'spice', compare: 'eq', value: truthTransferOrderPlayPlayer(game, target).spice };
  const mixed = truthTransferOrderPlayGroup('and', truthTransferOrderPlayUse(effect), truthTransferOrderPlayPayment(recipient));
  const question: TruthQuestion = { kind: 'turnActions', target, turn: game.turn, mixed };
  return { game, source: structuredClone(game), sourceKind, effect, advanced, base, distrans, sapho,
    target, asker, recipient, truths, truthHolders, truth: truths[0], card, spiceFact, mixed, question,
    give: recovery?.outgoingPurchase.card ?? distrans?.give ?? null, current: sapho?.current ?? null, recovery,
    setup: base.setup, afterSetup: base.afterSetup, beforeStartingDeal: base.beforeStartingDeal,
    originalCards, originalSpice, originalTraitors,
    actions, sourceActions: actions, sourceActionCount: actions.length,
    sourceCounts: { inherited: base.actions.length, nativeContinuation: actions.length - base.actions.length, selected: actions.length,
      nativeCacheBids: actions.filter(step => step.actor === target && step.action.type === 'richeseBid' && step.action.amount === 1).length },
    payment: { type: 'bribe', target: recipient, amount: 2 } satisfies Action,
    shipment: { type: 'ship', territory: 'polar_sink', sector: 0, amount: 1, elite: 0, allyPayment: 0 } satisfies Action,
    sourceDisclosure: base.staging.join(' ') + ' Optional original unopened starting deals supply the two physical Truths; ' +
      'default base-fixture deals remain unchanged when those selectors are absent. Basic keeps its original Semuta marker and real discard acknowledgements. ' +
      (distrans ? 'Guild actually purchases Distrans for1 and retains its original other card to transfer; no recipient consent or hidden recipient card is supplied. '
        : 'Emperor actually purchases Sapho for1; the current foreign actor has already paid for one physical Polar Sink shipment and keeps its original ground move/end. ') +
      (recovery ? 'The optional single replay source actually transfers/discards Distrans, buys the remaining original Box cache1 on turn2, pays its2-spice sole-card recovery, then buys one ordinary card1 as its new outgoing card. Both original Truths remain held until the later question. ' : '') +
      'The future printed-play clause names no recipient, outgoing card, mode or order result. Only actual native accepted use counts. ' +
      'No dealt hand, purse, army, phase, queue, receipt or marker is installed. Counts and inventories derive from actual arrays.',
  };
}
export type TruthTransferOrderPlayFixture = ReturnType<typeof createTruthTransferOrderPlayFixture>;
export function declareTruthTransferOrderPlay(f: TruthTransferOrderPlayFixture, source = f.game, copy: 0 | 1 = 0,
  actions: TruthTransferOrderStep[] = []) {
  const asker = f.truthHolders[copy]; let game = actTruthTransferOrderPlay(source, asker, { type: 'card', card: f.truths[copy] }, actions);
  while (game.truthtrance?.stage === 'priority') {
    const actor = game.players.find(player => !game.truthtrance!.passed.includes(player.id)); assert.ok(actor);
    game = actTruthTransferOrderPlay(game, actor.id, { type: 'truthPass' }, actions);
  }
  assert.equal(game.truthtrance?.stage, 'ask'); return { game, asker, actions };
}
export function askTruthTransferOrderPlay(game: Game, asker: string, question: TruthQuestion, actions: TruthTransferOrderStep[] = []): Game {
  return actTruthTransferOrderPlay(game, asker, { type: 'truthAsk', question: structuredClone(question) }, actions);
}
export function answerTruthTransferOrderPlay(game: Game, target: string, answer: 'yes' | 'no', actions: TruthTransferOrderStep[] = []): Game {
  return actTruthTransferOrderPlay(game, target, { type: 'truthAnswer', answer }, actions);
}
export function bindTruthTransferOrderPlay(f: TruthTransferOrderPlayFixture, answer: 'yes' | 'no' = 'yes', question: TruthQuestion = f.question,
  source = f.game, copy: 0 | 1 = 0, actions: TruthTransferOrderStep[] = []) {
  const declared = declareTruthTransferOrderPlay(f, source, copy, actions), asked = askTruthTransferOrderPlay(declared.game, declared.asker, question, actions);
  return { game: answerTruthTransferOrderPlay(asked, f.target, answer, actions), declared, asked, actions };
}
export function truthTransferOrderPlayPromise(game: Game, target = game.turnActionPromises?.[0]?.player ?? game.players[0].id) {
  const row = viewGame(game, target).turnActionPromises.findLast(promise => promise.player === target); assert.ok(row); return row;
}
export function truthTransferOrderDistransAction(game: Game, f: TruthTransferOrderPlayFixture, recipient = f.recipient, give = f.give): Action {
  assert.equal(f.effect, 'distrans'); const quote = viewGame(game, f.target).distrans;
  assert.ok(quote && !quote.blocked); const choice = quote.choices.find(choice => choice.recipient === recipient && !choice.blocked);
  assert.ok(choice && choice.cards.some(card => card.id === give));
  return { type: 'card', card: f.card, target: recipient, give: give! };
}
export function truthTransferOrderSaphoAction(game: Game, f: TruthTransferOrderPlayFixture, mode: 'first' | 'last'): Action {
  assert.equal(f.effect, 'juiceOfSapho'); const option = viewGame(game, f.target).saphoOptions.find(option => option.scope === 'movement' && option.mode === mode);
  assert.ok(option, 'Use one exact currently legal native Sapho option');
  return { type: 'card', card: f.card, scope: option.scope, event: option.event, mode: option.mode };
}

/** One genuine Semuta cost composition. Original Distrans is actually spent
 * before turn2; its owner then buys the still-original cached Semuta for1.
 * Both unopened-deal Truths remain held for a later normal-lot answer. */
export function createTruthSemutaPrebidFixture(options: { firstBid?: boolean } = {}) {
  const f = createTruthTransferOrderPlayFixture(), actions = structuredClone(f.actions), inherited = actions.length;
  let game = settleTruthTransferOrderPlay(actTruthTransferOrderPlay(f.game, f.target,
    truthTransferOrderDistransAction(f.game, f), actions), actions);
  const earlierDistrans = structuredClone(game), turn = game.turn;
  game = advanceTruthTransferOrderPlay(game, state => state.turn === turn + 1 && !state.phaseOpening && !state.response &&
    state.decision?.kind === 'richeseCache', actions, true);
  const semuta = game.richeseCache?.find(card => card.effect === 'semutaDrug'); assert.ok(semuta);
  const acquisitionStart = actions.length, beforePurchase = structuredClone(game);
  game = actTruthTransferOrderPlay(game, game.decision!.player, { type: 'decision', event: game.richeseBidding!.event,
    card: semuta.id, method: 'onceAround', direction: 'counterclockwise' }, actions);
  for (let count = 0; count < 200 && !(truthTransferOrderPlayPlayer(game, f.target).hand.some(card => card.id === semuta.id) && distransPrebidUntouched(game)); count++) {
    const lot = game.richeseAuction;
    const step = truthTransferOrderPlayClean(game) && lot?.cardId === semuta.id && !lot.outcome && lot.active === f.target && lot.bid === 0
      ? { actor: f.target, action: { type: 'richeseBid', event: lot.event, amount: 1, allyPayment: 0 } satisfies Action }
      : nextTruthTransferOrderPlayNative(game);
    assert.ok(step); game = actTruthTransferOrderPlay(game, step.actor, step.action, actions);
  }
  assert.ok(distransPrebidUntouched(game)); assert.ok(truthTransferOrderPlayPlayer(game, f.target).hand.some(card => card.id === semuta.id));
  assert.equal(truthTransferOrderPlayPlayer(beforePurchase, f.target).spice - truthTransferOrderPlayPlayer(game, f.target).spice, 1);
  const acquisition = { before: beforePurchase, steps: structuredClone(actions.slice(acquisitionStart)), after: structuredClone(game) };
  let bid: TruthTransferOrderStep | null = null;
  if (options.firstBid) {
    bid = { actor: game.auction!.active, action: { type: 'bid', amount: 1, allyPayment: 0 } };
    game = actTruthTransferOrderPlay(game, bid.actor, bid.action, actions);
    assert.equal(game.auction!.bid, 1); assert.equal(game.auction!.bidder, bid.actor);
  }
  assert.ok(truthTransferOrderPlayClean(game)); assert.equal(game.semutaPreview, true);
  assert.equal(game.discard.filter(card => card.id === f.card).length, 1);
  assert.ok(!truthTransferOrderPlayPlayer(game, f.target).hand.some(card => card.id === f.card));
  for (const [index, truth] of f.truths.entries()) assert.ok(truthTransferOrderPlayPlayer(game, f.truthHolders[index]).hand.some(card => card.id === truth));
  assert.deepEqual(truthTransferOrderPlayInventory(game), f.originalCards);
  assert.deepEqual(truthTransferOrderPlaySpice(game), f.originalSpice); assert.deepEqual(truthTransferOrderPlayTraitors(game), f.originalTraitors);
  const mixed = truthTransferOrderPlayUse('distrans');
  const question: TruthQuestion = { kind: 'turnActions', target: f.target, turn: game.turn, mixed };
  return { ...f, game, source: structuredClone(game), mixed, question, semuta: semuta.id, earlierDistrans, acquisition, bid,
    spiceFact: { kind: 'spice', compare: 'eq', value: truthTransferOrderPlayPlayer(game, f.target).spice } satisfies TruthFact,
    actions, sourceActions: actions, sourceActionCount: actions.length,
    sourceCounts: { inherited, nativeContinuation: actions.length - inherited, selected: actions.length,
      nativeCacheBids: actions.filter(step => step.actor === f.target && step.action.type === 'richeseBid' && step.action.amount === 1).length },
    sourceDisclosure: f.base.staging.join(' ') + ' Original unopened Richese/Atreides Truth deals remain held. ' +
      'Guild actually transfers its original shield with Distrans, completes its native fresh-discard passes, then reaches the next original cache declaration. ' +
      'Guild buys the original Semuta for1 and stops at the original normal lot, optionally after one actual first bid1. Distrans remains physically spent. ' +
      'The later question concerns only future Distrans use; no future Semuta clause is introduced. No hand, purse, auction, phase, receipt or marker is installed. Counts derive from recorded actions.',
  };
}

/** Earlier real Basic boundary, rather than an installed phase or queue.
 * Retain only the exact acquisition prefix of the existing native source. */
export function createTruthEarlySaphoFixture() {
  const f = createTruthTransferOrderPlayFixture({ source: 'sapho' }); assert.ok(f.sapho);
  const bid = f.sapho.acquisition.bid;
  const bidAt = f.actions.findIndex(step => step.actor === bid.actor && step.action.type === 'richeseBid' &&
    step.action.event === bid.action.event && step.action.amount === bid.action.amount);
  assert.ok(bidAt >= 0); const inherited = bidAt + f.sapho.acquisition.steps.length;
  assert.deepEqual(f.actions.slice(bidAt, inherited), f.sapho.acquisition.steps);
  const actions = structuredClone(f.actions.slice(0, inherited));
  let game = structuredClone(f.sapho.acquired);
  game = advanceTruthTransferOrderPlay(game, state => state.phase === 4 && truthTransferOrderPlayClean(state), actions, true);
  assert.equal(game.advanced, false); assert.equal(game.semutaPreview, true);
  assert.ok(truthTransferOrderPlayPlayer(game, f.target).hand.some(card => card.id === f.card));
  assert.equal(truthTransferOrderPlayPlayer(game, f.target).shipped, false); assert.equal(truthTransferOrderPlayPlayer(game, f.target).moved, 0);
  assert.ok(!actions.some(step => step.action.type === 'ship')); assert.deepEqual(truthTransferOrderPlayInventory(game), f.originalCards);
  assert.deepEqual(truthTransferOrderPlaySpice(game), f.originalSpice); assert.deepEqual(truthTransferOrderPlayTraitors(game), f.originalTraitors);
  return { ...f, game, source: structuredClone(game), current: null, early: true,
    spiceFact: { kind: 'spice', compare: 'eq', value: truthTransferOrderPlayPlayer(game, f.target).spice } satisfies TruthFact,
    actions, sourceActions: actions, sourceActionCount: actions.length,
    sourceCounts: { inherited, nativeContinuation: actions.length - inherited, selected: actions.length,
      nativeCacheBids: actions.filter(step => step.actor === f.target && step.action.type === 'richeseBid' && step.action.amount === 1).length },
    sourceDisclosure: f.sapho.staging[0] + ' Select the two original unopened Richese/Guild Truth deals and use the exact actual acquired-Sapho snapshot. ' +
      'Its prefix is acquisition bid index plus actual acquisition steps; subsequent native auction controls reach quiet Basic Revival before any shipment. ' +
      'The owned future movement opportunity uses its ordinary public order, with no future income, played card, phase or queue installed. Counts derive from the exact prefix and native continuation.',
  };
}
