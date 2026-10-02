import test from 'node:test';
import assert from 'node:assert/strict';
import type { CombatForces } from '../game/combat';
import {
  EcazOccupyBattleError,
  ecazOccupyDialOptions,
  quoteEcazOccupyBattle,
  quoteEcazOccupyDial,
  quoteEcazOccupyOutcome,
  type EcazOccupyBattleInput,
} from '../game/ecaz-occupy-battle';

const ordinary = (normal: number): CombatForces => ({
  normal, elite: 0, eliteStrength: 2, freeSupport: false,
});
function battle(
  ecazCount: number,
  lead = 'ecaz-seat',
  canceled = false,
  allyForces = ordinary(4),
): EcazOccupyBattleInput {
  return {
    battleOrderActor: 'enemy-seat',
    ecaz: { id: 'ecaz-seat', faction: 'ecaz', ally: 'ally-seat', forces: ordinary(ecazCount) },
    ally: { id: 'ally-seat', faction: 'atreides', ally: 'ecaz-seat', forces: allyForces },
    lead,
    canceled,
  };
}

void test('Advanced E1–5 ordinary wins lose ceil Ecaz separately and retain floor, with either lead', () => {
  for (const [ecazCount, fixed, survivors] of [
    [1, 1, 0], [2, 1, 1], [3, 2, 1], [4, 2, 2], [5, 3, 2],
  ]) {
    for (const lead of ['ecaz-seat', 'ally-seat']) {
      const profile = quoteEcazOccupyBattle(battle(ecazCount, lead));
      const dial = quoteEcazOccupyDial(profile, fixed + 1.5, 1);
      assert.equal(dial.variableDial, 1.5);
      assert.equal(dial.payer, lead);
      assert.equal(dial.forceOwner, 'ally-seat');
      const win = quoteEcazOccupyOutcome(profile, {
        result: 'normal', won: true, dial: fixed + 1.5, support: 1,
      });
      assert.deepEqual(win.fixedLosses, [{ owner: 'ecaz-seat', normal: fixed, elite: 0 }]);
      assert.equal(ecazCount - win.fixedLosses[0].normal, survivors);
      assert.equal(win.casualties?.owner, 'ally-seat');
      assert.deepEqual(win.casualties?.options, [
        { normal: 2, elite: 0, paidNormal: 1, paidElite: 0 },
      ]);
      assert.equal(4 - win.casualties!.options[0].normal, 2);
      assert.deepEqual(win.destroyedArmies, []);
    }
  }
});

void test('Advanced E1–5 normal defeat destroys both real armies regardless of the selected lead', () => {
  for (const ecazCount of [1, 2, 3, 4, 5]) {
    for (const lead of ['ecaz-seat', 'ally-seat']) {
      const profile = quoteEcazOccupyBattle(battle(ecazCount, lead));
      const loss = quoteEcazOccupyOutcome(profile, {
        result: 'normal', won: false, dial: Math.ceil(ecazCount / 2), support: 0,
      });
      assert.deepEqual(loss, {
        destroyedArmies: ['ecaz-seat', 'ally-seat'], fixedLosses: [], casualties: null,
      });
    }
  }
});

void test('Ecaz cannot be dialed below its mandatory increment or charged extra support for it', () => {
  const profile = quoteEcazOccupyBattle(battle(5));
  assert.throws(() => quoteEcazOccupyDial(profile, 2.5, 0), /include 3 fixed Ecaz/);
  assert.throws(() => quoteEcazOccupyDial(profile, 3, 1), /legal physical commitment/);
  assert.deepEqual(quoteEcazOccupyDial(profile, 3, 0).options, [
    { normal: 0, elite: 0, paidNormal: 0, paidElite: 0 },
  ]);
  assert.throws(() => quoteEcazOccupyDial(profile, 7.5, 4), /fighter pool/);
  assert.throws(() => quoteEcazOccupyDial(profile, 3.25, 0), /fixed Ecaz/);
  assert.throws(() => quoteEcazOccupyDial(profile, 4, -1), /native ally-seat support/);
});

void test('Fremen and Fedaykin remain free and physically Fremen even when Ecaz supplies the plan', () => {
  const input = battle(3, 'ecaz-seat', false, {
    normal: 2, elite: 2, eliteStrength: 2, freeSupport: true,
  });
  const profile = quoteEcazOccupyBattle({ ...input, ally: { ...input.ally, faction: 'fremen' } });
  assert.equal(profile.maxDial, 8);
  const quote = quoteEcazOccupyDial(profile, 6, 0);
  assert.deepEqual(quote.options, [
    { normal: 2, elite: 1, paidNormal: 0, paidElite: 0 },
    { normal: 0, elite: 2, paidNormal: 0, paidElite: 0 },
  ]);
  assert.equal(quote.forceOwner, 'ally-seat');
  assert.equal(quote.payer, 'ecaz-seat');
  assert.throws(() => quoteEcazOccupyDial(profile, 6, 1), /fixed Ecaz contribution is free/);
  assert.throws(() => quoteEcazOccupyDial(profile, 5.5, 0), /legal physical commitment/);
  assert.deepEqual(ecazOccupyDialOptions(profile, 0), [
    { dial: 2, support: 0, variableDial: 0 },
    { dial: 3, support: 0, variableDial: 1 },
    { dial: 4, support: 0, variableDial: 2 },
    { dial: 5, support: 0, variableDial: 3 },
    { dial: 6, support: 0, variableDial: 4 },
    { dial: 7, support: 0, variableDial: 5 },
    { dial: 8, support: 0, variableDial: 6 },
  ]);
});

void test('Sardaukar keep typed supported casualties and their native opponent-dependent strength', () => {
  const input = battle(3, 'ecaz-seat', false, {
    normal: 3, elite: 2, eliteStrength: 2, freeSupport: false,
  });
  const emperor = { ...input.ally, faction: 'emperor' as const };
  const profile = quoteEcazOccupyBattle({ ...input, ally: emperor });
  const win = quoteEcazOccupyOutcome(profile, {
    result: 'normal', won: true, dial: 5, support: 1,
  });
  assert.equal(win.casualties?.owner, 'ally-seat');
  const allocations = win.casualties!.options;
  for (const [normal, elite, paidNormal, paidElite] of [
    [2, 1, 0, 1], [3, 1, 1, 0], [1, 2, 1, 0],
  ]) {
    assert.ok(allocations.some(option => option.normal === normal && option.elite === elite &&
      option.paidNormal === paidNormal && option.paidElite === paidElite),
    'Each distinct printed-strength casualty allocation must remain available to the winner.');
  }
  for (const option of allocations) {
    assert.equal(option.paidNormal + option.paidElite, 1);
    assert.equal((option.normal + option.paidNormal) / 2 + option.elite + option.paidElite, 3,
      'Casualties consume only the three variable strength, not the fixed Ecaz two.');
  }
  const versusFremen = quoteEcazOccupyBattle({
    ...input, ally: { ...emperor, forces: { ...emperor.forces, eliteStrength: 1 } },
  });
  assert.throws(() => quoteEcazOccupyDial(versusFremen, 8, 5), /fighter pool/);
  assert.deepEqual(quoteEcazOccupyDial(versusFremen, 3, 1).options, [
    { normal: 1, elite: 0, paidNormal: 1, paidElite: 0 },
    { normal: 0, elite: 1, paidNormal: 0, paidElite: 1 },
  ]);
});

void test('cancellation retains either selected lead, recomputes its own dial, and leaves the other army undialed on a win', () => {
  const fremen: CombatForces = { normal: 2, elite: 2, eliteStrength: 2, freeSupport: true };
  for (const lead of ['ecaz-seat', 'ally-seat']) {
    const input = battle(5, lead, false, fremen);
    const active = quoteEcazOccupyBattle({ ...input, ally: { ...input.ally, faction: 'fremen' } });
    assert.equal(quoteEcazOccupyDial(active, 4, 0).forceOwner, 'ally-seat');
    const canceled = quoteEcazOccupyBattle({ ...input, canceled: true, ally: { ...input.ally, faction: 'fremen' } });
    const support = lead === 'ecaz-seat' ? 1 : 0;
    const win = quoteEcazOccupyOutcome(canceled, {
      result: 'normal', won: true, dial: 1, support,
    });
    assert.equal(canceled.lead, lead);
    assert.equal(canceled.battleOrderActor, 'enemy-seat');
    assert.equal(win.casualties?.owner, lead);
    assert.equal(win.casualties?.dial, 1);
    assert.deepEqual(win.fixedLosses, []);
    assert.deepEqual(win.destroyedArmies, []);
    assert.deepEqual(win.casualties?.options, [{
      normal: 1, elite: 0, paidNormal: support, paidElite: 0,
    }]);
    if (lead === 'ecaz-seat')
      assert.deepEqual(quoteEcazOccupyDial(canceled, 1, 0).options, [
        { normal: 2, elite: 0, paidNormal: 0, paidElite: 0 },
      ]);
    else assert.throws(() => quoteEcazOccupyDial(canceled, 1, 1), /native ally-seat support/);
    assert.deepEqual(quoteEcazOccupyOutcome(canceled, {
      result: 'normal', won: false, dial: 1, support,
    }).destroyedArmies, ['ecaz-seat', 'ally-seat']);
  }
});

void test('sole traitor victory waives both pools losses; sole defeat, mutual traitors and explosion destroy the actual side', () => {
  for (const lead of ['ecaz-seat', 'ally-seat']) {
    for (const canceled of [false, true]) {
      const profile = quoteEcazOccupyBattle(battle(5, lead, canceled));
      const dial = canceled ? 0 : 3;
      assert.deepEqual(quoteEcazOccupyOutcome(profile, {
        result: 'traitor', won: true, dial, support: 0,
      }), { destroyedArmies: [], fixedLosses: [], casualties: null });
      for (const result of ['traitor', 'mutualTraitors', 'explosion'] as const)
        assert.deepEqual(quoteEcazOccupyOutcome(profile, {
          result, won: false, dial, support: 0,
        }), { destroyedArmies: ['ecaz-seat', 'ally-seat'], fixedLosses: [], casualties: null });
      for (const result of ['mutualTraitors', 'explosion'] as const)
        assert.throws(() => quoteEcazOccupyOutcome(profile, {
          result, won: true, dial, support: 0,
        }), /no Occupy winner/);
    }
  }
});

void test('funding-limited legal options retain unsupported half dials without spending the fixed contribution', () => {
  const profile = quoteEcazOccupyBattle(battle(1, 'ecaz-seat', false, ordinary(2)));
  assert.deepEqual(ecazOccupyDialOptions(profile, 0), [
    { dial: 1, support: 0, variableDial: 0 },
    { dial: 1.5, support: 0, variableDial: 0.5 },
    { dial: 2, support: 0, variableDial: 1 },
  ]);
  assert.deepEqual(ecazOccupyDialOptions(profile, 1), [
    { dial: 1, support: 0, variableDial: 0 },
    { dial: 1.5, support: 0, variableDial: 0.5 },
    { dial: 2, support: 0, variableDial: 1 },
    { dial: 2, support: 1, variableDial: 1 },
    { dial: 2.5, support: 1, variableDial: 1.5 },
  ]);
  assert.throws(() => ecazOccupyDialOptions(profile, -1), /nonnegative whole spice/);
});

void test('nonreciprocal allies, advisors-only or disconnected pools, and foreign lead actors cannot create a combined army', () => {
  const input = battle(3);
  assert.throws(() => quoteEcazOccupyBattle({
    ...input, ally: { ...input.ally, ally: null },
  }), /reciprocal ally/);
  assert.throws(() => quoteEcazOccupyBattle({
    ...input, ally: { ...input.ally, faction: 'beneGesserit', forces: ordinary(0) },
  }), /storm-connected fighters/);
  assert.throws(() => quoteEcazOccupyBattle({
    ...input, ecaz: { ...input.ecaz, forces: ordinary(0) },
  }), /storm-connected fighters/);
  assert.throws(() => quoteEcazOccupyBattle({ ...input, lead: 'enemy-seat' }), /lead must be Ecaz/);
  assert.throws(() => quoteEcazOccupyBattle({ ...input, battleOrderActor: '' }), /battle-order actor/);
  assert.throws(() => quoteEcazOccupyBattle({
    ...input, ally: { ...input.ally, forces: ordinary(21) },
  }), EcazOccupyBattleError);
});

void test('two twenty-counter armies are legal separate pools, not an over-cap merged CombatForces', () => {
  const profile = quoteEcazOccupyBattle(battle(20, 'ecaz-seat', false, ordinary(20)));
  const outcome = quoteEcazOccupyOutcome(profile, {
    result: 'normal', won: true, dial: 30, support: 20,
  });
  assert.deepEqual(outcome.fixedLosses, [{ owner: 'ecaz-seat', normal: 10, elite: 0 }]);
  assert.equal(outcome.casualties?.owner, 'ally-seat');
  assert.deepEqual(outcome.casualties?.options, [
    { normal: 20, elite: 0, paidNormal: 20, paidElite: 0 },
  ]);
});
