import test from 'node:test';
import assert from 'node:assert/strict';
import { casualtyOptions, type CombatForces } from '../game/combat';
import {
  quoteEcazOccupyBattle,
  type EcazOccupyBattleProfile,
} from '../game/ecaz-occupy-battle';
import {
  defaultHarassWithdrawAllocation,
  harassWithdrawCommitments,
  harassWithdrawNeedsAllocation,
  quoteHarassWithdraw,
  HarassWithdrawError,
  type HarassWithdrawContext,
  type HarassWithdrawSelection,
} from '../game/harass-withdraw';

const native = (normal: number): CombatForces => ({
  normal,
  elite: 0,
  eliteStrength: 1,
  freeSupport: false,
});
function profile(
  ecazNormal = 5,
  lead = 'ecaz-user',
  canceled = false,
  allyForces = native(4),
): EcazOccupyBattleProfile {
  return quoteEcazOccupyBattle({
    advanced: true,
    battleOrderActor: 'ecaz-user',
    ecaz: {
      id: 'ecaz-user', faction: 'ecaz', ally: 'ally-user',
      forces: native(ecazNormal),
    },
    ally: {
      id: 'ally-user', faction: 'ixians', ally: 'ecaz-user',
      forces: allyForces,
    },
    lead,
    canceled,
  });
}
function contextFor(p: EcazOccupyBattleProfile): HarassWithdrawContext {
  const forces = p.lead === p.ecaz ? p.ecazForces : p.allyForces;
  return {
    blocked: null,
    forces,
    locations: { 'imperial_basin:9': { normal: forces.normal, elite: forces.elite } },
    occupy: {
      cardUser: p.lead,
      ecaz: p.ecaz,
      ally: p.ally,
      canceled: p.canceled,
      fixedEcazDial: p.fixedEcazDial,
      variableForces: p.forces,
    },
  };
}

void test('Ecaz card user returns only its own floor(E/2), while ally support never charges the free fixed fighters', () => {
  for (const ecazNormal of [5, 6]) {
    const p = profile(ecazNormal);
    const context = contextFor(p);
    const before = structuredClone(context);
    for (const [variableDial, support] of [[0, 0], [0.5, 0], [2, 2]]) {
      const dial = p.fixedEcazDial + variableDial;
      assert.deepEqual(harassWithdrawCommitments(context, dial, support), [
        { normal: Math.ceil(ecazNormal / 2), elite: 0 },
      ]);
      assert.equal(harassWithdrawNeedsAllocation(context, dial, support), false);
      const quote = quoteHarassWithdraw(context, dial, support);
      assert.deepEqual(quote.returned, { normal: Math.floor(ecazNormal / 2), elite: 0 });
      assert.deepEqual(quote.remaining, {
        ...context.forces, normal: Math.ceil(ecazNormal / 2), freeSupport: true,
      });
      assert.deepEqual(casualtyOptions(quote.remaining, p.fixedEcazDial, 0), [
        { normal: p.fixedEcazDial, elite: 0, paidNormal: 0, paidElite: 0 },
      ]);
    }
    assert.deepEqual(context, before);
  }
});

void test('original mandatory Ecaz commitment survives a changed on-board pool after the physical return', () => {
  const p = profile(5);
  const context = contextFor(p);
  const returned = quoteHarassWithdraw(context, 4, 1);
  const afterReturn: HarassWithdrawContext = {
    ...context,
    forces: returned.remaining,
    locations: { 'imperial_basin:9': { normal: 3, elite: 0 } },
  };
  const remaining = quoteHarassWithdraw(afterReturn, 4, 1);
  assert.deepEqual(remaining.returned, { normal: 0, elite: 0 });
  assert.equal(remaining.remaining.normal, 3);
  assert.equal(remaining.remaining.freeSupport, true);
});

void test('Ecaz sector choices allocate only its own undialed counters, never ally counters', () => {
  const context: HarassWithdrawContext = {
    ...contextFor(profile()),
    locations: {
      'imperial_basin:9': { normal: 2, elite: 0 },
      'imperial_basin:10': { normal: 3, elite: 0 },
    },
  };
  assert.equal(harassWithdrawNeedsAllocation(context, 4, 1), true);
  const selected: HarassWithdrawSelection = {
    'imperial_basin:10': { normal: 2, elite: 0 },
  };
  assert.deepEqual(quoteHarassWithdraw(context, 4, 1, selected).returned, { normal: 2, elite: 0 });
  const fallback = defaultHarassWithdrawAllocation(context, 4, 1);
  assert.deepEqual(quoteHarassWithdraw(context, 4, 1, fallback).returned, { normal: 2, elite: 0 });
  assert.throws(() => quoteHarassWithdraw(context, 4, 1, {
    'ally-location': { normal: 2, elite: 0 },
  }), HarassWithdrawError);
  assert.throws(() => quoteHarassWithdraw(context, 4, 1, {
    'imperial_basin:10': { normal: 1, elite: 0 },
  }), HarassWithdrawError);
});

void test('ally card user subtracts fixed strength and uses native Ix half-normal/double-elite spice commitments', () => {
  const ix: CombatForces = {
    normal: 3, elite: 2, eliteStrength: 2,
    normalFixedHalf: true, freeSupport: false,
  };
  const context = contextFor(profile(5, 'ally-user', false, ix));
  // Three fixed Ecaz strength plus 2.5 variable strength: one half-normal
  // and one supported double-elite, not 2.5 or 5.5 physical counters.
  assert.deepEqual(harassWithdrawCommitments(context, 5.5, 1), [{ normal: 1, elite: 1 }]);
  const quote = quoteHarassWithdraw(context, 5.5, 1);
  assert.deepEqual(quote.returned, { normal: 2, elite: 1 });
  assert.deepEqual(quote.remaining, { ...ix, normal: 1, elite: 1 });
  // Without spice the same strength admits two genuinely different physical
  // commitments; selecting the elite-heavy one returns only two own normals.
  assert.equal(harassWithdrawNeedsAllocation(context, 5.5, 0), true);
  const selected = defaultHarassWithdrawAllocation(context, 5.5, 0, { normal: 1, elite: 2 });
  assert.deepEqual(quoteHarassWithdraw(context, 5.5, 0, selected).returned, { normal: 2, elite: 0 });
});

void test('ordinary Advanced ally returns physical undialed counters instead of numeric dial complement', () => {
  const context = contextFor(profile(5, 'ally-user'));
  assert.deepEqual(quoteHarassWithdraw(context, 4, 0).returned, { normal: 2, elite: 0 });
  assert.deepEqual(quoteHarassWithdraw(context, 4, 1).returned, { normal: 3, elite: 0 });
  assert.deepEqual(quoteHarassWithdraw(context, 3, 0).returned, { normal: 4, elite: 0 });
});

void test('canceled Occupy restores either selected lead own native commitment with zero fixed strength', () => {
  for (const lead of ['ecaz-user', 'ally-user']) {
    const p = profile(5, lead, true);
    const context = contextFor(p);
    const quote = quoteHarassWithdraw(context, 1, 0);
    assert.deepEqual(quote.returned, { normal: context.forces.normal - 2, elite: 0 });
    assert.deepEqual(quote.remaining, { ...context.forces, normal: 2 });
    assert.equal(quote.remaining.freeSupport, false);
    const all = quoteHarassWithdraw(context, 0, 0);
    assert.equal(all.returned.normal, context.forces.normal);
  }
});

void test('ordinary opponent keeps native dial/support semantics without Occupy metadata', () => {
  const context: HarassWithdrawContext = {
    blocked: null,
    forces: native(5),
    locations: { 'imperial_basin:9': { normal: 5, elite: 0 } },
  };
  assert.deepEqual(quoteHarassWithdraw(context, 1, 0).returned, { normal: 3, elite: 0 });
  assert.deepEqual(quoteHarassWithdraw(context, 1, 1).returned, { normal: 4, elite: 0 });
  assert.deepEqual(quoteHarassWithdraw(context, 0, 0).returned, { normal: 5, elite: 0 });
});

void test('owner and funding boundary rejects invalid total plans before quoting any return', () => {
  const context = contextFor(profile());
  for (const [dial, support] of [[2, 0], [3, 1], [8, 0], [3.25, 0], [4, -1]]) {
    assert.throws(() => quoteHarassWithdraw(context, dial, support), HarassWithdrawError);
  }
  assert.ok(context.occupy);
  const wrongOwner: HarassWithdrawContext = {
    ...context, occupy: { ...context.occupy, cardUser: 'opponent' },
  };
  assert.throws(() => quoteHarassWithdraw(wrongOwner, 4, 1), HarassWithdrawError);
  const missingFixed: HarassWithdrawContext = {
    ...context, occupy: { ...context.occupy, fixedEcazDial: 0 },
  };
  assert.throws(() => quoteHarassWithdraw(missingFixed, 4, 1), HarassWithdrawError);
  const mixedAlly: HarassWithdrawContext = {
    ...context, occupy: { ...context.occupy, cardUser: 'ally-user' },
  };
  assert.throws(() => quoteHarassWithdraw(mixedAlly, 4, 1), HarassWithdrawError);
  const canceledWithFixed: HarassWithdrawContext = {
    ...context, occupy: { ...context.occupy, canceled: true },
  };
  assert.throws(() => quoteHarassWithdraw(canceledWithFixed, 4, 1), HarassWithdrawError);
});
