import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction,viewGame} from '../game/engine';
import {botActions} from '../game/bots';
import {bureaucratPaymentGame,bureaucratReload} from './bureaucrat-payment-fixture';

void test('all four profiles legally redirect opposing bribes and Guild income using only the owned current choice',()=>{
 for(const bot of ['Easy','Medium','Hard','Brutal'] as const)for(const kind of ['bribe','shipment'] as const){
  let game=bureaucratPaymentGame();game.players.find(p=>p.id==='b')!.bot=bot;
  game=applyAction(game,'p',kind==='bribe'?{type:'bribe',target:'e',amount:5}:{type:'ship',territory:'arrakeen',sector:10,amount:5});
  assert.equal(game.decision?.kind,'bureaucratPayment');
  for(const p of game.players.filter(p=>p.id!=='b'))assert.deepEqual(botActions(viewGame(game,p.id)),[]);
  const actions=botActions(viewGame(game,'b'));assert.deepEqual(actions,[{type:'decision',event:game.decision!.event,redirect:true}]);
  const after=applyAction(bureaucratReload(game),'b',actions[0]);
  assert.equal(after.bureaucratPayments!.used.length,1);assert.equal(after.players.find(p=>p.id==='p')!.spice,25);
 }
});

void test('Bureaucrat policy preserves allied income and ignores hidden rival wealth and cards',()=>{
 for(const bot of ['Easy','Medium','Hard','Brutal'] as const){
  let game=bureaucratPaymentGame();game.players.find(p=>p.id==='b')!.bot=bot;
  game.players.find(p=>p.id==='b')!.ally='e';game.players.find(p=>p.id==='e')!.ally='b';
  game=applyAction(game,'p',{type:'bribe',target:'e',amount:5});
  assert.ok(game.decision?.kind==='bureaucratPayment');
  const original=viewGame(game,'b'),expected=botActions(original);
  assert.deepEqual(expected,[{type:'decision',event:game.decision!.event,redirect:false}]);
  const changed=structuredClone(original);
  for(const p of changed.players.filter(p=>p.id!=='b'))Object.assign(p,{spice:9_999,hand:[{id:'hidden',name:'Unseen',kind:'worthless'}]});
  assert.deepEqual(botActions(changed),expected);
  const after=applyAction(bureaucratReload(game),'b',expected[0]);
  assert.equal(after.players.find(p=>p.id==='e')!.bribes,5);assert.equal(after.bureaucratPayments!.used.length,0);
  const stale=structuredClone(original);stale.decision={kind:'bureaucratPayment',player:'b',event:'old'};
  assert.deepEqual(botActions(stale),[]);
 }
});
