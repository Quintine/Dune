import {
  casualtyOptions,
  validCombatForces,
  maxCombatDial,
  maxCombatSupport,
  type CombatForces,
  type Casualties,
} from './combat';
import type { HarassWithdrawOccupyContext } from './harass-withdraw';

export type StoneBurnerSide = 'attacker' | 'defender';
export type StoneBurnerComparison = {
  winner: StoneBurnerSide | null;
  attacker: number[];
  defender: number[];
};
/** Public fixed contributions only; callers retain their own native force pools. */
export type StoneBurnerOccupyContext = {
  fixedEcazDial: number;
  ecazUndialed: number;
};
export type StoneBurnerSideContext = Partial<StoneBurnerOccupyContext> & {
  withdrawal?: 'variable' | 'ecaz';
  /** Public precommit possibility only; never inferred from a hidden hand. */
  possibleEcazWithdrawal?: boolean;
};
/** Context belongs to physical battle slots, not the card holder or aggressor. */
export type StoneBurnerContext = {
  attacker?: StoneBurnerSideContext;
  defender?: StoneBurnerSideContext;
};

/** Only the card user's own undialed counters leave the physical battle. */
export function stoneBurnerWithdrawalContext(
  context: StoneBurnerContext | undefined,
  side: StoneBurnerSide,
  occupy?: Pick<HarassWithdrawOccupyContext, 'canceled' | 'cardUser' | 'ecaz'>,
): StoneBurnerContext {
  return {
    ...context,
    [side]: {
      ...context?.[side],
      withdrawal: occupy && !occupy.canceled && occupy.cardUser === occupy.ecaz
        ? 'ecaz' : 'variable',
    },
  };
}

const opposingChoices = new Map<string, readonly (readonly number[])[]>();
const MAX_CACHED_POOLS = 128;

function validSide(side: StoneBurnerSide): boolean {
  return side === 'attacker' || side === 'defender';
}
function sorted(values: Iterable<number>): number[] {
  return [...new Set(values)].sort((a, b) => a - b);
}
/** The score uses physical undialed counters after the original withdrawal,
 * including only the surviving fixed Ecaz contribution. Paid support is not
 * another casualty and temporary roles retain their ordinary physical type. */
export function stoneBurnerUndialedTotal(
  forces: CombatForces,
  losses: Pick<Casualties, 'normal' | 'elite'>,
  context?: StoneBurnerSideContext,
): number {
  const fixedUndialed = context?.withdrawal === 'ecaz' ? 0 : context?.ecazUndialed ?? 0;
  return context?.withdrawal === 'variable' ? fixedUndialed
    : fixedUndialed + forces.normal + forces.elite - losses.normal - losses.elite;
}
function totals(
  forces: CombatForces,
  dial: number,
  support: number,
  context?: StoneBurnerSideContext,
): number[] {
  dial -= context?.fixedEcazDial ?? 0;
  const fixedUndialed = context?.withdrawal === 'ecaz' ? 0 : context?.ecazUndialed ?? 0;
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
  // Validate the original commitment before removing its undialed complement.
  const losses = casualtyOptions(forces, dial, support);
  if (!losses.length) return [];
  if (context?.withdrawal === 'variable') return [fixedUndialed];
  return sorted(
    losses.map(
      (loss) => stoneBurnerUndialedTotal(forces, loss, context),
    ),
  );
}

/** The same side must win for every permitted pair; never select an allocation. */
function invariantWinner(
  attacker: readonly number[],
  defender: readonly number[],
  aggressor: StoneBurnerSide,
  attackerOffset = 0,
  defenderOffset = 0,
): StoneBurnerSide | null {
  if (!attacker.length || !defender.length || !validSide(aggressor))
    return null;
  const aMin = attacker[0] + attackerOffset,
    aMax = attacker[attacker.length - 1] + attackerOffset;
  const dMin = defender[0] + defenderOffset,
    dMax = defender[defender.length - 1] + defenderOffset;
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
  context?: StoneBurnerContext,
): StoneBurnerComparison {
  const attacker = totals(a, aDial, aSupport, context?.attacker),
    defender = totals(d, dDial, dSupport, context?.defender);
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
  context?: StoneBurnerSideContext,
): readonly (readonly number[])[] {
  const fixedUndialed = context?.withdrawal === 'ecaz' ? 0 : context?.ecazUndialed ?? 0;
  const key = context?.withdrawal === 'variable' ? `variable:${fixedUndialed}` : [
    forces.normal,
    forces.elite,
    forces.eliteStrength,
    forces.temporaryElite ?? 0,
    !!forces.normalFixedHalf,
    !!forces.normalFreeSupport,
    forces.freeSupport,
    !!forces.eliteFreeSupport,
    fixedUndialed,
    context?.withdrawal ?? '',
  ].join(':');
  const cached = opposingChoices.get(key);
  if (cached) return cached;
  const result: number[][] = [];
  // Once the variable pool has withdrawn, every feasible original commitment
  // leaves the same undialed total, regardless of its dial or support.
  if (context?.withdrawal === 'variable') result.push([fixedUndialed]);
  else {
    const maximumHalfDial = maxCombatDial(forces) * 2;
    const maximumSupport = maxCombatSupport(forces);
    // Use the same legality and typed-support arithmetic as sealed plans. Cache
    // public pool results so repeated preflights do not repeat this enumeration.
    for (let halfDial = 0; halfDial <= maximumHalfDial; halfDial++)
      for (let support = 0; support <= maximumSupport; support++) {
        const choices = totals(forces, halfDial / 2 + (context?.fixedEcazDial ?? 0), support, context);
        if (choices.length) result.push(choices);
      }
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
  context?: StoneBurnerContext,
  allowAllocations = false,
): string | null {
  if (!validSide(side) || !validSide(aggressor))
    return 'Choose valid Stone Burner combatant roles.';
  const ownOccupy = context?.[side];
  const opponentOccupy = context?.[side === 'attacker' ? 'defender' : 'attacker'];
  if (!validCombatForces(own) || !validCombatForces(opponent))
    return 'Stone Burner needs valid supported physical force pools of at most 20 tokens.';
  const ownTotals = totals(own, dial, support, ownOccupy);
  if (!ownTotals.length)
    return 'Your dial and support do not permit a legal Stone Burner force allocation.';
  // New battles finish ambiguous outcomes through separate sealed undialed
  // totals. Legacy battles retain the original public-only preflight boundary.
  if (allowAllocations === true) return null;
  const possibleFixedReturn = opponentOccupy?.possibleEcazWithdrawal &&
    opponentOccupy.withdrawal !== 'ecaz' ? opponentOccupy.ecazUndialed ?? 0 : 0;
  for (const otherTotals of allOpposingTotals(opponent, opponentOccupy)) {
    const winner =
      side === 'attacker'
        ? invariantWinner(ownTotals, otherTotals, aggressor)
        : invariantWinner(otherTotals, ownTotals, aggressor);
    const withdrawnWinner = !possibleFixedReturn ? winner :
      side === 'attacker'
        ? invariantWinner(ownTotals, otherTotals, aggressor, 0, -possibleFixedReturn)
        : invariantWinner(otherTotals, ownTotals, aggressor, -possibleFixedReturn, 0);
    if (winner === null || withdrawnWinner === null)
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
  context?: StoneBurnerContext,
  allowAllocations = false,
): string | null {
  if (!validSide(side) || !validSide(aggressor))
    return 'Choose valid Stone Burner combatant roles.';
  const ownOccupy = context?.[side];
  if (!validCombatForces(own) || !validCombatForces(opponent))
    return 'Stone Burner needs valid supported physical force pools of at most 20 tokens.';
  const fixedDial = ownOccupy?.fixedEcazDial ?? 0;
  const maximumStrength = fixedDial + maxCombatDial(own);
  for (let halfDial = fixedDial * 2; halfDial <= maximumStrength * 2; halfDial++) {
    if (!totals(own, halfDial / 2, 0, ownOccupy).length) continue;
    if (
      stoneBurnerPlanBlock(own, halfDial / 2, 0, opponent, side, aggressor, context, allowAllocations) ===
      null
    )
      return null;
  }
  return 'Compelling Stone Burner has no supported zero-spice plan for every opposing allocation; this combined allocation timing is not yet supported.';
}
