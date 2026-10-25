import type { Game, Player } from './engine';
import { homeworldLowBonus } from './homeworld-benefits';

export type Inflation = {
  side: 'double' | 'cancel';
  placedTurn: number;
  updatedTurn: number;
  flipped: boolean;
};

/** The token changes charity starting the turn after placement. */
export function charityMultiplier(g: Pick<Game, 'turn' | 'inflation'>) {
  if (!g.inflation || g.turn <= g.inflation.placedTurn) return 1;
  return g.inflation.side === 'double' ? 2 : 0;
}

/** Separate ordinary funding from the Homeworld addition paid by the bank.
 * Inflation changes both eligible portions, never the ordinary wealth threshold.
 * This quote does not claim, pay, or resolve a Bene Gesserit power response. */
export function charityQuote(
  g: Pick<Game, 'advanced' | 'turn' | 'inflation' | 'players' | 'homeworlds'>,
  p: Pick<Player, 'id' | 'spice' | 'faction'>,
): { ordinary: number; homeworld: number; total: number } {
  const eligible =
    g.advanced && p.faction === 'beneGesserit' ? 2 : Math.max(0, 2 - p.spice);
  const multiplier = charityMultiplier(g);
  const ordinary = eligible * multiplier;
  const homeworld = eligible > 0 ? homeworldLowBonus(g, p.id) * multiplier : 0;
  return { ordinary, homeworld, total: ordinary + homeworld };
}

export function charityAmount(
  g: Pick<Game, 'advanced' | 'turn' | 'inflation' | 'players' | 'homeworlds'>,
  p: Pick<Player, 'id' | 'spice' | 'faction'>,
) {
  return charityQuote(g, p).total;
}

/** Native phase-opening collection, distinct from a player's ordinary claim. */
export function choamOpeningIncome(
  g: Pick<Game, 'advanced' | 'turn' | 'inflation' | 'players' | 'homeworlds'>,
  owner: Pick<Player, 'id'>,
) {
  return (2 * g.players.length + homeworldLowBonus(g, owner.id)) * charityMultiplier(g);
}

export function charityPayer(
  g: Pick<Game, 'players' | 'turn' | 'choamCharity'>,
  beneficiary?: string,
) {
  return g.choamCharity?.turn === g.turn && !g.choamCharity.canceled
    ? g.players.find((p) => p.faction === 'choam' && p.id !== beneficiary)
    : undefined;
}

export class CharityFundingError extends Error {}

/** Preview policy: preserve the claimant's full entitlement without negative
 * cash. Only the ordinary portion can debit another faction's CHOAM wallet;
 * the bank covers any shortfall and every Homeworld addition. No loan is made.
 * Keep this private calculation out of rival projections and public logs. */
export function quoteCharityFunding(
  amounts: { ordinary: number; homeworld: number },
  payerSpice: number | null,
): { choam: number; bank: number } {
  const { ordinary, homeworld } = amounts;
  if (![ordinary, homeworld].every(n => Number.isSafeInteger(n) && n >= 0) ||
      !Number.isSafeInteger(ordinary + homeworld) ||
      (payerSpice !== null && (!Number.isSafeInteger(payerSpice) || payerSpice < 0)))
    throw new CharityFundingError('The charity funding amounts are invalid.');
  const choam = payerSpice === null ? 0 : Math.min(ordinary, payerSpice);
  return { choam, bank: ordinary - choam + homeworld };
}
