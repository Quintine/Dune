import assert from 'node:assert/strict';
import test from 'node:test';
import { viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import {
  actNexusFremenReactiveBetrayal, createNexusFremenReactiveBetrayalFixture,
  finishNexusFremenReactiveBetrayal, nexusFremenReactiveBetrayalInventory,
  nexusFremenReactiveBetrayalPhysical, nexusFremenReactiveBetrayalPlayer as player,
  passNexusFremenReactiveBetrayal, rideNexusFremenReactiveBetrayal,
  useNexusFremenReactiveBetrayal, type NexusFremenReactiveBetrayalFixture,
} from './fixture-nexus-fremen-reactive-betrayal';

function rejected(game: Game, actor: string, action: Action) {
  const before = structuredClone(game);
  assert.throws(() => actNexusFremenReactiveBetrayal(game, actor, action));
  assert.deepEqual(game, before);
}
function completedReceipt(game: Game, f: NexusFremenReactiveBetrayalFixture, usedBy: string | null) {
  const receipt = game.nexusFremenRideBetrayal;
  assert.ok(receipt);
  assert.equal(receipt.stage, 'complete');
  assert.equal(receipt.usedBy, usedBy);
  assert.equal(receipt.event, f.originalFrame.event);
  assert.equal(receipt.turn, f.originalFrame.turn);
  assert.deepEqual(receipt.source, f.originalDecision);
  assert.deepEqual(receipt.order, f.originalFrame.order);
  assert.ok(receipt.signature);
  assert.notEqual(receipt.signature, f.originalFrame.signature);
  if (usedBy === null) assert.deepEqual(receipt.passed, receipt.order);
  for (const seat of game.players)
    assert.equal(viewGame(game, seat.id).nexusFremenRideBetrayal ?? null, null);
}
function source(f: NexusFremenReactiveBetrayalFixture) {
  assert.equal(f.game.status, 'playing');
  assert.equal(f.game.turn, 3);
  assert.equal(f.game.phase, 1);
  assert.equal(f.game.response ?? null, null);
  assert.equal(f.game.phaseOpening ?? null, null);
  assert.ok(f.game.decision?.kind === 'nexusFremenRideBetrayal');
  assert.equal(f.game.decision.player, f.holder);
  assert.equal(f.beforeDraw.nexusCards!.cards!.hands[f.holder], null);
  assert.equal(f.afterDraw.nexusCards!.cards!.hands[f.holder], 'fremen');
  assert.equal(f.game.nexusCards!.cards!.hands[f.holder], 'fremen');
  assert.equal(player(f.game, f.holder).ally, null);
  assert.equal(player(f.game, f.rider).ally, 'emperor');
  assert.equal(player(f.game, 'emperor').ally, f.rider);
  assert.equal(f.draw.action.type, 'nexusCardChoice');
  assert.equal(f.shipment.action.type, 'ship');
  assert.equal(f.shipment.action.amount, 2);
  assert.equal(player(f.afterShipment, f.rider).reserves, player(f.beforeShipment, f.rider).reserves - 2);
  assert.equal(player(f.afterShipment, f.rider).spice, player(f.beforeShipment, f.rider).spice);
  assert.equal(player(f.game, f.rider).forces['hagga_basin:12'], 2);
  assert.deepEqual(player(f.game, f.rider).forces, player(f.beforeAppearance, f.rider).forces,
    'The real worm and neutral counter window have not transported the native survivors');
  assert.equal(f.game.nexusCards!.phase!.occurred, true);
  assert.ok(f.actions.some(step => step.actor === f.rider && step.action.type === 'alliance'));
  assert.ok(f.actions.some(step => step.actor === f.holder && step.action.type === 'nexusCardChoice' && step.action.choice === 'draw'));
  assert.ok(!f.actions.some(step => step.action.type === 'nexusFremenBetrayal'), 'No advance Betrayal substitutes for the reactive source');
  assert.equal(f.sourceActionCount, f.actions.length);
  assert.deepEqual(nexusFremenReactiveBetrayalInventory(f.game), f.originalInventory);
  assert.equal(f.game.homeworlds ?? null, null);
  assert.equal(f.game.leaderSkills ?? null, null);
  assert.equal(f.game.techTokens ?? null, null);
  if (f.kind === 'greatMaker') {
    assert.ok(f.game.discoveries);
    assert.equal(f.originalDecision.kind, 'greatMakerRide');
    assert.equal(f.game.greatMaker!.stage, 'ride');
    assert.deepEqual(f.game.greatMaker!.votes.map(vote => vote.yes), f.game.order.map(() => true));
  } else {
    assert.equal(f.game.discoveries ?? null, null);
    assert.deepEqual(f.originalDecision, { kind: 'wormRide', player: f.rider, territory: 'hagga_basin' });
    assert.ok(f.actions.some(step => step.action.type === 'ready'), 'Actual native readiness completes the Nexus before its pending ride');
  }
}

const variants = [
  { kind: 'ordinary', advanced: false, label: 'Basic ordinary' },
  { kind: 'ordinary', advanced: true, label: 'Advanced ordinary' },
  { kind: 'greatMaker', advanced: true, label: 'Advanced Great Maker' },
] as const;

for (const variant of variants) {
  void test(`genuine ${variant.label} reactive Fremen Betrayal spends the native draw and stops only the unmade ride`, () => {
    const f = createNexusFremenReactiveBetrayalFixture(variant);
    source(f);
    const physical = nexusFremenReactiveBetrayalPhysical(f.game);
    let game = useNexusFremenReactiveBetrayal(f);
    completedReceipt(game, f, f.holder);
    assert.equal(game.nexusCards!.cards!.hands[f.holder], null);
    assert.equal(game.nexusCards!.cards!.discard.filter(card => card === 'fremen').length, 1);
    assert.equal(player(game, f.rider).fremenNexusWormBlockedTurn, game.turn);
    assert.deepEqual(nexusFremenReactiveBetrayalPhysical(game), physical,
      'The response spends its original Nexus card without moving or killing surviving riders');
    assert.equal(game.nexusFremenBetrayalHistory!.at(-1)!.mode, 'worm');
    assert.equal(game.nexusFremenBetrayalHistory!.at(-1)!.owner, f.holder);
    assert.deepEqual(game.wormRides, []);
    rejected(game, f.holder, f.action);
    game = finishNexusFremenReactiveBetrayal(f, game);
    assert.equal(game.phase, 2);
    assert.equal(game.nexusCards!.phase!.stage, 'complete');
    assert.equal(player(game, f.rider).forces['hagga_basin:12'], 2);
    assert.equal(player(game, f.rider).forces['polar_sink:0'] ?? 0, 0);
    assert.equal(player(game, f.rider).reserves, player(f.game, f.rider).reserves);
    assert.equal(game.decision?.kind === 'wormRide' || game.decision?.kind === 'greatMakerRide', false);
    assert.equal(game.nexusFremenBetrayalHistory!.filter(row => row.turn === f.game.turn).length, 1);
    assert.deepEqual(nexusFremenReactiveBetrayalInventory(game), f.originalInventory);
  });

  void test(`genuine ${variant.label} all-pass restores the exact native ride and actually transports its original counters`, () => {
    const f = createNexusFremenReactiveBetrayalFixture(variant);
    source(f);
    const queue = structuredClone(f.game.wormRides), maker = structuredClone(f.game.greatMaker);
    const passed = passNexusFremenReactiveBetrayal(structuredClone(f.game));
    completedReceipt(passed, f, null);
    assert.deepEqual(passed.decision, f.originalDecision);
    assert.deepEqual(passed.wormRides, queue);
    assert.deepEqual(passed.greatMaker, maker);
    assert.deepEqual(nexusFremenReactiveBetrayalPhysical(passed), f.originalPhysical);
    assert.equal(passed.nexusCards!.cards!.hands[f.holder], 'fremen');
    assert.equal(passed.nexusFremenBetrayalHistory?.length ?? 0, 0);
    const ride = rideNexusFremenReactiveBetrayal(f, passed);
    const before = player(ride.before, f.rider), after = player(ride.after, f.rider);
    const amount = f.kind === 'greatMaker' ? 1 : 2;
    assert.equal(after.forces['polar_sink:0'], amount);
    assert.equal(after.spice, before.spice);
    assert.equal(after.shipped, before.shipped);
    assert.equal(after.moved, before.moved);
    if (f.kind === 'greatMaker') {
      assert.equal(after.reserves, before.reserves - 1);
      assert.equal(after.elites!.reserves, before.elites!.reserves - 1);
      assert.equal(after.forces['hagga_basin:12'], 2);
    } else {
      assert.equal(after.reserves, before.reserves);
      assert.equal(after.forces['hagga_basin:12'] ?? 0, 0);
    }
    if (f.advanced) assert.equal(after.elites!.forces['polar_sink:0'], 1);
    const game = finishNexusFremenReactiveBetrayal(f, ride.game);
    assert.equal(game.phase, 2);
    assert.equal(game.nexusCards!.phase!.stage, 'complete');
    assert.equal(game.nexusCards!.cards!.hands[f.holder], 'fremen');
    assert.equal(game.nexusFremenBetrayalHistory?.length ?? 0, 0);
    assert.equal(player(game, f.rider).forces['polar_sink:0'], amount, 'Only the original accepted ride moved these counters');
    assert.deepEqual(nexusFremenReactiveBetrayalInventory(game), f.originalInventory);
  });

  void test(`genuine ${variant.label} reactive window rejects foreign, stale and underlying ride replies without spending`, () => {
    const f = createNexusFremenReactiveBetrayalFixture(variant);
    rejected(f.game, f.rider, f.action);
    rejected(f.game, 'emperor', f.action);
    rejected(f.game, f.holder, { ...f.action, event: 'stale' });
    rejected(f.game, f.holder, { type: 'decision', event: f.action.event, use: 'yes' });
    rejected(f.game, f.rider, f.kind === 'greatMaker'
      ? { type: 'decision', event: f.game.greatMaker!.event, accept: false }
      : { type: 'decision', accept: false });
    assert.equal(f.game.nexusCards!.cards!.hands[f.holder], 'fremen');
    assert.deepEqual(nexusFremenReactiveBetrayalPhysical(f.game), f.originalPhysical);
    assert.deepEqual(nexusFremenReactiveBetrayalInventory(f.game), f.originalInventory);
  });
}

void test('four minimal profiles answer the genuine reactive Fremen ride window with an exact legal native decision', () => {
  for (const variant of variants) {
    const f = createNexusFremenReactiveBetrayalFixture(variant);
    for (const difficulty of DIFFICULTIES) {
      const view = viewGame(f.game, f.holder);
      view.players.find(seat => seat.id === f.holder)!.bot = difficulty;
      const action = botActions(view)[0];
      assert.ok(action, `${variant.label}/${difficulty}`);
      assert.equal(action.type, 'decision');
      assert.equal(action.event, f.action.event);
      assert.equal(typeof action.use, 'boolean');
      const game = actNexusFremenReactiveBetrayal(structuredClone(f.game), f.holder, action);
      assert.notEqual(game.decision?.kind, 'nexusFremenRideBetrayal');
      assert.deepEqual(nexusFremenReactiveBetrayalPhysical(game), f.originalPhysical);
      assert.deepEqual(nexusFremenReactiveBetrayalInventory(game), f.originalInventory);
    }
  }
});
