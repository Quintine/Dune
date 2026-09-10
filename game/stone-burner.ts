import {
  casualtyOptions,
  validCombatForces,
  maxCombatDial,
  maxCombatSupport,
  type CombatForces,
} from './combat';

export type StoneBurnerSide = 'attacker' | 'defender';
export type StoneBurnerComparison = {
  winner: StoneBurnerSide | null;
  attacker: number[];
  defender: number[];
};

const opposingChoices = new Map<string, readonly (readonly number[])[]>();
const MAX_CACHED_POOLS = 128;

function validSide(side: StoneBurnerSide): boolean {
  return side === 'attacker' || side === 'defender';
}
function sorted(values: Iterable<number>): number[] {
  return [...new Set(values)].sort((a, b) => a - b);
}
function totals(forces: CombatForces, dial: number, support: number): number[] {
  if (
    !validCombatForces(forces) ||
    !Number.isFinite(dial) ||
    dial < 0 ||
    !Number.isInteger(dial * 2) ||
    !Number.isSafeInteger(support) ||
    support < 0 ||
    support > maxCombatSupport(forces)
  )
    return [];
  return sorted(
    casualtyOptions(forces, dial, support).map(
      (loss) => forces.normal + forces.elite - loss.normal - loss.elite,
    ),
  );
}

/** The same side must win for every permitted pair; never select an allocation. */
function invariantWinner(
  attacker: readonly number[],
  defender: readonly number[],
  aggressor: StoneBurnerSide,
): StoneBurnerSide | null {
  if (!attacker.length || !defender.length || !validSide(aggressor))
    return null;
  const aMin = attacker[0],
    aMax = attacker[attacker.length - 1];
  const dMin = defender[0],
    dMax = defender[defender.length - 1];
  if (aMin > dMax || (aMin === dMax && aggressor === 'attacker'))
    return 'attacker';
  if (dMin > aMax || (dMin === aMax && aggressor === 'defender'))
    return 'defender';
  return null;
}

/** Pure revealed-plan arithmetic: physical tokens, not dial or paid strength. */
export function stoneBurnerComparison(
  a: CombatForces,
  aDial: number,
  aSupport: number,
  d: CombatForces,
  dDial: number,
  dSupport: number,
  aggressor: StoneBurnerSide = 'attacker',
): StoneBurnerComparison {
  const attacker = totals(a, aDial, aSupport),
    defender = totals(d, dDial, dSupport);
  return {
    winner: invariantWinner(attacker, defender, aggressor),
    attacker,
    defender,
  };
}

/**
 * Group all physically feasible token/support assignments by public dial/support.
 * No player's selected plan or spice balance is an input. Support assignments
 * sharing a token loss are equivalent, as in casualtyOptions.
 */
function allOpposingTotals(
  forces: CombatForces,
): readonly (readonly number[])[] {
  const key = [
    forces.normal,
    forces.elite,
    forces.eliteStrength,
    forces.temporaryElite ?? 0,
    !!forces.normalFixedHalf,
    !!forces.normalFreeSupport,
    forces.freeSupport,
    !!forces.eliteFreeSupport,
  ].join(':');
  const cached = opposingChoices.get(key);
  if (cached) return cached;
  const result: number[][] = [];
  const maximumHalfDial = maxCombatDial(forces) * 2;
  const maximumSupport = maxCombatSupport(forces);
  // Use the same legality and typed-support arithmetic as sealed plans. Cache
  // public pool results so repeated preflights do not repeat this enumeration.
  for (let halfDial = 0; halfDial <= maximumHalfDial; halfDial++)
    for (let support = 0; support <= maximumSupport; support++) {
      const choices = totals(forces, halfDial / 2, support);
      if (choices.length) result.push(choices);
    }
  if (opposingChoices.size >= MAX_CACHED_POOLS)
    opposingChoices.delete(opposingChoices.keys().next().value!);
  opposingChoices.set(key, result);
  return result;
}

/**
 * Conservative pre-commit finishability, including every opposing dial/support
 * regardless of secret funding. A successful result does not select casualties.
 */
export function stoneBurnerPlanBlock(
  own: CombatForces,
  dial: number,
  support: number,
  opponent: CombatForces,
  side: StoneBurnerSide,
  aggressor: StoneBurnerSide = 'attacker',
): string | null {
  if (!validSide(side) || !validSide(aggressor))
    return 'Choose valid Stone Burner combatant roles.';
  if (!validCombatForces(own) || !validCombatForces(opponent))
    return 'Stone Burner needs valid supported physical force pools of at most 20 tokens.';
  const ownTotals = totals(own, dial, support);
  if (!ownTotals.length)
    return 'Your dial and support do not permit a legal Stone Burner force allocation.';
  for (const otherTotals of allOpposingTotals(opponent)) {
    const winner =
      side === 'attacker'
        ? invariantWinner(ownTotals, otherTotals, aggressor)
        : invariantWinner(otherTotals, ownTotals, aggressor);
    if (winner === null)
      return 'Stone Burner can change the winner with different legal force allocations; this combined allocation timing is not yet supported.';
  }
  return null;
}

/** A public Voice check must leave a completion even with no spendable spice. */
export function stoneBurnerCompulsionBlock(
  own: CombatForces,
  opponent: CombatForces,
  side: StoneBurnerSide,
  aggressor: StoneBurnerSide = 'attacker',
): string | null {
  if (!validSide(side) || !validSide(aggressor))
    return 'Choose valid Stone Burner combatant roles.';
  if (!validCombatForces(own) || !validCombatForces(opponent))
    return 'Stone Burner needs valid supported physical force pools of at most 20 tokens.';
  const maximumStrength = maxCombatDial(own);
  for (let halfDial = 0; halfDial <= maximumStrength * 2; halfDial++) {
    if (!totals(own, halfDial / 2, 0).length) continue;
    if (
      stoneBurnerPlanBlock(own, halfDial / 2, 0, opponent, side, aggressor) ===
      null
    )
      return null;
  }
  return 'Compelling Stone Burner has no supported zero-spice plan for every opposing allocation; this combined allocation timing is not yet supported.';
}
