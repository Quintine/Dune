'use client';

import type { GameView } from '@/game/engine';

/** Waiting receipts are private to their respondent. Once attached to a real
 * lot, the ordinary Richese bid panel owns the subsequent action and status. */
export function EarlyRicheseBidPromises({ game }: { game: GameView }) {
  if (!game.me) return null;
  const waiting = game.ownEarlyRicheseBidPromises.filter(row => row.player === game.me &&
    row.turn === game.turn && !row.boundEvent && !row.fulfilled && !row.released);
  if (!waiting.length) return null;
  return <section className="notice space-y-3" aria-label="Your upcoming Richese cache bid promises">
    <h3>Your upcoming Richese cache bid promises</h3>
    <ul>{waiting.map(row => <li key={row.id}>
      Turn {row.turn}: You answered {row.answer ? 'Yes' : 'No'} to bidding at least {row.minimum} spice in the first Richese cache auction this turn.
    </li>)}</ul>
    <p>Waiting for the first Richese cache auction. Its card and method are not yet decided. Your answer applies while the opportunity remains possible.</p>
  </section>;
}
