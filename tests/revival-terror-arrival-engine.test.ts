import test from 'node:test';
import assert from 'node:assert/strict';
import { viewGame, type Game } from '../game/engine';
import { isAdvisor } from '../game/advisors';
import {
  createRevivalTerrorFixture as fixture, commitRevivalTerror as commit,
  actRevivalTerror as act, passRevivalTerror as pass, finishRevivalTerror as finish,
  revivalTerrorPlayer as player, revivalTerrorInventory as inventory,
  type RevivalTerrorFixture,
} from './fixture-revival-terror';

function enter(f: RevivalTerrorFixture) {
  let g = commit(f.game, f).game;
  if (g.decision?.kind === 'advisor') {
    assert.equal(g.decision.shipment, f.entrant);
    g = act(g, f.bg!, {type:'decision',accept:false});
  }
  assert.equal(player(g,f.entrant).forces[f.location],1);
  assert.equal(g.homeworldRevivalReturn?.stage,'arrival');
  return g;
}
function declineAmbassador(g: Game, f: RevivalTerrorFixture) {
  assert.equal(g.decision?.kind,'ecazAmbassador');
  assert.equal(g.decision?.player,f.ecaz);
  return act(g,f.ecaz!,{type:'decision',event:g.pendingAmbassador!.event,decline:true});
}
function complete(g: Game, f: RevivalTerrorFixture) {
  g = finish(g);
  assert.equal(g.homeworldRevivalReturn?.stage,'complete');
  assert.equal(g.pendingArrivalOverlap ?? null,null);
  assert.equal(g.pendingArrivalReaction ?? null,null);
  assert.equal(g.pendingTerrorEntry ?? null,null);
  assert.equal(g.pendingAmbassador ?? null,null);
  assert.equal(player(g,f.entrant).forces[f.location],1);
  assert.equal(player(g,f.entrant).spice,player(f.beforeRequest,f.entrant).spice+1);
  assert.equal(player(g,f.entrant).shipped,player(f.game,f.entrant).shipped);
  assert.deepEqual(inventory(g),f.originalInventory);
  return g;
}

for (const advanced of [false,true]) for (const ambassadorFirst of [false,true]) {
  void test(`${advanced?'Advanced':'Basic'} native revived overlap: ${ambassadorFirst?'Ambassador':'Terror'} acts first and both declines finish original income`,()=>{
    const f=fixture({advanced,ecaz:true,ambassadorFirst}), g=enter(f);
    assert.equal(g.pendingArrivalOverlap?.first,ambassadorFirst?'ambassador':'terror');
    assert.equal(g.pendingArrivalOverlap?.cause,'homeworldRevival');
    assert.equal(g.pendingArrivalOverlap?.revivalArrival?.event,f.event);
    const second=ambassadorFirst?declineAmbassador(g,f):act(g,f.owner,f.declineAction);
    assert.equal(second.homeworldRevivalReturn?.stage,'arrival');
    const result=complete(ambassadorFirst?act(second,f.owner,f.declineAction):declineAmbassador(second,f),f);
    assert.ok(result.homeworldRevivalReturn!.ambassadors!.every(entry=>entry.completed));
    assert.equal(result.moritaniTerror!.tokens.find(token=>token.id===f.token)!.status,'placed');
    assert.equal(result.ecazAmbassadors!.tokens.find(token=>token.id===f.ambassadorToken)!.zone,'placed');
  });
}

for (const ambassadorFirst of [false,true]) {
  void test(`native revival Sabotage discard retains ${ambassadorFirst?'completed':'pending'} original Ambassador opportunity`,()=>{
    const f=fixture({kind:'sabotage',ecaz:true,ambassadorFirst});
    let g=enter(f);
    if (ambassadorFirst) g=declineAmbassador(g,f);
    g=act(g,f.owner,f.revealAction);
    assert.equal(g.pendingTreacheryDiscard ?? null,null);
    assert.equal(g.pendingTerrorEntry?.stage,'gift');
    assert.equal(g.pendingTerrorEntry?.revivalArrival?.event,f.event);
    assert.equal(g.discard.filter(card=>card.id===f.karama).length,1);
    assert.equal(player(g,f.entrant).hand.length,0);
    g=act(g,f.owner,{type:'decision',decline:true});
    if (!ambassadorFirst) g=declineAmbassador(g,f);
    complete(g,f);
  });
}

for (const advanced of [false,true]) {
  void test(`${advanced?'Advanced':'Basic'} native revived Sneak preserves original Ambassador then opens its own BG and Ambassador arrivals`,()=>{
    const f=fixture({advanced,kind:'sneakAttack',bg:true,ecaz:true}), source=enter(f);
    assert.equal(source.pendingArrivalOverlap?.first,'terror');
    let g=act(source,f.owner,f.revealAction);
    g=act(g,f.owner,{type:'decision',amount:1});
    assert.equal(g.decision?.kind,'ecazAmbassador');
    assert.equal(g.pendingAmbassador?.entrant,f.entrant);
    assert.equal(g.pendingArrivalReaction?.[0].revivalSneakAdvisor,true);
    assert.equal(player(g,f.owner).forces[f.location],1);
    g=declineAmbassador(g,f);
    assert.equal(g.decision?.kind,'advisor');
    if(g.decision?.kind!=='advisor')throw Error('Expected native Sneak Spiritual control');
    assert.equal(g.decision.shipment,f.owner);
    assert.equal(g.decision.revivalEvent,f.event);
    assert.equal(g.decision.revivalTerror?.owner,f.owner);
    g=act(g,f.bg!,{type:'decision',accept:true,accompany:advanced,amount:1});
    assert.equal(g.response?.kind,'advisor');
    assert.equal(g.response?.spiritualAdvisorSource?.revivalEvent,f.event);
    g=pass(g);
    assert.equal(g.decision?.kind,'ecazAmbassador');
    assert.equal(g.pendingAmbassador?.entrant,f.owner);
    const child=g.homeworldRevivalReturn!.ambassadors!.at(-1)!;
    assert.equal(child.terror?.owner,f.owner);
    assert.equal(child.terror?.amount,1);
    g=declineAmbassador(g,f);
    g=complete(g,f);
    assert.equal(player(g,f.owner).reserves,13);
    assert.equal(player(g,f.bg!).forces[advanced?f.location:'polar_sink:0'],advanced?1:2);
    if(advanced)assert.equal(isAdvisor(player(g,f.bg!),f.territory),true);
    assert.deepEqual(g.homeworldRevivalReturn!.ambassadors!.map(entry=>entry.entrant),[f.entrant,f.owner]);
  });
}

void test('native original Karama stops only the Sneak-derived free BG packet, retaining both committed groups',()=>{
  const f=fixture({kind:'sneakAttack',bg:true});
  let g=enter(f);
  g=act(g,f.owner,f.revealAction);
  g=act(g,f.owner,{type:'decision',amount:1});
  assert.equal(g.decision?.kind,'advisor');
  g=act(g,f.bg!,{type:'decision',accept:true,accompany:true,amount:1});
  assert.equal(g.response?.spiritualAdvisorSource?.revivalEvent,f.event);
  g=act(g,f.holder,f.cancelAction);
  g=complete(g,f);
  assert.equal(player(g,f.owner).forces[f.location],1);
  assert.equal(player(g,f.bg!).forces[f.location],undefined);
  assert.equal(g.discard.filter(card=>card.id===f.karama).length,1);
  assert.equal(viewGame(g,f.entrant).terrorEntry,null);
});
