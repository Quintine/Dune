import assert from 'node:assert/strict';
import test from 'node:test';
import {applyAction,viewGame,type Game} from '../game/engine';
import {advanceSpiceBankerIncomeToMentat,createSpiceBankerIncomeFixture,createSpiceBankerIncomeReassignmentFixture,nextSpiceBankerIncomeNativeStep,quoteSpiceBankerIncomeBattleEconomics,stageSpiceBankerIncomeTrainerBattle,type SpiceBankerIncomeFixture,type SpiceBankerIncomeFixtureOptions} from './fixture-spice-banker-income';
import {forceRevivalQuote} from '../game/revival';

function pay(fixture:SpiceBankerIncomeFixture,action=fixture.paymentAction):Game {
  let game=applyAction(fixture.game,fixture.actor,action);
  for(let i=0;(game.response||game.decision)&&i<100;i++) {
    const next=nextSpiceBankerIncomeNativeStep(game);assert.ok(next);game=applyAction(game,next.actor,next.action);
  }
  return game;
}
function deferred(game:Game,owner:string):number {
  return viewGame(game,owner).spiceBankerIncome!.deferred.find(row=>row.owner===owner)?.amount??0;
}
function nativeCounters(game:Game):Game {
  for(let i=0;game.response&&i<100;i++) {
    const next=nextSpiceBankerIncomeNativeStep(game);assert.ok(next);game=applyAction(game,next.actor,next.action);
  }
  return game;
}
function beforeMentat(state:Game):Game {
  let game=state;
  for(let i=0;(game.phase!==7||game.phaseOpening||game.response||game.decision)&&i<1000;i++) {
    const next=nextSpiceBankerIncomeNativeStep(game);assert.ok(next);game=applyAction(game,next.actor,next.action);
  }
  assert.equal(game.phase,7);return game;
}

for(const advanced of [false,true]) for(const amount of [3,4]) {
  void test(`normal paid bank auction ${amount}, ${advanced?'Advanced':'Basic'} retains price/card and defers only qualifying income`,()=>{
    const fixture=createSpiceBankerIncomeFixture({advanced,amount});
    const payer=fixture.game.players.find(p=>p.id===fixture.payer)!;
    const card=fixture.game.auction!.cards[fixture.game.auction!.index];
    const balance=payer.spice,ownerBalance=fixture.game.players.find(p=>p.id===fixture.owner)!.spice;
    const paid=pay(fixture);
    assert.equal(paid.players.find(p=>p.id===fixture.payer)!.spice,balance-amount);
    assert.equal(paid.players.find(p=>p.id===fixture.payer)!.hand.filter(c=>c.id===card.id).length,1);
    assert.equal(paid.players.find(p=>p.id===fixture.owner)!.spice,ownerBalance);
    assert.equal(deferred(paid,fixture.owner),amount===4?1:0);
    const collection=beforeMentat(paid),nativeBalance=collection.players.find(p=>p.id===fixture.owner)!.spice;
    const mentat=advanceSpiceBankerIncomeToMentat(collection);
    assert.equal(deferred(mentat,fixture.owner),0);
    assert.equal(mentat.players.find(p=>p.id===fixture.owner)!.spice,nativeBalance+(amount===4?1:0));
  });
}
for(const kind of ['shipment','force-revival','leader-revival','emperor-extra-revival','cross-shipment','return-shipment','battle-support'] as const) {
  void test(`actual ${kind} original native cost and effect commit once with deferred normal Banker income`,()=>{
    const fixture=createSpiceBankerIncomeFixture({kind,advanced:true,...(kind==='force-revival'?{payerFaction:'emperor' as const}:{})});
    const payerBefore=fixture.game.players.find(p=>p.id===fixture.payer)!;
    const balance=payerBefore.spice,forces=payerBefore.reserves,tanks=payerBefore.tanks;
    if(kind==='leader-revival') {
      assert.ok(payerBefore.leaders.every(l=>l.dead));
      assert.equal(fixture.game.leaderSkills!.assignments.some(a=>a.owner===fixture.payer),false);
      assert.ok(fixture.game.leaderSkills!.assignments.some(a=>a.owner===fixture.owner&&a.skill==='spice-banker'));
      assert.equal(fixture.game.players.find(p=>p.id===fixture.owner)!.leaders.find(l=>l.id===fixture.leader)!.dead,false);
    }
    const paid=pay(fixture),payer=paid.players.find(p=>p.id===fixture.payer)!;
    if(kind==='battle-support') {
      const {resolution,nativeCollection}=quoteSpiceBankerIncomeBattleEconomics(fixture.game,paid);
      const payment=resolution.payments.find(row=>row.player===fixture.payer)!;
      assert.equal(payment.ownPayment,fixture.game.battle!.plans[fixture.payer].support);
      assert.deepEqual(paid.spiceBankerIncome!.sources.at(-1)!.source.bankLegs,[{payer:fixture.payer,amount:payment.ownPayment}]);
      const collection=nativeCollection.find(row=>row.player===fixture.payer);
      assert.equal(payer.spice,balance-payment.ownPayment+(resolution.bounty?.player===fixture.payer?resolution.bounty.amount:0)
        +(collection?collection.strongholds+collection.collected:0));
    } else assert.equal(payer.spice,balance-fixture.amount);
    assert.equal(deferred(paid,fixture.owner),1);
    if(kind==='shipment') assert.equal(payer.reserves,forces-4);
    if(kind==='force-revival') {
      const quote=forceRevivalQuote(fixture.game,payerBefore,3);
      assert.equal(payerBefore.faction,'emperor');assert.equal(quote.free,1);assert.equal(quote.cost,4);
      assert.equal(fixture.amount,quote.cost);
      assert.equal(payer.reserves,forces+3);assert.equal(payer.tanks,tanks-3);assert.equal(payer.revived,3);
      assert.equal(payer.freeForcesRevived,(payerBefore.freeForcesRevived??0)+quote.free);
    }
    if(kind==='leader-revival') assert.equal(payer.leaders.find(l=>l.id===fixture.paymentAction.leader)!.dead,false);
    if(kind==='return-shipment') assert.equal(payer.reserves,forces+8);
    const source=paid.spiceBankerIncome!.sources.find(r=>r.grant)!;
    assert.equal(source.source.kind,kind==='cross-shipment'||kind==='return-shipment'?'shipment':kind);
    const restored=JSON.parse(JSON.stringify(paid)) as Game;
    assert.equal(deferred(restored,fixture.owner),1);
    assert.equal(restored.players.find(p=>p.id===fixture.payer)!.spice,payer.spice);
  });
}
void test('native Harkonnen force revival uses its two-free allowance and real two-spice boundary',()=>{
  const fixture=createSpiceBankerIncomeFixture({kind:'force-revival',advanced:true});
  const payer=fixture.game.players.find(p=>p.id===fixture.payer)!;
  assert.equal(payer.faction,'harkonnen');assert.notEqual(fixture.payer,fixture.owner);
  const quote=forceRevivalQuote(fixture.game,payer,3);
  assert.equal(quote.free,2);assert.equal(quote.cost,2);assert.equal(fixture.amount,quote.cost);
  const paid=pay(fixture),revived=paid.players.find(p=>p.id===fixture.payer)!;
  assert.equal(revived.spice,payer.spice-quote.cost);
  assert.equal(revived.freeForcesRevived,(payer.freeForcesRevived??0)+quote.free);
  assert.equal(revived.reserves,payer.reserves+3);assert.equal(revived.tanks,payer.tanks-3);
  assert.deepEqual(paid.spiceBankerIncome!.sources.at(-1)!.source.bankLegs,[{payer:fixture.payer,amount:quote.cost}]);
  assert.equal(deferred(paid,fixture.owner),0);
});
for(const options of [{ownerIsPayer:true},{emperor:true},{amount:4,allySplit:2},{guild:true,kind:'shipment'}] satisfies SpiceBankerIncomeFixtureOptions[]) {
  void test(`nonqualifying native payment ${JSON.stringify(options)} does not manufacture bank income`,()=>{
    const fixture=createSpiceBankerIncomeFixture(options);const paid=pay(fixture);
    assert.equal(deferred(paid,fixture.owner),0);
    assert.equal(paid.spiceBankerIncome!.sources.some(r=>r.grant),false);
  });
}
void test('Emperor native self-auction pays BANK once and qualifies another living Banker',()=>{
  const fixture=createSpiceBankerIncomeFixture({emperor:true,payerFaction:'emperor',amount:4});
  const emperor=fixture.game.players.find(p=>p.id===fixture.payer)!;
  assert.equal(emperor.faction,'emperor');assert.notEqual(fixture.payer,fixture.owner);
  const card=fixture.game.auction!.cards[fixture.game.auction!.index];
  const paid=pay(fixture),buyer=paid.players.find(p=>p.id===fixture.payer)!;
  assert.equal(buyer.spice,emperor.spice-4);
  assert.equal(buyer.hand.filter(c=>c.id===card.id).length,1);
  assert.equal(paid.response?.kind==='emperorIncome',false);
  assert.equal(deferred(paid,fixture.owner),1);
  assert.deepEqual(paid.spiceBankerIncome!.sources.find(r=>r.grant)!.source.bankLegs,[{payer:fixture.payer,amount:4}]);
});
for(const bankerFaction of ['atreides','harkonnen'] as const) {
  void test(`native KH explosion death and next-turn two-spice revival never qualify (${bankerFaction} Banker)`,()=>{
    const fixture=createSpiceBankerIncomeFixture({kind:'kh-revival',advanced:true,bankerFaction,payerFaction:'atreides'});
    const payer=fixture.game.players.find(p=>p.id===fixture.payer)!;
    assert.ok(payer.battleLosses>=7);assert.equal(payer.kwisatz?.dead,true);
    assert.ok(payer.leaders.every(l=>l.dead));
    assert.equal(fixture.game.leaderSkills!.assignments.some(a=>a.owner===payer.id),false);
    if(fixture.owner!==fixture.payer) {
      assert.ok(fixture.game.leaderSkills!.assignments.some(a=>a.owner===fixture.owner&&a.skill==='spice-banker'));
      assert.equal(fixture.game.players.find(p=>p.id===fixture.owner)!.leaders.find(l=>l.id===fixture.leader)!.dead,false);
    }
    const paid=pay(fixture),revived=paid.players.find(p=>p.id===fixture.payer)!;
    assert.equal(revived.spice,payer.spice-2);assert.equal(revived.kwisatz?.dead,false);
    assert.equal(revived.leaderRevived,true);assert.equal(deferred(paid,fixture.owner),0);
    assert.equal(paid.spiceBankerIncome!.sources.some(r=>r.grant),false);
  });
}
void test('native self leader death returns Banker before legal revival, so its paid return grants no income',()=>{
  const fixture=createSpiceBankerIncomeFixture({kind:'leader-revival',advanced:true,ownerIsPayer:true});
  assert.equal(fixture.payer,fixture.owner);
  assert.equal(fixture.game.leaderSkills!.assignments.some(a=>a.skill==='spice-banker'),false);
  const payer=fixture.game.players.find(p=>p.id===fixture.payer)!;
  const paid=pay(fixture),revived=paid.players.find(p=>p.id===fixture.payer)!;
  assert.equal(revived.spice,payer.spice-4);
  assert.equal(revived.leaders.find(l=>l.id===fixture.paymentAction.leader)!.dead,false);
  assert.equal(deferred(paid,fixture.owner),0);
});
void test('printed Karama auction and free native revival have no positive bank payment',()=>{
  const auction=createSpiceBankerIncomeFixture({stageKarama:true});const payer=auction.game.players.find(p=>p.id===auction.payer)!;
  const card=payer.hand.find(c=>c.effect==='karama')!;assert.ok(card);const balance=payer.spice;
  const free=pay(auction,{type:'decision',karama:true,card:card.id});
  assert.equal(free.players.find(p=>p.id===auction.payer)!.spice,balance);
  assert.equal(free.players.find(p=>p.id===auction.payer)!.hand.some(c=>c.id===card.id),false);
  assert.equal(free.discard.filter(c=>c.id===card.id).length,1);
  assert.equal(deferred(free,auction.owner),0);
  const revival=createSpiceBankerIncomeFixture({kind:'force-revival'});
  const revived=pay(revival,{type:'revive',amount:1});
  assert.equal(revived.players.find(p=>p.id===revival.payer)!.spice,revival.game.players.find(p=>p.id===revival.payer)!.spice);
  assert.equal(deferred(revived,revival.owner),0);
});
void test('canceled Emperor income goes to BANK without charging buyer twice or losing card',()=>{
  const fixture=createSpiceBankerIncomeFixture({emperor:true,stageIncomeCounter:true});
  const purchased=fixture.game.auction!.cards[fixture.game.auction!.index];
  const emperorBefore=fixture.game.players.find(p=>p.faction==='emperor')!;
  let game=applyAction(fixture.game,fixture.actor,fixture.paymentAction);
  assert.equal(game.response?.kind,'emperorIncome');
  const canceler=game.players.find(p=>p.id===fixture.owner)!;
  const card=canceler.hand.find(c=>c.effect==='karama');assert.ok(card);
  const balance=game.players.find(p=>p.id===fixture.payer)!.spice;
  assert.equal(balance,fixture.game.players.find(p=>p.id===fixture.payer)!.spice-fixture.amount);
  game=applyAction(game,canceler.id,{type:'card',card:card.id,mode:'cancel'});game=nativeCounters(game);
  assert.equal(game.players.find(p=>p.id===fixture.payer)!.spice,balance);
  assert.equal(game.players.find(p=>p.id===fixture.payer)!.hand.filter(c=>c.id===purchased.id).length,1);
  assert.equal(game.players.find(p=>p.id===emperorBefore.id)!.spice,emperorBefore.spice);
  assert.equal(game.discard.filter(c=>c.id===card.id).length,1);
  assert.deepEqual(game.spiceBankerIncome!.sources.at(-1)!.source.bankLegs,fixture.bankLegs);
  assert.equal(deferred(game,fixture.owner),1);
});
void test('canceled Guild income uses the actual funded shipment legs, not waived or pooled tariff',()=>{
  const fixture=createSpiceBankerIncomeFixture({guild:true,kind:'shipment',stageIncomeCounter:true});
  const guildBefore=fixture.game.players.find(p=>p.faction==='guild')!;
  let game=applyAction(fixture.game,fixture.actor,fixture.paymentAction);game=nativeCountersUntil(game,'guildIncome');
  assert.equal(game.response?.kind,'guildIncome');
  const canceler=game.players.find(p=>p.id===fixture.owner)!;
  const card=canceler.hand.find(c=>c.effect==='karama');assert.ok(card);
  const forces=game.players.find(p=>p.id===fixture.payer)!.forces;
  const balance=game.players.find(p=>p.id===fixture.payer)!.spice;
  assert.equal(balance,fixture.game.players.find(p=>p.id===fixture.payer)!.spice-fixture.amount);
  game=applyAction(game,canceler.id,{type:'card',card:card.id,mode:'cancel'});game=nativeCounters(game);
  assert.deepEqual(game.players.find(p=>p.id===fixture.payer)!.forces,forces);
  assert.equal(game.players.find(p=>p.id===fixture.payer)!.spice,balance);
  assert.equal(game.players.find(p=>p.id===guildBefore.id)!.spice,guildBefore.spice);
  assert.equal(game.discard.filter(c=>c.id===card.id).length,1);
  assert.deepEqual(game.spiceBankerIncome!.sources.at(-1)!.source.bankLegs,fixture.bankLegs);
  assert.equal(deferred(game,fixture.owner),1);
});
function nativeCountersUntil(game:Game,kind:string):Game {
  for(let i=0;(game.response&&game.response.kind!==kind||game.decision?.kind==='guildShipment')&&i<100;i++) {
    const next=nextSpiceBankerIncomeNativeStep(game);assert.ok(next);game=applyAction(game,next.actor,next.action);
  }
  return game;
}
void test('one physical Banker stamps once per phase and permits another native phase payment',()=>{
  const fixture=createSpiceBankerIncomeFixture({amount:5,allySplit:1});let game=pay(fixture);
  assert.ok(game.auction);
  for (;;) {
    const auction = game.auction;
    assert.ok(auction, 'The second funded native lot must still be offered.');
    if (auction.active === fixture.payer) break;
    game = applyAction(game, auction.active, {type:'passBid'});
  }
  const index=game.auction!.index;
  game=applyAction(game,fixture.payer,{type:'bid',amount:4});
  for(let i=0;(game.auction?.index===index||game.response||game.decision)&&i<100;i++) {
    const next=nextSpiceBankerIncomeNativeStep(game);assert.ok(next);game=applyAction(game,next.actor,next.action);
  }
  assert.equal(deferred(game,fixture.owner),1);
  assert.equal(game.spiceBankerIncome!.sources.filter(r=>r.grant).length,1);
  while(game.phase===3) {const next=nextSpiceBankerIncomeNativeStep(game);assert.ok(next);game=applyAction(game,next.actor,next.action);}
  while(game.phaseOpening||game.response||game.decision) {const next=nextSpiceBankerIncomeNativeStep(game);assert.ok(next);game=applyAction(game,next.actor,next.action);}
  assert.equal(game.phase,4);
  const payer=game.players.find(p=>p.faction==='beneGesserit')!;payer.reserves-=3;payer.tanks+=3;
  game=applyAction(game,payer.id,{type:'revive',amount:3});game=nativeCounters(game);
  assert.equal(deferred(game,fixture.owner),2);
  assert.equal(new Set(game.spiceBankerIncome!.sources.filter(r=>r.grant).map(r=>r.grant!.stamp)).size,2);
});
for(const lifecycle of ['death','capture'] as const) {
  void test(`earned entitlement stays original through genuine native trainer ${lifecycle} and actual Mentat collection`,()=>{
    const fixture=createSpiceBankerIncomeFixture({advanced:true});const paid=pay(fixture);
    const staged=stageSpiceBankerIncomeTrainerBattle(paid,{[lifecycle]:true});
    assert.equal(deferred(staged,fixture.owner),1);
    const collection=beforeMentat(staged),balance=collection.players.find(p=>p.id===fixture.owner)!.spice;
    const mentat=advanceSpiceBankerIncomeToMentat(collection);
    assert.equal(mentat.players.find(p=>p.id===fixture.owner)!.spice,balance+1);
    assert.equal(deferred(mentat,fixture.owner),0);
    const restored=JSON.parse(JSON.stringify(mentat)) as Game;
    for(const p of restored.players) {const view=viewGame(restored,p.id);assert.deepEqual(view.spiceBankerIncome,{deferred:[],usedThisPhase:[]});}
  });
}
void test('public front-shield counts never disclose private source/authority and malformed inputs reject immutably',()=>{
  const fixture=createSpiceBankerIncomeFixture();const paid=pay(fixture);
  assert.equal(paid.phase,fixture.game.phase,'compare use while the native auction phase is still offered');
  for(const p of paid.players) assert.deepEqual(viewGame(paid,p.id).spiceBankerIncome,{deferred:[{owner:fixture.owner,amount:1}],usedThisPhase:[fixture.owner]});
  const before=JSON.stringify(fixture.game);
  assert.throws(()=>applyAction(fixture.game,fixture.owner,{...fixture.paymentAction,actor:fixture.actor}));
  assert.equal(JSON.stringify(fixture.game),before);
  const corrupt=JSON.parse(JSON.stringify(paid)) as Game;
  corrupt.spiceBankerIncome!.sources[0].source.bankLegs[0].amount++;
  const corruptBefore=JSON.stringify(corrupt);
  assert.throws(()=>viewGame(corrupt,fixture.owner));assert.throws(()=>applyAction(corrupt,fixture.owner,{type:'ready'}));
  assert.equal(JSON.stringify(corrupt),corruptBefore);
});
for(const options of [
  {trainerSelected:true,expected:1},
  {trainerSelected:true,trainerDies:true,expected:0},
  {trainerHidden:true,expected:0},
  {amount:3,expected:0},
]) {
  void test(`battle income follows resolved native trainer eligibility ${JSON.stringify(options)}`,()=>{
    const fixture=createSpiceBankerIncomeFixture({kind:'battle-support',advanced:true,...options});
    assert.equal(deferred(fixture.game,fixture.owner),0);
    const paid=pay(fixture);
    assert.equal(deferred(paid,fixture.owner),options.expected);
    const {resolution,nativeCollection}=quoteSpiceBankerIncomeBattleEconomics(fixture.game,paid);
    const payment=resolution.payments.find(row=>row.player===fixture.payer)!;
    assert.equal(payment.ownPayment,fixture.game.battle!.plans[fixture.payer].support);
    assert.deepEqual(paid.spiceBankerIncome!.sources.at(-1)!.source.bankLegs,[{payer:fixture.payer,amount:payment.ownPayment}]);
    const bounty=resolution.bounty?.player===fixture.payer?resolution.bounty.amount:0;
    const collection=nativeCollection.find(row=>row.player===fixture.payer);
    assert.equal(paid.players.find(p=>p.id===fixture.payer)!.spice,
      fixture.game.players.find(p=>p.id===fixture.payer)!.spice-payment.ownPayment+bounty
        +(collection?collection.strongholds+collection.collected:0));
    assert.equal(paid.phase,7);
    for(const p of paid.players) assert.deepEqual(viewGame(paid,p.id).spiceBankerIncome!.usedThisPhase,[]);
  });
}
void test('deferred automatic spice cannot fund a bid before actual Mentat collection',()=>{
  const fixture=createSpiceBankerIncomeFixture({ownerIsPayer:false});const paid=pay(fixture);
  assert.equal(deferred(paid,fixture.owner),1);
  let game=paid;
  while(game.auction!.active!==fixture.owner) game=applyAction(game,game.auction!.active,{type:'passBid'});
  const wallet=game.players.find(p=>p.id===fixture.owner)!.spice,before=JSON.stringify(game);
  assert.throws(()=>applyAction(game,fixture.owner,{type:'bid',amount:wallet+1}));
  assert.equal(JSON.stringify(game),before);
});
void test('a real singleton skill return and different-faction native revival retain old owner custody but use the new eligible owner',()=>{
  const fixture=createSpiceBankerIncomeFixture({advanced:true});const paid=pay(fixture);
  const lifecycle=createSpiceBankerIncomeReassignmentFixture(paid);
  assert.equal(lifecycle.game.spiceBankerIncome!.sources.find(r=>r.grant)!.grant!.owner,fixture.owner);
  assert.equal(lifecycle.game.spiceBankerIncome!.collections[0].credits.find(c=>c.owner===fixture.owner)!.amount,1);
  let game=applyAction(lifecycle.game,lifecycle.actor,lifecycle.revivalAction);
  game=nativeCounters(game);
  assert.equal(game.decision?.kind,'leaderSkillRevival');
  let offer=game.leaderSkills!.offers[lifecycle.actor];
  game=applyAction(game,lifecycle.actor,{type:'leaderSkill',event:offer.event,mode:'draw'});
  offer=game.leaderSkills!.offers[lifecycle.actor];assert.ok(offer.cards.includes('spice-banker'));
  game=applyAction(game,lifecycle.actor,{type:'leaderSkill',event:offer.event,skill:'spice-banker',leader:lifecycle.leader});
  assert.equal(game.leaderSkills!.assignments.find(a=>a.skill==='spice-banker')!.owner,lifecycle.actor);
  const balance=game.players.find(p=>p.id===lifecycle.actor)!.spice;
  game=applyAction(game,fixture.owner,{type:'reviveLeader',leader:fixture.leader});game=nativeCounters(game);
  assert.equal(deferred(game,lifecycle.actor),1);
  assert.equal(deferred(game,fixture.owner),0);
  assert.equal(game.players.find(p=>p.id===lifecycle.actor)!.spice,balance);
  assert.equal(game.spiceBankerIncome!.sources.filter(r=>r.grant)[0].grant!.owner,fixture.owner);
  assert.equal(game.spiceBankerIncome!.sources.filter(r=>r.grant)[1].grant!.owner,lifecycle.actor);
});
