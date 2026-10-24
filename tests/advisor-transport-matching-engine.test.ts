import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, normalizeAutomaticGame, viewGame, type Game, type Action } from '../game/engine';
import { isAdvisor } from '../game/advisors';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { guildTransportQuote } from '../game/transport-quote';
import { junctionTransportChoice } from '../game/junction-transport-options';
import { createAdvisorTransportMatchingFixture as fixture,actAdvisorTransportMatching as act,
  finishAdvisorTransportMatching as finish,advisorTransportMatchingPlayer as player,
  advisorTransportMatchingInventory as inventory } from './fixture-advisor-transport-matching';
import { createAdvisorSecretTransportMatchingFixture as secretFixture } from './fixture-advisor-secret-transport-matching';
import { placeFixtureHand } from './fixture-hand';

const physical=(g:Game)=>g.players.map(p=>({id:p.id,forces:p.forces,advisors:p.advisors,
  reserves:p.reserves,tanks:p.tanks,spice:p.spice,moved:p.moved,shipped:p.shipped}));
function layer(g:Game){const r=g.response;return r?JSON.stringify([r.kind,r.advisorTransportMatchingSource?.event,r.guildTransportEvent,r.guildRateEvent]):null;}
function allow(g:Game){const original=layer(g);assert.ok(original);
  for(let count=0;layer(g)===original&&count<30;count++){
    const actor=g.players.find(p=>!g.response!.passed.includes(p.id));assert.ok(actor);g=act(g,actor.id,{type:'passResponse'});
  }
  assert.notEqual(layer(g),original);return g;
}
function complete(g:Game){
  for(let count=0;g.response&&(g.response.advisorTransportMatchingSource||
    ['guildTransportPermission','guildRate'].includes(g.response.kind))&&count<5;count++)g=allow(g);
  return finish(g);
}
function reject(g:Game,actor:string,action:Action){const before=structuredClone(g);assert.throws(()=>applyAction(g,actor,action));assert.deepEqual(g,before);}
const scenarios=[
  ['guild-fighters',()=>fixture()],['guild-advisors',()=>fixture({direction:'advisorsToFighters'})],
  ['junction-fighters',()=>fixture({kind:'junctionBoard'})],['junction-advisors',()=>fixture({kind:'junctionBoard',direction:'advisorsToFighters'})],
  ['junction-world',()=>fixture({kind:'junctionWorld'})],
  ['secret-fighters',()=>secretFixture()],['secret-advisors',()=>secretFixture({direction:'advisorsToFighters'})],
] as const;
for(const [name,create]of scenarios){
  void test(`native ${name} matching waits before payment or transfer and resumes the original transport once`,()=>{
    const f=create(),pending=act(f.game,f.bg,f.action),source=pending.response?.advisorTransportMatchingSource;assert.ok(source);
    assert.deepEqual(physical(pending),physical(f.game));assert.deepEqual(physical(normalizeAutomaticGame(pending)),physical(f.game));
    assert.ok(!pending.pendingGuildTransport);assert.equal(player(pending,f.bg).shipped,false);
    assert.deepEqual(pending.junctionOffer,f.game.junctionOffer);
    const next=allow(pending);assert.equal(next.pendingAdvisorTransportMatching,undefined);
    if(name.startsWith('guild')){assert.equal(next.response?.kind,'guildTransportPermission');assert.deepEqual(physical(next),physical(f.game));}
    const done=complete(next),owner=player(done,f.bg);
    assert.equal(owner.forces[f.destinationLocation],player(f.game,f.bg).forces[f.destinationLocation]+1);
    if(f.sourceLocation.startsWith('homeworld:'))assert.equal(owner.reserves,player(f.game,f.bg).reserves-1);
    else assert.equal(owner.forces[f.sourceLocation]??0,player(f.game,f.bg).forces[f.sourceLocation]-1);
    assert.equal(owner.spice,player(f.game,f.bg).spice-f.cost);assert.equal(owner.moved,player(f.game,f.bg).moved);assert.equal(owner.shipped,true);
    assert.equal(isAdvisor(owner,source.destination),source.advisors);assert.equal(done.pendingAdvisorTransportMatching,undefined);
    assert.ok(player(done,f.holder).hand.some(c=>c.id===f.karama));assert.deepEqual(inventory(done),f.originalInventory);
    if(name.startsWith('secret'))assert.equal(done.nexusGuildSecretHistory?.length,1);
  });
  void test(`native ${name} prevention retains original entitlement and blocks a repeated packet while allowing a real replacement`,()=>{
    const f=create(),pending=act(f.game,f.bg,f.action),stopped=act(pending,f.holder,{type:'card',card:f.karama,mode:'cancel'});
    assert.deepEqual(physical(stopped),physical(f.game));assert.equal(stopped.pendingAdvisorTransportMatching,undefined);
    assert.deepEqual(stopped.junctionOffer,f.game.junctionOffer);assert.equal(stopped.nexusGuildSecretHistory?.length??0,0);
    if(name.startsWith('secret'))assert.equal(stopped.nexusCards?.cards?.hands[f.bg],'guild');
    reject(stopped,f.bg,f.action);
    const view=viewGame(stopped,f.bg);assert.equal(view.advisorTransportMatchingDenied?.length,1);
    assert.equal(viewGame(stopped,f.holder).advisorTransportMatchingDenied,undefined);
    if(f.action.type==='guildShip')assert.ok(guildTransportQuote(view,f.action).unavailableReasons.some(reason=>/prevented/.test(reason)));
    else assert.match(junctionTransportChoice(view,String(f.action.destination),f.action.sources as Record<string,{normal:number;elite:number}>).blocked??'',/prevented/);
    const done=complete(act(stopped,f.bg,f.noMatch));
    const replacementLocation=f.noMatch.type==='guildShip'?`${String(f.noMatch.territory)}:${Number(f.noMatch.sector)}`:String(f.noMatch.destination);
    assert.equal(player(done,f.bg).forces[replacementLocation],1);
    assert.equal(player(done,f.bg).spice,player(f.game,f.bg).spice-f.cost);assert.equal(player(done,f.bg).shipped,true);
    assert.equal(done.discard.filter(c=>c.id===f.karama).length,1);assert.deepEqual(inventory(done),f.originalInventory);
    if(name.startsWith('secret'))assert.equal(done.nexusGuildSecretHistory?.length,1);
  });
  void test(`native ${name} counter exposes only ten physical source fields`,()=>{
    const f=create(),pending=act(f.game,f.bg,f.action),view=viewGame(pending,f.holder),source=view.response?.advisorTransportMatchingSource;assert.ok(source);
    assert.deepEqual(Object.keys(source).sort(),['advisors','destination','event','group','origin','owner','phase','producer','sector','turn']);
    assert.equal('pendingAdvisorTransportMatching'in view,false);assert.equal(JSON.stringify(source).includes('opportunity'),false);
  });
}
for(const [name,create]of scenarios.filter(([name])=>!name.endsWith('advisors'))){
  void test(`native ${name} admits a different actual matching packet in the original unused opportunity`,()=>{
    const f=create(),stopped=act(act(f.game,f.bg,f.action),f.holder,{type:'card',card:f.karama,mode:'cancel'});
    const done=complete(act(stopped,f.bg,f.largerPacket));
    assert.equal(player(done,f.bg).forces['arrakeen:10'],3);assert.equal(player(done,f.bg).shipped,true);
    assert.equal(done.discard.filter(c=>c.id===f.karama).length,1);assert.deepEqual(inventory(done),f.originalInventory);
  });
  for(const profile of DIFFICULTIES)void test(`${profile} handles native ${name} matching and a legal replacement`,()=>{
    const f=create(),pending=act(f.game,f.bg,f.action),view=viewGame(pending,f.holder);view.players.find(p=>p.id===f.holder)!.bot=profile;
    const answer=botActions(view)[0];assert.ok(answer);assert.doesNotThrow(()=>applyAction(pending,f.holder,answer));
    const stopped=act(pending,f.holder,{type:'card',card:f.karama,mode:'cancel'}),replacementView=viewGame(stopped,f.bg);
    replacementView.players.find(p=>p.id===f.bg)!.bot=profile;
    const replacement=botActions(replacementView)[0];assert.ok(replacement);assert.doesNotThrow(()=>applyAction(stopped,f.bg,replacement));
  });
}
void test('allowed matching retains the separate original Guild permission counter',()=>{
  const f=fixture(),permission=allow(act(f.game,f.bg,f.action));assert.equal(permission.response?.kind,'guildTransportPermission');
  const denied=act(permission,f.holder,{type:'card',card:f.karama,mode:'cancel'});
  assert.deepEqual(physical(denied),physical(f.game));assert.equal(denied.pendingAdvisorTransportMatching,undefined);
  assert.equal(viewGame(denied,f.bg).guildTransportCanceled,true);
});
void test('allowed matching and permission retain original full-rate cancellation when funding cannot complete',()=>{
  const f=fixture({direction:'advisorsToFighters'}),rate=allow(allow(act(f.game,f.bg,f.action)));assert.equal(rate.response?.kind,'guildRate');
  const denied=act(rate,f.holder,{type:'card',card:f.karama,mode:'cancel'});
  assert.deepEqual(physical(denied),physical(f.game));assert.equal(denied.pendingAdvisorTransportMatching,undefined);
  assert.equal(denied.guildRateBlocked?.player,f.bg);assert.equal(player(denied,f.bg).shipped,false);
});
void test('private original intent and opportunity mismatches fail before cancellation cost',()=>{
  const f=fixture(),pending=act(f.game,f.bg,f.action);
  for(const field of ['signature','opportunity'] as const){const changed=structuredClone(pending);changed.pendingAdvisorTransportMatching![field]+='changed';
    reject(changed,f.holder,{type:'card',card:f.karama,mode:'cancel'});assert.ok(player(changed,f.holder).hand.some(c=>c.id===f.karama));}
});
for(const [name,create]of [['junction',()=>fixture({kind:'junctionWorld'})],['secret',()=>secretFixture()]] as const)
void test(`controlled ${name} Truthtrance overlay preserves the already-declared matching response and real priority`,()=>{
  const f=create(),staged=structuredClone(f.game),truth=staged.deck.find(c=>c.effect==='truthtrance');assert.ok(truth);
  // Controlled card custody only: relocate an original physical card, preserving
  // the earned native grant/forces/alliance. This is not an earned card draw.
  const owner=player(staged,f.bg);assert.ok(owner.hand.length<4);
  placeFixtureHand(staged,staged.players.findIndex(p=>p.id===f.bg),[...owner.hand,truth]);
  const pending=act(staged,f.bg,f.action),receipt=structuredClone(pending.response);
  let g=act(pending,f.bg,{type:'card',card:truth.id});assert.ok(g.truthtrance);
  assert.deepEqual(viewGame(g,f.bg).response,viewGame(pending,f.bg).response);
  reject(g,f.holder,{type:'passResponse'});
  for(let count=0;g.truthtrance?.stage==='priority'&&count<10;count++){
    const actor=g.players.find(p=>!g.truthtrance!.passed.includes(p.id));assert.ok(actor);g=act(g,actor.id,{type:'truthPass'});
  }
  g=act(g,f.bg,{type:'truthAsk',question:{kind:'fact',target:f.holder,fact:{kind:'hand',name:'Karama'}}});
  g=act(g,f.holder,{type:'truthAnswer',answer:'yes'});assert.ok(!g.truthtrance);assert.deepEqual(g.response,receipt);
  const stopped=act(g,f.holder,{type:'card',card:f.karama,mode:'cancel'});
  assert.deepEqual(physical(stopped),physical(f.game));assert.equal(stopped.pendingAdvisorTransportMatching,undefined);
  assert.deepEqual(inventory(stopped),f.originalInventory);
});
