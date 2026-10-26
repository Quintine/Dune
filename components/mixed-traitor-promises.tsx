'use client';

import type { GameView } from '@/game/engine';
import { truthQuestionText } from '@/game/truthtrance';
import { CHEAP_HERO_TRAITOR } from '@/game/traitors';

/** Keep only the own original question and whole answer visible. The native
 * battle controls own declaration choices; no residual belongs in this panel. */
export function MixedTraitorPromises({ game }: { game: GameView }) {
  const own = game.mixedTraitorPromises.filter(promise => promise.player === game.me);
  if (!own.length) return null;
  const leaderName = (id: string) => id === CHEAP_HERO_TRAITOR ? 'Cheap Hero / Heroine'
    : game.allLeaders.find(leader => leader.id === id)?.name ?? id;
  return <section className="notice space-y-3" aria-label="Your Truthtrance mixed Traitor promises" id="mixed-traitor-promise-guidance">
    <h3>Your mixed Traitor promises</h3>
    <ul>{own.map(promise => <li key={promise.event}>
      Turn {promise.turn}, {game.combatLocations.find(location => location.id === promise.territory)?.name ?? promise.territory}: You answered {promise.answer ? 'Yes' : 'No'} to {truthQuestionText({ kind: 'mixedTraitorCall',
        target: promise.player, battle: promise.battle, territory: promise.territory, mixed: promise.mixed }, leaderName,
      id => game.combatLocations.find(location => location.id === id)?.name ?? id,
      id => game.players.find(player => player.id === id)?.name ?? id)}
      {promise.released ? ' Released: this whole commitment is no longer possible.'
        : promise.fulfilled ? ' Fulfilled: this whole commitment is complete.' : ' This whole answer is binding for this battle’s Traitor declaration.'}
    </li>)}</ul>
    <p>Current facts are snapshotted at the answer. They create no promise to keep cards, spice or forces afterward.
      Only the aggregate answer is shared. Individual fact answers and any reduced declaration commitment remain private.
      AND requires every condition; OR requires at least one. No negates the whole expression, not each condition separately.</p>
    <p className="fine">A constant whole answer is complete immediately without a declaration commitment.
      A remaining commitment completes at your original native Reveal or decline declaration.
      This concerns the declaration: a later Karama or betrayal response can still prevent its effect.
      Use the ordinary battle controls for the currently legal declaration choices.
      {' '}<a href="/rules#truthtrance-mixed-traitor">Mixed Traitor rules</a>.</p>
  </section>;
}
