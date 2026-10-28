import type { RicheseBidPromise } from './richese-bid-promises';

/** A single bid in the first actual cache auction of this turn, before its
 * card, method, direction and public event have been chosen. */
export type EarlyRicheseBidClaim = { turn: number; minimum: number };
export type EarlyRicheseBidPromise = EarlyRicheseBidClaim & {
  id: string;
  player: string;
  asker: string;
  answer: boolean;
  boundEvent?: string;
  fulfilled?: boolean;
  released?: boolean;
};
export type EarlyRicheseBidChange = 'voluntary' | 'external';
export type EarlyRicheseBidWitness = {
  /** Whether the original cache auction may still occur this turn. */
  cachePending: boolean;
  /** Whether the respondent has an engine-verified funded opportunity. */
  canBid: boolean;
  /** Maximum funded bid, not a forecast of another player's hidden action. */
  maximum: number;
  change: EarlyRicheseBidChange;
};
export class EarlyRicheseBidError extends Error {}

const positive = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
const identifier = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value === value.trim();
const validMaximum = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

export function parseEarlyRicheseBidClaim(value: unknown): EarlyRicheseBidClaim {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new EarlyRicheseBidError('Choose a future cache auction bid question.');
  const input = value as Record<string, unknown>;
  if (!positive(input.turn) || !positive(input.minimum))
    throw new EarlyRicheseBidError('Choose the current turn and a positive whole bid minimum.');
  return { turn: input.turn, minimum: input.minimum };
}

export function earlyRicheseBidClaimText(claim: EarlyRicheseBidClaim): string {
  return `place a bid of at least ${claim.minimum} spice in this turn's first Richese cache auction`;
}

/** Bound receipts have been transferred to the real lot and are no longer
 * waiting; the normal Richese promise ledger owns their subsequent outcome. */
export function liveEarlyRicheseBidPromises(
  promises: readonly EarlyRicheseBidPromise[], player: string, turn: number,
): EarlyRicheseBidPromise[] {
  return promises.filter(row => row.player === player && row.turn === turn &&
    !row.boundEvent && !row.fulfilled && !row.released);
}

function checkPeople(player: string, asker: string): void {
  if (!identifier(player) || !identifier(asker) || player === asker)
    throw new EarlyRicheseBidError('Choose different seated asker and respondent identities.');
}
function checkMaximum(maximum: number): void {
  if (!validMaximum(maximum)) throw new EarlyRicheseBidError('Retain the funded cache bid maximum.');
}

/** Return truthfully compatible definite answers, using only a native maximum
 * independently verified by the engine. It may pass zero when a Yes witness
 * cannot be established. All earlier waiting answers remain jointly feasible. */
export function earlyRicheseBidAnswerOptions(
  promises: readonly EarlyRicheseBidPromise[], claim: EarlyRicheseBidClaim,
  player: string, asker: string, maximum: number,
): boolean[] {
  parseEarlyRicheseBidClaim(claim);
  checkPeople(player, asker);
  checkMaximum(maximum);
  const live = liveEarlyRicheseBidPromises(promises, player, claim.turn);
  return [true, false].filter(answer => {
    const rows = [...live, { ...claim, answer }];
    const required = rows.filter(row => row.answer);
    if (!required.length) return true;
    const lower = Math.max(...required.map(row => row.minimum));
    const upper = Math.min(maximum, ...rows.filter(row => !row.answer).map(row => row.minimum - 1));
    return lower <= upper;
  });
}

export function bindEarlyRicheseBid(
  promises: readonly EarlyRicheseBidPromise[], claim: EarlyRicheseBidClaim,
  player: string, asker: string, answer: boolean, id: string, maximum: number,
): EarlyRicheseBidPromise[] {
  if (!identifier(id) || promises.some(row => row.id === id) || typeof answer !== 'boolean')
    throw new EarlyRicheseBidError('Retain a distinct receipt and definite answer.');
  if (!earlyRicheseBidAnswerOptions(promises, claim, player, asker, maximum).includes(answer))
    throw new EarlyRicheseBidError('Choose an answer compatible with the funded cache bid and existing answers.');
  return [...promises, { ...parseEarlyRicheseBidClaim(claim), id, player, asker, answer }];
}

/** Called only for creation of the first physical cache lot, before that lot
 * can auto-settle. No card identity or method is stored in the early receipt. */
export function attachEarlyRicheseBids(
  promises: readonly EarlyRicheseBidPromise[], turn: number, event: string,
): { promises: EarlyRicheseBidPromise[]; bound: RicheseBidPromise[] } {
  if (!positive(turn) || !identifier(event))
    throw new EarlyRicheseBidError('Retain the current turn and real cache auction event.');
  const pending = promises.filter(row => row.turn === turn && !row.boundEvent && !row.fulfilled && !row.released);
  const bound = pending.map(({ id, player, asker, answer, minimum }) =>
    ({ id, player, asker, answer, turn, event, minimum }));
  return { promises: promises.map(row => pending.includes(row) ? { ...row, boundEvent: event } : row), bound };
}

/** The caller supplies a complete current witness. An actor cannot voluntarily
 * eliminate their own last funded Yes; an external event releases only the
 * answers it makes impossible. No closes only when the cache is unavailable. */
export function reconcileEarlyRicheseBids(
  promises: readonly EarlyRicheseBidPromise[], player: string, turn: number,
  witness: EarlyRicheseBidWitness,
): EarlyRicheseBidPromise[] {
  if (!identifier(player) || !positive(turn) || !witness ||
      typeof witness.cachePending !== 'boolean' || typeof witness.canBid !== 'boolean' ||
      !validMaximum(witness.maximum) ||
      (witness.change !== 'voluntary' && witness.change !== 'external'))
    throw new EarlyRicheseBidError('Retain the cache auction witness and the cause of the change.');
  const live = liveEarlyRicheseBidPromises(promises, player, turn);
  const noCap = Math.min(witness.maximum, ...live.filter(row => !row.answer).map(row => row.minimum - 1));
  const impossible = live.filter(row => row.answer &&
    (!witness.cachePending || !witness.canBid || row.minimum > noCap));
  if (impossible.length && witness.change === 'voluntary')
    throw new EarlyRicheseBidError('This action would remove your last funded cache bid opportunity.');
  return promises.map(row => {
    if (!live.includes(row)) return row;
    if (impossible.includes(row)) return { ...row, released: true };
    if (!witness.cachePending && !row.answer) return { ...row, fulfilled: true };
    return row;
  });
}

export function validateEarlyRicheseBidPromises(
  promises: readonly EarlyRicheseBidPromise[], players: readonly string[],
): void {
  if (!Array.isArray(promises) || !Array.isArray(players))
    throw new EarlyRicheseBidError('The early cache bid records are invalid.');
  const ids = new Set<string>();
  for (const row of promises) {
    parseEarlyRicheseBidClaim(row);
    if (!identifier(row.id) || ids.has(row.id) || !players.includes(row.player) ||
        !players.includes(row.asker) || row.player === row.asker || typeof row.answer !== 'boolean' ||
        (row.boundEvent !== undefined && !identifier(row.boundEvent)) ||
        (row.fulfilled !== undefined && typeof row.fulfilled !== 'boolean') ||
        (row.released !== undefined && typeof row.released !== 'boolean') ||
        (row.fulfilled && row.released) || (row.boundEvent && (row.fulfilled || row.released)))
      throw new EarlyRicheseBidError('The early cache bid receipt lost its identity, participants or state.');
    ids.add(row.id);
  }
}
