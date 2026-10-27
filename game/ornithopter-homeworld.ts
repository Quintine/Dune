import type { MovementCohort } from './ornithopter';

export type ImperialFlightWorld = {
  id: string;
  native: string;
  forces: Record<string, { normal: number; elite: number }>;
};
const imperialWorlds = ['homeworld:emperor', 'homeworld:emperor:salusa'];

/** Native World counters come only from their actual typed custody, never the
 * aggregate reserve total. World IDs are cohort keys without a sector suffix. */
export function imperialFlightPools(
  boardForces: Record<string, number>,
  boardElites: Record<string, number>,
  worlds: readonly ImperialFlightWorld[],
  owner: string,
): { forces: Record<string, number>; elites: Record<string, number> } {
  const forces = { ...boardForces }, elites = { ...boardElites };
  for (const id of imperialWorlds) {
    delete forces[id]; delete elites[id];
    const world = worlds.find(candidate => candidate.id === id && candidate.native === owner);
    if (!world) continue;
    const group = world.forces[owner];
    if (!group || !Number.isSafeInteger(group.normal) || group.normal < 0 ||
        !Number.isSafeInteger(group.elite) || group.elite < 0 ||
        !Number.isSafeInteger(group.normal + group.elite))
      throw new RangeError('Imperial flight needs actual nonnegative typed Homeworld custody.');
    forces[id] = group.normal + group.elite;
    elites[id] = group.elite;
  }
  return { forces, elites };
}

/** Older flights blocked all World moves, so their then-current World pools
 * are still unmoved. A fresh aware cohort must retain its depleted quotas. */
export function imperialFlightCohort(
  cohort: MovementCohort,
  aware: boolean,
  worlds: readonly ImperialFlightWorld[],
  owner: string,
): MovementCohort {
  const pools = aware ? { forces: { ...cohort.forces }, elites: { ...cohort.elites } }
    : imperialFlightPools(cohort.forces, cohort.elites, worlds, owner);
  return { ...pools, ...(cohort.noField ? { noField: { ...cohort.noField } } : {}) };
}
