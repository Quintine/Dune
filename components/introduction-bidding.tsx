import {
  introductionBidding,
  INTRODUCTION_BIDDERS,
} from '@/game/introduction-bidding';
import type { IntroductionState } from '@/game/introduction';
import { CardInspector, CardRules } from './card-inspector';
import styles from './introduction.module.css';

export function BiddingLesson({
  state,
  update,
}: {
  state: IntroductionState;
  update: (patch: Partial<IntroductionState>) => void;
}) {
  const auction = introductionBidding(state);
  const reset = (patch: Partial<IntroductionState> = {}) =>
    update({ auctionActions: [], auctionBid: 1, ...patch });
  const act = (amount: number | null) => {
    const next = {
      ...state,
      auctionActions: [...state.auctionActions, amount],
    };
    const result = introductionBidding(next);
    update({
      auctionActions: next.auctionActions,
      auctionBid:
        result.status === 'bidding'
          ? Math.min(7, result.minimum)
          : next.auctionBid,
    });
  };
  return (
    <>
      <p>
        In this separate example you are <strong>Fremen with 6 spice</strong>.
        One face-down Treachery Card is being auctioned in the order Fremen,
        Emperor, Spacing Guild. There are no allies, Karama cards or other
        reacting powers here.
      </p>
      <div className={styles.columns}>
        <div className={styles.controls}>
          <label htmlFor="learn-auction-scenario">Practice opponents</label>
          <select
            id="learn-auction-scenario"
            value={state.auctionScenario}
            onChange={(event) =>
              reset({
                auctionScenario: event.target
                  .value as IntroductionState['auctionScenario'],
              })
            }
          >
            <option value="contest">
              Emperor bids up to 2; Guild bids up to 3
            </option>
            <option value="all-pass">Both opponents pass</option>
          </select>
          <label className={styles.checkbox}>
            <input
              type="checkbox"
              checked={state.auctionHandFull}
              onChange={(event) =>
                reset({ auctionHandFull: event.target.checked })
              }
            />
            Start with a full hand of four cards
          </label>
          <p className="fine">
            These are fixed teaching responses. At a real table, opponents
            choose their own bids and their spice remains private. Changing
            either option starts a new example.
          </p>
          <label htmlFor="learn-auction-bid">
            Your bid: {state.auctionBid} spice
          </label>
          <input
            id="learn-auction-bid"
            type="range"
            min="0"
            max="7"
            step="1"
            value={state.auctionBid}
            disabled={auction.status !== 'bidding'}
            onChange={(event) =>
              update({ auctionBid: Number(event.target.value) })
            }
          />
          <button
            disabled={!auction.canBid}
            onClick={() => act(state.auctionBid)}
          >
            Place practice bid
          </button>
          <button
            disabled={auction.status !== 'bidding'}
            onClick={() => act(null)}
          >
            Pass this bid
          </button>
          <button onClick={() => reset()}>Restart practice auction</button>
        </div>
        <div className={styles.result} aria-live="polite">
          <h3>
            {auction.status === 'bidding'
              ? 'Your bidding turn'
              : auction.status === 'unbid'
                ? 'No one bought the card'
                : auction.won
                  ? 'You bought the card'
                  : 'Your opponent bought the card'}
          </h3>
          {state.auctionHandFull && (
            <p>
              Your four-card hand is full, so you cannot bid. The auction
              continues with the eligible players.
            </p>
          )}
          {auction.status === 'bidding' ? (
            <>
              <p>
                {auction.bidder
                  ? `${INTRODUCTION_BIDDERS[auction.bidder]} holds the high bid of ${auction.bid} spice.`
                  : 'No bid has been made yet.'}{' '}
                Your next bid must be at least {auction.minimum} spice.
              </p>
              <p>
                You still hold all 6 spice. The winning bid is paid when the
                auction closes.
              </p>
              {auction.bidError && <p>{auction.bidError}</p>}
              {state.auctionActions.includes(null) && (
                <p>
                  You passed earlier, but the card is still up for sale. You may
                  re-enter on this turn.
                </p>
              )}
            </>
          ) : auction.status === 'unbid' ? (
            <>
              <p>
                Everyone passed without a bid. No spice changes hands. This card
                and any remaining unauctioned cards return to the top of the
                deck, and normal bidding ends.
              </p>
            </>
          ) : (
            <>
              <p>
                {INTRODUCTION_BIDDERS[auction.bidder!]} pays {auction.bid} spice{' '}
                {auction.bankIncome ? 'to the Spice Bank' : 'to the Emperor'}.
                Losing bidders pay nothing.
              </p>
              <p>
                You have <strong>{auction.remaining} spice</strong> and{' '}
                {auction.handCount} cards in your hand.
              </p>
              {auction.received ? (
                <>
                  <p>
                    Your new card is private. Buying it did not reveal its face
                    to the other players.
                  </p>
                  <CardRules card={auction.received} />
                  <CardInspector card={auction.received} />
                </>
              ) : (
                <p>The purchased card remains concealed from you.</p>
              )}
            </>
          )}
          <h3>Auction history</h3>
          {auction.transcript.length ? (
            <ol>
              {auction.transcript.map((entry, index) => (
                <li key={index}>{entry}</li>
              ))}
            </ol>
          ) : (
            <p>You open the bidding. Bid at least 1 spice or pass.</p>
          )}
        </div>
      </div>
      <p>
        A higher bid gives the other eligible players another opportunity.
        Passing does not permanently remove you: you can bid again if the card
        is still available when your turn returns. Once everyone else passes on
        the standing bid, its owner buys the card automatically.
      </p>
      <p>
        Ordinary hands hold at most four Treachery Cards; Harkonnen has a larger
        limit. Atreides can inspect auction cards through its faction power.
        Allies, Karama and expansion auctions add further choices in the live
        game.
      </p>
    </>
  );
}
