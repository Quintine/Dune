import { baseDeck } from './cards';
import {
  quoteNormalAuctionBid,
  quoteNormalAuctionNext,
} from './normal-auction';

export type IntroductionBiddingChoice = {
  auctionScenario: 'contest' | 'all-pass';
  auctionHandFull: boolean;
  auctionBid: number;
  auctionActions: Array<number | null>;
};

const order = ['you', 'emperor', 'guild'];
export const INTRODUCTION_BIDDERS: Readonly<Record<string, string>> = {
  you: 'You · Fremen',
  emperor: 'Emperor',
  guild: 'Spacing Guild',
};
const budget = 6;

/** Replay only validated teaching choices, never imported room or private seat data. */
export function introductionBidding(choice: IntroductionBiddingChoice) {
  if (
    !['contest', 'all-pass'].includes(choice.auctionScenario) ||
    typeof choice.auctionHandFull !== 'boolean' ||
    !Number.isSafeInteger(choice.auctionBid) ||
    choice.auctionBid < 0 ||
    choice.auctionBid > 7 ||
    !Array.isArray(choice.auctionActions) ||
    choice.auctionActions.length > 7
  )
    throw new Error('Invalid saved bidding practice.');
  const eligible = choice.auctionHandFull ? order.slice(1) : [...order];
  const auction = {
    order,
    eligible,
    active: eligible[0],
    bid: 0,
    bidder: null as string | null,
    passed: [] as string[],
  };
  const transcript: string[] = [];
  const actions: Array<{ actor: string; amount: number | null }> = [];
  let status: 'bidding' | 'sold' | 'unbid' = 'bidding';
  let consumed = 0;
  // Strictly increasing bids and three finite seats make this bound unreachable normally.
  for (let guard = 0; guard < 30 && status === 'bidding'; guard++) {
    const actor = auction.active;
    let amount: number | null;
    if (actor === 'you') {
      if (consumed === choice.auctionActions.length) break;
      amount = choice.auctionActions[consumed++];
    } else {
      const ceiling = actor === 'emperor' ? 2 : 3;
      amount =
        choice.auctionScenario === 'contest' && auction.bid < ceiling
          ? ceiling
          : null;
    }
    if (amount !== null) {
      const quote = quoteNormalAuctionBid({
        currentBid: auction.bid,
        amount,
        maximum: actor === 'you' ? budget : 4,
      });
      if (!quote.ok) throw new Error('Invalid saved practice bid.');
      auction.bid = quote.amount;
      auction.bidder = actor;
      auction.passed = [];
    } else if (!auction.passed.includes(actor)) auction.passed.push(actor);
    actions.push({ actor, amount });
    transcript.push(
      `${INTRODUCTION_BIDDERS[actor]} ${amount === null ? 'passed.' : `bid ${amount} spice.`}`,
    );
    const next = quoteNormalAuctionNext(auction);
    if (next.kind === 'bid') auction.active = next.player;
    else status = next.kind === 'payment' ? 'sold' : 'unbid';
  }
  if (
    consumed !== choice.auctionActions.length ||
    (status === 'bidding' && auction.active !== 'you')
  )
    throw new Error(
      'Saved bidding actions extend past the end of this example.',
    );
  const won = status === 'sold' && auction.bidder === 'you';
  const draft = quoteNormalAuctionBid({
    currentBid: auction.bid,
    amount: choice.auctionBid,
    maximum: budget,
  });
  return {
    status,
    bid: auction.bid,
    bidder: auction.bidder,
    active: status === 'bidding' ? auction.active : null,
    actions,
    transcript,
    won,
    minimum: auction.bid + 1,
    canBid: status === 'bidding' && draft.ok,
    bidError: status !== 'bidding' ? null : draft.ok ? null : draft.reason,
    remaining: budget - (won ? auction.bid : 0),
    handCount: (choice.auctionHandFull ? 4 : 3) + (won ? 1 : 0),
    emperorIncome:
      status === 'sold' && auction.bidder !== 'emperor' ? auction.bid : 0,
    bankIncome:
      status === 'sold' && auction.bidder === 'emperor' ? auction.bid : 0,
    // The face is part of the example, not a live deck; only the buyer sees it.
    received: won ? baseDeck().find((card) => card.kind === 'shield')! : null,
  };
}
