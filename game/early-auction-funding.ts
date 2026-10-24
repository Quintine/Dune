import type { RicheseAuction } from './richese-auction';
import { richeseOwnCommitment, richeseAllyCommitment, type RicheseFunding } from './richese-funding';

export type EarlyAuctionFunding = {
  phase: number;
  owner: string;
  ally: string | null;
  paid: boolean;
  normal: { bidder: string | null; bid: number; allyPayment?: number } | null;
  native?: RicheseAuction | null;
  funding?: RicheseFunding;
  pledge: number;
};

/** Private owned-stage funding, not settlement or a prediction of who wins.
 * Silent donor locks use submission status, never the ally's private split.
 * A current sale already paid its invoice and consumed any donated escrow. */
export function earlyAuctionFunding(input: EarlyAuctionFunding) {
  const { owner, ally, pledge } = input;
  const normal = input.phase === 3 && !input.paid ? input.normal : null;
  const native = input.phase === 3 && !input.paid ? input.native : null;
  const funding = input.funding ?? {};
  const normalCash = normal?.bidder === owner ? normal.bid - (normal.allyPayment ?? 0) : 0;
  const nativeCash = richeseOwnCommitment(native, funding, owner);
  const normalDonor = ally && normal?.bidder === ally ? normal.allyPayment ?? 0 : 0;
  const sealedLock = native?.method === 'silent' && !native.outcome && ally &&
    Object.hasOwn(native.sealed, ally);
  const nativeDonor = sealedLock ? pledge : richeseAllyCommitment(native, funding, owner);
  const refund = pledge - normalDonor - nativeDonor;
  for (const amount of [normalCash, nativeCash, refund])
    if (!Number.isSafeInteger(amount) || amount < 0)
      throw new RangeError('The current auction funding exceeds its owned cash or pledged escrow.');
  return { normalCash, nativeCash, refund };
}
