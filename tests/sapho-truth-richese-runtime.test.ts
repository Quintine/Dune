import assert from 'node:assert/strict';
import test from 'node:test';
import { viewGame, type Game } from '../game/engine';
import { createSaphoTruthRicheseFixture as fixture, assertRicheseParent, act, inventory, player } from './fixture-sapho-truth-richese';
import { truthOrderFrame as frame, passTruthOrder as pass, playSaphoTruthOrder as play,
  finishTruthOrder as finish, finishOriginalTruthQuestions as answer, passFreshDiscard,
  rejectSaphoTruthOrder as reject, ownOrderChoices as choices } from './fixture-sapho-truth-order';

function assertSealedPrivacy(game: Game, bidder: string, observer: string) {
  const own = viewGame(game,bidder).richeseAuction!, other = viewGame(game,observer).richeseAuction!;
  assert.equal(own.ownBid,1); assert.equal(other.ownBid,null);
  assert.equal(other.revealedBids,null);
  assert.equal('sealed' in other,false);
}
function continueBidding(game: Game, method: 'onceAround'|'silent', lot: string) {
  const actor = method === 'onceAround' ? game.richeseAuction!.active! :
    game.richeseAuction!.order.find(id => !Object.hasOwn(game.richeseAuction!.sealed,id))!;
  assert.ok(actor);
  return act(game,actor,{type:'richeseBid',event:lot,amount:method === 'silent' ? 0 : null,allyPayment:0});
}

for (const advanced of [false,true]) for (const method of ['onceAround','silent'] as const) {
  void test(`${advanced ? 'Advanced' : 'Basic'} ${method} Sapho preserves the funded native cache lot while ordering Truth`, () => {
    const f = fixture({advanced,method,standingBid:true}), state = f.game, current = frame(state);
    assertRicheseParent(state,f.parent);
    if (method === 'silent') assertSealedPrivacy(state,f.semutaHolder,f.owner);
    assert.ok(choices(state,f.owner).some(row => row.card === f.card && row.mode === f.mode));
    const noOp = f.mode === 'first' ? 'last' : 'first';
    reject(state,f.owner,{type:'saphoTruthOrder',event:current.event,revision:current.revision,card:f.card,mode:noOp});
    reject(state,f.owner,{type:'saphoTruthOrder',event:'stale',revision:current.revision,card:f.card,mode:f.mode});
    reject(state,f.owner,{type:'saphoTruthOrder',event:current.event,revision:current.revision + 1,card:f.card,mode:f.mode});
    let game = play(state,f.owner,f.card,f.mode);
    assertRicheseParent(game,f.parent);
    if (method === 'silent') assertSealedPrivacy(game,f.semutaHolder,f.owner);
    game = passFreshDiscard(game);
    assertRicheseParent(game,f.parent);
    reject(game,f.owner,{type:'saphoTruthOrder',event:current.event,revision:current.revision,card:f.card,mode:f.mode});
    game = finish(game);
    assert.equal(f.mode === 'first' ? game.truthtrance!.queue[0].player : game.truthtrance!.queue.at(-1)!.player,f.owner);
    assertRicheseParent(game,f.parent);
    game = answer(game);
    assert.equal(game.truthtrance,null); assertRicheseParent(game,f.parent);
    if (method === 'silent') assertSealedPrivacy(game,f.semutaHolder,f.owner);
    assert.deepEqual(inventory(game),f.originalCards);
    game = continueBidding(game,method,f.lot);
    assert.equal(game.richeseAuction?.event,f.lot);
    assert.deepEqual(inventory(game),f.originalCards);
  });
}

for (const method of ['onceAround','silent'] as const) for (const claim of [false,true]) {
  void test(`Basic ${method} Sapho Semuta ${claim ? 'claim' : 'pass'} restores the original funded cache lot`, () => {
    const f = fixture({method,standingBid:true,semuta:true});
    assert.ok(f.semuta); assertRicheseParent(f.game,f.parent);
    let game = pass(f.game,f.other);
    game = play(game,f.owner,f.card,f.mode);
    const pending = game.pendingTreacheryDiscard; assert.ok(pending?.reaction);
    assert.equal(pending.continuation.kind,'saphoTruthOrderDiscard');
    assert.equal(pending.batch.entries[0].card.id,f.card);
    assert.equal(viewGame(game,f.semutaHolder).semutaReaction?.canCommit,true);
    assertRicheseParent(game,f.parent);
    if (method === 'silent') assertSealedPrivacy(game,f.semutaHolder,f.owner);
    if (claim) game = act(game,f.semutaHolder,{type:'semutaCommit',event:pending.batch.event});
    else game = passFreshDiscard(game);
    assert.equal(game.pendingTreacheryDiscard,null); assert.equal(game.truthtrance?.stage,'ask');
    assertRicheseParent(game,f.parent);
    assert.equal(player(game,f.semutaHolder).hand.some(card => card.id === f.card),claim);
    assert.equal(game.discard.some(card => card.id === f.semuta),claim);
    assert.deepEqual(inventory(game),f.originalCards);
    game = answer(game); assert.equal(game.truthtrance,null); assertRicheseParent(game,f.parent);
    game = continueBidding(game,method,f.lot);
    assert.equal(game.richeseAuction?.event,f.lot); assert.deepEqual(inventory(game),f.originalCards);
  });
}

for (const method of ['onceAround','silent'] as const) {
  void test(`Basic ${method} definite Truth cost offers a fresh Semuta reaction after Sapho was passed`, () => {
    const f = fixture({method,standingBid:true,semuta:true});
    let game = pass(f.game,f.other);
    game = play(game,f.owner,f.card,f.mode);
    assert.equal(game.pendingTreacheryDiscard?.continuation.kind,'saphoTruthOrderDiscard');
    game = passFreshDiscard(game);
    assert.equal(game.truthtrance?.stage,'ask'); assertRicheseParent(game,f.parent);
    const asker = game.truthtrance!.queue[0].player;
    const target = game.players.find(row => row.id !== asker)!.id;
    const consumed = game.truthtrance!.queue[0].card;
    game = act(game,asker,{type:'truthAsk',question:{kind:'fact',target,fact:{kind:'spice',compare:'gte',value:0}}});
    game = act(game,target,{type:'truthAnswer',answer:'yes'});
    const pending = game.pendingTreacheryDiscard; assert.ok(pending?.reaction);
    assert.equal(pending.continuation.kind,'truthtranceDiscard');
    assert.equal(pending.batch.entries[0].card.id,consumed);
    assert.equal(viewGame(game,f.semutaHolder).semutaReaction?.canCommit,true);
    assertRicheseParent(game,f.parent);
    if (method === 'silent') assertSealedPrivacy(game,f.semutaHolder,f.owner);
    game = act(game,f.semutaHolder,{type:'semutaCommit',event:pending.batch.event});
    assert.equal(game.pendingTreacheryDiscard,null);
    assert.ok(player(game,f.semutaHolder).hand.some(card => card.id === consumed));
    assertRicheseParent(game,f.parent);
    game = answer(game); assert.equal(game.truthtrance,null); assertRicheseParent(game,f.parent);
    assert.deepEqual(inventory(game),f.originalCards);
    game = continueBidding(game,method,f.lot);
    assert.equal(game.richeseAuction?.event,f.lot); assert.deepEqual(inventory(game),f.originalCards);
  });
}
