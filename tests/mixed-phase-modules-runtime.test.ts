import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, createGame, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { treacheryDeck } from '../game/cards';
import { createTechTokens, ownedTech } from '../game/tech-tokens';
import { MOBILE_STRONGHOLD } from '../game/board';
import { nativeFactionTechProfile } from '../game/faction-module-profile';
import {
  createMixedPhaseModulesFixture, createMixedPhaseModulesProgramme, mixedPhaseModulesInventory,
  mixedPhaseModulesPlayer as player, mixedPhaseModulesClean,
  type MixedPhaseModulesOptions,
} from './fixture-mixed-phase-modules';

const entries: (MixedPhaseModulesOptions & { label: string })[] = [
  { label: 'Basic paired E3 Tech', factions: ['ecaz', 'moritani', 'guild'], expansions: ['ecaz'], tech: true },
  { label: 'Advanced E1 plus E3 Tech', factions: ['ixians', 'moritani', 'guild'], expansions: ['ix', 'ecaz'], advanced: true, tech: true },
  { label: 'Advanced E2 plus E3 Strongholds', factions: ['choam', 'ecaz', 'guild'], expansions: ['choam', 'ecaz'], advanced: true, strongholds: true },
  { label: 'Basic classic-only all-three-deck Tech', factions: ['atreides', 'emperor', 'guild'], expansions: ['ix', 'choam', 'ecaz'], tech: true },
  { label: 'Advanced two-seat classic-only selected E3 Strongholds', factions: ['atreides', 'emperor'], expansions: ['ecaz'], advanced: true, strongholds: true },
];
for (const options of entries) void test(`public ${options.label} starts native setup and completes its original first Storm`, () => {
  const f = createMixedPhaseModulesFixture(options);
  assert.equal(f.initial.status, 'lobby'); assert.equal(f.lobby.status, 'lobby');
  assert.ok(f.lobby.players.every(seat => seat.ready));
  assert.equal(f.setup.status, 'setup'); assert.equal(f.afterSetup.status, 'playing');
  assert.equal(f.game.phase, 1); assert.equal(f.game.turn, 1); assert.equal(f.game.storm, 1);
  assert.equal(f.game.advanced, !!options.advanced);
  assert.deepEqual(f.game.expansions, options.expansions);
  assert.equal(!!f.game.techTokens, !!options.tech); assert.equal(!!f.game.strongholdCards, !!options.strongholds);
  assert.ok(!f.game.homeworlds && !f.game.leaderSkills && !f.game.nexusCards && !f.game.discoveryEnabled &&
    !f.game.semutaPreview && !f.game.ecazTreachery);
  assert.equal(f.originalInventory.length, treacheryDeck(options.expansions).length + Number(options.factions.includes('richese')) * 10);
  assert.deepEqual(mixedPhaseModulesInventory(f.game), f.originalInventory);
  if (options.tech) {
    assert.deepEqual(f.setup.techTokens, createTechTokens(f.setup.players));
    const owners = Object.values(f.game.techTokens!).map(token => token.owner);
    assert.equal(new Set(owners).size, 3); assert.ok(owners.every(Boolean));
  }
  if (options.strongholds) assert.ok(Object.values(f.game.strongholdCards!.owners).every(owner => owner === null));
  assert.ok(f.actions.some(step => step.action.type === 'start' && !!step.action.advancedPreview === !!options.advanced));
  assert.ok(f.actions.filter(step => step.action.type === 'stormDial').every(step => step.action.amount === 0));
  assert.deepEqual(f.staging, []); assert.equal(f.sourceActionCount, f.actions.length);
});

for (const advanced of [false, true]) void test(`public all-six-native ${advanced ? 'Advanced Tech and Strongholds' : 'Basic Tech'} earns both token payouts, native claims and a real free return`, () => {
  const f = createMixedPhaseModulesProgramme({ advanced });
  assert.deepEqual(f.setup.players.map(seat => seat.faction), ['ixians', 'tleilaxu', 'choam', 'richese', 'ecaz', 'moritani']);
  assert.equal(f.setup.techTokens?.heighliners.owner, 'ixians');
  assert.equal(f.setup.techTokens?.axlotl.owner, 'tleilaxu');
  assert.equal(player(f.choamShipment.before, 'choam').forces[f.choamLocation], undefined);
  assert.equal(player(f.choamShipment.after, 'choam').forces[f.choamLocation], 1);
  assert.equal(player(f.choamShipment.before, 'choam').spice - player(f.choamShipment.after, 'choam').spice, 1);
  assert.equal(player(f.moritaniShipment.after, 'moritani').forces[f.casualtyLocation], 1);
  assert.equal(player(f.moritaniShipment.before, 'moritani').spice - player(f.moritaniShipment.after, 'moritani').spice, 2);
  for (const shipment of [f.choamShipment, f.moritaniShipment]) {
    assert.equal(shipment.steps[0].action.type, 'ship'); assert.equal(shipment.steps[0].action.amount, 1);
    assert.equal(shipment.after.techTokens?.heighliners.spice, 1);
    assert.equal(shipment.after.techTokens?.heighliners.triggeredTurn, 1);
    assert.equal(player(shipment.after, 'ixians').spice, player(shipment.before, 'ixians').spice);
  }
  assert.equal(f.shipmentPayout.before.phase, 5); assert.equal(f.shipmentPayout.after.phase, 6);
  assert.equal(f.shipmentPayout.after.techTokens?.heighliners.spice, 0);
  assert.equal(player(f.shipmentPayout.after, 'ixians').spice - player(f.shipmentPayout.before, 'ixians').spice, 1);
  if (advanced) {
    assert.equal(f.mentat.before.strongholdCards?.claimedTurn, 0);
    assert.equal(f.mentat.after.strongholdCards?.claimedTurn, 1);
    assert.equal(f.mentat.after.strongholdCards?.owners.carthag, 'moritani');
    assert.equal(f.mentat.after.strongholdCards?.owners.sietch_tabr, 'choam');
    assert.equal(f.mentat.after.strongholdCards?.owners[MOBILE_STRONGHOLD], 'ixians');
  } else assert.equal(f.mentat.after.strongholdCards, undefined);
  assert.equal(f.storm.before.stormMovementSource?.kind, advanced ? 'card' : 'dials'); assert.equal(f.storm.before.stormPending, advanced ? 1 : 2);
  assert.equal(player(f.storm.before, 'moritani').tanks, 0);
  assert.equal(player(f.storm.after, 'moritani').tanks, 1);
  assert.equal(player(f.storm.after, 'moritani').forces[f.casualtyLocation], undefined);
  assert.deepEqual(f.revival.steps[0], { actor: 'moritani', action: { type: 'revive', amount: 1, elite: 0 } });
  if (advanced) assert.equal(f.revival.before.revivalOrder?.remaining[0], 'moritani');
  assert.equal(player(f.revival.after, 'moritani').tanks, 0); assert.equal(player(f.revival.after, 'moritani').revived, 1);
  assert.equal(player(f.revival.after, 'moritani').reserves - player(f.revival.before, 'moritani').reserves, 1);
  assert.equal(player(f.revival.after, 'moritani').spice, player(f.revival.before, 'moritani').spice);
  assert.equal(player(f.revival.after, 'tleilaxu').spice - player(f.revival.before, 'tleilaxu').spice, 1);
  assert.equal(f.revival.after.techTokens?.axlotl.spice, 1);
  assert.equal(f.revival.after.techTokens?.axlotl.triggeredTurn, 2);
  assert.equal(f.revivalPayout.after.techTokens?.axlotl.spice, 0);
  assert.equal(player(f.revivalPayout.after, 'tleilaxu').spice - player(f.revivalPayout.before, 'tleilaxu').spice, 1);
  assert.equal(ownedTech(f.game.techTokens, 'tleilaxu').length, 1);
  assert.equal(f.game.turn, 2); assert.equal(f.game.phase, 5); assert.ok(mixedPhaseModulesClean(f.game));
  assert.deepEqual(mixedPhaseModulesInventory(f.game), f.originalInventory); assert.deepEqual(f.staging, []);
  // A minimal own-view policy path, without a strategic simulation campaign.
  const actor = f.game.active; assert.ok(actor);
  const view = viewGame(f.game, actor); view.players.find(seat => seat.id === actor)!.bot = 'Easy';
  const legal = botActions(view).find(action => action.type === 'endMovement'); assert.ok(legal);
  assert.doesNotThrow(() => applyAction(f.game, actor, legal));
});

function lobby(count: number, advanced: boolean): Game {
  const seats = ['ecaz', 'moritani', 'guild'] as const;
  const game = createGame('MIXEDPHASEINVALID', newPlayer(seats[0], seats[0], seats[0]), advanced, ['ecaz']);
  for (const faction of seats.slice(1, count)) joinGame(game, newPlayer(faction, faction, faction));
  return game;
}
function rejected(game: Game, action: Action) {
  const before = structuredClone(game); assert.throws(() => applyAction(game, game.host, action)); assert.deepEqual(game, before);
}
void test('public two-seat Tech and Basic Strongholds are rejected while registered overlays stay outside the new phase-only profile', () => {
  let two = applyAction(lobby(2, false), 'ecaz', { type: 'techTokens', enabled: true });
  for (const seat of two.players) two = applyAction(two, seat.id, { type: 'ready' });
  rejected(two, { type: 'start' });
  rejected(lobby(3, false), { type: 'strongholdCards', enabled: true });
  let overlay = applyAction(lobby(3, true), 'ecaz', { type: 'techTokens', enabled: true });
  overlay = applyAction(overlay, 'ecaz', { type: 'moduleOption', module: 'ecazTreachery', enabled: true });
  for (const seat of overlay.players) overlay = applyAction(overlay, seat.id, { type: 'ready' });
  // This existing independent-card start has its own registered composition.
  // Its permission must not be attributed to the new phase-only profile.
  const started = applyAction(overlay, overlay.host, { type: 'start', advancedPreview: true });
  assert.equal(started.status, 'setup'); assert.equal(started.ecazTreachery, true);
  assert.equal(nativeFactionTechProfile(started), false);
  assert.equal(nativeFactionTechProfile({ ...started, ecazTreachery: false }), true);
});
