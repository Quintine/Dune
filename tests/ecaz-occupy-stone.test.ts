import test from 'node:test';
import assert from 'node:assert/strict';
import { baseDeck, ixBattleCards, leaders, type Card } from '../game/cards';
import { richeseCards } from '../game/richese-cards';
import { casualtyOptions, maxCombatDial, maxCombatSupport, type CombatForces } from '../game/combat';
import { quoteEcazOccupyBattle, type EcazOccupyBattleProfile } from '../game/ecaz-occupy-battle';
import { quoteBattleResolution, BattleResolutionQuoteError, type BattleResolutionInput, type ResolutionCombatant } from '../game/battle-resolution-quote';
import { stoneBurnerComparison, stoneBurnerPlanBlock, stoneBurnerCompulsionBlock, type StoneBurnerContext, type StoneBurnerOccupyContext, type StoneBurnerSide } from '../game/stone-burner';

const ordinary = (normal: number): CombatForces => ({
  normal, elite: 0, eliteStrength: 1, freeSupport: false,
});
const ix: CombatForces = {
  normal: 3, elite: 2, eliteStrength: 2,
  normalFixedHalf: true, freeSupport: false,
};
function profile(ecazNormal = 5, lead = 'ecaz-user', canceled = false, allyForces = ix): EcazOccupyBattleProfile {
  return quoteEcazOccupyBattle({
    advanced: true,
    battleOrderActor: 'ecaz-user',
    ecaz: { id: 'ecaz-user', faction: 'ecaz', ally: 'ally-user', forces: ordinary(ecazNormal) },
    ally: { id: 'ally-user', faction: 'ixians', ally: 'ecaz-user', forces: allyForces },
    lead, canceled,
  });
}
function occupyContext(p: EcazOccupyBattleProfile): StoneBurnerOccupyContext {
  return { fixedEcazDial: p.fixedEcazDial, ecazUndialed: p.canceled ? 0 : Math.floor(p.ecazForces.normal / 2) };
}
const opposite = (side: StoneBurnerSide): StoneBurnerSide => side === 'attacker' ? 'defender' : 'attacker';

void test('active Occupy compares odd/even Ecaz physical remainder plus native half-normal and double-elite counters in either slot', () => {
  for (const ecazNormal of [5, 6])
    for (const lead of ['ecaz-user', 'ally-user'])
      for (const slot of ['attacker', 'defender'] as const)
        for (const aggressor of ['attacker', 'defender'] as const) {
          const p = profile(ecazNormal, lead);
          const ownUndialed = Math.floor(ecazNormal / 2) + 3;
          const own = [p.forces, p.fixedEcazDial + 2.5, 1] as const;
          const other = [ordinary(ownUndialed + 1), 1, 1] as const;
          const result = slot === 'attacker'
            ? stoneBurnerComparison(...own, ...other, aggressor, { [slot]: occupyContext(p) })
            : stoneBurnerComparison(...other, ...own, aggressor, { [slot]: occupyContext(p) });
          assert.deepEqual(result, { winner: aggressor, attacker: [ownUndialed], defender: [ownUndialed] });
          // The fixed commitment is mandatory even when the native variable pool could dial zero.
          assert.notEqual(stoneBurnerPlanBlock(p.forces, p.fixedEcazDial - 0.5, 0, other[0], slot, aggressor, { [slot]: occupyContext(p) }), null);
        }
});

void test('canceled Occupy compares only the selected lead own native pool, never the other member undialed army', () => {
  for (const lead of ['ecaz-user', 'ally-user']) {
    const p = profile(9, lead, true, ordinary(3));
    const expected = lead === p.ecaz ? 7 : 1;
    const result = stoneBurnerComparison(p.forces, 1, 0, ordinary(4), 0, 0, 'attacker', { attacker: occupyContext(p) });
    assert.deepEqual(result, { winner: expected > 4 ? 'attacker' : 'defender', attacker: [expected], defender: [4] });
  }
});

void test('active mandatory Ecaz survivors can make a typed native allocation finishable without selecting its casualties', () => {
  const emperor: CombatForces = { normal: 5, elite: 1, eliteStrength: 2, freeSupport: false };
  const active = profile(5, 'ecaz-user', false, emperor);
  const canceled = profile(5, 'ally-user', true, emperor);
  assert.deepEqual(stoneBurnerComparison(active.forces, 6, 1, ordinary(2), 0, 0, 'attacker', { attacker: occupyContext(active) }), {
    winner: 'attacker', attacker: [3, 4, 5], defender: [2],
  });
  assert.equal(stoneBurnerPlanBlock(active.forces, 6, 1, ordinary(2), 'attacker', 'attacker', { attacker: occupyContext(active) }), null);
  assert.deepEqual(stoneBurnerComparison(canceled.forces, 3, 1, ordinary(2), 0, 0, 'attacker', { attacker: occupyContext(canceled) }), {
    winner: null, attacker: [1, 2, 3], defender: [2],
  });
  assert.notEqual(stoneBurnerPlanBlock(canceled.forces, 3, 1, ordinary(2), 'attacker', 'attacker', { attacker: occupyContext(canceled) }), null);
});

void test('public hypothetical native pools remain authoritative under the same fixed Occupy contribution', () => {
  const context: StoneBurnerContext = { defender: { fixedEcazDial: 3, ecazUndialed: 2 } };
  const elitesOnly = { ...ix, normal: 0 };
  const concealedNormals = { ...ix, normal: 5 };
  assert.equal(stoneBurnerPlanBlock(ordinary(4), 0, 0, elitesOnly, 'attacker', 'attacker', context), null);
  assert.notEqual(stoneBurnerPlanBlock(ordinary(4), 0, 0, concealedNormals, 'attacker', 'attacker', context), null);
  assert.deepEqual(stoneBurnerComparison(ordinary(4), 0, 0, elitesOnly, 3, 0, 'attacker', context).defender, [4]);
  assert.deepEqual(stoneBurnerComparison(ordinary(4), 0, 0, concealedNormals, 3, 0, 'attacker', context).defender, [9]);
});

function physicalChoices(pool: CombatForces, dial: number, support: number, p?: StoneBurnerOccupyContext): number[] {
  const offset = p?.ecazUndialed ?? 0;
  return casualtyOptions(pool, dial - (p?.fixedEcazDial ?? 0), support)
    .map(loss => offset + pool.normal + pool.elite - loss.normal - loss.elite);
}
function publicPlans(pool: CombatForces, p?: StoneBurnerOccupyContext): { dial: number; support: number; totals: number[] }[] {
  const plans: { dial: number; support: number; totals: number[] }[] = [];
  for (let half = 0; half <= maxCombatDial(pool) * 2; half++)
    for (let support = 0; support <= maxCombatSupport(pool); support++) {
      const dial = half / 2 + (p?.fixedEcazDial ?? 0);
      const totals = physicalChoices(pool, dial, support, p);
      if (totals.length) plans.push({ dial, support, totals });
    }
  return plans;
}
function canFinish(own: number[], otherPlans: { totals: number[] }[], side: StoneBurnerSide, aggressor: StoneBurnerSide): boolean {
  return otherPlans.every(other => {
    const winners = new Set(own.flatMap(a => other.totals.map(d => a === d ? aggressor : a > d ? side : opposite(side))));
    return winners.size === 1;
  });
}

void test('Occupy precommit and Voice finishability match exhaustive physical-allocation outcomes for own and opposing active/canceled profiles', () => {
  for (const canceled of [false, true])
    for (const lead of ['ecaz-user', 'ally-user'])
      for (const slot of ['attacker', 'defender'] as const)
        for (const side of ['attacker', 'defender'] as const)
          for (const aggressor of ['attacker', 'defender'] as const) {
            const p = profile(5, lead, canceled);
            const context: StoneBurnerContext = { [slot]: occupyContext(p) };
            const own = side === slot ? p.forces : ordinary(4);
            const other = side === slot ? ordinary(4) : p.forces;
            const ownProfile = context[side];
            const otherPlans = publicPlans(other, context[opposite(side)]);
            const ownPlans = publicPlans(own, ownProfile);
            for (const plan of ownPlans) {
              assert.equal(stoneBurnerPlanBlock(own, plan.dial, plan.support, other, side, aggressor, context) === null,
                canFinish(plan.totals, otherPlans, side, aggressor),
                JSON.stringify({ canceled, lead, slot, side, aggressor, plan }));
            }
            const zeroSpiceCompletion = ownPlans.some(plan => plan.support === 0 && canFinish(plan.totals, otherPlans, side, aggressor));
            assert.equal(stoneBurnerCompulsionBlock(own, other, side, aggressor, context) === null, zeroSpiceCompletion);
          }
});

const catalog = (): Card[] => [...baseDeck(), ...ixBattleCards(), ...richeseCards()];
function resolution(p: EcazOccupyBattleProfile, slot: StoneBurnerSide, dial = p.fixedEcazDial + 2.5, support = 1, otherUndialed = 5): BattleResolutionInput {
  const combatant = (id: string, faction: 'ecaz' | 'ixians' | 'guild', forces: CombatForces, dial: number, support: number): ResolutionCombatant => {
    const leader = { ...leaders(faction)[0] };
    return { id, faction, spice: 10, hand: [], leader, forces,
      plan: { dial, support, leader: leader.id, weapon: null, defense: null } };
  };
  const own = combatant(p.lead, p.lead === p.ecaz ? 'ecaz' : 'ixians', p.forces, dial, support);
  own.ally = p.lead === p.ecaz ? p.ally : p.ecaz;
  const other = combatant('opponent', 'guild', ordinary(otherUndialed + 1), 1, 1);
  const cards = catalog();
  const stone = cards.find(card => card.effect === 'stoneBurner')!;
  own.hand = [stone];
  own.plan.weapon = stone.id;
  own.stoneMode = 'ignore';
  return {
    ecazOccupy: p, advanced: true, turn: 2, territory: 'carthag',
    attacker: slot === 'attacker' ? own : other,
    defender: slot === 'defender' ? own : other,
    participants: [
      { id: p.ecaz, faction: 'ecaz', ally: p.ally },
      { id: p.ally, faction: 'ixians', ally: p.ecaz },
      { id: other.id, faction: other.faction },
    ],
    voters: [p.ecaz, p.ally].map(id => ({ id, beneficiary: p.lead, called: false, traitors: [] }))
      .concat([{ id: other.id, beneficiary: other.id, called: false, traitors: [] }]),
    physicalCards: cards, pendingAuditorPresent: false, pendingRetentionPresent: false,
  };
}

void test('normal Stone Occupy resolution honors either lead/slot/aggressor and settles original physical owners and card custody', () => {
  for (const ecazNormal of [5, 6])
    for (const lead of ['ecaz-user', 'ally-user'])
      for (const slot of ['attacker', 'defender'] as const)
        for (const aggressor of ['attacker', 'defender'] as const) {
          const p = profile(ecazNormal, lead);
          const count = Math.floor(ecazNormal / 2) + 3;
          const input = resolution(p, slot, p.fixedEcazDial + 2.5, 1, count);
          input.aggressor = input[aggressor].id;
          const before = structuredClone(input);
          const quote = quoteBattleResolution(input);
          assert.equal(quote.result, 'normal');
          assert.equal(quote.winner, input[aggressor].id);
          assert.deepEqual(quote.stone, { winner: aggressor, attacker: [count], defender: [count] });
          assert.deepEqual(quote.leaderDeaths, { attacker: false, defender: false });
          assert.deepEqual(quote.payments.map(payment => payment.ownPayment), [1, 1]);
          if (aggressor === slot) {
            assert.deepEqual(quote.fixedLosses, [{ owner: p.ecaz, normal: Math.ceil(ecazNormal / 2), elite: 0 }]);
            assert.equal(quote.casualties?.owner, p.ally);
            assert.deepEqual(quote.casualties?.options, [{ normal: 1, elite: 1, paidNormal: 0, paidElite: 1 }]);
            assert.deepEqual(quote.destroyedArmies, ['opponent']);
            assert.deepEqual(quote.winnerCards, [input[slot].plan.weapon]);
          } else {
            assert.deepEqual(quote.destroyedArmies, [p.ecaz, p.ally]);
            assert.deepEqual(quote.discarded, [{ player: p.lead, card: input[slot].plan.weapon }]);
          }
          assert.deepEqual(input, before);
        }
});

void test('canceled Stone resolution uses own pool and leaves the winning nonparticipating member untouched', () => {
  for (const lead of ['ecaz-user', 'ally-user']) {
    const p = profile(9, lead, true, ordinary(3));
    const input = resolution(p, 'attacker', 1, 0, 4);
    const quote = quoteBattleResolution(input);
    assert.equal(quote.winner, lead === p.ecaz ? p.ecaz : 'opponent');
    assert.deepEqual(quote.stone?.attacker, [lead === p.ecaz ? 7 : 1]);
    if (lead === p.ecaz) {
      assert.equal(quote.casualties?.owner, p.ecaz);
      assert.deepEqual(quote.casualties?.options, [{ normal: 2, elite: 0, paidNormal: 0, paidElite: 0 }]);
      assert.deepEqual(quote.fixedLosses, []);
      assert.deepEqual(quote.destroyedArmies, ['opponent']);
    } else assert.deepEqual(quote.destroyedArmies, [p.ecaz, p.ally]);
  }
});

void test('copied Stone uses the same Occupy physical comparison but retains the winning physical Mirror', () => {
  const p = profile();
  const input = resolution(p, 'defender', 5.5, 1, 5);
  const original = input.defender.hand[0];
  const mirror = catalog().find(card => card.effect === 'mirrorWeapon')!;
  input.defender.hand = [mirror];
  input.defender.plan.weapon = mirror.id;
  input.attacker.hand = [original];
  input.attacker.plan.weapon = original.id;
  input.attacker.stoneMode = 'ignore';
  input.aggressor = p.lead;
  const quote = quoteBattleResolution(input);
  assert.equal(quote.winner, p.lead);
  assert.deepEqual(quote.stone, { winner: 'defender', attacker: [5], defender: [5] });
  assert.deepEqual(quote.winnerCards, [mirror.id]);
  assert.deepEqual(quote.discarded, [{ player: 'opponent', card: original.id }]);
  input.defender.stoneMode = 'kill';
  assert.deepEqual(quoteBattleResolution(input).leaderDeaths, { attacker: true, defender: true });
});

void test('true native typed ambiguity after the Ecaz offset remains unresolved and never mutates the sealed inputs', () => {
  const emperor: CombatForces = { normal: 5, elite: 1, eliteStrength: 2, freeSupport: false };
  const p = profile(5, 'ecaz-user', false, emperor);
  const input = resolution(p, 'attacker', 6, 1, 4);
  const before = structuredClone(input);
  assert.deepEqual(stoneBurnerComparison(p.forces, 6, 1, input.defender.forces, 1, 1, 'attacker', { attacker: occupyContext(p) }), {
    winner: null, attacker: [3, 4, 5], defender: [4],
  });
  assert.throws(() => quoteBattleResolution(input), BattleResolutionQuoteError);
  assert.deepEqual(input, before);
});
