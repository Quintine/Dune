import { location, territory } from './board';

export const ECAZ_START_FORCES = 6;
export const ECAZ_START_LOCATIONS = Object.freeze(
  territory('imperial_basin').sectors.map((sector) =>
    location('imperial_basin', sector),
  ),
);

/** The printed territory and total constrain the allocation; return detached positive groups. */
export function quoteEcazStartingForces(
  placements: unknown,
): Record<string, number> {
  if (
    !placements ||
    typeof placements !== 'object' ||
    Array.isArray(placements)
  )
    throw new Error(
      'Choose the Imperial Basin sectors for six Ecaz starting forces.',
    );
  const entries = Object.entries(placements);
  if (
    !entries.every(
      ([key, amount]) =>
        ECAZ_START_LOCATIONS.includes(key) &&
        typeof amount === 'number' &&
        Number.isSafeInteger(amount) &&
        amount >= 0 &&
        amount <= ECAZ_START_FORCES,
    )
  )
    throw new Error(
      'Ecaz starting forces require whole nonnegative amounts in explicit Imperial Basin sectors.',
    );
  if (
    entries.reduce((total, [, amount]) => total + amount, 0) !==
    ECAZ_START_FORCES
  )
    throw new Error(
      'Place exactly six Ecaz starting forces in Imperial Basin.',
    );
  return Object.fromEntries(entries.filter(([, amount]) => amount > 0));
}
