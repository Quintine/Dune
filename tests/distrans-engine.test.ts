import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction,createGame,newPlayer,viewGame,type Game} from '../game/engine';
import {baseDeck} from '../game/cards';
import {FACTIONS,type FactionId} from '../game/catalog';
import {richeseCards} from '../game/richese-cards';
function fixture(faction: FactionId = 'richese', advanced = false, phase = 4) {
  const g = createGame('DISTRANSENGINE',newPlayer('d','Donor',faction),advanced,['choam']);
  const others=FACTIONS.filter(f=>f.id!==faction).slice(0,2);
  g.players.push(newPlayer('t','Target',others[0].id),newPlayer('o','Observer',others[1].id));
  g.status='playing';g.phase=phase;g.turn=2;g.order=['d','t','o'];g.active='t';
  g.deck=baseDeck();g.richeseCache=richeseCards();
  for(const p of g.players){p.hand=[];p.spice=10;p.forces={};p.ally=null;}
  const distrans=g.richeseCache.find(c=>c.effect==='distrans')!;
  g.richeseCache=g.richeseCache.filter(c=>c.id!==distrans.id);g.players[0].hand.push(distrans);
  const card=g.deck.splice(g.deck.findIndex(c=>c.name==='Shield'),1)[0];g.players[0].hand.push(card);
  return {g,card};
}
const play=(g:Game,card:string)=>applyAction(g,'d',{type:'card',card:'richese-distrans',target:'t',give:card});
const reload=(g:Game):Game=>JSON.parse(JSON.stringify(g));
void test('all twelve faction holders can transfer to a nonally across nine phases in both modes with exact disposal and no purchase effects',()=>{
  for(const f of FACTIONS)for(const advanced of [false,true])for(let phase=0;phase<9;phase++){
    const {g,card}=fixture(f.id,advanced,phase),before=structuredClone(g),done=play(g,card.id);
    assert.deepEqual(g,before);assert.deepEqual(done.players[0].hand,[]);assert.deepEqual(done.players[1].hand,[card]);
    assert.deepEqual(done.discard.map(c=>c.id),['richese-distrans']);assert.deepEqual(done.deck,g.deck);assert.deepEqual(done.richeseCache,g.richeseCache);
    assert.deepEqual(done.players.map(p=>p.spice),[10,10,10]);assert.equal(done.phase,phase);assert.equal(done.response,null);
    assert.throws(()=>play(reload(done),card.id));
  }
});
void test('projection exposes choices only to the holder and public history reveals Distrans but not the transferred identity',()=>{
  const {g,card}=fixture();
  assert.ok(viewGame(g,'d').distrans!.choices.find(c=>c.recipient==='t')!.cards.some(c=>c.id===card.id));
  assert.equal(viewGame(g,'t').distrans,null);assert.equal(viewGame(g,'o').distrans,null);
  const done=play(g,card.id);
  assert.equal(viewGame(done,'d').distrans,null);
  assert.equal(viewGame(done,'t').players.find(p=>p.id==='t')!.hand![0].id,card.id);
  assert.equal(JSON.stringify(viewGame(done,'o')).includes(card.id),false);
  assert.match(done.log.at(-1)!.text,/Distrans/);assert.equal(done.log.some(l=>l.text.includes(card.name)),false);
});
void test('an unresolved ordinary lot is an explicit timing guard while a phase-three pre-bid context remains playable',()=>{
  const {g,card}=fixture('richese',false,3);
  assert.deepEqual(play(g,card.id).players[1].hand,[card]);
  g.auction={cards:[g.deck.shift()!],index:0,bid:0,bidder:null,active:'t',passed:[],opener:0};
  const before=structuredClone(g);
  assert.throws(()=>play(g,card.id),/unresolved auction lot awaits a ruling/);assert.deepEqual(g,before);
  assert.match(viewGame(g,'d').distrans!.blocked!,/awaits a ruling/);
});
void test('an already-paid purchase response allows Distrans without changing its completed sale or creating a second response',()=>{
  const {g,card}=fixture('richese',true,3);
  const k=g.deck.splice(g.deck.findIndex(c=>c.effect==='karama'),1)[0];g.players[0].hand.push(k);
  const purchased=g.deck.shift()!;g.players[1].hand.push(purchased);
  g.auction={cards:[purchased],index:0,bid:2,bidder:'t',active:'t',passed:[],opener:0};
  g.currentAuctionSale={winner:'t',amount:2,free:false,origin:'normal',seller:null};
  g.response={kind:'emperorIncome',owner:'o',passed:[]};
  const done=play(g,card.id);
  assert.deepEqual(done.response,g.response);assert.deepEqual(done.currentAuctionSale,g.currentAuctionSale);assert.deepEqual(done.auction,g.auction);
  assert.equal(done.players[2].spice,10);assert.deepEqual(done.players[1].hand,[purchased,card]);
});
void test('phase opening and an interrupted response retain ownership and passes; a new recipient Karama may answer the original power',()=>{
  const {g,card}=fixture('richese',true,5);
  // This suspended income belongs to the Guild during Shipment & Movement.
  g.players[2].faction='guild';
  const k=g.deck.splice(g.deck.findIndex(c=>c.effect==='karama'),1)[0];g.players[0].hand.push(k);
  g.response={kind:'guildIncome',owner:'o',amount:3,passed:['d']};g.phaseOpening={passed:['d'],initialize:false};
  const done=play(g,k.id);
  assert.deepEqual(done.response,g.response);assert.deepEqual(done.phaseOpening,g.phaseOpening);assert.deepEqual(done.players[0].hand,[card]);
  let next=applyAction(reload(done),'t',{type:'ready'});next=applyAction(next,'o',{type:'ready'});
  next=applyAction(next,'t',{type:'card',card:k.id,mode:'cancel'});
  assert.equal(next.response,null);assert.equal(next.players[2].spice,10);
  assert.deepEqual(next.discard.map(c=>c.id),['richese-distrans',k.id]);
});
void test('full recipient, self-transfer and forged activation reject atomically and no mode can bypass validation',()=>{
  for(const change of ['full','self','forged','mode'] as const){
    const {g,card}=fixture();if(change==='full')g.players[1].hand=g.deck.splice(0,4);if(change==='forged')g.players[0].hand[0].name='Forged';
    const before=structuredClone(g);
    assert.throws(()=>applyAction(g,'d',{type:'card',card:'richese-distrans',target:'t',give:change==='self'?'richese-distrans':card.id,...(change==='mode'?{mode:'special'}:{})}));
    assert.deepEqual(g,before);
  }
});
