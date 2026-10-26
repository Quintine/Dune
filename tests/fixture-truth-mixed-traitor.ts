import assert from 'node:assert/strict';
import { viewGame, type Action, type Game } from '../game/engine';
import type { MixedActionExpression } from '../game/mixed-action-question';
import type { TraitorActionClaim } from '../game/mixed-traitor-question';
import type { TruthAnswer, TruthFact } from '../game/truthtrance';
import {
  createTruthTraitorDecisionFixture, actTruthTraitorDecision,
  nextTruthTraitorDecision, truthTraitorDecisionClean, truthTraitorDecisionInventory,
  truthTraitorDecisionPlayer, truthTraitorDecisionTraitors,
  type TruthTraitorDecisionFixture, type TruthTraitorDecisionStep,
} from './fixture-truth-traitor-decision';
import {
  createTruthTraitorHarkonnenFixture, nextTruthTraitorHarkonnen,
  type TruthTraitorHarkonnenFixture,
} from './fixture-truth-traitor-harkonnen';
import { nextStrongholdFactionsNativeStep } from './fixture-stronghold-factions';

export type TruthMixedTraitorExpression = MixedActionExpression<TraitorActionClaim>;
export type TruthMixedTraitorStep = TruthTraitorDecisionStep;
export const actTruthMixedTraitor = actTruthTraitorDecision;
export const truthMixedTraitorClean = truthTraitorDecisionClean;
export const truthMixedTraitorInventory = truthTraitorDecisionInventory;
export const truthMixedTraitorPlayer = truthTraitorDecisionPlayer;
export const truthMixedTraitorTraitors = truthTraitorDecisionTraitors;
export const truthMixedTraitorFact = (fact: TruthFact): TruthMixedTraitorExpression => ({ kind: 'fact', fact });
export const truthMixedTraitorCall = (call: boolean): TruthMixedTraitorExpression => ({ kind: 'action', action: { call } });
export const truthMixedTraitorAction = (action: TraitorActionClaim): TruthMixedTraitorExpression => ({ kind: 'action', action });
export const truthMixedTraitorGroup = (kind: 'and' | 'or', ...terms: TruthMixedTraitorExpression[]): TruthMixedTraitorExpression =>
  ({ kind, terms });

function adaptTruthMixedTraitor<T extends TruthTraitorDecisionFixture | TruthTraitorHarkonnenFixture>(
  base: T, source: Game, prefix: TruthMixedTraitorStep[], mixed?: TruthMixedTraitorExpression,
) {
  const game = structuredClone(source), actions = structuredClone(prefix);
  assert.ok(game.battle?.revealed && game.battle.event);
  assert.equal(game.battle.traitorCalls[base.target], undefined);
  const event = game.battle.event;
  const spiceFact: TruthFact = { kind: 'spice', compare: 'eq', value: truthMixedTraitorPlayer(game, base.target).spice };
  const absentFact: TruthFact = { kind: 'spice', compare: 'eq', value: truthMixedTraitorPlayer(game, base.target).spice + 1 };
  const heldFact: TruthFact = { kind: 'traitor', leader: base.traitorHeld };
  const forecastFact: TruthFact = { kind: 'stormForecast', compare: 'gte', value: 1 };
  const expression = structuredClone(mixed ?? truthMixedTraitorGroup('and', truthMixedTraitorFact(spiceFact), truthMixedTraitorCall(true)));
  const question = { kind: 'mixedTraitorCall' as const, target: base.target, battle: event,
    territory: base.territory, mixed: expression };
  const questionAction = { type: 'truthAsk', question } satisfies Action;
  return { ...base, base, game, source: structuredClone(game), event, battle: event,
    mixed: expression, question, questionAction, askStep: { actor: base.asker, action: questionAction },
    spiceFact, trueFact: spiceFact, absentFact, falseFact: absentFact, heldFact, forecastFact,
    sourceActions: actions, actions, steps: actions, sourceActionCount: actions.length,
    sourceCounts: { inherited: base.sourceActionCount, selected: actions.length },
    sourceDisclosure: `Original public Basic base33 source with ${game.players.length} seats, ${actions.length} actual actions, at its earned revealed/unsubmitted native Traitor decision. The inherited source selects only unopened original cards and scalar lotteries. This adapter changes only the raw mixed question; declarations, answers, votes, payments, Nexus returns and cleanup remain actual caller actions.`,
    staging: [...base.staging,
      'Thin mixed Traitor adapter: retain the exact original revealed battle, matching physical identity and unsubmitted native voter. No played hand, purse, clock, alliance, offer, vote, promise, fact result or residual is installed. The source owns one actual Truthtrance; no second copy or Ghola is supplied.'],
  };
}

/** Exact original two-seat Basic source; all original 26 actions are inherited. */
export function createTruthMixedTraitorFixture(options: { mixed?: TruthMixedTraitorExpression } = {}) {
  const base = createTruthTraitorDecisionFixture();
  return adaptTruthMixedTraitor(base, base.game, base.actions, options.mixed);
}
export type TruthMixedTraitorFixture = ReturnType<typeof createTruthMixedTraitorFixture>;

/** Original three-seat source: earned remote ally, pending Cunning return, or
 * the exact prefix immediately before the original Cunning draw. */
export function createTruthMixedTraitorHarkonnenFixture(options: {
  kind?: 'ally' | 'cunning'; window?: 'pendingReturn' | 'beforeCunning'; mixed?: TruthMixedTraitorExpression;
} = {}) {
  const base = createTruthTraitorHarkonnenFixture({ kind: options.kind });
  const beforeCunning = options.kind === 'cunning' && options.window === 'beforeCunning';
  return adaptTruthMixedTraitor(base, beforeCunning ? base.beforeCunning : base.game,
    beforeCunning ? base.actions.slice(0, base.beforeCunningActionCount) : base.actions, options.mixed);
}
export type TruthMixedTraitorHarkonnenFixture = ReturnType<typeof createTruthMixedTraitorHarkonnenFixture>;
type MixedFixture = TruthMixedTraitorFixture | TruthMixedTraitorHarkonnenFixture;

/** Priority may advance, but the caller retains Truth, votes and returns. */
export function nextTruthMixedTraitor(game: Game): TruthMixedTraitorStep | null {
  return game.nexusCards ? nextTruthTraitorHarkonnen(game) : nextTruthTraitorDecision(game);
}
export const nextTruthMixedTraitorNativeStep = nextTruthMixedTraitor;
export function advanceTruthMixedTraitor(game: Game, until: (state: Game) => boolean,
  actions: TruthMixedTraitorStep[] = []): Game {
  for (let count = 0; count < 800; count++) {
    if (until(game)) return game;
    const step = nextTruthMixedTraitor(game);
    assert.ok(step, 'Choose the original Truthtrance, native Traitor vote or pending Nexus return');
    game = actTruthMixedTraitor(game, step.actor, step.action, actions);
  }
  throw Error('The original mixed Traitor source did not reach its finite boundary');
}
export function settleTruthMixedTraitor(game: Game, actions: TruthMixedTraitorStep[] = []): Game {
  return advanceTruthMixedTraitor(game, truthMixedTraitorClean, actions);
}
export function declareTruthMixedTraitor(f: MixedFixture, source = f.game) {
  const before = structuredClone(source), actions: TruthMixedTraitorStep[] = [];
  let game = actTruthMixedTraitor(before, f.asker, { type: 'card', card: f.truth }, actions);
  const opened = structuredClone(game);
  for (const player of game.players) if (!game.truthtrance!.passed.includes(player.id))
    game = actTruthMixedTraitor(game, player.id, { type: 'truthPass' }, actions);
  return { game, before, opened, beforeQuestion: structuredClone(game), actions };
}
export const createTruthMixedTraitorAskSource = declareTruthMixedTraitor;
export function askTruthMixedTraitor(game: Game, asker: string, target: string, mixed: TruthMixedTraitorExpression,
  actions: TruthMixedTraitorStep[] = []): Game {
  assert.ok(game.battle?.event);
  return actTruthMixedTraitor(game, asker, { type: 'truthAsk', question: {
    kind: 'mixedTraitorCall', target, battle: game.battle.event,
    territory: game.battle.territory, mixed: structuredClone(mixed),
  } }, actions);
}
export function answerTruthMixedTraitor(game: Game, target: string, answer: TruthAnswer,
  actions: TruthMixedTraitorStep[] = []): Game {
  assert.ok(viewGame(game, target).truthMixedTraitorAnswers?.includes(answer));
  return actTruthMixedTraitor(game, target, { type: 'truthAnswer', answer }, actions);
}
export function bindTruthMixedTraitor(f: MixedFixture, answer: 'yes' | 'no' = 'yes',
  mixed = f.mixed, source = f.game) {
  const declared = declareTruthMixedTraitor(f, source), actions = declared.actions;
  const asked = askTruthMixedTraitor(declared.game, f.asker, f.target, mixed, actions);
  const game = answerTruthMixedTraitor(asked, f.target, answer, actions);
  return { game, declared, asked, actions, actionCount: actions.length };
}
export function voteTruthMixedTraitor(game: Game, actor: string, call: boolean,
  actions: TruthMixedTraitorStep[] = []): Game {
  return actTruthMixedTraitor(game, actor, { type: 'traitorCall', call }, actions);
}
export const nativeVoteTruthMixedTraitor = voteTruthMixedTraitor;

/** Finish the actual remaining votes, responses and cleanup. Bound target votes
 * must already have been submitted explicitly by the caller. */
export function finishTruthMixedTraitor(game: Game, f: Pick<MixedFixture, 'event' | 'target'>,
  actions: TruthMixedTraitorStep[] = []): Game {
  for (let count = 0; count < 100; count++) {
    if (!game.battle || game.battle.event !== f.event) return game;
    assert.notEqual(game.battle.traitorCalls[f.target], undefined, 'Declare the bound native vote before cleanup');
    assert.ok(!game.truthtrance && !game.nexusTraitorPending, 'Finish the original Truthtrance or Nexus return');
    const step = nextStrongholdFactionsNativeStep(game);
    assert.ok(step, 'Finish the original revealed battle control');
    game = actTruthMixedTraitor(game, step.actor, step.action, actions);
  }
  throw Error('The original mixed Traitor battle cleanup did not finish');
}
export function truthMixedTraitorPromise(game: Game,
  target = game.truthHistory?.at(-1)?.question.target ?? game.players[0].id) {
  const row = viewGame(game, target).mixedTraitorPromises.find(row => row.player === target);
  assert.ok(row, 'The respondent retains its original raw mixed question and terminal status');
  return row;
}
