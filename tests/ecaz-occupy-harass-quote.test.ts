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
import { leaders } from '../game/cards';
import { richeseCards } from '../game/richese-cards';
import { ecazTreacheryCards } from '../game/ecaz-cards';
import { quoteBattleResolution, type BattleResolutionInput, type ResolutionCombatant } from '../game/battle-resolution-quote';
import type { StoneBurnerSide } from '../game/stone-burner';

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

function stoneResolution(p: EcazOccupyBattleProfile, slot: StoneBurnerSide, otherUndialed: number): BattleResolutionInput {
  const side = (id: string, faction: 'ecaz' | 'ixians' | 'guild', forces: CombatForces, dial: number): ResolutionCombatant => {
    const leader = { ...leaders(faction)[0], strength: 0 };
    return { id, faction, forces, leader, spice: 10, hand: [],
      plan: { dial, support: 1, leader: leader.id, weapon: null, defense: null } };
  };
  const own = side(p.lead, p.lead === p.ecaz ? 'ecaz' : 'ixians', p.forces, p.fixedEcazDial + 1);
  own.ally = p.lead === p.ecaz ? p.ally : p.ecaz;
  const other = side('opponent', 'guild', native(otherUndialed + 1), 1);
  const stone = richeseCards().find(card => card.effect === 'stoneBurner')!;
  const harass = ecazTreacheryCards().find(card => card.effect === 'harassWithdraw')!;
  own.hand = [stone, harass];
  own.plan.weapon = stone.id;
  own.plan.defense = harass.id;
  own.stoneMode = 'ignore';
  own.harassWithdraw = contextFor(p);
  return {
    ecazOccupy: p, advanced: true, turn: 2, territory: 'carthag', aggressor: p.lead,
    attacker: slot === 'attacker' ? own : other,
    defender: slot === 'defender' ? own : other,
    participants: [
      { id: p.ecaz, faction: 'ecaz', ally: p.ally },
      { id: p.ally, faction: 'ixians', ally: p.ecaz },
      { id: other.id, faction: other.faction },
    ],
    voters: [p.ecaz, p.ally].map(id => ({ id, beneficiary: p.lead, called: false, traitors: [] as string[] }))
      .concat([{ id: other.id, beneficiary: other.id, called: false, traitors: [] }]),
    physicalCards: [stone, harass], pendingAuditorPresent: false, pendingRetentionPresent: false,
  };
}

void test('Stone and active Occupy Harass remove only the Ecaz or variable card user undialed pool while preserving original fixed costs', () => {
  for (const ecazNormal of [5, 6])
    for (const lead of ['ecaz-user', 'ally-user'])
      for (const slot of ['attacker', 'defender'] as const) {
        const p = profile(ecazNormal, lead);
        const remainingUndialed = lead === p.ecaz ? 3 : Math.floor(ecazNormal / 2);
        const input = stoneResolution(p, slot, remainingUndialed);
        const before = structuredClone(input);
        const quote = quoteBattleResolution(input);
        assert.equal(quote.winner, p.lead);
        assert.deepEqual(quote.stone, {
          winner: slot, attacker: [remainingUndialed], defender: [remainingUndialed],
        });
        assert.deepEqual(quote.harassWithdraw?.[0].returned, {
          normal: lead === p.ecaz ? Math.floor(ecazNormal / 2) : 3, elite: 0,
        });
        assert.deepEqual(quote.fixedLosses, [{ owner: p.ecaz, normal: Math.ceil(ecazNormal / 2), elite: 0 }]);
        assert.equal(quote.casualties?.owner, p.ally);
        assert.equal(quote.casualties?.fullyCommitted, lead === p.ally ? true : undefined);
        assert.deepEqual(quote.casualties?.options, [{ normal: 1, elite: 0, paidNormal: 1, paidElite: 0 }]);
        assert.deepEqual(quote.payments.map(payment => payment.ownPayment), [1, 1]);
        assert.deepEqual(quote.winnerCards, [input[slot].plan.weapon]);
        assert.deepEqual(quote.discarded, [{ player: p.lead, card: input[slot].plan.defense }]);
        assert.deepEqual(input, before);
        // The opposite successful call cancels Harass before comparing physical
        // remainders, without reducing either original Occupy contribution.
        const voter = input.voters.find(voter => voter.id === 'opponent')!;
        voter.called = true;
        voter.traitors = [input[slot].plan.leader!];
        const canceled = quoteBattleResolution(input);
        assert.equal(canceled.winner, 'opponent');
        assert.equal(canceled.harassWithdraw, undefined);
        assert.deepEqual(canceled.stone?.[slot], [Math.floor(ecazNormal / 2) + 3]);
        assert.deepEqual(canceled.fixedLosses, []);
      }
});

void test('canceled Occupy Harass uses the selected lead native pool with no fixed remainder or recomputed commitment', () => {
  for (const lead of ['ecaz-user', 'ally-user'])
    for (const slot of ['attacker', 'defender'] as const) {
      const p = profile(5, lead, true);
      const input = stoneResolution(p, slot, 0);
      const quote = quoteBattleResolution(input);
      assert.equal(quote.winner, p.lead);
      assert.deepEqual(quote.stone, { winner: slot, attacker: [0], defender: [0] });
      assert.deepEqual(quote.harassWithdraw?.[0].returned, { normal: p.forces.normal - 1, elite: 0 });
      assert.deepEqual(quote.fixedLosses, []);
      assert.equal(quote.casualties?.owner, p.lead);
      assert.equal(quote.casualties?.forces.normal, 1);
      assert.equal(quote.casualties?.fullyCommitted, true);
      assert.deepEqual(quote.casualties?.options, [{ normal: 1, elite: 0, paidNormal: 1, paidElite: 0 }]);
    }
});
