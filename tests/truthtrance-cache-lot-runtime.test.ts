import assert from 'node:assert/strict';
import test from 'node:test';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { viewGame } from '../game/engine';
import { TRUTH_CARD_NAMES } from '../game/truthtrance-card-names';
import {
  actTruthtranceRichesePromises as act,
  advanceTruthtranceRichesePromises as advance,
  askTruthtranceRichesePromises as ask,
  createTruthtranceRichesePromisesFixture as fixture,
  passTruthRicheseFreshDiscard,
  truthtranceRichesePromisesClean as clean,
  truthtranceRichesePromisesInventory as inventory,
} from './fixture-truthtrance-richese-promises';

/** Actual setup, auction declaration and public cache lot; only unopened deck
 * order is selected by the shared fixture. */
function liveCache() {
  const f = fixture();
  const game = advance(f.earlySource, state => clean(state) && state.phase === 3 &&
    state.richeseAuction?.source === 'cache' && !state.richeseAuction.outcome);
  const card = game.richeseCache!.find(item => item.id === game.richeseAuction!.cardId);
  assert.ok(card);
  return { f, game, card };
}

for (const expected of ['yes', 'no'] as const) {
  void test(`native Basic public cache question answers ${expected} and all bot profiles continue`, () => {
    const { f, game, card } = liveCache();
    for (const seat of game.players) assert.equal(viewGame(game, seat.id).richeseAuction?.card?.id, card.id);
    const name = expected === 'yes' ? card.name : TRUTH_CARD_NAMES.find(face => face !== card.name);
    assert.ok(name);
    const originalLot = structuredClone(game.richeseAuction);
    const asked = ask(structuredClone(game), f, { kind: 'fact', target: f.richese,
      fact: { kind: 'cacheLot', name } });
    assert.equal(viewGame(asked, f.richese).truthAnswer, expected);
    const before = structuredClone(asked);
    assert.throws(() => act(asked, f.richese, { type: 'truthAnswer', answer: expected === 'yes' ? 'no' : 'yes' }));
    assert.deepEqual(asked, before);
    for (const difficulty of DIFFICULTIES) {
      const view = viewGame(asked, f.richese);
      view.players.find(player => player.id === f.richese)!.bot = difficulty;
      assert.deepEqual(botActions(view), [{ type: 'truthAnswer', answer: expected }]);
      const done = passTruthRicheseFreshDiscard(act(structuredClone(asked), f.richese,
        { type: 'truthAnswer', answer: expected }));
      assert.equal(done.truthtrance, null);
      assert.equal(done.truthHistory!.at(-1)!.answer, expected);
      assert.deepEqual(done.richeseAuction, originalLot);
      assert.deepEqual(inventory(done), f.originalCards);
    }
  });
}
