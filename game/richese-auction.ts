import { reorderOrderedOpportunity } from './ordered-opportunity';
/** Auction mechanics only. The engine owns cards, funding, reactions and phase timing. */
export type RicheseAuctionMethod = 'normal' | 'onceAround' | 'silent';
export type RicheseAuctionSource = 'cache' | 'blackMarket';
export type RicheseAuctionOutcome =
  | { kind: 'sold'; winner: string; amount: number }
  | { kind: 'unbid' };
export type RicheseAuction = {
  event: string;
  cardId: string;
  source: RicheseAuctionSource;
  owner: string;
  method: RicheseAuctionMethod;
  eligible: string[];
  order: string[];
  tieOrder: string[];
  active: string | null;
  bid: number;
  bidder: string | null;
  passed: string[];
  acted: string[];
  sealed: Record<string, number>;
  outcome: RicheseAuctionOutcome | null;
};
export type RicheseAuctionInput = Pick<
  RicheseAuction,
  'event' | 'cardId' | 'source' | 'owner' | 'method'
> & {
  eligible: readonly string[];
  /** Physical direction for Once Around, ordinary opener order for normal. */
  order: readonly string[];
  /** Storm order, independent of direction and the ordinary opener. */
  tieOrder: readonly string[];
};
export type RicheseBid = {
  event: string;
  actor: string;
  amount: number | null;
};
export type RicheseAuctionView = Omit<RicheseAuction, 'sealed' | 'cardId'> & {
  /** Black Market identity remains owner-only; the engine owns authorized inspection. */
  cardId: string | null;
  ownBid: number | null;
  submitted: string[];
  /** Simultaneous physical bids become public only after all have submitted. */
  revealedBids: Record<string, number> | null;
};

function requireAuction(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) throw new Error(message);
}
function uniqueIds(ids: readonly string[], name: string) {
  requireAuction(
    ids.every((id) => typeof id === 'string' && id.length > 0) &&
      new Set(ids).size === ids.length,
    `${name} must contain distinct player IDs.`,
  );
}
function finish(state: RicheseAuction) {
  state.active = null;
  state.outcome = state.bidder
    ? { kind: 'sold', winner: state.bidder, amount: state.bid }
    : { kind: 'unbid' };
}
function advanceOnce(state: RicheseAuction) {
  const remaining = state.order.filter((id) => !state.acted.includes(id));
  // A cache free/remove or Black Market retain choice belongs to the engine.
  if (
    !remaining.length ||
    (!state.bidder && remaining.every((id) => id === state.owner))
  )
    finish(state);
  else state.active = remaining[0];
}

export function createRicheseAuction(
  input: RicheseAuctionInput,
): RicheseAuction {
  requireAuction(
    typeof input.event === 'string' &&
      input.event.length > 0 &&
      typeof input.cardId === 'string' &&
      input.cardId.length > 0 &&
      typeof input.owner === 'string' &&
      input.owner.length > 0,
    'The auction needs an event, physical card and owner.',
  );
  requireAuction(
    ['normal', 'onceAround', 'silent'].includes(input.method),
    'Unknown auction method.',
  );
  requireAuction(
    ['cache', 'blackMarket'].includes(input.source),
    'Unknown auction source.',
  );
  requireAuction(
    input.source !== 'cache' || input.method !== 'normal',
    'A cache card requires a Once Around or Silent auction.',
  );
  uniqueIds(input.eligible, 'Eligibility');
  uniqueIds(input.order, 'Auction order');
  uniqueIds(input.tieOrder, 'Storm order');
  requireAuction(
    input.eligible.every(
      (id) => input.order.includes(id) && input.tieOrder.includes(id),
    ),
    'Every eligible player needs an auction and storm position.',
  );
  const order = input.order.filter((id) => input.eligible.includes(id));
  if (input.method === 'onceAround' && order.includes(input.owner)) {
    order.splice(order.indexOf(input.owner), 1);
    order.push(input.owner);
  }
  const state: RicheseAuction = {
    event: input.event,
    cardId: input.cardId,
    source: input.source,
    owner: input.owner,
    method: input.method,
    eligible: [...input.eligible],
    order,
    tieOrder: input.tieOrder.filter((id) => input.eligible.includes(id)),
    active: input.method === 'silent' ? null : (order[0] ?? null),
    bid: 0,
    bidder: null,
    passed: [],
    acted: [],
    sealed: {},
    outcome: null,
  };
  if (!order.length) finish(state);
  else if (state.method === 'onceAround') advanceOnce(state);
  return state;
}

/** Trusted maximum is supplied afresh by the engine, never read from a client bid. */
export function submitRicheseBid(
  previous: RicheseAuction,
  input: RicheseBid,
  maxFundedBid: number,
): RicheseAuction {
  requireAuction(
    input.event === previous.event,
    'This auction event has expired.',
  );
  requireAuction(!previous.outcome, 'This auction is already complete.');
  requireAuction(
    previous.eligible.includes(input.actor),
    'This player cannot bid on this lot.',
  );
  requireAuction(
    Number.isSafeInteger(maxFundedBid) && maxFundedBid >= 0,
    'The funded bid limit must be a nonnegative integer.',
  );
  if (previous.method === 'silent') {
    requireAuction(
      !Object.hasOwn(previous.sealed, input.actor),
      'This player already submitted a sealed bid.',
    );
    requireAuction(
      input.amount !== null,
      'Submit zero to decline a Silent auction.',
    );
  } else requireAuction(previous.active === input.actor, 'Wait for your bid.');
  if (input.amount !== null) {
    requireAuction(
      Number.isSafeInteger(input.amount) && input.amount >= 0,
      'Bid a nonnegative integer amount.',
    );
    requireAuction(
      input.amount <= maxFundedBid,
      'The bid exceeds its available funding.',
    );
    if (previous.method !== 'silent')
      requireAuction(
        input.amount > previous.bid,
        'Raise the highest bid or pass.',
      );
  }
  const state = structuredClone(previous);
  if (state.method === 'silent') {
    state.sealed = { ...state.sealed, [input.actor]: input.amount! };
    state.acted.push(input.actor);
    if (state.eligible.every((id) => Object.hasOwn(state.sealed, id))) {
      // Traversal in storm order makes equal offers keep the earliest player.
      for (const id of state.tieOrder) {
        if (state.sealed[id] > state.bid) {
          state.bid = state.sealed[id];
          state.bidder = id;
        }
      }
      finish(state);
    }
    return state;
  }
  if (input.amount === null) state.passed.push(input.actor);
  else {
    state.bid = input.amount;
    state.bidder = input.actor;
    if (state.method === 'normal') state.passed = [];
  }
  if (state.method === 'onceAround') {
    state.acted.push(input.actor);
    advanceOnce(state);
  } else if (
    state.eligible.every(
      (id) => id === state.bidder || state.passed.includes(id),
    )
  ) {
    finish(state);
  } else {
    const at = state.order.indexOf(input.actor);
    for (let distance = 1; distance <= state.order.length; distance++) {
      const next = state.order[(at + distance) % state.order.length];
      if (next !== state.bidder) {
        state.active = next;
        break;
      }
    }
  }
  return state;
}

/**
 * Internal card-effect hook. Engine validates card custody and printed timing.
 * Never restore owner-last here: a legal Juice of Sapho effect can override it.
 */
export function moveRicheseBidderLast(
  previous: RicheseAuction,
  event: string,
  player: string,
): RicheseAuction {
  return reorderRicheseBidder(previous, event, player, 'last');
}

/** A finite Once Around lot; completed bids and physical storm tie order persist. */
export function reorderRicheseBidder(
  previous: RicheseAuction,
  event: string,
  player: string,
  position: 'first' | 'last',
): RicheseAuction {
  requireAuction(event === previous.event, 'This auction event has expired.');
  requireAuction(
    !previous.outcome && previous.method === 'onceAround',
    'An open Once Around auction is required.',
  );
  requireAuction(
    previous.eligible.includes(player) && !previous.acted.includes(player),
    'Only an eligible player who has not bid can change position.',
  );
  const completed = previous.order.filter((id) => previous.acted.includes(id));
  const remaining = previous.order.filter((id) => !previous.acted.includes(id));
  const ordered = reorderOrderedOpportunity(
    {
      event: previous.event,
      eligible: previous.eligible,
      completed,
      remaining,
      current: previous.active,
      currentStarted: false,
    },
    { event, player, position },
  );
  const state = structuredClone(previous);
  // Keep completed positions as recorded; fill only the still-unacted slots.
  let at = 0;
  state.order = state.order.map((id) =>
    previous.acted.includes(id) ? id : ordered.remaining[at++],
  );
  advanceOnce(state);
  return state;
}

/** No opponent funding limits or sealed values leave the authoritative state. */
export function projectRicheseAuction(
  state: RicheseAuction,
  viewer: string,
): RicheseAuctionView {
  const { sealed, cardId, ...publicState } = structuredClone(state);
  return {
    ...publicState,
    cardId: state.source === 'cache' || viewer === state.owner ? cardId : null,
    ownBid: Object.hasOwn(sealed, viewer) ? sealed[viewer] : null,
    submitted: state.eligible.filter((id) => Object.hasOwn(sealed, id)),
    revealedBids: state.method === 'silent' && state.outcome ? sealed : null,
  };
}
