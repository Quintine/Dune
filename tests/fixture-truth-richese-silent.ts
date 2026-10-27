import assert from 'node:assert/strict';
import { viewGame, type Action, type Game } from '../game/engine';
import {
  actTruthtranceRichesePromises as act,
  advanceTruthtranceRichesePromises as advance,
  createTruthtranceRichesePromisesFixture,
  passTruthRicheseFreshDiscard,
  truthtranceRichesePromisesClean as clean,
  truthtranceRichesePromisesInventory as inventory,
  truthtranceRichesePromisesPlayer as player,
} from './fixture-truthtrance-richese-promises';

export { act, inventory, player, passTruthRicheseFreshDiscard };

/** Original public Basic/Advanced Richese/Atreides/Emperor setup, genuine
 * Charity prefix and actual first Silent cache declaration. The parent fixture
 * selects unopened deal and Spice positions and native scalar lotteries; no
 * hand, spice, auction, answer or receipt is installed. */
export function createTruthRicheseSilentFixture(advanced = false) {
  const original = createTruthtranceRichesePromisesFixture({ advanced });
  const game = advance(structuredClone(original.earlySource), state => clean(state) &&
    !!state.richeseAuction && state.richeseAuction.method === 'silent' && !state.richeseAuction.outcome,
    [], { position: 'first', method: 'silent' });
  const lot = game.richeseAuction!;
  const asker = original.asker, target = original.emperor, owner = original.richese;
  assert.equal(lot.source, 'cache'); assert.equal(lot.active, null);
  assert.ok(lot.eligible.includes(asker) && lot.eligible.includes(target) && lot.eligible.includes(owner));
  assert.deepEqual(lot.sealed, {});
  assert.ok(player(game, asker).hand.some(card => card.id === original.truth));
  assert.deepEqual(inventory(game), original.originalCards);
  return { original, game, asker, target, owner, lot:lot.event, card:lot.cardId,
    truth:original.truth, originalCards:original.originalCards, staging:original.staging };
}
export type TruthRicheseSilentFixture = ReturnType<typeof createTruthRicheseSilentFixture>;

export function askTruthRicheseSilent(f: TruthRicheseSilentFixture, minimum = 4, source = f.game) {
  let game = act(source, f.asker, { type:'card', card:f.truth });
  for (let count = 0; game.truthtrance?.stage === 'priority' && count < game.players.length; count++) {
    const seat = game.players.find(row => !game.truthtrance!.passed.includes(row.id)); assert.ok(seat);
    game = act(game, seat.id, { type:'truthPass' });
  }
  assert.equal(game.truthtrance?.stage, 'ask');
  return act(game, f.asker, { type:'truthAsk', question:{kind:'richeseBid', target:f.target,
    turn:source.turn, event:f.lot, minimum} });
}
export function bindTruthRicheseSilent(f: TruthRicheseSilentFixture, answer: 'yes'|'no', minimum = 4, source = f.game) {
  const asked = askTruthRicheseSilent(f, minimum, source);
  assert.ok(viewGame(asked, f.target).truthRicheseBidAnswers?.includes(answer));
  return { asked, game:passTruthRicheseFreshDiscard(act(asked, f.target, {type:'truthAnswer', answer})) };
}
export function rejectTruthRicheseSilent(game: Game, actor: string, action: Action) {
  const before = structuredClone(game);
  assert.throws(() => act(game, actor, action));
  assert.deepEqual(game, before, 'A rejected action cannot mutate its input');
}
