'use client';

import type { Action, GameView } from '@/game/engine';
import { phaseBidClaimText, phaseBidPromiseModeSupported } from '@/game/turn-bid-promises';
import { Button } from './ui/button';

type PhaseBidPromiseProps = { game: GameView; busy: boolean; send: (action: Action) => void };

/** Only operate the exact server-selected bid/pass for a live owned promise.
 * The native auction remains responsible for its own card, funding and turn. */
export function PhaseBidPromiseGuideButton(props: PhaseBidPromiseProps) {
  const game = props.game, guide = game.phaseBidPromiseGuide;
  if (!guide) return null;
  const actor = game.me, turn = game.turn, lot = game.auction;
  const lotSignature = lot && JSON.stringify([lot.bid, lot.bidder, lot.active, lot.remaining]);
  const action = guide.action, event = action.phaseBidPromiseEvent, lotNumber = action.phaseBidPromiseLot;
  const signature = JSON.stringify(action);
  const canAct = () => {
    const current = props.game, me = current.players.find(player => player.id === current.me);
    return !props.busy && current === game && phaseBidPromiseModeSupported(current) &&
      current.status === 'playing' && current.phase === 3 &&
      current.me === actor && current.turn === turn && !!lot && current.auction === lot &&
      current.auction.active === actor &&
      JSON.stringify([lot.bid, lot.bidder, lot.active, lot.remaining]) === lotSignature &&
      typeof lotNumber === 'number' && Number.isSafeInteger(lotNumber) && lotNumber > 0 &&
      current.bidPromiseLot?.turn === turn && current.bidPromiseLot.lot === lotNumber &&
      current.phaseBidPromiseGuide === guide && current.phaseBidPromiseGuide.action === action &&
      JSON.stringify(action) === signature && typeof event === 'string' &&
      (action.type === 'bid' || action.type === 'passBid') &&
      current.phaseBidPromises.some(promise => promise.event === event && promise.player === actor &&
        promise.turn === turn && !promise.fulfilled && !promise.released) && !!me && !me.autopilot &&
      !current.truthtrance && !current.response && !current.decision && !current.phaseOpening &&
      !current.automaticContinuationPending && !current.roomControl?.paused && !current.roomControl?.closed;
  };
  return <Button className="game-action min-h-11 whitespace-normal" data-testid="phase-bid-promise-guide"
    disabled={!canAct()} onClick={() => { if (canAct()) props.send(action); }}>
    {action.type === 'bid'
      ? `Bid ${typeof action.amount === 'number' ? action.amount : 'the suggested amount'} spice while honoring your phase answers`
      : 'Pass this lot while honoring your phase answers'}
  </Button>;
}

export function PhaseBidPromises(props: PhaseBidPromiseProps) {
  const own = props.game.phaseBidPromises.filter(promise => promise.player === props.game.me);
  if (!own.length) return null;
  const waiting = own.some(promise => promise.turn === props.game.turn && !promise.fulfilled && !promise.released);
  return <section className="notice space-y-3" aria-label="Your Truthtrance Bidding phase promises" id="phase-bid-promise-guidance">
    <h3>Your Bidding phase promises</h3>
    <ul>{own.map(promise => <li key={promise.event}>
      Turn {promise.turn}: You answered {promise.answer ? 'Yes' : 'No'} to {phaseBidClaimText(promise)}.
      {promise.released ? ' Released: this commitment is no longer possible.'
        : promise.fulfilled ? ' Fulfilled: this commitment is complete.' : ' This answer is binding through this Bidding phase.'}
    </li>)}</ul>
    <p>
      Yes requires a qualifying future bid while it remains possible. No forbids
      qualifying bids through Bidding close. A bid can fulfill Yes even if another
      player wins; the original payment rules still apply.
    </p>
    <p className="fine">
      Earlier bids do not count. Ordinary auctions retain their original order and
      funding; the answer gives no extra opportunity, spice or free purchase.
    </p>
    {waiting && props.game.auction?.active !== props.game.me &&
      <p>Your next bid opportunity is still ahead; this promise remains visible while others bid.</p>}
    {waiting && <PhaseBidPromiseGuideButton {...props} />}
  </section>;
}
