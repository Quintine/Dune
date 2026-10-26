export const AUCTION_BID_MS = 10_000;

export type AuctionClock = {
  event: string;
  source: string;
  player: string;
  /** Budget remaining at startedAt, or the frozen budget while suspended. */
  remainingMs: number;
  startedAt: number | null;
  controlEpoch: string;
};

export type AuctionClockView = {
  /** Null is reserved for a never-armed projection built by the caller. */
  event: string | null;
  player: string;
  remainingMs: number;
  running: boolean;
};

export class AuctionClockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuctionClockError';
  }
}

function check(value: unknown, message: string): asserts value {
  if (!value) throw new AuctionClockError(message);
}
function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
const identifier = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value === value.trim();
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const keys = (value: Record<string, unknown>, expected: string): boolean =>
  Object.keys(value).sort().join(',') === expected;

function validateClock(value: unknown): asserts value is AuctionClock {
  check(object(value) && keys(value, 'controlEpoch,event,player,remainingMs,source,startedAt') &&
    identifier(value.event) && identifier(value.source) && identifier(value.player) && identifier(value.controlEpoch) &&
    finite(value.remainingMs) && value.remainingMs >= 0 && value.remainingMs <= AUCTION_BID_MS &&
    (value.startedAt === null || finite(value.startedAt)),
  'Retain the complete original ordinary-auction clock, finite budget and control epoch.');
}

function remaining(clock: AuctionClock, now: number): number {
  if (clock.startedAt === null) return clock.remainingMs;
  // A wall-clock rollback cannot consume time or enlarge the retained budget.
  const elapsed = Math.max(0, now - clock.startedAt);
  return Math.max(0, clock.remainingMs - elapsed);
}

/** Pure quotation. Source/event/epoch and the current time come from the
 * integrating engine/store; no timer, random value or I/O is created here. */
export function quoteAuctionClock(input: {
  clock?: AuctionClock;
  opportunity: { source: string; player: string } | null;
  now: number;
  blocked: boolean;
  controlEpoch: string;
  event: string;
}): { clock: AuctionClock | undefined; expired: boolean; delayMs: number | null } {
  check(object(input) && (keys(input, 'blocked,controlEpoch,event,now,opportunity') ||
    keys(input, 'blocked,clock,controlEpoch,event,now,opportunity')) && finite(input.now) &&
    typeof input.blocked === 'boolean' && identifier(input.controlEpoch) && identifier(input.event),
  'Supply the exact ordinary-auction opportunity, finite time, blocker and control epoch.');
  if (input.clock !== undefined) validateClock(input.clock);
  check(input.opportunity === null || object(input.opportunity) && keys(input.opportunity, 'player,source') &&
    identifier(input.opportunity.source) && identifier(input.opportunity.player),
  'Choose the original ordinary-auction source and current bidder, or no opportunity.');
  if (input.opportunity === null) return { clock: undefined, expired: false, delayMs: null };

  const { opportunity, now, blocked, controlEpoch } = input;
  const previous = input.clock;
  let clock: AuctionClock = !previous || previous.source !== opportunity.source || previous.player !== opportunity.player ||
    previous.controlEpoch !== controlEpoch ? {
      event: input.event, source: opportunity.source, player: opportunity.player,
      remainingMs: AUCTION_BID_MS, startedAt: blocked ? null : now, controlEpoch,
    } : previous;
  const budget = remaining(clock, now);
  if (blocked) {
    if (clock.startedAt !== null) clock = { ...clock, remainingMs: budget, startedAt: null };
    return { clock, expired: false, delayMs: null };
  }
  if (budget === 0) {
    if (clock.remainingMs !== 0 || clock.startedAt !== null) clock = { ...clock, remainingMs: 0, startedAt: null };
    return { clock, expired: true, delayMs: null };
  }
  if (clock.startedAt === null) clock = { ...clock, startedAt: now };
  return { clock, expired: false, delayMs: budget };
}

/** Suspended/expired frames retain their original event for the client. */
export function viewAuctionClock(clock: AuctionClock, now: number): AuctionClockView {
  validateClock(clock);
  check(finite(now), 'Project the ordinary-auction clock at a finite time.');
  const remainingMs = remaining(clock, now);
  return { event: clock.event, player: clock.player, remainingMs,
    running: clock.startedAt !== null && remainingMs > 0 };
}
