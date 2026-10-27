import assert from 'node:assert/strict';
import { viewGame, type Action, type Game } from '../game/engine';
import type { TruthQuestion } from '../game/truthtrance';
import { beforeIxSpiceDraw, orderIxSpiceCards } from './fixture-ix-spice-cards';
import {
  actTruthCharityPayments as act,
  advanceTruthCharityPayments,
  createTruthCharityPaymentsFixture,
  reachTruthCharityPaymentsClaim,
  truthCharityPaymentsClean as clean,
  truthCharityPaymentsInventory as inventory,
  truthCharityPaymentsPlayer as player,
} from './fixture-truth-charity-payments';
import { createTruthTurnAmalFixture } from './fixture-truth-turn-amal';

export { act, clean, inventory, player };

/** Two original selected-Ix classic Basic starts: phase 0 from the real setup,
 * or phase 1 after actually resolving Amal. Only original unopened deal/Spice
 * positions and native scalar lotteries are selected, as in parent fixtures.
 * No played wallet, hand, pass, phase, promise or income is installed. */
export function createTruthCharityEarlyFixture(phase: 0 | 1 = 1) {
  const base = phase === 0
    ? createTruthTurnAmalFixture({ phase: 0, advanced: false })
    : createTruthCharityPaymentsFixture({ source: 'afterAmal', advanced: false });
  const game = phase === 0
    ? advanceTruthCharityPayments(structuredClone(base.game), g => g.phase === 0 && clean(g), [], true)
    : structuredClone(base.game);
  assert.equal(game.phase, phase);
  assert.ok(clean(game));
  assert.equal(game.advanced, false);
  assert.equal(player(game, base.target).charityTurn, undefined);
  assert.deepEqual(inventory(game), base.originalCards);
  const charityQuestion = { kind:'charity',target:base.target,turn:game.turn } satisfies TruthQuestion;
  return { ...base, game, charityQuestion, initialPhase:phase };
}
export type TruthCharityEarlyFixture = ReturnType<typeof createTruthCharityEarlyFixture>;

export function declareTruthCharityEarly(f: TruthCharityEarlyFixture, source = f.game, copy: 0 | 1 = 0) {
  let game = act(source,f.asker,{type:'card',card:f.truths[copy]});
  while (game.truthtrance?.stage === 'priority') {
    const actor = game.players.find(row => !game.truthtrance!.passed.includes(row.id)); assert.ok(actor);
    game = act(game,actor.id,{type:'truthPass'});
  }
  assert.equal(game.truthtrance?.stage,'ask');
  return game;
}
export function askTruthCharityEarly(f: TruthCharityEarlyFixture,source = f.game,copy:0|1 = 0): Game {
  const declared = declareTruthCharityEarly(f,source,copy);
  return act(declared,f.asker,{type:'truthAsk',question:f.charityQuestion});
}
export function bindTruthCharityEarly(f: TruthCharityEarlyFixture,answer:'yes'|'no',source=f.game,copy:0|1=0) {
  const asked = askTruthCharityEarly(f,source,copy);
  assert.ok(viewGame(asked,f.target).truthCharityAnswers?.includes(answer));
  return {asked,game:act(asked,f.target,{type:'truthAnswer',answer})};
}
export function reachEarlyCharity(game: Game): Game {
  let current = game;
  if (current.phase === 0) {
    current = advanceTruthCharityPayments(current,beforeIxSpiceDraw,[],true);
    // Select only a safe unopened physical Spice prefix, matching the parent
    // native source; this does not alter any previously played card or money.
    orderIxSpiceCards(current,[{territory:'hagga_basin'}]);
  }
  return reachTruthCharityPaymentsClaim(current);
}
export function rejectTruthCharityEarly(game: Game,actor: string,action: Action): void {
  const before = structuredClone(game);
  assert.throws(() => act(game,actor,action));
  assert.deepEqual(game,before,'Rejected action must not mutate its input');
}
