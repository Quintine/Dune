import type { Action } from './engine';

/** Enumerate physical choices from the owner's current authoritative Ghola
 * options. This is not a new revival allowance or a strategic shortlist. */
export function* gholaForcePreparations(quote: {
  cards: readonly string[];
  tanks: number;
  eliteTanks: number;
  maxForces: number;
  eliteRemaining: number;
}): Generator<Action> {
  for (const card of quote.cards) for (let amount = 1; amount <= quote.maxForces; amount++)
    for (let elite = Math.max(0, amount - (quote.tanks - quote.eliteTanks));
      elite <= Math.min(amount, quote.eliteTanks, quote.eliteRemaining); elite++)
      yield { type: 'card', card, amount, elite };
}
