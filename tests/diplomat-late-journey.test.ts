import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Game } from '../game/engine';
import { advancedNativePlayer, assertAdvancedNativeCustody } from './fixture-advanced-native-skills';
import {
  createDiplomatLateJourney, finishDiplomatLateJourney, settleDiplomatLateJourney,
  type DiplomatLateJourney, type DiplomatLateJourneyStep,
} from './fixture-diplomat-late-journey';

function assertOutcome(game: Game, fixture: DiplomatLateJourney, branch: 'copy' | 'decline') {
  const expected = fixture.expected[branch];
  const own = advancedNativePlayer(game, 'emperor'), opposing = advancedNativePlayer(game, 'guild');
  assert.equal(own.leaders.find(l => l.id === fixture.trainer)!.dead, expected.trainerDead);
  assert.equal(opposing.leaders.find(l => l.id === fixture.opposingLeader)!.dead, false,
    'The actual Portable protects its original holder in either branch.');
  assert.equal(own.forces[fixture.key] ?? 0, expected.ownForces);
  assert.equal(opposing.forces[fixture.key] ?? 0, expected.opposingForces);
  assert.equal(own.tanks, expected.ownTanks);
  assert.equal(opposing.tanks, expected.opposingTanks);
  assert.equal(game.lastBattleContext!.winner, expected.winner);
  assert.equal(game.lastBattleContext!.event, fixture.event);
  for (const [id, count] of [
    [fixture.ownPoison, expected.ownPoisonDiscards],
    [fixture.opposingPoison, expected.opposingPoisonDiscards],
    [fixture.portable, expected.portableDiscards],
    [fixture.worthless, expected.worthlessDiscards],
  ] as const) {
    assert.equal(game.discard.filter(c => c.id === id).length, count, id);
    const physical = [...game.deck, ...game.discard, ...(game.richeseCache ?? []),
      ...(game.richeseRemoved ?? []), ...game.players.flatMap(p => p.hand)];
    assert.equal(physical.filter(c => c.id === id).length, 1, 'Each original played card keeps exactly one physical custodian.');
  }
  assertAdvancedNativeCustody(game);
}

void test('genuine paid Richese programme offers the used late Portable after Emperor already declined traitor, then mandatory Worthless copy survives', () => {
  const f = createDiplomatLateJourney();
  for (const shipment of f.shipments) {
    const before = shipment.before.players.find(p => p.id === shipment.step.actor)!;
    const after = shipment.after.players.find(p => p.id === shipment.step.actor)!;
    assert.equal(before.spice - after.spice, shipment.step.actor === f.owner ? 4 : 2);
    assert.equal(before.reserves - after.reserves, 2);
    assert.equal(after.forces['south_mesa:5'], 2);
  }
  for (const movement of f.movements) {
    const after = movement.after.players.find(p => p.id === movement.step.actor)!;
    assert.equal(after.forces[f.key], 2);
    assert.equal(after.forces['south_mesa:5'] ?? 0, 0);
  }
  assert.equal(f.game.spice[f.key], 8);
  assert.ok(!f.revealed.battle!.diplomatDefense);
  assert.notEqual(f.revealed.decision?.kind, 'diplomatDefense');
  assert.equal(f.revealed.battle!.traitorCalls[f.owner], undefined);
  assert.equal(viewGame(f.revealed, f.owner).battle!.cards.some(c => c.id === f.portable), false);
  assert.deepEqual(f.beforeLate.battle!.traitorCalls, { [f.owner]: false });
  assert.equal(viewGame(f.beforeLate, f.opponent).portableSnooper!.blocked, null);
  const offered = f.offered;
  assert.ok(offered.decision?.kind === 'diplomatDefense');
  assert.equal(offered.decision.player, f.owner);
  assert.equal(offered.decision.source, f.portable);
  assert.deepEqual(offered.decision.cards, [f.worthless]);
  assert.equal(offered.battle!.diplomatDefense!.kind, 'snooper');
  assert.equal(offered.battle!.lateDefense![f.opponent], f.portable);
  assert.deepEqual(offered.battle!.plans, f.revealed.battle!.plans);
  assert.equal(offered.battle!.event, f.event);
  assert.deepEqual(offered.battle!.traitorCalls, { [f.owner]: false });
  for (const actor of [f.owner, f.opponent, f.observer])
    assert.ok(viewGame(offered, actor).battle!.cards.some(c => c.id === f.portable));
  const copied = applyAction(offered, f.copyAction.actor, f.copyAction.action);
  assert.equal(copied.battle!.diplomatDefense!.stage, 'copied');
  assert.deepEqual(copied.battle!.plans, f.revealed.battle!.plans);
  assert.deepEqual(copied.battle!.traitorCalls, { [f.owner]: false });
  assert.deepEqual(viewGame(copied, f.owner).battle!.traitorVoters.filter(id => copied.battle!.traitorCalls[id] === undefined),
    f.expected.copy.remainingVoters);
  assert.ok(advancedNativePlayer(copied, 'emperor').hand.some(c => c.id === f.worthless),
    'Copy selection reserves the original Worthless until real resolution.');
  const steps: DiplomatLateJourneyStep[] = [];
  const { beforeResolution, cleanup } = settleDiplomatLateJourney(copied, f, steps);
  assert.deepEqual(beforeResolution.battle!.traitorCalls, { [f.owner]: false });
  assert.equal(cleanup.decision?.kind, 'battleCards');
  assert.ok(cleanup.decision?.kind === 'battleCards');
  assert.equal(cleanup.decision.player, f.owner);
  assert.ok(cleanup.decision.cards.includes(f.ownPoison));
  assert.ok(!cleanup.decision.cards.includes(f.worthless), 'The selected Worthless is mandatory, not optional winner cleanup.');
  assertOutcome(cleanup, f, 'copy');
  const collected = finishDiplomatLateJourney(cleanup, steps);
  assert.equal(collected.spice[f.key], 8 - f.expected.copy.collection);
  assert.equal(advancedNativePlayer(collected, 'emperor').spice - advancedNativePlayer(cleanup, 'emperor').spice,
    f.expected.copy.collection);
  assert.ok(advancedNativePlayer(collected, 'emperor').hand.some(c => c.id === f.ownPoison));
  assertOutcome(collected, f, 'copy');
});

void test('declining that same genuine late offer leaves poison lethal and Guild retains its original Portable through winner cleanup and Collection', () => {
  const f = createDiplomatLateJourney();
  assert.ok(f.offered.decision?.kind === 'diplomatDefense');
  const declined = applyAction(f.offered, f.declineAction.actor, f.declineAction.action);
  assert.equal(declined.battle!.diplomatDefense!.stage, 'declined');
  assert.equal(declined.battle!.diplomatDefense!.card, null);
  assert.deepEqual(declined.battle!.traitorCalls, { [f.owner]: false });
  assert.deepEqual(declined.battle!.plans, f.revealed.battle!.plans);
  assert.equal(declined.battle!.event, f.event);
  assert.deepEqual(viewGame(declined, f.owner).battle!.traitorVoters.filter(id => declined.battle!.traitorCalls[id] === undefined),
    f.expected.decline.remainingVoters);
  assert.ok(advancedNativePlayer(declined, 'emperor').hand.some(c => c.id === f.worthless));
  const steps: DiplomatLateJourneyStep[] = [];
  const { cleanup } = settleDiplomatLateJourney(declined, f, steps);
  assert.ok(cleanup.decision?.kind === 'battleCards');
  assert.equal(cleanup.decision.player, f.opponent);
  assert.ok(cleanup.decision.cards.includes(f.portable));
  assert.ok(cleanup.decision.cards.includes(f.opposingPoison));
  assertOutcome(cleanup, f, 'decline');
  const collected = finishDiplomatLateJourney(cleanup, steps);
  assert.equal(collected.spice[f.key], 8 - f.expected.decline.collection);
  assert.ok(advancedNativePlayer(collected, 'guild').hand.some(c => c.id === f.portable));
  assert.ok(advancedNativePlayer(collected, 'guild').hand.some(c => c.id === f.opposingPoison));
  assertOutcome(collected, f, 'decline');
});
