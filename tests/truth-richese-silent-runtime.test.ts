import assert from 'node:assert/strict';
import test from 'node:test';
import { handLimit, normalizeAutomaticGame, viewGame } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { act, inventory, player, createTruthRicheseSilentFixture, askTruthRicheseSilent,
  bindTruthRicheseSilent, rejectTruthRicheseSilent as reject } from './fixture-truth-richese-silent';

for (const advanced of [false, true]) {
  const mode = advanced ? 'Advanced' : 'Basic';
  void test(`${mode} Silent Yes requires a funded sealed bid and reveals only after all submissions`, () => {
    const f = createTruthRicheseSilentFixture(advanced);
    const {game:bound} = bindTruthRicheseSilent(f, 'yes', 4);
    assert.equal(bound.discard.filter(card => card.id === f.truth).length, 1);
    assert.equal(bound.richeseAuction?.event, f.lot);
    reject(bound, f.target, {type:'richeseBid', event:f.lot, amount:0, allyPayment:0});
    reject(bound, f.target, {type:'richeseBid', event:f.lot, amount:3, allyPayment:0});
    reject(bound, f.target, {type:'richeseBid', event:f.lot, amount:11, allyPayment:0});
    const guide = viewGame(bound, f.target).richeseBidPromiseGuide; assert.ok(guide);
    assert.equal(guide.action.amount, 4);
    let game = act(bound, f.target, guide.action);
    assert.ok(game.richeseBidPromises?.some(row => row.player === f.target && row.fulfilled));
    assert.equal(player(game, f.target).spice, 10, 'A sealed submission is not settlement');
    const own = viewGame(game, f.target).richeseAuction!, other = viewGame(game, f.owner).richeseAuction!;
    assert.equal(own.ownBid, 4); assert.equal(other.ownBid, null);
    assert.equal(own.revealedBids, null); assert.equal(other.revealedBids, null);
    assert.ok(other.submitted.includes(f.target));
    assert.ok(!game.log.some(entry => entry.text.includes('Silent bids revealed together')));
    game = act(game, f.asker, {type:'richeseBid', event:f.lot, amount:2, allyPayment:0});
    assert.equal(viewGame(game, f.owner).richeseAuction?.revealedBids, null);
    game = act(game, f.owner, {type:'richeseBid', event:f.lot, amount:0, allyPayment:0});
    assert.ok(game.log.some(entry => entry.text.includes('Silent bids revealed together')));
    assert.ok(player(game, f.target).hand.some(card => card.id === f.card));
    assert.equal(player(game, f.target).spice, 6, 'The winning invoice is paid once');
    assert.deepEqual(inventory(game), f.originalCards);
  });

  void test(`${mode} Silent No permits zero or a smaller sealed bid and rejects its threshold`, () => {
    const f = createTruthRicheseSilentFixture(advanced), {game:bound} = bindTruthRicheseSilent(f, 'no', 4);
    reject(bound, f.target, {type:'richeseBid', event:f.lot, amount:4, allyPayment:0});
    reject(bound, f.target, {type:'richeseBid', event:f.lot, amount:null, allyPayment:0});
    const guide = viewGame(bound, f.target).richeseBidPromiseGuide; assert.ok(guide);
    assert.equal(guide.action.amount, 0, 'Silent decline is a physical sealed zero');
    const zero = act(bound, f.target, guide.action);
    assert.equal(viewGame(zero, f.target).richeseAuction?.ownBid, 0);
    assert.equal(viewGame(zero, f.owner).richeseAuction?.ownBid, null);
    assert.ok(zero.richeseBidPromises?.some(row => row.player === f.target && row.fulfilled));
    const low = act(bound, f.target, {type:'richeseBid', event:f.lot, amount:3, allyPayment:0});
    assert.equal(viewGame(low, f.target).richeseAuction?.ownBid, 3);
    assert.equal(viewGame(low, f.owner).richeseAuction?.revealedBids, null);
    assert.ok(low.richeseBidPromises?.some(row => row.player === f.target && row.fulfilled));
    assert.deepEqual(inventory(zero), f.originalCards); assert.deepEqual(inventory(low), f.originalCards);
  });

  void test(`${mode} hidden opposing Silent bid does not alter the target's legal answer or guide`, () => {
    const f = createTruthRicheseSilentFixture(advanced);
    const source = act(f.game, f.asker, {type:'richeseBid',event:f.lot,amount:9,allyPayment:0});
    assert.equal(viewGame(source, f.target).richeseAuction?.revealedBids, null);
    assert.equal(viewGame(source, f.target).richeseAuction?.ownBid, null);
    const asked = askTruthRicheseSilent(f, 4, source);
    assert.ok(viewGame(asked, f.target).truthRicheseBidAnswers?.includes('yes'));
    const bound = act(asked, f.target, {type:'truthAnswer', answer:'yes'});
    const guide = viewGame(bound, f.target).richeseBidPromiseGuide; assert.ok(guide);
    assert.equal(guide.action.amount, 4);
    const submitted = act(bound, f.target, guide.action);
    assert.ok(submitted.richeseBidPromises?.some(row => row.player === f.target && row.fulfilled));
    assert.equal(viewGame(submitted, f.owner).richeseAuction?.revealedBids, null);
    const settled = act(submitted, f.owner, {type:'richeseBid',event:f.lot,amount:0,allyPayment:0});
    assert.ok(player(settled, f.asker).hand.some(card => card.id === f.card));
    assert.equal(player(settled, f.target).spice, 10, 'Losing submissions spend no spice');
    assert.deepEqual(inventory(settled), f.originalCards);
  });

  void test(`${mode} Silent funded answers, stale guide rejection and four legal bot profiles`, () => {
    const f = createTruthRicheseSilentFixture(advanced);
    const unaffordable = askTruthRicheseSilent(f, 11);
    assert.ok(!viewGame(unaffordable, f.target).truthRicheseBidAnswers?.includes('yes'));
    assert.ok(viewGame(unaffordable, f.target).truthRicheseBidAnswers?.includes('no'));
    reject(unaffordable, f.target, {type:'truthAnswer',answer:'yes'});
    const asked = askTruthRicheseSilent(f, 4);
    for (const difficulty of DIFFICULTIES) {
      const answerView = viewGame(asked, f.target);
      answerView.players.find(row => row.id === f.target)!.bot = difficulty;
      const answer = botActions(answerView)[0]; assert.ok(answer, difficulty);
      assert.equal(answer.type, 'truthAnswer');
      assert.ok(['yes','no'].includes(String(answer.answer)));
      const bound = act(structuredClone(asked), f.target, answer);
      const bidView = viewGame(bound, f.target);
      bidView.players.find(row => row.id === f.target)!.bot = difficulty;
      const guide = bidView.richeseBidPromiseGuide; assert.ok(guide, difficulty);
      reject(bound, f.target, {...guide.action,richeseBidPromiseId:'stale-receipt'});
      reject(bound, f.target, {...guide.action,event:'stale-lot'});
      const chosen = botActions(bidView)[0]; assert.deepEqual(chosen, guide.action);
      const completed = act(bound, f.target, chosen);
      assert.ok(completed.richeseBidPromises?.some(row => row.player === f.target && row.fulfilled));
      reject(completed, f.target, chosen);
      assert.deepEqual(inventory(completed), f.originalCards);
    }
  });
}

for (const advanced of [false, true]) for (const answer of ['yes','no'] as const) {
  const mode = advanced ? 'Advanced' : 'Basic';
  void test(`${mode} a full hand forces a sealed zero and resolves the prior Silent ${answer}`, () => {
    const f = createTruthRicheseSilentFixture(advanced), {game:bound} = bindTruthRicheseSilent(f, answer, 4);
    // Controlled external acquisition supplement: move only existing unopened
    // main-deck cards to this respondent until the normal hand limit is met.
    // Preserve every physical card, the live lot, funding, answer and phase.
    const harmed = structuredClone(bound), respondent = player(harmed,f.target);
    while (respondent.hand.length < handLimit(respondent)) {
      const card = harmed.deck.shift(); assert.ok(card);
      respondent.hand.push(card);
    }
    assert.deepEqual(inventory(harmed),f.originalCards);
    assert.equal(Object.hasOwn(harmed.richeseAuction!.sealed,f.target),false);
    const beforeSequence = harmed.log.at(-1)?.seq ?? 0;
    const settled = normalizeAutomaticGame(harmed);
    const receipt = settled.richeseBidPromises!.find(row => row.player === f.target); assert.ok(receipt);
    if (answer === 'yes') { assert.equal(receipt.released,true); assert.ok(!receipt.fulfilled); }
    else { assert.equal(receipt.fulfilled,true); assert.ok(!receipt.released); }
    assert.equal(viewGame(settled,f.target).richeseAuction?.ownBid,0);
    const observer = viewGame(settled,f.owner).richeseAuction!;
    assert.equal(observer.ownBid,null); assert.equal(observer.revealedBids,null);
    assert.ok(observer.submitted.includes(f.target));
    const fresh = settled.log.filter(entry => entry.seq > beforeSequence);
    assert.ok(fresh.some(entry => entry.text.includes('submitted a sealed bid')));
    assert.ok(fresh.every(entry => !/revealed together|zero|0 spice|no bid/i.test(`${entry.text} ${entry.automatic?.name ?? ''}`)),
      'Automatic public notices must not disclose the sealed zero before reveal');
    assert.deepEqual(inventory(settled),f.originalCards);
  });
}
