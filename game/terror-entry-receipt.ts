import type { Game } from './engine';
import { validLocation } from './board';
import { HomeworldCustodyError } from './homeworld-custody';
import { TERROR_STRONGHOLDS } from './moritani-terror';

type TerrorEntry = NonNullable<Game['pendingTerrorEntry']>;

/** Original public entry facts, independent of subsequent stage or population.
 * This is a consistency receipt, not an authorization token or secret digest. */
export function terrorEntrySignature(entry: TerrorEntry): string {
  return JSON.stringify([
    entry.candidates === undefined ? entry.token : ['stack', entry.candidates, entry.selectionSignature ?? null],
    entry.entrant,
    entry.territory,
    entry.sector,
    entry.amount,
    entry.elite,
    entry.cause,
    entry.turn,
    entry.phase,
    entry.resume,
    entry.ambassadorEvent ?? null,
  ]);
}

export function terrorSelectionSignature(entry: TerrorEntry): string {
  return JSON.stringify(['terrorSelection', entry.candidates, entry.token, entry.entrant,
    entry.territory, entry.sector, entry.amount, entry.elite, entry.cause,
    entry.turn, entry.phase, entry.resume, entry.ambassadorEvent ?? null]);
}

/** Older saves without a receipt remain explicit legacy state. Never invent
 * their original entry count from the destination's present occupants. */
export function validateTerrorEntrySignature(entry: TerrorEntry): void {
  if (entry.entrySignature === undefined && entry.candidates === undefined && entry.selectionSignature === undefined && entry.stage !== 'select') return;
  if (
    typeof entry.entrySignature !== 'string' ||
    typeof entry.token !== 'string' ||
    !entry.token ||
    (entry.candidates === undefined
      ? entry.selectionSignature !== undefined || entry.stage === 'select'
      : !Array.isArray(entry.candidates) || entry.candidates.length < 2 ||
        entry.candidates.some((id) => typeof id !== 'string' || !id) ||
        new Set(entry.candidates).size !== entry.candidates.length ||
        !entry.candidates.includes(entry.token) ||
        (entry.stage === 'select'
          ? entry.token !== entry.candidates[0] || entry.selectionSignature !== undefined
          : entry.selectionSignature !== terrorSelectionSignature(entry))) ||
    typeof entry.entrant !== 'string' ||
    !entry.entrant ||
    !TERROR_STRONGHOLDS.includes(entry.territory) ||
    !Number.isSafeInteger(entry.sector) ||
    !validLocation(entry.territory, entry.sector) ||
    !Number.isSafeInteger(entry.amount) ||
    entry.amount < 0 ||
    !Number.isSafeInteger(entry.elite) ||
    entry.elite < 0 ||
    entry.elite > entry.amount ||
    !Number.isSafeInteger(entry.turn) ||
    entry.turn < 1 ||
    !Number.isSafeInteger(entry.phase) ||
    entry.phase < 0 ||
    entry.phase > 8 ||
    ![
      'shipment',
      'movement',
      'guildTransport',
      'advisor',
      'wormRide',
      'ambassador',
    ].includes(entry.cause) ||
    !['none', 'wormRide', 'ambassador'].includes(entry.resume) ||
    (entry.ambassadorEvent !== undefined &&
      (typeof entry.ambassadorEvent !== 'string' || !entry.ambassadorEvent)) ||
    entry.entrySignature !== terrorEntrySignature(entry)
  )
    throw new HomeworldCustodyError(
      'The saved Terror entry no longer matches its original public arrival receipt.',
    );
}
