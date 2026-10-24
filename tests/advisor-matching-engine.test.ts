import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, normalizeAutomaticGame, viewGame, type Action, type Game } from '../game/engine';
import { isAdvisor } from '../game/advisors';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import {
  createAdvisorMatchingMoveFixture, createAdvisorMatchingShipmentFixture,
  actAdvisorMatchingMove as act, advisorMatchingMovePlayer as player,
  advisorMatchingMoveInventory as inventory, commitAdvisorMatchingMove as commit,
} from './fixture-advisor-matching-move';

const fixtures=[
  ['advisor-to-fighter',()=>createAdvisorMatchingMoveFixture()],
  ['fighter-to-advisor',()=>createAdvisorMatchingMoveFixture({direction:'fightersToAdvisors'})],
  ['reserve-to-advisor',()=>createAdvisorMatchingShipmentFixture()],
] as const;
const physical=(g:Game)=>g.players.map(p=>({id:p.id,forces:p.forces,reserves:p.reserves,
  tanks:p.tanks,spice:p.spice,advisors:p.advisors,shipped:p.shipped,moved:p.moved}));
function allow(g:Game){
  for(let n=0;g.response?.advisorMatchingSource&&n<30;n++){
    const actor=g.players.find(p=>!g.response!.passed.includes(p.id));assert.ok(actor);
    g=act(g,actor.id,{type:'passResponse'});
  }
  assert.ok(!g.response?.advisorMatchingSource);return g;
}
function rejected(g:Game,actor:string,action:Action){
  const before=structuredClone(g);assert.throws(()=>applyAction(g,actor,action));assert.deepEqual(g,before);
}
for(const [kind,fixture] of fixtures)for(const canceled of [false,true]){
  void test(`native ${kind} matching ${canceled?'prevention':'allowance'} preserves residents and commits only an allowed incoming packet`,()=>{
    const f=fixture(),before=structuredClone(f.game),pending=commit(f.game,f).game;
    const source=pending.response?.advisorMatchingSource;assert.ok(source);
    assert.equal(source.owner,f.bg);assert.equal(source.destination,f.destination);
    assert.equal(source.advisors,kind!=='advisor-to-fighter');
    assert.deepEqual(physical(pending),physical(before),'The matching response must precede transfer/payment/use.');
    assert.deepEqual(physical(normalizeAutomaticGame(pending)),physical(before));
    assert.ok(viewGame(pending,f.holder).responseControls?.cancelCards.includes(f.karama));
    assert.ok(!JSON.stringify(viewGame(pending,f.holder).response).includes('order'));
    assert.deepEqual(f.game,before);
    let done=canceled?act(pending,f.holder,{type:'card',card:f.karama,mode:'cancel'}):allow(pending);
    assert.equal(done.pendingAdvisorMatching,undefined);assert.equal(done.response?.advisorMatchingSource,undefined);
    assert.equal(done.discard.filter(c=>c.id===f.karama).length,Number(canceled));
    assert.deepEqual(inventory(done),f.originalInventory);
    if(canceled){
      assert.deepEqual(physical(done),physical(before));assert.equal(done.advisorMatchingDenied?.length,1);
      rejected(done,f.bg,f.action);
      if(kind==='advisor-to-fighter') rejected(done,f.bg,{...f.action,sector:10});
      done=act(done,f.bg,kind==='reserve-to-advisor'
        ? {type:'ship',territory:'imperial_basin',sector:9,amount:1,elite:0,allyPayment:0}
        : f.ordinaryAction);
      assert.equal(done.pendingAdvisorMatching,undefined);
      assert.equal(player(done,f.bg).moved,kind==='reserve-to-advisor'?0:1);
      assert.equal(player(done,f.bg).shipped,true);
    }else{
      assert.equal(player(done,f.bg).forces[f.destinationLocation],2);
      assert.equal(isAdvisor(player(done,f.bg),f.destination),source.advisors);
      if(kind==='reserve-to-advisor'){
        assert.equal(player(done,f.bg).reserves,player(before,f.bg).reserves-1);
        assert.equal(player(done,f.bg).spice,player(before,f.bg).spice-1);
        assert.equal(player(done,f.bg).shipped,true);assert.equal(player(done,f.bg).moved,0);
      }else{
        assert.equal(player(done,f.bg).forces[f.sourceLocation],undefined);
        assert.equal(player(done,f.bg).moved,1);
        assert.equal(player(done,f.bg).spice,player(before,f.bg).spice);
      }
    }
  });
}

void test('an earned same-type fighter sector reposition creates no matching counter',()=>{
  const f=createAdvisorMatchingMoveFixture(),g=act(f.game,f.bg,f.ordinaryAction);
  assert.equal(g.pendingAdvisorMatching,undefined);assert.equal(g.response?.advisorMatchingSource,undefined);
  assert.equal(player(g,f.bg).forces['imperial_basin:10'],1);
  assert.equal(player(g,f.bg).moved,1);assert.ok(player(g,f.holder).hand.some(c=>c.id===f.karama));
});

for(const [kind,fixture] of fixtures)void test(`${kind} mismatched private arrival rejects before a matching counter spends Karama`,()=>{
  const f=fixture(),g=commit(f.game,f).game;
  g.pendingAdvisorMatching!.signature='different-uncommitted-order';
  rejected(g,f.holder,{type:'card',card:f.karama,mode:'cancel'});
  assert.ok(player(g,f.holder).hand.some(c=>c.id===f.karama));
});

void test('all existing profiles can answer matching counters and choose a legal replacement after prevention',()=>{
  for(const [,fixture] of fixtures)for(const profile of DIFFICULTIES){
    const f=fixture(),pending=commit(f.game,f).game,own=viewGame(pending,f.holder);
    own.players.find(p=>p.id===f.holder)!.bot=profile;
    const response=botActions(own);assert.ok(response.length);
    assert.doesNotThrow(()=>allow(act(pending,f.holder,response[0])));
    const canceled=act(pending,f.holder,{type:'card',card:f.karama,mode:'cancel'}),bg=viewGame(canceled,f.bg);
    bg.players.find(p=>p.id===f.bg)!.bot=profile;
    const replacement=botActions(bg);assert.ok(replacement.length);
    assert.doesNotThrow(()=>act(canceled,f.bg,replacement[0]));
  }
});
