import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction,normalizeAutomaticGame,viewGame,type Action,type Game } from '../game/engine';
import { isAdvisor } from '../game/advisors';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { createSpiritualAdvisorFlowFixture as fixture,actSpiritualAdvisorFlow as act,
  spiritualAdvisorFlowPlayer as player,spiritualAdvisorFlowInventory as inventory,
  finishSpiritualAdvisorFlow as finish,advanceSpiritualAdvisorFlow as advance,
  spiritualAdvisorFlowClean as clean } from './fixture-spiritual-advisor-flow';

const physical=(g:Game)=>g.players.map(p=>({id:p.id,forces:p.forces,reserves:p.reserves,tanks:p.tanks,
  spice:p.spice,shipped:p.shipped,moved:p.moved}));
function stage(g:Game){
  const r=g.response;return r?.spiritualAdvisorSource?JSON.stringify([r.kind,r.spiritualAdvisorSource]):
    r?.automaticAdvisorFlip?.producer==='spiritualArrival'?JSON.stringify(r.automaticAdvisorFlip):null;
}
function allow(g:Game){
  const original=stage(g);assert.ok(original);
  for(let n=0;stage(g)===original&&n<30;n++){
    const actor=g.players.find(p=>!g.response!.passed.includes(p.id));assert.ok(actor);
    g=act(g,actor.id,{type:'passResponse'});
  }
  assert.notEqual(stage(g),original);return g;
}
function reject(g:Game,actor:string,action:Action){
  const before=structuredClone(g);assert.throws(()=>applyAction(g,actor,action));assert.deepEqual(g,before);
}
function cancel(g:Game,holder:string,card:string){return act(g,holder,{type:'card',card,mode:'cancel'});}

for(const parent of ['ordinary','ambassador'] as const){
  void test(`native ${parent} retained non-Polar fighters block accompaniment in source, projected choices and settlement`,()=>{
    const f=fixture({parent}),choices=viewGame(f.game,f.bg).spiritualAdvisorChoices;
    assert.ok(choices);assert.ok(choices.choices.filter(c=>c.accompany).every(c=>c.blocked));
    assert.ok(choices.choices.some(c=>!c.accompany&&!c.blocked));
    reject(f.game,f.bg,f.accompany);
    assert.equal(f.game.pendingSpiritualAdvisor,undefined);
  });
  void test(`native ${parent} shipping prevention preserves the original committed foreign shipment`,()=>{
    const f=fixture({parent}),pending=act(f.game,f.bg,f.sink);
    assert.equal(pending.response?.kind,'advisor');assert.ok(pending.response?.spiritualAdvisorSource);
    assert.equal(pending.pendingSpiritualAdvisor?.stage,'shipping');assert.deepEqual(physical(pending),physical(f.game));
    const done=finish(cancel(pending,f.holder,f.karama));
    assert.equal(done.pendingSpiritualAdvisor,undefined);assert.equal(player(done,f.bg).forces['polar_sink:0'],undefined);
    assert.deepEqual(physical(done),physical(f.game));assert.deepEqual(inventory(done),f.originalInventory);
    assert.equal(done.discard.filter(c=>c.id===f.karama).length,1);
  });
  for(const prevented of [false,true])void test(`native ${parent} empty Polar arrival ${prevented?'prevents':'allows'} its separate committed alone conversion`,()=>{
    const f=fixture({parent}),shipping=act(f.game,f.bg,f.sink),pending=allow(shipping);
    assert.equal(pending.response?.automaticAdvisorFlip?.producer,'spiritualArrival');
    assert.equal(pending.pendingSpiritualAdvisor?.stage,'arrival');assert.equal(player(pending,f.bg).forces['polar_sink:0'],1);
    assert.equal(player(pending,f.bg).reserves,player(f.game,f.bg).reserves-1);
    assert.equal(isAdvisor(player(pending,f.bg),'polar_sink'),true);
    assert.equal(pending.log.filter(l=>l.text.startsWith(player(pending,f.bg).name+' sent 1 free')).length,1);
    const committed=physical(pending);assert.deepEqual(physical(normalizeAutomaticGame(pending)),committed);
    const done=finish(prevented?cancel(pending,f.holder,f.karama):allow(pending));
    assert.equal(done.pendingSpiritualAdvisor,undefined);assert.equal(done.pendingAutomaticAdvisorFlips,undefined);
    assert.deepEqual(physical(done),committed);assert.equal(isAdvisor(player(done,f.bg),'polar_sink'),prevented);
    assert.equal(done.discard.filter(c=>c.id===f.karama).length,Number(prevented));
    assert.deepEqual(inventory(done),f.originalInventory);
  });
  void test(`native ${parent} accepted Intrusion permits same-type advisor accompaniment without another flip`,()=>{
    const f=fixture({parent,stance:'advisors'}),source=physical(f.game),pending=act(f.game,f.bg,f.accompany);
    assert.deepEqual(physical(pending),source);
    const done=finish(allow(pending));assert.equal(done.pendingSpiritualAdvisor,undefined);
    assert.equal(done.response?.kind==='advisorFlip',false);assert.equal(player(done,f.bg).forces[f.foreignLocation],2);
    assert.equal(isAdvisor(player(done,f.bg),f.foreignDestination),true);
    assert.equal(player(done,f.bg).reserves,player(f.game,f.bg).reserves-1);
    assert.ok(player(done,f.holder).hand.some(c=>c.id===f.karama));assert.deepEqual(inventory(done),f.originalInventory);
  });
  for(const prevented of [false,true])void test(`native ${parent} Polar fighter matching ${prevented?'restores the owned chooser':'commits the incoming fighter'} after distinct shipping allowance`,()=>{
    const f=fixture({parent,stance:'polarFighters'}),shipping=act(f.game,f.bg,f.sink),pending=allow(shipping);
    assert.equal(pending.response?.kind,'advisorFlip');assert.ok(pending.response?.spiritualAdvisorSource);
    assert.equal(pending.response?.automaticAdvisorFlip,undefined);assert.equal(pending.pendingSpiritualAdvisor?.stage,'matching');
    assert.deepEqual(physical(pending),physical(f.game));
    let done=prevented?cancel(pending,f.holder,f.karama):allow(pending);
    if(prevented){
      assert.equal(done.decision?.kind,'advisor');assert.equal(done.pendingSpiritualAdvisor?.stage,'offer');
      assert.deepEqual(physical(done),physical(f.game));reject(done,f.bg,f.sink);reject(done,f.bg,f.accompany);
      assert.ok(viewGame(done,f.bg).spiritualAdvisorChoices?.choices.every(c=>c.blocked));
      done=act(done,f.bg,f.decline);
    }else{
      assert.equal(player(done,f.bg).forces['polar_sink:0'],2);
      assert.equal(player(done,f.bg).reserves,player(f.game,f.bg).reserves-1);
      assert.equal(isAdvisor(player(done,f.bg),'polar_sink'),false);
    }
    done=finish(done);assert.equal(done.pendingSpiritualAdvisor,undefined);
    assert.equal(done.discard.filter(c=>c.id===f.karama).length,Number(prevented));assert.deepEqual(inventory(done),f.originalInventory);
  });
  void test(`native ${parent} changed original parent rejects before a shipping counter spends Karama`,()=>{
    const f=fixture({parent}),pending=act(f.game,f.bg,f.sink);
    pending.pendingSpiritualAdvisor!.signature='different-original-parent';
    reject(pending,f.holder,{type:'card',card:f.karama,mode:'cancel'});
    assert.ok(player(pending,f.holder).hand.some(c=>c.id===f.karama));
  });
  void test(`controlled ${parent} late retained-fighter change restores the legal chooser before any matching or placement`,()=>{
    const f=fixture({parent,stance:'advisors'}),pending=act(f.game,f.bg,f.accompany);
    // A controlled late stance change tests revalidation; it is not a native
    // earned action while this declared power is pending.
    delete player(pending,f.bg).advisors![f.foreignDestination];
    const before=physical(pending),done=allow(pending);
    assert.equal(done.decision?.kind,'advisor');assert.equal(done.pendingSpiritualAdvisor?.stage,'offer');
    assert.equal(done.response,null);assert.deepEqual(physical(done),before);
    assert.ok(viewGame(done,f.bg).spiritualAdvisorChoices?.choices.filter(c=>c.accompany).every(c=>c.blocked));
    assert.ok(player(done,f.holder).hand.some(c=>c.id===f.karama));
  });
}

void test('a second genuine foreign shipment joins the continuously-alone held advisor group without rearming conversion',()=>{
  const f=fixture(),shipping=act(f.game,f.bg,f.sink),pending=allow(shipping);
  let g=finish(cancel(pending,f.holder,f.karama));
  const held=player(g,f.bg).advisors?.polar_sink?.aloneFlipHold;assert.ok(held);
  g=act(g,f.holder,{type:'endMovement'});
  g=advance(g,state=>state.phase===5&&state.active===f.other&&clean(state));
  g=act(g,f.other,{type:'ship',territory:'carthag',sector:11,amount:1,elite:0,allyPayment:0});
  g=advance(g,state=>state.decision?.kind==='advisor');
  const before=player(g,f.bg).reserves;
  g=act(g,f.bg,f.sink);
  assert.equal(g.pendingSpiritualAdvisor,undefined);assert.equal(g.response?.automaticAdvisorFlip,undefined);
  assert.equal(player(g,f.bg).forces['polar_sink:0'],2);
  assert.equal(player(g,f.bg).reserves,before-1);
  assert.equal(player(g,f.bg).advisors?.polar_sink?.aloneFlipHold,held);
  assert.equal(isAdvisor(player(g,f.bg),'polar_sink'),true);assert.deepEqual(inventory(g),f.originalInventory);
});

void test('existing profiles choose projected legal targets and answer all applicable Spiritual layers',()=>{
  for(const parent of ['ordinary','ambassador'] as const)for(const stance of ['fighters','advisors','polarFighters'] as const)
    for(const profile of DIFFICULTIES){
      const f=fixture({parent,stance}),own=viewGame(f.game,f.bg);own.players.find(p=>p.id===f.bg)!.bot=profile;
      const choices=botActions(own);assert.ok(choices.length);const shipping=act(f.game,f.bg,choices[0]);
      assert.ok(shipping.response?.spiritualAdvisorSource);
      const counter=viewGame(shipping,f.holder);counter.players.find(p=>p.id===f.holder)!.bot=profile;
      const answers=botActions(counter);assert.ok(answers.length);assert.doesNotThrow(()=>act(shipping,f.holder,answers[0]));
      const next=allow(shipping);
      if(stage(next)){
        const reply=viewGame(next,f.holder);reply.players.find(p=>p.id===f.holder)!.bot=profile;
        const actions=botActions(reply);assert.ok(actions.length);assert.doesNotThrow(()=>act(next,f.holder,actions[0]));
      }
      if(stance==='polarFighters'){
        const restored=cancel(next,f.holder,f.karama),view=viewGame(restored,f.bg);view.players.find(p=>p.id===f.bg)!.bot=profile;
        const alternatives=botActions(view);assert.ok(alternatives.length);assert.doesNotThrow(()=>act(restored,f.bg,alternatives[0]));
      }
    }
});
