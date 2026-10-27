import assert from 'node:assert/strict';
import { viewGame, type Action, type Game } from '../game/engine';
import {
  actTruthtranceRichesePromises as act,
  advanceTruthtranceRichesePromises as advance,
  createTruthtranceRichesePromisesFixture,
  truthtranceRichesePromisesClean as clean,
  truthtranceRichesePromisesInventory as inventory,
  truthtranceRichesePromisesPlayer as player,
} from './fixture-truthtrance-richese-promises';

export { act, advance, clean, inventory, player };

/** Actual public R/A/E Basic or Advanced setup. The parent fixture selects only
 * unopened original deal/Spice positions and native scalar lotteries. Use its
 * genuine Charity prefix, then declare and start the original cache lot with
 * native controls. No dealt card, wallet, lot or promise is installed. */
export function createTruthRicheseBidFixture(advanced = false) {
  const original = createTruthtranceRichesePromisesFixture({ advanced });
  const asker = original.asker, target = original.emperor, owner = original.richese;
  let game: Game | undefined;
  for (const direction of ['clockwise', 'counterclockwise'] as const) {
    const candidate = advance(structuredClone(original.earlySource), state => clean(state) &&
      !!state.richeseAuction && state.richeseAuction.method === 'onceAround' && !state.richeseAuction.outcome,
      [], { position: 'first', method: 'onceAround', direction });
    if (candidate.richeseAuction?.active === asker && candidate.richeseAuction.order.includes(target)) {
      game = candidate;
      break;
    }
  }
  assert.ok(game, 'One native physical direction opens with the Truth holder before Emperor');
  const lot = game.richeseAuction!;
  assert.equal(lot.source, 'cache'); assert.equal(lot.bid, 0);
  assert.equal(lot.active, asker); assert.equal(lot.order.at(-1), owner);
  assert.ok(lot.eligible.includes(target));
  assert.ok(player(game, asker).hand.some(card => card.id === original.truth));
  assert.deepEqual(inventory(game), original.originalCards);
  return { original, game, asker, target, owner, lot: lot.event,
    card: lot.cardId, truth: original.truth, originalCards: original.originalCards,
    staging: original.staging };
}
export type TruthRicheseBidFixture = ReturnType<typeof createTruthRicheseBidFixture>;

export function declareTruthRicheseBid(f: TruthRicheseBidFixture, source = f.game) {
  let game = act(source, f.asker, { type: 'card', card: f.truth });
  for (let count = 0; game.truthtrance?.stage === 'priority' && count < game.players.length; count++) {
    const actor = game.players.find(row => !game.truthtrance!.passed.includes(row.id)); assert.ok(actor);
    game = act(game, actor.id, { type: 'truthPass' });
  }
  assert.equal(game.truthtrance?.stage, 'ask');
  return game;
}
export function askTruthRicheseBid(f: TruthRicheseBidFixture, target = f.target, minimum = 4, source = f.game) {
  const declared = declareTruthRicheseBid(f, source);
  return act(declared, f.asker, { type: 'truthAsk', question: {
    kind: 'richeseBid', target, turn: source.turn, event: f.lot, minimum,
  } });
}
export function bindTruthRicheseBid(f: TruthRicheseBidFixture, answer: 'yes' | 'no' = 'yes', minimum = 4,
  source = f.game, target = f.target) {
  const asked = askTruthRicheseBid(f, target, minimum, source);
  assert.ok(viewGame(asked, target).truthRicheseBidAnswers?.includes(answer));
  const game = act(asked, target, { type: 'truthAnswer', answer });
  return { game, asked };
}
export function rejectTruthRicheseBid(game: Game, actor: string, action: Action) {
  const before = structuredClone(game);
  assert.throws(() => act(game, actor, action));
  assert.deepEqual(game, before, 'Rejected native action must not mutate original state');
}
