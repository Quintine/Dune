import type { AuctionContinuationInput, AuctionContinuationQuote } from './auction-continuation-quote';

export type NormalAuctionRetirementInput = Pick<AuctionContinuationInput,
  'turn' | 'advanced' | 'players' | 'order' | 'auction' | 'richeseBidding' |
  'richeseCacheCount' | 'ixTechnologyTurn' | 'physicalCards'>;
export type NormalAuctionRetirementQuote = Extract<AuctionContinuationQuote['next'],
  { kind: 'normalLot' | 'normalEnd' }>;

export class NormalAuctionRetirementError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NormalAuctionRetirementError';
  }
}
function requireRetirement(value: unknown, message: string): asserts value {
  if (!value) throw new NormalAuctionRetirementError(message);
}
const text = (value: unknown): value is string => typeof value === 'string' && value.length > 0;
const count = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
const ids = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(text) && new Set(value).size === value.length;
const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

/** Retire one original ordinary lot, bought or unbought. No winner, sale,
 * payment, hand delivery or faction income is manufactured by this quote. */
export function quoteNormalAuctionRetirement(input: NormalAuctionRetirementInput): NormalAuctionRetirementQuote {
  try {
    return calculate(input);
  } catch (error) {
    if (error instanceof NormalAuctionRetirementError) throw error;
    throw new NormalAuctionRetirementError(error instanceof Error ? error.message : 'Malformed normal auction retirement.');
  }
}
function calculate(input: NormalAuctionRetirementInput): NormalAuctionRetirementQuote {
  requireRetirement(count(input.turn) && input.turn > 0 && typeof input.advanced === 'boolean',
    'Normal auction retirement needs its current turn and rules mode.');
  requireRetirement(Array.isArray(input.players) && ids(input.players.map(player => player.id)) &&
    input.players.every(player => Array.isArray(player.hand) &&
      player.hand.every((card: unknown) => object(card) && text(card.id)) &&
      count(player.handLimit) && player.handLimit > 0),
    'Auction seats or hand counts are malformed.');
  const seated = (id: string) => input.players.find(player => player.id === id);
  requireRetirement(ids(input.order) && input.order.length > 0 && input.order.every(id => seated(id)),
    'The auction needs a nonempty unique seated order.');
  const a = input.auction;
  requireRetirement(a && Array.isArray(a.cards) && count(a.index) && a.index < a.cards.length &&
    a.cards.every(card => object(card) && text(card.id) && text(card.name) && text(card.kind)),
    'The normal auction has an invalid current card or index.');
  requireRetirement(count(a.opener) && a.opener < input.order.length && input.order.includes(a.active) &&
    ids(a.passed) && a.passed.every(id => input.order.includes(id)) && count(a.bid) &&
    (a.allyPayment === undefined || count(a.allyPayment) && a.allyPayment <= a.bid) &&
    (a.bidder === null ? a.bid === 0 : input.order.includes(a.bidder)),
    'The normal auction has an invalid opener, bidder or bid context.');
  // Earlier sold entries are historical aliases. Only the remaining pool must
  // be unique, including against the original lot that is being retired.
  const unsold = a.cards.slice(a.index + 1).map(card => card.id);
  requireRetirement(ids(unsold) && !unsold.includes(a.cards[a.index].id),
    'The unsold auction pool duplicates its current physical card.');
  requireRetirement(Array.isArray(input.physicalCards) && unsold.every(id =>
    input.physicalCards.filter(card => card?.id === id).length === 1),
    'The unsold auction pool needs unique physical card custody.');
  const round = input.richeseBidding;
  if (round) requireRetirement(round.turn === input.turn && round.stage === 'normal' &&
    seated(round.owner)?.faction === 'richese' && ['first', 'last', null].includes(round.position) &&
    typeof round.cacheCanceled === 'boolean',
    'The normal pool has a stale Richese round.');

  const index = a.index + 1;
  const able = input.order.filter(id => {
    const player = seated(id)!;
    return player.hand.length < player.handLimit;
  });
  if (index === a.cards.length || !able.length) {
    const activeRound = round?.turn === input.turn && round.stage === 'normal';
    // User ruling 7 October 2026: a last cache lot needs physical cache stock
    // and an uncanceled compulsory auction.
    const cacheLast = !!activeRound && round.position === 'last' && !round.cacheCanceled &&
      (input.richeseCacheCount ?? 0) > 0;
    return {
      kind: 'normalEnd', returned: structuredClone(a.cards.slice(index)),
      after: cacheLast ? 'richeseCache' : 'phase', completeRound: !!activeRound && !cacheLast,
    };
  }
  let opener = a.opener;
  do {
    opener = (opener + 1) % input.order.length;
  } while (!able.includes(input.order[opener]));
  const active = input.order[opener];
  const ix = input.players.find(player => player.faction === 'ixians');
  const atreides = input.players.find(player => player.faction === 'atreides');
  const offer = input.advanced && ix && ix.hand.length > 0 && input.ixTechnologyTurn !== input.turn
    ? { kind: 'ixTechnology' as const, player: ix.id }
    : atreides ? { kind: 'atreidesAuction' as const, owner: atreides.id, passed: [] } : null;
  const nextAuction = structuredClone(a);
  delete nextAuction.saphoOrder;
  return {
    kind: 'normalLot', auction: {
      ...nextAuction, index, bid: 0, allyPayment: 0, bidder: null,
      passed: [], opener, active, peekKnown: false,
    }, active, offer,
  };
}
