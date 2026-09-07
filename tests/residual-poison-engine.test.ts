import test from 'node:test';import assert from 'node:assert/strict';
import {applyAction,createGame,newPlayer,viewGame,normalizeAutomaticGame,type Game,type Action} from '../game/engine';
import {baseDeck} from '../game/cards';import {FACTIONS,type FactionId} from '../game/catalog';import {richeseCards} from '../game/richese-cards';import {createDukeVidal} from '../game/duke-vidal';
const card='richese-residual-poison';
function fixture(faction:FactionId='emperor',advanced=false,target:FactionId='fremen'){
 const g=createGame('RESIDUAL',newPlayer('p','Card holder',faction),advanced,['choam']);g.players.push(newPlayer('q','Opponent',target));
 if(!g.players.some(p=>p.faction==='richese'))g.players.push(newPlayer('r','Richese observer','richese'));
 g.status='playing';g.phase=6;g.turn=2;g.storm=18;g.order=g.players.map(p=>p.id);g.active='p';g.deck=baseDeck();g.richeseCache=richeseCards();
 for(const p of g.players){p.hand=[];p.forces={};p.reserves=20;p.spice=10;p.traitors=[];}
 g.players[0].forces={'arrakeen:10':5};g.players[1].forces={'arrakeen:10':5};g.players[0].reserves=g.players[1].reserves=15;
 g.players[0].hand=[g.richeseCache.find(c=>c.id===card)!];g.richeseCache=g.richeseCache.filter(c=>c.id!==card);
 return applyAction(g,'p',{type:'chooseBattle',territory:'arrakeen',target:'q'});
}
const play=(g:Game,extra:Partial<Action>={})=>applyAction(g,'p',{type:'card',card,target:'q',event:g.battle!.event,...extra});
const ready=(g:Game,id:string)=>applyAction(g,id,{type:'battlePreparationReady',event:g.battle!.preLeader!.event});
const reload=(g:Game):Game=>JSON.parse(JSON.stringify(g));
void test('all twelve ordinary holders kill exactly one available opposing leader with no spice, force or battle-resolution effects',()=>{
 for(const f of FACTIONS){const g=fixture(f.id,false,f.id==='fremen'?'emperor':'fremen'),before=structuredClone(g),done=play(g);
  assert.deepEqual(g,before);assert.equal(done.players[1].leaders.filter(l=>l.dead).length,1);assert.equal(done.players[1].leaders.reduce((n,l)=>n+l.deaths,0),1);
  for(let i=0;i<g.players.length;i++){assert.equal(done.players[i].spice,10);assert.equal(done.players[i].reserves,g.players[i].reserves);assert.deepEqual(done.players[i].forces,g.players[i].forces);}
  assert.equal(done.discard.at(-1)?.id,card);assert.equal(done.players[0].hand.length,0);assert.equal(done.battle!.event,g.battle!.event);assert.equal(done.battle!.revealed,false);assert.deepEqual(done.battle!.plans,{});
  assert.deepEqual(done.battle!.preparation,g.battle!.preparation);assert.equal(done.pendingCapture,null);assert.equal(done.pendingFaceDance,undefined);
 }
});
void test('guaranteed pre-leader opportunity is public and hand-independent and prevents a fast first plan',()=>{
 let g=fixture();const without=structuredClone(g);without.players[0].hand=[];
 assert.deepEqual(viewGame(g,'q').battle!.preLeader,viewGame(without,'q').battle!.preLeader);
 assert.deepEqual(normalizeAutomaticGame(reload(g)),reload(g));
 const plan={type:'battlePlan',dial:1,leader:g.players[1].leaders[0].id,weapon:null,defense:null};
 assert.throws(()=>applyAction(g,'q',plan),/Both combatants/);
 g=ready(g,'p');assert.throws(()=>applyAction(g,'q',plan),/Both combatants/);assert.throws(()=>ready(g,'r'));
 g=ready(g,'q');assert.equal(g.battle!.preLeader!.closed,true);g=applyAction(g,'q',plan);assert.ok(g.battle!.plans.q);
 assert.throws(()=>play(g),/before either combatant/);
});
void test('a same-territory used disc remains eligible while dead and elsewhere-used leaders and hero cards do not',()=>{
 const g=fixture();const target=g.players[1];target.leaders.forEach((l,i)=>{if(i===0)l.usedAt='arrakeen';else if(i===1)l.usedAt='carthag';else{l.dead=true;l.deaths=1;}});
 const hero=g.deck.find(c=>c.kind==='hero')!;g.deck=g.deck.filter(c=>c.id!==hero.id);target.hand=[hero];
 const done=play(g);assert.equal(done.players[1].leaders[0].dead,true);assert.equal(done.players[1].leaders[0].usedAt,undefined);assert.equal(done.players[1].leaders[1].dead,false);assert.deepEqual(done.players[1].hand,[hero]);
});
void test('normal foreign ghola control and Duke tank history are preserved without bounty or native duplication',()=>{
 for(const kind of ['ghola','duke'] as const){const g=fixture('emperor',false,kind==='ghola'?'tleilaxu':'moritani');g.players[1].leaders.forEach(l=>{l.dead=true;l.deaths=1;});
  let victim:string;
  if(kind==='ghola'){const foreign=g.players[0].leaders[0];foreign.gholaBy='q';victim=foreign.id;}
  else {g.dukeVidal=createDukeVidal();g.dukeVidal.controller='q';g.dukeVidal.source='moritani';g.dukeVidal.acquiredTurn=g.turn;victim=g.dukeVidal.leader.id;}
  const done=play(g);if(kind==='ghola'){const dead=done.players[0].leaders.find(l=>l.id===victim)!;assert.equal(dead.dead,true);assert.equal(dead.gholaBy,'q');assert.equal(dead.deaths,1);}
  else{assert.equal(done.dukeVidal!.leader.dead,true);assert.equal(done.dukeVidal!.leader.deaths,1);assert.equal(done.dukeVidal!.controller,null);assert.equal(done.players.some(p=>p.leaders.some(l=>l.id===victim)),false);}
  assert.equal(done.players[0].spice,10);assert.equal(done.players[1].spice,10);
 }
});
void test('invalid timing, target, identity and state fail before random selection and preserve the card',t=>{
 for(const problem of ['stale','outsider','target','sealed','prescienceLeader','empty','overflow','advancedCapture','forgedVictim'] as const){
  const g=fixture();const extra:Partial<Action>={};let actor='p';
  if(problem==='stale')extra.event='stale';if(problem==='outsider')actor='r';if(problem==='target')extra.target='p';
  if(problem==='sealed')g.battle!.plans.q={dial:1,leader:g.players[1].leaders[0].id,weapon:null,defense:null,support:0};
  if(problem==='prescienceLeader')g.battle!.prescience={player:'p',field:'leader',value:g.players[1].leaders[0].id};
  if(problem==='empty')g.players[1].leaders.forEach(l=>{l.dead=true;l.deaths=1;});
  if(problem==='overflow')g.players[1].leaders[0].deaths=Number.MAX_SAFE_INTEGER;
  if(problem==='advancedCapture'){g.advanced=true;g.players[0].faction='harkonnen';}
  if(problem==='forgedVictim')extra.leader=g.players[1].leaders[0].id;
  const before=structuredClone(g);let calls=0;const mock=t.mock.method(crypto,'getRandomValues',()=>{calls++;throw Error('RNG must not run');});
  assert.throws(()=>applyAction(g,actor,{type:'card',card,target:'q',event:g.battle!.event,...extra}),problem);assert.deepEqual(g,before);assert.equal(calls,0,problem);mock.mock.restore();
 }
});
void test('private availability never inspects RNG or exports a candidate pool, and a settled death cannot replay',t=>{
 const g=fixture(),mock=t.mock.method(crypto,'getRandomValues',()=>{throw Error('No projection RNG');});
 const view=viewGame(g,'p').residualPoison!;assert.equal(view.blocked,null);assert.deepEqual(Object.keys(view).sort(),['blocked','card','event','target']);assert.equal(viewGame(g,'q').residualPoison,null);mock.mock.restore();
 const done=play(g),saved=reload(done);assert.deepEqual(normalizeAutomaticGame(saved),saved);assert.throws(()=>play(saved));assert.equal(saved.players[1].leaders.filter(l=>l.dead).length,1);
});
