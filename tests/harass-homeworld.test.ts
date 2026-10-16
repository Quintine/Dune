import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { combatArmy, homeworldBattleLocation } from '../game/combat-location';
import {
  HARASS_HOMEWORLD_CARD, advanceHarassHomeworld,
  assertHarassHomeworldCustody, chooseHarassHomeworldReturn, createHarassHomeworldFixture,
  finishHarassHomeworldBattle, harassHomeworldClean, harassHomeworldPlayer as player,
  harassHomeworldPool, revealHarassHomeworldBattle, sealHarassHomeworldPlan,
  type HarassHomeworldStep,
} from './fixture-harass-homeworld';

function rejectsUnchanged(game: Game, actor: string, action: Action, reason?: RegExp): void {
  const before = JSON.stringify(game);
  if (reason) assert.throws(() => applyAction(game, actor, action), reason);
  else assert.throws(() => applyAction(game, actor, action));
  assert.equal(JSON.stringify(game), before, 'An illegal action must not mutate original custody or sealed plans');
}
function assertFinished(game: Game, owner: string, location: string): void {
  assert.equal(game.battle, null);
  assert.ok(!game.homeworldBattleLoss && !game.pendingTreacheryDiscard && harassHomeworldClean(game));
  assert.equal(game.lastBattleContext!.territory, location);
  assert.equal(game.discard.filter(c => c.id === HARASS_HOMEWORLD_CARD).length, 1);
  assert.ok(!player(game, owner).hand.some(c => c.id === HARASS_HOMEWORLD_CARD));
  assertHarassHomeworldCustody(game);
}

for (const sample of [
  { advanced: false, slot: 'weapon' as const },
  { advanced: true, slot: 'defense' as const },
]) void test(`${sample.advanced ? 'Advanced' : 'Basic'} native visitor ${sample.slot} returns actual typed counters, then loses only its original commitment`, () => {
  const f = createHarassHomeworldFixture(sample);
  for (const state of [f.afterSetup, f.beforeShipment, f.afterShipment, f.beforeBattle, f.game])
    assertHarassHomeworldCustody(state);
  assert.equal(f.shipmentStep.action.type, 'homeworldShip');
  assert.equal(f.battleStep.action.type, 'chooseBattle');
  assert.deepEqual(combatArmy(f.beforeShipment, f.visitor, f.location), { normal: 0, elite: 0 });
  assert.deepEqual(combatArmy(f.afterShipment, f.visitor, f.location), { normal: 3, elite: 4 });
  assert.equal(player(f.afterShipment, f.visitor).reserves, player(f.beforeShipment, f.visitor).reserves - 7);
  assert.equal(player(f.afterShipment, f.visitor).elites!.reserves, player(f.beforeShipment, f.visitor).elites!.reserves - 4);
  assert.equal(f.game.battle!.harassAllocationVersion, 1);
  let game = sealHarassHomeworldPlan(f.game, f.planActions[0]);
  assert.ok(!game.battle!.revealed);
  assert.equal(game.battle!.harassAllocation, undefined);
  assert.equal(viewGame(game, f.opponent).battle!.plans[f.owner], undefined);
  const sealedPlan = structuredClone(game.battle!.plans[f.owner]);
  assert.equal(sealedPlan[sample.slot], HARASS_HOMEWORLD_CARD);
  game = sealHarassHomeworldPlan(game, f.planActions[1]);
  assert.equal(game.battle!.revealed, true);
  assert.equal(game.decision?.kind, 'harassWithdraw');
  assert.deepEqual(game.battle!.plans[f.owner], sealedPlan);
  const offer = viewGame(game, f.owner).battle!.harassAllocation!;
  assert.deepEqual(offer.context.locations, { [f.location]: { normal: 3, elite: 4 } });
  assert.deepEqual(offer.context.forces.normal, 3);
  assert.deepEqual(offer.context.forces.elite, 4);
  assert.equal(viewGame(game, f.opponent).battle!.harassAllocation, null);
  const beforeSelection = structuredClone(game);
  game = chooseHarassHomeworldReturn(game, f.returns);
  assert.deepEqual(game.battle!.plans[f.owner], sealedPlan);
  assert.deepEqual(game.homeworlds, beforeSelection.homeworlds, 'Allocation selection is not a premature withdrawal');
  for (const p of game.players) {
    assert.equal(p.reserves, player(beforeSelection, p.id).reserves);
    assert.equal(p.tanks, player(beforeSelection, p.id).tanks);
  }
  assert.deepEqual(viewGame(game, f.owner).battle!.traitorVoters, [f.native]);
  rejectsUnchanged(game, f.visitor, { type: 'traitorCall', call: false });
  const actions: HarassHomeworldStep[] = [];
  const done = finishHarassHomeworldBattle(game, { actions });
  const returned = f.returns[f.location], amount = returned.normal + returned.elite;
  const before = player(f.game, f.owner), after = player(done, f.owner);
  assert.equal(done.lastBattleContext!.winner, f.native);
  assert.equal(done.lastBattleContext!.result, 'normal');
  assert.equal(after.reserves, before.reserves + amount);
  assert.equal(after.elites!.reserves, before.elites!.reserves + returned.elite);
  assert.equal(after.tanks, before.tanks + 7 - amount);
  assert.equal(after.elites!.tanks, before.elites!.tanks + 4 - returned.elite);
  assert.equal(after.battleLosses, before.battleLosses + 7 - amount);
  assert.equal(after.revived, before.revived);
  assert.equal(after.freeForcesRevived, before.freeForcesRevived);
  assert.equal(after.elites!.revived, before.elites!.revived);
  assert.deepEqual(combatArmy(done, f.owner, f.location), { normal: 0, elite: 0 });
  const primary = 'homeworld:emperor';
  const homeBefore = harassHomeworldPool(f.game, f.owner, primary);
  assert.deepEqual(harassHomeworldPool(done, f.owner, primary), sample.advanced
    ? { normal: homeBefore.normal + returned.normal, elite: homeBefore.elite }
    : { normal: homeBefore.normal + returned.normal, elite: homeBefore.elite + returned.elite });
  if (sample.advanced) {
    const salusa = harassHomeworldPool(f.game, f.owner, 'homeworld:emperor:salusa');
    assert.deepEqual(harassHomeworldPool(done, f.owner, 'homeworld:emperor:salusa'),
      { normal: salusa.normal, elite: salusa.elite + returned.elite });
  }
  assert.equal(player(done, f.native).tanks - player(f.game, f.native).tanks, 3);
  assert.deepEqual(actions.filter(s => s.action.type === 'traitorCall').map(s => s.actor), [f.native]);
  assert.equal(after.leaders.find(l => l.id === sealedPlan.leader)!.dead, false, 'Ordinary leader resolution is unchanged');
  assertFinished(done, f.owner, f.location);
  const continued = advanceHarassHomeworld(done, g => g.phase === 7 && harassHomeworldClean(g));
  assert.equal(continued.turn, f.game.turn);
  assertFinished(continued, f.owner, f.location);
});

void test('Advanced visitor winner pays its fixed original support and discards Harass instead of retaining it', () => {
  const f = createHarassHomeworldFixture({ advanced: true, slot: 'weapon', outcome: 'win' });
  let game = revealHarassHomeworldBattle(f);
  const sealedPlan = structuredClone(game.battle!.plans[f.owner]);
  game = chooseHarassHomeworldReturn(game, f.returns);
  assert.deepEqual(game.battle!.plans[f.owner], sealedPlan);
  const before = player(f.game, f.owner);
  const done = finishHarassHomeworldBattle(game);
  const after = player(done, f.owner);
  assert.equal(done.lastBattleContext!.winner, f.owner);
  assert.equal(after.reserves, before.reserves + 5);
  assert.equal(after.tanks, before.tanks + 2);
  assert.equal(after.elites!.tanks, before.elites!.tanks + 1);
  assert.equal(after.battleLosses, before.battleLosses + 2);
  assert.equal(after.spice, before.spice - 1, 'No leader dies here; original one-spice support is charged exactly once');
  assert.deepEqual(combatArmy(done, f.owner, f.location), { normal: 0, elite: 0 });
  assertFinished(done, f.owner, f.location);
});

for (const sample of [
  { advanced: false, secondary: false, slot: 'weapon' as const },
  { advanced: true, secondary: false, slot: 'defense' as const },
  { advanced: true, secondary: true, slot: 'weapon' as const },
]) void test(`${sample.advanced ? 'Advanced' : 'Basic'} own ${sample.secondary ? 'Salusa' : 'Kaitain'} forbids Harass immutably but accepts the plain original plan`, () => {
  const f = createHarassHomeworldFixture({ ...sample, role: 'native' });
  assert.equal(homeworldBattleLocation(f.game, f.location)!.native, f.owner);
  const preview = viewGame(f.game, f.owner).battle!.harassWithdraw!;
  assert.match(preview.blocked!, /own.*Homeworld/i);
  rejectsUnchanged(f.game, f.owner, f.planActions[0].action, /own.*Homeworld/i);
  assert.equal(Object.keys(f.game.battle!.plans).length, 0);
  assert.ok(player(f.game, f.owner).hand.some(c => c.id === HARASS_HOMEWORLD_CARD));
  const plain: HarassHomeworldStep = { actor: f.owner, action: { ...f.planActions[0].action, weapon: null, defense: null } };
  let game = sealHarassHomeworldPlan(f.game, plain);
  game = sealHarassHomeworldPlan(game, f.planActions[1]);
  assert.equal(game.battle!.revealed, true);
  assert.deepEqual(viewGame(game, f.owner).battle!.traitorVoters, [f.owner]);
  const actions: HarassHomeworldStep[] = [];
  game = finishHarassHomeworldBattle(game, { actions });
  assert.equal(game.battle, null);
  assert.ok(harassHomeworldClean(game));
  assert.equal(game.lastBattleContext!.territory, f.location);
  assert.equal(game.lastBattleContext!.result, 'normal');
  assert.ok(player(game, f.owner).hand.some(c => c.id === HARASS_HOMEWORLD_CARD), 'Rejected card was never used');
  assert.equal(game.discard.filter(c => c.id === HARASS_HOMEWORLD_CARD).length, 0);
  assert.ok(actions.filter(s => s.action.type === 'traitorCall').every(s => s.actor === f.owner));
  assertHarassHomeworldCustody(game);
});

void test('the real opposing native Traitor cancels a selected typed withdrawal; no invader vote is invented', () => {
  const f = createHarassHomeworldFixture({ advanced: true, slot: 'defense', outcome: 'traitor' });
  let game = revealHarassHomeworldBattle(f);
  assert.ok(player(game, f.native).traitors.includes(game.battle!.plans[f.owner].leader!));
  game = chooseHarassHomeworldReturn(game, f.returns);
  assert.deepEqual(viewGame(game, f.owner).battle!.traitorVoters, [f.native]);
  rejectsUnchanged(game, f.visitor, { type: 'traitorCall', call: true });
  const actions: HarassHomeworldStep[] = [];
  const done = finishHarassHomeworldBattle(game, { callers: [f.native], actions });
  const before = player(f.game, f.owner), after = player(done, f.owner);
  assert.equal(done.lastBattleContext!.result, 'traitor');
  assert.equal(done.lastBattleContext!.winner, f.native);
  assert.equal(after.reserves, before.reserves);
  assert.equal(after.elites!.reserves, before.elites!.reserves);
  assert.equal(after.tanks, before.tanks + 7);
  assert.equal(after.elites!.tanks, before.elites!.tanks + 4);
  assert.equal(after.battleLosses, before.battleLosses + 7);
  assert.equal(after.revived, before.revived);
  assert.equal(after.elites!.revived, before.elites!.revived);
  assert.deepEqual(combatArmy(done, f.owner, f.location), { normal: 0, elite: 0 });
  assert.equal(player(done, f.native).tanks, player(f.game, f.native).tanks);
  assert.equal(after.leaders.find(l => l.id === f.planActions[0].action.leader)!.dead, true);
  assertFinished(done, f.owner, f.location);
});

void test('Harass precedes Lasgun/Shield: returned visitors survive while native losses retain the printed Homeworld exception', () => {
  const f = createHarassHomeworldFixture({ advanced: true, slot: 'defense', outcome: 'explosion' });
  let game = revealHarassHomeworldBattle(f);
  const nativeBefore = combatArmy(f.game, f.native, f.location);
  const printed = homeworldBattleLocation(f.game, f.location)!.nativeBattleStrength;
  assert.ok(nativeBefore.normal > printed);
  const ownPlan = structuredClone(game.battle!.plans[f.owner]);
  const enemyPlan = structuredClone(game.battle!.plans[f.opponent]);
  assert.equal(player(game, f.owner).hand.find(c => c.id === ownPlan.weapon)!.kind, 'lasgun');
  assert.equal(player(game, f.opponent).hand.find(c => c.id === enemyPlan.defense)!.kind, 'shield');
  game = chooseHarassHomeworldReturn(game, f.returns);
  assert.deepEqual(game.battle!.plans[f.owner], ownPlan);
  const actions: HarassHomeworldStep[] = [];
  const done = finishHarassHomeworldBattle(game, { actions });
  const before = player(f.game, f.owner), after = player(done, f.owner);
  assert.equal(done.lastBattleContext!.result, 'explosion');
  assert.equal(done.lastBattleContext!.winner, null);
  assert.equal(after.reserves, before.reserves + 5);
  assert.equal(after.elites!.reserves, before.elites!.reserves + 3);
  assert.equal(after.tanks, before.tanks + 2);
  assert.equal(after.elites!.tanks, before.elites!.tanks + 1);
  assert.equal(after.battleLosses, before.battleLosses + 2);
  assert.equal(after.revived, before.revived);
  assert.equal(after.freeForcesRevived, before.freeForcesRevived);
  assert.equal(after.elites!.revived, before.elites!.revived);
  assert.deepEqual(combatArmy(done, f.owner, f.location), { normal: 0, elite: 0 });
  assert.deepEqual(combatArmy(done, f.native, f.location), { normal: nativeBefore.normal - printed, elite: nativeBefore.elite });
  assert.equal(player(done, f.native).reserves, player(f.game, f.native).reserves - printed);
  assert.equal(player(done, f.native).tanks, player(f.game, f.native).tanks + printed);
  assert.equal(player(done, f.native).battleLosses, player(f.game, f.native).battleLosses + printed);
  assert.equal(after.leaders.find(l => l.id === ownPlan.leader)!.dead, true);
  assert.equal(player(done, f.opponent).leaders.find(l => l.id === enemyPlan.leader)!.dead, true);
  for (const id of [HARASS_HOMEWORLD_CARD, ownPlan.weapon, enemyPlan.defense])
    assert.equal(done.discard.filter(c => c.id === id).length, 1);
  assert.deepEqual(actions.filter(s => s.action.type === 'traitorCall').map(s => s.actor), [f.native]);
  assertFinished(done, f.owner, f.location);
});
