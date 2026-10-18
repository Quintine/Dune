import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame } from '../game/engine';
import { terrorLocationAllowed, terrorEntryLocationAllowed } from '../game/terror-location';
import { NEXUS_FACTIONS } from '../game/nexus-cards';
import { e3IndependentNexusCardPlayer as player } from './fixture-e3-independent-nexus-cards';
import {
  createNexusMoritaniAtomicsFixture, continueNexusMoritaniAtomics, NEXUS_ATOMICS_TERRITORY,
} from './fixture-nexus-moritani-atomics';

for (const modules of [false, true]) void test(`${modules ? 'Advanced all14/World/phase selected decks' : 'Basic selected E3'} actual Moritani Cunning Atomics destroys the original desert armies and keeps movement with a receipt-bound Aftermath shipment ban`, () => {
  const fixture = createNexusMoritaniAtomicsFixture({ advanced: modules, skills: modules,
    homeworlds: modules, tech: modules, strongholds: modules,
    expansions: modules ? ['ecaz', 'ix', 'choam'] : ['ecaz'] });
  assert.ok(fixture.afterSetup.ecazTreachery && fixture.afterSetup.nexusCards);
  assert.equal(!!fixture.afterSetup.homeworlds, modules);
  assert.equal(!!fixture.afterSetup.leaderSkills, modules);
  assert.equal(!!fixture.afterSetup.techTokens, modules);
  assert.equal(!!fixture.afterSetup.strongholdCards, modules);
  assert.deepEqual(player(fixture.afterSetup, 'moritani').forces, { 'pasty_mesa:5': 6 });
  assert.equal(fixture.draw.after.nexusCards!.cards!.hands.moritani, 'moritani');
  assert.equal(fixture.placement.pending.nexusCards!.cards!.hands.moritani, null);
  assert.equal(fixture.placement.pending.nexusCards!.cards!.discard.filter(card => card === 'moritani').length, 1);
  assert.equal(player(fixture.placement.after, 'moritani').spice, player(fixture.placement.before, 'moritani').spice);
  assert.deepEqual(fixture.placement.after.nexusMoritaniLocations?.[fixture.atomics], {
    event: fixture.receipt.event, territory: NEXUS_ATOMICS_TERRITORY });
  assert.equal(fixture.receipt.source, 'mentat');
  assert.equal(fixture.receipt.turn, fixture.placement.before.turn);
  assert.equal(fixture.receipt.token, fixture.atomics);
  assert.equal(fixture.receipt.territory, NEXUS_ATOMICS_TERRITORY);
  assert.equal(terrorLocationAllowed(fixture.game, fixture.atomics, NEXUS_ATOMICS_TERRITORY, fixture.receipt.event), true);
  assert.equal(terrorEntryLocationAllowed(fixture.game, fixture.game.pendingTerrorEntry!), true);
  assert.equal(player(fixture.game, 'guild').reserves, player(fixture.beforeEntry, 'guild').reserves - 3);
  assert.equal(player(fixture.game, 'guild').forces['tueks_sietch:5'], 5);
  assert.equal(player(fixture.game, 'guild').spice, player(fixture.beforeEntry, 'guild').spice - 3);
  if (!modules) {
    const supply = fixture.movementSupply; assert.ok(supply);
    assert.equal(supply.step.action.type, 'ship');
    assert.equal(player(supply.after, 'guild').spice, player(supply.before, 'guild').spice - 1);
    assert.equal(player(supply.after, 'guild').reserves, player(supply.before, 'guild').reserves - 1);
    assert.equal(player(supply.after, 'guild').forces['south_mesa:6'], 1);
    assert.equal(player(supply.after, 'guild').forces['tueks_sietch:5'], 5);
  }
  const finished = continueNexusMoritaniAtomics(fixture.game, fixture.actions);
  const activated = finished.activation.game, before = finished.activation.beforeActivation;
  assert.deepEqual(finished.activation.seen, ['atomics']);
  assert.equal(player(activated, 'moritani').tanks, player(before, 'moritani').tanks + 6);
  assert.equal(player(activated, 'guild').tanks, player(before, 'guild').tanks + 3);
  assert.equal(Object.entries(player(activated, 'moritani').forces).filter(([key]) => key.startsWith('pasty_mesa:')).reduce((sum, [, amount]) => sum + amount, 0), 0);
  assert.equal(Object.entries(player(activated, 'guild').forces).filter(([key]) => key.startsWith('pasty_mesa:')).reduce((sum, [, amount]) => sum + amount, 0), 0);
  assert.deepEqual(activated.moritaniAtomics, { territory: NEXUS_ATOMICS_TERRITORY, turn: before.turn,
    moritaniId: 'moritani', allyAtActivation: null, alliancePolicy: 'activation-targets', nexusPlacement: fixture.receipt.event });
  assert.equal(activated.moritaniTerror!.tokens.find(token => token.id === fixture.atomics)!.status, 'removed');
  assert.equal(activated.nexusMoritaniLocations?.[fixture.atomics], undefined);
  assert.deepEqual(activated.nexusMoritaniHistory, fixture.placement.after.nexusMoritaniHistory);
  assert.equal(terrorLocationAllowed(activated, fixture.atomics, NEXUS_ATOMICS_TERRITORY, fixture.receipt.event, false, true), true);
  assert.equal(terrorLocationAllowed(activated, fixture.atomics, NEXUS_ATOMICS_TERRITORY, fixture.receipt.event), false);
  assert.equal(terrorLocationAllowed(activated, 'another-token', NEXUS_ATOMICS_TERRITORY, fixture.receipt.event, false, true), false);
  assert.equal(player(activated, 'moritani').atomicsHandLimitPenalty, true);
  assert.equal(viewGame(activated, 'moritani').players.find(player => player.id === 'moritani')!.handLimit, 3);
  assert.equal(player(activated, 'guild').atomicsHandLimitPenalty ?? false, false);
  assert.equal(player(finished.beforeMove, 'guild').shipped, true);
  assert.equal(player(finished.beforeMove, 'guild').moved, 0);
  assert.equal(Object.entries(player(finished.afterMove, 'guild').forces).filter(([key]) => key.startsWith('pasty_mesa:')).reduce((sum, [, amount]) => sum + amount, 0), modules ? 5 : 1);
  if (!modules) assert.equal(player(finished.afterMove, 'guild').forces['tueks_sietch:5'], 5);
  assert.equal(player(finished.afterMove, 'guild').moved, 1);
  assert.throws(() => applyAction(finished.beforeShipment, 'guild', finished.blockedShipment), /Aftermath|Atomics/i);
  assert.equal(player(finished.game, 'guild').shipped, true);
  assert.equal(player(finished.game, 'guild').forces['polar_sink:0'], 1);
  assert.deepEqual(finished.game.moritaniAtomics, activated.moritaniAtomics);
  const nexus = finished.game.nexusCards!.cards!;
  assert.deepEqual([...nexus.deck, ...nexus.discard, ...Object.values(nexus.hands).filter(card => card !== null)].sort(), [...NEXUS_FACTIONS].sort());
});
