/** Public pre-question opportunity for groups of simultaneous Truth cards.
 * The engine owns the physical Sapho and each queued Truth card. */
export type SaphoTruthOrderFrame = {
  event: string;
  revision: number;
  holders: string[];
  passed: string[];
  /** Earlier Sapho choices remain in their declared boundary positions. */
  protectedFirst?: string;
  protectedLast?: string;
};

export type SaphoTruthOrderEntry = { player: string };
export type SaphoTruthOrderMode = 'first' | 'last';
export type SaphoTruthOrderRequest = { event: string; revision: number; player: string };
export type SaphoTruthOrderResult<T extends SaphoTruthOrderEntry> = {
  frame: SaphoTruthOrderFrame;
  queue: T[];
  done: boolean;
};

export class SaphoTruthOrderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SaphoTruthOrderError';
  }
}

function check(value: unknown, message: string): asserts value {
  if (!value) throw new SaphoTruthOrderError(message);
}
const identifier = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.trim() === value;
const uniqueIdentifiers = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(identifier) && new Set(value).size === value.length;

/** The queue is already sorted by the real Truth priority rule. Each holder's
 * physical cards must remain one contiguous group throughout this window. */
function holders<T extends SaphoTruthOrderEntry>(queue: readonly T[]): string[] {
  check(Array.isArray(queue) && queue.every(row => row && identifier(row.player)),
    'Retain the original queued Truth holders.');
  const result: string[] = [];
  for (const row of queue) {
    if (result.at(-1) === row.player) continue;
    check(!result.includes(row.player), 'A holder’s simultaneous Truth cards must remain together.');
    result.push(row.player);
  }
  return result;
}

/** Creates a frame solely from public committed holders, not any hand or card
 * contents. No added response stage is needed for fewer than two holders. */
export function createSaphoTruthOrder<T extends SaphoTruthOrderEntry>(
  queue: readonly T[], event: string,
): SaphoTruthOrderFrame | null {
  check(identifier(event), 'The Truth ordering window needs an opaque event.');
  const originalHolders = holders(queue);
  return originalHolders.length < 2 ? null : { event, revision: 0, holders: originalHolders, passed: [] };
}

export function validateSaphoTruthOrder<T extends SaphoTruthOrderEntry>(
  frame: SaphoTruthOrderFrame, queue: readonly T[],
): void {
  check(frame && typeof frame === 'object' && identifier(frame.event) &&
    Number.isSafeInteger(frame.revision) && frame.revision >= 0,
  'Retain the current Truth ordering event and revision.');
  check(uniqueIdentifiers(frame.holders) && frame.holders.length >= 2 && uniqueIdentifiers(frame.passed) &&
    frame.passed.every(player => frame.holders.includes(player)),
  'Retain the original holders and their completed ordering responses.');
  const current = holders(queue);
  check(current.length === frame.holders.length && current.every(player => frame.holders.includes(player)),
    'Retain every original Truth holder in this ordering window.');
  check(frame.revision === frame.passed.length,
    'Retain one ordering revision for each completed holder response.');
  check(frame.protectedFirst === undefined || identifier(frame.protectedFirst) &&
    frame.passed.includes(frame.protectedFirst) && current[0] === frame.protectedFirst,
  'Retain the holder protected at the first Truth position.');
  check(frame.protectedLast === undefined || identifier(frame.protectedLast) &&
    frame.passed.includes(frame.protectedLast) && current.at(-1) === frame.protectedLast,
  'Retain the holder protected at the last Truth position.');
}

function participant<T extends SaphoTruthOrderEntry>(
  frame: SaphoTruthOrderFrame, queue: readonly T[], request: SaphoTruthOrderRequest,
): string[] {
  validateSaphoTruthOrder(frame, queue);
  check(request && request.event === frame.event && request.revision === frame.revision,
    'This Truth ordering opportunity has expired.');
  check(identifier(request.player) && frame.holders.includes(request.player),
    'Only an original Truth holder may respond to this ordering window.');
  check(!frame.passed.includes(request.player), 'This holder already completed the ordering opportunity.');
  return holders(queue);
}

export function quoteSaphoTruthOrder<T extends SaphoTruthOrderEntry>(
  frame: SaphoTruthOrderFrame, queue: readonly T[], player: string,
): { event: string; revision: number; modes: SaphoTruthOrderMode[] } {
  validateSaphoTruthOrder(frame, queue);
  const {event,revision} = frame, current = participant(frame, queue, { event, revision, player });
  const modes: SaphoTruthOrderMode[] = [];
  if (current[0] !== player && !frame.protectedFirst && frame.protectedLast !== player) modes.push('first');
  if (current.at(-1) !== player && !frame.protectedLast && frame.protectedFirst !== player) modes.push('last');
  return { event, revision, modes };
}

function complete<T extends SaphoTruthOrderEntry>(
  frame: SaphoTruthOrderFrame, queue: readonly T[], player: string,
): SaphoTruthOrderResult<T> {
  check(frame.revision < Number.MAX_SAFE_INTEGER, 'The Truth ordering revision cannot advance safely.');
  const next = { ...frame, revision: frame.revision + 1, holders: [...frame.holders], passed: [...frame.passed, player] };
  return { frame: next, queue: [...queue], done: next.passed.length === next.holders.length };
}

/** Passing is available to every original holder, independently of cards held. */
export function passSaphoTruthOrder<T extends SaphoTruthOrderEntry>(
  frame: SaphoTruthOrderFrame, queue: readonly T[], request: SaphoTruthOrderRequest,
): SaphoTruthOrderResult<T> {
  participant(frame, queue, request);
  return complete(frame, queue, request.player);
}

/** Move the entire holder group; never sort or alter the physical card rows. */
export function reorderSaphoTruthOrder<T extends SaphoTruthOrderEntry>(
  frame: SaphoTruthOrderFrame, queue: readonly T[], request: SaphoTruthOrderRequest & { mode: SaphoTruthOrderMode },
): SaphoTruthOrderResult<T> {
  const current = participant(frame, queue, request);
  check(request.mode === 'first' || request.mode === 'last', 'Choose first or last.');
  check(request.mode === 'first' ? current[0] !== request.player : current.at(-1) !== request.player,
    'The holder already occupies that Truth position.');
  check(request.mode === 'first' ? !frame.protectedFirst && frame.protectedLast !== request.player
    : !frame.protectedLast && frame.protectedFirst !== request.player,
  'An earlier Juice of Sapho use protects that Truth position.');
  const own = queue.filter(row => row.player === request.player), rest = queue.filter(row => row.player !== request.player);
  const result = complete(frame, request.mode === 'first' ? [...own, ...rest] : [...rest, ...own], request.player);
  if (request.mode === 'first') result.frame.protectedFirst = request.player;
  else result.frame.protectedLast = request.player;
  return result;
}
