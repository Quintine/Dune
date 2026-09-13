import assert from 'node:assert/strict';
import { applyAction, createGame, initializeMoritaniAssassinateGameForAudit, joinGame, newPlayer, viewGame, type Game, type Action } from '../game/engine';
import { botActions } from '../game/bots';
import type { Difficulty } from '../game/bot-profiles';

export function assassinationActions(g:Game,id:string,difficulty:Difficulty='Medium') {
  const view=viewGame(g,id);view.players.find(p=>p.id===id)!.bot=difficulty;
  return botActions(view);
}
/** Genuine Advanced Moritani/Guild setup. Subsequent helpers explicitly stage
 * a conserved battle and physical traitor swap; they do not certify natural use. */
export function assassinationGame(ids=['m','g']) {
  let g=createGame('ASSASSIN',newPlayer(ids[0],'Moritani','moritani'),true,['ecaz']);
  joinGame(g,newPlayer(ids[1],'Guild','guild'));
  if(ids[2])joinGame(g,newPlayer(ids[2],'Emperor','emperor'));
  for(const p of g.players)p.ready=true;
  g=initializeMoritaniAssassinateGameForAudit(g);
  for(let n=0;g.status==='setup'&&n<50;n++) {
    const next=g.players.flatMap(p=>assassinationActions(g,p.id).map(action=>({id:p.id,action})))[0];
    assert.ok(next,'The real Moritani setup must offer a legal choice');
    g=applyAction(g,next.id,next.action);
  }
  assert.equal(g.status,'playing');assert.equal(g.phase,0);
  return g;
}
export function giveAssassinationTraitor(g:Game,identity:string) {
  const owner=g.players[0],old=owner.traitors[0];
  assert.ok(old);
  if(old===identity)return;
  const other=g.players.find(p=>p.id!==owner.id&&p.traitors.includes(identity));
  if(other)other.traitors[other.traitors.indexOf(identity)]=old;
  else {
    const i=g.traitorReserve!.indexOf(identity);assert.ok(i>=0,'Fixture swap must find the physical traitor');
    g.traitorReserve![i]=old;
  }
  owner.traitors[0]=identity;
}
export function stageAssassinationBattle(state:Game,identity='guild-1',dead=false) {
  const g=structuredClone(state);
  giveAssassinationTraitor(g,identity);
  g.phase=6;g.ready=[];g.order=[g.players[1].id,g.players[0].id,...g.players.slice(2).map(p=>p.id)];g.active=g.players[1].id;g.storm=18;g.battle=null;g.decision=null;g.response=null;
  for(const [index,p] of g.players.entries()){
    p.reserves+=Object.values(p.forces).reduce((a,b)=>a+b,0);p.forces={};
    if(p.elites){p.elites.reserves+=Object.values(p.elites.forces).reduce((a,b)=>a+b,0);p.elites.forces={};}
    if(index<2){p.reserves-=3;p.forces['arrakeen:10']=3;}
  }
  const target=g.players[1].leaders.find(l=>l.id===identity);
  if(target&&dead){target.dead=true;target.deaths=1;delete target.usedAt;}
  return g;
}
export function prepareAssassinationBattle(state:Game,options:{winnerWeapon?:string}={}) {
  let g=applyAction(state,state.players[1].id,{type:'chooseBattle',territory:'arrakeen',target:state.players[0].id});
  for(let n=0;g.response&&n<15;n++) {
    const candidate=g.players.flatMap(p=>assassinationActions(g,p.id).map(action=>({id:p.id,action}))).find(c=>c.action.type==='passResponse');
    assert.ok(candidate);g=applyAction(g,candidate.id,candidate.action);
  }
  assert.ok(g.battle);assert.equal(g.battle.preparation,undefined);
  const [m,w]=g.players;
  g=applyAction(g,w.id,{type:'battlePlan',leader:w.leaders[0].id,dial:0,support:0,...(options.winnerWeapon?{weapon:options.winnerWeapon}:{})});
  g=applyAction(g,m.id,{type:'battlePlan',leader:m.leaders[4].id,dial:0,support:0});
  return g;
}
export function resolveAssassinationBattle(state:Game,options:{normalCall?:boolean;winnerWeapon?:string}={}) {
  let g=prepareAssassinationBattle(state,options);
  const [m,w]=g.players;
  for(const id of [w.id,m.id])g=applyAction(g,id,{type:'traitorCall',call:id===m.id&&!!options.normalCall});
  return g;
}
export function assassinationChoice(g:Game,card:string|null) {
  assert.equal(g.decision?.kind,'moritaniAssassinate');
  const d=g.decision as Extract<NonNullable<Game['decision']>,{kind:'moritaniAssassinate'}>;
  return applyAction(g,d.player,{type:'decision',event:d.event,...(card===null?{decline:true}:{card})});
}
export function assassinationToMentat(state:Game) {
  let g=state;
  for(let n=0;g.phase!==8&&n<80;n++) {
    const choices=g.players.flatMap(p=>assassinationActions(g,p.id).map(action=>({id:p.id,action})));
    const next=choices.find(c=>c.action.type==='ready')??choices[0];
    assert.ok(next,`Continuation stalled in ${g.phase}/${g.decision?.kind}`);
    g=applyAction(g,next.id,next.action);
  }
  assert.equal(g.phase,8);return g;
}
export function assassinationPhysical(g:Game) {
  return {
    cards:[...g.deck,...g.discard,...g.players.flatMap(p=>p.hand)].map(c=>c.id).sort(),
    traitors:[...(g.traitorReserve??[]),...g.players.flatMap(p=>p.traitors),...(g.moritaniAssassinate?.opportunities.filter(r=>r.stage==='replaced').map(r=>r.card!)??[])].sort(),
    forces:g.players.map(p=>({id:p.id,total:p.reserves+p.tanks+Object.values(p.forces).reduce((a,b)=>a+b,0),elite:(p.elites?.reserves??0)+(p.elites?.tanks??0)+Object.values(p.elites?.forces??{}).reduce((a,b)=>a+b,0)})),
  };
}
export function assassinationRejects(g:Game,id:string,action:Action) {
  const before=structuredClone(g);assert.throws(()=>applyAction(g,id,action));assert.deepEqual(g,before);
}
