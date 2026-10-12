import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction,viewGame,type Action,type Game} from '../game/engine';
import {botActions} from '../game/bots';
import {choamPowerAction,choamPowerPlays} from '../game/choam-power-options';
import {CHOAM_NEXUS_EFFECTS} from '../game/nexus-choam';
import {createSemutaNexusCunningProactive,createSemutaNexusCunningStart,gamePlayer,holdSemutaNexusCunningCard,reactSemutaNexusCunning,semutaNexusCunningInventory,type SemutaNexusCunningFixture} from './fixture-semuta-nexus-cunning';
import {createSemutaNexusCunningReactive,quoteSemutaNexusCunningReactive} from './fixture-semuta-nexus-cunning-reactive';

type Effect='kulon'|'gamont'|'baliset'|'laLaLa'|'jubba';
function fixture(effect:Effect,printed=false){
 const options={advanced:true,fullHand:true,skills:effect==='gamont',tech:effect==='gamont',strongholds:effect==='gamont'};
 let game:Game, action:Action, source:SemutaNexusCunningFixture, selection:Record<string,unknown>;
 if(effect==='kulon'||effect==='gamont'){
  const f=createSemutaNexusCunningProactive(effect,{...options,elite:effect==='gamont'});
  game=f.game;action=f.action;source=f;selection=f.selection;
 }else{
  const f=createSemutaNexusCunningReactive(effect,{start:createSemutaNexusCunningStart(options),karama:true});
  game=f.game;action=quoteSemutaNexusCunningReactive(game,f);source=f.start;selection=f.selection;
 }
 let fuel=source.cost;
 if(printed){
  fuel=holdSemutaNexusCunningCard(game,source.owner,c=>c.kind==='worthless'&&c.name===CHOAM_NEXUS_EFFECTS[effect],source.staging);
  const view=viewGame(game,source.owner);
  const play=choamPowerPlays(view,effect).find(p=>p.source==='printed'&&p.card.id===fuel.id);
  assert.ok(play);
  const selected=choamPowerAction(view,play,selection);assert.ok(selected);action=selected;
 }
 const karama=gamePlayer(game,source.other).hand.find(c=>c.effect==='karama');assert.ok(karama);
 return {game,action,source,fuel,karama:karama.id,cancel:{type:'card',mode:'cancel',card:karama.id},printed};
}
function originalOutcome(game:Game){
 return {
  phase:game.phase,turn:game.turn,active:game.active,ready:game.ready,
  decision:game.decision,response:game.response,pendingMove:game.pendingChoamMove,pendingRevival:game.pendingRevival,
  storm:game.storm,stormResolution:game.stormResolution,blocked:game.choamWorthlessBlocked,
  range:game.choamMovement,restrictions:game.choamBaliset,revivalRules:game.revivalRules,mentat:game.choamMentatPending,
  players:game.players.map(p=>({id:p.id,spice:p.spice,forces:p.forces,reserves:p.reserves,tanks:p.tanks,elites:p.elites,moved:p.moved,revived:p.revived,free:p.freeForcesRevived})),
 };
}
for(const effect of ['kulon','gamont','baliset','laLaLa','jubba'] as const)void test(`Semuta claims or passes printed Karama before original Cunning ${effect} cancellation and one native suffix`,()=>{
 const f=fixture(effect), beforeWallets=f.game.players.map(p=>p.spice), cards=semutaNexusCunningInventory(f.game);
 const declared=applyAction(f.game,f.source.owner,f.action);
 const ordinary=structuredClone(declared);delete ordinary.semutaPreview;
 const baseline=applyAction(ordinary,f.source.other,f.cancel);
 const pending=applyAction(declared,f.source.other,f.cancel);
 const entry=pending.pendingTreacheryDiscard!.batch.entries[0];
 assert.equal(entry.card.id,f.karama);assert.equal(entry.card.effect,'karama');assert.equal(entry.publicFace,true);assert.equal(entry.discardedBy,f.source.other);
 assert.equal(pending.nexusChoamHistory!.at(-1)!.stage,'pending');
 assert.ok(gamePlayer(pending,f.source.owner).hand.some(c=>c.id===f.fuel.id));
 assert.ok(!pending.discard.some(c=>c.id===f.fuel.id));
 assert.equal(viewGame(pending,f.source.holder).semutaReaction!.canCommit,true);
 assert.throws(()=>applyAction(pending,f.source.owner,{type:'decision',decline:true}));
 for(const claim of [false,true]){
  const done=reactSemutaNexusCunning(pending,f.source,claim);
  assert.deepEqual(originalOutcome(done),originalOutcome(baseline));
  assert.equal(done.nexusChoamHistory!.at(-1)!.stage,'canceled');
  assert.equal(done.nexusCards!.cards!.hands[f.source.owner],null);
  assert.equal(done.nexusCards!.cards!.discard.filter(c=>c==='choam').length,1);
  assert.ok(gamePlayer(done,f.source.owner).hand.some(c=>c.id===f.fuel.id));
  assert.equal(gamePlayer(done,f.source.holder).hand.length,4);
  assert.equal(gamePlayer(done,f.source.holder).hand.some(c=>c.id===f.karama),claim);
  assert.equal(gamePlayer(done,f.source.holder).hand.some(c=>c.id===f.source.semuta),!claim);
  assert.equal(done.discard.filter(c=>c.id===f.karama).length,Number(!claim));
  assert.deepEqual(semutaNexusCunningInventory(done),cards);
  assert.deepEqual(done.players.map(p=>p.spice),baseline.players.map(p=>p.spice));
  assert.throws(()=>applyAction(done,f.source.other,f.cancel));
  assert.throws(()=>applyAction(done,f.source.holder,{type:'semutaCommit',event:pending.pendingTreacheryDiscard!.batch.event}));
 }
 assert.deepEqual(pending.players.map(p=>p.spice),beforeWallets,'Only the printed cost is committed before the native suffix');
});
for(const effect of ['kulon','jubba'] as const)void test(`Printed ${effect} retains its named fuel and held Nexus while cancellation Karama reacts`,()=>{
 const f=fixture(effect,true), declared=applyAction(f.game,f.source.owner,f.action);
 const ordinary=structuredClone(declared);delete ordinary.semutaPreview;
 const baseline=applyAction(ordinary,f.source.other,f.cancel), pending=applyAction(declared,f.source.other,f.cancel);
 const done=reactSemutaNexusCunning(pending,f.source,true);
 assert.deepEqual(originalOutcome(done),originalOutcome(baseline));
 assert.equal(done.nexusCards!.cards!.hands[f.source.owner],'choam');
 assert.ok(gamePlayer(done,f.source.owner).hand.some(c=>c.id===f.fuel.id));
 assert.ok(gamePlayer(done,f.source.holder).hand.some(c=>c.id===f.karama));
 assert.ok(!done.discard.some(c=>c.id===f.fuel.id));
 assert.deepEqual(semutaNexusCunningInventory(done),semutaNexusCunningInventory(f.game));
});
void test('All four legal Semuta profiles finish the printed native cancellation cost without claiming retained Cunning fuel',()=>{
 const f=fixture('baliset'), pending=applyAction(applyAction(f.game,f.source.owner,f.action),f.source.other,f.cancel);
 for(const difficulty of ['Easy','Medium','Hard','Brutal'] as const){
  const own=viewGame(pending,f.source.holder);own.players.find(p=>p.id===f.source.holder)!.bot=difficulty;
  const action=botActions(own)[0];assert.equal(action.type,'semutaCommit');
  const done=applyAction(pending,f.source.holder,action);
  assert.ok(gamePlayer(done,f.source.holder).hand.some(c=>c.id===f.karama));
  assert.ok(gamePlayer(done,f.source.owner).hand.some(c=>c.id===f.fuel.id));
  assert.equal(done.nexusChoamHistory!.at(-1)!.stage,'canceled');
  assert.equal(gamePlayer(done,f.source.target).moved,1);
  assert.deepEqual(semutaNexusCunningInventory(done),semutaNexusCunningInventory(f.game));
 }
});
