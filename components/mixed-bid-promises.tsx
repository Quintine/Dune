'use client';

import type { Action, GameView } from '@/game/engine';
import { truthQuestionText } from '@/game/truthtrance';
import { CHEAP_HERO_TRAITOR } from '@/game/traitors';
import { BidPromiseGuideButton } from './bid-promises';

/** Display the original question and whole answer only. Frozen facts, reduced
 * thresholds and physical lot sources never belong in this panel. */
export function MixedBidPromises(props: { game: GameView; busy: boolean; send: (action: Action) => void }) {
  const game = props.game, own = game.mixedBidPromises.filter(promise => promise.player === game.me);
  if (!own.length) return null;
  const leaderName = (id: string) => id === 'kwisatz' ? 'Kwisatz Haderach'
    : id === CHEAP_HERO_TRAITOR ? 'Cheap Hero / Heroine' : game.allLeaders.find(leader => leader.id === id)?.name ?? id;
  const lot = game.bidPromiseLot;
  const live = !!lot && lot.turn === game.turn && own.some(promise => promise.turn === lot.turn && promise.lot === lot.lot &&
    !promise.fulfilled && !promise.released);
  const sharedGuideElsewhere = !!lot && lot.turn === game.turn && game.bidPromises.some(promise => promise.player === game.me &&
    promise.turn === lot.turn && promise.lot === lot.lot && !promise.fulfilled && !promise.released);
  return <section className="notice space-y-3" aria-label="Your Truthtrance mixed bid promises" id="mixed-bid-promise-guidance">
    <h3>Your mixed bid promises</h3>
    <ul>{own.map(promise => <li key={promise.event}>
      Turn {promise.turn}, ordinary lot {promise.lot}: You answered {promise.answer ? 'Yes' : 'No'} to {truthQuestionText({ kind: 'mixedBid', target: promise.player,
        turn: promise.turn, lot: promise.lot, mixed: promise.mixed }, leaderName,
      id => game.combatLocations.find(location => location.id === id)?.name ?? id,
      id => game.players.find(player => player.id === id)?.name ?? id)}
      {promise.released ? ' Released: this whole commitment is no longer possible.'
        : promise.fulfilled ? ' Fulfilled: this whole commitment is complete.' : ' This whole answer is binding for this lot.'}
    </li>)}</ul>
    <p>Current facts are evaluated at the answer. They create no promise to keep cards, spice or forces afterward.
      Only the aggregate answer is shared. Individual fact answers and any reduced future threshold remain private.
      AND requires every condition; OR requires at least one. No negates the whole expression, not each condition separately.</p>
    <p className="fine">A Yes answer that still requires a future bid is fulfilled immediately by one qualifying native declaration,
      even if another player wins. Smaller bids do not add together. A binding No remains in force until this ordinary lot actually closes.
      If you win, the original payment rules still apply. Existing funding, Karama and prepaid ally aid rules still apply.
      Ordinary bank auctions only; optional modules and native special auctions are excluded.
      {' '}<a href="/rules#truthtrance-mixed-bid">Mixed bid rules</a>.</p>
    {live && game.auction?.active !== game.me && <p>Your next bid opportunity is still ahead; this promise remains visible while others bid.</p>}
    {live && !sharedGuideElsewhere && <BidPromiseGuideButton {...props} />}
  </section>;
}
