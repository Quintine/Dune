import assert from 'node:assert/strict';
import { charityQuote } from '../game/charity';
import { type Action, type Game, viewGame } from '../game/engine';
import { type TruthQuestion } from '../game/truthtrance';
import {
  actTruthCharityPayments as act,
  createTruthCharityPaymentsFixture,
  declareTruthCharityPayments,
  truthCharityPaymentsInventory as inventory,
  truthCharityPaymentsPlayer as player,
} from './fixture-truth-charity-payments';

export { act, inventory, player };

/** Original Basic classic factions with the selected Ix deck and original
 * Truth cards, genuine Amal and Charity chronology. The only additional
 * preparation is a real four-spice bribe, leaving the target at one spice;
 * no wallet, cards, phase or readiness are installed by the fixture. */
export function createTruthCharityCommitmentFixture() {
  const base = createTruthCharityPaymentsFixture({ source: 'phase2', advanced: false });
  assert.equal(base.game.phase, 2);
  assert.equal(player(base.game, base.target).spice, 5);
  const game = act(base.game, base.target, { type: 'bribe', target: base.asker, amount: 4 });
  assert.equal(player(game, base.target).spice, 1);
  assert.equal(charityQuote(game, player(game, base.target)).total, 1);
  assert.deepEqual(inventory(game), base.originalCards);
  return { ...base, game, unprepared: structuredClone(base.game), source: structuredClone(game),
    charityQuestion: { kind: 'charity', target: base.target, turn: game.turn } satisfies TruthQuestion };
}
export type TruthCharityCommitmentFixture = ReturnType<typeof createTruthCharityCommitmentFixture>;

export function askTruthCharityCommitment(f: TruthCharityCommitmentFixture, source = f.game, copy: 0 | 1 = 0) {
  const declared = declareTruthCharityPayments(f, source, copy).game;
  return act(declared, f.asker, { type: 'truthAsk', question: f.charityQuestion });
}
export function bindTruthCharityCommitment(f: TruthCharityCommitmentFixture, answer: 'yes' | 'no', source = f.game, copy: 0 | 1 = 0) {
  const asked = askTruthCharityCommitment(f, source, copy);
  assert.ok(viewGame(asked, f.target).truthCharityAnswers?.includes(answer));
  return { asked, game: act(asked, f.target, { type: 'truthAnswer', answer }) };
}
export function rejectTruthCharityCommitment(game: Game, actor: string, action: Action) {
  const before = structuredClone(game);
  assert.throws(() => act(game, actor, action));
  assert.deepEqual(game, before, 'Rejected actions preserve the input');
}
