import type { Game } from './engine';
import { caladanOwnsTerrorEntry, validateCaladanChildArrival, caladanEntryParentTuple,
  validCaladanEntryParent, type CaladanEntryParent } from './caladan-arrival';
import { currentHomeworldRevivalArrival } from './homeworld-revival-return';
import { validateRevivalArrivalSource, revivalOwnsTerrorEntry, validRevivalEntryParent,
  revivalEntryParentTuple, type RevivalEntryParent } from './revival-terror-entry';

type Overlap = NonNullable<Game['pendingArrivalOverlap']> & { revivalArrival?: RevivalEntryParent };
type TerrorEntry = NonNullable<Game['pendingTerrorEntry']> & { revivalArrival?: RevivalEntryParent };
type AmbassadorEntry = NonNullable<Game['pendingAmbassador']>;
type DiscardContext = Parameters<typeof validateRevivalArrivalSource>[0] & Pick<Game, 'pendingArrivalOverlap' | 'order' |
  'lastBattleContext' | 'homeworldVictoryReinforcement'>;

function sameRevivalSource(left: RevivalEntryParent | undefined, right: RevivalEntryParent | undefined) {
  return validRevivalEntryParent(left) && validRevivalEntryParent(right) &&
    JSON.stringify(revivalEntryParentTuple(left)) === JSON.stringify(revivalEntryParentTuple(right));
}
function sameCaladanSource(left: CaladanEntryParent | undefined, right: CaladanEntryParent | undefined) {
  return validCaladanEntryParent(left) && validCaladanEntryParent(right) &&
    JSON.stringify(caladanEntryParentTuple(left)) === JSON.stringify(caladanEntryParentTuple(right));
}

/** The immutable trigger, not later owner choices or child stages. */
export function arrivalOverlapSignature(record: Overlap): string {
  return JSON.stringify([record.event, record.turn, record.phase, record.entrant,
    record.territory, record.sector, record.amount, record.elite, record.cause,
    record.resume, record.ecaz, record.moritani, record.first,
    record.ambassadorToken, record.terrorTokens,
    ...(record.revivalArrival === undefined ? [] : [revivalEntryParentTuple(record.revivalArrival)]),
    ...(record.victoryEvent === undefined ? [] : [['caladanVictory', record.victoryEvent]]),
    ...(record.caladanArrival === undefined ? [] : [caladanEntryParentTuple(record.caladanArrival)])]);
}

/** A fresh discard belongs to the active owner of an ordinary or bound revived entry.
 * The parent keeps the other owner's opportunity while the child is suspended. */
function ordinaryDiscardOverlap(g: DiscardContext, owner: Overlap['first']): Overlap | null {
  const overlap: Overlap | null | undefined = g.pendingArrivalOverlap;
  if (!overlap || overlap.signature !== arrivalOverlapSignature(overlap) ||
      overlap.turn !== g.turn || overlap.phase !== g.phase ||
      overlap.resume !== 'none' ||
      !['first', 'second'].includes(overlap.stage)) return null;
  if (overlap.caladanArrival !== undefined) {
    try { validateCaladanChildArrival(g,overlap.caladanArrival,overlap); }
    catch { return null; }
  } else if (overlap.revivalArrival !== undefined) {
    try {
      validateRevivalArrivalSource(g, overlap.revivalArrival, overlap);
    } catch { return null; }
  } else if (overlap.cause === 'caladanReinforcement' || overlap.victoryEvent !== undefined) {
    if (!caladanOwnsTerrorEntry(g, overlap)) return null;
  } else if (g.phase !== 5 ||
    !['shipment', 'movement'].includes(overlap.cause)) return null;
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
  const overlap = ordinaryDiscardOverlap({ ...g, pendingAmbassador: entry }, 'ambassador');
  const arrival = currentHomeworldRevivalArrival(g.homeworldRevivalReturn)?.ambassadors?.find(record => record.event === entry.event);
  const caladan = g.homeworldVictoryReinforcement?.ambassadors?.find(record => record.event === entry.event);
  return !!overlap && entry.stage === 'cards' && entry.resume === 'none' &&
    entry.event === overlap.ambassadorEvent && entry.owner === overlap.ecaz &&
    entry.token === overlap.ambassadorToken && entry.entrant === overlap.entrant &&
    entry.territory === overlap.territory && entry.sector === overlap.sector &&
    entry.arrivalCause === overlap.cause && entry.turn === overlap.turn && entry.phase === overlap.phase &&
    (overlap.victoryEvent === undefined || entry.victoryEvent === overlap.victoryEvent) &&
    (overlap.caladanArrival === undefined || entry.victoryEvent === overlap.caladanArrival.event &&
      !!caladan?.terror && sameCaladanSource(overlap.caladanArrival,{event:entry.victoryEvent,
        terror:caladan.terror,...(caladan.spiritual ? {spiritual:caladan.spiritual} : {})})) &&
    (overlap.revivalArrival === undefined || entry.revivalEvent === overlap.revivalArrival.event &&
      !!arrival && sameRevivalSource(overlap.revivalArrival, { event: overlap.revivalArrival.event,
        ...(arrival.spiritual === undefined ? {} : { spiritual: arrival.spiritual }),
        ...(arrival.terror === undefined ? {} : { terror: arrival.terror }) }));
}

export function overlapOwnsTerrorDiscard(g: DiscardContext, entry: TerrorEntry, owner: string): boolean {
  const overlap = ordinaryDiscardOverlap(g, 'terror');
  return !!overlap && owner === overlap.moritani && entry.resume === 'none' &&
    overlap.terrorTokens.includes(entry.token) && entry.entrant === overlap.entrant &&
    entry.territory === overlap.territory && entry.sector === overlap.sector &&
    entry.amount === overlap.amount && entry.elite === overlap.elite &&
    entry.cause === overlap.cause && entry.turn === overlap.turn && entry.phase === overlap.phase &&
    (overlap.victoryEvent === undefined || entry.victoryEvent === overlap.victoryEvent) &&
    (overlap.caladanArrival === undefined || sameCaladanSource(overlap.caladanArrival,entry.caladanArrival)) &&
    (overlap.revivalArrival === undefined ||
      sameRevivalSource(overlap.revivalArrival, entry.revivalArrival) && revivalOwnsTerrorEntry(g, entry));
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
