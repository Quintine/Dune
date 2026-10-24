import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, normalizeAutomaticGame, viewGame, type Action, type Game } from '../game/engine';
import { isAdvisor } from '../game/advisors';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { createAdvisorAmbassadorMatchingFixture as fixture,
  actAdvisorAmbassadorMatching as act, finishAdvisorAmbassadorMatching as finish,
  advisorAmbassadorMatchingPlayer as player, advisorAmbassadorMatchingInventory as inventory,
} from './fixture-advisor-ambassador-matching';

const physical=(g:Game)=>g.players.map(p=>({id:p.id,forces:p.forces,reserves:p.reserves,tanks:p.tanks,
  spice:p.spice,moved:p.moved,shipped:p.shipped}));
const allowances=(g:Game)=>g.players.map(p=>({id:p.id,reserves:p.reserves,tanks:p.tanks,
  spice:p.spice,moved:p.moved,shipped:p.shipped}));
function allow(g:Game){
  const event=g.response?.advisorAmbassadorMatchingSource?.event;assert.ok(event);
  for(let count=0;g.response?.advisorAmbassadorMatchingSource?.event===event&&count<20;count++){
    const actor=g.players.find(p=>!g.response!.passed.includes(p.id));assert.ok(actor);
    g=act(g,actor.id,{type:'passResponse'});
  }
  assert.notEqual(g.response?.advisorAmbassadorMatchingSource?.event,event);return g;
}
function reject(g:Game,actor:string,action:Action){
  const before=structuredClone(g);assert.throws(()=>applyAction(g,actor,action));assert.deepEqual(g,before);
}
for(const direction of ['fightersToAdvisors','advisorsToFighters'] as const){
  void test(`native allied Fremen Ambassador ${direction} waits before relocation then commits its original arrival once`,()=>{
    const f=fixture({direction}),before=player(f.game,f.bg),target=f.destinationLocation.split(':')[0];
    const pending=act(f.game,f.bg,f.action);
    assert.equal(pending.response?.kind,'advisorFlip');assert.ok(pending.response?.advisorAmbassadorMatchingSource);
    assert.equal(pending.pendingAmbassador?.stage,'move');assert.notEqual(pending.active,f.bg);
    assert.deepEqual(physical(pending),physical(f.game));assert.deepEqual(pending.pendingAmbassador,f.originalParent);
    assert.deepEqual(physical(normalizeAutomaticGame(pending)),physical(f.game));
    const done=finish(allow(pending)),after=player(done,f.bg);
    assert.equal(after.forces[f.sourceLocation]??0,before.forces[f.sourceLocation]-1);
    assert.equal(after.forces[f.destinationLocation],before.forces[f.destinationLocation]+1);
    assert.equal(isAdvisor(after,target),direction==='fightersToAdvisors');
    assert.deepEqual(allowances(done),allowances(f.game));
    assert.ok(!done.pendingAmbassador);assert.equal(done.pendingAdvisorAmbassadorMatching,undefined);
    assert.equal(done.ecazAmbassadors!.tokens.find(t=>t.id===f.token)!.zone,'used');
    assert.equal(done.log.filter(l=>l.text.includes('through the Fremen Ambassador. Their ordinary')).length,1);
    assert.ok(player(done,f.holder).hand.some(c=>c.id===f.karama));
    assert.deepEqual(inventory(done),f.originalInventory);
  });
  void test(`native allied Fremen Ambassador ${direction} prevention retains grant and blocks only the same packet in this territory`,()=>{
    const f=fixture({direction}),pending=act(f.game,f.bg,f.action);
    const stopped=act(pending,f.holder,{type:'card',card:f.karama,mode:'cancel'});
    assert.equal(stopped.pendingAdvisorAmbassadorMatching,undefined);
    assert.equal(stopped.decision?.kind,'ecazAmbassador');assert.equal(stopped.decision?.player,f.bg);
    assert.equal(stopped.pendingAmbassador?.event,f.event);assert.equal(stopped.pendingAmbassador?.stage,'move');
    assert.deepEqual(physical(stopped),physical(f.game));assert.equal(stopped.discard.filter(c=>c.id===f.karama).length,1);
    reject(stopped,f.bg,f.action);
    reject(stopped,f.bg,{...f.action,fighters:true});
    const view=viewGame(stopped,f.bg);assert.equal(view.ambassadorEntry?.matchingDenied?.length,1);
    assert.ok(!('matchingDenied'in(viewGame(stopped,f.holder).ambassadorEntry??{})));
    const done=finish(act(stopped,f.bg,f.noMatch));
    assert.equal(player(done,f.bg).forces['polar_sink:0'],1);
    assert.deepEqual(allowances(done),allowances(f.game));assert.ok(!done.pendingAmbassador);
    assert.deepEqual(inventory(done),f.originalInventory);
  });
  void test(`native allied Fremen Ambassador ${direction} public counter omits original order and private continuation`,()=>{
    const f=fixture({direction}),pending=act(f.game,f.bg,f.action),view=viewGame(pending,f.holder);
    const source=view.response?.advisorAmbassadorMatchingSource;assert.ok(source);
    assert.deepEqual(Object.keys(source).sort(),['advisors','destination','event','group','origin','owner','parent','phase','sector','turn']);
    assert.equal(source.parent,f.event);assert.equal(source.owner,f.bg);
    assert.equal('pendingAdvisorAmbassadorMatching'in view,false);
    assert.equal(JSON.stringify(source).includes('signature'),false);
  });
  for(const level of DIFFICULTIES)void test(`${level} responds to native ${direction} matching and chooses a legal replacement after prevention`,()=>{
    const f=fixture({direction}),pending=act(f.game,f.bg,f.action),response=viewGame(pending,f.holder);
    response.players.find(p=>p.id===f.holder)!.bot=level;
    const answer=botActions(response)[0];assert.ok(answer);assert.doesNotThrow(()=>applyAction(pending,f.holder,answer));
    const stopped=act(pending,f.holder,{type:'card',card:f.karama,mode:'cancel'}),view=viewGame(stopped,f.bg);
    view.players.find(p=>p.id===f.bg)!.bot=level;
    const replacement=botActions(view)[0];assert.ok(replacement);assert.equal(replacement.type,'decision');
    assert.doesNotThrow(()=>applyAction(stopped,f.bg,replacement));
  });
}
void test('a different actual packet can match during the same native Ambassador grant after prevention',()=>{
  const f=fixture(),stopped=act(act(f.game,f.bg,f.action),f.holder,{type:'card',card:f.karama,mode:'cancel'});
  const replacement=act(stopped,f.bg,f.largerPacket),done=finish(replacement);
  assert.ok(!done.pendingAmbassador);assert.equal(done.pendingAdvisorAmbassadorMatching,undefined);
  assert.equal(player(done,f.bg).forces['arrakeen:10'],3);assert.equal(player(done,f.bg).forces['tueks_sietch:5']??0,0);
  assert.equal(isAdvisor(player(done,f.bg),'arrakeen'),true);assert.deepEqual(allowances(done),allowances(f.game));
  assert.equal(done.discard.filter(c=>c.id===f.karama).length,1);assert.deepEqual(inventory(done),f.originalInventory);
});
void test('an actual no-match Ambassador relocation creates no counter and retains the original Karama',()=>{
  const f=fixture(),done=finish(act(f.game,f.bg,f.noMatch));
  assert.ok(!done.response);assert.equal(done.pendingAdvisorAmbassadorMatching,undefined);
  assert.equal(player(done,f.bg).forces['polar_sink:0'],1);
  assert.ok(player(done,f.holder).hand.some(c=>c.id===f.karama));assert.deepEqual(allowances(done),allowances(f.game));
});
void test('a mismatched original Ambassador parent or selected order is rejected before cancellation cost',()=>{
  const f=fixture(),pending=act(f.game,f.bg,f.action);
  for(const field of ['signature','parentSignature'] as const){
    const changed=structuredClone(pending);changed.pendingAdvisorAmbassadorMatching![field]+='changed';
    reject(changed,f.holder,{type:'card',card:f.karama,mode:'cancel'});
    assert.ok(player(changed,f.holder).hand.some(c=>c.id===f.karama));
  }
});
