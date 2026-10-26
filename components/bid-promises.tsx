'use client';

import type { Action, GameView } from '@/game/engine';
import { bidClaimText, bidPromiseModeSupported } from '@/game/bid-promises';
import { Button } from './ui/button';

type BidPromiseProps = { game: GameView; busy: boolean; send: (action: Action) => void };

/** The server's current guide owns bid feasibility and funding. This leaf only
 * checks that its personalized event and public action opportunity stay live. */
export function BidPromiseGuideButton(props: BidPromiseProps) {
  const game = props.game, guide = game.bidPromiseGuide, lot = game.bidPromiseLot;
  if (!guide || !lot) return null;
  const actor = game.me, turn = lot.turn, number = lot.lot;
  const action = guide.action, event = action.bidPromiseEvent, signature = JSON.stringify(action);
  const canAct = () => {
    const current = props.game, me = current.players.find(player => player.id === current.me);
    return !props.busy && current === game && bidPromiseModeSupported(current) && current.status === 'playing' && current.phase === 3 &&
      current.me === actor && current.auction?.active === actor &&
      current.turn === turn && current.bidPromiseLot?.turn === turn && current.bidPromiseLot.lot === number &&
      current.bidPromiseGuide === guide && current.bidPromiseGuide.action === action && JSON.stringify(action) === signature &&
      typeof event === 'string' && (action.type === 'bid' || action.type === 'passBid') &&
      (current.bidPromises.some(promise => promise.event === event && promise.player === actor &&
        promise.turn === turn && promise.lot === number && !promise.fulfilled && !promise.released) ||
        current.mixedBidPromises.some(promise => promise.event === event && promise.player === actor &&
          promise.turn === turn && promise.lot === number && !promise.fulfilled && !promise.released)) &&
      !!me && !me.autopilot && !current.truthtrance && !current.response && !current.decision &&
      !current.phaseOpening && !current.automaticContinuationPending && !current.roomControl?.paused && !current.roomControl?.closed;
  };
  return <Button className="game-action min-h-11 whitespace-normal" data-testid="bid-promise-guide"
    disabled={!canAct()} onClick={() => { if (canAct()) props.send(action); }}>
    {action.type === 'bid'
      ? `Bid ${typeof action.amount === 'number' ? action.amount : 'the suggested amount'} spice while honoring your answers`
      : 'Pass this bid while honoring your answers'}
  </Button>;
}

export function BidPromises(props: BidPromiseProps) {
  const own = props.game.bidPromises.filter(promise => promise.player === props.game.me);
  if (!own.length) return null;
  const waiting = own.some(promise => !promise.fulfilled && !promise.released &&
    props.game.bidPromiseLot?.turn === props.game.turn && promise.turn === props.game.turn && promise.lot === props.game.bidPromiseLot.lot);
  return <section className="notice space-y-3" aria-label="Your Truthtrance bid promises" id="bid-promise-guidance">
    <h3>Your bid promises</h3>
    <ul>{own.map(promise => <li key={promise.event}>
      Turn {promise.turn}, ordinary lot {promise.lot}: You answered {promise.answer ? 'Yes' : 'No'} to {bidClaimText(promise)}.
      {promise.released ? ' Released: this commitment is no longer possible.'
        : promise.fulfilled ? ' Fulfilled: this commitment is complete.' : ' This answer is binding for this lot.'}
    </li>)}</ul>
    <p>
      Yes requires one qualifying bid from your answer until this lot closes, while it remains possible.
      No forbids every later bid at or above that minimum through the close of this lot.
      A qualifying declaration fulfills this answer even if another player wins.
      If you win, the original payment rules still apply.
    </p>
    <p className="fine">
      <a href="/rules#truthtrance-bid">Bid promise rules</a>.{' '}
      These commitments concern the current ordinary bank lot. Optional modules and native special auctions are excluded.
      Ordinary bids keep their existing funding and payment rules.
    </p>
    {waiting && props.game.auction?.active !== props.game.me && <p>Your next bid opportunity is still ahead; this promise remains visible while others bid.</p>}
    {waiting && <BidPromiseGuideButton {...props} />}
  </section>;
}
