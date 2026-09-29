import type { Game } from './engine';

type Overlap = NonNullable<Game['pendingArrivalOverlap']>;
type TerrorEntry = NonNullable<Game['pendingTerrorEntry']>;

/** The immutable trigger, not later owner choices or child stages. */
export function arrivalOverlapSignature(record: Overlap): string {
  return JSON.stringify([record.event, record.turn, record.phase, record.entrant,
    record.territory, record.sector, record.amount, record.elite, record.cause,
    record.resume, record.ecaz, record.moritani, record.first,
    record.ambassadorToken, record.terrorTokens]);
}

/** The overlap owns the worm return while either serialized Terror prompt is live. */
export function overlapOwnsWormTerror(
  g: Pick<Game, 'pendingArrivalOverlap' | 'turn' | 'phase'>,
  entry: Pick<TerrorEntry, 'cause' | 'resume' | 'entrant' | 'territory' |
    'sector' | 'amount' | 'elite' | 'turn' | 'phase' | 'token'>,
): boolean {
  const overlap = g.pendingArrivalOverlap;
  return !!overlap && overlap.signature === arrivalOverlapSignature(overlap) &&
    overlap.resume === 'wormRide' && overlap.cause === 'wormRide' &&
    entry.cause === 'wormRide' && entry.resume === 'none' &&
    overlap.turn === g.turn && overlap.phase === g.phase &&
    entry.turn === overlap.turn && entry.phase === overlap.phase &&
    entry.entrant === overlap.entrant && entry.territory === overlap.territory &&
    entry.sector === overlap.sector && entry.amount === overlap.amount &&
    entry.elite === overlap.elite && overlap.terrorTokens.includes(entry.token) &&
    ((overlap.first === 'terror' && overlap.stage === 'first') ||
      (overlap.first === 'ambassador' && overlap.stage === 'second'));
}
