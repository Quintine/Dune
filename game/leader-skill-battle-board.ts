import { gameTerritories, location, splitLocation, validLocation } from './board';
import type { MobileBoard } from './board';
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

export type SandmasterVictorySpiceOffer = {
  event: string;
  player: string;
  territory: string;
  piles: Array<{ key: string; before: number; after: number }>;
};

/** The card adds board spice to an existing pile; it grants no direct faction income. */
export function sandmasterVictoryPiles(
  territory: string,
  spice: Readonly<Record<string, number>>,
): Array<{ key: string; before: number; after: number }> {
  const piles: Array<{ key: string; before: number; after: number }> = [];
  for (const [key, before] of Object.entries(spice)) {
    const at = splitLocation(key);
    if (at.territory !== territory) continue;
    if (!validLocation(at.territory, at.sector) || key !== location(at.territory, at.sector) ||
      !Number.isSafeInteger(before) || before < 0 ||
      (before > 0 && !Number.isSafeInteger(before + 3)))
      throw new Error('Sandmaster requires a valid existing spice pile.');
    if (before > 0) piles.push({ key, before, after: before + 3 });
  }
  return piles;
}

/** Owner selection among existing piles is provisional, not a publisher ruling. */
export function sandmasterVictorySpice(
  territory: string,
  spice: Readonly<Record<string, number>>,
  key?: string,
) {
  const piles = sandmasterVictoryPiles(territory, spice);
  if (key !== undefined) {
    const selected = piles.find((pile) => pile.key === key);
    if (!selected) throw new Error('Sandmaster must select an offered existing spice pile.');
    return selected;
  }
  if (piles.length > 1) throw new Error('Sandmaster requires selection of one existing spice pile.');
  return piles[0] ?? null;
}
