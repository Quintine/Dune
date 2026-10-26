'use client';

import type { Action, GameView } from '@/game/engine';
import { truthQuestionText } from '@/game/truthtrance';
import { CHEAP_HERO_TRAITOR } from '@/game/traitors';
import { AlliancePromiseGuideButton } from './alliance-promises';

/** Show only the own original question and aggregate result. Raw current facts
 * cannot reveal which private future obligation the server compiled. */
export function MixedAlliancePromises(props: { game: GameView; busy: boolean; send: (action: Action) => void }) {
  const game = props.game, own = game.mixedAlliancePromises.filter(promise => promise.player === game.me);
  if (!own.length) return null;
  const name = (id: string) => game.players.find(player => player.id === id)?.name ?? 'the named partner';
  const live = own.some(promise => promise.turn === game.alliancePromiseNexus?.turn && !promise.fulfilled && !promise.released);
  const ownsLive = (promise: { player: string; turn: number; fulfilled?: boolean; released?: boolean }) =>
    promise.player === game.me && promise.turn === game.alliancePromiseNexus?.turn && !promise.fulfilled && !promise.released;
  const sharedGuideElsewhere = game.alliancePromises.some(ownsLive) || game.allianceExpressionPromises.some(ownsLive);
  return <section className="notice space-y-3" aria-label="Your Truthtrance mixed alliance promises" id="mixed-alliance-promise-guidance">
    <h3>Your mixed alliance promises</h3>
    <ul>{own.map(promise => <li key={promise.event}>
      Turn {promise.turn}: You answered {promise.answer ? 'Yes' : 'No'} to {truthQuestionText({ kind: 'mixedAlliance', target: promise.player,
        turn: promise.turn, mixed: promise.mixed }, id => id === CHEAP_HERO_TRAITOR ? 'Cheap Hero / Heroine'
        : game.allLeaders.find(leader => leader.id === id)?.name ?? id,
      id => game.combatLocations.find(location => location.id === id)?.name ?? id, name)}.
      {promise.released ? ' Released: this whole commitment is no longer possible.'
        : promise.fulfilled ? ' Fulfilled: this whole commitment is complete.' : ' This whole answer stays binding until this Nexus closes.'}
    </li>)}</ul>
    <p>Current facts are evaluated at the answer. They create no promise to keep cards, spice or forces afterward.
      Only the aggregate answer is shared. Individual fact answers and any reduced future branch remain private.
      AND requires every condition; OR requires at least one. No negates the whole expression, not each condition separately.
      Legal alternatives remain available; no fixed branch is selected for you.</p>
    <p className="fine">The future condition concerns final actual alliance membership when this Nexus closes.
      A remaining alliance obligation settles only at the actual Nexus close; forming an alliance does not fulfill it early.
      Offers alone are not alliances. A constant whole answer can already be complete without an alliance obligation.
      Neither answer promises another player’s consent or prevents their original actions.
      If future consent is needed, unknown may apply; the holder can ask again or save the card.
      Honor any earlier promises first; their own controls handle required payments.
      {' '}<a href="/rules#truthtrance-mixed-alliance">Mixed alliance rules</a>.</p>
    {live && !sharedGuideElsewhere && <AlliancePromiseGuideButton {...props} />}
  </section>;
}
