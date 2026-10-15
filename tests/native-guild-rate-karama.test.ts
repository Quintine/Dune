import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import {
  createGuildAmbassadorIncomeArrival, allowGuildAmbassadorIncomeArrival,
  completeGuildAmbassadorIncomeArrival,
} from './fixture-guild-ambassador-income-arrival';
import {
  advancePairedE3Nexus, nextPairedE3NexusStep, pairedE3NexusClean,
  quietPairedE3NexusChoice,
} from './fixture-paired-e3-nexus-modules';

const player = (g: Game, id: string) => g.players.find(p => p.id === id)!;
const act = (g: Game, id: string, action: Action) => applyAction(structuredClone(g), id, action);
type NativeFixture = ReturnType<typeof createGuildAmbassadorIncomeArrival>;
function declare(f: NativeFixture, before: Game, route: 'reserve' | 'transport', amount: number) {
  const action: Action = route === 'transport' ? { ...f.action, amount } : {
    type: 'ship', territory: f.destination, sector: f.sector, amount, elite: 0, allyPayment: 0,
  };
  let g = act(before, f.entrant, action);
  if (g.decision?.kind === 'guildShipment') {
    assert.equal(route, 'reserve');
    assert.deepEqual(player(g, f.entrant).forces, player(before, f.entrant).forces);
    g = act(g, f.guild, { type: 'decision', allow: true });
  }
  return g;
}
function allowRate(state: Game) {
  let g = state;
  for (let n = 0; g.response?.kind === 'guildRate' && n < 20; n++) {
    const step = nextPairedE3NexusStep(g); assert.ok(step);
    assert.equal(step.action.type, 'passResponse');
    g = act(g, step.actor, step.action);
  }
  assert.notEqual(g.response?.kind, 'guildRate');
  return g;
}
function entryAfterIncome(g: Game) {
  return g.response ? allowGuildAmbassadorIncomeArrival(g).game : g;
}
function assertPhysical(f: NativeFixture, before: Game, after: Game, route: 'reserve' | 'transport', amount: number, cost: number) {
  const p = player(after, f.entrant), old = player(before, f.entrant);
  assert.equal(p.spice, old.spice - cost);
  assert.equal(p.reserves, old.reserves - (route === 'reserve' ? amount : 0));
  assert.equal(p.forces[f.source], old.forces[f.source] - (route === 'transport' ? amount : 0));
  assert.equal(p.forces[f.target], (old.forces[f.target] ?? 0) + amount);
  assert.equal(p.shipped, true);
  assert.equal(player(after, f.guild).spice, player(before, f.guild).spice + cost);
  assert.equal(after.pendingAmbassador?.entrant, f.entrant);
  assert.ok(!after.pendingArrivalReaction);
}

for (const route of ['reserve', 'transport'] as const) {
  void test(`original expansion/Nexus ${route}: native discount waits before payment; cancellation charges the unchanged full group once`, () => {
    const f = createGuildAmbassadorIncomeArrival(), before = f.beforeAction;
    const offered = declare(f, before, route, 3);
    assert.equal(offered.response?.kind, 'guildRate');
    assert.equal(player(offered, f.entrant).spice, player(before, f.entrant).spice);
    assert.equal(player(offered, f.entrant).reserves, player(before, f.entrant).reserves);
    assert.deepEqual(player(offered, f.entrant).forces, player(before, f.entrant).forces);
    assert.ok(!offered.pendingAmbassador);
    assert.ok(viewGame(offered, f.ecaz).responseControls?.cancelCards.includes(f.karama));
    const canceled = act(offered, f.ecaz, { type: 'card', mode: 'cancel', card: f.karama });
    const entry = entryAfterIncome(canceled);
    assertPhysical(f, before, entry, route, 3, 3);
    assert.equal(entry.discard.filter(c => c.id === f.karama).length, 1);
    const completed = completeGuildAmbassadorIncomeArrival(entry);
    const next = act(completed.after, completed.continuation.actor, completed.continuation.action);
    assert.notEqual(next.active, f.entrant);
    assert.equal(player(next, f.entrant).spice, player(before, f.entrant).spice - 3);
    assert.deepEqual(player(next, f.entrant).forces, player(entry, f.entrant).forces);
  });

  void test(`original expansion/Nexus ${route}: allowing the rate retains rounded discount and its separate income counter`, () => {
    const f = createGuildAmbassadorIncomeArrival(), before = f.beforeAction;
    const offered = declare(f, before, route, 3);
    assert.equal(offered.response?.kind, 'guildRate');
    const paid = allowRate(offered);
    assert.equal(paid.response?.kind, 'guildIncome');
    assert.equal(player(paid, f.entrant).spice, player(before, f.entrant).spice - 2);
    assert.equal(player(paid, f.guild).spice, player(before, f.guild).spice);
    const entry = entryAfterIncome(paid);
    assertPhysical(f, before, entry, route, 3, 2);
    assert.ok(player(entry, f.ecaz).hand.some(c => c.id === f.karama));
  });

  void test(`original expansion/Nexus ${route}: unaffordable cancellation spends only Karama and permits a full-price replacement`, () => {
    const f = createGuildAmbassadorIncomeArrival();
    const before = act(f.beforeAction, f.entrant, { type: 'bribe', target: f.ecaz,
      amount: player(f.beforeAction, f.entrant).spice - 3 });
    assert.equal(player(before, f.entrant).spice, 3);
    const offered = declare(f, before, route, 6);
    assert.equal(offered.response?.kind, 'guildRate');
    const released = act(offered, f.ecaz, { type: 'card', mode: 'cancel', card: f.karama });
    assert.equal(player(released, f.entrant).spice, 3);
    assert.deepEqual(player(released, f.entrant).forces, player(before, f.entrant).forces);
    assert.equal(player(released, f.entrant).reserves, player(before, f.entrant).reserves);
    assert.equal(player(released, f.entrant).shipped, false);
    assert.equal(player(released, f.guild).spice, player(before, f.guild).spice);
    assert.ok(!released.pendingShipment);
    assert.ok(!released.pendingGuildTransport);
    assert.ok(!released.pendingAmbassador);
    assert.equal(released.discard.filter(c => c.id === f.karama).length, 1);
    assert.equal(viewGame(released, f.entrant).guildRateCanceled, true);
    const replacement = declare(f, released, route, 3);
    assert.notEqual(replacement.response?.kind, 'guildRate');
    const entry = entryAfterIncome(replacement);
    assertPhysical(f, before, entry, route, 3, 3);
  });
}

void test('original expansion/Nexus Guild return has its own prepayment rate window and full-price physical return', () => {
  const f = createGuildAmbassadorIncomeArrival();
  const before = advancePairedE3Nexus(f.beforeAction,
    g => g.phase === 5 && g.active === f.guild && pairedE3NexusClean(g),
    [], quietPairedE3NexusChoice);
  const p = player(before, f.guild);
  const source = Object.keys(p.forces).find(key => p.forces[key] >= 3)!;
  assert.ok(source);
  const offered = act(before, f.guild, { type: 'guildShip', from: source,
    territory: 'reserves', amount: 3, elite: 0, allyPayment: 0 });
  assert.equal(offered.response?.kind, 'guildRate');
  assert.deepEqual(player(offered, f.guild).forces, p.forces);
  const done = act(offered, f.ecaz, { type: 'card', mode: 'cancel', card: f.karama });
  assert.equal(player(done, f.guild).spice, p.spice - 3);
  assert.equal(player(done, f.guild).forces[source], p.forces[source] - 3);
  assert.equal(player(done, f.guild).reserves, p.reserves + 3);
  assert.equal(player(done, f.guild).shipped, true);
  assert.ok(!done.pendingGuildTransport);
  assert.ok(!done.pendingAmbassador);
});
