import assert from 'node:assert/strict';
import test from 'node:test';
import {applyAction,viewGame} from '../game/engine';
import {askMixedShipment,mixedShipmentGame,mixedSpiceShipment} from './fixture-mixed-shipment';
import {askCompoundShipment} from './fixture-compound-shipment';

void test('Yes OR a true current spice fact permits later spending and skipping shipment without changing its historical answer',()=>{
  let game=askMixedShipment(mixedShipmentGame(),mixedSpiceShipment('or','gte',10));
  assert.deepEqual(viewGame(game,'p').truthShipmentAnswers,['yes']);
  game=applyAction(game,'p',{type:'truthAnswer',answer:'yes'});
  assert.equal(game.truthHistory!.at(-1)!.answer,'yes');
  game=applyAction(game,'p',{type:'bribe',target:'a',amount:20});
  assert.equal(game.players[0].spice,0);
  game=applyAction(game,'p',{type:'endMovement'});
  assert.equal(game.shipmentPromises![0].fulfilled,true);
  assert.equal(game.players[0].shipped,false);
  assert.equal(game.truthHistory!.at(-1)!.answer,'yes');
});

void test('No AND a false current spice fact permits a shipment that changes that current fact to true',()=>{
  let game=askMixedShipment(mixedShipmentGame(),mixedSpiceShipment('and','lte',10));
  assert.deepEqual(viewGame(game,'p').truthShipmentAnswers,['no']);
  game=applyAction(game,'p',{type:'truthAnswer',answer:'no'});
  game=applyAction(game,'p',{type:'ship',territory:'arrakeen',sector:10,amount:15});
  assert.equal(game.players[0].spice,5);
  assert.equal(game.players[0].forces['arrakeen:10'],15);
  assert.equal(game.shipmentPromises![0].fulfilled,true);
  assert.equal(game.truthHistory!.at(-1)!.answer,'no');
});

void test('Yes AND a true current fact requires the exact future shipment while an impossible current branch cannot be answered Yes',()=>{
  let game=askMixedShipment(mixedShipmentGame(),mixedSpiceShipment('and','gte',10));
  assert.deepEqual(viewGame(game,'p').truthShipmentAnswers,['yes','no']);
  game=applyAction(game,'p',{type:'truthAnswer',answer:'yes'});
  const before=JSON.stringify(game);
  assert.throws(()=>applyAction(game,'p',{type:'endMovement'}));
  assert.throws(()=>applyAction(game,'p',{type:'ship',territory:'carthag',sector:11,amount:4}));
  assert.throws(()=>applyAction(game,'p',{type:'ship',territory:'arrakeen',sector:10,amount:3}));
  assert.equal(JSON.stringify(game),before);
  game=applyAction(game,'p',{type:'ship',territory:'arrakeen',sector:10,amount:4});
  assert.equal(game.players[0].forces['arrakeen:10'],4);
  const impossible=askMixedShipment(mixedShipmentGame(),mixedSpiceShipment('and','gte',21));
  assert.deepEqual(viewGame(impossible,'p').truthShipmentAnswers,['no']);
  assert.throws(()=>applyAction(impossible,'p',{type:'truthAnswer',answer:'yes'}));
});

void test('No OR requires every frozen branch to be false and cannot negate an already true current clause',()=>{
  let game=askMixedShipment(mixedShipmentGame(),mixedSpiceShipment('or','lte',10));
  assert.deepEqual(viewGame(game,'p').truthShipmentAnswers,['yes','no']);
  game=applyAction(game,'p',{type:'truthAnswer',answer:'no'});
  assert.throws(()=>applyAction(game,'p',{type:'ship',territory:'arrakeen',sector:10,amount:4}));
  game=applyAction(game,'p',{type:'ship',territory:'carthag',sector:11,amount:15});
  assert.equal(game.players[0].spice,5);
  assert.equal(game.players[0].forces['carthag:11'],15);
  assert.equal(game.shipmentPromises![0].fulfilled,true);
  const impossible=askMixedShipment(mixedShipmentGame(),mixedSpiceShipment('or','gte',10));
  assert.deepEqual(viewGame(impossible,'p').truthShipmentAnswers,['yes']);
  assert.throws(()=>applyAction(impossible,'p',{type:'truthAnswer',answer:'no'}));
});

void test('nested current branches keep the selected future destination after voluntary spice changes',()=>{
  let game=askMixedShipment(mixedShipmentGame(),{kind:'or',terms:[
    mixedSpiceShipment('and','gte',10),
    {kind:'and',terms:[{kind:'fact',fact:{kind:'spice',compare:'lte',value:10}},
      {kind:'shipment',territory:'carthag',minimum:4}]},
  ]});
  game=applyAction(game,'p',{type:'truthAnswer',answer:'yes'});
  game=applyAction(game,'p',{type:'bribe',target:'a',amount:12});
  assert.equal(game.players[0].spice,8);
  assert.throws(()=>applyAction(game,'p',{type:'ship',territory:'carthag',sector:11,amount:4}));
  game=applyAction(game,'p',{type:'ship',territory:'arrakeen',sector:10,amount:4});
  assert.equal(game.players[0].spice,4);
  assert.equal(game.players[0].forces['arrakeen:10'],4);
});

void test('an unconstraining mixed answer cannot override an earlier pure shipment commitment',()=>{
  let game=askCompoundShipment(mixedShipmentGame(),{territory:'carthag',minimum:4});
  game=applyAction(game,'p',{type:'truthAnswer',answer:'yes'});
  game=askMixedShipment(game,mixedSpiceShipment('or','gte',10));
  game=applyAction(game,'p',{type:'truthAnswer',answer:'yes'});
  assert.equal(game.shipmentPromises!.length,2);
  assert.throws(()=>applyAction(game,'p',{type:'endMovement'}));
  assert.throws(()=>applyAction(game,'p',{type:'ship',territory:'arrakeen',sector:10,amount:4}));
  game=applyAction(game,'p',{type:'ship',territory:'carthag',sector:11,amount:4});
  assert.deepEqual(game.shipmentPromises!.map(p=>p.fulfilled),[true,true]);
  assert.equal(game.players[0].forces['carthag:11'],4);
});
