import assert from 'node:assert/strict';
import type { Game } from '../game/engine';
import {
  actTruthBribe, advanceTruthBribe, answerTruthBribe, askTruthBribe, createTruthBribeFixture,
  declareTruthBribe, finishTruthBribe, nextTruthBribe, settleTruthBribe, truthBribeBalances,
  truthBribeClean, truthBribeDeferred, truthBribeInventory, truthBribePlayer,
  type TruthBribeStep, type TruthBribeTransition,
} from './fixture-truth-bribe';

export type MentatBribeStep = TruthBribeStep;
export type MentatBribeTransition = TruthBribeTransition;
export const actMentatBribe = actTruthBribe;
export const nextMentatBribe = nextTruthBribe;
export const advanceMentatBribe = advanceTruthBribe;
export const settleMentatBribe = settleTruthBribe;
export const finishMentatBribe = finishTruthBribe;
export const mentatBribeClean = truthBribeClean;
export const mentatBribeInventory = truthBribeInventory;
export const mentatBribePlayer = truthBribePlayer;
export const mentatBribeBalances = truthBribeBalances;
export const mentatBribeDeferred = truthBribeDeferred;
export const declareMentatBribe = declareTruthBribe;
export const askMentatBribe = askTruthBribe;
export const answerMentatBribe = answerTruthBribe;

/** Reach the current turn's actual Mentat from earlier phases, or the next
 * actual opening when this turn's collection has already happened. */
export function nextMentatBribeOpening(game: Game, actions: MentatBribeStep[] = []): Game {
  const turn = game.turn + Number(game.phase === 8);
  return advanceMentatBribe(game, state => state.turn === turn && state.phase === 8 && mentatBribeClean(state), actions);
}

/** The inherited original H/A/E base33 source earns Collection and Mentat by
 * real native actions. H still owns both original, unplayed Truthtrances and E
 * its original Shield and ten spendable spice. No played state is installed. */
export function createMentatBribeFixture(options: { advanced?: boolean } = {}) {
  const base = createTruthBribeFixture({ advanced: options.advanced, phase: 7 });
  const actions = structuredClone(base.sourceActions), before = structuredClone(base.game), from = actions.length;
  const game = nextMentatBribeOpening(base.game, actions);
  const phase7: MentatBribeTransition = {
    before: structuredClone(base.base.game),
    steps: structuredClone(base.sourceActions.slice(base.base.sourceActionCount)),
    after: structuredClone(base.game),
  };
  const mentat: MentatBribeTransition = {
    before, steps: structuredClone(actions.slice(from)), after: structuredClone(game),
  };
  assert.equal(game.phase, 8); assert.equal(game.turn, 1); assert.ok(mentatBribeClean(game));
  assert.equal(mentatBribePlayer(game, base.payer).spice, 10);
  assert.ok(game.players.every(player => player.bribes === 0 && player.ally === null));
  assert.deepEqual(mentatBribePlayer(game, base.asker).hand.map(card => card.id), base.truths);
  assert.deepEqual(mentatBribeInventory(game), base.originalCards);
  return { ...base, game, sourceGame: structuredClone(game), base, phase: 8 as const, phase7, mentat,
    originalBalances: mentatBribeBalances(game), originalDeferred: mentatBribeDeferred(game),
    actions, sourceActions: structuredClone(actions), sourceActionCount: actions.length,
    staging: [] as string[],
    sourceDisclosure: 'Inherited genuine public original H/A/E base33 setup, ordinary auction and native Collection/Mentat actions. H retains both original unplayed Truthtrances; E retains its original Shield and10spice. Only inherited unopened deal/lot/Spice positions and scalar lotteries are selected. The current Mentat opening already collected its receipts. A new payment spends the payer now and waits in the exact recipient bribes until the next actual Mentat opening. No played clock, purse, hand, receipt or promise is installed.' };
}
export type MentatBribeFixture = ReturnType<typeof createMentatBribeFixture>;

export function bindMentatBribe(f: MentatBribeFixture, answer: 'yes' | 'no' = 'yes', minimum = f.minimum,
  recipient = f.recipient, state = f.game) {
  const declared = declareMentatBribe(f, state), actions = [...declared.actions];
  const asked = askMentatBribe(declared.game, f.asker, f.target, recipient, minimum, actions);
  const game = answerMentatBribe(asked, f.target, answer, actions);
  return { game, declared, asked, actions, actionCount: actions.length };
}

/** Keep next Storm and ordinary Collection visible before the next real
 * Mentat opening. Incoming escrow cannot masquerade as cash along this path. */
export function completeMentatBribe(f: MentatBribeFixture, state = f.game) {
  assert.equal(state.phase, 8);
  let game = state; const turn = game.turn, actions: MentatBribeStep[] = [];
  const transition = (until: (state: Game) => boolean): MentatBribeTransition => {
    const before = structuredClone(game), from = actions.length;
    game = advanceMentatBribe(game, until, actions);
    return { before, steps: structuredClone(actions.slice(from)), after: structuredClone(game) };
  };
  const nextTurn = transition(state => state.turn === turn + 1 && state.phase === 0 && mentatBribeClean(state));
  const collection = transition(state => state.turn === turn + 1 && state.phase === 7 && mentatBribeClean(state));
  const mentat = transition(state => state.turn === turn + 1 && state.phase === 8 && mentatBribeClean(state));
  assert.deepEqual(mentatBribeInventory(game), f.originalCards);
  return { game, nextTurn, collection, mentat, actions, actionCount: actions.length };
}

/** Move Collection readiness explicitly so an unpaid Yes is carried into
 * Mentat instead of automatically consuming the adapter's suggested payment. */
export function enterMentatBribeWithUnpaidPromise(game: Game, actions: MentatBribeStep[] = []): Game {
  assert.equal(game.phase, 7); assert.ok(mentatBribeClean(game));
  const turn = game.turn;
  for (const player of game.players) {
    if (game.phase === 7 && !game.ready.includes(player.id))
      game = actMentatBribe(game, player.id, { type: 'ready' }, actions);
  }
  return advanceMentatBribe(game, state => state.turn === turn && state.phase === 8 && mentatBribeClean(state), actions);
}
