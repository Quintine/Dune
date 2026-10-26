import assert from 'node:assert/strict';
import { viewGame, type Action, type Game } from '../game/engine';
import type { MixedActionExpression } from '../game/mixed-action-question';
import type { TruthFact, TruthQuestion } from '../game/truthtrance';
import {
  actTruthBid, nextTruthBid, truthBidClean, truthBidInventory, truthBidPlayer, type TruthBidStep,
} from './fixture-truth-bid';
import { createTruthBribeExpressionFixture } from './fixture-truth-bribe-expression';
import { nextTruthBribe } from './fixture-truth-bribe';
import { createTruthTravelFixture } from './fixture-truth-travel';
import { createTruthTravelOrderFixture } from './fixture-truth-travel-order';

export type TruthTurnActionClaim = { kind: 'ship' | 'move'; territory: string; minimum: number }
  | { kind: 'payment'; recipient: string; minimum: number };
export type TruthTurnActionExpression = MixedActionExpression<TruthTurnActionClaim>;
export type TruthTurnActionStep = TruthBidStep;
export const actTruthTurnAction = actTruthBid;
export const truthTurnActionClean = truthBidClean;
export const truthTurnActionInventory = truthBidInventory;
export const truthTurnActionPlayer = truthBidPlayer;
export const truthTurnActionFact = (fact: TruthFact): TruthTurnActionExpression => ({ kind: 'fact', fact });
export const truthTurnActionPayment = (recipient: string, minimum = 2): TruthTurnActionExpression =>
  ({ kind: 'action', action: { kind: 'payment', recipient, minimum } });
export const truthTurnActionShip = (territory = 'polar_sink', minimum = 1): TruthTurnActionExpression =>
  ({ kind: 'action', action: { kind: 'ship', territory, minimum } });
export const truthTurnActionMove = (territory = 'imperial_basin', minimum = 1): TruthTurnActionExpression =>
  ({ kind: 'action', action: { kind: 'move', territory, minimum } });
export const truthTurnActionGroup = (kind: 'and' | 'or', ...terms: TruthTurnActionExpression[]): TruthTurnActionExpression =>
  ({ kind, terms });

/** These adapters select existing genuine original public sources only. The
 * default keeps Harkonnen's two opening Truthtrances and Atreides' unused
 * movement turn; Hajr keeps its actually dealt card, and Mentat earns the late
 * payment window through original native actions. No played state is set. */
export function createTruthTurnActionFixture(options: {
  source?: 'twoTruths' | 'hajr' | 'mentat'; advanced?: boolean; mixed?: TruthTurnActionExpression;
} = {}) {
  const sourceKind = options.source ?? 'twoTruths';
  const orderSource = sourceKind === 'twoTruths' ? createTruthTravelOrderFixture() : null;
  const hajrSource = sourceKind === 'hajr' ? createTruthTravelFixture() : null;
  const mentatSource = sourceKind === 'mentat' ? createTruthBribeExpressionFixture({ phase: 8, advanced: options.advanced }) : null;
  const original = orderSource ?? hajrSource ?? mentatSource!;
  const game = structuredClone(original.game), asker = original.asker, target = original.target;
  const observer = game.players.find(player => player.id !== asker && player.id !== target)?.id ?? asker;
  const truths = orderSource ? structuredClone(orderSource.truths) : mentatSource
    ? structuredClone(mentatSource.truths) : [hajrSource!.truth];
  const recipient = observer;
  const mixed = structuredClone(options.mixed ?? (sourceKind === 'mentat'
    ? truthTurnActionGroup('or', truthTurnActionPayment(recipient), truthTurnActionMove())
    : truthTurnActionGroup('and', truthTurnActionPayment(recipient), truthTurnActionShip(), truthTurnActionMove())));
  const question = { kind: 'turnActions', target, turn: game.turn, mixed } satisfies TruthQuestion;
  const actions = structuredClone(original.sourceActions);
  const shipment = orderSource?.shipment ?? hajrSource?.shipmentAction ??
    { type: 'ship', territory: 'polar_sink', sector: 0, amount: 1, elite: 0, allyPayment: 0 } satisfies Action;
  const move = orderSource?.move ?? hajrSource?.firstMove ??
    { type: 'move', from: 'arrakeen:10', territory: 'imperial_basin', sector: 9, amount: 1 } satisfies Action;
  const spiceFact: TruthFact = { kind: 'spice', compare: 'gte', value: truthBidPlayer(game, target).spice };
  assert.ok(truthBidClean(game)); assert.equal(game.pendingShipment ?? null, null);
  assert.equal(truthBidPlayer(game, recipient).ally, null);
  assert.ok(truths.every(truth => truthBidPlayer(game, asker).hand.some(card => card.id === truth)));
  assert.deepEqual(truthBidInventory(game), original.originalCards);
  assert.equal(game.turnActionPromises?.length ?? 0, 0);
  return {
    game, source: structuredClone(game), sourceKind, orderSource, hajrSource, mentatSource,
    asker, target, observer, recipient, truths, truth: truths[0], mixed, question, spiceFact,
    setup: original.setup, afterSetup: original.afterSetup, beforeStartingDeal: original.beforeStartingDeal,
    originalCards: original.originalCards, originalSpice: original.originalSpice,
    dealOrder: original.dealOrder, spiceOrder: original.spiceOrder,
    actions, sourceActions: actions, sourceActionCount: actions.length, sourceCount: actions.length,
    sourceCounts: { selected: actions.length,
      inherited: orderSource?.sourceCounts.inheritedBidding ?? hajrSource?.sourceCounts.inherited ?? mentatSource!.sourceActionCount,
      nativeContinuation: orderSource?.sourceCounts.nativeContinuation ?? 0 },
    shipment: structuredClone(shipment), move: structuredClone(move), shipmentCost: 2,
    payment: { type: 'bribe', target: recipient, amount: 2 } satisfies Action,
    end: { type: 'endMovement' } satisfies Action,
    hajr: hajrSource?.hajr ?? null, hajrAction: hajrSource?.hajrAction ?? null,
    sourceDisclosure: `${original.sourceDisclosure} This turn-action adapter changes only the raw question. ` +
      'Future ordinary payments, the original reserve shipment and physical movement groups retain their real native actions. ' +
      'All counts derive from recorded arrays; no extra card, hand, wallet, army, clock, promise, receipt or compiled fact is installed.',
  };
}
export type TruthTurnActionFixture = ReturnType<typeof createTruthTurnActionFixture>;

export function declareTruthTurnAction(f: TruthTurnActionFixture, source = f.game, copy: 0 | 1 = 0,
  actions: TruthTurnActionStep[] = []) {
  assert.ok(f.truths[copy], 'The source must actually hold this distinct printed Truthtrance');
  const before = structuredClone(source), from = actions.length;
  let game = actTruthTurnAction(source, f.asker, { type: 'card', card: f.truths[copy] }, actions);
  while (game.truthtrance?.stage === 'priority') {
    const actor = game.players.find(player => !game.truthtrance!.passed.includes(player.id)); assert.ok(actor);
    game = actTruthTurnAction(game, actor.id, { type: 'truthPass' }, actions);
  }
  assert.equal(game.truthtrance?.stage, 'ask');
  return { game, before, actions, steps: structuredClone(actions.slice(from)), actionCount: actions.length - from };
}
export function askTruthTurnAction(game: Game, asker: string, target: string, mixed: TruthTurnActionExpression,
  actions: TruthTurnActionStep[] = []): Game {
  return actTruthTurnAction(game, asker, { type: 'truthAsk', question: {
    kind: 'turnActions', target, turn: game.turn, mixed: structuredClone(mixed),
  } }, actions);
}
export function answerTruthTurnAction(game: Game, target: string, answer: 'yes' | 'no',
  actions: TruthTurnActionStep[] = []): Game {
  return actTruthTurnAction(game, target, { type: 'truthAnswer', answer }, actions);
}
export function bindTruthTurnAction(f: TruthTurnActionFixture, answer: 'yes' | 'no' = 'yes', mixed = f.mixed,
  source = f.game, copy: 0 | 1 = 0, actions: TruthTurnActionStep[] = []) {
  const from = actions.length, declared = declareTruthTurnAction(f, source, copy, actions);
  const asked = askTruthTurnAction(declared.game, f.asker, f.target, mixed, actions);
  const game = answerTruthTurnAction(asked, f.target, answer, actions);
  return { game, declared, asked, actions, actionCount: actions.length - from };
}
export function truthTurnActionPromise(game: Game, target = game.turnActionPromises?.[0]?.player ?? game.players[0].id) {
  const row = viewGame(game, target).turnActionPromises.find(promise => promise.player === target);
  assert.ok(row, 'The respondent retains the original whole turn-action question and status'); return row;
}
export function nextTruthTurnAction(game: Game): TruthTurnActionStep | null {
  if (game.truthtrance) return null;
  for (const player of game.players) {
    const guide = viewGame(game, player.id).turnActionGuide;
    if (guide) return { actor: player.id, action: guide.action };
  }
  return nextTruthBribe(game);
}
export function advanceTruthTurnAction(game: Game, until: (state: Game) => boolean,
  actions: TruthTurnActionStep[] = [], nativeOnly = false): Game {
  for (let count = 0; count < 1200; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The genuine source ended before its requested native boundary');
    const next = nativeOnly ? nextTruthBid(game) : nextTruthTurnAction(game);
    assert.ok(next, 'Supply the actual original Truthtrance question, answer or owned payment choice');
    game = actTruthTurnAction(game, next.actor, next.action, actions);
  }
  throw Error('The genuine turn-action source did not reach its finite boundary');
}
export function settleTruthTurnAction(game: Game, actions: TruthTurnActionStep[] = []): Game {
  return advanceTruthTurnAction(game, state => truthBidClean(state) && !state.pendingShipment, actions);
}
export function completeTruthTurnAction(game: Game, target = game.turnActionPromises?.[0]?.player ?? game.players[0].id,
  actions: TruthTurnActionStep[] = []): Game {
  for (let count = 0; count < 24; count++) {
    const promise = truthTurnActionPromise(game, target);
    if (promise.fulfilled || promise.released) return game;
    game = settleTruthTurnAction(game, actions);
    const guide = viewGame(game, target).turnActionGuide; assert.ok(guide, 'The accepted whole answer has an actual native guide');
    game = settleTruthTurnAction(actTruthTurnAction(game, target, guide.action, actions), actions);
  }
  throw Error('The exact native turn-action guide did not settle the accepted whole answer');
}
export function finishTruthTurnAction(game: Game, actions: TruthTurnActionStep[] = []): Game {
  const turn = game.turn;
  return advanceTruthTurnAction(game, state => state.turn === turn + 1 && state.phase === 0 && truthBidClean(state), actions);
}
