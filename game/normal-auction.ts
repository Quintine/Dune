export type NormalAuctionNext =
  | { kind: 'unbid' }
  | { kind: 'payment'; player: string }
  | { kind: 'bid'; player: string };

export type NormalAuctionBid =
  | { ok: true; amount: number }
  | { ok: false; reason: string };

/**
 * Quote the next ordinary auction step. The engine owns card custody, payment,
 * phase progression and the hand-limit eligibility calculation.
 */
export function quoteNormalAuctionNext(context: {
  order: readonly string[];
  eligible: readonly string[];
  active: string;
  bid: number;
  bidder: string | null;
  passed: readonly string[];
}): NormalAuctionNext {
  const eligible = new Set(context.eligible);
  const others = context.eligible.filter((id) => id !== context.bidder);
  if (others.every((id) => context.passed.includes(id)))
    return context.bidder
      ? { kind: 'payment', player: context.bidder }
      : { kind: 'unbid' };

  const activeIndex = context.order.indexOf(context.active);
  for (let offset = 1; offset <= context.order.length; offset++) {
    const index = (Math.max(activeIndex, -1) + offset) % context.order.length;
    const player = context.order[index];
    if (eligible.has(player) && player !== context.bidder)
      return { kind: 'bid', player };
  }

  // A malformed restored state must fail closed instead of spinning forever or
  // fabricating an auction outcome.
  throw new Error(
    'Ordinary auction has no eligible next bidder in table order.',
  );
}

/** The engine supplies the freshly calculated funding maximum. */
export function quoteNormalAuctionBid(context: {
  currentBid: number;
  amount: unknown;
  maximum: number;
}): NormalAuctionBid {
  const minimum = context.currentBid + 1;
  if (
    typeof context.amount !== 'number' ||
    !Number.isSafeInteger(context.amount) ||
    context.amount < minimum ||
    context.amount > context.maximum
  )
    return {
      ok: false,
      reason: `Bid must be an integer from ${minimum} to ${context.maximum}.`,
    };
  return { ok: true, amount: context.amount };
}
