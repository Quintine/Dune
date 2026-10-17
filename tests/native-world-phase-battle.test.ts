import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, RuleError, viewGame } from '../game/engine';
import { combatArmy } from '../game/combat-location';
import {
  advanceNativeWorldBattle, assertNativeWorldBattleInventory, HARASS_WITHDRAW_CARD,
  nativeWorldBattleFinished, nativeWorldBattlePlayer as player, nativeWorldBattlePool as pool,
  REINFORCEMENTS_CARD, revealNativeWorldBattle, type NativeWorldBattleStep,
} from './fixture-native-world-battle';
import {
  createNativeWorldPhaseBattleFixture, createNativeWorldPhaseForeignBattleFixture,
  createNativeWorldPhaseOwnBattleFixture, finishNativeWorldPhaseBattle, revealNativeWorldPhaseBattle,
  settleNativeWorldPhaseBattle,
} from './fixture-native-world-phase-battle';

for (const scenario of [
  { advanced: true, tech: true, support: 0 },
  { advanced: true, tech: true, support: 1 },
  { advanced: true, tech: true, support: 3 },
  { advanced: true, tech: false, support: 3 },
  { advanced: false, tech: true, support: 0 },
] as const) {
  void test(`native Ix ${scenario.advanced ? 'Advanced earned Arrakeen' : 'Basic'} / Tech ${scenario.tech}: actual support ${scenario.support}, native fee, typed Harass`, () => {
    const f = createNativeWorldPhaseBattleFixture(scenario);
    const ownShipment = f.shipments[0];
    assert.equal(ownShipment.step.actor, f.owner);
    assert.equal(player(ownShipment.before, f.owner).spice - player(ownShipment.after, f.owner).spice, 6);
    assert.deepEqual(combatArmy(ownShipment.after, f.owner, 'arrakeen'), { normal: 3, elite: 3 });
    assert.deepEqual(pool(f.game, f.owner, 'homeworld:ixians'), { normal: 7, elite: 1 });
    assert.deepEqual(combatArmy(f.game, f.owner, 'arrakeen'), { normal: 3, elite: 3 });
    if (scenario.advanced) {
      assert.equal(f.beforeFirstMentat.strongholdCards!.owners.arrakeen, null);
      assert.deepEqual(combatArmy(f.beforeFirstMentat, f.owner, 'arrakeen'), { normal: 3, elite: 3 });
      assert.equal(f.afterFirstMentat.strongholdCards!.owners.arrakeen, f.owner);
      assert.equal(f.afterFirstMentat.strongholdCards!.claimedTurn, 1);
      assert.equal(viewGame(f.game, f.owner).battle!.strongholdEffects[f.owner], 'arrakeen');
    } else assert.equal(viewGame(f.game, f.owner).strongholdCards, null);
    assert.deepEqual(f.game.battle!.plans, {}, 'Both original controls start at the unsealed plan boundary');
    const before = structuredClone(f.game);
    assert.throws(() => applyAction(f.game, f.owner, { ...f.planActions[0].action, dial: 9.5 }), RuleError,
      'R adds score, not physical Suboids/Cyborgs available to dial');
    if (scenario.advanced)
      assert.throws(() => applyAction(f.game, f.owner, { ...f.planActions[0].action, support: 4 }), RuleError,
        'Only three actual Cyborgs can be supported; neither R +2 nor bank2 adds counters');
    assert.throws(() => applyAction(f.game, f.owner, { ...f.planActions[0].action,
      reinforcementsSources: { 'homeworld:guild': { normal: 3, elite: 0 } } }), RuleError);
    assert.deepEqual(f.game, before);

    const revealed = revealNativeWorldPhaseBattle(f);
    assert.equal(player(revealed, f.owner).reserves, 8, 'Sealing/reveal never spends a forecast fee');
    assert.equal(player(revealed, f.owner).spice, player(f.game, f.owner).spice,
      'Holding Arrakeen never credits two personal spice at the plan boundary');
    const settled = settleNativeWorldPhaseBattle(revealed, f);
    assert.equal(player(settled, f.owner).spice,
      player(f.game, f.owner).spice - Math.max(0, scenario.support - 2));
    const done = finishNativeWorldPhaseBattle(settled, f);
    assert.equal(done.turn, 2); assert.equal(done.phase, 7);
    assert.equal(done.lastBattleContext!.winner, f.owner);
    assert.equal(done.lastBattleContext!.result, 'normal');
    assert.equal(player(done, f.owner).tanks, 6, 'Exactly native fee3N and the three physically committed Cyborgs');
    assert.equal(player(done, f.owner).elites!.tanks, 3, 'No Cyborg is silently used instead of available normal fee counters');
    assert.equal(player(done, f.owner).battleLosses, 6);
    assert.deepEqual(pool(done, f.owner, 'homeworld:ixians'), { normal: 7, elite: 1 },
      'Ix7N1E pays original3N, then all three undialed Suboids return to native Ix');
    assert.equal(player(done, f.owner).reserves, 8);
    assert.deepEqual(combatArmy(done, f.owner, 'arrakeen'), { normal: 0, elite: 0 });
    assert.equal(player(done, f.owner).forces['hidden_mobile_stronghold:0'], 6);
    assert.equal(player(done, f.owner).elites!.forces['hidden_mobile_stronghold:0'], 3);
    assert.equal(player(done, f.opponent).tanks, 3);
    for (const card of [REINFORCEMENTS_CARD, HARASS_WITHDRAW_CARD])
      assert.equal(done.discard.filter(face => face.id === card).length, 1);
    if (scenario.tech) {
      assert.equal(f.game.techTokens!.heighliners.spice, 0, 'Original phase-end shipment income has already settled');
      assert.ok(done.techTokens, 'Original winner reward/cleanup preserves the actual Tech module');
    } else assert.equal(done.techTokens, undefined);
    assertNativeWorldBattleInventory(done, f.afterSetup);
  });
}

for (const advanced of [false, true]) {
  void test(`${advanced ? 'Advanced Tech+Strongholds' : 'Basic Tech'} foreign World: exact original mixed fee cannot borrow future Harass returns`, () => {
    const f = createNativeWorldPhaseForeignBattleFixture({ advanced });
    assert.ok(f.game.techTokens);
    assert.equal(viewGame(f.game, f.owner).battle!.strongholdEffects[f.owner], null,
      'A Stronghold Card never grants its Arrakis-local benefit on a foreign World');
    assert.deepEqual(pool(f.game, f.owner, 'homeworld:ixians'), { normal: 1, elite: 4 });
    assert.deepEqual(f.sources, { 'homeworld:ixians': { normal: 1, elite: 2 } });
    const before = structuredClone(f.game);
    assert.throws(() => applyAction(f.game, f.owner, { ...f.planActions[0].action,
      reinforcementsSources: { 'homeworld:ixians': { normal: 3, elite: 0 } } }), RuleError);
    assert.deepEqual(f.game, before);
    const done = advanceNativeWorldBattle(revealNativeWorldBattle(f), nativeWorldBattleFinished, [], { returns: f.returns });
    assert.equal(done.lastBattleContext!.winner, f.opponent);
    assert.deepEqual(pool(done, f.owner, 'homeworld:ixians'), { normal: 7, elite: 2 });
    assert.equal(player(done, f.owner).tanks, 5);
    assert.equal(player(done, f.owner).elites!.tanks, 2,
      'The future seven normal returns cannot repay the original two-Cyborg fee');
    assert.deepEqual(combatArmy(done, f.owner, f.location), { normal: 0, elite: 0 });
    assertNativeWorldBattleInventory(done, f.afterSetup);
  });

  void test(`${advanced ? 'Advanced Tech+Strongholds' : 'Basic Tech'} own Ix: Harass stays forbidden and local native fee is disjoint from dial`, () => {
    const f = createNativeWorldPhaseOwnBattleFixture(advanced), before = structuredClone(f.game);
    assert.deepEqual(pool(f.game, f.owner, f.location), { normal: 1, elite: 4 });
    assert.throws(() => applyAction(f.game, f.owner, { ...f.planActions[0].action, defense: HARASS_WITHDRAW_CARD }), RuleError);
    assert.throws(() => applyAction(f.game, f.owner, { ...f.planActions[0].action, dial: 4.5 }), RuleError,
      'After local1N2E fee, only two real Cyborgs remain eligible for the dial');
    assert.deepEqual(f.game, before);
    const revealed = revealNativeWorldBattle(f), forces = viewGame(revealed, f.owner).battle!.ownForces!;
    assert.equal(forces.normal, 0); assert.equal(forces.elite, 2);
    assert.equal(forces.normalFixedHalf, true); assert.equal(forces.eliteStrength, 2);
    assert.equal(forces.freeSupport, !advanced);
    const done = advanceNativeWorldBattle(revealed, nativeWorldBattleFinished);
    assert.equal(done.lastBattleContext!.winner, f.owner);
    assert.equal(player(done, f.owner).tanks, advanced ? 5 : 4);
    assert.equal(player(done, f.owner).elites!.tanks, advanced ? 4 : 3);
    assert.ok(player(done, f.owner).hand.some(card => card.id === HARASS_WITHDRAW_CARD));
    assertNativeWorldBattleInventory(done, f.afterSetup);
  });
}

void test('Advanced original phase modules: native board-only Cyborg substitution resumes real Face Dance without recovering reserve fees', () => {
  const f = createNativeWorldPhaseForeignBattleFixture({ typedAftercare: true });
  const steps: NativeWorldBattleStep[] = [];
  let game = advanceNativeWorldBattle(revealNativeWorldBattle(f), g => g.decision?.kind === 'ixSubstitution', steps,
    { casualties: { normal: 0, elite: 1 } });
  assert.equal(player(game, f.owner).tanks, 4);
  assert.equal(player(game, f.owner).elites!.tanks, 3);
  assert.deepEqual(combatArmy(game, f.owner, f.location), { normal: 9, elite: 0 });
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, f.owner, { type: 'decision', sources: { [f.location]: 3 },
    recover: { [f.location]: 3 } }), RuleError, 'Two native fee Cyborgs are not board casualty origins');
  assert.deepEqual(game, before);
  game = applyAction(game, f.owner, { type: 'decision', sources: { [f.location]: 1 }, recover: { [f.location]: 1 } });
  game = advanceNativeWorldBattle(game, g => g.decision?.kind === 'faceDance', steps);
  assert.deepEqual(combatArmy(game, f.owner, f.location), { normal: 8, elite: 1 });
  assert.equal(player(game, f.owner).elites!.tanks, 2);
  assert.equal(game.decision?.player, f.opponent);
  assert.equal(game.decision?.kind === 'faceDance' && game.decision.territory, f.location);
  assert.equal(viewGame(game, f.opponent).decision?.kind, 'faceDance');
  game = applyAction(game, f.opponent, { type: 'decision', reveal: true, sources: {} });
  game = advanceNativeWorldBattle(game, nativeWorldBattleFinished, steps);
  assert.deepEqual(combatArmy(game, f.owner, f.location), { normal: 0, elite: 0 });
  assert.deepEqual(pool(game, f.owner, 'homeworld:ixians'), { normal: 8, elite: 2 });
  assert.equal(player(game, f.owner).tanks, 4); assert.equal(player(game, f.owner).elites!.tanks, 2);
  assert.equal(player(game, f.owner).leaders.find(l => l.id === f.planActions[0].action.leader)!.dead, true);
  assert.ok(steps.some(step => step.action.type === 'decision' && step.action.choice !== undefined),
    'The genuine native typed casualty decision precedes the separate substitution and Face Dance queues');
  assertNativeWorldBattleInventory(game, f.afterSetup);
});

void test('all14 earned Arrakeen funds actual Cyborg support while selected Suk rescues board losses before original Face Dance', () => {
  const f = createNativeWorldPhaseBattleFixture({ skills: true, skilled: true, harass: false, support: 3,
    training: { ixians: 'suk-graduate', tleilaxu: 'killer-medic', guild: 'sandmaster' } });
  assert.equal(f.beforeFirstMentat.strongholdCards!.owners.arrakeen, null);
  assert.equal(f.afterFirstMentat.strongholdCards!.owners.arrakeen, f.owner);
  assert.equal(viewGame(f.game, f.owner).battle!.strongholdEffects[f.owner], 'arrakeen');
  let game = advanceNativeWorldBattle(revealNativeWorldPhaseBattle(f), g => g.decision?.kind === 'sukRescue', [],
    { casualties: { normal: 0, elite: 3 } });
  assert.ok(game.decision?.kind === 'sukRescue');
  assert.deepEqual(game.pendingSukRescue!.pool, [{ key: f.location, normal: 3, elite: 3 }]);
  assert.deepEqual(game.pendingSukRescue!.losses, { normal: 0, elite: 3, paidNormal: 0, paidElite: 3 });
  assert.equal(player(game, f.owner).spice, player(f.game, f.owner).spice - 1,
    'Only the real earned Arrakeen benefit covers two of the three selected support');
  assert.equal(player(game, f.owner).tanks, 3);
  assert.equal(player(game, f.owner).elites!.tanks, 0);
  assert.ok(game.decision.options.every(o => o.normal === 0), 'The three original native fee normals are not rescuable');
  const choice = game.decision.options.findIndex(o => o.elite === 3 && o.kept?.key === f.location && o.kept.kind === 'elite');
  assert.ok(choice >= 0);
  game = applyAction(game, f.owner, { type: 'decision', event: game.decision.event, choice });
  game = settleNativeWorldPhaseBattle(game, f);
  assert.equal(game.decision?.kind, 'faceDance', 'The actual native spectator continuation resumes after Suk and card disposal');
  assert.deepEqual(pool(game, f.owner, 'homeworld:ixians'), { normal: 4, elite: 3 });
  assert.deepEqual(combatArmy(game, f.owner, 'arrakeen'), { normal: 3, elite: 1 });
  assert.equal(game.lastBattleContext!.sukRescue!.physical!.source, 'arrakis');
  assert.deepEqual(game.lastBattleContext!.sukRescue!.physical!.destinations,
    { 'homeworld:ixians': { normal: 0, elite: 2 } });
  const done = finishNativeWorldPhaseBattle(game, f);
  assert.equal(done.lastBattleContext!.winner, f.owner);
  assert.equal(done.lastBattleContext!.sukRescue!.completed, true);
  assert.equal(player(done, f.owner).tanks, 3);
  assert.equal(player(done, f.owner).elites!.tanks, 0);
  assert.equal(player(done, f.owner).battleLosses, 6);
  assert.equal(done.discard.filter(c => c.id === REINFORCEMENTS_CARD).length, 1);
  assert.equal(done.strongholdCards!.owners.arrakeen, f.owner);
  assert.ok(done.techTokens);
  assertNativeWorldBattleInventory(done, f.afterSetup);
});

void test('Basic all14 visitor Suk keeps the only committed Cyborg before native Face Dance returns it and kills the trained disc', () => {
  const f = createNativeWorldPhaseForeignBattleFixture({ advanced: false, skills: true, skilled: true, typedAftercare: true,
    training: { ixians: 'suk-graduate', tleilaxu: 'killer-medic', guild: 'sandmaster' } });
  assert.equal(viewGame(f.game, f.owner).battle!.strongholdEffects[f.owner], null);
  let game = advanceNativeWorldBattle(revealNativeWorldBattle(f), g => g.decision?.kind === 'sukRescue', [],
    { casualties: { normal: 0, elite: 1 } });
  assert.ok(game.decision?.kind === 'sukRescue');
  assert.deepEqual(game.pendingSukRescue!.losses, { normal: 0, elite: 1, paidNormal: 0, paidElite: 0 });
  assert.equal(player(game, f.owner).tanks, 3);
  assert.equal(player(game, f.owner).elites!.tanks, 2);
  const choice = game.decision.options.findIndex(o => o.elite === 1 && o.kept?.key === f.location && o.kept.kind === 'elite');
  assert.ok(choice >= 0);
  game = applyAction(game, f.owner, { type: 'decision', event: game.decision.event, choice });
  game = advanceNativeWorldBattle(game, g => g.decision?.kind === 'faceDance');
  assert.equal(game.pendingIxSubstitution, undefined, 'The single board Cyborg was saved, while the two fee Cyborgs cannot supply substitution');
  assert.deepEqual(combatArmy(game, f.owner, f.location), { normal: 9, elite: 1 });
  assert.equal(game.decision!.player, f.opponent);
  assert.equal(game.discard.filter(c => c.id === REINFORCEMENTS_CARD).length, 1);
  game = applyAction(game, f.opponent, { type: 'decision', reveal: true, sources: {} });
  game = advanceNativeWorldBattle(game, nativeWorldBattleFinished);
  assert.deepEqual(combatArmy(game, f.owner, f.location), { normal: 0, elite: 0 });
  assert.deepEqual(pool(game, f.owner, 'homeworld:ixians'), { normal: 9, elite: 2 });
  assert.equal(player(game, f.owner).tanks, 3);
  assert.equal(player(game, f.owner).elites!.tanks, 2);
  assert.equal(player(game, f.owner).leaders.find(l => l.id === f.planActions[0].action.leader)!.dead, true);
  assert.ok(!game.leaderSkills!.assignments.some(a => a.leader === f.planActions[0].action.leader));
  assert.equal(game.leaderSkills!.deck.filter(skill => skill === 'suk-graduate').length, 1,
    'Original native Face Dance death returns the singleton trained card instead of retaining a dead assignment');
  assertNativeWorldBattleInventory(game, f.afterSetup);
});
