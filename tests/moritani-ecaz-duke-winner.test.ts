import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { leaders } from '../game/cards';
import { DUKE_VIDAL_ID } from '../game/duke-vidal';
import { botArrivalBlock } from '../game/bot-arrival';
import {
  advancePairedE3Nexus, pairedE3NexusInventory,
  pairedE3NexusPlayer as player, pairedE3NexusReload as reload,
  quietPairedE3NexusChoice, quotePairedE3NexusBattle,
  stepPairedE3Nexus as step,
} from './fixture-paired-e3-nexus-modules';
import { createMoritaniEcazDukeWinner, settleMoritaniEcazDukeWinner } from './fixture-moritani-ecaz-duke-winner';

function reject(g: Game, actor: string, action: Action): void {
  const before = structuredClone(g);
  assert.throws(() => applyAction(g, actor, action));
  assert.deepEqual(g, before);
}

void test('original Ecaz Ambassador Duke6 win opens the formerly missing native opportunity, pays printed Ecaz bounty and draws the physical Mentat replacement', () => {
  const f = createMoritaniEcazDukeWinner();
  const { pending, ready, ecaz, moritani, target, location } = f;

  // Physical paid acquisition and shipments, not an assigned shared controller.
  assert.equal(player(f.placement.after, ecaz).spice, player(f.placement.before, ecaz).spice - 1);
  assert.equal(f.placement.after.ecazAmbassadors!.tokens.find(t => t.id === f.token)!.zone, 'placed');
  assert.equal(f.acquisition.before.pendingAmbassador!.entrant, moritani);
  assert.equal(f.acquisition.before.dukeVidal!.controller, null);
  assert.equal(f.acquisition.after.dukeVidal!.controller, ecaz);
  assert.equal(f.acquisition.after.dukeVidal!.source, 'ecaz');
  assert.equal(f.acquisition.after.ecazAmbassadors!.tokens.find(t => t.id === f.token)!.zone, 'supply');
  for (const shipment of f.shipments) {
    const actor = shipment.step.actor;
    assert.equal(player(shipment.after, actor).reserves, player(shipment.before, actor).reserves - 1);
    assert.equal(player(shipment.after, actor).forces[`${location}:${f.sector}`], 1);
    assert.equal(player(shipment.after, actor).spice, player(shipment.before, actor).spice - 1);
    assert.equal(player(shipment.after, actor).shipped, true);
  }
  const paidMoritaniShipment = f.shipments.find(s => s.step.actor === moritani)!;
  assert.equal(botArrivalBlock(viewGame(paidMoritaniShipment.before, moritani), paidMoritaniShipment.step.action), null);
  assert.equal(ready.battle!.plans[ecaz].leader, DUKE_VIDAL_ID);
  assert.equal(ready.dukeVidal!.controller, ecaz);
  assert.equal(quotePairedE3NexusBattle(ready).winner, ecaz);
  assert.equal(pending.lastBattleContext!.winner, ecaz);
  assert.equal(pending.lastBattleContext!.result, 'normal');
  assert.equal(pending.moritaniAssassinate!.normalTraitorCall, false);

  // The old native-roster/Harkonnen-only winner gate omitted this real offer:
  // the winning physical shared disc is not in Ecaz's ordinary five-disc list.
  const receipt = pending.moritaniAssassinate!.opportunities[0];
  assert.equal(pending.moritaniAssassinate!.opportunities.length, 1);
  assert.equal(receipt.stage, 'choice');
  assert.equal(receipt.faction, 'ecaz');
  assert.equal(receipt.opponent, ecaz);
  assert.equal(receipt.opposingLeader, DUKE_VIDAL_ID);
  assert.equal(receipt.event, pending.lastBattleContext!.event);
  assert.equal(pending.dukeVidal!.controller, null);
  assert.equal(pending.dukeVidal!.source, null);
  assert.equal(pending.dukeVidal!.acquiredTurn, null);
  assert.equal(pending.dukeVidal!.leader.usedAt, location);
  assert.equal(pending.dukeVidal!.leader.dead, false);
  assert.equal(pending.dukeVidal!.leader.deaths, 0);
  assert.equal(pending.dukeVidal!.leader.faction, 'ecaz');
  assert.equal(pending.dukeVidal!.leader.strength, 6);

  const native = leaders('ecaz').find(l => l.id === target)!;
  assert.ok(player(f.afterSetup, moritani).traitors.includes(target));
  const offer = viewGame(reload(pending), moritani).moritaniAssassinate!.pending!;
  assert.equal(offer.blocked, null);
  assert.deepEqual(offer.cards.map(c => c.card), [target]);
  assert.equal(offer.cards[0].potentialBounty, native.strength);
  assert.equal(viewGame(pending, ecaz).moritaniAssassinate!.pending!.cards.length, 0);
  const d = pending.decision;
  assert.ok(d?.kind === 'moritaniAssassinate');
  reject(pending, moritani, { type: 'decision', event: d.event, card: DUKE_VIDAL_ID });
  const beforeTarget = player(pending, ecaz).leaders.find(l => l.id === target)!;
  const expectedReplacement = pending.traitorReserve!.find(id => id !== target)!;
  const revealed = step(reload(pending), { actor: moritani,
    action: { type: 'decision', event: d.event, card: target } });
  const killed = player(revealed, ecaz).leaders.find(l => l.id === target)!;
  assert.equal(killed.dead, true);
  assert.equal(killed.deaths, beforeTarget.deaths + 1);
  assert.equal(player(revealed, moritani).spice, player(pending, moritani).spice + native.strength);
  assert.equal(revealed.dukeVidal!.leader.dead, false);
  assert.ok(player(revealed, moritani).traitors.includes(target));
  assert.equal(revealed.moritaniAssassinate!.opportunities[0].stage, 'revealed');
  pairedE3NexusInventory(revealed);

  const settled = settleMoritaniEcazDukeWinner(revealed);
  const mentat = advancePairedE3Nexus(settled, g => g.turn === receipt.turn && g.phase === 8 &&
    g.moritaniAssassinate!.opportunities[0].stage === 'replaced', undefined, quietPairedE3NexusChoice);
  const replaced = mentat.moritaniAssassinate!.opportunities[0];
  assert.equal(replaced.replacement, expectedReplacement);
  assert.notEqual(replaced.replacement, target);
  assert.deepEqual(player(mentat, moritani).traitors, [expectedReplacement]);
  assert.ok(!mentat.traitorReserve!.includes(target));
  assert.ok(!mentat.traitorReserve!.includes(expectedReplacement));
  assert.equal(mentat.traitorReserve!.length, pending.traitorReserve!.length - 1);
  assert.equal(mentat.moritaniAssassinate!.opportunities.filter(r => r.card === target && r.stage === 'replaced').length, 1);
  const publicMarker = viewGame(mentat, ecaz).moritaniAssassinate!.history[0];
  assert.equal(publicMarker.card, target);
  assert.equal(publicMarker.faction, 'ecaz');
  assert.equal(publicMarker.stage, 'replaced');
  assert.equal('replacement' in publicMarker, false);
  for (const snapshot of [f.afterSetup, ready, pending, mentat]) {
    assert.equal(player(snapshot, ecaz).leaders.length, 5);
    assert.equal(player(snapshot, moritani).leaders.length, 5);
    assert.ok(!snapshot.players.some(p => p.leaders.some(l => l.id === DUKE_VIDAL_ID)));
    pairedE3NexusInventory(snapshot);
  }
});

void test('declining the original shared-Duke opportunity releases the used disc but spends no native Ecaz target or replacement', () => {
  const f = createMoritaniEcazDukeWinner(), d = f.pending.decision;
  assert.ok(d?.kind === 'moritaniAssassinate');
  const held = [...player(f.pending, f.moritani).traitors];
  const ecazLeaders = structuredClone(player(f.pending, f.ecaz).leaders);
  const reserve = [...f.pending.traitorReserve!];
  const declined = step(reload(f.pending), { actor: f.moritani,
    action: { type: 'decision', event: d.event, decline: true } });
  const settled = settleMoritaniEcazDukeWinner(declined);
  const mentat = advancePairedE3Nexus(settled, g => g.turn === f.pending.turn && g.phase === 8,
    undefined, quietPairedE3NexusChoice);
  assert.equal(mentat.moritaniAssassinate!.opportunities[0].stage, 'declined');
  assert.equal(mentat.moritaniAssassinate!.opportunities[0].replacement, null);
  assert.deepEqual(player(mentat, f.moritani).traitors, held);
  assert.deepEqual(mentat.traitorReserve, reserve);
  assert.deepEqual(player(mentat, f.ecaz).leaders, ecazLeaders);
  assert.equal(mentat.dukeVidal!.controller, null);
  assert.equal(mentat.dukeVidal!.leader.usedAt, f.location);
  assert.equal(mentat.dukeVidal!.leader.dead, false);
  assert.equal(viewGame(mentat, f.moritani).moritaniAssassinate!.history.length, 0);
  pairedE3NexusInventory(mentat);
});
