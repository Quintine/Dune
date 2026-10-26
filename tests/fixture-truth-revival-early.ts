import assert from 'node:assert/strict';
import { viewGame, type Action, type Game } from '../game/engine';
import type { RevivalClaim } from '../game/revival-promises';
import {
  actTruthRevival, answerTruthRevival, askTruthRevival, bindTruthRevival, createTruthRevivalFixture,
  declareTruthRevival, nextTruthRevival, settleTruthRevival,
  truthRevivalClean, truthRevivalInventory, truthRevivalPlayer, type TruthRevivalStep, type TruthRevivalTransition,
} from './fixture-truth-revival';

export type TruthRevivalEarlyStep = TruthRevivalStep;
export const actTruthRevivalEarly = actTruthRevival;
export const truthRevivalEarlyClean = truthRevivalClean;
export const truthRevivalEarlyInventory = truthRevivalInventory;
export const truthRevivalEarlyPlayer = truthRevivalPlayer;
export const askTruthRevivalEarly = askTruthRevival;
export const answerTruthRevivalEarly = answerTruthRevival;
export const settleTruthRevivalEarly = settleTruthRevival;
export function nextTruthRevivalEarly(game: Game): TruthRevivalEarlyStep | null {
  if (game.truthtrance) return null;
  for (const player of game.players) {
    const view = viewGame(game, player.id);
    if (game.phase === 3 && view.bidPromiseGuide) return { actor: player.id, action: view.bidPromiseGuide.action };
    const guide = view.revivalPromiseGuide;
    if (guide && guide.phase === game.phase) return { actor: player.id, action: guide.action };
  }
  return nextTruthRevival(game);
}
export function advanceTruthRevivalEarly(game: Game, until: (state: Game) => boolean,
  actions: TruthRevivalEarlyStep[] = []): Game {
  for (let count = 0; count < 1500; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The earned early Revival source ended before its owned control');
    const next = nextTruthRevivalEarly(game); assert.ok(next, 'Answer the actual original Truthtrance before continuing');
    game = actTruthRevivalEarly(game, next.actor, next.action, actions);
  }
  throw Error('The earned early Revival source did not reach its finite boundary');
}
export function atTruthRevivalEarlyOpportunity(game: Game, target: string) {
  return game.phase === 4 && truthRevivalEarlyClean(game) &&
    (!game.revivalOrder || game.revivalOrder.remaining[0] === target);
}
export function reachTruthRevivalEarlyOpportunity(game: Game, target = 'emperor', actions: TruthRevivalEarlyStep[] = []) {
  return advanceTruthRevivalEarly(game, state => atTruthRevivalEarlyOpportunity(state, target), actions);
}
export function finishTruthRevivalEarly(game: Game, actions: TruthRevivalEarlyStep[] = []): Game {
  const turn = game.turn;
  return advanceTruthRevivalEarly(game, state => state.turn === turn && state.phase === 5 && truthRevivalEarlyClean(state), actions);
}

/** Reuse only the actual post-Storm snapshot and its exact original action
 * prefix. The already constructed later Revival suffix is excluded. Phase0
 * additionally completes a genuine turn; its optional prior return uses a real
 * free request and deliberately leaves that old ledger visible until next4. */
export function createTruthRevivalEarlyFixture(options: {
  advanced?: boolean; phase?: 0 | 1 | 2 | 3; poor?: boolean; stopper?: boolean; phase0PriorReturn?: boolean; targetKarama?: boolean;
} = {}) {
  const advanced = options.advanced ?? false, phase = options.phase ?? 1;
  const base = createTruthRevivalFixture({ advanced, stopper: options.stopper, targetKarama: options.targetKarama, window: 'waiting' });
  const prefixCount = base.sourceActionCount - base.arrival.steps.length;
  const actions = structuredClone(base.sourceActions.slice(0, prefixCount));
  assert.deepEqual(actions.at(-1), base.storm.steps.at(-1));
  let game = structuredClone(base.storm.after);
  const postStorm = structuredClone(game);
  const act = (actor: string, action: Action) => { game = actTruthRevivalEarly(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceTruthRevivalEarly(game, until, actions); };
  const transition = (run: () => void): TruthRevivalTransition => {
    const before = structuredClone(game), from = actions.length; run();
    return { before, steps: structuredClone(actions.slice(from)), after: structuredClone(game) };
  };
  assert.equal(game.turn, 2); assert.equal(game.phase, 1); assert.equal(truthRevivalEarlyPlayer(game, base.target).tanks, 3);
  let priorReturn: TruthRevivalTransition | null = null;
  if (phase === 0) {
    if (options.phase0PriorReturn) {
      reach(state => atTruthRevivalEarlyOpportunity(state, base.target));
      priorReturn = transition(() => {
        act(base.target, { type: 'revive', amount: 1, elite: 0 });
        game = settleTruthRevivalEarly(game, actions);
      });
    }
    reach(state => state.turn === 3 && state.phase === 0 && truthRevivalEarlyClean(state));
  } else if (phase !== 1) reach(state => state.turn === 2 && state.phase === phase && truthRevivalEarlyClean(state));
  assert.equal(game.phase, phase);
  // These still-unopened ordinary cards keep the following early-phase path
  // separate from an unrelated worm/alliance or Sandtrout programme.
  const futureSpiceOrder: { position: number; from: number; card: Game['spiceDeck'][number] }[] = [];
  if (phase === 0) for (const position of [0, 1]) {
    const from = game.spiceDeck.findIndex((card, index) => index >= position && 'territory' in card && !card.discovery && card.sector >= 7);
    assert.ok(from >= position); const card = game.spiceDeck.splice(from, 1)[0]; game.spiceDeck.splice(position, 0, card);
    futureSpiceOrder.push({ position, from, card: structuredClone(card) });
  }
  let funding: TruthRevivalTransition | null = null;
  if (options.poor) {
    assert.equal(phase, 2, 'The earned Charity witness begins at quiet actual Charity');
    assert.equal(truthRevivalEarlyPlayer(game, base.target).spice, 4);
    funding = transition(() => { act(base.target, { type: 'bribe', target: base.asker, amount: 4 }); });
    assert.equal(truthRevivalEarlyPlayer(game, base.target).spice, 0);
  }
  assert.deepEqual(truthRevivalEarlyInventory(game), base.originalCards);
  const question = { kind: 'revival' as const, target: base.target, turn: game.turn,
    counter: 'total' as const, minimum: options.poor || options.phase0PriorReturn ? 2 : 3 };
  return { ...base, game, sourceGame: structuredClone(game), base, advanced, phase,
    originalPostStorm: postStorm, postStormActionCount: prefixCount, excludedArrivalSteps: base.arrival.steps,
    priorReturn, futureSpiceOrder, funding, poor: options.poor ?? false,
    question, questionAction: { type: 'truthAsk', question } as Action,
    actions, sourceActions: structuredClone(actions), sourceActionCount: actions.length,
    staging: [] as string[], sourceDisclosure: 'Only the original earned Storm snapshot and its actual action prefix are reused; the later Revival suffix is removed from the source log. Phase0 completes a real extra turn and can earn a prior free return. Charity poverty uses an actual four-spice bribe before Truth. Questions, guides, bids, invoices, Charity and ordinary returns remain actual caller actions; no played state or promise is installed.' };
}
export type TruthRevivalEarlyFixture = ReturnType<typeof createTruthRevivalEarlyFixture>;
export function declareTruthRevivalEarly(f: TruthRevivalEarlyFixture, state = f.game, options: { copies?: 1 | 2 } = {}) {
  return declareTruthRevival(f, state, options);
}
export function bindTruthRevivalEarly(f: TruthRevivalEarlyFixture, answer: 'yes' | 'no' = 'yes',
  minimum = f.question.minimum, counter: RevivalClaim['counter'] = 'total', state = f.game) {
  return bindTruthRevival(f, answer, minimum, counter, state);
}

/** Every intervening phase follows native controls or its own exact projected
 * commitment guide. Stop before the actual current ordinary return, not after
 * an invented future action. */
export function completeTruthRevivalEarly(f: TruthRevivalEarlyFixture, state = f.game) {
  const actions: TruthRevivalEarlyStep[] = [];
  const game = reachTruthRevivalEarlyOpportunity(state, f.target, actions);
  return { game, before: structuredClone(state), actions, actionCount: actions.length };
}
