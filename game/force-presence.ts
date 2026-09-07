import { location, splitLocation } from './board';

/** Structural public input: no token identity, value, inventory or reserves. */
export type ForcePresence = {
  forces: Readonly<Record<string, number>>;
  noField?: {
    deployed: {
      location: { territory: string; sector: number };
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
  return (
    actual +
    (player.noField?.deployed?.location.territory === territory ? 1 : 0)
  );
}

/** A fresh location map, with the single hidden marker represented as one. */
export function presenceByLocation(
  player: ForcePresence,
): Record<string, number> {
  const counts = { ...player.forces };
  const marker = player.noField?.deployed?.location;
  if (marker) {
    const key = location(marker.territory, marker.sector);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}
