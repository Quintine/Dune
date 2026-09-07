export type OrnithopterMode = 'range3' | 'twoGroups';
export type MovementMarker = { tokenId: string; event: string; from: string };
export type MovementCohort = {
  forces: Record<string, number>;
  elites: Record<string, number>;
  noField?: MovementMarker;
};
type Counts = Readonly<Record<string, number>>;

function validateCounts(counts: Counts, label: string) {
  if (!counts || typeof counts !== 'object' || Array.isArray(counts))
    throw new TypeError(`${label} must be a location count record.`);
  let total = 0;
  for (const [key, count] of Object.entries(counts)) {
    if (!key || !Number.isSafeInteger(count) || count < 0)
      throw new RangeError(
        `${label} needs nonnegative safe integer counts at named locations.`,
      );
    total += count;
    if (!Number.isSafeInteger(total))
      throw new RangeError(`${label} total must remain a safe integer.`);
  }
}
function validatePool(forces: Counts, elites: Counts, label: string) {
  validateCounts(forces, `${label} forces`);
  validateCounts(elites, `${label} elites`);
  for (const [key, count] of Object.entries(elites))
    if (count > (Object.hasOwn(forces, key) ? forces[key] : 0))
      throw new RangeError(`${label} elite count exceeds physical forces.`);
}
function validateMarker(marker: MovementMarker | undefined) {
  if (marker === undefined) return;
  if (
    !marker ||
    typeof marker !== 'object' ||
    Array.isArray(marker) ||
    !['tokenId', 'event', 'from'].every(
      (key) =>
        typeof marker[key as keyof MovementMarker] === 'string' &&
        marker[key as keyof MovementMarker].length > 0,
    )
  )
    throw new TypeError('A marker needs its exact token ID, event and source.');
}
const countAt = (counts: Counts, key: string) =>
  Object.hasOwn(counts, key) ? counts[key] : 0;
function requireSubset(
  forces: Counts,
  elites: Counts,
  selected: Counts,
  selectedElites: Counts,
  label: string,
) {
  for (const [key, amount] of Object.entries(selected)) {
    const elite = countAt(selectedElites, key);
    if (
      elite > countAt(elites, key) ||
      amount - elite > countAt(forces, key) - countAt(elites, key)
    )
      throw new RangeError(
        `Selected ordinary or elite forces exceed ${label}.`,
      );
  }
}
function requireMarker(
  cohort: MovementMarker | undefined,
  selected: MovementMarker | undefined,
) {
  validateMarker(cohort);
  validateMarker(selected);
  if (
    selected &&
    (!cohort ||
      selected.tokenId !== cohort.tokenId ||
      selected.event !== cohort.event ||
      selected.from !== cohort.from)
  )
    throw new Error(
      'The selected marker is not an unmoved member of this cohort.',
    );
}

/**
 * Snapshot the original unmoved physical units after choosing the first group.
 * Forces include elites; both types are subtracted separately. No range, phase,
 * routing, reaction timing or hidden No-Field value is read or inferred here.
 */
export function createRemainingCohort(
  allForces: Counts,
  allElites: Counts,
  selectedForces: Counts,
  selectedElites: Counts,
  marker?: MovementMarker,
  selectedMarker?: MovementMarker,
): MovementCohort {
  validatePool(allForces, allElites, 'Original');
  validatePool(selectedForces, selectedElites, 'Selected');
  requireSubset(
    allForces,
    allElites,
    selectedForces,
    selectedElites,
    'the original cohort',
  );
  requireMarker(marker, selectedMarker);
  const remainder = (all: Counts, selected: Counts) =>
    Object.fromEntries(
      Object.entries(all)
        .map(([key, count]) => [key, count - countAt(selected, key)] as const)
        .filter(([, count]) => count > 0),
    );
  return {
    forces: remainder(allForces, selectedForces),
    elites: remainder(allElites, selectedElites),
    ...(marker && !selectedMarker
      ? {
          noField: {
            tokenId: marker.tokenId,
            event: marker.event,
            from: marker.from,
          },
        }
      : {}),
  };
}

/**
 * A later group must fit both original unmoved quotas and current physical
 * custody, independently for ordinary and elite forces. Arriving moved units
 * never increase the quotas. The engine separately validates current marker
 * custody and any losses/relocations that alter which original units survive.
 * The optional marker is the selected marker, not the full hidden inventory.
 */
export function validateCohortSelection(
  cohort: MovementCohort,
  currentForces: Counts,
  currentElites: Counts,
  selectedForces: Counts,
  selectedElites: Counts,
  selectedMarker?: MovementMarker,
): void {
  if (!cohort || typeof cohort !== 'object' || Array.isArray(cohort))
    throw new TypeError('Supply an original unmoved cohort.');
  validatePool(cohort.forces, cohort.elites, 'Cohort');
  validatePool(currentForces, currentElites, 'Current');
  validatePool(selectedForces, selectedElites, 'Selected');
  requireSubset(
    cohort.forces,
    cohort.elites,
    selectedForces,
    selectedElites,
    'the original unmoved cohort',
  );
  requireSubset(
    currentForces,
    currentElites,
    selectedForces,
    selectedElites,
    'current physical custody',
  );
  requireMarker(cohort.noField, selectedMarker);
}
