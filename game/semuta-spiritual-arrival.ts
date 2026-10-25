import type { Game } from './engine';
import { location, validGameLocation } from './board';

/** The ordinary foreign shipment remains deposited behind its Spiritual
 * child. Native frame/source validators separately bind the selected grant. */
export function semutaSpiritualArrivalSupported(g: Game): boolean {
  const frame = g.pendingSpiritualAdvisor, arrivals = g.pendingArrivalReaction;
  if (!g.advanced || g.phase !== 5 || !frame || frame.decision.ambassadorEvent ||
      frame.decision.revivalEvent || g.pendingAmbassador || !Array.isArray(arrivals) ||
      arrivals.length !== 1) return false;
  const entry = arrivals[0];
  if (!entry || Object.keys(entry).sort().join(',') !==
      'amount,cause,elite,entrant,phase,resume,sector,territory,turn' ||
      entry.turn !== g.turn || entry.phase !== g.phase || entry.cause !== 'shipment' ||
      entry.resume !== 'none' || frame.decision.shipment !== entry.entrant ||
      frame.decision.destination !== location(entry.territory,entry.sector) ||
      !Number.isSafeInteger(entry.amount) || entry.amount <= 0 || entry.amount > 20 ||
      !Number.isSafeInteger(entry.elite) || entry.elite < 0 || entry.elite > entry.amount ||
      !validGameLocation(g,entry.territory,entry.sector)) return false;
  const entrant = g.players.find(p => p.id === entry.entrant);
  if (!entrant || entrant.id !== g.active || entrant.id === frame.decision.player ||
      entrant.faction === 'beneGesserit' || entrant.faction === 'fremen' ||
      entrant.shipped !== true || !g.movementRemaining?.includes(entrant.id)) return false;
  const key = location(entry.territory,entry.sector), total = entrant.forces[key] ?? 0,
    elite = entrant.elites?.forces[key] ?? 0;
  return total >= entry.amount && elite >= entry.elite &&
    total - elite >= entry.amount - entry.elite;
}
