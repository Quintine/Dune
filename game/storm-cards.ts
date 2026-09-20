/** The six numeric Storm Card faces. This catalog does not hold a game's draw. */
export const STORM_CARD_DISTANCES = [1, 2, 3, 4, 5, 6] as const;
export type StormCardDistance = (typeof STORM_CARD_DISTANCES)[number];
export type StormCardComponent = { kind: 'stormCard'; distance: StormCardDistance };

export function isStormCardDistance(value: unknown): value is StormCardDistance {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 6;
}

/** Only an explicitly revealed face may be read from a chronicle component. */
export function stormCardDistance(component: unknown): StormCardDistance | null {
  if (!component || typeof component !== 'object' || Array.isArray(component) ||
    Object.keys(component).sort().join(',') !== 'distance,kind') return null;
  const value = component as { kind: unknown; distance: unknown };
  return value.kind === 'stormCard' && isStormCardDistance(value.distance) ? value.distance : null;
}
