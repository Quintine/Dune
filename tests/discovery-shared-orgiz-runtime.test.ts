import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction,type Game} from '../game/engine';
import {ORGIZ_PROCESSING_STATION} from '../game/discovery-collection';
import {prepareSharedOrgizCollection,settleSharedOrgiz} from './fixture-discovery-shared-orgiz';

const wallets=(game:Game)=>Object.fromEntries(game.players.map(p=>[p.id,p.spice]));
const transfers=(game:Game)=>game.log.filter(entry=>entry.automatic?.name==='Orgiz Processing Station');

for(const advanced of [false,true])
for(const split of ['equal','all-ecaz','all-guild'] as const) {
  void test(`${advanced?'Advanced':'Basic'} native shared Collection: ${split} respects the actual foreign recipient and sole Orgiz owner`,()=>{
    const position=prepareSharedOrgizCollection(advanced);
    const original=structuredClone(position.game);
    const before=wallets(original);
    const choice=split==='equal'?{kind:'equal' as const}:
      {kind:'propose' as const,ecazShare:split==='all-ecaz'?position.lot.amount:0};
    const settled=settleSharedOrgiz(position,choice);
    const receipt=settled.receipt;
    const expected={...before};
    expected[position.ecaz]+=receipt.ecazAmount;
    expected[position.guild]+=receipt.allyAmount;
    const tax=receipt.ecazAmount>0?1:0;
    expected[position.ecaz]-=tax;
    expected[position.owner]+=tax;
    assert.deepEqual(wallets(settled.game),expected);
    assert.equal(receipt.ecazAmount+receipt.allyAmount,position.lot.amount);
    assert.equal(transfers(settled.game).length,tax);
    assert.equal(settled.game.players.find(p=>p.id===position.owner)!
      .forces[`${ORGIZ_PROCESSING_STATION}:0`],2);
    assert.deepEqual(position.game,original);
    const committed=structuredClone(settled.game);
    const last=settled.steps.at(-1)!;
    assert.throws(()=>applyAction(settled.game,last.actor,last.action));
    assert.deepEqual(settled.game,committed,'A stale allocation cannot pay the same territory twice.');
  });
}

for(const advanced of [false,true])
void test(`${advanced?'Advanced':'Basic'} shared Orgiz waits for ally acceptance and rejects the wrong actor without changing wallets`,()=>{
  const position=prepareSharedOrgizCollection(advanced);
  const before=structuredClone(position.game);
  const event=before.ecazCollection!.event;
  const action={type:'decision' as const,event,allocation:{kind:'propose' as const,ecazShare:position.lot.amount}};
  assert.throws(()=>applyAction(position.game,position.guild,action));
  assert.deepEqual(position.game,before);
  const proposed=applyAction(position.game,position.ecaz,action);
  assert.equal(proposed.decision?.player,position.guild);
  assert.deepEqual(wallets(proposed),wallets(before));
  assert.equal(transfers(proposed).length,0);
  const accepted=applyAction(proposed,position.guild,
    {type:'decision',event,allocation:{kind:'accept'}});
  assert.equal(wallets(accepted)[position.ecaz],wallets(before)[position.ecaz]+position.lot.amount-1);
  assert.equal(wallets(accepted)[position.guild],wallets(before)[position.guild]+1);
});
