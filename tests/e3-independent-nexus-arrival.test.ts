import assert from 'node:assert/strict';
import test from 'node:test';
import { viewGame } from '../game/engine';
import { applyClassicDiscoveryNexusStep } from './fixture-discovery-classic-nexus';
import { createE3IndependentArrival, advanceE3IndependentArrival } from './fixture-e3-independent-nexus-arrival';

for (const modules of [false,true]) void test(`original selected E3 independent Nexus ${modules ? 'all14/World/phase' : 'Basic'} entry preserves both native arrival offers in Storm order`, () => {
  const fixture = createE3IndependentArrival({advanced:modules, expansions:modules ? ['ecaz','ix','choam'] : ['ecaz'],
    skills:modules, homeworlds:modules, tech:modules, strongholds:modules});
  let game = fixture.game;
  const original = structuredClone(game.pendingArrivalOverlap!);
  assert.equal(original.entrant, 'guild');
  assert.equal(original.amount, 2);
  assert.equal(original.stage, 'first');
  assert.equal(original.first, game.order.indexOf('ecaz') < game.order.indexOf('moritani') ? 'ambassador' : 'terror');
  assert.equal(game.players.find(player=>player.id==='guild')!.forces['arrakeen:10'], 2);
  assert.equal(game.ecazAmbassadors!.tokens.find(token=>token.id===fixture.ambassador)!.location, 'arrakeen');
  assert.equal(game.moritaniTerror!.tokens.find(token=>token.id===fixture.terror)!.location, 'arrakeen');
  for (const stage of ['first','second'] as const) {
    assert.equal(game.pendingArrivalOverlap!.stage, stage);
    const decision = game.decision!;
    assert.ok(decision.kind === 'ecazAmbassador' || decision.kind === 'moritaniTerror');
    assert.ok(viewGame(game, decision.player).arrivalOverlap);
    game = applyClassicDiscoveryNexusStep(game, {actor:decision.player, action:{type:'decision',
      ...(decision.kind === 'ecazAmbassador' ? {event:game.pendingAmbassador!.event} : {}), decline:true}}, fixture.actions);
  }
  assert.ok(!game.pendingArrivalOverlap && !game.pendingAmbassador && !game.pendingTerrorEntry);
  game = advanceE3IndependentArrival(game, state=>!state.phaseOpening && !state.response && !state.decision && !state.pendingGuildBetrayal);
  assert.equal(game.phase, 5);
  assert.equal(game.players.find(player=>player.id==='guild')!.shipped, true);
  assert.equal(game.players.find(player=>player.id==='guild')!.forces['arrakeen:10'], 2);
  assert.equal(game.nexusCards!.cards!.deck.length, 12, 'Without a real alliance there was no invented Nexus draw');
});
