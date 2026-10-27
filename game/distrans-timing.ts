import type { RicheseAuction } from './richese-auction';

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
  richeseAuction?: RicheseAuction | null;
  richeseFunding?: Record<string, unknown> | null;
  currentAuctionSale?: unknown;
};

/** The printed card excludes use during a bid. Provisionally, an ordinary
 * lot has not begun bidding until its first bid or pass. Inspection and
 * opening the physical lot do not start that bid or change the dealt pool.
 * An untouched Richese lot likewise has no bid yet.
 * Once any bidder acts, even a pass or a zero sealed bid, it is closed. */
export function distransAuctionBlock(g: DistransAuctionContext): string | null {
  if (g.currentAuctionSale || (!g.auction && !g.richeseAuction)) return null;
  const special = g.richeseAuction;
  if (g.phase === 3 && !g.auction && special &&
    (special.method === 'onceAround' || special.method === 'silent' || special.method === 'normal') &&
    (special.source === 'cache' || special.source === 'blackMarket') &&
    (special.source !== 'cache' || special.method !== 'normal') &&
    typeof special.event === 'string' && special.event.length > 0 &&
    typeof special.cardId === 'string' && special.cardId.length > 0 &&
    typeof special.owner === 'string' && special.owner.length > 0 &&
    special.outcome === null && special.bid === 0 && special.bidder === null &&
    Array.isArray(special.eligible) && special.eligible.length > 0 &&
    special.eligible.every(id => typeof id === 'string' && id.length > 0) &&
    new Set(special.eligible).size === special.eligible.length &&
    Array.isArray(special.order) && special.order.length === special.eligible.length &&
    new Set(special.order).size === special.order.length &&
    special.order.every(id => special.eligible.includes(id)) &&
    Array.isArray(special.tieOrder) && special.tieOrder.length === special.eligible.length &&
    new Set(special.tieOrder).size === special.tieOrder.length &&
    special.tieOrder.every(id => special.eligible.includes(id)) &&
    (special.method === 'silent' ? special.active === null : special.active === special.order[0]) &&
    (special.method !== 'onceAround' || special.order.some(id => id !== special.owner)) &&
    Array.isArray(special.acted) && special.acted.length === 0 &&
    Array.isArray(special.passed) && special.passed.length === 0 &&
    special.sealed && typeof special.sealed === 'object' && !Array.isArray(special.sealed) &&
    Object.keys(special.sealed).length === 0 &&
    (!g.richeseFunding || (typeof g.richeseFunding === 'object' && !Array.isArray(g.richeseFunding) &&
      Object.keys(g.richeseFunding).length === 0))) return null;
  const lot = g.auction;
  if (
    g.phase === 3 && !g.richeseAuction && lot &&
    Number.isSafeInteger(lot.index) && lot.index >= 0 &&
    lot.index < lot.cards.length && !!lot.cards[lot.index] &&
    lot.bid === 0 && lot.bidder === null && lot.passed.length === 0 &&
    (lot.allyPayment ?? 0) === 0
  ) return null;
  return 'Distrans is unavailable after bidding starts on this lot. Finish its auction first; other special-auction timing remains guarded.';
}
