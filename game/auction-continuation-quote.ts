import type { Card } from './cards';
import type { FactionId } from './catalog';
import type { Game, ResponseWindow } from './engine';
import { requireRicheseDeclarationCache } from './richese-settlement';

export type AuctionContinuationSeat = {
  id: string;
  faction: FactionId;
  ally?: string | null;
  spice: number;
  hand: readonly { id: string }[];
  handLimit: number;
};
export type AuctionContinuationInput = {
  status: string;
  phase: number;
  turn: number;
  advanced: boolean;
  order: readonly string[];
  players: readonly AuctionContinuationSeat[];
  /** Live ownership zones; sold auction references are not custody. */
  physicalCards: readonly { id: string }[];
  auction: Game['auction'];
  sale?: Game['currentAuctionSale'];
  pendingIxAlly?: Game['pendingIxAlly'];
  ixTechnologyTurn?: number;
  richeseAuction?: Game['richeseAuction'];
  richeseBidding?: Game['richeseBidding'];
  richeseCacheCount?: number;
};
export type AuctionContinuationOperation =
  | { kind: 'sale'; free: boolean }
  | { kind: 'bonus' }
  | { kind: 'next' }
  | { kind: 'cancel'; response: ResponseWindow };
export type AuctionContinuationSpending = { player: string; card: string };
type Sale = NonNullable<Game['currentAuctionSale']> & { legacy: boolean };
type Response = {
  kind: 'emperorIncome' | 'harkonnenBonus';
  owner: string;
  passed: string[];
};
type LotOffer =
  | { kind: 'ixTechnology'; player: string }
  | { kind: 'atreidesAuction'; owner: string; passed: string[] }
  | null;
export type AuctionContinuationQuote = {
  sale: Sale;
  steps: (
    | { kind: 'sellerCredit'; player: string; amount: number; balance: number }
    | { kind: 'clearIxAlly' }
  )[];
  next:
    | { kind: 'response'; response: Response }
    | {
        kind: 'normalLot';
        auction: NonNullable<Game['auction']>;
        active: string;
        offer: LotOffer;
      }
    | {
        kind: 'normalEnd';
        returned: Card[];
        after: 'richeseCache' | 'phase';
        completeRound: boolean;
      }
    | {
        kind: 'richeseEnd';
        source: 'cache' | 'blackMarket';
        after: 'declaration' | 'normalPool' | 'phase';
        blackMarketSold?: true;
        opener?: number;
      };
};
export class AuctionContinuationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuctionContinuationError';
  }
}
function requireAuction(value: unknown, message: string): asserts value {
  if (!value) throw new AuctionContinuationError(message);
}
const text = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
const count = (v: unknown): v is number =>
  Number.isSafeInteger(v) && (v as number) >= 0;
const ids = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every(text) && new Set(v).size === v.length;
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);

/** Deterministic paid-sale continuation only. A returned response, Richese
 * transition or normal phase-end is a boundary, not a simulated future action.
 * Never publish this internal quote: returned lot cards remain private. */
export function quoteAuctionContinuation(
  input: AuctionContinuationInput,
  operation: AuctionContinuationOperation,
  spending?: AuctionContinuationSpending,
): AuctionContinuationQuote {
  try {
    return calculate(input, operation, spending);
  } catch (error) {
    if (error instanceof AuctionContinuationError) throw error;
    throw new AuctionContinuationError(
      error instanceof Error
        ? error.message
        : 'Malformed auction continuation.',
    );
  }
}
function calculate(
  input: AuctionContinuationInput,
  operation: AuctionContinuationOperation,
  spending?: AuctionContinuationSpending,
): AuctionContinuationQuote {
  requireAuction(
    input.status === 'playing' &&
      input.phase === 3 &&
      count(input.turn) &&
      input.turn > 0 &&
      typeof input.advanced === 'boolean',
    'Auction continuation needs the current Bidding Phase.',
  );
  requireAuction(
    Array.isArray(input.players) &&
      ids(input.players.map((p) => p.id)) &&
      input.players.every(
        (p) =>
          Array.isArray(p.hand) &&
          p.hand.every((c: unknown) => object(c) && text(c.id)) &&
          count(p.handLimit) &&
          p.handLimit > 0,
      ),
    'Auction seats or hand counts are malformed.',
  );
  const seated = (id: string) => input.players.find((p) => p.id === id);
  requireAuction(
    ids(input.order) &&
      input.order.length > 0 &&
      input.order.every((id) => seated(id)),
    'The auction needs a nonempty unique seated order.',
  );
  const normal =
    input.sale?.origin === 'normal' || (!input.sale && !input.richeseAuction);
  let cardId: string;
  let sale: Sale;
  if (normal) {
    const a = input.auction;
    requireAuction(
      a &&
        Array.isArray(a.cards) &&
        count(a.index) &&
        a.index < a.cards.length &&
        a.cards.every(
          (c) => object(c) && text(c.id) && text(c.name) && text(c.kind),
        ),
      'The normal auction has an invalid current card or index.',
    );
    requireAuction(
      count(a.opener) &&
        a.opener < input.order.length &&
        input.order.includes(a.active) &&
        ids(a.passed) &&
        a.passed.every((id) => input.order.includes(id)) &&
        count(a.bid) &&
        (a.allyPayment === undefined ||
          (count(a.allyPayment) && a.allyPayment <= a.bid)) &&
        a.bidder &&
        input.order.includes(a.bidder),
      'The normal auction has an invalid opener, bidder or bid context.',
    );
    cardId = a.cards[a.index].id;
    // Earlier sold entries are historical aliases. They may legitimately match
    // a later card returned by Ixian Technology; only unsold entries are a pool.
    const unsold = a.cards.slice(a.index + 1).map((c) => c.id);
    requireAuction(
      ids(unsold) && !unsold.includes(cardId),
      'The unsold auction pool duplicates its current physical card.',
    );
    requireAuction(
      Array.isArray(input.physicalCards) &&
        unsold.every(
          (id) => input.physicalCards.filter((c) => c?.id === id).length === 1,
        ),
      'The unsold auction pool needs unique physical card custody.',
    );
    if (input.sale) {
      requireAuction(
        input.sale.origin === 'normal' &&
          input.sale.seller === null &&
          input.sale.winner === a.bidder &&
          input.sale.amount === a.bid &&
          typeof input.sale.free === 'boolean',
        'The paid normal sale does not match its bidder and amount.',
      );
      sale = { ...input.sale, legacy: false };
    } else
      sale = {
        winner: a.bidder,
        amount: a.bid,
        free: operation.kind === 'sale' ? operation.free : false,
        origin: 'normal',
        seller: null,
        legacy: true,
      };
    requireAuction(
      !input.richeseAuction,
      'A normal sale cannot also be a live Richese lot.',
    );
    const round = input.richeseBidding;
    if (round)
      requireAuction(
        round.turn === input.turn &&
          round.stage === 'normal' &&
          seated(round.owner)?.faction === 'richese' &&
          ['first', 'last', null].includes(round.position) &&
          typeof round.cacheCanceled === 'boolean',
        'The normal pool has a stale Richese round.',
      );
  } else {
    const s = input.sale,
      lot = input.richeseAuction,
      round = input.richeseBidding;
    requireAuction(
      s &&
        ['cache', 'blackMarket'].includes(s.origin) &&
        s.free === false &&
        count(s.amount) &&
        seated(s.winner) &&
        s.seller &&
        seated(s.seller)?.faction === 'richese',
      'The paid Richese sale receipt is malformed.',
    );
    requireAuction(
      lot &&
        !input.auction &&
        text(lot.event) &&
        text(lot.cardId) &&
        lot.source === s.origin &&
        lot.owner === s.seller &&
        lot.outcome?.kind === 'sold' &&
        lot.outcome.winner === s.winner &&
        lot.outcome.amount === s.amount &&
        ids(lot.order) &&
        lot.order.length > 0 &&
        lot.order.every((id) => input.order.includes(id)) &&
        lot.order.includes(s.winner) &&
        ['normal', 'onceAround', 'silent'].includes(lot.method) &&
        !(lot.source === 'cache' && lot.method === 'normal'),
      'The paid Richese lot does not match its sold outcome.',
    );
    requireAuction(
      round &&
        round.turn === input.turn &&
        round.stage === 'lot' &&
        round.owner === lot.owner &&
        text(round.event) &&
        (lot.source === 'blackMarket'
          ? round.position === null
          : ['first', 'last'].includes(String(round.position))),
      'The paid Richese lot has a stale declaration round.',
    );
    sale = { ...s, legacy: false };
    cardId = lot.cardId;
  }
  requireAuction(
    count(sale.amount) && typeof sale.free === 'boolean',
    'The paid auction amount or free flag is invalid.',
  );
  if (operation.kind === 'sale')
    requireAuction(
      typeof operation.free === 'boolean' && operation.free === sale.free,
      'The auction continuation has a changed free-purchase flag.',
    );
  requireAuction(
    ['sale', 'bonus', 'next', 'cancel'].includes(operation.kind),
    'Unknown auction continuation.',
  );
  const winner = seated(sale.winner)!;
  requireAuction(winner, 'The auction winner is no longer seated.');
  let stage = operation.kind;
  const steps: AuctionContinuationQuote['steps'] = [];
  if (operation.kind === 'cancel') {
    const r = operation.response;
    requireAuction(
      r &&
        seated(r.owner) &&
        ids(r.passed) &&
        r.passed.every((id) => seated(id)),
      'The canceled auction response has an invalid owner or passes.',
    );
    if (r.kind === 'ixAllyCard') {
      const pending = input.pendingIxAlly;
      requireAuction(
        pending &&
          pending.player === winner.id &&
          r.recipient === winner.id &&
          seated(r.owner)?.faction === 'ixians' &&
          pending.card === cardId &&
          pending.free === sale.free &&
          !sale.legacy &&
          sale.origin !== 'cache',
        'The denied Ixian replacement does not match its completed purchase.',
      );
      steps.push({ kind: 'clearIxAlly' });
      stage = 'sale';
    } else if (r.kind === 'emperorIncome') {
      requireAuction(
        seated(r.owner)?.faction === 'emperor' &&
          r.owner !== winner.id &&
          !sale.free &&
          (sale.origin === 'normal' || sale.seller === winner.id),
        'The canceled Emperor income is not payable by this sale.',
      );
      stage = 'bonus';
    } else if (r.kind === 'harkonnenBonus') {
      requireAuction(
        r.owner === winner.id && winner.faction === 'harkonnen',
        'The canceled Harkonnen bonus has the wrong winner.',
      );
      stage = 'next';
    } else
      requireAuction(
        false,
        'This response is not a paid-auction continuation.',
      );
  }
  // The source is checked before projection; successor eligibility is evaluated
  // only after this one declared cost leaves its actual owner's hand.
  if (spending)
    requireAuction(
      seated(spending.player) &&
        text(spending.card) &&
        seated(spending.player)!.hand.filter((c) => c.id === spending.card)
          .length === 1,
      'The quoted auction cost needs unique custody in its owner hand.',
    );
  const handCount = (p: AuctionContinuationSeat) =>
    p.hand.length - Number(spending?.player === p.id);
  const result = (
    next: AuctionContinuationQuote['next'],
  ): AuctionContinuationQuote => ({ sale, steps, next });
  if (stage === 'sale') {
    if (sale.origin !== 'normal' && sale.seller !== winner.id) {
      const seller = seated(sale.seller!)!;
      requireAuction(
        count(seller.spice) && count(seller.spice + sale.amount),
        'The seller credit would overflow its current balance.',
      );
      steps.push({
        kind: 'sellerCredit',
        player: seller.id,
        amount: sale.amount,
        balance: seller.spice + sale.amount,
      });
    } else {
      const emperor = input.players.find((p) => p.faction === 'emperor');
      if (!sale.free && emperor && emperor.id !== winner.id)
        return result({
          kind: 'response',
          response: { kind: 'emperorIncome', owner: emperor.id, passed: [] },
        });
    }
    stage = 'bonus';
  }
  if (
    stage === 'bonus' &&
    winner.faction === 'harkonnen' &&
    handCount(winner) < 8
  )
    return result({
      kind: 'response',
      response: { kind: 'harkonnenBonus', owner: winner.id, passed: [] },
    });
  if (sale.origin !== 'normal') {
    const lot = input.richeseAuction!,
      round = input.richeseBidding!;
    if (lot.source === 'blackMarket') {
      requireRicheseDeclarationCache(input.richeseCacheCount);
      return result({
        kind: 'richeseEnd',
        source: 'blackMarket',
        after: 'declaration',
        blackMarketSold: true,
        ...(lot.method === 'normal'
          ? {
              opener:
                (input.order.indexOf(lot.order[0]) + 1) % input.order.length,
            }
          : {}),
      });
    }
    return result({
      kind: 'richeseEnd',
      source: 'cache',
      after: round.position === 'first' ? 'normalPool' : 'phase',
    });
  }
  const a = input.auction!,
    index = a.index + 1,
    able = input.order.filter((id) => {
      const p = seated(id)!;
      return handCount(p) < p.handLimit;
    });
  if (index === a.cards.length || !able.length) {
    const round = input.richeseBidding,
      activeRound = round?.turn === input.turn && round.stage === 'normal';
    return result({
      kind: 'normalEnd',
      returned: structuredClone(a.cards.slice(index)),
      after:
        activeRound && round.position === 'last' && !round.cacheCanceled
          ? 'richeseCache'
          : 'phase',
      completeRound:
        !!activeRound && !(round.position === 'last' && !round.cacheCanceled),
    });
  }
  let opener = a.opener;
  do {
    opener = (opener + 1) % input.order.length;
  } while (!able.includes(input.order[opener]));
  const active = input.order[opener],
    ix = input.players.find((p) => p.faction === 'ixians'),
    atreides = input.players.find((p) => p.faction === 'atreides');
  const offer: LotOffer =
    input.advanced &&
    ix &&
    handCount(ix) > 0 &&
    input.ixTechnologyTurn !== input.turn
      ? { kind: 'ixTechnology', player: ix.id }
      : atreides
        ? { kind: 'atreidesAuction', owner: atreides.id, passed: [] }
        : null;
  return result({
    kind: 'normalLot',
    auction: {
      ...structuredClone(a),
      index,
      bid: 0,
      allyPayment: 0,
      bidder: null,
      passed: [],
      opener,
      active,
      peekKnown: false,
    },
    active,
    offer,
  });
}
