import { validatePublicDeals, voidPublicDealPayment, type PublicDeal, type PublicDealSeat } from './public-deals';

/** A deal-linked obligation is independent of every other deal and of
 * Truthtrance. It is due once for its exact gross payment, not a threshold
 * shared with a different agreement. */
export type PendingPublicDealPayment = {
  deal: string;
  payer: string;
  recipient: string;
  dueTurn: number;
  amount: number;
};

export class PublicDealObligationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PublicDealObligationError';
  }
}

const identifier = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value === value.trim();
const nonnegative = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

/** Return a payer's unsettled active terms that can still be paid now,
 * including future deadlines. Past-due rows stay in the authoritative ledger
 * for the engine's expiry reconciliation; this helper never voids them. */
export function outstandingPublicDealPayments(
  deals: readonly PublicDeal[], payer: string, turn: number,
): PendingPublicDealPayment[] {
  if (!Array.isArray(deals) || !identifier(payer) || !Number.isSafeInteger(turn) || turn < 1)
    throw new PublicDealObligationError('Retain the payer and original turn of the deferred payments.');
  return deals.flatMap(deal => {
    const payment = deal.payment;
    if (deal.status !== 'active' || deal.paymentStatus !== 'pending' ||
        payment?.kind !== 'deferredBribe' || payment.payer !== payer || payment.dueTurn < turn) return [];
    return [{ deal: deal.id, payer, recipient: payment.recipient, dueTurn: payment.dueTurn, amount: payment.amount }];
  });
}

/** Existing turn-specific planners and funding totals consider only payments
 * due in that turn. They must not reserve every future promise immediately. */
export function pendingPublicDealPayments(
  deals: readonly PublicDeal[], payer: string, turn: number,
): PendingPublicDealPayment[] {
  return outstandingPublicDealPayments(deals,payer,turn).filter(payment => payment.dueTurn === turn);
}

/** Separate deals add, including two deals for the same recipient. */
export function publicDealPaymentTotal(deals: readonly PublicDeal[], payer: string, turn: number): number {
  let total = 0;
  for (const payment of pendingPublicDealPayments(deals, payer, turn)) {
    if (!Number.isSafeInteger(payment.amount) || payment.amount <= 0 ||
        !Number.isSafeInteger(total + payment.amount))
      throw new PublicDealObligationError('The outstanding deal payments exceed the safe spice range.');
    total += payment.amount;
  }
  return total;
}

export type PublicDealPaymentWitness = {
  /** The engine's currently available uncommitted funding, or null if a
   * pending continuation means no reliable current quote is available. */
  available: number | null;
  change: 'voluntary' | 'external';
  /** Each ID must be proven individually impossible by the engine. A mere
   * cash shortage does not prove loss of future income or the other debts. */
  impossibleDealIds?: readonly string[];
};

/** An actor may not voluntarily make their accepted, funded payments
 * impossible. External uncertainty leaves every agreement intact; only
 * independently proven impossible terms are voided. No funds move here. */
export function reconcilePublicDealPayments(
  deals: readonly PublicDeal[], players: readonly PublicDealSeat[], payer: string, turn: number,
  witness: PublicDealPaymentWitness,
): PublicDeal[] {
  validatePublicDeals(deals, players);
  if (!witness || (witness.change !== 'voluntary' && witness.change !== 'external') ||
      (witness.available !== null && !nonnegative(witness.available)) ||
      (witness.impossibleDealIds !== undefined && !Array.isArray(witness.impossibleDealIds)))
    throw new PublicDealObligationError('Retain the actual funded witness and cause of the change.');
  const pending = pendingPublicDealPayments(deals, payer, turn);
  const ids = witness.impossibleDealIds ?? [];
  if (new Set(ids).size !== ids.length || ids.some(id => !pending.some(row => row.deal === id)))
    throw new PublicDealObligationError('Void only individually proven pending terms of this payer and turn.');
  if (witness.change === 'voluntary' && (ids.length > 0 ||
      witness.available !== null && witness.available < publicDealPaymentTotal(deals, payer, turn)))
    throw new PublicDealObligationError('Keep the funding needed for your accepted public deal payments.');
  if (witness.change !== 'external' || !ids.length) return [...deals];
  return deals.map(deal => ids.includes(deal.id) ? voidPublicDealPayment(deal, players) : deal);
}
