import type { Card } from './cards';
import type { RicheseAuction } from './richese-auction';
import {
  validateRicheseFunding,
  type RicheseFundingRecord,
} from './richese-funding';

export class RicheseSettlementError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RicheseSettlementError';
  }
}

export type RicheseSettlementSeat = {
  id: string;
  handCount: number;
  /** The engine supplies its current faction-specific hand limit. */
  handLimit: number;
};
export type RicheseSettlementInput = {
  lot: Readonly<RicheseAuction>;
  owner: Readonly<RicheseSettlementSeat>;
  winner?: Readonly<RicheseSettlementSeat & { spice: number }> | null;
  /** Resolve from the lot's actual cache/owner-hand source, never its preview. */
  card?: Readonly<Card> | null;
  funding?: Readonly<RicheseFundingRecord> | null;
  /** The engine resolves current aidFor; no unpledged donor funds are counted. */
  allyCredit?: Readonly<{ amount: number }> | null;
};
export type RicheseSettlementQuote =
  | { kind: 'open' }
  | { kind: 'retainBlackMarket' }
  | { kind: 'removeCache'; card: Card }
  | { kind: 'chooseUnbidCache' }
  | {
      kind: 'sold';
      card: Card;
      winner: string;
      amount: number;
      ownPayment: number;
      allyPayment: number;
    };

function requireSettlement(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) throw new RicheseSettlementError(message);
}
function validHand(seat: Readonly<RicheseSettlementSeat>) {
  requireSettlement(
    Number.isSafeInteger(seat.handCount) &&
      seat.handCount >= 0 &&
      Number.isSafeInteger(seat.handLimit) &&
      seat.handLimit > 0,
    'The auction hand size or limit is invalid.',
  );
}
function reservedCard(input: RicheseSettlementInput): Card {
  requireSettlement(
    input.card && input.card.id === input.lot.cardId,
    'The reserved auction card is no longer available.',
  );
  return structuredClone(input.card);
}

/**
 * Pure post-bidding branch/price validation, shared by settlement and preflight.
 * Does not reveal, pay, transfer, decide, draw, log, or advance a phase.
 * The caller binds phase/round/event, full physical custody and current ally
 * identity. A returned card is detached evidence, not an additional live card.
 *
 * Preserve unbid asymmetry: Black Market retains without a funding/card lookup;
 * cache space prompts a future choice, while a full owner removes its card.
 */
export function quoteRicheseSettlement(
  input: RicheseSettlementInput,
): RicheseSettlementQuote {
  const { lot, owner } = input;
  if (!lot.outcome) return { kind: 'open' };
  requireSettlement(
    owner && owner.id === lot.owner,
    'The auction owner is no longer available.',
  );
  requireSettlement(
    lot.source === 'cache' || lot.source === 'blackMarket',
    'The auction source is invalid.',
  );
  if (lot.outcome.kind === 'unbid') {
    if (lot.source === 'blackMarket') return { kind: 'retainBlackMarket' };
    validHand(owner);
    return owner.handCount >= owner.handLimit
      ? { kind: 'removeCache', card: reservedCard(input) }
      : { kind: 'chooseUnbidCache' };
  }
  requireSettlement(
    lot.outcome.kind === 'sold',
    'The auction outcome is invalid.',
  );
  const winner = input.winner;
  requireSettlement(
    winner && winner.id === lot.outcome.winner,
    'The auction winner is no longer available.',
  );
  const card = reservedCard(input);
  validHand(winner);
  requireSettlement(
    winner.handCount < winner.handLimit,
    'The winning hand has no room for this card.',
  );
  requireSettlement(
    lot.source !== 'blackMarket' || winner.id !== owner.id,
    'Black Market self-purchase is awaiting a ruling on payment and sale counting.',
  );
  const { funding } = input;
  requireSettlement(
    funding && funding.amount === lot.outcome.amount,
    'The winning bid needs its exact funding commitment.',
  );
  let split: { own: number; ally: number };
  try {
    split = validateRicheseFunding(
      lot.outcome.amount,
      funding.allyPayment,
      winner.spice,
      input.allyCredit?.amount ?? 0,
    );
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    throw new RicheseSettlementError(
      error.message === 'The declared payment split is not funded.'
        ? 'The payment is no longer funded.'
        : error.message,
    );
  }
  return {
    kind: 'sold',
    card,
    winner: winner.id,
    amount: lot.outcome.amount,
    ownPayment: split.own,
    allyPayment: split.ally,
  };
}

/**
 * The existing declaration boundary rejects an exhausted cache. Use when a
 * canceled/unbid Black Market lot will immediately enter richeseDeclaration;
 * settlement quoting alone deliberately does not execute that continuation.
 * A sold Black Market lot may first pause for replacement/bonus handling.
 */
export function requireRicheseDeclarationCache(
  cacheCount: number | undefined,
): void {
  requireSettlement(
    Number.isSafeInteger(cacheCount) && cacheCount! > 0,
    'An exhausted Richese cache needs an official ruling on the normal auction count.',
  );
}
