import { BribePromiseError, parseBribeClaim, type BribeClaim } from './bribe-promises';
import type { MixedActionExpression } from './mixed-action-question';

export type BribePaymentClaim = Pick<BribeClaim, 'recipient' | 'minimum'>;
export type MixedBribeClaim = { turn: number; mixed: MixedActionExpression<BribePaymentClaim> };

/** Reuse scalar recipient/minimum decoding without accepting question metadata.
 * The neutral turn validates only this leaf; engine owns the actual interval. */
export function parseBribePaymentClaim(value: unknown): BribePaymentClaim {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
    Object.keys(value).sort().join(',') !== 'minimum,recipient')
    throw new BribePromiseError('Supply only an exact ordinary-payment recipient and positive spice minimum.');
  const { recipient, minimum } = parseBribeClaim({ ...value, turn: 1 });
  return { recipient, minimum };
}
