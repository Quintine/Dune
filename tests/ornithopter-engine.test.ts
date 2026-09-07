import {createRicheseNoField,deployRicheseNoField} from '../game/richese-no-field';
import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction,createGame,newPlayer,viewGame,normalizeAutomaticGame,type Game,type Action} from '../game/engine';
import {baseDeck} from '../game/cards';
import {FACTIONS,type FactionId} from '../game/catalog';
import {TERRITORIES,gameDistance,splitLocation} from '../game/board';
import {richeseCards} from '../game/richese-cards';
const card='richese-ornithopter';
const origin='red_chasm:7';
function fixture(faction:FactionId='emperor',advanced=false){
 const g=createGame('ORNITHOPTER',newPlayer('p','Pilot',faction),advanced,['choam']);
 g.players.push(newPlayer('q','Observer',faction==='atreides'?'harkonnen':'atreides'));
 g.status='playing';g.turn=2;g.phase=5;g.active='p';g.order=['p','q'];g.storm=18;g.deck=baseDeck();g.richeseCache=richeseCards();
 for(const p of g.players){p.hand=[];p.forces={};p.spice=10;p.reserves=20;p.shipped=false;p.moved=0;if(p.elites){p.elites.forces={};p.elites.reserves=10;}}
 g.players[0].forces={[origin]:5};g.players[0].reserves=15;
 g.players[0].hand=[g.richeseCache.find(c=>c.id===card)!];g.richeseCache=g.richeseCache.filter(c=>c.id!==card);
 return g;
}
function destination(g:Game,from=origin,distance=1,exclude:string[]=[]){
 const key=TERRITORIES.flatMap(t=>t.sectors.map(s=>`${t.id}:${s}`)).find(k=>!exclude.includes(k)&&splitLocation(k).sector!==g.storm&&splitLocation(k).territory!==splitLocation(from).territory&&gameDistance(g,from,k,k=>splitLocation(k).sector===g.storm)===distance);
 assert.ok(key,`route distance${distance}`);return key;
}
function move(g:Game,key:string,extra:Partial<Action>={}){return applyAction(g,'p',{type:'move',from:origin,amount:2,...splitLocation(key),...extra});}
const reload=(g:Game):Game=>JSON.parse(JSON.stringify(g));
void test('all twelve holders use fixed three-territory card range in both games without income or reserve shipment',()=>{
 for(const faction of FACTIONS)for(const advanced of [false,true]){
  const g=fixture(faction.id,advanced),key=destination(g,origin,3),before=structuredClone(g);
  const done=move(g,key,{movementCard:card,ornithopter:'range3'});
  assert.deepEqual(g,before);assert.equal(done.players[0].forces[key],2);assert.equal(done.players[0].moved,1);
  assert.equal(done.players[0].reserves,15);assert.equal(done.players[0].spice,10);assert.equal(done.players[1].spice,10);
  assert.equal(done.players[0].hand.length,0);assert.equal(done.discard.at(-1)?.id,card);assert.equal(done.ornithopter,null);
  assert.throws(()=>move(done,destination(done),{movementCard:card,ornithopter:'range3'}));
 }
});
void test('two groups preserve source quotas after merging and allow distinct subsets from the same origin',()=>{
 let g=fixture();const key=destination(g);g.players[0].forces[key]=2;g.players[0].reserves=13;
 g=move(g,key,{amount:3,movementCard:card,ornithopter:'twoGroups'});
 assert.equal(g.players[0].forces[key],5);assert.equal(g.players[0].hand.length,0);assert.equal(g.discard.length,0);
 assert.equal(g.ornithopter!.completed,1);assert.equal(g.ornithopter!.cohort!.forces[origin],2);assert.equal(g.ornithopter!.cohort!.forces[key],2);
 const event=g.ornithopter!.event;const before=structuredClone(g);
 assert.throws(()=>move(g,origin,{from:key,amount:3,ornithopterEvent:event}));assert.deepEqual(g,before);
 const done=move(reload(g),key,{amount:2,ornithopterEvent:event});
 assert.equal(done.players[0].forces[key],7);assert.equal(done.players[0].moved,2);assert.equal(done.ornithopter,null);
 assert.equal(done.discard.filter(c=>c.id===card).length,1);
});
void test('original units at the first destination remain eligible while moved arrivals cannot be reused',()=>{
 let g=fixture();const first=destination(g);g.players[0].forces[first]=1;
 g=move(g,first,{movementCard:card,ornithopter:'twoGroups'});const event=g.ornithopter!.event;
 assert.throws(()=>move(g,origin,{from:first,amount:2,ornithopterEvent:event}));
 const done=move(g,origin,{from:first,amount:1,ornithopterEvent:event});
 assert.equal(done.players[0].forces[first],2);assert.equal(done.players[0].forces[origin],4);
});
void test('current normal range is recomputed for the second group after the first group establishes stronghold access',()=>{
 let g=fixture();const near=TERRITORIES.flatMap(t=>t.sectors.map(s=>`${t.id}:${s}`)).find(k=>splitLocation(k).territory!=='arrakeen'&&gameDistance(g,k,'arrakeen:10',k=>splitLocation(k).sector===18)===1)!;
 g.players[0].forces={[near]:2,[origin]:3};
 g=move(g,'arrakeen:10',{from:near,amount:2,movementCard:card,ornithopter:'twoGroups'});
 const done=move(g,destination(g,origin,3),{ornithopterEvent:g.ornithopter!.event});
 assert.equal(done.players[0].moved,2);assert.equal(done.ornithopter,null);
});
void test('played card escrow, owner-only remaining quotas and ended movement survive JSON without free replay',()=>{
 const g=fixture();const first=move(g,destination(g),{movementCard:card,ornithopter:'twoGroups'});
 assert.deepEqual(normalizeAutomaticGame(reload(first)),reload(first));
 assert.equal(viewGame(first,'p').ornithopter!.active!.remaining,1);assert.equal(viewGame(first,'q').ornithopter,null);
 const before=structuredClone(first);assert.throws(()=>move(first,destination(first),{ornithopterEvent:'stale'}));assert.deepEqual(first,before);
 const ended=applyAction(reload(first),'p',{type:'endMovement'});assert.equal(ended.ornithopter,null);assert.equal(ended.discard.filter(c=>c.id===card).length,1);
 assert.equal(ended.active,'q');
});
void test('invalid source, blocked route, committed card and explicitly unresolved combinations are immutable',()=>{
 for(const change of ['range','storm','prior','hajr','advisor','kulon','gift','wrongMode'] as const){
  const g=fixture(change==='advisor'?'beneGesserit':change==='kulon'?'choam':'emperor',change==='advisor');
  let key=destination(g,origin,3);const extra:Partial<Action>={movementCard:card,ornithopter:'range3'};
  if(change==='range')key=destination(g,origin,4);if(change==='storm')g.storm=splitLocation(key).sector;
  if(change==='prior')g.players[0].moved=1;if(change==='hajr')g.hajr=['p'];
  if(change==='advisor'){g.players[0].advisors={red_chasm:{}};g.players[1].forces={[origin]:1};}
  if(change==='kulon')g.choamMovement={turn:g.turn,bonus:1};
  if(change==='wrongMode')extra.ornithopter='both';
  if(change==='gift')g.pendingRicheseGift={event:'reserved',intent:{owner:'p',recipient:'q',cardId:card},turn:g.turn,phase:g.phase,resume:{response:null,decision:null,pendingKarama:null,phaseOpening:null}} as Game['pendingRicheseGift'];
  const before=structuredClone(g);assert.throws(()=>move(g,key,extra),change);assert.deepEqual(g,before);
 }
});
void test('Ixian fixed card range does not open a faction-speed cancellation but two-group normal range does',()=>{
 const g=fixture('ixians');g.players[0].elites!.forces={[origin]:2};g.players[0].elites!.reserves-=2;
 const karama=g.deck.find(c=>c.effect==='karama')!;g.deck=g.deck.filter(c=>c.id!==karama.id);g.players[1].hand=[karama];
 const fixed=move(g,destination(g,origin,3),{elite:1,movementCard:card,ornithopter:'range3'});
 assert.equal(fixed.response,null);assert.equal(fixed.players[0].moved,1);
 const normal=move(g,destination(g,origin,2),{elite:1,movementCard:card,ornithopter:'twoGroups'});
 assert.equal(normal.response?.kind,'ixMovement');assert.equal(normal.players[0].moved,0);assert.equal(normal.ornithopter!.completed,0);
 const allowed=applyAction(normal,'q',{type:'passResponse'});assert.equal(allowed.players[0].moved,1);assert.equal(allowed.ornithopter!.completed,1);
});

void test('a concealed marker cannot move twice and revealing an unmoved marker preserves its eligible physical replacements',()=>{
 for(const movedMarker of [false,true]){
  let g=fixture('richese');const p=g.players[0],ids=['opaque-zero','opaque-three','opaque-five'];
  p.noField=deployRicheseNoField(createRicheseNoField(ids),{tokenId:ids[1],controller:'p',location:splitLocation(origin)});p.noFieldEvent='marker-before';
  const key=destination(g);
  g=move(g,key,{movementCard:card,ornithopter:'twoGroups',...(movedMarker?{forces:{},noField:ids[1],event:'marker-before'}:{amount:2})});
  const event=g.ornithopter!.event;
  assert.equal(JSON.stringify(viewGame(g,'q')).includes(ids[1]),false);
  if(movedMarker){
   assert.equal(g.ornithopter!.cohort!.noField,undefined);
   assert.throws(()=>move(g,origin,{forces:{},noField:ids[1],event:g.players[0].noFieldEvent,ornithopterEvent:event}));
  } else assert.equal(g.ornithopter!.cohort!.noField!.tokenId,ids[1]);
  g=applyAction(g,'p',{type:'revealNoField',token:ids[1],event:g.players[0].noFieldEvent});
  assert.equal(g.ornithopter!.cohort!.noField,undefined);
  if(movedMarker){
   assert.throws(()=>move(g,origin,{from:key,amount:1,ornithopterEvent:event}));
  } else {
   assert.equal(g.ornithopter!.cohort!.forces[origin],6);
   const done=move(g,key,{amount:6,ornithopterEvent:event});assert.equal(done.players[0].forces[key],8);
  }
 }
});
