import { isAdvisor } from './advisors';
import { MOBILE_STRONGHOLD, splitLocation } from './board';
import type { Player } from './engine';

/** Only public board presence is needed; concealed token values are never read. */
export type MobileCollectionPlayer = Pick<Player, 'id' | 'faction' | 'advisors'> & {
  forces: Readonly<Record<string, number>>;
  noField?: {
    deployed: {
      controller: string;
      location: { territory: string; sector: number };
    } | null;
  } | null;
};

/**
 * Provisional interpretation: all fighters aboard contribute, including
 * passengers; advisors do not. A concealed No-Field contributes one force,
 * with its controller's stance, even though Richese holds the marker record.
 */
export function mobileStrongholdCollectionCapacity(
  players: readonly MobileCollectionPlayer[],
): number {
  let fighters = 0;
  for (const player of players) {
    if (!isAdvisor(player, MOBILE_STRONGHOLD)) {
      fighters += Object.entries(player.forces).reduce(
        (total, [key, count]) =>
          total + (splitLocation(key).territory === MOBILE_STRONGHOLD ? count : 0),
        0,
      );
    }
    const marker = player.noField?.deployed;
    if (marker?.location.territory === MOBILE_STRONGHOLD) {
      const controller = players.find((seat) => seat.id === marker.controller);
      if (!controller || !isAdvisor(controller, MOBILE_STRONGHOLD)) fighters++;
    }
  }
  return fighters * 2;
}
