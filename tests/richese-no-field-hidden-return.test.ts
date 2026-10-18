import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createRicheseNoField, deployRicheseNoField, deployRicheseNoFieldPair,
  recallRicheseNoField, projectRicheseNoField, revealRicheseNoField,
  validateRicheseNoField, type NoFieldValue,
} from '../game/richese-no-field';

for (const value of [0,3,5] as const) void test(`forced face-down ${value} No-Field return keeps its last-shipment ban without revealing its value`, () => {
  const start = createRicheseNoField(['zero','three','five']);
  const token = start.tokens.find(token => token.value === value)!;
  const location = {territory:'imperial_basin',sector:9};
  const deployed = deployRicheseNoField(start, {tokenId:token.id,controller:'richese',location});
  const before = structuredClone(deployed);
  const returned = recallRicheseNoField(deployed,token.id);
  assert.deepEqual(deployed,before);
  assert.deepEqual(projectRicheseNoField(returned,false), {deployed:null,lastUsed:null});
  assert.equal(returned.lastShipped,token.id);
  assert.equal(returned.hiddenReturn,true);
  assert.deepEqual(projectRicheseNoField(returned,true).private,returned);
  assert.throws(()=>recallRicheseNoField(returned,token.id),/not deployed/);
  assert.throws(()=>deployRicheseNoField(returned,{tokenId:token.id,controller:'richese',location}),/twice in a row/);
  const next = returned.tokens.find(candidate=>candidate.id!==token.id)!;
  const redeployed = deployRicheseNoField(returned,{tokenId:next.id,controller:'richese',location});
  assert.equal(Object.hasOwn(redeployed,'hiddenReturn'),false);
  const revealed = revealRicheseNoField(redeployed,{tokenId:next.id,reserves:2,cause:'atomics'});
  assert.equal(revealed.forces,Math.min(next.value,2));
  assert.equal(projectRicheseNoField(revealed.state,false).lastUsed,next.value);
  const other = returned.tokens.find(candidate=>candidate.id!==token.id&&candidate.id!==next.id)!;
  const pair = deployRicheseNoFieldPair(returned,{tokenId:next.id,controller:'richese',location},other.id,7);
  assert.equal(Object.hasOwn(pair.state,'hiddenReturn'),false);
  assert.equal(pair.revealed.forces,other.value);
});

void test('the hidden-return marker requires an actual prior shipment and cannot coexist with a deployed token', () => {
  const start = createRicheseNoField(['zero','three','five']);
  assert.throws(()=>validateRicheseNoField({...start,hiddenReturn:true}),/previous shipment/);
  const deployed=deployRicheseNoField(start,{tokenId:'three',controller:'richese',location:{territory:'arrakeen',sector:10}});
  assert.throws(()=>validateRicheseNoField({...deployed,hiddenReturn:true}),/previous shipment/);
  assert.throws(()=>recallRicheseNoField(deployed,'five'),/not deployed/);
  const oldReveal=revealRicheseNoField(deployed,{tokenId:'three',reserves:7,cause:'voluntary'});
  assert.equal(Object.hasOwn(oldReveal.state,'hiddenReturn'),false);
  assert.equal(projectRicheseNoField(oldReveal.state,false).lastUsed,3 as NoFieldValue);
});
