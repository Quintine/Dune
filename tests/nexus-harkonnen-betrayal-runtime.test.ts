import assert from 'node:assert/strict';
import {test} from 'node:test';
import {applyAction,createGame,initializeHarkonnenNexusBetrayalGameForAudit,joinGame,newPlayer,normalizeAutomaticGame,viewGame,type Action,type Game} from '../game/engine';
import {baseDeck} from '../game/cards';
import {traitorDeck} from '../game/traitors';
import {validateNexusTraitorSnapshot} from '../game/nexus-traitor-exchange';
import {createHarkonnenNexusBetrayalFixture,advanceHarkonnenBetrayalToMentat,type HarkonnenBetrayalFixture} from './fixture-nexus-harkonnen-betrayal';

function stock(game:Game):void {
  validateNexusTraitorSnapshot({reserve:game.traitorReserve!,players:game.players.map(({id,faction,traitors})=>({id,faction,traitors}))},traitorDeck(game.players));
  assert.deepEqual([...game.deck,...game.discard,...game.players.flatMap(p=>p.hand),...(game.auction?.cards??[])].map(c=>c.id).sort(),baseDeck().map(c=>c.id).sort());
}
function use(f:HarkonnenBetrayalFixture):Game {return applyAction(f.game,f.holder,{type:'nexusHarkonnenBetrayalUse',event:f.event});}
function reject(game:Game,actor:string,action:Action):void {
  const before=JSON.stringify(game);assert.throws(()=>applyAction(game,actor,action));assert.equal(JSON.stringify(game),before);
}
for(const advanced of [false,true]) for(const remote of [false,true]) {
  void test(`${advanced?'Advanced':'Basic'} ${remote?'allied remote':'personal'} real call cancellation retires exact identity and native Mentat privately draws once`,()=>{
    const f=createHarkonnenNexusBetrayalFixture({advanced,remote});
    assert.equal(f.beforeCall.battle!.traitorCalls[f.provider],undefined);
    assert.equal(f.beforeNativeCounter.response?.kind,remote?'harkonnenTraitor':undefined);
    assert.equal(f.game.battle!.traitorCalls[f.provider],true);
    const reaction=viewGame(f.game,f.holder).nexusHarkonnenBetrayalReaction!;
    assert.equal(reaction.identity,f.identity);assert.equal(reaction.beneficiary,f.beneficiary);assert.equal(reaction.target,f.target);assert.equal(reaction.canUse,true);
    assert.ok(f.game.players.find(p=>p.id===f.provider)!.revealedTraitors!.includes(f.identity));
    const before=JSON.stringify(f.game),spent=use(f);assert.equal(JSON.stringify(f.game),before);
    assert.equal(spent.nexusCards!.cards!.hands[f.holder],null);
    assert.equal(spent.nexusCards!.cards!.discard.filter(c=>c==='harkonnen').length,1);
    assert.equal(spent.players.find(p=>p.id===f.provider)!.traitors.includes(f.identity),false);
    assert.equal(spent.players.find(p=>p.id===f.provider)!.revealedTraitors!.includes(f.identity),false);
    assert.equal(spent.traitorReserve!.filter(c=>c===f.identity).length,1);
    assert.equal(spent.battle!.traitorCalls[f.provider],false);
    assert.equal(spent.battle!.traitorDeclarations![f.provider].identity,f.identity);
    assert.equal(spent.pendingNexusHarkonnenReplacement!.identity,f.identity);
    assert.equal(spent.pendingNexusHarkonnenReplacement!.status,'due');
    stock(spent);
    const top=spent.traitorReserve![0],mentat=advanceHarkonnenBetrayalToMentat(spent);
    assert.equal(mentat.nexusHarkonnenReplacementHistory!.length,1);
    assert.equal(mentat.nexusHarkonnenReplacementHistory![0].drawn,top);
    assert.equal(mentat.players.find(p=>p.id===f.provider)!.traitors.length,4);
    assert.equal(mentat.players.find(p=>p.id===f.provider)!.traitors.includes(top),true);
    assert.equal(mentat.pendingNexusHarkonnenReplacement,null);stock(mentat);
    const stable=JSON.stringify(mentat);
    for(const p of mentat.players) viewGame(mentat,p.id);
    assert.equal(JSON.stringify(mentat),stable);
    assert.deepEqual(normalizeAutomaticGame(mentat),mentat);
    assert.equal(mentat.lastBattleContext!.result,'normal');
    reject(mentat,f.holder,{type:'nexusHarkonnenBetrayalUse',event:f.event});
  });
  void test(`${advanced?'Advanced':'Basic'} ${remote?'remote':'personal'} all-pass retains both physical cards and permits original traitor outcome once`,()=>{
    const f=createHarkonnenNexusBetrayalFixture({advanced,remote});
    let game=f.game;
    for(const id of f.required) game=applyAction(game,id,{type:'nexusHarkonnenBetrayalPass',event:f.event});
    assert.equal(game.pendingNexusHarkonnenBetrayal,null);
    assert.equal(game.pendingNexusHarkonnenReplacement,null);
    assert.ok(game.players.find(p=>p.id===f.provider)!.traitors.includes(f.identity));
    assert.equal(game.nexusCards!.cards!.hands[f.holder],'harkonnen');
    game=advanceHarkonnenBetrayalToMentat(game);
    assert.equal(game.lastBattleContext!.result,'traitor');
    assert.equal(game.nexusHarkonnenReplacementHistory!.length,0);
    assert.equal(game.players.find(p=>p.id===f.provider)!.revealedTraitors!.filter(card=>card===f.identity).length,1);
    reject(game,f.provider,f.callAction);stock(game);
  });
}
void test('Wrong-face holder receives the same public acknowledgement but cannot spend another face',()=>{
  const f=createHarkonnenNexusBetrayalFixture({face:'richese',remote:true}),view=viewGame(f.game,f.holder);
  assert.equal(view.nexusHarkonnenBetrayalReaction!.canPass,true);
  assert.equal(view.nexusHarkonnenBetrayalReaction!.canUse,false);
  assert.equal(view.nexusHarkonnenBetrayalReaction!.blocked,null);
  reject(f.game,f.holder,{type:'nexusHarkonnenBetrayalUse',event:f.event});
  const passed=applyAction(f.game,f.holder,{type:'nexusHarkonnenBetrayalPass',event:f.event});
  assert.equal(passed.nexusCards!.cards!.hands[f.holder],'richese');
  assert.equal(passed.nexusHarkonnenBetrayalHistory![0].outcome,'pass');
});
void test('Partial acknowledgement survives refresh; ordinary votes lock while independent controls remain legal',()=>{
  const f=createHarkonnenNexusBetrayalFixture({receiverCount:2,remote:true});
  assert.equal(f.required.length,2);assert.equal(viewGame(f.game,f.holder).active,null);
  const other=f.required.find(id=>id!==f.holder)!;
  let game=applyAction(f.game,other,{type:'nexusHarkonnenBetrayalPass',event:f.event});
  game=normalizeAutomaticGame(structuredClone(game));
  assert.equal(viewGame(game,f.holder).active,f.holder);
  assert.equal(viewGame(game,other).nexusHarkonnenBetrayalReaction!.hasPassed,true);
  reject(game,other,{type:'nexusHarkonnenBetrayalPass',event:f.event});
  reject(game,f.target,{type:'traitorCall',call:false});
  const source=JSON.stringify(game.pendingNexusHarkonnenBetrayal);
  for(const p of game.players) game=applyAction(game,p.id,{type:'setAutopilot',difficulty:'Easy'});
  assert.equal(JSON.stringify(game.pendingNexusHarkonnenBetrayal),source);
  game=applyAction(game,f.holder,{type:'nexusHarkonnenBetrayalUse',event:f.event});
  assert.equal(game.nexusHarkonnenBetrayalHistory!.length,1);
  assert.equal(game.nexusCards!.cards!.hands[other],'richese');
});
void test('Arbitrary credentials, payloads, stale event and committed native/source/stock corruption fail without cost or cleanup',()=>{
  const f=createHarkonnenNexusBetrayalFixture({remote:true}),action={type:'nexusHarkonnenBetrayalUse',event:f.event};
  reject(f.game,'absent',action);reject(f.game,f.provider,action);
  reject(f.game,f.holder,{...action,event:`${f.event}-old`});
  reject(f.game,f.holder,{...action,card:f.identity});
  const corruptions:Array<(g:Game)=>void>=[
    g=>{g.pendingNexusHarkonnenBetrayal!.source.declaration.identity='absent';},
    g=>{g.battle!.plans[f.target].leader=g.players.find(p=>p.id===f.target)!.leaders.find(l=>l.id!==f.identity)!.id;},
    g=>{g.battle!.nexusHarkonnenAllowance!.passed=[];},
    g=>{g.players.find(p=>p.id===f.provider)!.ally=null;},
    g=>{g.traitorReserve!.push(f.identity);},
    g=>{g.deck.push(g.deck[0]);},
    g=>{g.players.find(p=>p.id===f.provider)!.traitors=g.players.find(p=>p.id===f.provider)!.traitors.filter(c=>c!==f.identity);},
  ];
  for(const mutate of corruptions) {const game=structuredClone(f.game);mutate(game);reject(game,f.holder,action);}
});
void test('Original printed Karama remote counter preempts Nexus without either Nexus or traitor cost',()=>{
  const f=createHarkonnenNexusBetrayalFixture({remote:true}),counter=f.beforeNativeCounter.players.find(p=>p.id!==f.provider&&p.hand.some(c=>c.effect==='karama'))!;
  assert.ok(counter);const card=counter.hand.find(c=>c.effect==='karama')!;
  let game=applyAction(f.beforeNativeCounter,counter.id,{type:'card',mode:'cancel',card:card.id});
  for(let i=0;game.response&&i<100;i++) {const seat=game.players.find(p=>!game.response!.passed.includes(p.id))!;game=applyAction(game,seat.id,{type:'passResponse'});}
  assert.equal(game.pendingNexusHarkonnenBetrayal,null);assert.equal(game.nexusHarkonnenBetrayalHistory!.length,0);
  assert.equal(game.nexusCards!.cards!.hands[f.holder],'harkonnen');
  assert.ok(game.players.find(p=>p.id===f.provider)!.traitors.includes(f.identity));
  assert.ok(game.discard.some(c=>c.id===card.id));
  assert.equal(game.battle!.traitorCalls[f.provider],false);stock(game);
});
void test('Actual Advanced BG Worthless conversion resolves before any Nexus declaration',()=>{
  const initial=createGame('HARKBG',newPlayer('bg','BG','beneGesserit'),true);
  joinGame(initial,newPlayer('h','Harkonnen','harkonnen'));joinGame(initial,newPlayer('a','Atreides','atreides'));joinGame(initial,newPlayer('g','Guild','guild'));
  const f=createHarkonnenNexusBetrayalFixture({initial,remote:true,advanced:true});
  const bg=f.beforeNativeCounter.players.find(p=>p.faction==='beneGesserit')!,card=bg.hand.find(c=>c.kind==='worthless')!;
  assert.ok(card);
  let game=applyAction(f.beforeNativeCounter,bg.id,{type:'card',mode:'cancel',card:card.id});
  for(let i=0;game.response&&i<100;i++) {const seat=game.players.find(p=>!game.response!.passed.includes(p.id))!;game=applyAction(game,seat.id,{type:'passResponse'});}
  assert.equal(game.pendingNexusHarkonnenBetrayal,null);assert.equal(game.nexusHarkonnenBetrayalHistory!.length,0);
  assert.equal(game.battle!.traitorCalls[f.provider],false);assert.ok(game.discard.some(c=>c.id===card.id));
  assert.equal(game.nexusCards!.cards!.hands[f.holder],'harkonnen');stock(game);
});
void test('A real retirement shuffle may return the same physical identity as the private native draw, never an earlier read',()=>{
  const f=createHarkonnenNexusBetrayalFixture({remote:true}),original=Object.getOwnPropertyDescriptor(crypto,'getRandomValues');
  let first=true,spent:Game;
  crypto.getRandomValues=<T extends ArrayBufferView | null>(array:T):T=>{
    assert.ok(array);
    const values=new Uint32Array(array.buffer,array.byteOffset,array.byteLength/4);
    for(let i=0;i<values.length;i++) {values[i]=first?0:0xffffffff;first=false;}
    return array;
  };
  try {spent=use(f);} finally {
    if(original) Object.defineProperty(crypto,'getRandomValues',original);
    else Reflect.deleteProperty(crypto,'getRandomValues');
  }
  assert.equal(spent.traitorReserve![0],f.identity);
  const before=JSON.stringify(spent);
  for(const p of spent.players) viewGame(spent,p.id);
  assert.equal(JSON.stringify(spent),before);
  assert.equal(spent.players.find(p=>p.id===f.provider)!.traitors.length,3);
  const mentat=advanceHarkonnenBetrayalToMentat(spent);
  assert.equal(mentat.nexusHarkonnenReplacementHistory![0].drawn,f.identity);
  assert.equal(mentat.players.find(p=>p.id===f.provider)!.traitors.filter(card=>card===f.identity).length,1);
  assert.equal(mentat.players.find(p=>p.id===f.provider)!.revealedTraitors!.includes(f.identity),false);
  const own=viewGame(mentat,f.provider),rival=viewGame(mentat,f.holder);
  assert.ok(own.players.find(p=>p.id===f.provider)!.traitors!.includes(f.identity));
  assert.equal(rival.players.find(p=>p.id===f.provider)!.traitors,undefined);
  assert.equal('pendingNexusHarkonnenReplacement' in rival,false);
  assert.equal('nexusHarkonnenReplacementHistory' in rival,false);
  stock(mentat);
});
void test('Fresh admission rejects replay, modules and ordinary-game retrofit while preserving lobby immutably',()=>{
  let lobby=createGame('HARKBOUND',newPlayer('h','H','harkonnen'),false);joinGame(lobby,newPlayer('g','G','guild'));
  for(const p of lobby.players) lobby=applyAction(lobby,p.id,{type:'ready'});
  lobby.nexusCards={cards:null,phase:null};
  const before=JSON.stringify(lobby),started=initializeHarkonnenNexusBetrayalGameForAudit(lobby);
  assert.equal(JSON.stringify(lobby),before);assert.equal(started.nexusHarkonnenBetrayalPreview,true);
  assert.throws(()=>initializeHarkonnenNexusBetrayalGameForAudit(started));
  const modular=structuredClone(lobby);modular.expansions=['ix'];assert.throws(()=>initializeHarkonnenNexusBetrayalGameForAudit(modular));
});
