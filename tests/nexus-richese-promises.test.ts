import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, viewGame } from '../game/engine';
import { botActions } from '../game/bots';
import { nexusRicheseFixture, holdNexusRicheseCard, nexusRicheseRequest, nexusRicheseInventory } from './fixture-nexus-richese';

void test('a binding five-force Yes uses the held Richese discount as a private completion witness', () => {
  const f = nexusRicheseFixture({spice:1});
  const card = holdNexusRicheseCard(f.g,f.target,'truthtrance');
  let g = applyAction(f.g,f.target,{type:'card',card:card.id});
  while (g.truthtrance?.stage === 'priority') {
    const seat = g.players.find(p => !g.truthtrance!.passed.includes(p.id))!;
    g = applyAction(g,seat.id,{type:'truthPass'});
  }
  g = applyAction(g,f.target,{type:'truthAsk',question:{kind:'shipment',target:f.owner,territory:'arrakeen',minimum:5}});
  assert.deepEqual(viewGame(g,f.owner).truthShipmentAnswers,['yes','no']);
  g = applyAction(g,f.owner,{type:'truthAnswer',answer:'yes'});
  for (const profile of ['Easy','Medium','Hard','Brutal'] as const) {
    const v = viewGame(g,f.owner);
    v.players.find(p => p.id === f.owner)!.bot = profile;
    const action = botActions(v)[0];
    assert.equal(action.type,'ship');
    assert.equal(action.amount,5);
    assert.equal(action.nexus,JSON.stringify(['nexusRichese',g.turn,f.owner]));
    const done = applyAction(g,f.owner,action);
    assert.equal(done.players[0].reserves,15);
    assert.equal(done.players[0].spice,0);
    assert.equal(done.shipmentPromises?.[0].fulfilled,true);
    nexusRicheseInventory(done);
  }
  assert.throws(() => applyAction(g,f.owner,{type:'endMovement'}));
  assert.throws(() => applyAction(g,f.owner,nexusRicheseRequest(f,4,'arrakeen',10,g)));
});
