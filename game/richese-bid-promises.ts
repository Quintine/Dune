/** One future declaration in the exact public Richese Once Around lot.
 * The engine owns native eligibility, timing, hand capacity and funding. */
export type RicheseBidClaim = { turn: number; event: string; minimum: number };
export type RicheseBidPromise = RicheseBidClaim & {
  id: string;
  player: string;
  asker: string;
  answer: boolean;
  fulfilled?: boolean;
  released?: boolean;
};
export type RicheseBidContext = { turn: number; event: string; player: string };
/** Inclusive actual funded interval supplied by the engine; never a forecast of
 * another player's bid or a replacement for the native quote. */
export type RicheseBidOpportunity = RicheseBidContext & { minimum: number; maximum: number };
export type RicheseBidRange = { minimum: number; maximum: number };
export type RicheseBidChange = 'voluntary' | 'external';
export class RicheseBidPromiseError extends Error {}

const positive = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
const identifier = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value === value.trim();

export function parseRicheseBidClaim(value: unknown): RicheseBidClaim {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new RicheseBidPromiseError('Choose a current Once Around bid question.');
  const input = value as Record<string, unknown>;
  if (!positive(input.turn) || !identifier(input.event) || !positive(input.minimum))
    throw new RicheseBidPromiseError('Choose the current turn, auction event and a positive whole bid minimum.');
  return { turn: input.turn, event: input.event, minimum: input.minimum };
}

export function richeseBidClaimText(claim: RicheseBidClaim): string {
  return `place a bid of at least ${claim.minimum} spice in this Once Around auction`;
}

function checkContext(context: RicheseBidContext): void {
  if (!context || !positive(context.turn) || !identifier(context.event) || !identifier(context.player))
    throw new RicheseBidPromiseError('Retain the original turn, auction event and bidder.');
}
function checkOpportunity(opportunity: RicheseBidOpportunity): void {
  checkContext(opportunity);
  if (!positive(opportunity.minimum) || !positive(opportunity.maximum) || opportunity.minimum > opportunity.maximum)
    throw new RicheseBidPromiseError('Retain an actual funded Once Around bid interval.');
}
function sameContext(a: RicheseBidContext, b: RicheseBidContext): boolean {
  return a.turn === b.turn && a.event === b.event && a.player === b.player;
}

export function liveRicheseBidPromises(promises: readonly RicheseBidPromise[], context: RicheseBidContext): RicheseBidPromise[] {
  checkContext(context);
  return promises.filter(row => sameContext(row, context) && !row.fulfilled && !row.released);
}

/** Yes requires a bid; No alone permits passing. Each No limits any bid. */
export function richeseBidAllowedRange(promises: readonly RicheseBidPromise[], opportunity: RicheseBidOpportunity): RicheseBidRange | null {
  checkOpportunity(opportunity);
  let maximum = opportunity.maximum;
  for (const row of liveRicheseBidPromises(promises, opportunity))
    if (!row.answer) maximum = Math.min(maximum, row.minimum - 1);
  return opportunity.minimum <= maximum ? { minimum: opportunity.minimum, maximum } : null;
}
export function richeseBidCompletionRange(promises: readonly RicheseBidPromise[], opportunity: RicheseBidOpportunity): RicheseBidRange | null {
  const allowed = richeseBidAllowedRange(promises, opportunity);
  if (!allowed) return null;
  let minimum = allowed.minimum;
  for (const row of liveRicheseBidPromises(promises, opportunity))
    if (row.answer) minimum = Math.max(minimum, row.minimum);
  return minimum <= allowed.maximum ? { minimum, maximum: allowed.maximum } : null;
}
export function richeseBidRequired(promises: readonly RicheseBidPromise[], context: RicheseBidContext): boolean {
  return liveRicheseBidPromises(promises, context).some(row => row.answer);
}

/** Call inside the detached engine transaction immediately before its native
 * bid/pass validation. A Once Around actor receives one declaration only; a
 * small bid cannot rely on a later turn. The native action owns the actual
 * bid amount, funding, eligibility, hand space and event validity. */
export function recordRicheseBid<T extends RicheseBidPromise>(promises: readonly T[], context: RicheseBidContext,
  amount: number | null): T[] {
  checkContext(context);
  if (amount !== null && !positive(amount))
    throw new RicheseBidPromiseError('Record only a positive bid or a pass.');
  const live = liveRicheseBidPromises(promises, context);
  if (live.some(row => row.answer && (amount === null || amount < row.minimum)))
    throw new RicheseBidPromiseError('Honor your Truthtrance Yes before passing or bidding less.');
  if (amount !== null && live.some(row => !row.answer && amount >= row.minimum))
    throw new RicheseBidPromiseError('This bid conflicts with your Truthtrance No answer.');
  return promises.map(row => live.includes(row) ? { ...row, fulfilled: true } : row);
}

/** Supply null only after the engine has determined there is no native
 * opportunity. External events release individually impossible Yes answers;
 * the respondent cannot voluntarily make their own Yes impossible. */
export function reconcileRicheseBidPromises<T extends RicheseBidPromise>(promises: readonly T[],
  context: RicheseBidContext, opportunity: RicheseBidOpportunity | null, change: RicheseBidChange): T[] {
  checkContext(context);
  if (change !== 'voluntary' && change !== 'external')
    throw new RicheseBidPromiseError('Retain the cause of the auction change.');
  if (opportunity) {
    checkOpportunity(opportunity);
    if (!sameContext(context, opportunity))
      throw new RicheseBidPromiseError('The bid opportunity belongs to a different auction or bidder.');
  }
  const live = liveRicheseBidPromises(promises, context);
  const range = opportunity ? richeseBidAllowedRange(promises, opportunity) : null;
  const impossible = live.filter(row => row.answer && (!range || row.minimum > range.maximum));
  if (impossible.length && change === 'voluntary')
    throw new RicheseBidPromiseError('This action would remove your last funded Once Around bid opportunity.');
  return promises.map(row => impossible.includes(row) ? { ...row, released: true } : row);
}

/** Close only the original lot; outstanding No is established and an
 * unfulfilled Yes is released only on an external or already-forced close. */
export function finishRicheseBidLot<T extends RicheseBidPromise>(promises: readonly T[], context: RicheseBidContext,
  change: RicheseBidChange): T[] {
  checkContext(context);
  if (change !== 'voluntary' && change !== 'external')
    throw new RicheseBidPromiseError('Retain the cause of the auction close.');
  const live = liveRicheseBidPromises(promises, context);
  if (change === 'voluntary' && live.some(row => row.answer))
    throw new RicheseBidPromiseError('Do not close the auction by abandoning your Truthtrance Yes.');
  return promises.map(row => live.includes(row)
    ? row.answer ? { ...row, released: true } : { ...row, fulfilled: true } : row);
}

/** The public lot event is intentionally shared by multiple questions. */
export function validateRicheseBidPromises(promises: readonly RicheseBidPromise[], players: readonly string[]): void {
  if (!Array.isArray(promises) || !Array.isArray(players))
    throw new RicheseBidPromiseError('The Once Around bid commitment record is invalid.');
  const receipts = new Set<string>();
  for (const row of promises) {
    parseRicheseBidClaim(row);
    if (!identifier(row.id) || receipts.has(row.id) || !identifier(row.player) || !identifier(row.asker) || !players.includes(row.player) ||
      !players.includes(row.asker) || row.player === row.asker || typeof row.answer !== 'boolean' ||
      (row.fulfilled !== undefined && typeof row.fulfilled !== 'boolean') ||
      (row.released !== undefined && typeof row.released !== 'boolean') || row.fulfilled && row.released)
      throw new RicheseBidPromiseError('The Once Around commitment lost its receipt, original lot or participants.');
    receipts.add(row.id);
  }
}
