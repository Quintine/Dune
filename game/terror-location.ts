import type { Game } from './engine';
import { TERRITORIES } from './board';
import { TERROR_STRONGHOLDS } from './moritani-terror';
import { validateNexusMoritani } from './nexus-moritani';

export type TerrorLocationContext = Pick<Game,'players'> & Partial<Pick<Game,'turn'|'nexusMoritaniHistory'|'nexusMoritaniLocations'>>;
type Record = NonNullable<Game['nexusMoritaniHistory']>[number];
export function nexusMoritaniRecordSignature(record: Record): string {
  return JSON.stringify([record.receipt.signature,record.stage,record.before,record.frame]);
}
/** A historical grant survives card disposal, population changes and revelation.
 * It never grants a new placement action or admits Homeworld/HMS destinations. */
export function terrorLocationAllowed(context: TerrorLocationContext, token: string, territory: string, event?: string, pending = false, historical = false): boolean {
  if (!event && TERROR_STRONGHOLDS.includes(territory)) return true;
  if (!TERRITORIES.some(t => t.id === territory) || !Number.isSafeInteger(context.turn)) return false;
  const record = context.nexusMoritaniHistory?.find(candidate =>
    candidate.receipt?.token === token && candidate.receipt.territory === territory &&
    (!event || candidate.receipt.event === event) && candidate.stage === (pending ? 'pending' : 'complete'));
  if (!record || record.signature !== nexusMoritaniRecordSignature(record)) return false;
  try { validateNexusMoritani({turn:context.turn!,players:context.players},record.receipt); }
  catch { return false; }
  if (pending) return record.receipt.turn === context.turn;
  return historical || (context.nexusMoritaniLocations?.[token]?.event === record.receipt.event &&
    context.nexusMoritaniLocations[token].territory === territory);
}
export function terrorEntryLocationAllowed(context: TerrorLocationContext, entry: NonNullable<Game['pendingTerrorEntry']>): boolean {
  if (TERROR_STRONGHOLDS.includes(entry.territory) && !entry.nexusPlacements) return true;
  const ids = entry.candidates ?? [entry.token];
  return !!entry.nexusPlacements && Object.keys(entry.nexusPlacements).length === ids.length && ids.every(id =>
    typeof entry.nexusPlacements?.[id] === 'string' &&
    terrorLocationAllowed(context,id,entry.territory,entry.nexusPlacements[id],false,true));
}
