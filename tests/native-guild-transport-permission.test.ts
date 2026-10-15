import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { guildTransportQuote } from '../game/transport-quote';
import { homeworldShipmentChoice } from '../game/homeworld-shipment-options';
import { guildHomeworldShipmentChoice } from '../game/guild-homeworld-shipment-options';
import { junctionTransportChoice } from '../game/junction-transport-options';
import { botActions } from '../game/bots';
import { passNativeGuildTransportPermission } from './fixture-guild-ambassador-income-arrival';
import { createNativeGuildTransportPermissionScene } from './fixture-native-guild-transport-permission';
import { settleNativeGuildRateModules } from './fixture-native-guild-rate-modules';
import { nexusGuildCunningFixture, originalGuildCunningTurn, nexusGuildCunningRequest,
  nexusGuildCunningAllow } from './fixture-nexus-guild-cunning';
import { pairedE3NexusPlayer as player, stepPairedE3Nexus } from './fixture-paired-e3-nexus-modules';
const act = (g: Game, actor: string, action: Action) => applyAction(structuredClone(g), actor, action);
const stock = (g: Game, id: string) => {
  const p = player(g, id);
  return { spice: p.spice, reserves: p.reserves, forces: p.forces, elites: p.elites,
    shipped: p.shipped, moved: p.moved };
};
function reject(g: Game, actor: string, action: Action) {
  const copy = structuredClone(g), before = structuredClone(copy);
  assert.throws(() => applyAction(copy, actor, action));
  assert.deepEqual(copy, before);
}

for (const route of ['allyCross', 'guildReturn', 'homeworldReturn'] as const) {
  void test(`original ${route}: preventing native permission spends no fee or force, keeps ordinary shipment and does not cancel its price`, () => {
    const f = createNativeGuildTransportPermissionScene(route), before = f.beforeAction;
    assert.deepEqual(stock(f.game, f.shipper), stock(before, f.shipper));
    if (before.homeworlds) assert.deepEqual(f.game.homeworlds, before.homeworlds);
    assert.ok(!f.game.pendingArrivalReaction);
    assert.ok(!f.game.pendingAmbassador);
    reject(f.game, f.shipper, f.action);
    const denied = stepPairedE3Nexus(f.game, f.cancel);
    assert.deepEqual(stock(denied, f.shipper), stock(before, f.shipper));
    if (before.homeworlds) assert.deepEqual(denied.homeworlds, before.homeworlds);
    assert.equal(denied.discard.filter(c => c.id === f.karama).length, 1);
    assert.equal(viewGame(denied, f.shipper).guildTransportCanceled, true);
    assert.equal(viewGame(denied, f.shipper).guildRateCanceled, false);
    reject(denied, f.shipper, f.action);
    const view = viewGame(denied, f.shipper);
    if (route === 'homeworldReturn') {
      assert.ok(guildHomeworldShipmentChoice(view, f.destination,
        { [f.source]: { normal: 3, elite: 0 } }, 1).blocked);
      // Common world-to-world shipment does not use Guild's cross/return privilege.
      const alternative = homeworldShipmentChoice(view, 'homeworld:ecaz',
        { 'homeworld:guild': { normal: 3, elite: 0 } }, 1);
      assert.ok(alternative.action);
      assert.equal(alternative.cost, 2);
      const done = settleNativeGuildRateModules(act(denied, f.shipper, alternative.action)).game;
      assert.deepEqual(done.homeworlds!.custody!.visitors['homeworld:ecaz'][f.shipper], { normal: 3, elite: 0 });
      assert.equal(player(done, f.shipper).reserves, player(before, f.shipper).reserves - 3);
      assert.equal(player(done, f.shipper).forces[f.source], player(before, f.shipper).forces[f.source]);
    } else {
      assert.ok(guildTransportQuote(view, f.action).unavailableReasons.length);
      const alternative: Action = { type: 'ship', territory: route === 'allyCross' ? f.destination : 'carthag',
        sector: route === 'allyCross' ? f.sector : 11, amount: 3, elite: 0, allyPayment: 0 };
      const done = settleNativeGuildRateModules(act(denied, f.shipper, alternative)).game;
      assert.equal(player(done, f.shipper).spice, player(before, f.shipper).spice - 2);
      assert.equal(player(done, f.shipper).reserves, player(before, f.shipper).reserves - 3);
      assert.equal(player(done, f.shipper).forces[f.source], player(before, f.shipper).forces[f.source]);
      assert.equal(player(done, f.shipper).shipped, true);
      const next = act(done, f.shipper, { type: 'endMovement' });
      assert.notEqual(next.active, f.shipper);
    }
  });

  void test(`original ${route}: allowing permission still permits a separate full-price rate cancellation`, () => {
    const f = createNativeGuildTransportPermissionScene(route), before = f.beforeAction;
    const priced = passNativeGuildTransportPermission(f.game).game;
    assert.equal(priced.response?.kind, 'guildRate');
    assert.deepEqual(stock(priced, f.shipper), stock(before, f.shipper));
    const done = settleNativeGuildRateModules(act(priced, f.cancelor,
      { type: 'card', mode: 'cancel', card: f.karama })).game;
    assert.equal(player(done, f.shipper).shipped, true);
    assert.ok(!viewGame(done, f.shipper).guildTransportCanceled);
    assert.equal(done.discard.filter(c => c.id === f.karama).length, 1);
    assert.equal(player(done, f.shipper).spice, player(before, f.shipper).spice - (route === 'homeworldReturn' ? 1 : 3));
    if (route === 'homeworldReturn') {
      assert.equal(player(done, f.shipper).reserves, player(before, f.shipper).reserves + 3);
      assert.equal(done.aid[f.entrant].amount, 0);
    } else if (route === 'guildReturn') {
      assert.equal(player(done, f.shipper).reserves, player(before, f.shipper).reserves + 3);
    } else {
      assert.equal(player(done, f.shipper).forces[f.target], 3);
      assert.equal(player(done, f.shipper).reserves, player(before, f.shipper).reserves);
    }
  });
}

void test('original Junction sponsorship survives prevention of the same entrant’s native Guild cross/return privilege', () => {
  const f = createNativeGuildTransportPermissionScene('allyCross', { homeworlds: true });
  let g = stepPairedE3Nexus(f.game, f.cancel);
  const before = structuredClone(g);
  assert.equal(viewGame(g, f.shipper).guildTransportCanceled, true);
  const offer = viewGame(g, f.guild).junctionTransport!;
  assert.ok(offer.canOffer);
  g = act(g, f.guild, { type: 'offerJunctionTransport', event: offer.offerEvent, rate: 'half' });
  const choice = junctionTransportChoice(viewGame(g, f.shipper), 'homeworld:moritani',
    { [f.source]: { normal: 3, elite: 0 } }, 0);
  assert.ok(choice.action);
  assert.equal(choice.cost, 2);
  g = act(g, f.shipper, choice.action);
  assert.notEqual(g.response?.kind, 'guildTransportPermission');
  assert.equal(player(g, f.shipper).spice, player(before, f.shipper).spice - 2);
  assert.equal(player(g, f.shipper).reserves, player(before, f.shipper).reserves + 3);
  assert.equal(player(g, f.shipper).forces[f.source], player(before, f.shipper).forces[f.source] - 3);
  assert.equal(player(g, f.guild).spice, player(before, f.guild).spice);
});

void test('controlled Cunning second opportunity denial retains the first shipment and can use a legal paid reserve replacement', () => {
  const f = nexusGuildCunningFixture({ advanced: true, karama: true });
  let g = originalGuildCunningTurn(f, false);
  g = nexusGuildCunningAllow(act(g, f.owner, nexusGuildCunningRequest(f, g)));
  const before = structuredClone(g);
  g = act(g, f.owner, { type: 'guildShip', from: 'arrakeen:10', territory: 'carthag', sector: 11, amount: 3 });
  assert.equal(g.response?.kind, 'guildTransportPermission');
  g = act(g, f.target, { type: 'card', mode: 'cancel', card: f.karama! });
  assert.equal(g.nexusGuildCunningLast?.stage, 'secondShipment');
  assert.equal(player(g, f.owner).shipped, true);
  assert.deepEqual(stock(g, f.owner), stock(before, f.owner));
  assert.ok(!g.nexusGuildCunningHistory!.at(-1)!.shipment);
  const done = nexusGuildCunningAllow(act(g, f.owner,
    { type: 'ship', territory: 'carthag', sector: 11, amount: 3 }));
  // Advanced Guild's original interception still needs its own real allowance.
  const paid = settleNativeGuildRateModules(done).game;
  assert.equal(player(paid, f.owner).spice, player(before, f.owner).spice - 2);
  assert.equal(player(paid, f.owner).reserves, player(before, f.owner).reserves - 3);
  assert.equal(player(paid, f.owner).forces['arrakeen:10'], 5);
  assert.equal(player(paid, f.owner).forces['carthag:11'], 3);
  assert.equal(paid.nexusGuildCunningLast?.stage, 'extraMove');
  reject(paid, f.owner, { type: 'move', from: 'arrakeen:10', territory: 'hagga_basin', sector: 12, amount: 1 });
});

void test('controlled actual denied ordinary privilege does not remove the separately earned Cunning opportunity', () => {
  const f = nexusGuildCunningFixture({ advanced: true, karama: true });
  // Explicit controlled initial stock extension, not action-only provenance.
  // Preserve twenty counters; every subsequent denial/replacement/grant is real.
  player(f.g, f.owner).reserves -= 5;
  player(f.g, f.owner).forces['tueks_sietch:5'] = 5;
  let g = act(f.g, f.owner,
    { type: 'guildShip', from: 'tueks_sietch:5', territory: 'carthag', sector: 11, amount: 3 });
  g = act(g, f.target, { type: 'card', mode: 'cancel', card: f.karama! });
  assert.equal(viewGame(g, f.owner).guildTransportCanceled, true);
  g = settleNativeGuildRateModules(act(g, f.owner,
    { type: 'ship', territory: 'arrakeen', sector: 10, amount: 3 })).game;
  g = nexusGuildCunningAllow(act(g, f.owner, nexusGuildCunningRequest(f, g)));
  assert.ok(!viewGame(g, f.owner).guildTransportCanceled);
  const before = structuredClone(g);
  g = settleNativeGuildRateModules(act(g, f.owner,
    { type: 'guildShip', from: 'tueks_sietch:5', territory: 'carthag', sector: 11, amount: 3 })).game;
  assert.equal(player(g, f.owner).spice, player(before, f.owner).spice - 2);
  assert.equal(player(g, f.owner).forces['tueks_sietch:5'], 2);
  assert.equal(player(g, f.owner).forces['arrakeen:10'], 3);
  assert.equal(player(g, f.owner).forces['carthag:11'], 3);
  assert.equal(g.nexusGuildCunningLast?.stage, 'extraMove');
});

void test('all four original owner policies retain an executable alternative after native transport permission is prevented', () => {
  const f = createNativeGuildTransportPermissionScene();
  const denied = stepPairedE3Nexus(f.game, f.cancel);
  for (const level of ['Easy', 'Medium', 'Hard', 'Brutal'] as const) {
    const view = viewGame(denied, f.shipper); view.players.find(p => p.id === f.shipper)!.bot = level;
    const actions = botActions(view); assert.ok(actions[0]);
    assert.ok(actions.every(action => action.type !== 'guildShip'));
    const action = actions[0];
    const done = settleNativeGuildRateModules(act(denied, f.shipper, action)).game;
    if (action.type === 'ship') {
      assert.equal(player(done, f.shipper).shipped, true);
      assert.equal(player(done, f.shipper).reserves, player(denied, f.shipper).reserves - Number(action.amount));
      const destination = `${String(action.territory)}:${String(action.sector)}`;
      assert.equal(player(done, f.shipper).forces[destination],
        (player(denied, f.shipper).forces[destination] ?? 0) + Number(action.amount));
    } else if (action.type === 'move') {
      assert.equal(player(done, f.shipper).moved, player(denied, f.shipper).moved + 1);
      assert.equal(player(done, f.shipper).forces[String(action.from)] ?? 0,
        player(denied, f.shipper).forces[String(action.from)] - Number(action.amount));
      assert.equal(player(done, f.shipper).spice, player(denied, f.shipper).spice);
    } else {
      assert.equal(action.type, 'endMovement');
      assert.notEqual(done.active, f.shipper);
      assert.deepEqual(player(done, f.shipper).forces, player(denied, f.shipper).forces);
      assert.equal(player(done, f.shipper).spice, player(denied, f.shipper).spice);
    }
  }
});
