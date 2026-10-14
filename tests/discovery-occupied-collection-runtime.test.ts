import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction,normalizeAutomaticGame,type Game} from '../game/engine';
import {CISTERN,ORGIZ_PROCESSING_STATION} from '../game/discovery-collection';
import {createOccupiedDiscoveryCollectionFixture} from './fixture-discovery-occupied-collection';

const wallets=(game:Game)=>Object.fromEntries(game.players.map(p=>[p.id,p.spice]));
const stock=(game:Game)=>game.players.map(p=>({id:p.id,
  total:p.reserves+p.tanks+Object.values(p.forces).reduce((sum,n)=>sum+n,0),
  elites:p.elites? p.elites.reserves+p.elites.tanks+Object.values(p.elites.forces).reduce((sum,n)=>sum+n,0):0}));

for(const advanced of [false,true]) {
  void test(`${advanced?'Advanced':'Basic'} original two-occupant Cistern credits each faction once without payer spending`,()=>{
    const f=createOccupiedDiscoveryCollectionFixture(CISTERN,advanced);
    const before=structuredClone(f.game);
    const done=applyAction(f.game,f.finalAction.actor,f.finalAction.action);
    const expected=Object.fromEntries(f.original.receipts.map(r=>[r.player,r.balance]));
    for(const owner of f.owners)expected[owner]+=2;
    assert.equal(done.phase,7);
    assert.deepEqual(wallets(done),expected);
    assert.deepEqual(stock(done),stock(before));
    assert.ok(stock(done).every(p=>p.total===20));
    assert.deepEqual(f.game,before);
    const stable=JSON.parse(JSON.stringify(done)) as Game;
    assert.deepEqual(normalizeAutomaticGame(stable),stable);
    assert.throws(()=>applyAction(done,f.finalAction.actor,f.finalAction.action));
    assert.deepEqual(wallets(done),expected);
  });

  void test(`${advanced?'Advanced':'Basic'} both original Orgiz occupants receive one transfer from the actual third-party desert collector`,()=>{
    const f=createOccupiedDiscoveryCollectionFixture(ORGIZ_PROCESSING_STATION,advanced);
    const before=structuredClone(f.game);
    const done=applyAction(f.game,f.finalAction.actor,f.finalAction.action);
    const expected=Object.fromEntries(f.original.receipts.map(r=>[r.player,r.balance]));
    for(const owner of f.owners)expected[owner]+=1;
    expected[f.collector!]-=2;
    assert.equal(done.phase,7);
    assert.deepEqual(wallets(done),expected);
    assert.equal(Object.values(wallets(done)).reduce((sum,n)=>sum+n,0),
      f.original.receipts.reduce((sum,r)=>sum+r.balance,0));
    assert.deepEqual(stock(done),stock(before));
    assert.deepEqual(done.spice,f.original.spice);
    assert.deepEqual(f.game,before);
    const stable=JSON.parse(JSON.stringify(done)) as Game;
    assert.deepEqual(normalizeAutomaticGame(stable),stable);
    assert.throws(()=>applyAction(done,f.finalAction.actor,f.finalAction.action));
    assert.deepEqual(wallets(done),expected);
  });
}
