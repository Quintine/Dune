import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { createTruthBidFixture, truthBidInventory } from './fixture-truth-bid';

/** Genuine Harkonnen two-Truth opening at the original current ordinary lot.
 * Both questions use distinct actually dealt cards; no ledger is installed. */
function ask(game: Game, asker: string, card: string, question: unknown) {
  game = applyAction(game, asker, { type: 'card', card });
  while (game.truthtrance?.stage === 'priority') {
    const actor = game.players.find(player => !game.truthtrance!.passed.includes(player.id)); assert.ok(actor);
    game = applyAction(game, actor.id, { type: 'truthPass' });
  }
  return applyAction(game, asker, { type: 'truthAsk', question });
}
function questions(f: ReturnType<typeof createTruthBidFixture>, minimum: number) {
  return {
    bid: { kind: 'bid', target: f.target, turn: f.game.turn, lot: f.game.auction!.index + 1, minimum: 4 },
    travel: { kind: 'travel', target: f.target, turn: f.game.turn, mixed: { kind: 'and', terms: [
      { kind: 'action', action: { kind: 'ship', territory: 'arrakeen', minimum } },
      { kind: 'action', action: { kind: 'move', territory: 'carthag', minimum } },
    ] } },
  };
}
void test('native compatible bid and travel answers in either order offer the required declaration before any pass', () => {
  for (const bidFirst of [true, false]) {
    const f = createTruthBidFixture({ window: 'active' }), q = questions(f, 1);
    let game = ask(f.game, f.asker, f.truths[0], bidFirst ? q.bid : q.travel);
    game = applyAction(game, f.target, { type: 'truthAnswer', answer: 'yes' });
    game = ask(game, f.asker, f.truths[1], bidFirst ? q.travel : q.bid);
    game = applyAction(game, f.target, { type: 'truthAnswer', answer: 'yes' });
    const guide = viewGame(game, f.target).travelPromiseGuide; assert.ok(guide);
    assert.equal(guide.action.type, 'bid'); assert.equal(guide.action.amount, 4);
    assert.equal(guide.action.travelPromisePhase, 3); assert.ok(!('bidPromiseEvent' in guide.action));
    for (const difficulty of DIFFICULTIES) {
      const view = viewGame(game, f.target); view.players.find(player => player.id === f.target)!.bot = difficulty;
      const action = botActions(view)[0]; assert.deepEqual(action, view.travelPromiseGuide!.action);
      const done = applyAction(game, f.target, action);
      assert.equal(done.bidPromises?.[0].fulfilled, true); assert.equal(done.travelPromises?.[0].released, false);
      assert.equal(done.auction?.bid, 4); assert.deepEqual(truthBidInventory(done), f.originalCards);
    }
    assert.equal(game.truthHistory?.filter(row => row.answer === 'yes').length, 2);
  }
});
void test('native pending bid invoice and future travel cannot reserve the same original spice in either answer order', () => {
  for (const bidFirst of [true, false]) {
    const f = createTruthBidFixture({ window: 'active' }), q = questions(f, 8);
    let game = ask(f.game, f.asker, f.truths[0], bidFirst ? q.bid : q.travel);
    game = applyAction(game, f.target, { type: 'truthAnswer', answer: 'yes' });
    game = ask(game, f.asker, f.truths[1], bidFirst ? q.travel : q.bid);
    const view = viewGame(game, f.target);
    assert.deepEqual(bidFirst ? view.truthTravelAnswers : view.truthBidAnswers, ['no']);
    const before = structuredClone(game);
    assert.throws(() => applyAction(game, f.target, { type: 'truthAnswer', answer: 'yes' })); assert.deepEqual(game, before);
    game = applyAction(game, f.target, { type: 'truthAnswer', answer: 'no' });
    assert.equal(game.truthHistory?.length, 2); assert.deepEqual(truthBidInventory(game), f.originalCards);
    assert.equal(game.discard.filter(card => f.truths.includes(card.id)).length, 2);
  }
});
