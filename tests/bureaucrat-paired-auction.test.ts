import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, handLimit, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { advanceBureaucratPairedFunding } from './fixture-bureaucrat-paired-funding';
import {
  createBureaucratPairedAuctionFixture, payBureaucratPairedAuction,
  allowPairedAuctionResponses, choosePairedAuctionBureaucrat,
  pairedAuctionPlayer, pairedAuctionPhysicalCards,
  type BureaucratPairedAuctionFixture, type PairedAuctionSource,
} from './fixture-bureaucrat-paired-auction';

function rejectUnchanged(game:Game,actor:string,action:Action) {
  const before=JSON.stringify(game);
  assert.throws(()=>applyAction(game,actor,action));
  assert.equal(JSON.stringify(game),before);
}
function assertCosts(f:BureaucratPairedAuctionFixture,game:Game) {
  assert.equal(pairedAuctionPlayer(game,f.payer).spice,pairedAuctionPlayer(f.beforePledge,f.payer).spice-f.payerShare);
  if(f.donor!==f.payee) assert.equal(pairedAuctionPlayer(game,f.donor).spice,
    pairedAuctionPlayer(f.beforePledge,f.donor).spice-f.donorShare);
  assert.equal(game.aid[f.donor]?.amount ?? 0,0);
  assert.equal(pairedAuctionPlayer(game,f.payer).hand.filter(c=>c.id===f.card).length,1);
  assert.deepEqual(pairedAuctionPhysicalCards(game),f.physical);
}
function assertOutcome(f:BureaucratPairedAuctionFixture,done:Game,diverted:number) {
  assertCosts(f,done);
  assert.equal(pairedAuctionPlayer(done,f.payee).spice,
    pairedAuctionPlayer(f.beforePledge,f.payee).spice-(f.donor===f.payee?f.donorShare:0)+f.amount-diverted);
  const buyer=pairedAuctionPlayer(done,f.payer),before=pairedAuctionPlayer(f.beforeAction,f.payer);
  assert.deepEqual(buyer.hand.map(c=>c.id),[...before.hand.map(c=>c.id),f.card,f.beforeAction.deck[0].id]);
  assert.equal(done.currentAuctionSale,null);
  assert.equal(done.bureaucratPayments?.used.length ?? 0,diverted?1:0);
  assert.equal(viewGame(done,f.trainer).bureaucrat.usedThisPhase,diverted===2);
  if(f.source==='normal') {
    assert.equal(done.auction!.index,f.beforeAction.auction!.index+1);
    assert.equal(done.auction!.cards[done.auction!.index].id,f.beforeAction.auction!.cards[f.beforeAction.auction!.index+1].id);
    assert.equal(done.auction!.bid,0);
    assert.equal(done.auction!.bidder,null);
  } else if(f.source==='cache'&&f.position==='first') {
    assert.equal(done.richeseAuction,null);
    assert.equal(done.auction!.index,0);
    assert.equal(done.auction!.cards.length,done.richeseBidding!.normalCount);
    assert.equal(done.richeseCache!.some(c=>c.id===f.card),false);
  } else if(f.source==='blackMarket') {
    assert.equal(done.decision?.kind,'richeseDeclaration');
    assert.equal(done.richeseBidding!.blackMarketSold,true);
    assert.equal(pairedAuctionPlayer(done,f.richese).hand.some(c=>c.id===f.card),false);
  }
}

for(const advanced of [false,true]) {
  const sources:PairedAuctionSource[]=advanced?['normal','cache','blackMarket']:['normal','cache'];
  for(const source of sources) {
    for(const [payerShare,donorShare] of [[5,3],[3,5],[5,5],[0,5]]) {
      for(const redirect of [false,true]) {
        void test(`${advanced?'Advanced':'Basic'} paired ${source} ${payerShare}+${donorShare}: ${redirect?'Bank two':'full native income'}, one purchase and original H bonus`,()=>{
          const f=createBureaucratPairedAuctionFixture({advanced,source,payerShare,donorShare});
          const pending=allowPairedAuctionResponses(payBureaucratPairedAuction(f));
          assert.equal(pending.decision?.kind,'bureaucratPayment');
          assertCosts(f,pending);
          assert.equal(pairedAuctionPlayer(pending,f.payee).spice,pairedAuctionPlayer(f.beforeAction,f.payee).spice);
          assert.equal(pairedAuctionPlayer(pending,f.payer).hand.length,pairedAuctionPlayer(f.beforeAction,f.payer).hand.length+1);
          const done=allowPairedAuctionResponses(choosePairedAuctionBureaucrat(pending,redirect));
          assertOutcome(f,done,redirect?2:0);
          rejectUnchanged(done,f.trainer,{type:'decision',event:pending.bureaucratPaymentEvent,redirect:true});
        });
      }
    }
    void test(`${advanced?'Advanced':'Basic'} paired ${source} three plus three never pools a qualifying contribution`,()=>{
      const f=createBureaucratPairedAuctionFixture({advanced,source,payerShare:3,donorShare:3});
      const done=allowPairedAuctionResponses(payBureaucratPairedAuction(f));
      assert.equal(viewGame(done,f.trainer).bureaucrat.pending,null);
      assertOutcome(f,done,0);
    });
    void test(`${advanced?'Advanced':'Basic'} paired ${source}: gross eight is public, allied shares and qualifying identity are not`,()=>{
      const primary=createBureaucratPairedAuctionFixture({advanced,source,payerShare:5,donorShare:3});
      const donor=createBureaucratPairedAuctionFixture({advanced,source,payerShare:3,donorShare:5});
      const a=allowPairedAuctionResponses(payBureaucratPairedAuction(primary));
      const b=allowPairedAuctionResponses(payBureaucratPairedAuction(donor));
      for(const viewer of [primary.trainer,primary.guild,primary.payee]) {
        const left=viewGame(a,viewer),right=viewGame(b,viewer);
        const {event:_left,...invoice}=left.bureaucrat.pending!;
        const {event:_right,...other}=right.bureaucrat.pending!;
        assert.equal(invoice.payer,null);
        assert.equal(invoice.payee,primary.payee);
        assert.equal(invoice.amount,8);
        assert.deepEqual(invoice,other);
        assert.equal('contributions' in invoice,false);
        assert.equal('signature' in invoice,false);
        if(source==='normal') {
          assert.equal(left.auction!.bid,8);
          assert.equal(left.auction!.allyPayment,undefined);
        } else {
          assert.equal(left.richeseAuction!.revealedBids![primary.payer],8);
          assert.deepEqual(left.richeseAuction!.revealedBids,right.richeseAuction!.revealedBids);
          assert.equal('richeseFunding' in left,false);
          assert.equal('contributions' in left.richeseAuction!,false);
        }
      }
      assertOutcome(primary,allowPairedAuctionResponses(choosePairedAuctionBureaucrat(a)),2);
      assertOutcome(donor,allowPairedAuctionResponses(choosePairedAuctionBureaucrat(b)),2);
    });
    void test(`${advanced?'Advanced':'Basic'} paired ${source}: cross-actor and stale choices cannot debit, refund or duplicate a native purchase`,()=>{
      const f=createBureaucratPairedAuctionFixture({advanced,source,payerShare:5,donorShare:5});
      const bid=applyAction(f.game,f.payer,f.action);
      rejectUnchanged(bid,f.donor,{type:'pledgeAid',amount:3});
      const pending=allowPairedAuctionResponses(payBureaucratPairedAuction(f));
      rejectUnchanged(pending,f.donor,{type:'decision',event:pending.bureaucratPaymentEvent,redirect:true});
      rejectUnchanged(pending,f.trainer,{type:'decision',event:'old-richese-invoice',redirect:true});
      rejectUnchanged(pending,f.payer,f.action);
      assertOutcome(f,allowPairedAuctionResponses(choosePairedAuctionBureaucrat(pending)),2);
    });
  }
  void test(`${advanced?'Advanced':'Basic'} original ordinary Emperor Karama cancellation banks the full funded invoice without a Bureaucrat use`,()=>{
    const f=createBureaucratPairedAuctionFixture({advanced,payerShare:5,donorShare:5,counter:true});
    const paid=payBureaucratPairedAuction(f);
    assert.equal(paid.response?.kind,'emperorIncome');
    assertCosts(f,paid);
    assert.equal(viewGame(paid,f.trainer).bureaucrat.pending,null);
    const done=allowPairedAuctionResponses(applyAction(paid,f.trainer,{type:'card',card:f.counterCard,mode:'cancel'}));
    assert.equal(pairedAuctionPlayer(done,f.emperor).spice,pairedAuctionPlayer(f.beforeAction,f.emperor).spice);
    assert.equal(pairedAuctionPlayer(done,f.payer).hand.length,pairedAuctionPlayer(f.beforeAction,f.payer).hand.length+2);
    assert.equal(done.discard.filter(c=>c.id===f.counterCard).length,1);
    assert.equal(done.bureaucratPayments?.used.length ?? 0,0);
    assert.equal(done.auction!.index,1);
    assertCosts(f,done);
  });
  void test(`${advanced?'Advanced':'Basic'} original Karama purchases remain normal-only, not a free cache invoice`,()=>{
    const normal=createBureaucratPairedAuctionFixture({advanced,counter:true});
    const done=allowPairedAuctionResponses(applyAction(normal.game,normal.trainer,{type:'card',card:normal.counterCard,mode:'purchase'}));
    assert.equal(pairedAuctionPlayer(done,normal.trainer).spice,pairedAuctionPlayer(normal.game,normal.trainer).spice);
    assert.equal(pairedAuctionPlayer(done,normal.emperor).spice,pairedAuctionPlayer(normal.game,normal.emperor).spice);
    assert.equal(pairedAuctionPlayer(done,normal.trainer).hand.filter(c=>c.id===normal.card).length,1);
    assert.equal(done.discard.filter(c=>c.id===normal.counterCard).length,1);
    assert.equal(done.auction!.index,1);
    assert.equal(done.bureaucratPayments?.used.length ?? 0,0);
    const cache=createBureaucratPairedAuctionFixture({advanced,source:'cache',counter:true});
    rejectUnchanged(cache.game,cache.trainer,{type:'card',card:cache.counterCard,mode:'purchase'});
    const pending=allowPairedAuctionResponses(payBureaucratPairedAuction(cache));
    assertOutcome(cache,allowPairedAuctionResponses(choosePairedAuctionBureaucrat(pending)),2);
  });
  void test(`${advanced?'Advanced':'Basic'} actual last-cache closing advances without another funded debit or purchase`,()=>{
    const f=createBureaucratPairedAuctionFixture({advanced,source:'cache',method:'onceAround',position:'last',payerShare:5,donorShare:5});
    const pending=allowPairedAuctionResponses(payBureaucratPairedAuction(f));
    const paid=allowPairedAuctionResponses(choosePairedAuctionBureaucrat(pending));
    assertOutcome(f,paid,2);
    const closed=advanceBureaucratPairedFunding(paid,state=>state.phase>3&&!state.phaseOpening&&!state.response&&!state.decision);
    assert.equal(closed.turn,paid.turn);
    assert.equal(pairedAuctionPlayer(closed,'p').spice,pairedAuctionPlayer(paid,'p').spice);
    assert.equal(pairedAuctionPlayer(closed,'f').spice,pairedAuctionPlayer(paid,'f').spice);
    assert.equal(pairedAuctionPlayer(closed,'r').spice,pairedAuctionPlayer(paid,'r').spice);
    assert.deepEqual(pairedAuctionPlayer(closed,'p').hand,pairedAuctionPlayer(paid,'p').hand);
    assert.equal(closed.bureaucratPayments?.used.length,1);
    assert.equal(viewGame(closed,'b').bureaucrat.usedThisPhase,false);
    assert.equal(closed.currentAuctionSale,null);
    assert.equal(closed.auction,null);
    assert.equal(closed.richeseAuction,null);
  });
  for(const donor of ['b','e'] as const) {
    for(const [payerShare,donorShare] of [[3,5],[5,3]]) {
      void test(`${advanced?'Advanced':'Basic'} original worm alliance: ${donor==='b'?'trainer':'Emperor payee'} contribution cannot qualify or mask H five`,()=>{
        const f=createBureaucratPairedAuctionFixture({advanced,donor,payerShare,donorShare});
        const allowed=allowPairedAuctionResponses(payBureaucratPairedAuction(f));
        const qualifies=payerShare===5;
        assert.equal(viewGame(allowed,f.trainer).bureaucrat.pending!==null,qualifies);
        const done=qualifies?allowPairedAuctionResponses(choosePairedAuctionBureaucrat(allowed)):allowed;
        assertOutcome(f,done,qualifies?2:0);
      });
    }
  }
}

void test('Basic original Richese opening cannot declare a Black Market lot',()=>{
  const f=createBureaucratPairedAuctionFixture({source:'cache'});
  assert.equal(f.opening.decision?.kind,'richeseDeclaration');
  rejectUnchanged(f.opening,f.richese,{type:'decision',event:f.opening.richeseBidding!.event,
    card:pairedAuctionPlayer(f.opening,f.richese).hand[0].id,method:'silent'});
  const pending=allowPairedAuctionResponses(payBureaucratPairedAuction(f));
  assertOutcome(f,allowPairedAuctionResponses(choosePairedAuctionBureaucrat(pending)),2);
});

void test('sealed native Richese bid conceals the amount until original bidders finish',()=>{
  const f=createBureaucratPairedAuctionFixture({advanced:true,source:'cache',payerShare:3,donorShare:5});
  const submitted=applyAction(f.game,f.payer,f.action);
  for(const viewer of [f.trainer,f.richese,f.guild]) {
    const lot=viewGame(submitted,viewer).richeseAuction!;
    assert.equal(lot.revealedBids,null);
    assert.equal(lot.ownBid,null);
    assert.equal(lot.ownAllyPayment,0);
  }
  const pending=allowPairedAuctionResponses(payBureaucratPairedAuction(f));
  assert.equal(viewGame(pending,f.trainer).richeseAuction!.revealedBids![f.payer],8);
  assertOutcome(f,allowPairedAuctionResponses(choosePairedAuctionBureaucrat(pending)),2);
});

for(const difficulty of DIFFICULTIES) {
  void test(`${difficulty} original paired Bureaucrat bot resolves Richese seller invoice and releases native compulsory declaration`,()=>{
    const f=createBureaucratPairedAuctionFixture({advanced:true,source:'blackMarket',payerShare:5,donorShare:5});
    const pending=allowPairedAuctionResponses(payBureaucratPairedAuction(f));
    const view=viewGame(pending,f.trainer);
    view.players.find(p=>p.id===f.trainer)!.bot=difficulty;
    const action=botActions(view)[0];
    const done=allowPairedAuctionResponses(applyAction(pending,f.trainer,action));
    assertOutcome(f,done,action.redirect?2:0);
  });
}

void test('one physical use covers both five contributions; original bonus cancellation leads to a genuine last-space purchase and cache closing',()=>{
  const f=createBureaucratPairedAuctionFixture({advanced:true,payerShare:5,donorShare:5,counter:true});
  const pending=allowPairedAuctionResponses(payBureaucratPairedAuction(f));
  let game=choosePairedAuctionBureaucrat(pending);
  assert.equal(game.response?.kind,'harkonnenBonus');
  game=allowPairedAuctionResponses(applyAction(game,f.trainer,{type:'card',card:f.counterCard,mode:'cancel'}));
  assertCosts(f,game);
  assert.equal(pairedAuctionPlayer(game,f.emperor).spice,pairedAuctionPlayer(f.beforeAction,f.emperor).spice+8);
  assert.equal(pairedAuctionPlayer(game,f.payer).hand.length,3);
  assert.equal(game.discard.filter(c=>c.id===f.counterCard).length,1);
  assert.equal(game.bureaucratPayments!.used.length,1);
  const used=structuredClone(game.bureaucratPayments!.used);
  while(pairedAuctionPlayer(game,f.payer).hand.length<handLimit(pairedAuctionPlayer(game,f.payer))) {
    game=advanceBureaucratPairedFunding(game,s=>!!s.auction&&s.auction.active===f.payer&&!s.response&&!s.decision);
    const before=structuredClone(game),buyer=pairedAuctionPlayer(before,f.payer),index=before.auction!.index;
    const card=before.auction!.cards[index].id;
    game=applyAction(game,f.payer,{type:'bid',amount:1,allyPayment:0});
    for(let n=0;!game.currentAuctionSale&&game.auction?.index===index&&n<game.players.length+2;n++) {
      if(game.decision?.kind==='auctionPayment') {game=applyAction(game,f.payer,{type:'decision',karama:false});break;}
      game=applyAction(game,game.auction!.active,{type:'passBid'});
    }
    game=allowPairedAuctionResponses(game);
    const bought=pairedAuctionPlayer(game,f.payer);
    assert.equal(bought.spice,buyer.spice-1);
    assert.equal(bought.hand.filter(c=>c.id===card).length,1);
    assert.equal(bought.hand.length,Math.min(handLimit(buyer),buyer.hand.length+2));
    if(buyer.hand.length===handLimit(buyer)-1) {
      assert.deepEqual(game.deck,before.deck,'Last-space purchase has no overflow bonus draw');
      assert.equal(bought.hand.length,buyer.hand.length+1);
    }
    assert.equal(pairedAuctionPlayer(game,f.emperor).spice,pairedAuctionPlayer(before,f.emperor).spice+1);
    assert.deepEqual(game.bureaucratPayments!.used,used);
    assert.equal(viewGame(game,f.trainer).bureaucrat.pending,null);
  }
  assert.equal(pairedAuctionPlayer(game,f.payer).hand.length,8);
  game=advanceBureaucratPairedFunding(game,s=>s.turn===2&&s.phase===4);
  assert.equal(game.auction,null);
  assert.equal(game.currentAuctionSale,null);
  assert.equal(game.richeseAuction,null);
  assert.deepEqual(pairedAuctionPhysicalCards(game),f.physical);
});
