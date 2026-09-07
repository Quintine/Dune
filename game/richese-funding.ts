import type { RicheseAuction } from './richese-auction';

export type RicheseFundingRecord = {
  amount: number;
  allyPayment: number;
  donor: string | null;
};
export type RicheseFunding = Record<string, RicheseFundingRecord>;

function nonnegativeInteger(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value < 0)
    throw new RangeError(`${label} must be a nonnegative safe integer.`);
}

/** Pure exact-split validation; never silently substitutes a different payer. */
export function validateRicheseFunding(
  amount: number,
  allyPayment: number,
  ownAvailable: number,
  allyAvailable: number,
): { own: number; ally: number } {
  nonnegativeInteger(amount, 'Bid');
  nonnegativeInteger(allyPayment, 'Ally payment');
  nonnegativeInteger(ownAvailable, 'Own available spice');
  nonnegativeInteger(allyAvailable, 'Ally available spice');
  if (allyPayment > amount)
    throw new RangeError('Ally payment cannot exceed the bid.');
  const own = amount - allyPayment;
  if (own > ownAvailable || allyPayment > allyAvailable)
    throw new RangeError('The declared payment split is not funded.');
  return { own, ally: allyPayment };
}

function committedPlayers(
  auction: RicheseAuction | null | undefined,
): string[] {
  if (!auction) return [];
  if (auction.outcome)
    return auction.outcome.kind === 'sold' ? [auction.outcome.winner] : [];
  if (auction.method === 'silent')
    return auction.eligible.filter((id) => Object.hasOwn(auction.sealed, id));
  return auction.bidder ? [auction.bidder] : [];
}

function ownShare(record: RicheseFundingRecord): number {
  nonnegativeInteger(record.amount, 'Reserved bid');
  nonnegativeInteger(record.allyPayment, 'Reserved ally payment');
  if (record.allyPayment > record.amount)
    throw new RangeError('Reserved ally payment cannot exceed the bid.');
  return record.amount - record.allyPayment;
}

/**
 * Terminal winners stay reserved until the engine clears their funding record.
 * No losing offer, unrelated ledger entry, or unsubmitted Silent draft reserves.
 * The engine must atomically bind each accepted bid to its exact funding record.
 */
export function richeseOwnCommitment(
  auction: RicheseAuction | null | undefined,
  funding: RicheseFunding,
  playerId: string,
): number {
  if (
    !committedPlayers(auction).includes(playerId) ||
    !Object.hasOwn(funding, playerId)
  )
    return 0;
  return ownShare(funding[playerId]);
}

/** Returns only this donor's reservation; never a list of private bidder splits. */
export function richeseAllyCommitment(
  auction: RicheseAuction | null | undefined,
  funding: RicheseFunding,
  donorId: string,
): number {
  let total = 0;
  for (const player of committedPlayers(auction)) {
    if (!Object.hasOwn(funding, player)) continue;
    const record = funding[player];
    if (record.donor !== donorId) continue;
    ownShare(record);
    total += record.allyPayment;
    nonnegativeInteger(total, 'Total reserved ally payment');
  }
  return total;
}
