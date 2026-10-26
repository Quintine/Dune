import assert from 'node:assert/strict';
import { viewGame, type Action, type Game } from '../game/engine';
import type { MixedActionExpression } from '../game/mixed-action-question';
import type { MixedBattleActionClaim } from '../game/mixed-battle-question';
import type { TruthFact, TruthQuestion } from '../game/truthtrance';
import { nextStrongholdFactionsNativeStep } from './fixture-stronghold-factions';
import { createTruthMixedBattleFixture } from './fixture-truth-mixed-battle';
import { createTruthMixedTraitorFixture, createTruthMixedTraitorHarkonnenFixture } from './fixture-truth-mixed-traitor';
import { truthTraitorDecisionTraitors } from './fixture-truth-traitor-decision';
import {
  actTruthTurnAction, truthTurnActionInventory, truthTurnActionPlayer, type TruthTurnActionStep,
} from './fixture-truth-turn-action';
import type { TruthTurnAllianceLeaf } from './fixture-truth-turn-alliance';

export type TruthTurnCombatLeaf = TruthTurnAllianceLeaf |
  { kind: 'battlePlan'; battle: string; territory: string; claim: MixedBattleActionClaim } |
  { kind: 'traitorCall'; battle: string; territory: string; call: boolean };
export type TruthTurnCombatExpression = MixedActionExpression<TruthTurnCombatLeaf>;
export type TruthTurnCombatStep = TruthTurnActionStep;
export const actTruthTurnCombat = actTruthTurnAction;
export const truthTurnCombatPlayer = truthTurnActionPlayer;
export const truthTurnCombatInventory = truthTurnActionInventory;
export const truthTurnCombatTraitors = truthTraitorDecisionTraitors;
export const truthTurnCombatClean = (game: Game) => !game.truthtrance && !game.response && !game.decision &&
  !game.phaseOpening && !game.pendingTreacheryDiscard && !game.pendingShipment && !game.pendingRevival;
export const truthTurnCombatFact = (fact: TruthFact): TruthTurnCombatExpression => ({ kind: 'fact', fact });
export const truthTurnCombatPayment = (recipient: string, minimum = 2): TruthTurnCombatExpression =>
  ({ kind: 'action', action: { kind: 'payment', recipient, minimum } });
export const truthTurnCombatPlan = (battle: string, territory: string, claim: MixedBattleActionClaim): TruthTurnCombatExpression =>
  ({ kind: 'action', action: { kind: 'battlePlan', battle, territory, claim: structuredClone(claim) } });
export const truthTurnCombatCall = (battle: string, territory: string, call = true): TruthTurnCombatExpression =>
  ({ kind: 'action', action: { kind: 'traitorCall', battle, territory, call } });
export const truthTurnCombatGroup = (kind: 'and' | 'or', ...terms: TruthTurnCombatExpression[]): TruthTurnCombatExpression =>
  ({ kind, terms });

/** Original Basic24 beforePlans, original Basic26 unsubmitted Traitor voter,
 * or original remote allied Harkonnen72. The no-match variant actually seals
 * another living original Atreides disc; it never exchanges a Traitor or
 * installs plans. Optional-module Cunning stays outside the native envelope. */
export function createTruthTurnCombatFixture(options: {
  source?: 'plan' | 'traitor' | 'noMatch' | 'harkonnen'; mixed?: TruthTurnCombatExpression;
} = {}) {
  const sourceKind = options.source ?? 'plan';
  const planSource = sourceKind === 'plan' ? createTruthMixedBattleFixture() : null;
  const traitorSource = sourceKind === 'traitor' || sourceKind === 'noMatch' ? createTruthMixedTraitorFixture() : null;
  const harkonnenSource = sourceKind === 'harkonnen' ? createTruthMixedTraitorHarkonnenFixture({ kind: 'ally' }) : null;
  const original = planSource ?? traitorSource ?? harkonnenSource!;
  let game = structuredClone(original.game), ownPlan = structuredClone(original.ownPlan);
  let actions = structuredClone(original.sourceActions);
  if (sourceKind === 'noMatch') {
    assert.ok(traitorSource);
    game = structuredClone(traitorSource.beforePlans);
    actions = structuredClone(traitorSource.sourceActions.slice(0, -traitorSource.planSteps.length));
    const other = truthTurnCombatPlayer(game, traitorSource.asker).leaders.find(disc =>
      !disc.dead && !disc.usedAt && disc.id !== traitorSource.traitorHeld); assert.ok(other);
    ownPlan = { ...traitorSource.ownPlan, leader: other.id };
    game = actTruthTurnCombat(game, traitorSource.asker, ownPlan, actions);
    game = actTruthTurnCombat(game, traitorSource.target, traitorSource.targetPlan, actions);
    assert.ok(game.battle?.revealed);
    assert.deepEqual(viewGame(game, traitorSource.target).battle!.traitorCallChoices, [false]);
  }
  assert.ok(game.battle?.event);
  const event = game.battle.event, territory = game.battle.territory;
  const asker = original.asker, target = original.target, recipient = asker;
  const weaponClaim: MixedBattleActionClaim = planSource?.weaponClaim ?? { kind: 'weapon', name: null };
  const mixed = structuredClone(options.mixed ?? truthTurnCombatGroup('and', planSource
    ? truthTurnCombatPlan(event, territory, weaponClaim) : truthTurnCombatCall(event, territory), truthTurnCombatPayment(recipient)));
  const question = { kind: 'turnActions', target, turn: game.turn, mixed } satisfies TruthQuestion;
  const spiceFact: TruthFact = { kind: 'spice', compare: 'eq', value: truthTurnCombatPlayer(game, target).spice };
  const traitorHeld = planSource?.base.base.traitorHeld ?? traitorSource?.traitorHeld ?? harkonnenSource!.traitorHeld;
  assert.ok(truthTurnCombatPlayer(game, asker).hand.some(card => card.id === original.truth));
  assert.equal(truthTurnCombatPlayer(game, target).ally === recipient, false);
  assert.deepEqual(truthTurnCombatInventory(game), original.originalCards);
  assert.deepEqual(truthTurnCombatTraitors(game), original.originalTraitors);
  assert.equal(game.turnActionPromises?.length ?? 0, 0);
  return {
    game, source: structuredClone(game), sourceKind, planSource, traitorSource, harkonnenSource,
    asker, target, recipient, truth: original.truth, event, battle: event, territory, mixed, question,
    initial: original.initial, setup: original.setup, beforeStartingDeal: original.beforeStartingDeal,
    afterSetup: original.afterSetup, originalCards: original.originalCards, originalTraitors: original.originalTraitors,
    originalSpice: original.originalSpice, actions, sourceActions: actions, sourceActionCount: actions.length,
    sourceCounts: { inherited: original.sourceActionCount, selected: actions.length,
      originalPlanSeals: sourceKind === 'plan' ? 0 : 2 },
    weaponClaim, spiceFact, traitorHeld, ownPlan, targetPlan: structuredClone(original.targetPlan),
    projectilePlan: planSource ? structuredClone(planSource.projectilePlan) : null,
    ordinary: planSource?.ordinary ?? traitorSource?.ordinary ?? null, karama: harkonnenSource?.karama ?? null,
    beneficiary: harkonnenSource?.beneficiary ?? target,
    payment: { type: 'bribe', target: recipient, amount: 2 } satisfies Action,
    reveal: { type: 'traitorCall', call: true } satisfies Action,
    decline: { type: 'traitorCall', call: false } satisfies Action,
    sourceDisclosure: `${original.sourceDisclosure} This adapter changes only the raw combined current-battle question. ` +
      (sourceKind === 'noMatch' ? 'The original beforePlans prefix is followed by two actual seals using another living original Atreides disc; no original Traitor card is moved. ' : '') +
      'Only actual plan reveal and native Traitor declaration supply future receipts. No hand, cash, physical card, force, death, battle, plan, vote, clock or promise is installed.',
  };
}
export type TruthTurnCombatFixture = ReturnType<typeof createTruthTurnCombatFixture>;

export function declareTruthTurnCombat(f: TruthTurnCombatFixture, source = f.game, actions: TruthTurnCombatStep[] = []) {
  const before = structuredClone(source), from = actions.length;
  let game = actTruthTurnCombat(source, f.asker, { type: 'card', card: f.truth }, actions);
  while (game.truthtrance?.stage === 'priority') {
    const actor = game.players.find(candidate => !game.truthtrance!.passed.includes(candidate.id)); assert.ok(actor);
    game = actTruthTurnCombat(game, actor.id, { type: 'truthPass' }, actions);
  }
  assert.equal(game.truthtrance?.stage, 'ask');
  return { game, before, actions, actionCount: actions.length - from };
}
export function askTruthTurnCombat(game: Game, asker: string, target: string, mixed: TruthTurnCombatExpression,
  actions: TruthTurnCombatStep[] = []): Game {
  return actTruthTurnCombat(game, asker, { type: 'truthAsk', question: {
    kind: 'turnActions', target, turn: game.turn, mixed: structuredClone(mixed),
  } }, actions);
}
export function answerTruthTurnCombat(game: Game, target: string, answer: 'yes' | 'no' | 'unknown',
  actions: TruthTurnCombatStep[] = []): Game {
  return actTruthTurnCombat(game, target, { type: 'truthAnswer', answer }, actions);
}
export function bindTruthTurnCombat(f: TruthTurnCombatFixture, answer: 'yes' | 'no' = 'yes', mixed = f.mixed,
  source = f.game, actions: TruthTurnCombatStep[] = []) {
  const from = actions.length, declared = declareTruthTurnCombat(f, source, actions);
  const asked = askTruthTurnCombat(declared.game, f.asker, f.target, mixed, actions);
  const game = answerTruthTurnCombat(asked, f.target, answer, actions);
  return { game, declared, asked, actions, actionCount: actions.length - from };
}
export function truthTurnCombatPromise(game: Game, target = game.turnActionPromises?.[0]?.player ?? game.players[0].id) {
  const row = viewGame(game, target).turnActionPromises.find(candidate => candidate.player === target); assert.ok(row); return row;
}
export function revealTruthTurnCombat(game: Game, f: TruthTurnCombatFixture, plan: Action = f.projectilePlan!,
  actions: TruthTurnCombatStep[] = []) {
  assert.ok(f.planSource, 'Only the original unsealed-plan source supplies both actual plan controls');
  game = actTruthTurnCombat(game, f.target, plan, actions); const afterTargetPlan = structuredClone(game);
  game = actTruthTurnCombat(game, f.asker, f.ownPlan, actions); assert.ok(game.battle?.revealed);
  return { game, afterTargetPlan, actions };
}
export function nextTruthTurnCombatNative(game: Game): TruthTurnCombatStep | null {
  return nextStrongholdFactionsNativeStep(game);
}
export function nextTruthTurnCombat(game: Game): TruthTurnCombatStep | null {
  if (game.truthtrance) return null;
  for (const player of game.players) {
    const guide = viewGame(game, player.id).turnActionGuide;
    if (guide) return { actor: player.id, action: guide.action };
  }
  return nextTruthTurnCombatNative(game);
}
export function advanceTruthTurnCombat(game: Game, until: (state: Game) => boolean,
  actions: TruthTurnCombatStep[] = [], nativeOnly = false): Game {
  for (let count = 0; count < 1200; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The original combat source ended before its requested native boundary');
    const next = nativeOnly ? nextTruthTurnCombatNative(game) : nextTruthTurnCombat(game);
    assert.ok(next, 'Supply the actual original private plan or current native vote before continuing');
    game = actTruthTurnCombat(game, next.actor, next.action, actions);
  }
  throw Error('The genuine combat source did not reach its finite boundary');
}
export function settleTruthTurnCombat(game: Game, actions: TruthTurnCombatStep[] = []): Game {
  return advanceTruthTurnCombat(game, truthTurnCombatClean, actions);
}
export function finishTruthTurnCombatBattle(game: Game, f: TruthTurnCombatFixture, actions: TruthTurnCombatStep[] = []): Game {
  assert.ok(game.battle?.revealed, 'Actually reveal both original plans before cleanup');
  if (!f.planSource) assert.notEqual(game.battle.traitorCalls[f.target], undefined, 'Actually declare the bound native Traitor choice');
  return advanceTruthTurnCombat(game, state => !state.battle || state.battle.event !== f.event, actions, true);
}
export function finishTruthTurnCombat(game: Game, actions: TruthTurnCombatStep[] = []): Game {
  const turn = game.turn;
  return advanceTruthTurnCombat(game, state => state.turn === turn + 1 && state.phase === 0 && truthTurnCombatClean(state), actions);
}
