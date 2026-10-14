import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction,normalizeAutomaticGame,viewGame,type Game} from '../game/engine';
import {createNativeAtomicsAllianceFixture,advanceNativeAtomicsFixture} from './fixture-moritani-atomics-native';

const limits=(game:Game)=>Object.fromEntries(game.players.map(p=>[p.id,
  viewGame(game,p.id).players.find(seat=>seat.id===p.id)!.handLimit]));

for(const advanced of [false,true])for(const allied of [false,true]) {
  void test(`${advanced?'Advanced':'Basic'} native Atomics ${allied?'original ally':'unallied'} targets persist after a real later worm Nexus`,()=>{
    const f=createNativeAtomicsAllianceFixture(advanced,allied);
    const original=structuredClone(f.game);
    let game=f.game;
    if(allied)game=applyAction(game,'m',{type:'alliance',target:null});
    assert.deepEqual(limits(game),{m:3,a:allied?3:4,e:4,f:4});
    const offered=applyAction(game,'m',{type:'alliance',target:'e'});
    game=applyAction(offered,'e',{type:'alliance',target:'m'});
    assert.deepEqual(game.players.map(p=>[p.id,p.ally]),[['m','e'],['a',null],['e','m'],['f',null]]);
    assert.deepEqual(limits(game),{m:3,a:allied?3:4,e:4,f:4});
    assert.deepEqual(game.moritaniAtomics,original.moritaniAtomics);
    assert.deepEqual(game.players.map(p=>p.tanks),[6,0,1,0]);
    assert.deepEqual(f.game,original);
  });
}

void test('old unresolved Atomics receipts adopt exact original targets without mutating the saved input or replaying effects',()=>{
  const f=createNativeAtomicsAllianceFixture(false,true);
  const legacy=structuredClone(f.game);
  Reflect.set(legacy.moritaniAtomics!,'alliancePolicy','unresolved');
  const before=structuredClone(legacy);
  const normalized=normalizeAutomaticGame(legacy);
  assert.equal(normalized.moritaniAtomics!.alliancePolicy,'activation-targets');
  assert.deepEqual(normalized.players,before.players);
  assert.deepEqual(normalized.moritaniTerror,before.moritaniTerror);
  assert.deepEqual(normalized.discard,before.discard);
  const broken=applyAction(legacy,'m',{type:'alliance',target:null});
  const offered=applyAction(broken,'m',{type:'alliance',target:'e'});
  assert.equal(offered.moritaniAtomics!.alliancePolicy,'activation-targets');
  assert.deepEqual(limits(offered),{m:3,a:3,e:4,f:4});
  assert.deepEqual(legacy,before);
});

void test('native Enemy of My Enemy can replace the post-Atomics alliance without penalizing its new ally',()=>{
  const f=createNativeAtomicsAllianceFixture(false,true,{laterAllianceToken:true});
  let game=advanceNativeAtomicsFixture(f.game,g=>g.turn===3&&g.phase===5&&
    g.active==='e'&&!g.phaseOpening&&!g.response&&!g.decision);
  game=applyAction(game,'e',{type:'ship',territory:'arrakeen',sector:10,amount:1,elite:0,allyPayment:0});
  game=applyAction(game,'m',{type:'decision',alliance:true});
  game=advanceNativeAtomicsFixture(game,g=>g.pendingTerrorEntry?.stage==='allianceReply'&&!g.response);
  game=applyAction(game,'e',{type:'decision',accept:true});
  assert.deepEqual(limits(game),{m:3,a:3,e:4,f:4});
  assert.equal(game.players.find(p=>p.id==='m')!.ally,'e');
  assert.equal(game.players.find(p=>p.id==='a')!.ally,null);
  assert.equal(game.players.find(p=>p.id==='e')!.ally,'m');
  assert.deepEqual(game.moritaniAtomics,f.game.moritaniAtomics);
  assert.equal(game.pendingTerrorEntry,null);
  assert.equal(game.moritaniTerror!.tokens.find(token=>token.kind==='robbery')!.status,'available');
  assert.equal(game.phase,5);
});
