import type { FactionId } from './catalog';
import { territory } from './board';
import { fighterCount } from './advisors';
import { presenceAt, type ForcePresence } from './force-presence';
import { ecazOccupancyIdentity, ecazOccupancyRelation } from './ecaz-occupy';

/** Public board information only: a concealed No-Field contributes presence,
 * never its hidden denomination. Advisor groups do not fill strongholds. */
export type OccupancySeat = ForcePresence & {
  id: string;
  faction: FactionId;
  ally?: string | null;
  advisors?: Readonly<Record<string, { lockedTurn?: number }>>;
};

/** Count the occupying factions after admitting a fighter from enteringId.
 * Ecaz and its reciprocal ally share a faction for board occupancy. Physical
 * forces and player ownership remain separate. This is not a combat side. */
export function occupyingFactionCount(
  players: readonly OccupancySeat[],
  to: string,
  enteringId?: string,
) {
  const where = { kind: 'territory' as const, id: to };
  const sides = new Set(
    players
      .filter((p) => fighterCount(p, to) > 0)
      .map((p) => ecazOccupancyIdentity(players, p.id, where).key),
  );
  if (enteringId)
    sides.add(ecazOccupancyIdentity(players, enteringId, where).key);
  return sides.size;
}

export function territoryEntryBlock(
  players: readonly OccupancySeat[],
  playerId: string,
  to: string,
  advisors = false,
): string | null {
  // Validate the complete identity roster even for an empty destination.
  ecazOccupancyIdentity(players, playerId, { kind: 'territory', id: to });
  if (advisors) return null;
  const player = players.find((p) => p.id === playerId)!;
  const ally = players.find((p) => p.id === player.ally);
  if (
    to !== 'polar_sink' &&
    ally &&
    presenceAt(ally, to) > 0 &&
    ecazOccupancyRelation(players, playerId, ally.id, {
      kind: 'territory',
      id: to,
    }) !== 'ecazAlliance'
  )
    return 'You cannot enter a territory occupied by your ally.';
  if (
    territory(to).type === 'stronghold' &&
    occupyingFactionCount(players, to, playerId) > 2
  )
    return 'A stronghold cannot contain three occupying factions.';
  return null;
}

/** Passing through a stronghold uses capacity, not allied destination rules. */
export function strongholdPathBlocked(
  players: readonly OccupancySeat[],
  playerId: string,
  to: string,
  advisors = false,
) {
  return (
    !advisors &&
    territory(to).type === 'stronghold' &&
    occupyingFactionCount(players, to, playerId) > 2
  );
}
