import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { presenceAt } from '../game/force-presence';
import { quoteSmugglerShipment } from '../game/smuggler-shipment';
import { conserveNoFieldForces } from './smuggler-no-field-fixture';
import {
  pairedE3NexusInventory, pairedE3NexusPlayer as player,
} from './fixture-paired-e3-nexus-modules';
import {
  allowNativeGuildRateModules, cancelNativeGuildRateModules,
  createControlledGuildRateNoFieldCompanion, createNativeGuildRateModules,
  createNativeGuildRateSmugglerShipment, declareControlledGuildRateNoFieldCompanion,
  declareNativeGuildRateModules, moveAfterNativeGuildRateModules,
  settleNativeGuildRateModules,
  type NativeGuildRateModuleSelection, type NativeGuildRateRoute,
} from './fixture-native-guild-rate-modules';

const act = (game: Game, actor: string, action: Action) =>
  applyAction(structuredClone(game), actor, action);
function reject(game: Game, actor: string, action: Action) {
  const copy = structuredClone(game), before = structuredClone(copy);
  assert.throws(() => applyAction(copy, actor, action));
  assert.deepEqual(copy, before);
}
function assertUnpaid(before: Game, offered: Game, entrant: string, guild: string) {
  for (const actor of [entrant, guild]) {
    const old = player(before, actor), current = player(offered, actor);
    assert.equal(current.spice, old.spice);
    assert.equal(current.reserves, old.reserves);
    assert.deepEqual(current.forces, old.forces);
    assert.equal(current.shipped, old.shipped);
    assert.equal(current.moved, old.moved);
  }
}
function assertPhysical(fixture: {
  entrant: string; guild: string; source: string; target: string;
  route: NativeGuildRateRoute; amount: number;
}, before: Game, done: Game, cost: number) {
  const old = player(before, fixture.entrant), current = player(done, fixture.entrant);
  assert.equal(current.spice, old.spice - cost);
  assert.equal(player(done, fixture.guild).spice, player(before, fixture.guild).spice + cost);
  assert.equal(current.reserves, old.reserves - (fixture.route === 'reserve' ? fixture.amount : 0));
  assert.equal(current.forces[fixture.source],
    old.forces[fixture.source] - (fixture.route === 'transport' ? fixture.amount : 0));
  assert.equal(current.forces[fixture.target], (old.forces[fixture.target] ?? 0) + fixture.amount);
  assert.equal(current.shipped, true);
  assert.equal(current.moved, old.moved);
  assert.equal(current.reserves + current.tanks + Object.values(current.forces).reduce((n, amount) => n + amount, 0),
    old.reserves + old.tanks + Object.values(old.forces).reduce((n, amount) => n + amount, 0));
}

// Each standalone selection contributes one real route/outcome. The two
// composed examples cover both routes without claiming an option matrix.
const cases: { selection: NativeGuildRateModuleSelection; route: NativeGuildRateRoute; cancel: boolean }[] = [
  { selection: 'skills', route: 'reserve', cancel: true },
  { selection: 'discovery', route: 'transport', cancel: false },
  { selection: 'tech', route: 'reserve', cancel: false },
  { selection: 'strongholds', route: 'transport', cancel: true },
  { selection: 'composed', route: 'reserve', cancel: false },
  { selection: 'composed', route: 'transport', cancel: true },
];
for (const { selection, route, cancel } of cases) {
  void test(`original ${selection} ${route}: ${cancel ? 'cancel' : 'allow'} rate, pay and transport once, then native movement`, () => {
    const f = createNativeGuildRateModules(selection, route), before = f.beforeAction;
    assert.equal(before.turn, 2);
    assert.equal(before.phase, 5);
    assert.equal(before.active, f.entrant);
    assert.equal(player(before, f.entrant).ally, f.guild);
    if (selection === 'skills' || selection === 'composed') {
      assert.ok(before.leaderSkills?.assignments.length);
      assert.ok(f.actions.some(step => step.action.type === 'leaderSkill'));
    }
    if (selection === 'discovery' || selection === 'composed') assert.ok(before.discoveries?.tokens.length);
    if (selection === 'tech' || selection === 'composed') assert.ok(before.techTokens);
    if (selection === 'strongholds' || selection === 'composed') assert.ok(before.strongholdCards);
    const offered = declareNativeGuildRateModules(f).game;
    assertUnpaid(before, offered, f.entrant, f.guild);
    assert.ok(viewGame(offered, f.ecaz).responseControls?.cancelCards.includes(f.karama));
    reject(offered, f.entrant, f.action);
    const priced = cancel
      ? cancelNativeGuildRateModules(offered, f.ecaz, f.karama).game
      : allowNativeGuildRateModules(offered).game;
    const cost = cancel ? 3 : 2;
    // A still-held Karama preserves the separate income response. After the
    // canceling card is spent, an unanswerable income window may auto-resolve.
    if (!cancel) assert.equal(priced.response?.kind, 'guildIncome');
    assert.equal(player(priced, f.entrant).spice, player(before, f.entrant).spice - cost);
    assert.equal(player(priced, f.guild).spice, player(before, f.guild).spice +
      (priced.response?.kind === 'guildIncome' ? 0 : cost));
    const done = settleNativeGuildRateModules(priced).game;
    assertPhysical(f, before, done, cost);
    assert.equal(done.discard.filter(card => card.id === f.karama).length, cancel ? 1 : 0);
    assert.equal(player(done, f.ecaz).hand.some(card => card.id === f.karama), !cancel);
    reject(done, f.entrant, f.action);
    const moved = moveAfterNativeGuildRateModules(f, done);
    assert.equal(player(moved.game, f.entrant).moved, player(done, f.entrant).moved + 1);
    assert.equal(player(moved.game, f.entrant).forces[f.source], player(done, f.entrant).forces[f.source] - 1);
    assert.equal(player(moved.game, f.entrant).forces[moved.target], 1);
    assert.equal(player(moved.game, f.entrant).spice, player(done, f.entrant).spice);
    assert.equal(player(moved.game, f.guild).spice, player(done, f.guild).spice);
    assert.equal(player(moved.game, f.entrant).reserves, player(done, f.entrant).reserves);
    assert.equal(player(moved.game, f.entrant).shipped, true);
    reject(moved.game, f.entrant, moved.step.action);
    const next = act(moved.game, f.entrant, { type: 'endMovement' });
    assert.notEqual(next.active, f.entrant);
    assert.equal(player(next, f.entrant).spice, player(moved.game, f.entrant).spice);
    assert.deepEqual(player(next, f.entrant).forces, player(moved.game, f.entrant).forces);
    pairedE3NexusInventory(moved.game);
  });
}

for (const cancel of [false, true]) {
  void test(`original ${cancel ? 'composed' : 'Skills'} Smuggler reserve: ${cancel ? 'canceling' : 'allowing'} Guild rate prices two paid counters and transports all three`, () => {
    const f = createNativeGuildRateSmugglerShipment(cancel), before = f.beforeAction;
    assert.ok(before.players.every(p => presenceAt(p, f.destination) === 0));
    const trainer = before.leaderSkills!.assignments.find(a => a.owner === f.entrant && a.skill === 'smuggler');
    assert.ok(trainer);
    assert.ok(f.actions.some(step => step.actor === f.entrant && step.action.type === 'leaderSkill' &&
      step.action.skill === 'smuggler' && step.action.leader === trainer.leader));
    assert.deepEqual(quoteSmugglerShipment(before, f.entrant, f.destination, 3), { leader: trainer.leader, amount: 3 });
    const offered = declareNativeGuildRateModules(f).game;
    assertUnpaid(before, offered, f.entrant, f.guild);
    const priced = cancel
      ? cancelNativeGuildRateModules(offered, f.ecaz, f.karama).game
      : allowNativeGuildRateModules(offered).game;
    const done = settleNativeGuildRateModules(priced).game;
    // Desert ordinary full price is two per PAID counter: (3 - 1) * 2.
    // Charging all three would incorrectly cost six after cancellation.
    assertPhysical(f, before, done, cancel ? 4 : 2);
    assert.equal(done.discard.filter(card => card.id === f.karama).length, cancel ? 1 : 0);
    reject(done, f.entrant, f.action);
    pairedE3NexusInventory(done);
  });
}

void test('original Smuggler canceled rate retains the free counter on an affordable full-price replacement, with no debt or replay', () => {
  const f = createNativeGuildRateSmugglerShipment(true);
  const before = act(f.beforeAction, f.entrant, { type: 'bribe', target: f.ecaz,
    amount: player(f.beforeAction, f.entrant).spice - 3 });
  assert.equal(player(before, f.entrant).spice, 3);
  const offered = declareNativeGuildRateModules({ ...f, beforeAction: before }).game;
  const released = cancelNativeGuildRateModules(offered, f.ecaz, f.karama).game;
  assertUnpaid(before, released, f.entrant, f.guild);
  assert.equal(player(released, f.entrant).shipped, false);
  assert.equal(viewGame(released, f.entrant).guildRateCanceled, true);
  assert.equal(released.discard.filter(card => card.id === f.karama).length, 1);
  reject(released, f.entrant, f.action);
  const replacement: Action = { ...f.action, amount: 2 };
  let paid = act(released, f.entrant, replacement);
  if (paid.decision?.kind === 'guildShipment') paid = act(paid, f.guild, { type: 'decision', allow: true });
  assert.notEqual(paid.response?.kind, 'guildRate');
  const done = settleNativeGuildRateModules(paid).game;
  assertPhysical({ ...f, amount: 2 }, before, done, 2);
  assert.equal(player(done, f.entrant).spice, 1);
  assert.equal(done.discard.filter(card => card.id === f.karama).length, 1);
  reject(done, f.entrant, replacement);
});

// Bounded existing controlled Richese source, deliberately separate from the
// original-action producers above. Hidden values are not a pricing parameter.
for (const value of [0, 5] as const) {
  void test(`CONTROLLED genuine-trained No-Field ${value}: rate cancellation charges one marker and leaves its one physical Smuggler companion free`, () => {
    const f = createControlledGuildRateNoFieldCompanion(value), before = f.beforeAction;
    const offered = declareControlledGuildRateNoFieldCompanion(f).game;
    assertUnpaid(before, offered, f.entrant, f.guild);
    const priced = cancelNativeGuildRateModules(offered, f.canceler, f.karama).game;
    const done = settleNativeGuildRateModules(priced).game;
    assert.equal(player(done, f.entrant).spice, player(before, f.entrant).spice - 2);
    assert.equal(player(done, f.guild).spice, player(before, f.guild).spice + 2);
    assert.equal(player(done, f.entrant).reserves, player(before, f.entrant).reserves - 1);
    assert.equal(player(done, f.entrant).forces[f.target], 1);
    assert.equal(presenceAt(player(done, f.entrant), f.destination), 2);
    assert.equal(player(done, f.entrant).noField!.deployed!.tokenId, f.action.noField);
    assert.equal(player(done, f.entrant).shipped, true);
    assert.equal(done.discard.filter(card => card.id === f.karama).length, 1);
    // Consumer-visible privacy: opponents still see only the concealed marker,
    // not its physical token identity or declaration proof.
    const otherView = JSON.stringify(viewGame(done, f.canceler));
    assert.equal(otherView.includes(String(f.action.noField)), false);
    assert.equal(otherView.includes('noFieldSkillProof'), false);
    reject(done, f.entrant, f.action);
    const revealed = act(done, f.entrant, { type: 'revealNoField',
      event: player(done, f.entrant).noFieldEvent, token: f.action.noField });
    assert.equal(player(revealed, f.entrant).forces[f.target], value + 1);
    assert.equal(player(revealed, f.entrant).reserves, player(before, f.entrant).reserves - value - 1);
    assert.equal(player(revealed, f.entrant).spice, player(done, f.entrant).spice);
    assert.equal(player(revealed, f.guild).spice, player(done, f.guild).spice);
    conserveNoFieldForces(revealed);
    reject(revealed, f.entrant, { type: 'card', mode: 'cancel', card: f.karama });
  });
}
