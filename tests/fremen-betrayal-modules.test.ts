import assert from 'node:assert/strict';
import { test } from 'node:test';
import { viewGame, type Game } from '../game/engine';
import { location } from '../game/board';
import { homeworldContext } from '../game/homeworld-game';
import { homeworldForceGroups } from '../game/homeworld-custody';
import {
  actFremenBetrayalModules, advanceFremenBetrayalModules, createFremenBetrayalModulesFixture,
  finishFremenBetrayalMovement, finishFremenBetrayalWorm, fremenBetrayalModulesClean,
  fremenBetrayalModulesMove, fremenBetrayalModulesPlayer as player, smokeFremenBetrayalModules,
  type FremenBetrayalModulesFixture,
} from './fixture-fremen-betrayal-modules';

function originalCard(f: FremenBetrayalModulesFixture) {
  assert.equal(f.beforeDraw.nexusCards!.cards!.hands.guild, null);
  assert.equal(f.afterDraw.nexusCards!.cards!.hands.guild, 'fremen');
  assert.equal(player(f.afterDraw, 'guild').ally, null);
  assert.equal(player(f.afterDraw, 'fremen').ally, 'emperor');
  assert.equal(player(f.afterDraw, 'emperor').ally, 'fremen');
  assert.ok(f.actions.some(step => step.actor === 'guild' && step.action.type === 'nexusCardChoice'));
}
function spentCard(game: Game, mode: 'worm' | 'movement') {
  assert.equal(game.nexusCards!.cards!.hands.guild, null);
  assert.equal(game.nexusCards!.cards!.discard.filter(card => card === 'fremen').length, 1);
  assert.equal(game.nexusFremenBetrayalHistory!.at(-1)!.mode, mode);
}
function nativePool(game: Game, id: string) {
  return homeworldForceGroups(homeworldContext(game), game.homeworlds!.custody!)
    .find(group => group.id === id)!.forces.fremen;
}

for (const advanced of [false, true]) {
  void test(`original ${advanced ? 'Advanced typed' : 'Basic'} selected-family World/training Fremen Betrayal suppresses native range and preserves a real ordinary move`, () => {
    const f = createFremenBetrayalModulesFixture({ advanced });
    originalCard(f);
    assert.deepEqual(f.game.expansions, ['ix', 'choam', 'ecaz']);
    assert.ok(f.game.homeworlds && f.game.leaderSkills && f.game.techTokens);
    assert.equal(!!f.game.strongholdCards, advanced);
    assert.equal(f.game.active, f.rider);
    assert.equal(player(f.game, f.rider).moved, 0);
    assert.equal(player(f.game, f.rider).forces[f.source], 10);
    const long = fremenBetrayalModulesMove(f.game, f.source, 2);
    let native = actFremenBetrayalModules(structuredClone(f.game), f.rider, long);
    native = advanceFremenBetrayalModules(native, fremenBetrayalModulesClean);
    assert.equal(player(native, f.rider).moved, 1, 'The original unspent native movement reaches range two');
    const { game, spent, moved, move } = finishFremenBetrayalMovement(f);
    spentCard(spent, 'movement');
    assert.equal(player(spent, f.rider).fremenNexusMovementBlockedTurn, spent.turn);
    assert.deepEqual(player(spent, f.rider).forces, player(f.game, f.rider).forces,
      'The advance declaration moves no original board counter');
    assert.deepEqual(spent.homeworlds, f.game.homeworlds);
    assert.throws(() => actFremenBetrayalModules(spent, f.rider, long), /more than 1 territories away/i);
    assert.equal(player(moved, f.rider).moved, 1);
    assert.equal(player(moved, f.rider).forces[f.source], 9);
    const to = location(String(move.territory), Number(move.sector));
    assert.equal(player(moved, f.rider).forces[to], 1);
    if (advanced) {
      assert.equal(player(moved, f.rider).elites!.forces[f.source] ?? 0, 0);
      assert.equal(player(moved, f.rider).elites!.forces[to], 1, 'The actual starting Fedaykin moves as its original starred counter');
    }
    assert.equal(player(moved, f.rider).reserves, player(f.game, f.rider).reserves);
    assert.equal(player(moved, f.rider).spice, player(f.game, f.rider).spice);
    assert.equal(moved.pendingFremenMove ?? null, null);
    assert.equal(moved.response ?? null, null, 'The ordinary range-one move opens no native advantage cancellation');
    assert.equal(game.turn, f.game.turn + 1);
    assert.equal(viewGame(game, f.rider).players.find(row => row.id === f.rider)!.fremenNexusMovementBlocked, false);
    spentCard(game, 'movement');
  });
}

void test('original free Fremen reinforcement and city entry preserve independent ornithopter range under selected-module Betrayal', () => {
  const f = createFremenBetrayalModulesFixture({ city: true });
  originalCard(f);
  assert.equal(f.shipments[0].step.actor, f.rider);
  assert.equal(f.shipments[0].step.action.territory, 'hagga_basin');
  assert.ok(f.shipments[0].step.action.homeworldSources);
  assert.equal(player(f.shipments[0].after, f.rider).reserves,
    player(f.shipments[0].before, f.rider).reserves - 1);
  assert.equal(player(f.shipments[0].after, f.rider).spice,
    player(f.shipments[0].before, f.rider).spice, 'The printed native reinforcement is free');
  assert.equal(f.cityMove!.action.from, 'hagga_basin:12');
  assert.equal(f.cityMove!.action.territory, 'carthag');
  assert.equal(player(f.game, f.rider).forces['carthag:11'], 1);
  const { spent, moved, move } = finishFremenBetrayalMovement(f, 3);
  spentCard(spent, 'movement');
  assert.equal(player(moved, f.rider).forces['carthag:11'], 1);
  assert.equal(player(moved, f.rider).forces[location(String(move.territory), Number(move.sector))], 1);
  assert.equal(moved.pendingFremenMove ?? null, null, 'City range does not borrow the suppressed native Fremen advantage');
});

void test('original World/training Great Maker votes and ordinary native worm destruction continue while advance Betrayal prevents both ride sources', () => {
  const f = createFremenBetrayalModulesFixture({ program: 'worm' });
  originalCard(f);
  assert.equal(f.game.turn, 3);
  assert.equal(f.game.phase, 1);
  assert.ok(f.game.discoveries && f.game.homeworlds && f.game.leaderSkills);
  assert.equal(player(f.game, f.victim).forces['red_chasm:7'], 1);
  assert.equal(player(f.game, f.rider).forces['hagga_basin:12'], 2);
  assert.equal(player(f.game, f.rider).elites!.forces['hagga_basin:12'], 1);
  const victim = player(f.game, f.victim), rider = player(f.game, f.rider);
  const { game, spent, votes, rides, ordinaryRides, cunningOffers } = finishFremenBetrayalWorm(f);
  spentCard(spent, 'worm');
  assert.equal(player(spent, f.rider).fremenNexusWormBlockedTurn, spent.turn);
  assert.deepEqual(player(spent, f.rider).forces, rider.forces);
  assert.equal(votes.length, f.game.players.length);
  assert.deepEqual(votes.map(step => step.actor), game.greatMaker!.order);
  assert.ok(game.greatMaker!.votes.every(vote => vote.yes));
  assert.equal(game.greatMaker!.stage, 'complete');
  assert.equal(rides.length, 0, 'A current restriction skips the Great Maker reserve-ride control');
  assert.equal(ordinaryRides.length, 0, 'The later actual native Hagga worm grants no board ride');
  assert.equal(cunningOffers.length, 0);
  assert.deepEqual(game.wormRides, []);
  assert.equal(player(game, f.victim).forces['red_chasm:7'] ?? 0, 0);
  assert.equal(player(game, f.victim).tanks, victim.tanks + 1, 'The genuine paid victim is devoured despite the restriction');
  assert.equal(game.spice['red_chasm:7'] ?? 0, 0);
  assert.equal(game.spice['hagga_basin:12'] ?? 0, 0);
  assert.equal(player(game, f.rider).forces['hagga_basin:12'], 2, 'Native worm survival remains in effect');
  assert.equal(player(game, f.rider).elites!.forces['hagga_basin:12'], 1);
  assert.equal(player(game, f.rider).reserves, rider.reserves);
  assert.equal(player(game, f.rider).elites!.reserves, rider.elites!.reserves);
  assert.deepEqual(nativePool(game, 'homeworld:fremen'), nativePool(f.game, 'homeworld:fremen'));
  assert.ok(game.spiceDiscard[0].some(card => 'worm' in card && !!card.greatMaker));
  assert.ok(game.spiceDiscard[0].some(card => 'territory' in card && card.territory === 'habbanya_erg'));
  assert.ok(game.spiceDiscard[1].some(card => 'territory' in card && card.territory === 'oh_gap'));
  assert.equal(game.nexusCards!.phase!.occurred, true);
  assert.equal(game.nexusCards!.phase!.stage, 'complete');
  assert.equal(game.phase, 2, 'Both replacement blows and original Nexus finish before charity');
  spentCard(game, 'worm');
});

void test('the same original unspent Great Maker offers and completes a typed native reserve ride before normal worm riding', () => {
  const f = createFremenBetrayalModulesFixture({ program: 'worm' });
  const { game, rides, ordinaryRides } = finishFremenBetrayalWorm(f, false);
  assert.equal(rides.length, 1);
  assert.equal(rides[0].before.decision!.kind, 'greatMakerRide');
  assert.equal(rides[0].action.amount, 1);
  assert.equal(rides[0].action.elite, 1);
  const before = player(rides[0].before, f.rider), after = player(rides[0].after, f.rider);
  assert.equal(after.reserves, before.reserves - 1);
  assert.equal(after.elites!.reserves, before.elites!.reserves - 1);
  assert.equal(after.forces['polar_sink:0'], 1);
  assert.equal(after.elites!.forces['polar_sink:0'], 1);
  assert.equal(after.spice, before.spice);
  assert.equal(after.moved, before.moved);
  assert.equal(after.shipped, before.shipped);
  assert.equal(ordinaryRides.length, 1, 'The distinct occupied Hagga appearance retains its normal later ride control');
  assert.equal(game.nexusCards!.cards!.hands.guild, 'fremen');
  assert.equal(game.nexusFremenBetrayalHistory?.length ?? 0, 0);
  assert.equal(game.phase, 2);
});

void test('a genuine second-pile empty worm offers native Cunning after the Great Maker completes and the real Nexus ends its alliance', () => {
  const f = createFremenBetrayalModulesFixture({ program: 'worm', emptyAfterMaker: true });
  const { game, cunningOffers, rides, actions } = finishFremenBetrayalWorm(f, false);
  assert.equal(rides.length, 1);
  assert.equal(cunningOffers.length, 1);
  const offered = cunningOffers[0];
  assert.equal(offered.greatMaker!.stage, 'complete');
  assert.equal(offered.nexusFremenCunningOffer!.occurrence.territory, 'sihaya_ridge');
  assert.equal(offered.nexusFremenCunningOffer!.occurrence.initiallyEmpty, true);
  assert.equal(player(offered, f.rider).ally, null);
  assert.equal(offered.nexusCards!.cards!.hands.guild, 'fremen');
  assert.equal(offered.nexusCards!.cards!.hands.fremen, null, 'The public native offer does not disclose or require the private held face');
  assert.ok(actions.some(step => step.actor === f.rider && step.action.type === 'alliance' && step.action.target === null));
  assert.equal(game.nexusFremenCunningOffer ?? null, null);
  assert.equal(game.phase, 2);
});

void test('all four minimal policies retain genuine selected-module movement and Discovery worm declarations', () => {
  for (const program of ['movement', 'worm'] as const) {
    const report = smokeFremenBetrayalModules({ program });
    assert.equal(report.length, 4);
    assert.ok(report.every(result => result.restricted && result.spent === 1));
    assert.ok(report.every(result => result.mode === program));
  }
});
