import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, normalizeAutomaticGame, viewGame } from '../game/engine';
import { advancedNativePlayer, assertAdvancedNativeCustody } from './fixture-advanced-native-skills';
import {
  createSmugglerKwisatzJourney, finishSmugglerKwisatzJourney,
  revealSmugglerKwisatzJourney, settleSmugglerKwisatzJourney,
} from './fixture-smuggler-kwisatz-journey';

void test('native Atreides earns KH with seven paid Arrakeen casualties, then its original Smuggler collects a short real Spice Blow', () => {
  const fixture = createSmugglerKwisatzJourney();
  const { game, owner, opponent, trainer, key, firstBattle } = fixture;
  assert.equal(advancedNativePlayer(fixture.afterSetup, 'atreides').forces['arrakeen:10'], 10);
  assert.equal(viewGame(firstBattle.game, owner).players.find(p => p.id === owner)!.kwisatz!.active, false);
  assert.notEqual(firstBattle.revealed.battle!.plans[owner].leader, trainer);
  assert.equal(firstBattle.revealed.battle!.plans[owner].dial, 7);
  assert.equal(firstBattle.revealed.battle!.plans[owner].support, 7);
  assert.equal(firstBattle.settled.lastBattleContext!.winner, owner);
  const veteran = advancedNativePlayer(firstBattle.settled, 'atreides');
  assert.equal(veteran.battleLosses, 7);
  assert.equal(veteran.tanks, 7);
  assert.equal(veteran.forces['arrakeen:10'], 3);
  assert.equal(veteran.spice, advancedNativePlayer(firstBattle.revealed, 'atreides').spice - 7,
    'The actual supported battle pays seven before the pending first Collection opens.');
  assert.equal(viewGame(game, owner).players.find(p => p.id === owner)!.kwisatz!.active, true);
  for (const shipment of fixture.shipments) {
    const payerBefore = shipment.before.players.find(p => p.id === shipment.step.actor)!;
    const payerAfter = shipment.after.players.find(p => p.id === shipment.step.actor)!;
    assert.equal(payerBefore.spice - payerAfter.spice, shipment.step.actor === owner ? 2 : 1);
    assert.equal(payerBefore.reserves - payerAfter.reserves, 1);
  }
  assert.equal(game.turn, 2);
  assert.equal(game.phase, 6);
  assert.deepEqual(game.battle!.plans, {});
  assert.equal(game.spice[key], 6);
  const wallet = advancedNativePlayer(game, 'atreides').spice;
  const ownSealed = applyAction(game, owner, fixture.planActions[0].action);
  assert.equal(ownSealed.battle!.plans[owner].kwisatz, true);
  assert.equal(ownSealed.battle!.plans[owner].defense, fixture.shield);
  assert.deepEqual(viewGame(ownSealed, opponent).battle!.plans, {});
  assert.equal(advancedNativePlayer(ownSealed, 'atreides').spice, wallet);
  const pending = revealSmugglerKwisatzJourney(fixture);
  const printed = advancedNativePlayer(game, 'atreides').leaders.find(l => l.id === trainer)!.strength;
  assert.equal(pending.battle!.smugglerCollection!.strength, printed + 2);
  assert.equal(pending.battle!.smugglerCollection!.amount, Math.min(printed + 2, 6));
  assert.equal(pending.battle!.smugglerCollection!.stage, 'pending');
  assert.equal(advancedNativePlayer(pending, 'atreides').spice, wallet);
  assert.equal(pending.spice[key], 6);
  const paid = settleSmugglerKwisatzJourney(pending);
  assert.equal(paid.phase, 6);
  assert.equal(paid.decision?.player, owner);
  assert.equal(paid.lastBattleContext!.smugglerCollection!.stage, 'collected');
  assert.equal(advancedNativePlayer(paid, 'atreides').spice, wallet + 6);
  assert.equal(paid.spice[key], 0);
  assert.equal(advancedNativePlayer(paid, 'atreides').leaders.find(l => l.id === trainer)!.dead, false);
  assert.equal(advancedNativePlayer(paid, 'atreides').kwisatz!.usedAt, fixture.territory);
  assertAdvancedNativeCustody(paid);
});

void test('earned KH adds two beyond printed Smuggler strength, pays once before cleanup, and leaves ordinary Collection separate', () => {
  const fixture = createSmugglerKwisatzJourney({ pile: 'ample' });
  const wallet = advancedNativePlayer(fixture.game, 'atreides').spice;
  const pending = revealSmugglerKwisatzJourney(fixture);
  const printed = advancedNativePlayer(pending, 'atreides').leaders.find(l => l.id === fixture.trainer)!.strength;
  const amount = printed + 2;
  assert.ok(amount < pending.spice[fixture.key]);
  assert.equal(pending.battle!.smugglerCollection!.amount, amount);
  assert.equal(advancedNativePlayer(pending, 'atreides').spice, wallet);
  const paid = settleSmugglerKwisatzJourney(normalizeAutomaticGame(JSON.parse(JSON.stringify(pending))));
  assert.equal(paid.phase, 6);
  assert.equal(paid.decision?.kind, 'battleCards');
  assert.equal(paid.lastBattleContext!.winner, fixture.owner);
  assert.equal(paid.lastBattleContext!.smugglerCollection!.stage, 'collected');
  assert.equal(advancedNativePlayer(paid, 'atreides').spice, wallet + amount);
  assert.equal(paid.spice[fixture.key], 8 - amount);
  assert.equal(advancedNativePlayer(paid, 'atreides').tanks, 7);
  const restored = normalizeAutomaticGame(JSON.parse(JSON.stringify(paid)));
  assert.equal(advancedNativePlayer(restored, 'atreides').spice, wallet + amount);
  assert.equal(restored.spice[fixture.key], 8 - amount);
  const beforeDuplicate = structuredClone(restored);
  assert.throws(() => applyAction(restored, fixture.opponent, { type: 'traitorCall', call: false }));
  assert.deepEqual(restored, beforeDuplicate);
  const collected = finishSmugglerKwisatzJourney(restored);
  assert.equal(collected.phase, 7);
  assert.equal(collected.spice[fixture.key], 0);
  assert.equal(advancedNativePlayer(collected, 'atreides').spice, wallet + amount + (8 - amount) + 2,
    'Ordinary Collection separately gathers the remainder and native Arrakeen income; it does not pay the skill again.');
  assert.equal(collected.lastBattleContext!.smugglerCollection!.amount, amount);
  assert.equal(collected.lastBattleContext!.smugglerCollection!.stage, 'collected');
  assertAdvancedNativeCustody(collected);
});
