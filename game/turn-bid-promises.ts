import { bidPromiseModeSupported } from './bid-promises';

/** One accepted ordinary bid after the answer, in this turn's Bidding phase. */
export type PhaseBidClaim = { turn: number; minimum: number };
export type PhaseBidPromise = PhaseBidClaim & {
  event: string;
  player: string;
  asker: string;
  answer: boolean;
  fulfilled?: boolean;
  released?: boolean;
};

/** An engine-verified inclusive interval for a native, funded declaration.
 * A future interval is a conservative witness: the engine must prove the next
 * lot can be reached and paid for from the actual state, including committed
 * invoices and capacity. An unbid lot and speculative rival actions do not
 * establish a later lot. This helper cannot verify those native facts itself. */
export type PhaseBidOpportunity = {
  turn: number;
  player: string;
  kind: 'current' | 'future';
  minimum: number;
  maximum: number;
};
export type PhaseBidRange = { minimum: number; maximum: number };
export type PhaseBidChange = 'voluntary' | 'external';

export class PhaseBidPromiseError extends Error {}

const positive = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
const identifier = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value === value.trim();

export function parsePhaseBidClaim(value: unknown): PhaseBidClaim {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new PhaseBidPromiseError('Choose a turn-wide ordinary bid question.');
  const input = value as Record<string, unknown>;
  if (!positive(input.turn) || !positive(input.minimum))
    throw new PhaseBidPromiseError('Choose the current turn and a positive whole bid minimum.');
  return { turn: input.turn, minimum: input.minimum };
}

/** A phase-wide Yes can depend on an unopened later lot; its Kull purchase
 * interruption needs a separate continuation proof from a current-lot Yes. */
export function phaseBidPromiseModeSupported(game: Parameters<typeof bidPromiseModeSupported>[0]): boolean {
  // Basic native Richese opens Semuta while preparing its cache auction.
  // This phase-wide contract has its own continuation through that window;
  // other current-lot bid contracts retain their separate Semuta guard.
  const basicRichese = !game.advanced && game.players.some(player => player.faction === 'richese');
  return !game.kullPreview && bidPromiseModeSupported(basicRichese ? { ...game, semutaPreview: undefined } : game);
}

export function phaseBidClaimText(claim: PhaseBidClaim): string {
  return `place a bid of at least ${claim.minimum} spice from now until this turn's Bidding phase closes`;
}

export function livePhaseBidPromises(promises: readonly PhaseBidPromise[], player: string, turn: number): PhaseBidPromise[] {
  return promises.filter(promise => promise.player === player && promise.turn === turn &&
    !promise.fulfilled && !promise.released);
}

function checkedOpportunity(opportunity: PhaseBidOpportunity): void {
  if (!opportunity || !positive(opportunity.turn) || !identifier(opportunity.player) ||
    opportunity.kind !== 'current' && opportunity.kind !== 'future' ||
    !positive(opportunity.minimum) || !positive(opportunity.maximum) || opportunity.minimum > opportunity.maximum)
    throw new PhaseBidPromiseError('Retain an actual funded native bid opportunity.');
}

/** Allowed native bids respect every live No; a smaller bid may remain legal
 * while a Yes remains achievable in a later verified native opportunity. */
export function phaseBidAllowedRange(promises: readonly PhaseBidPromise[], opportunity: PhaseBidOpportunity): PhaseBidRange | null {
  checkedOpportunity(opportunity);
  let maximum = opportunity.maximum;
  for (const promise of livePhaseBidPromises(promises, opportunity.player, opportunity.turn))
    if (!promise.answer) maximum = Math.min(maximum, promise.minimum - 1);
  return opportunity.minimum <= maximum ? { minimum: opportunity.minimum, maximum } : null;
}

/** A single qualifying declaration can fulfill all remaining Yes answers. */
export function phaseBidCompletionRange(promises: readonly PhaseBidPromise[], opportunity: PhaseBidOpportunity): PhaseBidRange | null {
  const range = phaseBidAllowedRange(promises, opportunity);
  if (!range) return null;
  let minimum = range.minimum;
  for (const promise of livePhaseBidPromises(promises, opportunity.player, opportunity.turn))
    if (promise.answer) minimum = Math.max(minimum, promise.minimum);
  return minimum <= range.maximum ? { minimum, maximum: range.maximum } : null;
}

/** Call only for a real accepted native bid, inside the detached engine
 * transaction. A previous bid, final invoice or sum of bids is not a receipt. */
export function recordPhaseBid<T extends PhaseBidPromise>(promises: readonly T[], player: string,
  turn: number, amount: number): T[] {
  if (!identifier(player) || !positive(turn) || !positive(amount))
    throw new PhaseBidPromiseError('Record only an accepted positive whole native bid.');
  const live = livePhaseBidPromises(promises, player, turn);
  if (live.some(promise => !promise.answer && amount >= promise.minimum))
    throw new PhaseBidPromiseError('This bid conflicts with your Truthtrance No answer for this Bidding phase.');
  return promises.map(promise => live.includes(promise) && promise.answer && amount >= promise.minimum
    ? { ...promise, fulfilled: true } : promise);
}

/** Reconcile only after the engine has supplied a complete set of truthful
 * post-action witnesses. Missing or uncomputed quotes are not impossibility.
 * A respondent may not voluntarily eliminate their last feasible Yes route;
 * another player's action can release only the Yes answers it makes impossible.
 * This is a conservative implementation policy, not a printed timing rule. */
export function reconcilePhaseBidPromises<T extends PhaseBidPromise>(promises: readonly T[], player: string,
  turn: number, opportunities: readonly PhaseBidOpportunity[], change: PhaseBidChange): T[] {
  if (!identifier(player) || !positive(turn) || !Array.isArray(opportunities) ||
    change !== 'voluntary' && change !== 'external')
    throw new PhaseBidPromiseError('Retain the complete native bid opportunities and cause.');
  for (const opportunity of opportunities) {
    checkedOpportunity(opportunity);
    if (opportunity.player !== player || opportunity.turn !== turn)
      throw new PhaseBidPromiseError('Bid opportunities must belong to the original respondent and turn.');
  }
  const live = livePhaseBidPromises(promises, player, turn);
  const impossible = live.filter(promise => promise.answer && !opportunities.some(opportunity => {
    const range = phaseBidAllowedRange(promises, opportunity);
    return range !== null && Math.max(range.minimum, promise.minimum) <= range.maximum;
  }));
  if (change === 'voluntary' && impossible.length)
    throw new PhaseBidPromiseError('This action would remove the last funded bid opportunity for your Truthtrance Yes answer.');
  return promises.map(promise => impossible.includes(promise) ? { ...promise, released: true } : promise);
}

/** Call at actual phase close, after own-action preflight. No is established
 * by the absence of a qualifying accepted bid; unfulfilled Yes is released. */
export function finishPhaseBidPhase<T extends PhaseBidPromise>(promises: readonly T[], player: string,
  turn: number, change: PhaseBidChange): T[] {
  if (!identifier(player) || !positive(turn) || change !== 'voluntary' && change !== 'external')
    throw new PhaseBidPromiseError('Retain the actual phase close and its cause.');
  const live = livePhaseBidPromises(promises, player, turn);
  if (change === 'voluntary' && live.some(promise => promise.answer))
    throw new PhaseBidPromiseError('The Bidding phase cannot be closed by abandoning your Truthtrance Yes answer.');
  return promises.map(promise => live.includes(promise)
    ? promise.answer ? { ...promise, released: true } : { ...promise, fulfilled: true }
    : promise);
}

export function validatePhaseBidPromises(promises: readonly PhaseBidPromise[], players: readonly string[]): void {
  if (!Array.isArray(promises) || !Array.isArray(players))
    throw new PhaseBidPromiseError('The phase bid commitment record is invalid.');
  const events = new Set<string>();
  for (const promise of promises) {
    parsePhaseBidClaim(promise);
    if (!identifier(promise.event) || events.has(promise.event) || !players.includes(promise.player) ||
      !players.includes(promise.asker) || promise.player === promise.asker || typeof promise.answer !== 'boolean' ||
      (promise.fulfilled !== undefined && typeof promise.fulfilled !== 'boolean') ||
      (promise.released !== undefined && typeof promise.released !== 'boolean') ||
      promise.fulfilled && promise.released)
      throw new PhaseBidPromiseError('The phase bid commitment lost its original event or participants.');
    events.add(promise.event);
  }
}
