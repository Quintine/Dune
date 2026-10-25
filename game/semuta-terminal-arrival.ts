import type { Game, ResponseWindow } from './engine';
import { location, validGameLocation } from './board';

/** A bare Basic advisor choice parks the original paid shipment's entry.
 * Validate its committed physical source, without quoting or replaying payment. */
export function semutaTerminalArrivalSupported(g: Game, response: ResponseWindow): boolean {
  const arrivals = g.pendingArrivalReaction;
  if (!arrivals?.length) return true;
  if (g.advanced || response.kind !== 'advisor' || !Array.isArray(arrivals) ||
      arrivals.length !== 1 || g.phase !== 5) return false;
  const entry = arrivals[0];
  if (!entry || Object.keys(entry).sort().join(',') !==
      'amount,cause,elite,entrant,phase,resume,sector,territory,turn' ||
      entry.turn !== g.turn || entry.phase !== g.phase ||
      entry.cause !== 'shipment' || entry.resume !== 'none' ||
      !Number.isSafeInteger(entry.amount) || entry.amount <= 0 || entry.amount > 20 ||
      !Number.isSafeInteger(entry.elite) || entry.elite < 0 || entry.elite > entry.amount ||
      !validGameLocation(g,entry.territory,entry.sector)) return false;
  const entrant = g.players.find(p => p.id === entry.entrant);
  if (!entrant || entrant.id !== g.active || entrant.id === response.owner ||
      entrant.faction === 'beneGesserit' || entrant.faction === 'fremen' ||
      entrant.shipped !== true || !g.movementRemaining?.includes(entrant.id)) return false;
  const key = location(entry.territory,entry.sector), total = entrant.forces[key] ?? 0,
    elite = entrant.elites?.forces[key] ?? 0;
  return total >= entry.amount && elite >= entry.elite &&
    total - elite >= entry.amount - entry.elite;
}
