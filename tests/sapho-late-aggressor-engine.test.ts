import assert from 'node:assert/strict';
import { test } from 'node:test';
import { viewGame } from '../game/engine';
import { botActions } from '../game/bots';
import { canUsePlanetologistBattleSpecial } from '../game/leader-skill-combat';
import {
  LATE_SAPHO_STONE, actSaphoLate, completeSaphoLateAggressor, createSaphoLateAggressorFixture,
  prepareSaphoLateOutcome, saphoLateAggressorAction, saphoLateOutcomeReady,
  saphoLatePlayer as player, type SaphoLateAggressorFixture,
} from './fixture-sapho-late-aggressor';

function source(f: SaphoLateAggressorFixture) {
  assert.equal(f.game.battle!.saphoTimingVersion, 1);
  assert.equal(f.game.battle!.stoneAllocationVersion, 1);
  assert.equal(f.game.battle!.attacker, f.opponent);
  assert.equal(f.game.battle!.defender, f.owner);
  assert.ok(player(f.acquiredSapho).hand.some(card => card.id === f.card));
  assert.equal(f.actions.filter(step => step.actor === f.owner && step.action.type === 'richeseBid' && step.action.amount === 1).length, f.stone ? 2 : 1);
  assert.equal(f.sourceActionCount, f.actions.length);
  for (const shipment of f.shipments) {
    const { actor, action } = shipment.step;
    assert.equal(player(shipment.before, actor).spice - player(shipment.after, actor).spice, action.amount);
    assert.equal(player(shipment.before, actor).reserves - player(shipment.after, actor).reserves, action.amount);
  }
  assert.equal(f.game.battle!.plans[f.opponent], undefined);
  assert.equal(f.game.battle!.plans[f.owner], undefined);
}

void test('genuine Basic and Advanced late Sapho changes an ordinary revealed tie only after both original outcome acknowledgements', () => {
  for (const advanced of [false, true]) {
    const f = createSaphoLateAggressorFixture({ advanced });
    source(f);
    const baseline = prepareSaphoLateOutcome(f);
    assert.equal(baseline.game.battle!.outcomeWindow!.revision, 0);
    assert.deepEqual(baseline.game.battle!.outcomeWindow!.ready, []);
    assert.equal(player(baseline.game).tanks, player(f.game).tanks);
    const unchanged = completeSaphoLateAggressor(f, baseline);
    assert.equal(unchanged.game.lastBattleContext!.winner, f.opponent);
    assert.equal(unchanged.readies.length, 2);
    const late = prepareSaphoLateOutcome(f, { useAt: 'window', readyBeforeUse: true });
    assert.deepEqual(late.acknowledged!.battle!.outcomeWindow!.ready, [f.owner]);
    assert.notEqual(late.afterUse!.battle!.outcomeWindow!.event, late.beforeUse!.battle!.outcomeWindow!.event);
    assert.equal(late.afterUse!.battle!.outcomeWindow!.revision, 1);
    assert.deepEqual(late.afterUse!.battle!.outcomeWindow!.ready, []);
    assert.equal(late.afterUse!.battle!.outcomeWindow!.closed, false);
    assert.deepEqual(late.afterUse!.battle!.plans, late.beforeUse!.battle!.plans);
    assert.deepEqual(late.afterUse!.battle!.traitorCalls, late.beforeUse!.battle!.traitorCalls);
    assert.equal(late.afterUse!.battle!.attacker, f.opponent);
    assert.equal(late.afterUse!.battle!.defender, f.owner);
    assert.equal(late.afterUse!.discard.filter(card => card.id === f.card).length, 1);
    assert.equal(player(late.afterUse!).tanks, player(f.game).tanks);
    const stale = saphoLateOutcomeReady(late.beforeUse!, f.opponent);
    assert.throws(() => actSaphoLate(late.afterUse!, f.opponent, stale), /event|stale|window|opportunity/i);
    const changed = completeSaphoLateAggressor(f, late);
    assert.equal(changed.readies.length, 2, 'Both participants must acknowledge the revised public opportunity');
    assert.equal(changed.game.lastBattleContext!.winner, f.owner);
    assert.equal(player(changed.game).forces[f.location], 2);
    assert.equal(player(changed.game, f.opponent).forces[f.location] ?? 0, 0);
  }
});

void test('genuine Sapho after one opposing sealed plan preserves that plan and still opens the fixed final window without a held Sapho', () => {
  const f = createSaphoLateAggressorFixture();
  const programme = prepareSaphoLateOutcome(f, { useAt: 'onePlan' });
  assert.equal(programme.onePlan.battle!.revealed, false);
  assert.ok(programme.onePlan.battle!.plans[f.opponent]);
  assert.equal(programme.onePlan.battle!.plans[f.owner], undefined);
  assert.deepEqual(programme.afterUse!.battle!.plans, programme.beforeUse!.battle!.plans);
  assert.equal(player(programme.opened).hand.some(card => card.id === f.card), false);
  assert.equal(programme.opened.battle!.outcomeWindow!.closed, false);
  assert.deepEqual(programme.opened.battle!.outcomeWindow!.ready, []);
  assert.deepEqual(Object.keys(programme.opened.battle!.traitorCalls).sort(), [f.opponent, f.owner].sort());
  const completed = completeSaphoLateAggressor(f, programme);
  assert.equal(completed.game.lastBattleContext!.winner, f.owner);
  assert.equal(completed.readies.length, 2);
  assert.equal(completed.game.discard.filter(card => card.id === f.card).length, 1);
});

void test('actual paid Stone then next-turn paid Sapho settles the mixed physical tie through the original final window and count menu', () => {
  const f = createSaphoLateAggressorFixture({ stone: true });
  source(f);
  assert.equal(f.acquiredStone!.turn, 1);
  assert.equal(f.acquiredSapho.turn, 2);
  assert.ok(player(f.acquiredStone!).hand.some(card => card.id === LATE_SAPHO_STONE));
  assert.equal(player(f.game).forces[f.location], 6);
  assert.equal(player(f.game).elites!.forces[f.location], 1);
  assert.ok(f.actions.some(step => step.actor === f.opponent && step.action.type === 'seatPosition' && step.action.position === 4));
  assert.ok(f.actions.some(step => step.actor === f.owner && step.action.type === 'seatPosition' && step.action.position === 5));
  const baseline = prepareSaphoLateOutcome(f), late = prepareSaphoLateOutcome(f, { useAt: 'window' });
  assert.equal(baseline.game.decision, null);
  assert.equal(late.game.decision, null);
  assert.equal(viewGame(late.game, f.owner).battle!.stoneAllocation, null, 'No outcome-sensitive physical menu precedes the final acknowledgements');
  assert.deepEqual(late.afterUse!.battle!.stoneBurner, late.beforeUse!.battle!.stoneBurner);
  assert.deepEqual(late.afterUse!.battle!.traitorCalls, late.beforeUse!.battle!.traitorCalls);
  let closed = baseline.game;
  for (const actor of [f.opponent, f.owner]) closed = actSaphoLate(closed, actor, saphoLateOutcomeReady(closed, actor));
  assert.equal(closed.battle!.outcomeWindow!.closed, true);
  assert.equal(closed.decision?.kind, 'stoneAllocation');
  assert.deepEqual(viewGame(closed, f.owner).battle!.stoneAllocation!.totals, [1, 2, 3]);
  assert.ok(player(closed).hand.some(card => card.id === f.card));
  assert.equal(viewGame(closed, f.owner).saphoOptions.some(option => option.scope === 'battleAggressor'), false,
    'The count context binds the final aggressor after the public opportunity closes');
  assert.throws(() => actSaphoLate(closed, f.owner, saphoLateAggressorAction(baseline.game)), /Sapho|opportunity|closed|expired/i);
  const before = completeSaphoLateAggressor(f, { ...baseline, game: closed }, 2);
  const after = completeSaphoLateAggressor(f, late, 2);
  assert.equal(before.game.lastBattleContext!.winner, f.opponent);
  assert.equal(after.game.lastBattleContext!.winner, f.owner);
  assert.equal(before.allocations[0].step.action.undialed, 2);
  assert.equal(after.allocations[0].step.action.undialed, 2);
  assert.equal(player(after.game).forces[f.location], 2);
  assert.equal((player(after.game).elites!.forces[f.location] ?? 0) + player(after.game).elites!.tanks, 1);
  assert.equal(after.game.discard.filter(card => card.id === f.card).length, 1);
});

void test('all four minimal policies make legal Sapho-or-continue choices at the original revealed outcome window', () => {
  const f = createSaphoLateAggressorFixture(), programme = prepareSaphoLateOutcome(f);
  for (const difficulty of ['Easy', 'Medium', 'Hard', 'Brutal'] as const) {
    for (const actor of [f.owner, f.opponent]) {
      const view = viewGame(programme.game, actor);
      view.players.find(player => player.id === actor)!.bot = difficulty;
      const action = botActions(view).find(action => action.type === 'battleOutcomeReady' ||
        (action.type === 'card' && action.card === f.card && action.scope === 'battleAggressor'));
      assert.ok(action, `${difficulty} can use its actual aggressor option or acknowledge the fixed window`);
      const next = actSaphoLate(structuredClone(programme.game), actor, action);
      const completed = completeSaphoLateAggressor(f, { ...programme, game: next });
      assert.ok([f.owner, f.opponent].includes(completed.game.lastBattleContext!.winner!));
    }
  }
});

void test('controlled own plan and inspection reservations keep the physical Sapho unavailable for late spending', () => {
  const f = createSaphoLateAggressorFixture();
  const held = player(f.game).hand.find(card => card.id === f.card)!;
  const leader = String(f.plans[1].action.leader);
  assert.equal(canUsePlanetologistBattleSpecial({card: held, selectedLeader: leader,
    assignments: [{skill: 'planetologist', leader, faceUp: false, captured: false}]}), true);
  const action = saphoLateAggressorAction(f.game);
  // Controlled reservation probes only; these do not claim a full original
  // Planetologist/Sapho setup or an actual native Prescience disclosure.
  for (const reservation of ['plan', 'inspection']) {
    const game = structuredClone(f.game);
    if (reservation === 'plan') game.battle!.plans[f.owner] = {
      leader, dial: 1, support: 0, weapon: f.card, defense: null,
    };
    else game.battle!.prescience = {player: f.opponent, field: 'weapon', value: f.card};
    const before = structuredClone(game);
    assert.equal(viewGame(game, f.owner).saphoOptions.some(option => option.scope === 'battleAggressor'), false);
    assert.throws(() => actSaphoLate(game, f.owner, action), /Sapho|unavailable|committed/i);
    assert.deepEqual(game, before);
  }
});
