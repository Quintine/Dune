import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction,type Game} from '../game/engine';
import {semutaStrongholdsClosingFixture} from './fixture-semuta-strongholds';
const reload=(game:Game):Game=>JSON.parse(JSON.stringify(game));
const inventory=(game:Game)=>[...game.deck,...game.discard,...game.richeseCache!,...game.players.flatMap(p=>p.hand)].map(c=>c.id).sort();
for(const tech of [false,true]) void test(`Closing Semuta Gamont preserves original Stronghold claim timing${tech?' with native Tech':''}`,()=>{
  const f=semutaStrongholdsClosingFixture(tech),before=f.game;
  assert.equal(before.strongholdCards!.claimedTurn,0);
  assert.equal(before.strongholdCards!.owners.arrakeen,null);
  assert.equal(before.strongholdCards!.owners.carthag,null);
  let pending=applyAction(before,'e',{type:'card',mode:'choam',card:f.gamont,target:'a',from:'carthag:11',elite:0});
  while(pending.response){const actor=pending.players.find(p=>!pending.response!.passed.includes(p.id))!;pending=applyAction(pending,actor.id,{type:'passResponse'});}
  assert.equal(pending.pendingTreacheryDiscard?.reaction?.stage,'offer');
  const event=pending.pendingTreacheryDiscard!.batch.event;
  const originalCards=structuredClone(pending.strongholdCards),originalTech=structuredClone(pending.techTokens);
  for(const claim of [false,true]) {
    let resumed=reload(pending);
    if(claim)resumed=applyAction(resumed,'r',{type:'semutaCommit',event});
    else for(const id of ['a','e','r'])resumed=applyAction(resumed,id,{type:'semutaPass',event});
    assert.equal(resumed.decision?.kind,'choamMentat');assert.equal(resumed.decision?.player,'e');
    assert.deepEqual(resumed.players.find(p=>p.id==='a')!.forces,{'arrakeen:10':3});
    assert.equal(resumed.players.find(p=>p.id==='a')!.reserves,17);
    assert.deepEqual(resumed.strongholdCards,originalCards);assert.deepEqual(resumed.techTokens,originalTech);
    assert.throws(()=>applyAction(resumed,'a',{type:'decision',done:true}));
    const next=applyAction(resumed,'e',{type:'decision',done:true});
    assert.equal(next.strongholdCards!.claimedTurn,2);
    assert.equal(next.strongholdCards!.owners.arrakeen,'a');
    assert.equal(next.strongholdCards!.owners.carthag,null);
    assert.equal(next.status,'playing');assert.equal(next.turn,3);assert.equal(next.phase,0);
    assert.deepEqual(next.techTokens,originalTech);
    assert.equal(next.players.find(p=>p.id==='r')!.hand.some(c=>c.id===f.gamont),claim);
    assert.equal(next.discard.some(c=>c.id===f.semuta),claim);
    assert.deepEqual(inventory(next),f.cards);
    assert.throws(()=>applyAction(next,'r',{type:'semutaCommit',event}));
    assert.throws(()=>applyAction(next,'e',{type:'decision',done:true}));
  }
});
