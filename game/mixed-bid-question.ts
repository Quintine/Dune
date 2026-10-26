import { BidPromiseError, parseBidClaim } from './bid-promises';
import type { CompiledMixedAction, MixedActionExpression } from './mixed-action-question';

export const MIXED_BID_MAX_LEAVES = 16;
export const MIXED_BID_MAX_DEPTH = 4;
export type BidActionClaim = { minimum: number };
export type MixedBidClaim = { turn: number; lot: number; mixed: MixedActionExpression<BidActionClaim> };

export function parseBidActionClaim(value: unknown): BidActionClaim {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
    Object.keys(value).join(',') !== 'minimum')
    throw new BidPromiseError('Supply one positive whole bid minimum without turn or lot metadata.');
  const { minimum } = parseBidClaim({ turn: 1, lot: 1, minimum: (value as Record<string, unknown>).minimum });
  return { minimum };
}

/** All positive leaves concern the same future accepted declaration interval.
 * max(a,b) satisfies AND, min(a,b) satisfies OR; whole No retains that exact
 * threshold. This creates neither a second bid search nor a selected route. */
export function mixedBidMinimum(node: CompiledMixedAction<BidActionClaim>): number {
  if (node.kind === 'action') return parseBidActionClaim(node.action).minimum;
  if (node.kind === 'constant' || !node.terms.length)
    throw new BidPromiseError('Reduce only a nonconstant future ordinary-bid expression.');
  const minima = node.terms.map(mixedBidMinimum);
  return node.kind === 'and' ? Math.max(...minima) : Math.min(...minima);
}
