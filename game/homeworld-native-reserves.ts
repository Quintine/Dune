import {
  HomeworldCustodyError,
  homeworldForceGroups,
  quoteHomeworldCustody,
  type HomeworldCustody,
  type HomeworldCustodyContext,
  type HomeworldCustodyChange,
  type HomeworldForces,
} from './homeworld-custody';

export type NativeReserveSelections = Readonly<Record<string, HomeworldForces>>;
export class NativeReserveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NativeReserveError';
  }
}
const empty = (): HomeworldForces => ({ normal: 0, elite: 0 });
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
function requireReserve(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) throw new NativeReserveError(message);
}
function typed(value: unknown): asserts value is HomeworldForces {
  requireReserve(
    record(value) &&
      Object.keys(value).length === 2 &&
      Object.hasOwn(value, 'normal') &&
      Object.hasOwn(value, 'elite') &&
      typeof value.normal === 'number' &&
      Number.isSafeInteger(value.normal) &&
      value.normal >= 0 &&
      typeof value.elite === 'number' &&
      Number.isSafeInteger(value.elite) &&
      value.elite >= 0 &&
      Number.isSafeInteger(value.normal + value.elite) &&
      value.normal + value.elite <= 20,
    'Choose valid physical normal and special reserve counts.',
  );
}
function checked<T>(fn: () => T): T {
  try {
    return fn();
  } catch (error) {
    if (error instanceof HomeworldCustodyError)
      throw new NativeReserveError(error.message);
    throw error;
  }
}
function nativeHomes(
  context: HomeworldCustodyContext,
  custody: HomeworldCustody,
  actor: string,
) {
  const homes = homeworldForceGroups(context, custody).filter(
    (home) => home.native === actor,
  );
  requireReserve(
    typeof actor === 'string' && actor.trim().length > 0 && homes.length > 0,
    'Choose a seated native reserve owner.',
  );
  return homes;
}

/** Removes native reserves for a separately authorized external route. Neither
 * visitor forces nor a guessed Emperor split can fund a withdrawal. Zero is a
 * physical no-op, useful for zero-force callers; action permission is external. */
export function quoteNativeReserveWithdrawal(
  context: HomeworldCustodyContext,
  custody: HomeworldCustody,
  actor: string,
  requested: HomeworldForces,
  selections?: NativeReserveSelections,
) {
  return checked(() => {
    const homes = nativeHomes(context, custody, actor);
    typed(requested);
    const selected = new Map<string, HomeworldForces>();
    if (selections !== undefined) {
      requireReserve(
        record(selections),
        'Choose a valid Homeworld source allocation.',
      );
      const sum = empty();
      for (const [location, forces] of Object.entries(selections)) {
        requireReserve(
          homes.some((home) => home.id === location),
          'Reserve sources must be the selected faction’s native Homeworlds.',
        );
        typed(forces);
        selected.set(location, { normal: forces.normal, elite: forces.elite });
        sum.normal += forces.normal;
        sum.elite += forces.elite;
      }
      requireReserve(
        sum.normal === requested.normal && sum.elite === requested.elite,
        'The chosen Homeworld sources must exactly match both requested force types.',
      );
    } else {
      for (const home of homes) selected.set(home.id, empty());
      for (const kind of ['normal', 'elite'] as const) {
        const total = homes.reduce(
          (sum, home) => sum + home.forces[actor][kind],
          0,
        );
        requireReserve(
          requested[kind] <= total,
          'The native Homeworlds do not hold the requested reserve counters.',
        );
        for (const home of homes) {
          const available = home.forces[actor][kind];
          const least = Math.max(0, requested[kind] - (total - available));
          const most = Math.min(requested[kind], available);
          requireReserve(
            least === most,
            `Choose the Homeworld sources for the ${kind === 'elite' ? 'special' : 'normal'} reserves; more than one allocation is possible.`,
          );
          selected.get(home.id)![kind] = least;
        }
      }
    }
    const changes: HomeworldCustodyChange[] = homes.flatMap((home) => {
      const forces = selected.get(home.id) ?? empty();
      return forces.normal + forces.elite > 0
        ? [
            {
              homeworld: home.id,
              player: actor,
              withdraw: forces,
              deposit: empty(),
            },
          ]
        : [];
    });
    return quoteHomeworldCustody(context, custody, changes);
  });
}

/** Revival destination only: E3 p.10 restores Advanced Emperor's normal forces
 * to Kaitain and Sardaukar to Salusa. Other native reserve returns must use their
 * own route contract; this does not validate Tanks, cost or revival allowances. */
export function quoteNativeRevivalDeposit(
  context: HomeworldCustodyContext,
  custody: HomeworldCustody,
  actor: string,
  forces: HomeworldForces,
) {
  return checked(() => {
    const homes = nativeHomes(context, custody, actor);
    typed(forces);
    const primary = homes.find((home) => !home.secondary)!;
    const secondary = homes.find((home) => home.secondary);
    const placements: [string, HomeworldForces][] = secondary
      ? [
          [primary.id, { normal: forces.normal, elite: 0 }],
          [secondary.id, { normal: 0, elite: forces.elite }],
        ]
      : [[primary.id, { normal: forces.normal, elite: forces.elite }]];
    return quoteHomeworldCustody(
      context,
      custody,
      placements.flatMap(([homeworld, deposit]) =>
        deposit.normal + deposit.elite > 0
          ? [{ homeworld, player: actor, withdraw: empty(), deposit }]
          : [],
      ),
    );
  });
}
