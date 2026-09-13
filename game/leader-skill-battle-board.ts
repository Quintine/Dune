import { gameTerritories, splitLocation, type MobileBoard } from './board';
import { fighterCount } from './advisors';
import { isDiscoveryLocationId, JACURUTU_SIETCH } from './discoveries';
import type { ForcePresence } from './force-presence';
import type { FactionId } from './catalog';

/** Occupation is physical public presence, independent of victory control or storm. */
export function leaderSkillStrongholdCount(
  board: MobileBoard,
  player: ForcePresence & { faction: FactionId; advisors?: Record<string, { lockedTurn?: number }> },
): number {
  return gameTerritories(board).filter((t) => t.type === 'stronghold' &&
    (!isDiscoveryLocationId(t.id) || t.id === JACURUTU_SIETCH) &&
    fighterCount(player, t.id) > 0).length;
}

/** The card adds board spice to an existing pile; it grants no direct faction income. */
export function sandmasterVictorySpice(territory: string, spice: Readonly<Record<string, number>>) {
  const piles = Object.entries(spice).filter(([key, amount]) => amount > 0 && splitLocation(key).territory === territory);
  if (piles.length > 1) throw new Error('Sandmaster placement among multiple spice piles awaits its sector ruling.');
  if (!piles.length) return null;
  const [key, before] = piles[0];
  if (!Number.isSafeInteger(before) || before < 1 || !Number.isSafeInteger(before + 3))
    throw new Error('Sandmaster requires a valid existing spice pile.');
  return { key, before, after: before + 3 };
}
