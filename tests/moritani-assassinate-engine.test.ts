import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction,viewGame,initializeMoritaniAssassinateGameForAudit,createGame,newPlayer,joinGame,type Game} from '../game/engine';
import {DIFFICULTIES} from '../game/bot-profiles';
import {moritaniAssassinateSignature} from '../game/moritani-assassinate';
import {assassinationGame,stageAssassinationBattle,prepareAssassinationBattle,resolveAssassinationBattle,assassinationChoice,assassinationToMentat,assassinationPhysical,assassinationRejects,assassinationActions} from './moritani-assassinate-fixture';

void test('a real lost battle reveals one different opposing traitor, kills its native disc once and replaces the physical card at Mentat',()=>{
  const staged=stageAssassinationBattle(assassinationGame()),inventory=assassinationPhysical(staged);
  const pending=resolveAssassinationBattle(staged),r=pending.moritaniAssassinate!.opportunities[0];
  assert.equal(r.stage,'choice');assert.equal(r.card,null);assert.equal(pending.phase,6);
  assert.deepEqual(assassinationPhysical(pending),inventory);
  assert.equal(viewGame(pending,'g').moritaniAssassinate!.pending!.cards.length,0);
  assert.equal(viewGame(pending,'m').moritaniAssassinate!.pending!.cards[0].card,'guild-1');
  const before=pending.players[0].spice,dead=pending.players[1].leaders.find(l=>l.id==='guild-1')!;
  const done=assassinationChoice(pending,'guild-1');
  assert.equal(done.players[0].spice,before+dead.strength);
  assert.equal(done.players[1].leaders.find(l=>l.id===dead.id)!.deaths,dead.deaths+1);
  assert.equal(done.players[1].leaders.find(l=>l.id==='guild-0')!.dead,false);
  assert.equal(done.moritaniAssassinate!.opportunities[0].stage,'revealed');
  assert.ok(done.players[0].traitors.includes('guild-1'));assert.equal(done.response,null);
  for(const p of done.players)assert.deepEqual(viewGame(JSON.parse(JSON.stringify(done)),p.id),viewGame(done,p.id));
  const next=assassinationToMentat(done),settled=next.moritaniAssassinate!.opportunities[0];
  assert.equal(settled.stage,'replaced');assert.ok(settled.replacement);
  assert.equal(next.players[0].traitors.includes('guild-1'),false);
  assert.ok(next.players[0].traitors.includes(settled.replacement));
  assert.deepEqual(assassinationPhysical(next),inventory);
  const rival=viewGame(next,'g');assert.equal('replacement' in rival.moritaniAssassinate!.history[0],false);
  assert.equal('moritaniAssassinatePreview' in rival,false);assert.equal('moritaniAssassinateCallEvents' in rival,false);
});

void test('an already dead target remains a legal assassination reveal with no bounty or repeated death',()=>{
  const pending=resolveAssassinationBattle(stageAssassinationBattle(assassinationGame(),'guild-1',true));
  const before=pending.players[0].spice,dead=structuredClone(pending.players[1].leaders[1]);
  assert.equal(viewGame(pending,'m').moritaniAssassinate!.pending!.cards[0].bounty,0);
  const done=assassinationChoice(pending,'guild-1');
  assert.equal(done.players[0].spice,before);assert.deepEqual(done.players[1].leaders[1],dead);
  const next=assassinationToMentat(done);assert.equal(next.moritaniAssassinate!.opportunities[0].stage,'replaced');
  assert.equal(next.moritaniAssassinate!.opportunities[0].bounty,0);
});

void test('eligible and empty private traitor hands create indistinguishable public loss decisions and explicit decline preserves the card',()=>{
  const a=stageAssassinationBattle(assassinationGame());
  const b=stageAssassinationBattle(a,a.traitorReserve!.find(id=>id.startsWith('moritani-'))!);
  const l=resolveAssassinationBattle(a),r=resolveAssassinationBattle(b);
  // Runtime UUIDs are independent; erase only public random event identifiers.
  const normalize=(g:Game)=>{
    const view=viewGame(g,'g');
    const event=g.moritaniAssassinate!.opportunities[0].event;
    return JSON.parse(JSON.stringify(view).replaceAll(event,'battle-event'));
  };
  assert.deepEqual(normalize(l),normalize(r));
  assert.equal(viewGame(r,'m').moritaniAssassinate!.pending!.cards.length,0);
  const before=assassinationPhysical(l),held=[...l.players[0].traitors];
  const done=assassinationChoice(l,null);assert.deepEqual(done.players[0].traitors,held);
  assert.equal(done.moritaniAssassinate!.opportunities[0].stage,'declined');
  assert.deepEqual(assassinationPhysical(done),before);
  assert.equal(viewGame(done,'g').moritaniAssassinate!.history.length,0);
});

void test('all four profiles choose from the owner-only quote and decline when no eligible card exists',()=>{
  for(const identity of ['guild-1','moritani-0']) {
    const pending=resolveAssassinationBattle(stageAssassinationBattle(assassinationGame(),identity));
    for(const profile of DIFFICULTIES) {
      const actions=assassinationActions(pending,'m',profile);assert.equal(actions.length,1);
      const next=applyAction(pending,'m',actions[0]);
      assert.equal(next.moritaniAssassinate!.opportunities[0].stage,identity==='guild-1'?'revealed':'declined');
    }
  }
});

void test('stale, other-seat, same-leader, dishonest mixed and duplicate assassination actions reject without changing their input',()=>{
  const pending=resolveAssassinationBattle(stageAssassinationBattle(assassinationGame()));
  const event=pending.decision!.kind==='moritaniAssassinate'?pending.decision!.event:'';
  for(const [id,action] of [
    ['g',{type:'decision',event,card:'guild-1'}],
    ['m',{type:'decision',event:'stale',card:'guild-1'}],
    ['m',{type:'decision',event,card:'guild-0'}],
    ['m',{type:'decision',event,card:'guild-1',decline:true}],
    ['m',{type:'decision',event,card:'moritani-0'}],
  ] as const)assassinationRejects(pending,id,action);
  const done=assassinationChoice(pending,'guild-1');
  assassinationRejects(done,'m',{type:'decision',event,card:'guild-1'});
  const mentat=assassinationToMentat(done);
  assassinationRejects(mentat,'m',{type:'decision',event,card:'guild-1'});
});

void test('a normal Moritani traitor call records an explicit unresolved guard and cannot create an assassination opportunity',()=>{
  const staged=stageAssassinationBattle(assassinationGame(),'guild-0');
  const done=resolveAssassinationBattle(staged,{normalCall:true});
  assert.equal(done.moritaniAssassinate!.normalTraitorCall,true);
  assert.equal(done.moritaniAssassinateCallEvents!.length,1);
  assert.equal(done.moritaniAssassinate!.opportunities.length,0);
  assert.match(viewGame(done,'m').moritaniAssassinate!.blocked!,/clarification/);
  const corrupt=structuredClone(done);corrupt.moritaniAssassinate!.normalTraitorCall=false;
  assert.throws(()=>viewGame(corrupt,'m'),/original event/);
});

void test('saved assassination receipts and cleanup obligations fail closed after corruption',()=>{
  const pending=resolveAssassinationBattle(stageAssassinationBattle(assassinationGame()));
  for(const breakSave of [
    (g:Game)=>{g.moritaniAssassinate!.opportunities=[];},
    (g:Game)=>{g.moritaniAssassinate!.opportunities[0].opponent='m';},
    (g:Game)=>{delete g.moritaniAssassinateResume;},
    (g:Game)=>{g.moritaniAssassinateResume!.continuation.cards=['treachery-1'];},
    (g:Game)=>{g.moritaniAssassinateResume!.continuation.territory='carthag';g.moritaniAssassinateResume!.signature=JSON.stringify(g.moritaniAssassinateResume!.continuation);},
    (g:Game)=>{g.decision=null;},
  ]) {const bad=structuredClone(pending);breakSave(bad);assert.throws(()=>viewGame(bad,'m'));}
  const settled=assassinationToMentat(assassinationChoice(pending,'guild-1'));
  const missing=structuredClone(settled);missing.moritaniAssassinate!.opportunities=[];
  assert.throws(()=>viewGame(missing,'m'));
  const wrongDraw=structuredClone(settled),receipt=wrongDraw.moritaniAssassinate!.opportunities[0];
  receipt.replacement=wrongDraw.traitorReserve![0];
  receipt.signature=moritaniAssassinateSignature(receipt);
  wrongDraw.lastBattleContext!.moritaniAssassinate!.signature=receipt.signature;
  assert.throws(()=>viewGame(wrongDraw,'m'),/replacement must stay/);
});

void test('the explicit preview refuses Basic and exceptional-faction lobbies without mutation',()=>{
  for(const [advanced,opponent] of [[false,'guild'],[true,'harkonnen'],[true,'ecaz']] as const){
    const g=createGame('ASSAINIT',newPlayer('m','Moritani','moritani'),advanced,['ecaz']);
    joinGame(g,newPlayer('x','Opponent',opponent));for(const p of g.players)p.ready=true;
    const before=structuredClone(g);assert.throws(()=>initializeMoritaniAssassinateGameForAudit(g));assert.deepEqual(g,before);
  }
});

void test('a sealed normal traitor call does not publish the assassination guard before the other voter replies',()=>{
  const prepared=prepareAssassinationBattle(stageAssassinationBattle(assassinationGame(),'guild-0'));
  const called=applyAction(prepared,'m',{type:'traitorCall',call:true});
  const declined=applyAction(prepared,'m',{type:'traitorCall',call:false});
  assert.deepEqual(viewGame(called,'g'),viewGame(declined,'g'));
  assert.equal(called.moritaniAssassinate!.normalTraitorCall,true);
});

function nextAssassinationDraw(g:Game,identity:string) {
  const i=g.traitorReserve!.indexOf(identity);
  if(i>=0){const [card]=g.traitorReserve!.splice(i,1);g.traitorReserve!.unshift(card);return;}
  const holder=g.players.find(p=>p.traitors.includes(identity))!;assert.ok(holder&&holder.id!==g.players[0].id);
  const old=g.traitorReserve!.shift()!;holder.traitors[holder.traitors.indexOf(identity)]=old;g.traitorReserve!.unshift(identity);
}
void test('the per-faction marker prevents a later use even when the replacement is another matching faction card',()=>{
  const staged=stageAssassinationBattle(assassinationGame());nextAssassinationDraw(staged,'guild-2');
  const first=assassinationToMentat(assassinationChoice(resolveAssassinationBattle(staged),'guild-1'));
  assert.deepEqual(first.players[0].traitors,['guild-2']);first.turn++;
  const second=resolveAssassinationBattle(stageAssassinationBattle(first,'guild-2'));
  assert.notEqual(second.decision?.kind,'moritaniAssassinate');
  assert.equal(second.moritaniAssassinate!.opportunities.length,1);
});
void test('a private replacement may fund a later assassination against another faction without breaking historical physical custody',()=>{
  const staged=stageAssassinationBattle(assassinationGame(['m','g','e']));nextAssassinationDraw(staged,'emperor-1');
  const inventory=assassinationPhysical(staged);
  const first=assassinationToMentat(assassinationChoice(resolveAssassinationBattle(staged),'guild-1'));
  assert.deepEqual(first.players[0].traitors,['emperor-1']);first.turn++;
  first.players=[first.players[0],first.players[2],first.players[1]];
  const second=resolveAssassinationBattle(stageAssassinationBattle(first,'emperor-1'));
  const revealed=assassinationChoice(second,'emperor-1');
  const sameTurn=structuredClone(revealed),earlier=sameTurn.moritaniAssassinate!.opportunities[0];
  earlier.turn=sameTurn.turn;earlier.signature=moritaniAssassinateSignature(earlier);
  assert.throws(()=>viewGame(sameTurn,'m'),/replacement must stay/);
  const final=assassinationToMentat(revealed);
  assert.deepEqual(final.moritaniAssassinate!.opportunities.map(r=>r.stage),['replaced','replaced']);
  const physical=assassinationPhysical(final);physical.forces.sort((a,b)=>a.id.localeCompare(b.id));inventory.forces.sort((a,b)=>a.id.localeCompare(b.id));
  assert.deepEqual(physical,inventory);
  for(const p of final.players)assert.deepEqual(viewGame(JSON.parse(JSON.stringify(final)),p.id),viewGame(final,p.id));
  const bad=structuredClone(final),later=bad.moritaniAssassinate!.opportunities[1];
  later.turn=bad.moritaniAssassinate!.opportunities[0].turn;later.signature=moritaniAssassinateSignature(later);
  bad.lastBattleContext!.moritaniAssassinate!.signature=later.signature;
  assert.throws(()=>viewGame(bad,'m'),/replacement must stay/);
});
