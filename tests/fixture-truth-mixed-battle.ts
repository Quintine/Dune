import assert from 'node:assert/strict';
import { viewGame, type Action, type Game } from '../game/engine';
import type { MixedActionExpression } from '../game/mixed-action-question';
import type { MixedBattleActionClaim } from '../game/mixed-battle-question';
import type { TruthAnswer, TruthFact } from '../game/truthtrance';
import {
  createTruthPlanExpressionFixture, actTruthPlanExpression,
  passTruthPlanExpressionPriority, truthPlanExpressionClean,
  truthPlanExpressionInventory, truthPlanExpressionPlayer,
  type TruthPlanExpressionStep,
} from './fixture-truth-plan-expression';
import { nextStrongholdFactionsNativeStep } from './fixture-stronghold-factions';

export type TruthMixedBattleExpression = MixedActionExpression<MixedBattleActionClaim>;
export type TruthMixedBattleStep = TruthPlanExpressionStep;
export const actTruthMixedBattle = actTruthPlanExpression;
export const truthMixedBattleClean = truthPlanExpressionClean;
export const truthMixedBattlePlayer = truthPlanExpressionPlayer;
export const truthMixedBattleInventory = truthPlanExpressionInventory;
export const truthMixedBattleFact = (fact: TruthFact): TruthMixedBattleExpression => ({ kind: 'fact', fact });
export const truthMixedBattleAction = (action: MixedBattleActionClaim): TruthMixedBattleExpression => ({ kind: 'action', action });
export const truthMixedBattleGroup = (kind: 'and' | 'or', ...terms: TruthMixedBattleExpression[]): TruthMixedBattleExpression =>
  ({ kind, terms });

/** Thin original Basic base33 adapter. Select an earned source snapshot and its
 * exact action prefix, never install a played hand, wallet, battle, plan,
 * commitment, answer, frozen fact or residual. The source owns one Truth. */
export function createTruthMixedBattleFixture(options: {
  mixed?: TruthMixedBattleExpression; window?: 'plans' | 'preparation';
} = {}) {
  const base = createTruthPlanExpressionFixture(), window = options.window ?? 'plans';
  const battleAt = base.actions.findLastIndex(step => step.action.type === 'chooseBattle');
  assert.ok(battleAt >= 0);
  const game = structuredClone(window === 'preparation' ? base.beforePreparation : base.game);
  const actions = structuredClone(window === 'preparation' ? base.actions.slice(0, battleAt + 1) : base.actions);
  assert.ok(game.battle?.event); const event = game.battle.event;
  const absent = base.setup.deck.find(card => card.kind === 'shield'); assert.ok(absent);
  const projectileFact: TruthFact = { kind: 'hand', name: base.projectile.name };
  const absentFact: TruthFact = { kind: 'hand', name: absent.name };
  const spiceFact: TruthFact = { kind: 'spice', compare: 'eq', value: truthMixedBattlePlayer(game, base.target).spice };
  const forecastFact: TruthFact = { kind: 'stormForecast', compare: 'gte', value: 1 };
  const weaponClaim: MixedBattleActionClaim = { kind: 'weapon', name: base.projectile.name };
  const mixed = structuredClone(options.mixed ?? truthMixedBattleGroup('and', truthMixedBattleFact(projectileFact),
    truthMixedBattleAction(weaponClaim)));
  const question = { kind: 'mixedBattlePlan' as const, target: base.target, battle: event,
    territory: base.territory, mixed };
  const questionAction = { type: 'truthAsk', question } satisfies Action;
  return { ...base, base, planSource: base, game, source: structuredClone(game), window, event, battle: event,
    mixed, question, questionAction, askStep: { actor: base.asker, action: questionAction },
    weaponClaim, projectileFact, heldFact: projectileFact, absentFact, spiceFact, forecastFact,
    sourceActions: actions, actions, steps: actions, sourceActionCount: actions.length,
    sourceCounts: { inherited: base.sourceActionCount, beforePlans: base.sourceActionCount,
      beforePreparation: battleAt + 1, inheritedReveal: base.base.sourceActionCount },
    sourceDisclosure: `Original public Basic Atreides/Emperor base33 source, ${actions.length} actual actions, at earned ${window === 'plans' ? 'beforePlans' : 'beforePreparation'}. Only inherited unopened starting Treachery/ordinary Spice positions and scalar lotteries are selected. Atreides actually holds one original Truthtrance, Emperor its original projectile and one actually paid reserve at Arrakeen10. This adapter changes only the raw question; all declarations, answers, preparation, payments, seals and votes remain actual caller controls.`,
    staging: [...base.staging.slice(0, 2),
      `Use the inherited actual phase, paid shipment and battle-selection prefix through its earned ${window === 'plans' ? 'beforePlans snapshot, including the original preparation decline' : 'beforePreparation snapshot, before its original preparation decline'}. Omit the later original plan seals; no private plan is installed.`,
      'The thin adapter supplies only an original current-fact/future-plan question with the native battle event and territory. It adds no played state. The original source owns one Truthtrance; no second physical copy or Ghola is supplied.'],
  };
}
export type TruthMixedBattleFixture = ReturnType<typeof createTruthMixedBattleFixture>;

/** Stop at private seals or public Traitor votes: those remain caller-owned. */
export function nextTruthMixedBattle(game: Game): TruthMixedBattleStep | null {
  if (game.truthtrance) return null;
  if (game.battle?.revealed && truthMixedBattleClean(game) && viewGame(game, game.host).battle!.traitorVoters
    .some(actor => game.battle!.traitorCalls[actor] === undefined)) return null;
  return nextStrongholdFactionsNativeStep(game);
}
export const nextTruthMixedBattleNativeStep = nextTruthMixedBattle;
export function advanceTruthMixedBattle(game: Game, until: (state: Game) => boolean,
  actions: TruthMixedBattleStep[] = []): Game {
  for (let count = 0; count < 800; count++) {
    if (until(game)) return game;
    const next = nextTruthMixedBattle(game);
    assert.ok(next, 'Choose the original Truthtrance, private plan or Traitor vote before continuing');
    game = actTruthMixedBattle(game, next.actor, next.action, actions);
  }
  throw Error('The original mixed battle source did not reach its finite boundary');
}
export function settleTruthMixedBattle(game: Game, actions: TruthMixedBattleStep[] = []): Game {
  return advanceTruthMixedBattle(game, truthMixedBattleClean, actions);
}

export function declareTruthMixedBattle(f: TruthMixedBattleFixture, source = f.game) {
  const before = structuredClone(source), actions: TruthMixedBattleStep[] = [];
  let game = actTruthMixedBattle(before, f.asker, { type: 'card', card: f.truth }, actions);
  const opened = structuredClone(game);
  game = passTruthPlanExpressionPriority(game, actions);
  return { game, before, opened, beforeQuestion: structuredClone(game), actions };
}
export const createTruthMixedBattleAskSource = declareTruthMixedBattle;
export function askTruthMixedBattle(game: Game, asker: string, target: string, mixed: TruthMixedBattleExpression,
  actions: TruthMixedBattleStep[] = []): Game {
  assert.ok(game.battle);
  return actTruthMixedBattle(game, asker, { type: 'truthAsk', question: {
    kind: 'mixedBattlePlan', target, battle: game.battle.event ?? null,
    territory: game.battle.territory, mixed: structuredClone(mixed),
  } }, actions);
}
export function answerTruthMixedBattle(game: Game, target: string, answer: TruthAnswer,
  actions: TruthMixedBattleStep[] = []): Game {
  assert.ok(viewGame(game, target).truthMixedBattleAnswers?.includes(answer));
  return actTruthMixedBattle(game, target, { type: 'truthAnswer', answer }, actions);
}
export function bindTruthMixedBattle(f: TruthMixedBattleFixture, answer: 'yes' | 'no' = 'yes',
  mixed = f.mixed, source = f.game) {
  const declared = declareTruthMixedBattle(f, source), actions = declared.actions;
  const asked = askTruthMixedBattle(declared.game, f.asker, f.target, mixed, actions);
  const game = answerTruthMixedBattle(asked, f.target, answer, actions);
  return { game, declared, asked, actions, actionCount: actions.length };
}

/** Seal the two actual original plans; solver previews never call this. */
export function revealTruthMixedBattle(game: Game, f: TruthMixedBattleFixture,
  plan: Action = f.projectilePlan, actions: TruthMixedBattleStep[] = []) {
  game = actTruthMixedBattle(game, f.target, plan, actions);
  const afterTargetPlan = structuredClone(game);
  game = actTruthMixedBattle(game, f.asker, f.ownPlan, actions);
  assert.ok(game.battle?.revealed);
  return { game, afterTargetPlan, actions };
}
export const sealTruthMixedBattle = revealTruthMixedBattle;

/** Actually decline original public votes and finish original cleanup. */
export function finishTruthMixedBattle(game: Game, f: TruthMixedBattleFixture,
  actions: TruthMixedBattleStep[] = []): Game {
  for (let count = 0; count < 100; count++) {
    if (!game.battle || game.battle.event !== f.event) return game;
    assert.ok(game.battle.revealed, 'Seal both original private plans before battle cleanup');
    const next = nextStrongholdFactionsNativeStep(game);
    assert.ok(next, 'Finish the current native battle control');
    game = actTruthMixedBattle(game, next.actor, next.action, actions);
  }
  throw Error('The original battle cleanup did not finish');
}

/** Read only the respondent's original raw aggregate and terminal status. */
export function truthMixedBattlePromise(game: Game,
  target = game.truthHistory?.at(-1)?.question.target ?? game.players[0].id) {
  const row = viewGame(game, target).mixedBattlePromises.find(row => row.player === target);
  assert.ok(row, 'The respondent retains the original mixed question and aggregate status');
  return row;
}
