import assert from 'node:assert/strict';
import test from 'node:test';
import { initializeHomeworldOccupationGameForAudit, viewGame, type Game } from '../game/engine';
import { MOBILE_STRONGHOLD } from '../game/board';
import { treacheryDeck } from '../game/cards';
import { nativeShipmentSources } from '../game/homeworld-options';
import { forceRevivalQuote } from '../game/revival';
import { ownedTech } from '../game/tech-tokens';
import {
  createMixedPhaseModulesFixture, createMixedPhaseModulesProgramme,
  mixedPhaseModulesClean, mixedPhaseModulesInventory, mixedPhaseModulesPlayer as player,
  type MixedPhaseModulesOptions,
} from './fixture-mixed-phase-modules';

function freshWorlds(game: Game) {
  assert.ok(game.homeworlds); assert.equal(game.homeworlds.custody, null);
  assert.equal(game.homeworldOccupationPreview, true);
  assert.equal(game.pendingHomeworldOccupiedIncome, null);
  assert.deepEqual(game.homeworldOccupiedIncomeHistory, []);
  assert.ok(game.homeworldOccupiedPercentageLedger);
  if (game.players.some(seat => seat.faction === 'choam')) {
    assert.equal(game.homeworldTupilePreview, true); assert.ok(game.homeworldTupileState);
    assert.equal(game.pendingHomeworldTupileCleanup, null);
  }
  if (game.players.some(seat => seat.faction === 'ecaz')) {
    assert.equal(game.homeworldEcazVictoryPreview, true); assert.equal(game.ecazOccupyPreview, true);
  }
}

/** Source/final component facts only, without a save/custody campaign. Native
 * World pools are the physical reserve locations, rather than extra counters. */
function components(game: Game) {
  const worlds = viewGame(game, game.host).homeworlds?.worlds; assert.ok(worlds?.length);
  for (const seat of game.players) {
    const native: number = worlds.filter(world => world.native === seat.id)
      .reduce((total, world) => total + world.forces[seat.id].normal + world.forces[seat.id].elite, 0);
    const visitors: number = worlds.filter(world => world.native !== seat.id)
      .reduce((total, world) => total + (world.forces[seat.id]?.normal ?? 0) + (world.forces[seat.id]?.elite ?? 0), 0);
    assert.equal(native, seat.reserves);
    assert.equal(seat.reserves + seat.tanks + visitors + Object.values(seat.forces).reduce((a, b) => a + b, 0), 20);
  }
}

void test('the explicit legacy occupation Skills entry does not inherit clean World phase-module admission', () => {
  const f = createMixedPhaseModulesFixture({ factions: ['atreides', 'emperor', 'guild'], expansions: [],
    advanced: true, homeworlds: true, tech: true });
  const before = structuredClone(f.lobby);
  assert.throws(() => initializeHomeworldOccupationGameForAudit(f.lobby, true), /Occupation requires/);
  assert.deepEqual(f.lobby, before);
});

void test('public bare Basic Worlds start mixed selected families and classic no-deck seats with original occupation state', () => {
  const entries: MixedPhaseModulesOptions[] = [
    { factions: ['ecaz', 'ixians', 'tleilaxu'], expansions: ['ix', 'choam', 'ecaz'] },
    { factions: ['atreides', 'emperor'], expansions: [] },
  ];
  for (const selected of entries) {
    const f = createMixedPhaseModulesFixture({ ...selected, homeworlds: true });
    assert.equal(f.initial.homeworlds, undefined); assert.deepEqual(f.lobby.homeworlds, { custody: null });
    const option = f.actions.findIndex(step => step.action.type === 'homeworlds' && step.action.enabled === true);
    const ready = f.actions.findIndex(step => step.action.type === 'ready');
    assert.ok(option >= 0 && option < ready); assert.equal(f.actions[option].actor, f.initial.host);
    assert.equal(f.setup.status, 'setup'); freshWorlds(f.setup);
    assert.equal(f.game.advanced, false); assert.equal(f.game.phase, 1); assert.equal(f.game.turn, 1);
    assert.equal(f.homeworlds, true); assert.equal(f.independent, false);
    assert.ok(!f.game.techTokens && !f.game.strongholdCards && !f.game.ecazTreachery &&
      !f.game.leaderSkills && !f.game.nexusCards && !f.game.discoveryEnabled && !f.game.semutaPreview);
    assert.deepEqual(f.game.expansions, selected.expansions);
    assert.equal(f.originalInventory.length, treacheryDeck(selected.expansions).length);
    assert.deepEqual(mixedPhaseModulesInventory(f.game), f.originalInventory);
    components(f.afterSetup); assert.deepEqual(f.staging, []);
  }
});

for (const advanced of [false, true]) void test(`public all-six ${advanced ? 'Advanced World independent cards, Tech and Strongholds' : 'Basic World Tech'} earns native shipments, revival and delayed payouts`, () => {
  const f = createMixedPhaseModulesProgramme({ advanced, homeworlds: true, independent: advanced });
  freshWorlds(f.setup); components(f.afterSetup);
  assert.equal(f.setup.deck.length, advanced ? 50 : 47); assert.equal(f.setup.richeseCache?.length, 10);
  assert.equal(f.originalInventory.length, advanced ? 60 : 57);
  assert.equal(f.setup.ecazTreachery === true, advanced);
  assert.ok(!f.game.leaderSkills && !f.game.nexusCards && !f.game.discoveryEnabled && !f.game.semutaPreview);
  for (const [actor, receipt, key] of [
    ['choam', f.choamShipment, f.choamLocation], ['moritani', f.moritaniShipment, f.casualtyLocation],
  ] as const) {
    const action = receipt.steps[0].action;
    assert.equal(action.type, 'ship'); assert.equal(action.amount, 1); assert.equal(action.elite, 0);
    assert.deepEqual(action.homeworldSources, nativeShipmentSources(viewGame(receipt.before, actor), 1, 0));
    assert.equal(player(receipt.after, actor).reserves, player(receipt.before, actor).reserves - 1);
    assert.equal(player(receipt.after, actor).forces[key], 1);
    assert.equal(player(receipt.before, actor).spice - player(receipt.after, actor).spice, actor === 'choam' ? 1 : 2);
    const earned = ownedTech(receipt.after.techTokens, 'ixians').length;
    assert.equal(receipt.after.techTokens?.heighliners.spice, earned);
    assert.equal(receipt.after.techTokens?.heighliners.triggeredTurn, 1);
    assert.equal(player(receipt.after, 'ixians').spice, player(receipt.before, 'ixians').spice);
  }
  const shipmentIncome = f.shipmentPayout.before.techTokens!.heighliners.spice;
  assert.ok(shipmentIncome > 0); assert.equal(f.shipmentPayout.after.techTokens?.heighliners.spice, 0);
  assert.equal(player(f.shipmentPayout.after, 'ixians').spice - player(f.shipmentPayout.before, 'ixians').spice, shipmentIncome);
  if (advanced) {
    assert.equal(f.mentat.before.strongholdCards?.claimedTurn, 0);
    assert.equal(f.mentat.after.strongholdCards?.claimedTurn, 1);
    assert.equal(f.mentat.after.strongholdCards?.owners.carthag, 'moritani');
    assert.equal(f.mentat.after.strongholdCards?.owners.sietch_tabr, 'choam');
    assert.equal(f.mentat.after.strongholdCards?.owners[MOBILE_STRONGHOLD], 'ixians');
  }
  assert.equal(f.storm.before.stormMovementSource?.kind, advanced ? 'card' : 'dials');
  assert.equal(f.storm.before.stormPending, advanced ? 1 : 2);
  assert.equal(player(f.storm.after, 'moritani').tanks, 1);
  assert.equal(player(f.storm.after, 'moritani').forces[f.casualtyLocation], undefined);
  const view = viewGame(f.revival.before, 'moritani');
  assert.ok(view.revival.freeRemaining >= 1); assert.equal(view.revival.tleilaxuHomeworldIncomeBlocked, false);
  const quote = forceRevivalQuote(f.revival.before, player(f.revival.before, 'moritani'), 1, 0);
  assert.equal(quote.free, 1); assert.equal(quote.cost, 0);
  assert.deepEqual(f.revival.steps[0], { actor: 'moritani', action: { type: 'revive', amount: 1, elite: 0 } });
  if (advanced) assert.equal(f.revival.before.revivalOrder?.remaining[0], 'moritani');
  assert.equal(player(f.revival.after, 'moritani').tanks, 0);
  assert.equal(player(f.revival.after, 'moritani').reserves - player(f.revival.before, 'moritani').reserves, 1);
  assert.equal(player(f.revival.after, 'moritani').spice, player(f.revival.before, 'moritani').spice - quote.cost);
  assert.equal(player(f.revival.after, 'tleilaxu').spice - player(f.revival.before, 'tleilaxu').spice, 1);
  assert.equal(f.revival.after.techTokens?.axlotl.spice, ownedTech(f.revival.after.techTokens, 'tleilaxu').length);
  const revivalIncome = f.revivalPayout.before.techTokens!.axlotl.spice;
  assert.ok(revivalIncome > 0); assert.equal(f.revivalPayout.after.techTokens?.axlotl.spice, 0);
  assert.equal(player(f.revivalPayout.after, 'tleilaxu').spice - player(f.revivalPayout.before, 'tleilaxu').spice, revivalIncome);
  assert.equal(f.game.phase, 5); assert.equal(f.game.turn, 2); assert.ok(mixedPhaseModulesClean(f.game));
  assert.deepEqual(mixedPhaseModulesInventory(f.game), f.originalInventory); components(f.game);
  assert.deepEqual(f.staging, []);
});
