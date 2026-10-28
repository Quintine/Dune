import { location, splitLocation } from './board';
import { isBoardNoFieldLocation, type NoFieldLocation } from './richese-no-field';

/** Structural public input: no token identity, value, inventory or reserves. */
export type ForcePresence = {
  forces: Readonly<Record<string, number>>;
  noField?: {
    deployed: {
      location: NoFieldLocation;
    } | null;
  } | null;
};

/** Effective board presence; physical casualty/transport counts still use forces. */
export function presenceAt(player: ForcePresence, territory: string): number {
  const actual = Object.entries(player.forces).reduce(
    (total, [key, count]) =>
      total + (splitLocation(key).territory === territory ? count : 0),
    0,
  );
  const marker = player.noField?.deployed?.location;
  return actual + (marker && isBoardNoFieldLocation(marker) && marker.territory === territory ? 1 : 0);
}

/** A fresh location map, with the single hidden marker represented as one. */
export function presenceByLocation(
  player: ForcePresence,
): Record<string, number> {
  const counts = { ...player.forces };
  const marker = player.noField?.deployed?.location;
  if (marker && isBoardNoFieldLocation(marker)) {
    const key = location(marker.territory, marker.sector);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}
