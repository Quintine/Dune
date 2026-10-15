import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, viewGame, type Action, type Game, type GameView } from '../game/engine';
import { homeworldContext, homeworldGameIntegrity } from '../game/homeworld-game';
import { homeworldForceGroups } from '../game/homeworld-custody';
import { quoteHomeworldShipment } from '../game/homeworld-shipment';
import { homeworldShipmentChoice } from '../game/homeworld-shipment-options';
import { guildHomeworldShipmentChoice } from '../game/guild-homeworld-shipment-options';
import { junctionTransportChoice } from '../game/junction-transport-options';
import {
  createNativeGuildHomeworldRate, createNativeGuildHomeworldRateScene,
  createNativeImmuneJunctionRate, nativeGuildHomeworldAction,
  passNativeGuildHomeworldResponses, type NativeGuildHomeworldRateFixture,
  createControlledGuildCunningHomeworldRateScene,
} from './fixture-native-guild-homeworld-rate';
import { pairedE3NexusPlayer as player, stepPairedE3Nexus } from './fixture-paired-e3-nexus-modules';

const act = (g: Game, actor: string, action: Action) => applyAction(structuredClone(g), actor, action);
function context(g: Game, nativeGuildRateCanceled?: boolean) {
  return { ...homeworldContext(g), nativeGuildRateCanceled,
    players: homeworldContext(g).players.map(p => ({ ...p, ally: player(g, p.id).ally })),
    storm: g.storm, mobileStronghold: g.mobileStronghold?.location ?? null,
    discoveries: g.discoveries,
    board: Object.fromEntries(g.players.map(p => [p.id, { forces: p.forces, eliteForces: p.elites?.forces ?? {} }])),
  };
}
function assertUnpaid(f: NativeGuildHomeworldRateFixture, state: Game) {
  const before = f.beforeAction;
  assert.deepEqual(state.homeworlds, before.homeworlds);
  assert.deepEqual(state.aid, before.aid);
  for (const id of [f.guild, f.entrant]) {
    assert.equal(player(state, id).spice, player(before, id).spice);
    assert.equal(player(state, id).reserves, player(before, id).reserves);
    assert.deepEqual(player(state, id).forces, player(before, id).forces);
    assert.equal(player(state, id).shipped, player(before, id).shipped);
  }
  assert.ok(!state.pendingArrivalReaction);
  assert.ok(!state.pendingAmbassador);
}
function assertPaid(f: NativeGuildHomeworldRateFixture, paid: Game, amount: number, cost: number) {
  const before = f.beforeAction;
  const old = player(before, f.guild), guild = player(paid, f.guild);
  // A Guild shipper pays its own share to the bank. The approved Moritani
  // share independently earns the Guild its existing FAQ contributor income.
  const settled = passNativeGuildHomeworldResponses(paid, 'guildIncome').game;
  assert.equal(player(settled, f.guild).spice, old.spice - cost + 2);
  // Pledging already debited the donor wallet before this declaration.
  assert.equal(player(settled, f.entrant).spice, player(before, f.entrant).spice);
  assert.equal(settled.aid[f.entrant].amount, 0);
  assert.equal(guild.shipped, true);
  assert.equal(guild.reserves, old.reserves + (f.route === 'return' ? amount : f.route === 'world' ? -amount : 0));
  if (f.route !== 'world')
    assert.equal(guild.forces[f.source] ?? 0, old.forces[f.source] - amount);
  else assert.deepEqual(guild.forces, old.forces);
  if (f.route !== 'return') {
    assert.deepEqual(settled.homeworlds!.custody!.visitors[f.destination][f.guild], { normal: amount, elite: 0 });
  } else assert.equal(settled.homeworlds!.custody!.visitors[f.destination]?.[f.guild], undefined);
  assert.ok(!settled.pendingHomeworldShipment);
  assert.ok(!settled.pendingArrivalReaction);
  assert.ok(!settled.pendingAmbassador);
  homeworldGameIntegrity(settled);
  const worlds = homeworldForceGroups(context(settled), settled.homeworlds!.custody!);
  const physical = Object.values(player(settled, f.guild).forces).reduce((n, count) => n + count, 0) +
    worlds.reduce((n, w) => n + (w.forces[f.guild]?.normal ?? 0) + (w.forces[f.guild]?.elite ?? 0), 0);
  assert.equal(physical, 20);
  return settled;
}

for (const route of ['world', 'arrakisForeign', 'return'] as const) {

  void test(`original native Homeworld ${route}: actual auctioned Ecaz Karama precedes every debit and physical transfer`, () => {
    const scene = createNativeGuildHomeworldRateScene(route);
    assertUnpaid(scene, scene.game);
    assert.equal(scene.game.pendingHomeworldShipment?.cost, 2);
    assert.equal(scene.game.pendingHomeworldShipment?.allyPayment, 1);
    assert.deepEqual(scene.game.pendingHomeworldShipment?.sources, scene.sources);
    const stored = structuredClone(scene.game);
    assert.throws(() => act(stored, scene.entrant, scene.cancel.action));
    assert.deepEqual(stored, scene.game);
    const canceled = stepPairedE3Nexus(scene.game, scene.cancel);
    const settled = assertPaid(scene, canceled, 3, 3);
    assert.equal(settled.discard.filter(c => c.id === scene.karama).length, 1);
    assert.throws(() => act(settled, scene.guild, scene.action));
    const next = act(settled, scene.guild, { type: 'endMovement' });
    assert.notEqual(next.active, scene.guild);
    assert.deepEqual(player(next, scene.guild).forces, player(settled, scene.guild).forces);
  });

  void test(`original native Homeworld ${route}: passing preserves the rounded half tariff and original approved split`, () => {
    const scene = createNativeGuildHomeworldRateScene(route);
    assertUnpaid(scene, scene.game);
    const allowed = passNativeGuildHomeworldResponses(scene.game, 'guildRate').game;
    const settled = assertPaid(scene, allowed, 3, 2);
    assert.ok(player(settled, scene.ecaz).hand.some(c => c.id === scene.karama));
  });

  void test(`original native Homeworld ${route}: unaffordable cancellation releases unchanged typed custody and supports a full-price replacement`, () => {
    const scene = createNativeGuildHomeworldRateScene(route, { unaffordable: true });
    assert.equal(player(scene.beforeAction, scene.guild).spice, 1);
    assertUnpaid(scene, scene.game);
    const released = stepPairedE3Nexus(scene.game, scene.cancel);
    assertUnpaid(scene, released);
    assert.ok(!released.pendingHomeworldShipment);
    assert.equal(released.response, null);
    assert.equal(released.decision, null);
    assert.equal(viewGame(released, scene.guild).guildRateCanceled, true);
    assert.equal(viewGame(released, scene.ecaz).guildRateCanceled, false);
    const view = viewGame(released, scene.guild);
    const consumer = route === 'world' ? homeworldShipmentChoice : guildHomeworldShipmentChoice;
    const unchanged = consumer(view, scene.destination, scene.sources, 1);
    assert.equal(unchanged.cost, 3);
    assert.equal(unchanged.ownPayment, 2);
    assert.ok(unchanged.blocked);
    const action = nativeGuildHomeworldAction(scene, released, 2, 1);
    assert.deepEqual(action.sources, { [scene.source]: { normal: 2, elite: 0 } });
    let replacement = act(released, scene.guild, action);
    if (replacement.decision?.kind === 'homeworldShipmentGuild')
      replacement = act(replacement, scene.guild, { type: 'decision', event: replacement.decision.event, allow: true });
    assert.notEqual(replacement.response?.kind, 'guildRate');
    const settled = assertPaid(scene, replacement, 2, 2);
    assert.equal(settled.discard.filter(c => c.id === scene.karama).length, 1);
  });
}

void test('non-Guild world-to-world remains full price; controlled Secret Ally owner quote stays independent of native cancellation', () => {
  const f = createNativeGuildHomeworldRate('world'), g = f.beforeAction;
  const intent = { player: f.ecaz, destination: 'homeworld:moritani',
    sources: { 'homeworld:ecaz': { normal: 3, elite: 0 } } };
  assert.equal(quoteHomeworldShipment(context(g, true), g.homeworlds!.custody!, intent).cost, 3);
  // Narrow controlled presentation fixture, not an original action producer:
  // Secret Ally legally requires Guild absent, no alliance, and an owned card.
  const original = viewGame(g, f.ecaz);
  const event = JSON.stringify(['nexusGuildSecretAlly', original.turn, f.ecaz]);
  const view = { ...original, active: f.ecaz, guildRateCanceled: true,
    players: original.players.filter(p => p.id !== f.guild).map(p => ({ ...p, ally: null, shipped: false })),
    homeworlds: { ...original.homeworlds!, worlds: original.homeworlds!.worlds!.filter(w => w.native !== f.guild) },
    homeworldShipment: { event: 'controlled-secret-world-quote', blocked: null },
    nexusCards: { ...original.nexusCards!, card: 'guild', waiting: [] },
    nexusGuildSecretAlly: { event, blocked: null },
  } as GameView;
  const ordinary = homeworldShipmentChoice(view, intent.destination, intent.sources);
  const secret = homeworldShipmentChoice(view, intent.destination, intent.sources, 0, event);
  assert.equal(ordinary.cost, 3);
  assert.equal(secret.cost, 2);
  assert.equal(secret.blocked, null);
});

for (const rate of ['half', 'full'] as const) {
  void test(`original immune Junction ${rate} offer after actual native cancellation keeps its printed tariff and no second rate queue`, () => {
    const f = createNativeImmuneJunctionRate(rate), before = f.beforeAction;
    const cost = rate === 'half' ? 2 : 3;
    assert.equal(viewGame(before, f.entrant).guildRateCanceled, true);
    const view = viewGame(before, f.entrant);
    assert.equal(junctionTransportChoice(view, f.destination, f.sources).cost, cost);
    const done = act(before, f.entrant, f.action);
    assert.notEqual(done.response?.kind, 'guildRate');
    assert.equal(done.decision, null);
    assert.ok(!done.pendingHomeworldShipment);
    assert.equal(player(done, f.entrant).spice, player(before, f.entrant).spice - cost);
    assert.equal(player(done, f.guild).spice, player(before, f.guild).spice);
    assert.equal(player(done, f.entrant).reserves, player(before, f.entrant).reserves + 3);
    assert.equal(player(done, f.entrant).forces[f.source], player(before, f.entrant).forces[f.source] - 3);
    assert.equal(player(done, f.entrant).shipped, true);
    assert.equal(done.discard.filter(c => c.id === f.karama).length, 1);
    homeworldGameIntegrity(done);
  });
}

for (const outcome of ['allow', 'cancel', 'unaffordable'] as const) {
  void test(`controlled Cunning Homeworld ${outcome}: the native rate retains one original second-shipment allowance`, () => {
    const f = createControlledGuildCunningHomeworldRateScene(outcome === 'unaffordable');
    const before = f.beforeAction, record = before.nexusGuildCunningHistory!.at(-1)!;
    assert.equal(record.stage, 'secondShipment');
    assert.equal(record.shipment, undefined);
    assert.deepEqual(f.game.homeworlds, before.homeworlds);
    assert.equal(player(f.game, f.owner).spice, player(before, f.owner).spice);
    assert.equal(player(f.game, f.owner).reserves, player(before, f.owner).reserves);
    assert.equal(f.game.nexusGuildCunningHistory!.at(-1)!.shipment?.stage, 'pending');
    assert.equal(f.game.pendingHomeworldShipment?.guildNexusEvent, record.receipt.event);
    let done = outcome === 'allow'
      ? passNativeGuildHomeworldResponses(f.game, 'guildRate').game
      : stepPairedE3Nexus(f.game, f.cancel);
    if (outcome === 'unaffordable') {
      assert.equal(player(done, f.owner).spice, 2);
      assert.deepEqual(done.homeworlds, before.homeworlds);
      assert.equal(player(done, f.owner).reserves, player(before, f.owner).reserves);
      assert.equal(done.nexusGuildCunningHistory!.at(-1)!.stage, 'secondShipment');
      assert.equal(done.nexusGuildCunningHistory!.at(-1)!.shipment, undefined);
      assert.ok(!done.pendingHomeworldShipment);
      const choice = homeworldShipmentChoice(viewGame(done, f.owner), f.destination,
        { 'homeworld:guild': { normal: 2, elite: 0 } }, 0);
      assert.equal(choice.cost, 2);
      assert.ok(choice.action);
      done = act(done, f.owner, choice.action);
      assert.notEqual(done.response?.kind, 'guildRate');
    }
    const amount = outcome === 'unaffordable' ? 2 : 3;
    const cost = outcome === 'cancel' ? 3 : 2;
    assert.equal(player(done, f.owner).spice, player(before, f.owner).spice - cost);
    assert.equal(player(done, f.owner).reserves, player(before, f.owner).reserves - amount);
    assert.deepEqual(done.homeworlds!.custody!.visitors[f.destination][f.owner], { normal: amount, elite: 0 });
    assert.equal(done.nexusGuildCunningHistory!.at(-1)!.shipment?.stage, 'complete');
    assert.equal(done.nexusGuildCunningHistory!.at(-1)!.receipt.event, record.receipt.event);
    assert.equal(done.nexusCards!.cards!.discard.filter(card => card === 'guild').length, 1);
    assert.equal(done.discard.filter(card => card.id === f.karama).length, outcome === 'allow' ? 0 : 1);
    const another = homeworldShipmentChoice(viewGame(done, f.owner), f.destination,
      { 'homeworld:guild': { normal: 1, elite: 0 } }, 0);
    assert.equal(another.action, null);
    assert.ok(another.blocked);
    homeworldGameIntegrity(done);
  });
}
