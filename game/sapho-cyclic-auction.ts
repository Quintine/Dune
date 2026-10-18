export type SaphoCyclicAuctionContext = {
  event: string;
  order: readonly string[];
  eligible: readonly string[];
  active: string;
  bidder: string | null;
  passed: readonly string[];
};
export type SaphoCyclicAuctionRequest = {
  event: string;
  player: string;
  mode: 'first' | 'last';
};
export class SaphoCyclicAuctionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SaphoCyclicAuctionError';
  }
}
function requireAuction(value: unknown, message: string): asserts value {
  if (!value) throw new SaphoCyclicAuctionError(message);
}
const identifier = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;
const ids = (value: unknown): value is readonly string[] =>
  Array.isArray(value) && value.every(identifier) && new Set(value).size === value.length;
function rotate(order: readonly string[], first: string): string[] {
  const at = order.indexOf(first);
  return [...order.slice(at), ...order.slice(0, at)];
}

/** Current-lot/next-opportunity composition, not a publisher timing ruling.
 * Keep the complete local cycle: a passed, full-hand or high-bid placeholder
 * may matter after a later raise. Eligibility and card custody belong to the
 * engine; this quote changes neither bids nor the physical storm-order opener. */
export function reorderSaphoCyclicAuction(
  context: SaphoCyclicAuctionContext,
  request: SaphoCyclicAuctionRequest,
): { order: string[]; active: string } {
  requireAuction(context && typeof context === 'object', 'Choose a valid current auction lot.');
  requireAuction(identifier(context.event), 'The auction requires its current lot event.');
  requireAuction(
    ids(context.order) && context.order.length > 0 && ids(context.eligible) && ids(context.passed) &&
      context.eligible.every(player => context.order.includes(player)) &&
      context.passed.every(player => context.order.includes(player)) &&
      (context.bidder === null || identifier(context.bidder) && context.order.includes(context.bidder)) &&
      (context.bidder === null || !context.passed.includes(context.bidder)),
    'Auction order, eligible seats, passes and high bidder must form a valid unique lot roster.',
  );
  const pending = (player: string) => context.eligible.includes(player) &&
    !context.passed.includes(player) && player !== context.bidder;
  requireAuction(
    identifier(context.active) && pending(context.active),
    'The current auction actor must have a pending eligible bid opportunity.',
  );
  requireAuction(
    request && typeof request === 'object' && request.event === context.event,
    'This auction lot event has expired.',
  );
  requireAuction(request.mode === 'first' || request.mode === 'last', 'Choose first or last.');
  requireAuction(
    identifier(request.player) && pending(request.player),
    'Only an eligible unpassed player other than the current high bidder can change position.',
  );
  const original = rotate(context.order, context.active);
  const others = original.filter(player => player !== request.player);
  const order = request.mode === 'first' ? [request.player, ...others] : [...others, request.player];
  const active = order.find(pending)!;
  // Compare complete effective cycles, including their next active actor.
  // Merely rotating a single pending actor around skipped placeholders is a
  // no-op, while moving behind a placeholder that can reenter is meaningful.
  requireAuction(
    JSON.stringify(original) !== JSON.stringify(rotate(order, active)),
    'This player is already in that effective auction position.',
  );
  return { order, active };
}
