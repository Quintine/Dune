import assert from 'node:assert/strict';
import test from 'node:test';
import {applyAction,createGame,initializeIxianNexusBetrayalGameForAudit,joinGame,newPlayer,normalizeAutomaticGame,viewGame,type Game,type Action} from '../game/engine';
import {createIxianNexusBetrayalFixture,settleIxianBetrayalNativeCounters} from './fixture-nexus-ixian-betrayal';
const reload=(g:Game):Game=>JSON.parse(JSON.stringify(g));
const owner=(g:Game,id:string)=>g.players.find(p=>p.id===id)!;
function passNexus(state:Game):Game {
  let g=state;
  while(g.pendingNexusIxianBetrayal) {const f=g.pendingNexusIxianBetrayal;g=applyAction(g,f.required.find(id=>!f.passed.includes(id))!,{type:'nexusIxianBetrayalPass',event:f.source.event});}
  return g;
}
function reject(g:Game,id:string,a:Action):void {const before=structuredClone(g);assert.throws(()=>applyAction(g,id,a));assert.deepEqual(g,before);}
const ledger=(g:Game)=>g.players.map(p=>({id:p.id,spice:p.spice,forces:p.forces,reserves:p.reserves,tanks:p.tanks,elites:p.elites,hand:p.hand}));
for(const [kind,advanced] of [['bidding',false],['bidding',true],['technology',true]] as const) for(const use of [false,true]) {
  void test(`${advanced?'Advanced':'Basic'} original ${kind} ${use?'prevention':'allowance'} resumes its native suffix once`,()=>{
    const f=createIxianNexusBetrayalFixture({kind,advanced});
    assert.deepEqual(settleIxianBetrayalNativeCounters(applyAction(f.beforeNativeAttempt,f.actor,f.declarationAction)),f.game);
    const before=reload(f.game),nx=before.nexusCards!.cards!;
    const g=use?applyAction(before,f.holder,{type:'nexusIxianBetrayalUse',event:f.event}):passNexus(before);
    assert.equal(g.pendingNexusIxianBetrayal,null);
    assert.equal(g.nexusIxianBetrayalHistory!.at(-1)!.outcome,use?'use':'pass');
    assert.equal(g.nexusIxianBetrayalCursor!.sequence,before.nexusIxianBetrayalCursor!.sequence+1);
    assert.deepEqual(g.discard,before.discard);
    assert.deepEqual(g.players.map(p=>({spice:p.spice,forces:p.forces,reserves:p.reserves,tanks:p.tanks,elites:p.elites})),before.players.map(p=>({spice:p.spice,forces:p.forces,reserves:p.reserves,tanks:p.tanks,elites:p.elites})));
    assert.equal(g.nexusCards!.cards!.discard.length,nx.discard.length+(use?1:0));
    assert.equal(g.nexusCards!.cards!.hands[f.holder],use?null:'ixians');
    if(kind==='bidding') {
      assert.deepEqual(ledger(g),ledger(before));
      assert.equal(before.deck.length-g.deck.length,f.nativeCount+(use?0:1));
      if(use) {assert.equal(g.ixAuction,null);assert.equal(g.auction!.cards.length,f.nativeCount);assert.notEqual(g.decision?.kind,'ixAuction');}
      else {assert.equal(g.decision?.kind,'ixAuction');assert.equal(g.ixAuction!.cards.length,f.nativeCount+1);assert.equal(g.auction,null);}
    } else {
      assert.equal(g.ixTechnologyTurn,g.turn);assert.equal(g.pendingIxTechnology,null);
      assert.equal(g.auction!.index,before.auction!.index);
      assert.equal(g.auction!.bid,before.auction!.bid);assert.equal(g.auction!.bidder,before.auction!.bidder);
      const original=before.auction!.cards[before.auction!.index];
      const expectedCards=[...before.auction!.cards];
      if(!use) expectedCards[before.auction!.index]=f.selected!;
      assert.deepEqual(g.auction!.cards,expectedCards);
      if(use) assert.deepEqual(owner(g,f.provider).hand,owner(before,f.provider).hand);
      else {assert.ok(owner(g,f.provider).hand.some(c=>c.id===original.id));assert.ok(!owner(g,f.provider).hand.some(c=>c.id===f.selected!.id));}
      assert.deepEqual(g.deck,before.deck);
      const atreides=before.players.find(p=>p.faction==='atreides')!.id;
      assert.equal(viewGame(before,atreides).auction!.card,null,'the native peek cannot precede the Nexus acknowledgment');
      const settled=settleIxianBetrayalNativeCounters(g);
      assert.equal(settled.auction!.peekKnown,true);
      assert.equal(settled.response,null);
      assert.deepEqual(viewGame(settled,atreides).auction!.card,use?original:f.selected);
      for(const rival of settled.players.filter(p=>p.id!==atreides))
        assert.equal(viewGame(settled,rival.id).auction!.card,null);
      assert.deepEqual(settled.auction!.cards,expectedCards);
      assert.equal(settled.auction!.index,before.auction!.index);
      assert.deepEqual(ledger(settled),ledger(g));
      assert.deepEqual(settled.deck,g.deck);
      assert.deepEqual(settled.discard,g.discard);
      assert.deepEqual(settled.nexusCards,g.nexusCards);
      assert.deepEqual(settled.nexusIxianBetrayalHistory,g.nexusIxianBetrayalHistory);
      assert.deepEqual(settleIxianBetrayalNativeCounters(settled),settled);
    }
    reject(g,f.holder,{type:'nexusIxianBetrayalUse',event:f.event});
    reject(g,f.holder,{type:'nexusIxianBetrayalPass',event:f.event});
    viewGame(reload(g),f.holder);
  });
}
for(const kind of ['bidding','technology'] as const) void test(`printed native Karama preempts ${kind} with no Nexus gate or cost`,()=>{
  const f=createIxianNexusBetrayalFixture({kind,advanced:true}),before=f.beforeNativeCounter;
  const seat=before.players.find(p=>p.id!==f.provider&&p.hand.some(c=>c.effect==='karama'))!;
  assert.ok(seat);
  const card=seat.hand.find(c=>c.effect==='karama')!;
  const g=applyAction(before,seat.id,{type:'card',mode:'cancel',card:card.id});
  assert.equal(g.pendingNexusIxianBetrayal,null);
  assert.deepEqual(g.nexusCards,before.nexusCards);
  assert.deepEqual(g.nexusIxianBetrayalHistory,before.nexusIxianBetrayalHistory);
  assert.ok(g.discard.some(c=>c.id===card.id));
  if(kind==='bidding') {assert.equal(g.ixAuction,null);assert.equal(g.auction!.cards.length,f.nativeCount);}
  else {assert.equal(g.pendingIxTechnology,null);assert.equal(g.ixTechnologyTurn,g.turn);assert.deepEqual(owner(g,f.provider).hand,owner(before,f.provider).hand);assert.deepEqual(g.auction!.cards,before.auction!.cards);}
});
for(const kind of ['bidding','technology'] as const) void test(`native BG Worthless Karama suspends and cancels ${kind} before any Nexus acknowledgment`,()=>{
  const lobby=createGame('BGCOUNTER',newPlayer('ix','Ixians','ixians'),true,['ix']);
  joinGame(lobby,newPlayer('a','Atreides','atreides'));
  joinGame(lobby,newPlayer('bg','Bene Gesserit','beneGesserit'));
  joinGame(lobby,newPlayer('tl','Tleilaxu','tleilaxu'));
  const f=createIxianNexusBetrayalFixture({initial:lobby,kind,receiverCount:2});
  const before=f.beforeNativeCounter,fuel=owner(before,'bg').hand.find(c=>c.kind==='worthless')!;
  assert.ok(fuel);
  let g=applyAction(before,'bg',{type:'card',mode:'cancel',card:fuel.id});
  assert.equal(g.response?.kind,'worthlessKarama');
  assert.equal(g.pendingKarama?.use.kind,'cancel');
  for(const seat of g.players) {
    assert.equal(viewGame(g,seat.id).nexusIxianBetrayalReaction,null);
    assert.equal(viewGame(g,seat.id).auction?.card??null,null);
  }
  g=settleIxianBetrayalNativeCounters(reload(g));
  assert.equal(g.pendingKarama,null);
  assert.equal(g.pendingNexusIxianBetrayal,null);
  assert.deepEqual(g.nexusCards,before.nexusCards);
  assert.deepEqual(g.nexusIxianBetrayalHistory,before.nexusIxianBetrayalHistory);
  assert.deepEqual(g.nexusIxianBetrayalCursor,before.nexusIxianBetrayalCursor);
  assert.equal(g.discard.filter(c=>c.id===fuel.id).length,1);
  if(kind==='bidding') {
    assert.equal(g.ixAuction,null);
    assert.equal(g.auction!.cards.length,f.nativeCount);
    assert.equal(before.deck.length-g.deck.length,f.nativeCount);
  } else {
    assert.equal(g.pendingIxTechnology,null);
    assert.equal(g.ixTechnologyTurn,g.turn);
    assert.deepEqual(g.auction!.cards,before.auction!.cards);
    assert.deepEqual(owner(g,f.provider).hand,owner(before,f.provider).hand);
    assert.deepEqual(g.deck,before.deck);
    assert.equal(viewGame(g,'a').auction!.card!.id,before.auction!.cards[before.auction!.index].id);
  }
});
for(const returnDeclared of [false,true]) void test(`native Harkonnen exchange ${returnDeclared?'restores':'removes'} a paused declared Technology card without stranding its original continuation`,()=>{
  const lobby=createGame('HARKCOUNTER',newPlayer('h','Harkonnen','harkonnen'),true,['ix']);
  joinGame(lobby,newPlayer('ix','Ixians','ixians'));
  joinGame(lobby,newPlayer('a','Atreides','atreides'));
  joinGame(lobby,newPlayer('g','Guild','guild'));
  const f=createIxianNexusBetrayalFixture({initial:lobby,kind:'technology'});
  const before=f.beforeNativeCounter,karama=owner(before,'h').hand.find(c=>c.effect==='karama')!;
  const returned=owner(before,'h').hand.find(c=>c.id!==karama?.id)!;
  assert.ok(karama);assert.ok(returned);
  assert.equal(owner(before,f.provider).hand.length,1);
  const original=before.auction!.cards[before.auction!.index],declared=f.selected!;
  let g=applyAction(before,'h',{type:'card',mode:'special',card:karama.id,target:f.provider,amount:1});
  assert.equal(g.decision?.kind,'handExchange');
  assert.equal(g.pendingExchange!.response!.kind,'ixTechnology');
  assert.ok(owner(g,'h').hand.some(c=>c.id===declared.id));
  for(const seat of g.players) assert.equal(viewGame(g,seat.id).nexusIxianBetrayalReaction,null);
  const orphan=reload(g);
  orphan.pendingExchange!.response!.owner=f.holder;
  assert.throws(()=>viewGame(orphan,f.holder));
  assert.throws(()=>normalizeAutomaticGame(orphan));
  reject(orphan,'h',{type:'decision',returnCards:[returned.id]});
  g=applyAction(reload(g),'h',{type:'decision',returnCards:[returnDeclared?declared.id:returned.id]});
  g=settleIxianBetrayalNativeCounters(g);
  assert.deepEqual(g.nexusCards,before.nexusCards);
  assert.deepEqual(g.deck,before.deck);
  if(returnDeclared) {
    assert.equal(g.pendingNexusIxianBetrayal!.source.kind,'technology');
    assert.equal(viewGame(g,'a').auction!.card,null);
    g=settleIxianBetrayalNativeCounters(passNexus(g));
    assert.equal(g.auction!.cards[g.auction!.index].id,declared.id);
    assert.equal(owner(g,f.provider).hand[0].id,original.id);
    assert.equal(g.nexusIxianBetrayalCursor!.sequence,before.nexusIxianBetrayalCursor!.sequence+1);
  } else {
    assert.equal(g.pendingNexusIxianBetrayal,null);
    assert.deepEqual(g.nexusIxianBetrayalHistory,before.nexusIxianBetrayalHistory);
    assert.deepEqual(g.nexusIxianBetrayalCursor,before.nexusIxianBetrayalCursor);
    assert.deepEqual(g.auction!.cards,before.auction!.cards);
    assert.equal(owner(g,f.provider).hand[0].id,returned.id);
    assert.ok(owner(g,'h').hand.some(c=>c.id===declared.id));
  }
  assert.equal(g.pendingExchange,null);
  assert.equal(g.pendingIxTechnology,null);
  assert.equal(g.ixTechnologyTurn,g.turn);
  assert.equal(g.discard.filter(c=>c.id===karama.id).length,1);
  assert.equal(g.auction!.peekKnown,true);
  assert.equal(viewGame(g,'a').auction!.card!.id,returnDeclared?declared.id:original.id);
  assert.deepEqual(settleIxianBetrayalNativeCounters(g),g);
});
void test('neutral required membership, public source and rivals are independent of held face',()=>{
  const ix=createIxianNexusBetrayalFixture({receiverCount:2}),irrelevant=createIxianNexusBetrayalFixture({receiverCount:2,face:'richese'});
  assert.deepEqual(ix.required,irrelevant.required);assert.equal(ix.required.length,2);
  for(const id of ix.game.players.filter(p=>!ix.required.includes(p.id)).map(p=>p.id)) {
    assert.deepEqual(viewGame(ix.game,id).nexusIxianBetrayalReaction,viewGame(irrelevant.game,id).nexusIxianBetrayalReaction);
    const text=JSON.stringify(viewGame(ix.game,id));
    assert.ok(!text.includes(ix.game.pendingNexusIxianBetrayal!.source.parent));
    assert.ok(!text.includes('nativeContext'));
  }
  assert.equal(viewGame(ix.game,ix.holder).nexusIxianBetrayalReaction!.canUse,true);
  assert.equal(viewGame(irrelevant.game,irrelevant.holder).nexusIxianBetrayalReaction!.canUse,false);
  assert.equal(viewGame(ix.game,ix.holder).active,null);
  const passed=applyAction(ix.game,ix.holder,{type:'nexusIxianBetrayalPass',event:ix.event});
  assert.equal(viewGame(passed,ix.holder).active,ix.required.find(id=>id!==ix.holder));
  reject(passed,ix.holder,{type:'nexusIxianBetrayalUse',event:ix.event});
});
void test('all seats retain independent AI control while native resources and response event are locked',()=>{
  const f=createIxianNexusBetrayalFixture({receiverCount:2});
  for(const seat of f.game.players) {
    const controlled=applyAction(f.game,seat.id,{type:'setAutopilot',difficulty:'Hard'});
    assert.deepEqual(controlled.pendingNexusIxianBetrayal,f.game.pendingNexusIxianBetrayal);
    assert.deepEqual(ledger(controlled),ledger(f.game));
    assert.equal(owner(controlled,seat.id).autopilot,'Hard');
    viewGame(controlled,seat.id);
  }
  for(const a of [{type:'bid',amount:1},{type:'passResponse'},{type:'ready'},{type:'decision',card:owner(f.game,f.provider).hand[0].id}]) reject(f.game,f.holder,a);
});
void test('wrong role, wrong event and selector-bearing actions reject without cost or native mutation',()=>{
  const f=createIxianNexusBetrayalFixture();
  for(const a of [{type:'nexusIxianBetrayalUse',event:'expired'}, {type:'nexusIxianBetrayalUse',event:f.event,card:'ixians'}, {type:'nexusIxianBetrayalPass',event:f.event,kind:'bidding'}, {type:'nexusIxianBetrayalUse',event:f.event,provider:f.provider}]) reject(f.game,f.holder,a);
  reject(f.game,f.provider,{type:'nexusIxianBetrayalPass',event:f.event});
  reject(f.game,f.provider,{type:'nexusIxianBetrayalUse',event:f.event});
});
for(const kind of ['bidding','technology'] as const) void test(`${kind} rejects orphan, parent, physical cost and native declaration corruption at read and action boundaries`,()=>{
  const f=createIxianNexusBetrayalFixture({kind,advanced:true});
  const mutations:((g:Game)=>void)[]=[g=>{g.pendingNexusIxianBetrayal=null;},g=>{delete g.nexusIxianBetrayalPreview;},g=>{g.nexusIxianBetrayalCursor!.sequence++;},g=>{g.pendingNexusIxianBetrayal!.source.parent+='changed';},g=>{g.deck[0].name='forged';},g=>{owner(g,f.provider).spice++;},g=>{g.nexusCards!.cards!.hands[f.holder]=null;},g=>{g.pendingNexusIxianBetrayal!.continuation.owner=f.holder;},g=>{g.turn++;}];
  if(kind==='technology') mutations.push(g=>{g.ixTechnologyTurn=0;},g=>{g.pendingIxTechnology!.card=owner(g,f.holder).hand[0].id;},g=>{
    const hand=owner(g,f.provider).hand,index=hand.findIndex(c=>c.id===f.selected!.id);
    g.discard.push(hand.splice(index,1)[0]);
  });
  else mutations.push(g=>{g.ixAuction!.count++;});
  for(const corrupt of mutations) {
    const g=reload(f.game);corrupt(g);const before=structuredClone(g);
    assert.throws(()=>viewGame(g,f.holder));assert.throws(()=>normalizeAutomaticGame(g));
    reject(g,f.holder,{type:'nexusIxianBetrayalUse',event:f.event});assert.deepEqual(g,before);
  }
});
void test('fresh CLI setup continuation preserves original identities, dealt traitor choices and profile without a redeal',()=>{
  let lobby=createGame('ORIGINALIX',newPlayer('native','Original Ix','ixians'),true,['ix']);
  joinGame(lobby,newPlayer('receiver','Original Atreides','atreides'));
  joinGame(lobby,newPlayer('partner','Original Emperor','emperor'));
  for(const p of lobby.players) lobby=applyAction(lobby,p.id,{type:'ready'});
  lobby.nexusCards={cards:null,phase:null};
  const setup=initializeIxianNexusBetrayalGameForAudit(lobby);
  assert.equal(setup.status,'setup');assert.equal(setup.nexusCards!.cards!.hands.receiver,null);
  const original=structuredClone(setup);
  assert.throws(()=>initializeIxianNexusBetrayalGameForAudit(setup));
  assert.deepEqual(setup,original);
  const fixture=createIxianNexusBetrayalFixture({initial:setup,kind:'technology'});
  assert.equal(fixture.game.code,setup.code);assert.equal(fixture.game.host,setup.host);
  assert.equal(fixture.game.advanced,setup.advanced);
  assert.deepEqual(fixture.game.players.map(p=>[p.id,p.name,p.faction]),setup.players.map(p=>[p.id,p.name,p.faction]));
  for(const p of setup.players) assert.ok(fixture.game.players.find(s=>s.id===p.id)!.traitors.every(id=>p.traitorChoices.includes(id)));
  assert.deepEqual(setup,original);
});
