import test from 'node:test';import assert from 'node:assert/strict';
import {applyAction,createGame,newPlayer,viewGame,normalizeAutomaticGame,type Game} from '../game/engine';
import {baseDeck} from '../game/cards';import {FACTIONS,type FactionId} from '../game/catalog';import {richeseCards} from '../game/richese-cards';
const boxId='richese-nullentropy-box';
function fixture(faction:FactionId='richese',advanced=false,phase=4){
 const g=createGame('BOXENGINE',newPlayer('p','Box owner',faction),advanced,['choam']);
 const other=FACTIONS.find(f=>f.id!==faction)!;g.players.push(newPlayer('q','Other',other.id));
 g.status='playing';g.phase=phase;g.turn=2;g.order=['p','q'];g.active='q';g.deck=baseDeck();g.richeseCache=richeseCards();
 for(const p of g.players){p.hand=[];p.spice=10;p.forces={};}
 const box=g.richeseCache.find(c=>c.id===boxId)!;g.richeseCache=g.richeseCache.filter(c=>c.id!==box.id);g.players[0].hand=[box];
 g.discard=g.deck.splice(0,3);return g;
}
const begin=(g:Game)=>applyAction(g,'p',{type:'card',card:boxId});
const choose=(g:Game,id:string)=>applyAction(g,'p',{type:'decision',event:g.pendingNullentropy!.event,card:id});
const reload=(g:Game):Game=>JSON.parse(JSON.stringify(g));
void test('all twelve holders can pay and search across nine phases in both modes without changing non-Box resources',()=>{
 for(const f of FACTIONS)for(const advanced of [false,true])for(let phase=0;phase<9;phase++){
  const g=fixture(f.id,advanced,phase),before=structuredClone(g),selected=g.discard[0];
  const paid=begin(g);assert.deepEqual(g,before);assert.equal(paid.players[0].spice,8);assert.deepEqual(paid.discard,g.discard);
  assert.equal(paid.decision?.kind,'nullentropy');assert.deepEqual(normalizeAutomaticGame(reload(paid)),reload(paid));
  const done=choose(reload(paid),selected.id);assert.deepEqual(done.players[0].hand,[selected]);assert.equal(done.players[0].spice,8);
  assert.equal(done.players[1].spice,10);assert.deepEqual(done.deck,g.deck);assert.deepEqual(done.richeseCache,g.richeseCache);
  assert.equal(done.discard.at(-1)!.id,boxId);assert.equal(done.discard.length,g.discard.length);assert.equal(done.phase,phase);
  assert.equal(done.pendingNullentropy,null);assert.throws(()=>begin(done));
 }
});
void test('prepayment projection has no candidates and selection entitlement ends after exact private recovery',()=>{
 const g=fixture(), selected=g.discard[0];
 const unpaid=viewGame(g,'p').nullentropy!;assert.equal(unpaid.search,null);assert.deepEqual(Object.keys(unpaid).sort(),['blocked','card','search']);
 assert.equal(viewGame(g,'q').nullentropy,null);
 const paid=begin(g);assert.equal(viewGame(paid,'p').nullentropy!.search!.cards.length,3);
 assert.equal(viewGame(paid,'q').nullentropy,null);assert.equal(JSON.stringify(viewGame(paid,'q')).includes(selected.id),false);
 const done=choose(paid,selected.id);assert.equal(viewGame(done,'p').nullentropy,null);
 assert.equal(JSON.stringify(viewGame(done,'q')).includes(selected.id),false);assert.equal(done.log.some(l=>l.text.includes(selected.name)),false);
});
void test('a sole eligible card is taken automatically while every other Box stays in the shuffled pile below the used Box',()=>{
 const g=fixture(),selected=g.discard[0];g.discard=[selected,{...g.players[0].hand[0],id:'other-box'}];
 const done=begin(g);assert.equal(done.pendingNullentropy,null);assert.equal(done.decision,null);assert.equal(done.players[0].spice,8);
 assert.deepEqual(done.players[0].hand,[selected]);assert.deepEqual(done.discard.map(c=>c.id),['other-box',boxId]);
});
void test('illegal starts do not charge or expose a search, including unresolved full-hand and Guild-refund cases',()=>{
 for(const change of ['full','funds','empty','onlyBox','reservedRefund','preselect'] as const){
  const g=fixture();if(change==='full')g.players[0].hand.push(...g.deck.splice(0,3));
  if(change==='funds')g.players[0].spice=1;if(change==='empty')g.discard=[];
  if(change==='onlyBox')g.discard=[{...g.players[0].hand[0],id:'other-box'}];
  if(change==='reservedRefund'){g.players[1].faction='guild';g.karamaShipping={owner:'p',player:'p',card:g.discard[0].id};}
  const before=structuredClone(g);
  assert.throws(()=>applyAction(g,'p',{type:'card',card:boxId,...(change==='preselect'?{give:g.discard[0].id}:{})}));
  assert.deepEqual(g,before);assert.equal(viewGame(g,'p').nullentropy!.search,null);
 }
});
void test('a paid auction bid is not charged again as a reservation when Box is played during its remaining income response',()=>{
 const g=fixture('richese',true,3);g.players[0].spice=2;
 const purchased=g.deck.shift()!;g.players[0].hand.push(purchased);
 g.auction={cards:[purchased],index:0,bid:5,bidder:'p',active:'p',passed:[],opener:0};
 g.currentAuctionSale={winner:'p',amount:5,free:false,origin:'normal',seller:null};
 g.response={kind:'emperorIncome',owner:'q',passed:[]};
 const counter=g.deck.splice(g.deck.findIndex(c=>c.effect==='karama'),1)[0];g.players[0].hand.push(counter);
 const paid=begin(g);assert.equal(paid.players[0].spice,0);assert.deepEqual(paid.pendingNullentropy!.resume.response,g.response);
 const done=choose(paid,g.discard[0].id);assert.deepEqual(done.response,g.response);assert.deepEqual(done.currentAuctionSale,g.currentAuctionSale);
});
void test('invalid selections preserve the paid search and reject before any shuffle',t=>{
 const paid=begin(fixture());const before=structuredClone(paid);let rng=0;
 t.mock.method(crypto,'getRandomValues',()=>{rng++;throw Error('Unexpected RNG');});
 for(const action of [
  {type:'decision',event:'stale',card:paid.discard[0].id},
  {type:'decision',event:paid.pendingNullentropy!.event,card:'not-in-discard'},
  {type:'card',card:boxId},
 ]){assert.throws(()=>applyAction(paid,'p',action));assert.deepEqual(paid,before);}
 assert.equal(rng,0);
});
