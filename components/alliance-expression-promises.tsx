'use client';

import type { Action, GameView } from '@/game/engine';
import { allianceExpressionText } from '@/game/alliance-expression-promises';
import { AlliancePromiseGuideButton } from './alliance-promises';

export function AllianceExpressionPromises(props: { game: GameView; busy: boolean; send: (action: Action) => void }) {
  const game = props.game, own = game.allianceExpressionPromises.filter(promise => promise.player === game.me);
  if (!own.length) return null;
  const name = (id: string) => game.players.find(player => player.id === id)?.name ?? 'the named partner';
  const live = own.some(promise => promise.turn === game.alliancePromiseNexus?.turn && !promise.fulfilled && !promise.released);
  const scalarOwnsGuide = game.alliancePromises.some(promise => promise.player === game.me &&
    promise.turn === game.alliancePromiseNexus?.turn && !promise.fulfilled && !promise.released);
  return <section className="notice space-y-3" aria-label="Your Truthtrance alliance expression promises" id="alliance-expression-promise-guidance">
    <h3>Your alliance expression promises</h3>
    <ul>{own.map(promise => <li key={promise.event}>
      Turn {promise.turn}: You answered {promise.answer ? 'Yes' : 'No'} to {allianceExpressionText(promise.claim, name)}.
      {promise.released ? ' Released: this commitment is no longer possible.'
        : promise.fulfilled ? ' Fulfilled at the Nexus close.' : ' This whole answer stays binding until this Nexus closes.'}
    </li>)}</ul>
    <p>Each condition concerns final actual alliance membership when this Nexus closes.
      AND requires every condition; OR requires at least one. No negates the whole expression, not each condition separately.
      Legal alternatives remain available; no fixed branch is selected for you.
      Yes and No settle only at the actual Nexus close. Forming an alliance does not fulfill the answer early.
      Offers alone are not alliances.</p>
    <p className="fine">An owned Yes route needs an existing alliance or an actual reciprocal invitation.
      Neither answer promises another player’s consent or prevents their original actions.
      If future consent is needed, unknown may apply; the holder can ask again or save the card.
      Honor any earlier promises first; their own controls handle required payments.
      {' '}<a href="/rules#truthtrance-alliance-expression">Alliance expression rules</a>.</p>
    {live && !scalarOwnsGuide && <AlliancePromiseGuideButton {...props} />}
  </section>;
}
