import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, RuleError, viewGame } from '../game/engine';
import { combatArmy } from '../game/combat-location';
import {
  advanceNativeWorldBattle, assertNativeWorldBattleInventory, createNativeWorldBattleFixture,
  HARASS_WITHDRAW_CARD, nativeWorldBattleFinished, nativeWorldBattlePlayer, nativeWorldBattlePool,
  REINFORCEMENTS_CARD, revealNativeWorldBattle, type NativeWorldBattleStep,
} from './fixture-native-world-battle';

for (const advanced of [false, true]) {
  const rules = advanced ? 'Advanced' : 'Basic';

  void test(`${rules}: nine paid Suboids retain original 1N4E reserves; Reinforcements pays 1N2E before Harass returns`, () => {
    const f = createNativeWorldBattleFixture({ advanced });
    const shipment = f.shipments[0], original = nativeWorldBattlePlayer(shipment.before, f.owner);
    const shipped = nativeWorldBattlePlayer(shipment.after, f.owner);
    assert.equal(shipment.cost, 9);
    assert.equal(shipped.spice, original.spice - 9);
    assert.deepEqual(combatArmy(shipment.after, f.owner, f.location), { normal: 9, elite: 0 });
    assert.deepEqual(nativeWorldBattlePool(f.game, f.owner, 'homeworld:ixians'), { normal: 1, elite: 4 });
    assert.deepEqual(f.sources, { 'homeworld:ixians': { normal: 1, elite: 2 } });
    const before = structuredClone(f.game);
    assert.throws(() => applyAction(f.game, f.owner, { ...f.planActions[0].action,
      reinforcementsSources: { 'homeworld:ixians': { normal: 3, elite: 0 } } }), RuleError);
    assert.deepEqual(f.game, before, 'Seven future returned Suboids cannot replace the two original Cyborg fees');
    assert.throws(() => applyAction(f.game, f.owner, { ...f.planActions[0].action,
      reinforcementsSources: { [f.location]: { normal: 1, elite: 2 } } }));
    assert.deepEqual(f.game, before, 'Foreign visitor stock is not a native fee source');

    const revealed = revealNativeWorldBattle(f);
    assert.deepEqual(viewGame(revealed, f.owner).battle!.traitorVoters, ['tleilaxu']);
    assert.throws(() => applyAction(revealed, f.owner, { type: 'traitorCall', call: false }));
    const steps: NativeWorldBattleStep[] = [];
    const done = advanceNativeWorldBattle(revealed, nativeWorldBattleFinished, steps, { returns: f.returns });
    const p = nativeWorldBattlePlayer(done, f.owner);
    assert.equal(done.lastBattleContext?.winner, 'tleilaxu');
    assert.equal(p.reserves, 9, 'Original five minus fee three plus seven returned normals');
    assert.equal(p.elites!.reserves, 2, 'Returned normals never undo the original two-Cyborg payment');
    assert.equal(p.tanks, 5, 'Fee three plus only the two committed Suboids');
    assert.equal(p.elites!.tanks, 2);
    assert.deepEqual(nativeWorldBattlePool(done, f.owner, 'homeworld:ixians'), { normal: 7, elite: 2 });
    assert.deepEqual(combatArmy(done, f.owner, f.location), { normal: 0, elite: 0 });
    assert.ok(!done.pendingIxSubstitution);
    for (const id of [REINFORCEMENTS_CARD, HARASS_WITHDRAW_CARD])
      assert.equal(done.discard.filter(c => c.id === id).length, 1);
    assert.deepEqual(p.forces, nativeWorldBattlePlayer(f.afterSetup, f.owner).forces, 'Original HMS garrison stays physical');
    assertNativeWorldBattleInventory(done, f.afterSetup);
  });

  void test(`${rules}: own Ix removes local fees from the physical dial, retains Cyborg/Suboid traits and forbids Harass`, () => {
    const f = createNativeWorldBattleFixture({ advanced, route: 'ix-native', faceDancer: true });
    assert.deepEqual(nativeWorldBattlePool(f.game, f.owner, f.location), { normal: 1, elite: 4 });
    const before = structuredClone(f.game);
    assert.throws(() => applyAction(f.game, f.owner, { ...f.planActions[0].action, defense: HARASS_WITHDRAW_CARD }),
      RuleError);
    assert.throws(() => applyAction(f.game, f.owner, { ...f.planActions[0].action, dial: 4.5 }),
      RuleError);
    assert.deepEqual(f.game, before);
    const revealed = revealNativeWorldBattle(f), view = viewGame(revealed, f.owner).battle!;
    assert.ok(view.ownForces);
    assert.equal(view.ownForces.normal, 0);
    assert.equal(view.ownForces.elite, 2, 'Two local Cyborg fee counters cannot also be dialed');
    assert.equal(view.ownForces.normalFixedHalf, true);
    assert.equal(view.ownForces.eliteStrength, 2);
    assert.equal(view.ownForces.freeSupport, !advanced);
    assert.deepEqual(view.traitorVoters, ['ixians']);
    assert.throws(() => applyAction(revealed, 'guild', { type: 'traitorCall', call: false }));
    const done = advanceNativeWorldBattle(revealed, nativeWorldBattleFinished);
    const p = nativeWorldBattlePlayer(done, f.owner);
    assert.equal(done.lastBattleContext?.winner, f.owner);
    assert.equal(p.tanks, advanced ? 5 : 4);
    assert.equal(p.elites!.tanks, advanced ? 4 : 3, 'Fee two plus only this dial’s actual Cyborg casualties');
    assert.deepEqual(combatArmy(done, f.owner, f.location), { normal: 0, elite: advanced ? 0 : 1 });
    assert.deepEqual(combatArmy(done, f.owner, 'homeworld:tleilaxu'), { normal: 9, elite: 0 },
      'The separate real exported garrison is not a casualty or fee origin for this battle');
    assert.ok(nativeWorldBattlePlayer(done, 'tleilaxu').faceDancers!.some(d =>
      d.leader === f.planActions[0].action.leader && !d.revealed),
    'A matching spectator Face Dancer cannot act on another faction’s World');
    assertNativeWorldBattleInventory(done, f.afterSetup);
  });

  void test(`${rules}: paid typed invasion separates two fee Cyborgs from one battle Cyborg and resumes native Face Dance`, () => {
    const f = createNativeWorldBattleFixture({ advanced, exportNormal: 9, exportElite: 1,
      ownerDial: advanced ? 1 : 2, harass: false, outcome: 'win', faceDancer: true });
    assert.equal(f.shipments[0].cost, 10);
    assert.equal(nativeWorldBattlePlayer(f.shipments[0].after, f.owner).spice, 0);
    assert.deepEqual(combatArmy(f.game, f.owner, f.location), { normal: 9, elite: 1 });
    const steps: NativeWorldBattleStep[] = [];
    let game = advanceNativeWorldBattle(revealNativeWorldBattle(f), g => g.decision?.kind === 'ixSubstitution', steps,
      { casualties: { normal: 0, elite: 1 } });
    const ix = nativeWorldBattlePlayer(game, f.owner);
    assert.equal(ix.tanks, 4);
    assert.equal(ix.elites!.tanks, 3, 'Two reserve-fee Cyborgs and exactly one actual board casualty');
    assert.deepEqual(combatArmy(game, f.owner, f.location), { normal: 9, elite: 0 });
    const before = structuredClone(game);
    assert.throws(() => applyAction(game, f.owner, { type: 'decision', sources: { [f.location]: 3 },
      recover: { [f.location]: 3 } }), RuleError);
    assert.deepEqual(game, before, 'The fee cannot become two extra board-loss origins');
    game = applyAction(game, f.owner, { type: 'decision', sources: { [f.location]: 1 }, recover: { [f.location]: 1 } });
    game = advanceNativeWorldBattle(game, g => g.decision?.kind === 'faceDance', steps);
    assert.deepEqual(combatArmy(game, f.owner, f.location), { normal: 8, elite: 1 });
    assert.equal(nativeWorldBattlePlayer(game, f.owner).elites!.tanks, 2, 'Only the battle Cyborg was recovered');
    assert.equal(nativeWorldBattlePlayer(game, f.owner).tanks, 4, 'One surviving Suboid replaces that Cyborg in Tanks');
    assert.equal(game.decision?.player, 'tleilaxu');
    assert.equal(game.decision?.kind === 'faceDance' && game.decision.territory, 'homeworld:tleilaxu');
    const offer = viewGame(game, 'tleilaxu').decision;
    assert.ok(offer?.kind === 'faceDance');
    assert.equal(offer.blocked, undefined);
    const dancer = nativeWorldBattlePlayer(game, 'tleilaxu').faceDancers!.find(d => d.leader === f.planActions[0].action.leader)!;
    assert.ok(dancer && !dancer.revealed);
    assertNativeWorldBattleInventory(game, f.afterSetup);
    game = applyAction(game, 'tleilaxu', { type: 'decision', reveal: true, sources: {} });
    game = advanceNativeWorldBattle(game, nativeWorldBattleFinished, steps);
    assert.deepEqual(combatArmy(game, f.owner, f.location), { normal: 0, elite: 0 });
    assert.deepEqual(nativeWorldBattlePool(game, f.owner, 'homeworld:ixians'), { normal: 8, elite: 2 },
      'Eight Suboids and the one recovered Cyborg return to native Ix, joining its one remaining native Cyborg');
    const returned = nativeWorldBattlePlayer(game, f.owner);
    assert.equal(returned.reserves, 10);
    assert.equal(returned.elites!.reserves, 2);
    assert.equal(returned.tanks, 4);
    assert.equal(returned.elites!.tanks, 2);
    assert.equal(returned.leaders.find(l => l.id === f.planActions[0].action.leader)!.dead, true);
    assert.ok(nativeWorldBattlePlayer(game, 'tleilaxu').faceDancers!.find(d => d.leader === dancer.leader)!.revealed);
    assertNativeWorldBattleInventory(game, f.afterSetup);
  });
}

void test('Advanced: native CHOAM Reinforcements preserves the original Auditor response, payment and real inspection', () => {
  const f = createNativeWorldBattleFixture({ advanced: true, route: 'choam-native' });
  let game = advanceNativeWorldBattle(revealNativeWorldBattle(f), g => g.decision?.kind === 'choamAudit');
  assert.equal(game.decision?.player, 'choam');
  assert.equal(game.lastBattleContext?.winner, 'choam');
  assert.deepEqual(combatArmy(game, 'choam', f.location), { normal: 17, elite: 0 });
  assert.equal(nativeWorldBattlePlayer(game, 'choam').tanks, 3);
  const event = game.pendingAuditor!.event;
  const held = structuredClone(nativeWorldBattlePlayer(game, 'guild').hand);
  assert.equal(held.length, 1, 'One actual unused original card makes inspection deterministic without a replacement RNG');
  game = applyAction(game, 'choam', { type: 'decision', event, audit: true });
  game = advanceNativeWorldBattle(game, g => g.decision?.kind === 'choamAuditPayment');
  assert.equal(game.decision?.player, 'guild');
  const before = structuredClone(game);
  const count = viewGame(game, 'choam').auditor!.count;
  assert.equal(count, 1);
  const paid = applyAction(game, 'guild', { type: 'decision', event, pay: true, count });
  assert.equal(nativeWorldBattlePlayer(paid, 'guild').spice, nativeWorldBattlePlayer(before, 'guild').spice - 1);
  assert.equal(nativeWorldBattlePlayer(paid, 'choam').spice, nativeWorldBattlePlayer(before, 'choam').spice + 1);
  assert.ok(!paid.auditorInsight, 'Payment cancels the inspection');
  assertNativeWorldBattleInventory(paid, f.afterSetup);

  game = applyAction(game, 'guild', { type: 'decision', event, pay: false });
  assert.deepEqual(game.auditorInsight?.cards.map(c => c.id), held.map(c => c.id));
  assert.equal(game.auditorInsight?.target, 'guild');
  assert.deepEqual(nativeWorldBattlePlayer(game, 'guild').hand.map(c => c.id), held.map(c => c.id),
    'Inspection transfers no physical card');
  assert.equal(nativeWorldBattlePlayer(game, 'guild').spice, nativeWorldBattlePlayer(before, 'guild').spice);
  assert.equal(nativeWorldBattlePlayer(game, 'choam').spice, nativeWorldBattlePlayer(before, 'choam').spice);
  game = advanceNativeWorldBattle(game, nativeWorldBattleFinished);
  assertNativeWorldBattleInventory(game, f.afterSetup);
});
