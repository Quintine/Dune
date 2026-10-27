import assert from 'node:assert/strict';
import test from 'node:test';
import { viewGame } from '../game/engine';
import { createSaphoTruthAuctionFixture as fixture, assertAuctionParent, act, inventory, player } from './fixture-sapho-truth-auction';
import { truthOrderFrame as frame, passTruthOrder as pass, playSaphoTruthOrder as play,
  finishTruthOrder as finish, finishOriginalTruthQuestions as answer, passFreshDiscard,
  rejectSaphoTruthOrder as reject, ownOrderChoices as choices } from './fixture-sapho-truth-order';

for (const advanced of [false,true]) for (const standingBid of [false,true]) for (const mode of ['first','last'] as const) {
  const label = `${advanced ? 'Advanced' : 'Basic'} ${standingBid ? 'standing bid' : 'unbid'} ${mode}`;
  void test(`${label} Sapho orders the original Truth questions without altering the ordinary auction`, () => {
    const f = fixture({advanced,standingBid,mode}), state = f.game, current = frame(state);
    assertAuctionParent(state,f.parent);
    assert.ok(choices(state,f.owner).some(row => row.card === f.card && row.mode === mode));
    const noOp = mode === 'first' ? 'last' : 'first';
    reject(state,f.owner,{type:'saphoTruthOrder',event:current.event,revision:current.revision,card:f.card,mode:noOp});
    reject(state,f.owner,{type:'saphoTruthOrder',event:'stale-auction-order',revision:current.revision,card:f.card,mode});
    reject(state,f.owner,{type:'saphoTruthOrder',event:current.event,revision:current.revision+1,card:f.card,mode});
    assertAuctionParent(state,f.parent);
    let game = play(state,f.owner,f.card,mode);
    assertAuctionParent(game,f.parent);
    game = passFreshDiscard(game);
    assertAuctionParent(game,f.parent);
    assert.ok(frame(game).passed.includes(f.owner));
    game = finish(game);
    assert.equal(mode === 'first' ? game.truthtrance!.queue[0].player : game.truthtrance!.queue.at(-1)!.player,f.owner);
    assertAuctionParent(game,f.parent);
    game = answer(game);
    assert.equal(game.truthtrance,null); assertAuctionParent(game,f.parent);
    assert.deepEqual(inventory(game),f.originalCards);
    // Continue the real original bidder: a normal pass cannot recreate the lot,
    // discard its actual card, replay the standing bid or spend the invoice.
    const actor = game.auction!.active, previous = structuredClone(game.auction!);
    game = act(game,actor,{type:'passBid'});
    assert.ok(game.auction); assert.equal(game.auction.index,previous.index);
    assert.equal(game.auction.cards[previous.index].id,previous.cards[previous.index].id);
    assert.equal(game.auction.bid,previous.bid); assert.equal(game.auction.bidder,previous.bidder);
    assert.ok(game.auction.passed.includes(actor));
    assert.deepEqual(inventory(game),f.originalCards);
  });
}

for (const claim of [false,true]) void test(
  `Basic ordinary standing bid survives a Sapho Truth-order Semuta ${claim ? 'claim' : 'pass'}`, () => {
    const f = fixture({advanced:false,standingBid:true,mode:'first'}), state = structuredClone(f.game);
    // Controlled conserved physical supplement: swap the actual cached Semuta
    // with an existing Atreides hand card. The public game, funded standing
    // invoice, original lot and previously queued Truths are not manufactured.
    const claimant = player(state,'atreides'), cache = state.richeseCache;
    assert.ok(cache); const semutaAt = cache.findIndex(card => card.effect === 'semutaDrug'); assert.ok(semutaAt >= 0);
    assert.ok(claimant.hand.length > 0);
    const [semuta] = cache.splice(semutaAt,1), [exchange] = claimant.hand.splice(0,1);
    claimant.hand.push(semuta); cache.push(exchange);
    assertAuctionParent(state,f.parent); assert.deepEqual(inventory(state),f.originalCards);
    // The other holder passes first, so the Sapho use finishes the public
    // ordering but its real fresh-discard Semuta window must settle first.
    let game = pass(state,f.other);
    assertAuctionParent(game,f.parent);
    game = play(game,f.owner,f.card,'first');
    assert.ok(game.pendingTreacheryDiscard?.reaction);
    assert.equal(game.pendingTreacheryDiscard.batch.entries[0].card.id,f.card);
    assert.equal(viewGame(game,'atreides').semutaReaction?.canCommit,true);
    assertAuctionParent(game,f.parent);
    const event = game.pendingTreacheryDiscard.batch.event;
    if (claim) game = act(game,'atreides',{type:'semutaCommit',event});
    else game = passFreshDiscard(game);
    assert.equal(game.pendingTreacheryDiscard,null); assert.equal(game.truthtrance?.stage,'ask');
    assert.equal(game.truthtrance?.queue[0].player,f.owner); assertAuctionParent(game,f.parent);
    assert.equal(player(game,'atreides').hand.some(card => card.id === f.card),claim);
    assert.equal(game.discard.some(card => card.id === semuta.id),claim);
    game = answer(game); assert.equal(game.truthtrance,null); assertAuctionParent(game,f.parent);
    assert.deepEqual(inventory(game),f.originalCards);
    const actor = game.auction!.active;
    game = act(game,actor,{type:'passBid'});
    assert.equal(game.auction?.bid,1); assert.equal(game.auction?.bidder,f.parent.auction!.bidder);
    assert.deepEqual(inventory(game),f.originalCards);
  },
);
