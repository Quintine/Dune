import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction,normalizeAutomaticGame,viewGame,type Action,type Game } from '../game/engine';
import { isAdvisor } from '../game/advisors';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { planetologistMoveDraft } from '../components/planetologist-movement';
import { createAdvisorGatherMatchingFixture as fixture,actAdvisorGatherMatching as act,
  finishAdvisorGatherMatching as finish,advisorGatherMatchingPlayer as player,
  advisorGatherMatchingInventory as inventory,advisorGatherMatchingSkillInventory as skills,
} from './fixture-advisor-gather-matching';

const physical=(g:Game)=>g.players.map(p=>({id:p.id,forces:p.forces,advisors:p.advisors,
  reserves:p.reserves,tanks:p.tanks,spice:p.spice,moved:p.moved,shipped:p.shipped}));
function allow(g:Game){
  const source=g.response?.advisorGatherMatchingSource??g.response?.advisorMatchingSource;assert.ok(source);
  for(let n=0;(g.response?.advisorGatherMatchingSource??g.response?.advisorMatchingSource)?.event===source.event&&n<30;n++){
    const actor=g.players.find(p=>!g.response!.passed.includes(p.id));assert.ok(actor);g=act(g,actor.id,{type:'passResponse'});
  }
  assert.notEqual((g.response?.advisorGatherMatchingSource??g.response?.advisorMatchingSource)?.event,source.event);return g;
}
function complete(g:Game){
  for(let n=0;g.response&&(g.response.advisorGatherMatchingSource||g.response.advisorMatchingSource)&&n<4;n++)g=allow(g);
  return finish(g);
}
function reject(g:Game,actor:string,action:Action){const before=structuredClone(g);assert.throws(()=>applyAction(g,actor,action));assert.deepEqual(g,before);}
for(const kind of ['mixed','double'] as const){
  void test(`native ${kind} resident gather offers one response per changing origin and moves once only after every allowance`,()=>{
    const f=fixture({kind}),draft=planetologistMoveDraft(viewGame(f.game,f.bg),'gather',f.resident,10,f.forces,{});
    assert.equal(draft.blocked,null);assert.ok(draft.action);
    let g=act(f.game,f.bg,draft.action);const seen:string[]=[];
    for(let index=0;index<f.matchingCount;index++){
      const source=g.response?.advisorGatherMatchingSource;assert.ok(source);seen.push(source.origin);
      assert.equal(g.response?.advisorGatherMatchingPosition?.current,index+1);assert.equal(g.response?.advisorGatherMatchingPosition?.total,f.matchingCount);
      assert.deepEqual(physical(g),physical(f.game));assert.deepEqual(physical(normalizeAutomaticGame(g)),physical(f.game));
      assert.equal(g.pendingAdvisorGatherMatching?.approved.length,index);
      assert.ok(player(g,f.holder).hand.some(c=>c.id===f.karama));g=allow(g);
    }
    assert.deepEqual(seen,[...seen].sort());g=finish(g);
    assert.equal(g.pendingAdvisorGatherMatching,undefined);assert.equal(player(g,f.bg).forces[f.location],3);
    assert.equal(player(g,f.bg).forces['imperial_basin:9'],1);assert.equal(player(g,f.bg).forces['oh_gap:9']??0,0);
    assert.equal(isAdvisor(player(g,f.bg),f.resident),true);assert.equal(player(g,f.bg).moved,player(f.game,f.bg).moved+1);
    assert.equal(player(g,f.bg).shipped,player(f.game,f.bg).shipped);assert.equal(player(g,f.bg).spice,player(f.game,f.bg).spice);
    assert.deepEqual(inventory(g),f.originalInventory);assert.deepEqual(skills(g),f.originalSkillInventory);
  });
  void test(`native ${kind} gather prevention preserves both groups and shares the normal packet denial`,()=>{
    const f=fixture({kind}),pending=act(f.game,f.bg,f.action),source=pending.response?.advisorGatherMatchingSource;assert.ok(source);
    const stopped=act(pending,f.holder,{type:'card',card:f.karama,mode:'cancel'});
    assert.deepEqual(physical(stopped),physical(f.game));assert.equal(stopped.pendingAdvisorGatherMatching,undefined);
    reject(stopped,f.bg,f.action);
    reject(stopped,f.bg,{...f.action,forces:Object.fromEntries(Object.entries(f.forces).reverse())});
    reject(stopped,f.bg,{type:'move',forces:source.group,territory:f.resident,sector:10});
    const draft=planetologistMoveDraft(viewGame(stopped,f.bg),'gather',f.resident,10,f.forces,{});
    assert.equal(draft.action,null);assert.match(draft.blocked??'',/prevented/);
    const done=complete(act(stopped,f.bg,f.sameTypeReplacement));
    assert.equal(player(done,f.bg).moved,1);assert.equal(done.discard.filter(c=>c.id===f.karama).length,1);
    assert.deepEqual(inventory(done),f.originalInventory);assert.deepEqual(skills(done),f.originalSkillInventory);
  });
  void test(`native ${kind} public group receipt retains normal ten-field format without the private batch`,()=>{
    const f=fixture({kind}),pending=act(f.game,f.bg,f.action),view=viewGame(pending,f.holder),source=view.response?.advisorGatherMatchingSource;assert.ok(source);
    assert.deepEqual(Object.keys(source).sort(),['advisors','destination','event','group','kind','move','origin','owner','sector','turn']);
    assert.equal(source.kind,'movement');assert.equal('pendingAdvisorGatherMatching'in view,false);
    assert.equal(JSON.stringify(source).includes('trainer'),false);
  });
  for(const profile of DIFFICULTIES)void test(`${profile} responds to native ${kind} gather and chooses a legal replacement after denial`,()=>{
    const f=fixture({kind});let pending=act(f.game,f.bg,f.action);if(kind==='double')pending=allow(pending);
    const view=viewGame(pending,f.holder);view.players.find(p=>p.id===f.holder)!.bot=profile;
    const before=structuredClone(view),answer=botActions(view)[0];assert.ok(answer);assert.deepEqual(view,before);
    assert.doesNotThrow(()=>applyAction(pending,f.holder,answer));
    const stopped=act(pending,f.holder,{type:'card',card:f.karama,mode:'cancel'}),replacementView=viewGame(stopped,f.bg);
    replacementView.players.find(p=>p.id===f.bg)!.bot=profile;const replacement=botActions(replacementView)[0];assert.ok(replacement);
    assert.doesNotThrow(()=>applyAction(stopped,f.bg,replacement));
  });
}
void test('native second-group prevention after partial allowance leaves both original groups and the whole movement unused',()=>{
  const f=fixture({kind:'double'}),first=act(f.game,f.bg,f.action),firstSource=first.response?.advisorGatherMatchingSource;assert.ok(firstSource);
  const second=allow(first),source=second.response?.advisorGatherMatchingSource;assert.ok(source);assert.notEqual(source.event,firstSource.event);
  assert.equal(source.origin,'oh_gap');assert.equal(second.pendingAdvisorGatherMatching?.approved.length,1);
  assert.deepEqual(physical(second),physical(f.game));
  const stopped=act(JSON.parse(JSON.stringify(second)),f.holder,{type:'card',card:f.karama,mode:'cancel'});
  assert.deepEqual(physical(stopped),physical(f.game));assert.equal(stopped.pendingAdvisorGatherMatching,undefined);reject(stopped,f.bg,f.action);
  const done=complete(act(stopped,f.bg,f.ordinaryReplacement));assert.equal(player(done,f.bg).forces[f.location],2);
  assert.equal(player(done,f.bg).forces['oh_gap:9'],1);assert.equal(player(done,f.bg).moved,1);
});
void test('native first-group prevention admits a different actual Basin packet for one atomic replacement gather',()=>{
  const f=fixture({kind:'double'}),stopped=act(act(f.game,f.bg,f.action),f.holder,{type:'card',card:f.karama,mode:'cancel'});
  const done=complete(act(stopped,f.bg,f.largerPacket));assert.equal(player(done,f.bg).forces[f.location],4);
  assert.equal(player(done,f.bg).forces['imperial_basin:9']??0,0);assert.equal(player(done,f.bg).forces['oh_gap:9']??0,0);
  assert.equal(player(done,f.bg).moved,1);assert.equal(done.discard.filter(c=>c.id===f.karama).length,1);
});
void test('native ordinary matching prevention cannot be bypassed by adding Planetologist second origin',()=>{
  const f=fixture({kind:'double'}),normal=act(f.game,f.bg,f.ordinaryReplacement);assert.ok(normal.response?.advisorMatchingSource);
  const stopped=act(normal,f.holder,{type:'card',card:f.karama,mode:'cancel'});reject(stopped,f.bg,f.action);
  const done=complete(act(stopped,f.bg,f.largerPacket));assert.equal(player(done,f.bg).forces[f.location],4);assert.equal(player(done,f.bg).moved,1);
});
void test('an invalid original gather signature or unearned approval index fails before cancellation cost',()=>{
  const f=fixture({kind:'double'}),pending=act(f.game,f.bg,f.action);
  const signature=structuredClone(pending);signature.pendingAdvisorGatherMatching!.signature+='changed';
  const index=structuredClone(pending);index.pendingAdvisorGatherMatching!.index=1;
  const approved=structuredClone(pending);approved.pendingAdvisorGatherMatching!.approved.push('unearned');
  for(const changed of [signature,index,approved]){reject(changed,f.holder,{type:'card',card:f.karama,mode:'cancel'});assert.ok(player(changed,f.holder).hand.some(c=>c.id===f.karama));}
});
