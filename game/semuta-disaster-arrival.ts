import type { Game, ResponseWindow } from './engine';
import { location, validGameLocation } from './board';

/** Native Fremen Storm entry is already deposited; its earned arrival waits
 * behind protection. The disaster validator owns physical cohort validation. */
export function semutaDisasterArrivalSupported(g: Game, response: ResponseWindow): boolean {
  const arrivals = g.pendingArrivalReaction;
  if (!arrivals?.length) return true;
  if (response.kind !== 'stormProtection' || response.resume !== 'shipment' ||
      !Array.isArray(arrivals) || arrivals.length !== 1 || !g.advanced || g.phase !== 5) return false;
  const entry = arrivals[0];
  if (!entry || Object.keys(entry).sort().join(',') !==
      'amount,cause,elite,entrant,phase,resume,sector,territory,turn' ||
      entry.turn !== g.turn || entry.phase !== g.phase ||
      entry.cause !== 'shipment' || entry.resume !== 'none' ||
      entry.entrant !== response.owner || entry.entrant !== g.active ||
      entry.amount !== response.amount || entry.elite !== (response.elite ?? 0) ||
      !validGameLocation(g,entry.territory,entry.sector) ||
      location(entry.territory,entry.sector) !== response.location) return false;
  const entrant = g.players.find(p => p.id === entry.entrant);
  return entrant?.faction === 'fremen' && entrant.shipped === true &&
    !!g.movementRemaining?.includes(entrant.id);
}
