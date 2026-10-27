import assert from 'node:assert/strict';
import test from 'node:test';
import { viewGame } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import {
  act, inventory, player, passTruthRicheseFreshDiscard, createTruthRicheseBidFixture, askTruthRicheseBid,
  bindTruthRicheseBid, rejectTruthRicheseBid as reject,
} from './fixture-truth-richese-bid';

for (const advanced of [false, true]) {
  const mode = advanced ? 'Advanced' : 'Basic';
  void test(`${mode} Once Around Yes requires a real qualifying funded bid`, () => {
    const f = createTruthRicheseBidFixture(advanced);
    const source = act(f.game, f.asker, { type: 'richeseBid', event: f.lot, amount: null });
    assert.equal(source.richeseAuction?.active, f.target);
    const { game: bound } = bindTruthRicheseBid(f, 'yes', 4, source);
    assert.equal(bound.discard.filter(card => card.id === f.truth).length, 1);
    assert.equal(bound.richeseAuction?.event, f.lot);
    assert.equal(bound.richeseAuction?.cardId, f.card);
    reject(bound, f.target, { type: 'richeseBid', event: f.lot, amount: null });
    reject(bound, f.target, { type: 'richeseBid', event: f.lot, amount: 3, allyPayment: 0 });
    const guide = viewGame(bound, f.target).richeseBidPromiseGuide; assert.ok(guide);
    assert.equal(guide.action.type, 'richeseBid'); assert.equal(guide.action.amount, 4);
    const bid = act(bound, f.target, guide.action);
    assert.ok(bid.richeseBidPromises?.some(row => row.player === f.target && row.fulfilled));
    assert.equal(player(bid, f.target).spice, 10, 'Declaring a bid does not pay the eventual invoice');
    assert.deepEqual(inventory(bid), f.originalCards);
  });

  void test(`${mode} Once Around No caps a real bid and preserves the lot`, () => {
    const f = createTruthRicheseBidFixture(advanced);
    const source = act(f.game, f.asker, { type: 'richeseBid', event: f.lot, amount: null });
    assert.equal(source.richeseAuction?.active, f.target);
    const { game: bound } = bindTruthRicheseBid(f, 'no', 4, source);
    reject(bound, f.target, { type: 'richeseBid', event: f.lot, amount: 4, allyPayment: 0 });
    const bid = act(bound, f.target, { type: 'richeseBid', event: f.lot, amount: 2, allyPayment: 0 });
    assert.equal(bid.richeseAuction?.event, f.lot); assert.equal(bid.richeseAuction?.cardId, f.card);
    assert.equal(bid.richeseAuction?.bid, 2); assert.equal(bid.richeseAuction?.bidder, f.target);
    assert.deepEqual(inventory(bid), f.originalCards);
  });

  void test(`${mode} Richese cannot promise to bid when its final owner turn has no earlier sale`, () => {
    const f = createTruthRicheseBidFixture(advanced);
    const asked = askTruthRicheseBid(f, f.owner, 1);
    assert.ok(!viewGame(asked, f.owner).truthRicheseBidAnswers?.includes('yes'));
    reject(asked, f.owner, { type: 'truthAnswer', answer: 'yes' });
    assert.deepEqual(inventory(asked), f.originalCards);
  });

  void test(`${mode} an actual opposing high bid releases an impossible waiting Yes`, () => {
    const f = createTruthRicheseBidFixture(advanced);
    const { game: bound } = bindTruthRicheseBid(f, 'yes', 4);
    assert.equal(bound.richeseAuction?.active, f.asker);
    assert.equal(viewGame(bound, f.target).richeseBidPromiseGuide, null);
    const raised = act(bound, f.asker, { type: 'richeseBid', event: f.lot, amount: 10, allyPayment: 0 });
    assert.equal(raised.richeseAuction?.active, f.target);
    assert.ok(raised.richeseBidPromises?.some(row => row.player === f.target && row.released));
    const pass = act(raised, f.target, { type: 'richeseBid', event: f.lot, amount: null });
    assert.deepEqual(inventory(pass), f.originalCards);
  });
}

for (const advanced of [false, true]) {
  const mode = advanced ? 'Advanced' : 'Basic';
  void test(`${mode} stale Once Around guided callbacks are rejected without changing the lot`, () => {
    const f = createTruthRicheseBidFixture(advanced);
    const source = act(f.game, f.asker, { type: 'richeseBid', event: f.lot, amount: null });
    const { game: bound } = bindTruthRicheseBid(f, 'yes', 4, source);
    const guide = viewGame(bound, f.target).richeseBidPromiseGuide; assert.ok(guide);
    reject(bound, f.target, { ...guide.action, richeseBidPromiseId: 'stale-promise' });
    reject(bound, f.target, { ...guide.action, event: 'stale-lot' });
    const accepted = act(bound, f.target, guide.action);
    assert.ok(accepted.richeseBidPromises?.some(row => row.player === f.target && row.fulfilled));
    assert.deepEqual(inventory(accepted), f.originalCards);
  });

  void test(`${mode} four legal bot profiles answer and follow the actual Once Around guide`, () => {
    const f = createTruthRicheseBidFixture(advanced);
    const source = act(f.game, f.asker, { type: 'richeseBid', event: f.lot, amount: null });
    const asked = askTruthRicheseBid(f, f.target, 4, source);
    for (const difficulty of DIFFICULTIES) {
      const answerView = viewGame(asked, f.target);
      answerView.players.find(row => row.id === f.target)!.bot = difficulty;
      const answer = botActions(answerView)[0]; assert.ok(answer, difficulty);
      assert.equal(answer.type, 'truthAnswer');
      assert.ok(['yes', 'no'].includes(String(answer.answer)));
      const bound = passTruthRicheseFreshDiscard(act(structuredClone(asked), f.target, answer));
      const bidView = viewGame(bound, f.target);
      bidView.players.find(row => row.id === f.target)!.bot = difficulty;
      const guide = bidView.richeseBidPromiseGuide; assert.ok(guide, difficulty);
      const chosen = botActions(bidView)[0]; assert.deepEqual(chosen, guide.action);
      const completed = act(bound, f.target, chosen);
      assert.ok(completed.richeseBidPromises?.some(row => row.player === f.target && row.fulfilled));
      assert.deepEqual(inventory(completed), f.originalCards);
    }
  });
}

// This Basic Richese fixture enables the Semuta preview, whose existing
// bribe promise profile does not support a Basic bribe question. The Advanced
// native fixture supports this independent-bribe admission path.
for (const advanced of [true]) {
  const mode = advanced ? 'Advanced' : 'Basic';
  void test(`${mode} a Once Around Yes excludes an independently unfunded later bribe Yes`, () => {
    const f = createTruthRicheseBidFixture(advanced);
    let source = act(f.game, f.asker, { type: 'richeseBid', event: f.lot, amount: null });
    assert.equal(source.richeseAuction?.active, f.target);
    assert.equal(player(source, f.target).spice, 10);
    // Controlled physical supplement: move the second original Truthtrance
    // from the unopened native main deck to the questioner's hand. No funds,
    // promise, lot, phase or other card is installed; card custody is conserved.
    source = structuredClone(source);
    const at = source.deck.findIndex(card => card.effect === 'truthtrance' && card.id !== f.truth);
    assert.ok(at >= 0);
    const [second] = source.deck.splice(at, 1);
    player(source, f.asker).hand.push(second);
    assert.deepEqual(inventory(source), f.originalCards);
    let game = bindTruthRicheseBid(f, 'yes', 8, source).game;
    const prior = structuredClone(game.richeseBidPromises![0]);
    game = act(game, f.asker, { type: 'card', card: second.id });
    for (let count = 0; game.truthtrance?.stage === 'priority' && count < game.players.length; count++) {
      const actor = game.players.find(row => !game.truthtrance!.passed.includes(row.id)); assert.ok(actor);
      game = act(game, actor.id, { type: 'truthPass' });
    }
    assert.equal(game.truthtrance?.stage, 'ask');
    game = act(game, f.asker, { type: 'truthAsk', question: {
      kind: 'bribe', target: f.target, turn: game.turn, recipient: f.asker, minimum: 5,
    } });
    const answers = viewGame(game, f.target).truthBribeAnswers;
    assert.ok(!answers?.includes('yes')); assert.ok(answers?.includes('no'));
    reject(game, f.target, { type: 'truthAnswer', answer: 'yes' });
    assert.deepEqual(game.richeseBidPromises![0], prior);
    game = act(game, f.target, { type: 'truthAnswer', answer: 'no' });
    assert.deepEqual(game.richeseBidPromises![0], prior);
    const guide = viewGame(game, f.target).richeseBidPromiseGuide; assert.ok(guide);
    assert.equal(guide.action.amount, 8);
    game = act(game, f.target, guide.action);
    assert.ok(game.richeseBidPromises?.some(row => row.player === f.target && row.fulfilled));
    assert.deepEqual(inventory(game), f.originalCards);
  });
}
