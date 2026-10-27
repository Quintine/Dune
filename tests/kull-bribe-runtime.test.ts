import assert from 'node:assert/strict';
import test from 'node:test';
import { viewGame, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { act, advance, clean, createKullBribeFixture as fixture, player, inventory,
  ask, bind, attempt, reject, type KullBribeKind } from './fixture-kull-bribe';

function held(game:Game,owner:string,card:string) { return player(game,owner).hand.some(row=>row.id === card); }
function offer(f:ReturnType<typeof fixture>,game:Game) {
  game=act(game,f.actor,attempt(f)); assert.equal(game.pendingKull?.stage,'offer');
  const reaction=viewGame(game,f.reactor).kullReaction; assert.ok(reaction);
  assert.ok(reaction.plays.some(row=>row.card.id === f.kull && !row.blocked));
  return {game,reaction};
}
function declare(f:ReturnType<typeof fixture>,game:Game) {
  const reaction=viewGame(game,f.reactor).kullReaction; assert.ok(reaction);
  return act(game,f.reactor,{type:'kullDecision',event:reaction.event,source:'printed',card:f.kull});
}

void test('public Basic Kull game admits an existing bribe Yes that requires native Charity funding',()=>{
  const f=fixture(); let game=act(f.charity,f.actor,{type:'bribe',target:f.recipient,amount:10});
  assert.equal(player(game,f.actor).spice,0); assert.equal(player(game,f.recipient).bribes,10);
  const asked=ask(f,game,'bribe',1);
  assert.ok(viewGame(asked,f.actor).truthBribeAnswers?.includes('yes'));
  assert.equal(viewGame(asked,f.asker).truthBribeAnswers,null);
  game=act(asked,f.actor,{type:'truthAnswer',answer:'yes'});
  assert.equal(game.discard.filter(card=>card.id===f.truth).length,1);
  const guide=viewGame(game,f.actor).bribePromiseGuide; assert.ok(guide);
  assert.equal(guide.action.type,'charity');
  game=act(game,f.actor,guide.action);
  assert.equal(player(game,f.actor).charityTurn,game.turn); assert.equal(player(game,f.actor).spice,2);
  game=act(game,f.actor,{type:'bribe',target:f.recipient,amount:1});
  assert.equal(player(game,f.recipient).bribes,11); assert.ok(game.bribePromises?.at(-1)?.fulfilled);
  assert.deepEqual(inventory(game),f.originalCards);
});

void test('a Charity-funded Yes survives the original phase-two Kull interruption',()=>{
  const f=fixture(); let source=act(f.early,f.actor,{type:'bribe',target:f.recipient,amount:10});
  assert.equal(player(source,f.actor).spice,0);
  source=bind(f,source,'yes','bribe',1).game;
  assert.equal(source.bribePromises?.at(-1)?.fulfilled,undefined);
  const income=advance(source,g=>g.phase===2 && g.response?.kind==='choamCharity');
  assert.equal(income.choamCharity?.turn === income.turn,false);
  assert.equal(player(income,f.actor).charityTurn,undefined);
  const original=structuredClone(income.bribePromises);
  const pending=act(income,f.actor,{type:'card',mode:'cancel',card:f.karama});
  assert.equal(pending.pendingKull?.stage,'offer');
  assert.equal(pending.pendingKull?.resume.response?.kind,'choamCharity');
  assert.deepEqual(pending.bribePromises,original);
  assert.equal(viewGame(pending,f.actor).bribePromiseGuide,null);
  const reaction=viewGame(pending,f.reactor).kullReaction; assert.ok(reaction);
  const declined=act(pending,f.reactor,{type:'kullDecision',event:reaction.event,decline:true});
  const canceledIncome=advance(declined,clean);
  assert.equal(canceledIncome.choamCharity?.canceled,true);
  assert.deepEqual(canceledIncome.bribePromises,original);
  const claim=viewGame(canceledIncome,f.actor).bribePromiseGuide; assert.ok(claim);
  assert.equal(claim.action.type,'charity');
  let game=act(canceledIncome,f.actor,claim.action);
  game=act(game,f.actor,{type:'bribe',target:f.recipient,amount:1});
  assert.ok(game.bribePromises?.at(-1)?.fulfilled); assert.equal(player(game,f.recipient).bribes,11);
  assert.deepEqual(inventory(game),f.originalCards);
  const declared=declare(f,pending), success=advance(declared,clean);
  assert.equal(success.choamCharity?.canceled,false);
  assert.deepEqual(success.bribePromises,original);
  const counter=viewGame(declared,f.counterOwner).responseControls?.cancelCards ?? [];
  assert.ok(counter.includes(f.counter));
  const intercepted=act(declared,f.counterOwner,{type:'card',mode:'cancel',card:f.counter});
  const resumed=advance(intercepted,clean);
  assert.equal(resumed.choamCharity?.canceled,true);
  assert.deepEqual(resumed.bribePromises,original);
  assert.ok(viewGame(resumed,f.actor).bribePromiseGuide);
  assert.deepEqual(inventory(success),f.originalCards); assert.deepEqual(inventory(resumed),f.originalCards);
});

void test('simple No caps real cumulative payments throughout the neutral Kull offer',()=>{
  const f=fixture(); let game=bind(f,f.game,'no','bribe',2).game;
  game=act(game,f.actor,{type:'bribe',target:f.recipient,amount:1});
  reject(game,f.actor,{type:'bribe',target:f.recipient,amount:1});
  const expected=structuredClone(game.bribePromises), {game:pending,reaction}=offer(f,game);
  assert.deepEqual(pending.bribePromises,expected);
  assert.equal(viewGame(pending,f.actor).bribePromiseGuide,null);
  reject(pending,f.actor,{type:'bribe',target:f.recipient,amount:1});
  game=act(pending,f.reactor,{type:'kullDecision',event:reaction.event,decline:true});
  assert.deepEqual(game.bribePromises,expected);
  assert.equal(game.karamaShipping?.owner,f.actor);
  reject(game,f.actor,{type:'bribe',target:f.recipient,amount:1});
  assert.equal(player(game,f.recipient).bribes,1);
  assert.deepEqual(inventory(game),f.originalCards);
});

for (const kind of ['bribe','bribeExpression','mixedBribe'] as const satisfies readonly KullBribeKind[]) {
  void test(`public Basic ${kind} Yes survives Kull success and a distinct Karama counter`,()=>{
    const f=fixture(), bound=bind(f,f.game,'yes',kind,3).game;
    const prior=structuredClone({simple:bound.bribePromises,grouped:bound.bribeExpressionPromises,mixed:bound.mixedBribeQuestions});
    const {game:pending}=offer(f,bound);
    assert.equal(viewGame(pending,f.actor).bribePromiseGuide,null);
    assert.ok(held(pending,f.actor,f.karama)); assert.deepEqual(inventory(pending),f.originalCards);
    const declared=declare(f,pending);
    assert.equal(declared.pendingKull?.stage,'counter');
    assert.equal(viewGame(declared,f.actor).bribePromiseGuide,null);
    const counter=viewGame(declared,f.counterOwner).responseControls?.cancelCards ?? [];
    assert.ok(counter.includes(f.counter));
    const canceled=act(declared,f.counterOwner,{type:'card',mode:'cancel',card:f.counter});
    const resumed=advance(canceled,clean);
    assert.deepEqual({simple:resumed.bribePromises,grouped:resumed.bribeExpressionPromises,mixed:resumed.mixedBribeQuestions},prior);
    assert.equal(resumed.karamaShipping?.owner,f.actor); assert.ok(held(resumed,f.reactor,f.kull));
    const guide=viewGame(resumed,f.actor).bribePromiseGuide; assert.ok(guide);
    const paid=act(resumed,f.actor,guide.action);
    assert.equal(player(paid,f.recipient).bribes,3);
    assert.deepEqual(inventory(paid),f.originalCards);
    const successful=advance(declared,clean);
    assert.ok(held(successful,f.actor,f.karama)); assert.equal(successful.karamaShipping,null);
    assert.deepEqual({simple:successful.bribePromises,grouped:successful.bribeExpressionPromises,mixed:successful.mixedBribeQuestions},prior);
    const required=viewGame(successful,f.actor).bribePromiseGuide; assert.ok(required);
    const paidAfterSuccess=act(successful,f.actor,required.action);
    assert.equal(player(paidAfterSuccess,f.recipient).bribes,3);
    assert.deepEqual(inventory(paidAfterSuccess),f.originalCards);
  });
}

for (const operator of ['and','or'] as const) {
  void test(`two-recipient ${operator.toUpperCase()} bribe answer preserves its full expression through a real Kull counter`,()=>{
    const f=fixture();
    let game=act(f.game,f.asker,{type:'card',card:f.truth});
    for (let count=0; game.truthtrance?.stage==='priority' && count<game.players.length; count++) {
      const seat=game.players.find(row=>!game.truthtrance!.passed.includes(row.id)); assert.ok(seat);
      game=act(game,seat.id,{type:'truthPass'});
    }
    assert.equal(game.truthtrance?.stage,'ask');
    const claim={kind:operator,terms:[
      {kind:'payment',recipient:f.recipient,minimum:2},
      {kind:'payment',recipient:f.counterOwner,minimum:1},
    ]};
    game=act(game,f.asker,{type:'truthAsk',question:{kind:'bribeExpression',target:f.actor,turn:game.turn,claim}});
    assert.ok(viewGame(game,f.actor).truthBribeExpressionAnswers?.includes('yes'));
    game=act(game,f.actor,{type:'truthAnswer',answer:'yes'});
    const ledger=structuredClone(game.bribeExpressionPromises);
    assert.deepEqual(ledger?.at(-1)?.claim,claim);
    const purse=player(game,f.actor).spice;
    const pending=offer(f,game).game;
    assert.equal(viewGame(pending,f.actor).bribePromiseGuide,null);
    assert.equal(player(pending,f.actor).spice,purse);
    const declared=declare(f,pending);
    assert.equal(viewGame(declared,f.actor).bribePromiseGuide,null);
    const counters=viewGame(declared,f.counterOwner).responseControls?.cancelCards ?? [];
    assert.ok(counters.includes(f.counter));
    const canceled=act(declared,f.counterOwner,{type:'card',mode:'cancel',card:f.counter});
    game=advance(canceled,clean);
    assert.deepEqual(game.bribeExpressionPromises,ledger);
    assert.equal(player(game,f.actor).spice,purse);
    assert.equal(game.karamaShipping?.owner,f.actor);
    const paidTo:string[]=[];
    for (let count=0; count<3 && !game.bribeExpressionPromises?.at(-1)?.fulfilled; count++) {
      const guide=viewGame(game,f.actor).bribePromiseGuide; assert.ok(guide);
      assert.equal(guide.action.type,'bribe');
      assert.ok(guide.action.target===f.recipient || guide.action.target===f.counterOwner);
      paidTo.push(guide.action.target as string);
      game=act(game,f.actor,guide.action);
    }
    assert.ok(game.bribeExpressionPromises?.at(-1)?.fulfilled);
    if (operator==='and') {
      assert.ok(paidTo.includes(f.recipient) && paidTo.includes(f.counterOwner));
      assert.ok(player(game,f.recipient).bribes>=2);
      assert.ok(player(game,f.counterOwner).bribes>=1);
    } else {
      assert.equal(new Set(paidTo).size,1,'An OR may complete with either one native payment');
      assert.ok(player(game,f.recipient).bribes>=2 || player(game,f.counterOwner).bribes>=1);
    }
    assert.deepEqual(inventory(game),f.originalCards);
  });
}

void test('an active Kull frame owns its original bribe ledger and never exposes a guide',()=>{
  const f=fixture(), bound=bind(f,f.game,'yes').game, pending=offer(f,bound).game;
  const reaction=viewGame(pending,f.reactor).kullReaction; assert.ok(reaction);
  const changed=structuredClone(pending); assert.ok(changed.bribePromises?.length);
  changed.bribePromises[0].progress++;
  reject(changed,f.reactor,{type:'kullDecision',event:reaction.event,decline:true});
  assert.equal(viewGame(pending,f.actor).bribePromiseGuide,null);
});

void test('neutral Kull offer is identical for opponents regardless of held Kull',()=>{
  const f=fixture(), bound=bind(f,f.game,'yes').game, absent=structuredClone(bound), owner=player(absent,f.reactor);
  // Controlled conserved swap: replace held Kull with an original undealt deck
  // card. This is not an earned trade or a naturally selected deal.
  const i=owner.hand.findIndex(card=>card.id===f.kull); assert.ok(i>=0 && absent.deck.length);
  [owner.hand[i],absent.deck[0]]=[absent.deck[0],owner.hand[i]];
  assert.deepEqual(inventory(absent),f.originalCards);
  const withCard=act(bound,f.actor,attempt(f)), withoutCard=act(absent,f.actor,attempt(f));
  assert.deepEqual(viewGame(withCard,f.actor).kullReaction,viewGame(withoutCard,f.actor).kullReaction);
  assert.equal(viewGame(withoutCard,f.actor).bribePromiseGuide,null);
});

void test('all four legal profiles can answer a Kull-game bribe question',()=>{
  const f=fixture(), asked=ask(f,f.game);
  for(const difficulty of DIFFICULTIES) {
    const view=viewGame(asked,f.actor); view.players.find(row=>row.id===f.actor)!.bot=difficulty;
    const action=botActions(view)[0]; assert.ok(action,difficulty); assert.equal(action.type,'truthAnswer');
    assert.ok(view.truthBribeAnswers?.includes(action.answer as 'yes'|'no'));
    const game=act(asked,f.actor,action); assert.deepEqual(inventory(game),f.originalCards);
    if (action.answer === 'yes') {
      const own=viewGame(game,f.actor); own.players.find(row=>row.id===f.actor)!.bot=difficulty;
      const guidance=own.bribePromiseGuide; assert.ok(guidance);
      const payment=botActions(own)[0]; assert.deepEqual(payment,guidance.action);
      assert.ok(act(game,f.actor,payment).bribePromises?.at(-1)?.fulfilled);
    }
    const offered=act(game,f.actor,attempt(f)), choam=viewGame(offered,f.reactor);
    choam.players.find(row=>row.id===f.reactor)!.bot=difficulty;
    const response=botActions(choam)[0]; assert.ok(response); assert.equal(response.type,'kullDecision');
    assert.deepEqual(inventory(act(offered,f.reactor,response)),f.originalCards);
  }
});
