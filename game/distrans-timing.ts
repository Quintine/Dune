type DistransAuctionContext = {
  phase: number;
  auction: {
    cards: readonly unknown[];
    index: number;
    bid: number;
    bidder: string | null;
    passed: readonly string[];
    allyPayment?: number;
  } | null;
  richeseAuction?: unknown;
  currentAuctionSale?: unknown;
};

/** The printed card excludes use during a bid. Provisionally, an ordinary
 * lot has not begun bidding until its first bid or pass. Inspection and
 * opening the physical lot do not start that bid or change the dealt pool.
 * Other unpaid auctions retain their separate timing boundary. */
export function distransAuctionBlock(g: DistransAuctionContext): string | null {
  if (g.currentAuctionSale || (!g.auction && !g.richeseAuction)) return null;
  const lot = g.auction;
  if (
    g.phase === 3 && !g.richeseAuction && lot &&
    Number.isSafeInteger(lot.index) && lot.index >= 0 &&
    lot.index < lot.cards.length && !!lot.cards[lot.index] &&
    lot.bid === 0 && lot.bidder === null && lot.passed.length === 0 &&
    (lot.allyPayment ?? 0) === 0
  ) return null;
  return 'Distrans is unavailable after bidding starts on this lot. Finish its auction first; special-auction timing remains guarded.';
}
