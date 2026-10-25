import type { Game, ResponseWindow } from './engine';
import { location, validGameLocation } from './board';

/** A completed ground move keeps its original arrival behind mandatory
 * conversion. This validates that deposited group without moving it again. */
export function semutaAdvisorArrivalSupported(g: Game, response: ResponseWindow): boolean {
  const arrivals = g.pendingArrivalReaction;
  if (!arrivals?.length) return true;
  const source = response.automaticAdvisorFlip;
  if (response.kind !== 'advisorFlip' || source?.producer !== 'groundMovement' ||
      !g.advanced || g.phase !== 5 || !Array.isArray(arrivals) || arrivals.length !== 1) return false;
  const entry = arrivals[0];
  if (!entry || Object.keys(entry).sort().join(',') !==
      'amount,cause,elite,entrant,phase,resume,sector,territory,turn' ||
      entry.turn !== g.turn || entry.phase !== g.phase ||
      entry.cause !== 'movement' || entry.resume !== 'none' ||
      entry.entrant !== source.mover || entry.entrant !== g.active ||
      !Number.isSafeInteger(entry.amount) || entry.amount <= 0 || entry.amount > 20 ||
      !Number.isSafeInteger(entry.elite) || entry.elite < 0 || entry.elite > entry.amount ||
      !validGameLocation(g,entry.territory,entry.sector)) return false;
  const mover = g.players.find(p => p.id === source.mover);
  if (!mover || mover.shipped !== true || mover.moved !== source.move ||
      !g.movementRemaining?.includes(mover.id)) return false;
  const key = location(entry.territory,entry.sector), total = mover.forces[key] ?? 0,
    elite = mover.elites?.forces[key] ?? 0;
  return total >= entry.amount && elite >= entry.elite &&
    total - elite >= entry.amount - entry.elite;
}
