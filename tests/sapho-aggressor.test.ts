import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction,viewGame,normalizeAutomaticGame,type Game,type Action} from '../game/engine';
import {botActions} from '../game/bots';
import {DIFFICULTIES} from '../game/bot-profiles';
import {createStrongholdCards} from '../game/stronghold-cards';
import {territory} from '../game/board';
import {saphoBattleCustody,takeSaphoBattleCard,SAPHO_BATTLE_CARD} from './fixture-sapho-battle-order';
import {saphoAggressorGame,aggressorAction,prepareAggressorPlans,revealEqualAggressorPlans,finishAggressorBattle} from './fixture-sapho-aggressor';
function reject(g:Game,id:string,action:Action){const before=JSON.stringify(g);assert.throws(()=>applyAction(g,id,action));assert.equal(JSON.stringify(g),before);}
const restore=(g:Game)=>{const next=JSON.parse(JSON.stringify(g)) as Game; for(const p of g.players) assert.deepEqual(viewGame(next,p.id),viewGame(g,p.id));saphoBattleCustody(next);return next;};
void test('Sapho changes actual ordinary and Stone ties in both modes without swapping physical slots or chooser',()=>{
 for(const advanced of [false,true]) for(const stone of [false,true]) {
  let g=saphoAggressorGame({advanced}); const original=structuredClone(g.battle!); const order=[...g.order];
  if(stone) takeSaphoBattleCard(g,'a','richese-stone-burner');
  const action=aggressorAction(g); const before=JSON.stringify(g);
  g=applyAction(g,'b',action); assert.notEqual(JSON.stringify(g),before);
  assert.equal(g.battle!.attacker,original.attacker);assert.equal(g.battle!.defender,original.defender);assert.equal(g.battle!.chooser,original.chooser);assert.deepEqual(g.order,order);
  for(const p of g.players){const view=viewGame(g,p.id);assert.equal(view.battle!.aggressor,'b');assert.equal(view.battle!.tieWinner,'b');assert.equal(view.players.find(q=>q.id!=='r'&&q.id!==p.id)!.hand,undefined);}
  assert.equal(g.discard.filter(c=>c.id===SAPHO_BATTLE_CARD).length,1);reject(g,'b',action);g=restore(g);
  g=revealEqualAggressorPlans(g,stone?'a':undefined); g=restore(g);g=finishAggressorBattle(g);
  assert.equal(g.lastBattleContext!.winner,'b');assert.equal(g.lastBattleContext!.event,original.event);saphoBattleCustody(g);
 }
});
void test('Habbanya takes precedence in either stable slot despite an opposing Sapho aggressor',()=>{
 for(const owner of ['a','b']) {
  let g=saphoAggressorGame({advanced:true});g.battle!.territory='habbanya_ridge_sietch';
  for(const p of g.players.slice(0,2)){p.forces={[`habbanya_ridge_sietch:${territory('habbanya_ridge_sietch').sectors[0]}`]:4};}
  g.strongholdCards=createStrongholdCards();g.strongholdCards.claimedTurn=1;g.strongholdCards.owners.habbanya_ridge_sietch=owner;
  g=applyAction(g,'b',aggressorAction(g));assert.equal(viewGame(g,'a').battle!.aggressor,'b');assert.equal(viewGame(g,'a').battle!.tieWinner,owner);
  g=finishAggressorBattle(revealEqualAggressorPlans(g));assert.equal(g.lastBattleContext!.winner,owner);
 }
});
void test('early scope excludes noncombatants, readiness, later commitments and stale actions without writes',()=>{
 const opening=saphoAggressorGame();const action=aggressorAction(opening);
 reject(opening,'r',action);reject(opening,'a',action);reject(opening,'b',{...action,event:'old'});reject(opening,'b',{...action,mode:'last'});reject(opening,'b',{...action,extra:true});
 const ready=applyAction(opening,'b',{type:'battlePreparationReady',event:opening.battle!.event});assert.deepEqual(viewGame(ready,'b').saphoOptions,[]);reject(ready,'b',action);
 const planned=prepareAggressorPlans(opening);assert.deepEqual(viewGame(planned,'b').saphoOptions,[]);reject(planned,'b',action);
 const revealed=revealEqualAggressorPlans(opening);reject(revealed,'b',action);
 for(const field of ['voice','prescience','nexusInspection','fullPlan','truthPromises'] as const){const g=structuredClone(opening);Object.assign(g.battle!,{[field]:field==='truthPromises'?[{}]:{}});assert.throws(()=>applyAction(g,'b',action));}
 const earlier=applyAction(opening,'a',{type:'battlePreparationReady',event:opening.battle!.event});assert.ok(aggressorAction(earlier));
});
void test('saved receipts fail closed and legitimate recovered-card reuse has a fresh opportunity',()=>{
 let g=saphoAggressorGame();const first=aggressorAction(g);g=applyAction(g,'b',first);
 for(const mutate of [(x:Game)=>{delete x.battle!.saphoAggressor;},(x:Game)=>{delete x.battle!.saphoAggressorEvents;},(x:Game)=>{x.battle!.saphoAggressor!.turn++;},(x:Game)=>{x.battle!.saphoAggressor!.uses[0].player='a';},(x:Game)=>{x.battle!.saphoAggressorEvents![0]='old';},(x:Game)=>{x.discard=x.discard.filter(c=>c.id!==SAPHO_BATTLE_CARD);}] ) {
  const bad=structuredClone(g);mutate(bad);const before=JSON.stringify(bad);assert.throws(()=>viewGame(bad,'b'));assert.throws(()=>normalizeAutomaticGame(bad));assert.throws(()=>applyAction(bad,'b',{type:'ready'}));assert.equal(JSON.stringify(bad),before);
 }
 // A conserved relocation models later legal recovery without claiming the recovery action itself.
 takeSaphoBattleCard(g,'a');const second=aggressorAction(g,'a');assert.notEqual(second.event,first.event);reject(g,'a',{...second,event:first.event});
 g=applyAction(g,'a',second);assert.equal(viewGame(restore(g),'b').battle!.aggressor,'a');assert.equal(g.battle!.saphoAggressor!.uses.length,2);saphoBattleCustody(g);
});
void test('an unchosen allied Prescience prompt allows early Sapho but an actual inspection closes that scope',()=>{
 const g=saphoAggressorGame({},g=>{g.players[1].ally='c';g.players[2].ally='b';});
 const action=aggressorAction(g);assert.equal(g.battle!.preparation?.kind,'prescience');
 const inspecting=normalizeAutomaticGame(applyAction(g,'c',{type:'prescience',field:'weapon'}));
 assert.equal(inspecting.battle!.preparation?.kind,'prescienceAnswer');
 assert.equal(inspecting.battle!.preLeader!.closed,false);
 assert.deepEqual(viewGame(inspecting,'b').saphoOptions,[]);reject(inspecting,'b',action);
});
void test('early priority feeds Stone pre-commit finishability before any hidden opposing plan exists',()=>{
 const initial=saphoAggressorGame({advanced:true,holder:'a'},g=>{
  g.order=['b','a','c','r'];g.active='b';
  const a=g.players[0],b=g.players[1];a.forces={'carthag:11':2};a.reserves=18;
  a.elites!.forces={'carthag:11':1};a.elites!.reserves=4;
  b.forces={'carthag:11':1};b.reserves=19;takeSaphoBattleCard(g,'b','richese-stone-burner');
 });
 assert.equal(initial.battle!.attacker,'b');
 const plan={type:'battlePlan',dial:0,support:0,leader:initial.players[1].leaders[0].id,weapon:'richese-stone-burner'};
 // Original Guild tie priority makes every opposing allocation finishable.
 assert.doesNotThrow(()=>applyAction(prepareAggressorPlans(initial),'b',plan));
 let changed=applyAction(initial,'a',aggressorAction(initial,'a'));
 changed=prepareAggressorPlans(changed);assert.equal(viewGame(changed,'b').battle!.tieWinner,'a');
 // The Emperor's possible mixed allocation now spans both sides of the tie.
 // Reject the Stone commitment before seeing or accepting an opposing plan.
 reject(changed,'b',plan);assert.equal(Object.keys(changed.battle!.plans).length,0);
});
void test('rival private cards and spice never affect the early option or AI, and every profile completes the battle',()=>{
 for(const advanced of [false,true]) for(const level of DIFFICULTIES){
  let g=saphoAggressorGame({advanced});const original=viewGame(g,'b');const expected=original.saphoOptions;
  const changed=structuredClone(g);changed.players[0].spice=0;takeSaphoBattleCard(changed,'a','richese-stone-burner');assert.deepEqual(viewGame(changed,'b').saphoOptions,expected);
  const view=viewGame(g,'b');view.players.find(p=>p.id==='b')!.bot=level;
  const actions=botActions(view);assert.equal(actions[0].scope,'battleAggressor');
  for(const p of view.players.filter(p=>p.id!=='b'))for(const key of ['hand','spice','traitors','faceDancers'])Object.defineProperty(p,key,{get(){throw new Error('Unauthorized rival field');}});
  assert.deepEqual(botActions(view),actions);g=applyAction(g,'b',actions[0]);const event=g.battle!.event;
  for(const p of g.players)p.bot=level;
  for(let step=0;g.battle&&step<100;step++){
   const next=g.players.map(p=>({player:p.id,action:botActions(viewGame(g,p.id))[0]})).find(next=>next.action);
   assert.ok(next);g=applyAction(g,next.player,next.action);g=restore(g);
  }
  assert.equal(g.battle,null);assert.equal(g.lastBattleContext!.event,event);saphoBattleCustody(g);
 }
});
