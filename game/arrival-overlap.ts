import type { Game } from './engine';

type Overlap = NonNullable<Game['pendingArrivalOverlap']>;
type TerrorEntry = NonNullable<Game['pendingTerrorEntry']>;
type AmbassadorEntry = NonNullable<Game['pendingAmbassador']>;
type DiscardContext = Pick<Game, 'pendingArrivalOverlap' | 'turn' | 'phase' | 'order' | 'players'>;

/** The immutable trigger, not later owner choices or child stages. */
export function arrivalOverlapSignature(record: Overlap): string {
  return JSON.stringify([record.event, record.turn, record.phase, record.entrant,
    record.territory, record.sector, record.amount, record.elite, record.cause,
    record.resume, record.ecaz, record.moritani, record.first,
    record.ambassadorToken, record.terrorTokens]);
}

/** A fresh discard belongs to the currently active owner of one ordinary entry.
 * The parent keeps the other owner's opportunity while the child is suspended. */
function ordinaryDiscardOverlap(g: DiscardContext, owner: Overlap['first']): Overlap | null {
  const overlap = g.pendingArrivalOverlap;
  if (!overlap || overlap.signature !== arrivalOverlapSignature(overlap) ||
      overlap.turn !== g.turn || overlap.phase !== g.phase || g.phase !== 5 ||
      overlap.resume !== 'none' || !['shipment', 'movement'].includes(overlap.cause) ||
      !['first', 'second'].includes(overlap.stage)) return null;
  const ecaz = g.order.indexOf(overlap.ecaz), moritani = g.order.indexOf(overlap.moritani);
  if (ecaz < 0 || moritani < 0 || ecaz === moritani ||
      overlap.first !== (ecaz < moritani ? 'ambassador' : 'terror') ||
      !g.players.some(p => p.id === overlap.ecaz && p.faction === 'ecaz') ||
      !g.players.some(p => p.id === overlap.moritani && p.faction === 'moritani')) return null;
  const active = overlap.stage === 'first' ? overlap.first :
    overlap.first === 'ambassador' ? 'terror' : 'ambassador';
  return active === owner ? overlap : null;
}

export function overlapOwnsAmbassadorDiscard(g: DiscardContext, entry: AmbassadorEntry): boolean {
  const overlap = ordinaryDiscardOverlap(g, 'ambassador');
  return !!overlap && entry.stage === 'cards' && entry.resume === 'none' &&
    entry.event === overlap.ambassadorEvent && entry.owner === overlap.ecaz &&
    entry.token === overlap.ambassadorToken && entry.entrant === overlap.entrant &&
    entry.territory === overlap.territory && entry.sector === overlap.sector &&
    entry.arrivalCause === overlap.cause && entry.turn === overlap.turn && entry.phase === overlap.phase;
}

export function overlapOwnsTerrorDiscard(g: DiscardContext, entry: TerrorEntry, owner: string): boolean {
  const overlap = ordinaryDiscardOverlap(g, 'terror');
  return !!overlap && owner === overlap.moritani && entry.resume === 'none' &&
    overlap.terrorTokens.includes(entry.token) && entry.entrant === overlap.entrant &&
    entry.territory === overlap.territory && entry.sector === overlap.sector &&
    entry.amount === overlap.amount && entry.elite === overlap.elite &&
    entry.cause === overlap.cause && entry.turn === overlap.turn && entry.phase === overlap.phase;
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
