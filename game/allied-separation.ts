import { MOBILE_STRONGHOLD, splitLocation } from './board';
import { ecazOccupancyRelation } from './ecaz-occupy';
import { presenceAt, type ForcePresence } from './force-presence';
import type { OccupancySeat } from './occupancy';

/** Physical baseline distinguishes this turn's visitors from old co-occupation. */
export type BasicAlliedShipment = Readonly<{
  player: string;
  ally: string;
  turn: number;
  territory: string;
  baseline: Readonly<{ normal: number; elite: number }>;
}>;

/** Ordinary Basic reserve arrivals only; movement endpoints keep their guard. */
export function isBasicAlliedShipmentVisit(
  context: Readonly<{
    advanced: boolean;
    phase: number;
    active: string | null;
    players: readonly OccupancySeat[];
  }>,
  player: OccupancySeat & Readonly<{ shipped?: boolean; moved?: number }>,
  to: string,
): boolean {
  if (context.advanced || context.phase !== 5 || context.active !== player.id ||
      player.shipped !== false || player.moved !== 0 || to === 'polar_sink' ||
      to === MOBILE_STRONGHOLD) return false;
  const ally = context.players.find(seat => seat.id === player.ally);
  return !!ally && ally.ally === player.id && presenceAt(ally, to) > 0 &&
    ecazOccupancyRelation(context.players, player.id, ally.id, {
      kind: 'territory', id: to,
    }) !== 'ecazAlliance';
}

export function alliedShipmentPhysicalPool(
  player: ForcePresence & { elites?: { forces: Readonly<Record<string, number>> } },
  to: string,
): { normal: number; elite: number } {
  let normal = 0;
  let elite = 0;
  for (const key in player.forces) {
    if (splitLocation(key).territory !== to) continue;
    const special = player.elites?.forces[key] ?? 0;
    elite += special;
    normal += player.forces[key] - special;
  }
  return { normal, elite };
}

export type AlliedSeparationQuoteContext = Readonly<{
  advanced: boolean;
  turn: number;
  player: string;
  ally: string | null;
  playerAllySinceTurn?: number;
  allySinceTurn?: number;
  remaining: readonly string[];
  territories: readonly Readonly<{
    territory: string;
    polar: boolean;
    ownPresent: boolean;
    allyPresent: boolean;
    ownAdvisors: boolean;
    allyAdvisors: boolean;
    ecazCoexist: boolean;
  }>[];
}>;

/**
 * Quote the ending player's loss territories, not casualties or force custody.
 * The engine supplies canonical presence, advisor stance and Ecaz coexistence.
 * Advanced separates at every player's end; Basic retains its legacy timing.
 */
export function quoteAlliedSeparation(
  context: AlliedSeparationQuoteContext,
): string[] {
  if (!context.ally) return [];
  if (
    !context.advanced &&
    (context.remaining.includes(context.ally) ||
      (context.playerAllySinceTurn === context.turn &&
        context.allySinceTurn === context.turn))
  )
    return [];

  const territories: string[] = [];
  for (const group of context.territories) {
    if (
      group.polar ||
      !group.ownPresent ||
      !group.allyPresent ||
      group.ecazCoexist ||
      (context.advanced && (group.ownAdvisors || group.allyAdvisors))
    )
      continue;
    territories.push(group.territory);
  }
  return territories;
}
