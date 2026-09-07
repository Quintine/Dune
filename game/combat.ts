/** Counts refer to tokens, while dial values refer to battle strength. */
export type CombatForces = {
  normal: number;
  normalFixedHalf?: boolean;
  elite: number;
  eliteStrength: 1 | 2;
  freeSupport: boolean;
};
export type Casualties = {
  normal: number;
  elite: number;
  paidNormal: number;
  paidElite: number;
};

/** Every loss combination consistent with the revealed dial and spice payment. */
export function casualtyOptions(
  forces: CombatForces,
  dial: number,
  support: number,
): Casualties[] {
  if (
    !Number.isFinite(dial) ||
    dial < 0 ||
    !Number.isInteger(dial * 2) ||
    !Number.isInteger(support) ||
    support < 0 ||
    (forces.freeSupport && support !== 0)
  )
    return [];
  const options: Casualties[] = [];
  for (let elite = 0; elite <= forces.elite; elite++) {
    for (let normal = 0; normal <= forces.normal; normal++) {
      if (forces.freeSupport) {
        if (
          normal * (forces.normalFixedHalf ? 0.5 : 1) +
            elite * forces.eliteStrength ===
          dial
        )
          options.push({ normal, elite, paidNormal: 0, paidElite: 0 });
        continue;
      }
      for (
        let paidElite = Math.max(0, support - normal);
        paidElite <= Math.min(elite, support);
        paidElite++
      ) {
        const paidNormal = support - paidElite;
        if (forces.normalFixedHalf && paidNormal !== 0) continue;
        const doubledStrength =
          normal + paidNormal + (elite + paidElite) * forces.eliteStrength;
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
