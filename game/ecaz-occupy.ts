import { FACTIONS, type FactionId } from './catalog';
import { MOBILE_STRONGHOLD, TERRITORIES, validLocation } from './board';

/** Only seated public identity is relevant. No force totals, advisor stance,
 * hidden markers, hands, combat plans or faction bonuses are read here. */
export type EcazOccupancySeat = Readonly<{
  id: string;
  faction: FactionId;
  ally?: string | null;
}>;
export type EcazOccupancyLocation =
  | Readonly<{ kind: 'territory'; id: string; sector?: number }>
  | Readonly<{ kind: 'homeworld'; id: string }>;
export type EcazOccupancyIdentity = {
  kind: 'seat' | 'ecazAlliance';
  members: string[];
  /** Collision-free, deterministic identity for movement/occupancy grouping. */
  key: string;
};
export type EcazOccupancyRelation = 'sameSeat' | 'ecazAlliance' | 'different';
export class EcazOccupancyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EcazOccupancyError';
  }
}
const text = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
function requireOccupancy(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) throw new EcazOccupancyError(message);
}
function validate(
  seats: readonly EcazOccupancySeat[],
  at: EcazOccupancyLocation,
) {
  requireOccupancy(
    Array.isArray(seats) &&
      seats.length > 0 &&
      seats.every(
        (seat) =>
          record(seat) &&
          text(seat.id) &&
          FACTIONS.some((faction) => faction.id === seat.faction) &&
          (seat.ally === undefined || seat.ally === null || text(seat.ally)),
      ) &&
      new Set(seats.map((seat) => seat.id)).size === seats.length &&
      new Set(seats.map((seat) => seat.faction)).size === seats.length,
    'Occupancy requires unique valid seated identities and factions.',
  );
  for (const seat of seats) {
    if (seat.ally === undefined || seat.ally === null) continue;
    const ally = seats.find((other) => other.id === seat.ally);
    requireOccupancy(
      ally && ally.id !== seat.id && ally.ally === seat.id,
      'Occupancy requires a seated, distinct, reciprocal ally.',
    );
  }
  requireOccupancy(
    record(at) && text(at.id),
    'Choose a valid occupancy location.',
  );
  if (at.kind === 'homeworld') return;
  requireOccupancy(
    at.kind === 'territory' &&
      (at.id === MOBILE_STRONGHOLD ||
        TERRITORIES.some((t) => t.id === at.id)) &&
      (at.sector === undefined ||
        (Number.isSafeInteger(at.sector) && validLocation(at.id, at.sector))),
    'Occupancy requires a board territory and valid optional sector.',
  );
}
function identity(
  seats: readonly EcazOccupancySeat[],
  player: string,
  at: EcazOccupancyLocation,
): EcazOccupancyIdentity {
  const seat = seats.find((seat) => seat.id === player);
  requireOccupancy(
    text(player) && seat,
    'This occupying player is not seated.',
  );
  const ally = seats.find((other) => other.id === seat.ally);
  const coalition =
    at.kind === 'territory' &&
    ally &&
    (seat.faction === 'ecaz' || ally.faction === 'ecaz');
  const members = coalition ? [seat.id, ally.id].sort() : [seat.id];
  return {
    kind: coalition ? 'ecazAlliance' : 'seat',
    members,
    key: JSON.stringify(members),
  };
}

/** E3 Occupy identifies Ecaz and its reciprocal ally as one faction for
 * territory entry/occupancy. Homeworlds do not inherit that permission.
 * A result is identity only: the caller still checks actual presence, stance,
 * capacity, storm and transport rules. It is not combat or victory scoring. */
export function ecazOccupancyIdentity(
  seats: readonly EcazOccupancySeat[],
  player: string,
  at: EcazOccupancyLocation,
): EcazOccupancyIdentity {
  validate(seats, at);
  return identity(seats, player, at);
}

/** Distinguish an actual seat from its Ecaz alliance partner. Ordinary allied
 * factions remain different identities; no ordinary alliance entry is granted. */
export function ecazOccupancyRelation(
  seats: readonly EcazOccupancySeat[],
  left: string,
  right: string,
  at: EcazOccupancyLocation,
): EcazOccupancyRelation {
  validate(seats, at);
  const a = identity(seats, left, at);
  const b = identity(seats, right, at);
  if (left === right) return 'sameSeat';
  return a.key === b.key ? 'ecazAlliance' : 'different';
}
