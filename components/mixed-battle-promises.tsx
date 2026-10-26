'use client';

import type { GameView } from '@/game/engine';
import { truthQuestionText } from '@/game/truthtrance';
import { CHEAP_HERO_TRAITOR } from '@/game/traitors';

/** The original question and whole answer remain visible after this battle.
 * Assistance belongs to the native battle panel; facts and residuals stay private. */
export function MixedBattlePromises({ game }: { game: GameView }) {
  const own = game.mixedBattlePromises.filter(promise => promise.player === game.me);
  if (!own.length) return null;
  const leaderName = (id: string) => id === CHEAP_HERO_TRAITOR ? 'Cheap Hero / Heroine'
    : game.allLeaders.find(leader => leader.id === id)?.name ?? id;
  return <section className="notice space-y-3" aria-label="Your Truthtrance mixed battle promises" id="mixed-battle-promise-guidance">
    <h3>Your mixed battle promises</h3>
    <ul>{own.map(promise => <li key={promise.event}>
      Turn {promise.turn}: You answered {promise.answer ? 'Yes' : 'No'} to {truthQuestionText({ kind: 'mixedBattlePlan',
        target: promise.player, battle: promise.battle, territory: promise.territory, mixed: promise.mixed }, leaderName,
      id => game.combatLocations.find(location => location.id === id)?.name ?? id,
      id => game.players.find(player => player.id === id)?.name ?? id)}
      {promise.released ? ' Released: this whole commitment is no longer possible.'
        : promise.fulfilled ? ' Fulfilled: this whole commitment is complete.' : ' This whole answer is binding for this battle.'}
    </li>)}</ul>
    <p>Battle conditions concern your actual plan in the named battle, including an already fixed, sealed or revealed plan.
      Current facts are snapshotted at the answer. They create no promise to keep cards, spice or forces afterward.
      Only the aggregate answer is shared. Individual fact answers and any reduced plan commitment remain private.
      AND requires every condition; OR requires at least one. No negates the whole expression, not each condition separately.</p>
    <p className="fine">An unknown current fact uses the conservative plan commitment that guarantees the whole answer;
      if no such answer is possible, the answer is I don’t know. No alternate route is forced.
      An open commitment completes when both plans are revealed; sealing your own plan does not finish it.
      Native Voice, Prescience, card, leader, force and payment rules still apply.
      {' '}<a href="/rules#truthtrance-mixed-battle">Mixed battle rules</a>.</p>
  </section>;
}
