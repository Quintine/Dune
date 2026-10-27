import { nativePromiseScopeSupported, type NativePromiseScope } from './native-promise-scope';
import { bribePromiseModeSupported } from './bribe-promises';

export type BidClaim = { turn: number; lot: number; minimum: number };
export type BidPromise = BidClaim & {
  event: string;
  /** Internal physical-lot binding. Never project the unrevealed card identity. */
  source: string;
  player: string;
  asker: string;
  answer: boolean;
  fulfilled?: boolean;
  released?: boolean;
};
export type BidOpportunity = {
  turn: number; lot: number; source: string; bid: number;
  bidder: string | null; passed: readonly string[]; eligible: readonly string[];
};
export class BidPromiseError extends Error {}

export function parseBidClaim(value: unknown): BidClaim {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new BidPromiseError('Choose a current ordinary-auction bid question.');
  const input = value as Record<string, unknown>;
  for (const field of ['turn', 'lot', 'minimum'] as const)
    if (typeof input[field] !== 'number' || !Number.isSafeInteger(input[field]) || input[field] < 1)
      throw new BidPromiseError('Choose the current turn and lot, and a positive whole bid minimum.');
  return { turn: input.turn as number, lot: input.lot as number, minimum: input.minimum as number };
}

/** Original ordinary lots first; native special auctions and optional modules
 * retain their own required future commitment work. Never changes start gates. */
export function bidPromiseModeSupported(game: NativePromiseScope & {
  semutaPreview?: unknown; kullPreview?: unknown; nexusKullPreview?: unknown;
  richeseBetrayalPreview?: unknown; guildBetrayalPreview?: unknown;
  nexusIxianReplacementPreview?: unknown; nexusIxianBetrayalPreview?: unknown;
  nexusHarkonnenBetrayalPreview?: unknown; moritaniAssassinatePreview?: unknown;
  mobileStronghold?: unknown;
}): boolean {
  return nativePromiseScopeSupported(game) && !game.semutaPreview &&
    !game.nexusKullPreview && !game.richeseBetrayalPreview &&
    (!game.kullPreview || bribePromiseModeSupported(game));
}

export function bidClaimText(claim: BidClaim): string {
  return `place a bid of at least ${claim.minimum} spice from now until ordinary lot ${claim.lot} closes`;
}

export function liveBidPromises(promises: readonly BidPromise[], player: string, opportunity: BidOpportunity): BidPromise[] {
  return promises.filter(promise => promise.player === player && promise.turn === opportunity.turn &&
    promise.source === opportunity.source && !promise.released && !promise.fulfilled);
}

/** One future accepted declaration, not a total of bids or a purchase invoice. */
export function bidPromiseRange(promises: readonly BidPromise[], player: string,
  opportunity: BidOpportunity, maximum: number): { minimum: number; maximum: number } | null {
  if (!opportunity.eligible.includes(player) || opportunity.passed.includes(player) ||
    opportunity.bidder === player || !Number.isSafeInteger(maximum) || maximum < 1 ||
    !Number.isSafeInteger(opportunity.bid) || opportunity.bid < 0 || opportunity.bid === Number.MAX_SAFE_INTEGER)
    return null;
  let minimum = opportunity.bid + 1;
  for (const promise of liveBidPromises(promises, player, opportunity)) {
    if (promise.answer) minimum = Math.max(minimum, promise.minimum);
    else maximum = Math.min(maximum, promise.minimum - 1);
  }
  return minimum <= maximum ? { minimum, maximum } : null;
}

export function bidRequired(promises: readonly BidPromise[], player: string, opportunity: BidOpportunity): boolean {
  return liveBidPromises(promises, player, opportunity).some(promise => promise.answer);
}

/** Record before the native bid advances/settles its lot. Caller owns the
 * detached transaction, so a later native validation failure remains atomic. */
export function recordPromisedBid(promises: readonly BidPromise[], player: string,
  opportunity: BidOpportunity, amount: number): BidPromise[] {
  const live = liveBidPromises(promises, player, opportunity);
  if (live.some(promise => !promise.answer && amount >= promise.minimum))
    throw new BidPromiseError('This bid conflicts with your Truthtrance No answer for this lot.');
  return promises.map(promise => live.includes(promise) && promise.answer && amount >= promise.minimum
    ? { ...promise, fulfilled: true } : promise);
}

export function validateBidPromises(promises: readonly BidPromise[], players: readonly string[]): void {
  if (!Array.isArray(promises)) throw new BidPromiseError('The bid commitment record is invalid.');
  const events = new Set<string>();
  for (const promise of promises) {
    parseBidClaim(promise);
    if (typeof promise.event !== 'string' || !promise.event || events.has(promise.event) ||
      typeof promise.source !== 'string' || !promise.source || !players.includes(promise.player) ||
      !players.includes(promise.asker) || promise.player === promise.asker || typeof promise.answer !== 'boolean' ||
      (promise.fulfilled !== undefined && typeof promise.fulfilled !== 'boolean') ||
      (promise.released !== undefined && typeof promise.released !== 'boolean') ||
      promise.fulfilled && promise.released)
      throw new BidPromiseError('The bid commitment lost its original event, source or participants.');
    events.add(promise.event);
  }
}
