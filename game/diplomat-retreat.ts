import { casualtyOptions, type CombatForces } from './combat';

export type RetreatForces = { normal: number; elite: number };
export type DiplomatRetreatSelection = RetreatForces & { destination: string | null };
export type DiplomatRetreatDestination = { location: string; choices: RetreatForces[] };

/** A retreat may take only counters not needed for any legal physical dial commitment. */
export function diplomatRetreatChoices(
  forces: CombatForces,
  dial: number,
  support: number,
  strength: number,
  available: RetreatForces = forces,
): RetreatForces[] {
  if (!Number.isSafeInteger(strength) || strength < 0) return [];
  const choices: RetreatForces[] = [];
  for (let normal = 0; normal <= Math.min(strength, forces.normal, available.normal); normal++)
    for (let elite = 0; elite <= Math.min(strength - normal, forces.elite, available.elite); elite++) {
      if (!normal && !elite) continue;
      if (casualtyOptions({ ...forces, normal: forces.normal - normal, elite: forces.elite - elite }, dial, support).length)
        choices.push({ normal, elite });
    }
  return choices;
}
