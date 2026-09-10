/** Counts refer to tokens, while dial values refer to battle strength. */
export type CombatForces = {
  normal: number;
  normalFixedHalf?: boolean;
  /** Normal counters alone retain full strength without support, overriding
   * fixed half strength. Special counters keep their separate support rules. */
  normalFreeSupport?: boolean;
  elite: number;
  eliteStrength: 1 | 2;
  freeSupport: boolean;
  /** Special counters retain full strength without paying support; normal
   * counters still follow their ordinary support rules. */
  eliteFreeSupport?: boolean;
};
export type Casualties = {
  normal: number;
  elite: number;
  paidNormal: number;
  paidElite: number;
};

/** Current supported factions have at most twenty physical counters. */
export function validCombatForces(forces: CombatForces): boolean {
  return (
    !!forces &&
    typeof forces === 'object' &&
    !Array.isArray(forces) &&
    Number.isSafeInteger(forces.normal) &&
    forces.normal >= 0 &&
    Number.isSafeInteger(forces.elite) &&
    forces.elite >= 0 &&
    forces.normal + forces.elite <= 20 &&
    (forces.eliteStrength === 1 || forces.eliteStrength === 2) &&
    typeof forces.freeSupport === 'boolean' &&
    (forces.eliteFreeSupport === undefined ||
      typeof forces.eliteFreeSupport === 'boolean') &&
    (forces.normalFreeSupport === undefined ||
      typeof forces.normalFreeSupport === 'boolean') &&
    (forces.normalFixedHalf === undefined ||
      typeof forces.normalFixedHalf === 'boolean')
  );
}

/** Every loss combination consistent with the revealed dial and spice payment. */
export function casualtyOptions(
  forces: CombatForces,
  dial: number,
  support: number,
): Casualties[] {
  if (
    !validCombatForces(forces) ||
    !Number.isFinite(dial) ||
    dial < 0 ||
    !Number.isInteger(dial * 2) ||
    !Number.isSafeInteger(support) ||
    support < 0 ||
    support >
      (forces.normalFixedHalf || forces.normalFreeSupport ? 0 : forces.normal) +
        (forces.eliteFreeSupport ? 0 : forces.elite) ||
    (forces.freeSupport && support !== 0)
  )
    return [];
  const options: Casualties[] = [];
  for (let elite = 0; elite <= forces.elite; elite++) {
    for (let normal = 0; normal <= forces.normal; normal++) {
      if (forces.freeSupport) {
        if (
          normal *
            (forces.normalFixedHalf && !forces.normalFreeSupport ? 0.5 : 1) +
            elite * forces.eliteStrength ===
          dial
        )
          options.push({ normal, elite, paidNormal: 0, paidElite: 0 });
        continue;
      }
      for (
        let paidElite = Math.max(
          0,
          support -
            (forces.normalFixedHalf || forces.normalFreeSupport ? 0 : normal),
        );
        paidElite <= (forces.eliteFreeSupport ? 0 : Math.min(elite, support));
        paidElite++
      ) {
        const paidNormal = support - paidElite;
        if (
          (forces.normalFixedHalf || forces.normalFreeSupport) &&
          paidNormal !== 0
        )
          continue;
        const doubledStrength =
          normal * (forces.normalFreeSupport ? 2 : 1) +
          paidNormal +
          (forces.eliteFreeSupport ? elite * 2 : elite + paidElite) *
            forces.eliteStrength;
        if (doubledStrength === dial * 2) {
          options.push({ normal, elite, paidNormal, paidElite });
          break; // Different support allocations with identical token losses are equivalent choices.
        }
      }
    }
  }
  return options;
}

export function specialForceName(faction: string) {
  return faction === 'emperor'
    ? 'Sardaukar'
    : faction === 'fremen'
      ? 'Fedaykin'
      : faction === 'ixians'
        ? 'Cyborg'
        : 'Elite';
}
