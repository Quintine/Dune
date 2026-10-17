import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyAction, viewGame } from '../game/engine';
import { botActions } from '../game/bots';
import { MOBILE_LOCATION } from '../game/board';
import { REINFORCEMENTS_CARD } from '../game/reinforcements';
import { HARASS_WITHDRAW_CARD } from '../game/harass-withdraw';
import {
  activateSelectedIndependentSuboids, actSelectedIndependentNexusBattle,
  advanceSelectedIndependentNexusBattle, createSelectedIndependentNexusBattleFixture,
  revealSelectedIndependentNexusPlans, selectedIndependentNexusClean,
  selectedIndependentNexusPlayer as player,
} from './fixture-selected-independent-nexus-battles';

for (const advanced of [false, true]) {
  void test(`${advanced ? 'Advanced' : 'Basic'} original selected Ix Cunning pays its mixed physical fee before Harass returns eight Suboids`, () => {
    const f = createSelectedIndependentNexusBattleFixture({ advanced, program: 'mixed-return', expansions: ['ix'] });
    assert.deepEqual(f.fee, { normal: 1, elite: 2 });
    assert.equal(f.ownShipment.action.amount, 9);
    assert.equal(f.ownShipment.action.elite, 0);
    assert.equal(player(f.beforeShipment, 'ixians').spice - player(f.afterShipment, 'ixians').spice, 9);
    assert.equal(f.purchases.length, 2);
    assert.ok(f.purchases.every(purchase => purchase.step.action.type === 'bid' && purchase.step.action.amount === 1));
    if (!advanced) assert.ok(f.actions.some(step => step.actor === 'ixians' && step.action.type === 'charity'),
      'After spending the original ten spice, Basic funds the second bid through its actual eligible charity claim');
    assert.ok(player(f.purchases[1].before, 'ixians').spice >= 1);
    assert.equal(f.afterNexusDraw.nexusCards!.cards!.hands.ixians, 'ixians');
    assert.equal(player(f.afterNexusDraw, 'guild').ally, 'emperor');
    assert.equal(player(f.afterNexusDraw, 'ixians').ally, null);
    assert.ok(player(f.game, 'ixians').hand.some(card => card.id === REINFORCEMENTS_CARD));
    assert.ok(player(f.game, 'ixians').hand.some(card => card.id === HARASS_WITHDRAW_CARD));
    const before = player(f.game, 'ixians');
    let game = activateSelectedIndependentSuboids(f.game, f.actions);
    const own = viewGame(game, 'ixians').battle!.ownForces!;
    assert.deepEqual([own.normal, own.elite, own.normalFixedHalf, own.normalFreeSupport], [9, 0, false, true]);
    assert.deepEqual(viewGame(game, 'ixians').battle!.reinforcements!.normal, 1);
    assert.deepEqual(viewGame(game, 'ixians').battle!.reinforcements!.elite, 2);
    game = revealSelectedIndependentNexusPlans(game, f.plans, f.actions);
    assert.equal(game.decision, null,
      'One ordinary pool has a unique undialed return and needs no invented allocation prompt');
    game = advanceSelectedIndependentNexusBattle(game, state => !state.battle && selectedIndependentNexusClean(state), f.actions);
    const after = player(game, 'ixians');
    assert.equal(game.lastBattleContext!.winner, 'ixians');
    assert.equal(game.lastBattleContext!.result, 'normal');
    assert.equal(after.forces[f.location] ?? 0, 0);
    assert.equal(after.reserves, before.reserves - 3 + 8);
    assert.equal(after.elites!.reserves, before.elites!.reserves - 2,
      'Returned ordinary Suboids cannot replace the originally quoted two Cyborg fee counters');
    assert.equal(after.tanks, before.tanks + 4, 'The original fee3 and one committed physical Suboid pay once');
    assert.equal(after.elites!.tanks, before.elites!.tanks + 2);
    assert.equal(after.forces[MOBILE_LOCATION], before.forces[MOBILE_LOCATION]);
    assert.equal(after.elites!.forces[MOBILE_LOCATION], before.elites!.forces[MOBILE_LOCATION]);
    assert.ok(!game.pendingIxSubstitution,
      'Reserve-fee Cyborgs are not actual battlefield Cyborg casualties available for substitution');
    assert.equal(player(game, 'guild').tanks, player(f.game, 'guild').tanks + 3);
    for (const card of [REINFORCEMENTS_CARD, HARASS_WITHDRAW_CARD])
      assert.equal(game.discard.filter(physical => physical.id === card).length, 1);
    assert.equal(game.nexusCards!.cards!.discard.filter(card => card === 'ixians').length, 1);
    assert.equal(viewGame(game, 'ixians').nexusSuboids!.active, true);
  });
}

for (const modules of [false, true]) {
  void test(`original selected ${modules ? 'union E1/E2 Worlds/all14/phase' : 'E1'} Cunning preserves actual Cyborg losses and equal residual Suboid substitution`, () => {
    const f = createSelectedIndependentNexusBattleFixture({ advanced: true, program: 'substitution',
      expansions: modules ? ['ix', 'choam'] : ['ix'], homeworlds: modules, skills: modules,
      tech: modules, strongholds: modules });
    assert.deepEqual(f.fee, { normal: 3, elite: 0 });
    assert.equal(f.ownShipment.action.amount, 6);
    assert.equal(f.ownShipment.action.elite, 3);
    if (modules) {
      assert.ok(f.plans[0].action.reinforcementsSources);
      assert.equal(f.afterFirstMentat.strongholdCards!.owners.arrakeen, 'ixians');
    }
    const original = player(f.game, 'ixians');
    let game = activateSelectedIndependentSuboids(f.game, f.actions);
    game = revealSelectedIndependentNexusPlans(game, f.plans, f.actions);
    game = advanceSelectedIndependentNexusBattle(game, state => !state.response && !state.phaseOpening &&
      (state.decision?.kind === 'battleLosses' || state.decision?.kind === 'ixSubstitution'), f.actions);
    if (game.decision?.kind === 'battleLosses') {
      const choice = game.decision.options.findIndex(loss => loss.normal === 1 && loss.elite === 1); assert.ok(choice >= 0);
      game = actSelectedIndependentNexusBattle(game, { actor: 'ixians', action: { type: 'decision', choice } }, f.actions);
    }
    game = advanceSelectedIndependentNexusBattle(game, state => !state.response && !state.phaseOpening &&
      state.decision?.kind === 'ixSubstitution', f.actions);
    assert.equal(player(game, 'ixians').forces[f.location], 4);
    assert.equal(player(game, 'ixians').elites!.forces[f.location], 2);
    assert.equal(player(game, 'ixians').tanks, original.tanks + 5);
    assert.equal(player(game, 'ixians').elites!.tanks, original.elites!.tanks + 1);
    assert.deepEqual(game.pendingIxSubstitution!.losses, { [f.location]: 1 });
    assert.throws(() => applyAction(game, 'ixians', { type: 'decision',
      sources: { [f.location]: 2 }, recover: { [f.location]: 2 } }));
    game = actSelectedIndependentNexusBattle(game, { actor: 'ixians', action: { type: 'decision',
      sources: { [f.location]: 1 }, recover: { [f.location]: 1 } } }, f.actions);
    game = advanceSelectedIndependentNexusBattle(game, state => !state.battle && selectedIndependentNexusClean(state), f.actions);
    const after = player(game, 'ixians');
    assert.equal(game.lastBattleContext!.winner, 'ixians');
    assert.equal(after.forces[f.location], 4);
    assert.equal(after.elites!.forces[f.location], 3);
    assert.equal(after.tanks, original.tanks + 5);
    assert.equal(after.elites!.tanks, original.elites!.tanks);
    assert.equal(after.reserves, original.reserves - 3);
    assert.equal(after.elites!.reserves, original.elites!.reserves);
    assert.equal(game.discard.filter(card => card.id === REINFORCEMENTS_CARD).length, 1);
    assert.equal(after.forces[MOBILE_LOCATION], original.forces[MOBILE_LOCATION]);
    assert.equal(after.elites!.forces[MOBILE_LOCATION], original.elites!.forces[MOBILE_LOCATION]);
  });
}

void test('original selected independent Cunning completes actual reserve fees and residual substitution before a genuinely dealt Face Dance', () => {
  const f = createSelectedIndependentNexusBattleFixture({ advanced: true, program: 'faceDance', expansions: ['ix', 'choam'] });
  assert.ok(player(f.afterSetup, 'tleilaxu').faceDancers!.some(dancer => dancer.leader === f.leader && !dancer.revealed));
  let game = revealSelectedIndependentNexusPlans(activateSelectedIndependentSuboids(f.game, f.actions), f.plans, f.actions);
  game = advanceSelectedIndependentNexusBattle(game, state => !state.response && !state.phaseOpening &&
    (state.decision?.kind === 'battleLosses' || state.decision?.kind === 'ixSubstitution'), f.actions);
  if (game.decision?.kind === 'battleLosses') {
    const choice = game.decision.options.findIndex(loss => loss.normal === 1 && loss.elite === 1); assert.ok(choice >= 0);
    game = actSelectedIndependentNexusBattle(game, { actor: 'ixians', action: { type: 'decision', choice } }, f.actions);
  }
  game = advanceSelectedIndependentNexusBattle(game, state => !state.response && !state.phaseOpening &&
    state.decision?.kind === 'ixSubstitution', f.actions);
  game = actSelectedIndependentNexusBattle(game, { actor: 'ixians', action: { type: 'decision',
    sources: { [f.location]: 1 }, recover: { [f.location]: 1 } } }, f.actions);
  game = advanceSelectedIndependentNexusBattle(game, state => !state.response && !state.phaseOpening &&
    state.decision?.kind === 'faceDance', f.actions);
  assert.equal(game.decision!.kind, 'faceDance');
  const before = player(game, 'ixians'), native = player(game, 'tleilaxu');
  assert.equal(before.forces[f.location], 4);
  assert.equal(before.elites!.forces[f.location], 3);
  assert.equal(game.discard.filter(card => card.id === REINFORCEMENTS_CARD).length, 1);
  game = actSelectedIndependentNexusBattle(game, { actor: 'tleilaxu', action: {
    type: 'decision', reveal: true, sources: { reserves: 4 }, sector: f.sector,
  } }, f.actions);
  game = advanceSelectedIndependentNexusBattle(game, state => !state.battle && selectedIndependentNexusClean(state), f.actions);
  const after = player(game, 'ixians');
  assert.equal(after.forces[f.location] ?? 0, 0);
  assert.equal(after.elites!.forces[f.location] ?? 0, 0);
  assert.equal(after.reserves, before.reserves + 4);
  assert.equal(after.elites!.reserves, before.elites!.reserves + 3);
  assert.equal(after.tanks, before.tanks);
  assert.equal(after.elites!.tanks, before.elites!.tanks);
  assert.equal(after.leaders.find(leader => leader.id === f.leader)!.dead, true);
  assert.equal(player(game, 'tleilaxu').reserves, native.reserves - 4);
  assert.equal(player(game, 'tleilaxu').forces[f.location], 4);
  assert.equal(player(game, 'tleilaxu').faceDancers!.find(dancer => dancer.leader === f.leader)!.revealed, true);
});

void test('all four minimal policies retain a positive native Reinforcements path after genuine selected-family Suboid Cunning', () => {
  const f = createSelectedIndependentNexusBattleFixture({ advanced: true, program: 'substitution', expansions: ['ix', 'choam'], homeworlds: true });
  const game = activateSelectedIndependentSuboids(f.game, f.actions);
  for (const difficulty of ['Easy', 'Medium', 'Hard', 'Brutal'] as const) {
    const view = viewGame(game, 'ixians');
    view.players.find(player => player.id === 'ixians')!.bot = difficulty;
    const action = botActions(view).find(action => action.type === 'battlePlan' && Number(action.dial) > 0 &&
      (action.weapon === REINFORCEMENTS_CARD || action.defense === REINFORCEMENTS_CARD));
    assert.ok(action, `${difficulty} must expose a positive original card plan`);
    assert.ok(action.reinforcementsSources, `${difficulty} must retain the original native source quote`);
    assert.ok(applyAction(game, 'ixians', action).battle!.plans.ixians);
  }
});
