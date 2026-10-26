'use client';

import type { Action, GameView } from '@/game/engine';
import { allianceClaimText, alliancePromiseModeSupported } from '@/game/alliance-promises';
import { quoteNexusAlliance } from '@/game/nexus-alliance';
import { Button } from './ui/button';

type AlliancePromiseProps = { game: GameView; busy: boolean; send: (action: Action) => void };
const publicContext = (game: GameView) => ({
  players: game.players.map(player => ({ id: player.id, ally: player.ally })), offers: game.allianceOffers,
});

/** A guide may end a pair, accept real consent or confirm current membership.
 * It never sends a proposal on another player's behalf. */
export function AlliancePromiseGuideButton(props: AlliancePromiseProps) {
  const game = props.game, guide = game.alliancePromiseGuide, nexus = game.alliancePromiseNexus;
  if (!guide || !nexus) return null;
  const actor = game.me, turn = nexus.turn, action = guide.action;
  const event = action.alliancePromiseEvent, signature = JSON.stringify(action);
  const contextSignature = JSON.stringify(publicContext(game));
  const canAct = () => {
    const current = props.game, me = current.players.find(player => player.id === current.me);
    const live = current.alliancePromises.filter(promise => promise.player === actor && promise.turn === turn &&
      !promise.fulfilled && !promise.released);
    let ownedAction = action.type === 'ready' && !!me && live.every(promise => (me.ally === promise.partner) === promise.answer);
    if (action.type === 'alliance') {
      if (action.target === null) ownedAction = true;
      else if (typeof action.target === 'string' && action.target !== actor && current.players.some(player => player.id === action.target)) {
        try {
          const quote = quoteNexusAlliance({ ...publicContext(current), actor, target: action.target });
          ownedAction = !!quote.formed && live.every(promise => (quote.allies[actor] === promise.partner) === promise.answer);
        } catch { ownedAction = false; }
      }
    }
    return !props.busy && current === game && alliancePromiseModeSupported(current) && current.status === 'playing' &&
      current.phase === 1 && current.nexus && !current.spiceWindow && !current.ready.includes(actor) &&
      current.me === actor && current.turn === turn && current.alliancePromiseNexus?.turn === turn &&
      current.alliancePromiseGuide === guide && current.alliancePromiseGuide.action === action && JSON.stringify(action) === signature &&
      JSON.stringify(publicContext(current)) === contextSignature && typeof event === 'string' &&
      live.some(promise => promise.event === event) && ownedAction && !!me && !me.autopilot &&
      !current.truthtrance && !current.response && !current.decision && !current.phaseOpening &&
      !current.automaticContinuationPending && !current.roomControl?.paused && !current.roomControl?.closed;
  };
  const me = game.players.find(player => player.id === actor);
  const partner = game.players.find(player => player.id === action.target)?.name ?? 'the named partner';
  return <Button className="game-action min-h-11 whitespace-normal" data-testid="alliance-promise-guide"
    disabled={!canAct()} onClick={() => { if (canAct()) props.send(action); }}>
    {action.type === 'ready' ? 'Confirm Ready for this Nexus while honoring your answers'
      : action.target === null ? me?.ally ? 'Break your current alliance while honoring your answers'
        : 'Withdraw your alliance offer while honoring your answers'
      : `Accept ${partner}’s alliance invitation while honoring your answers`}
  </Button>;
}

export function AlliancePromises(props: AlliancePromiseProps) {
  const own = props.game.alliancePromises.filter(promise => promise.player === props.game.me);
  if (!own.length) return null;
  const name = (id: string) => props.game.players.find(player => player.id === id)?.name ?? 'the named partner';
  return <section className="notice space-y-3" aria-label="Your Truthtrance alliance promises" id="alliance-promise-guidance">
    <h3>Your alliance promises</h3>
    <ul>{own.map(promise => <li key={promise.event}>
      Turn {promise.turn}: You answered {promise.answer ? 'Yes' : 'No'} to {allianceClaimText(promise, name)}.
      {promise.released ? ' Released: this commitment is no longer possible.'
        : promise.fulfilled ? ' Fulfilled at the Nexus close.' : ' This answer stays binding until this Nexus closes.'}
    </li>)}</ul>
    <p>
      The answer concerns your final actual alliance membership at this Nexus close.
      Yes remains live after forming an alliance and settles only at the close.
      No requires ending without the named partner; a temporary alliance can still be ended before the close.
      Offers alone are not alliances.
    </p>
    <p className="fine">
      An owned Yes route needs an existing alliance or an actual reciprocal invitation.
      Neither answer promises another player’s consent or prevents their original actions.
      If no owned route exists, No or unknown may apply; the holder can ask again or save the card.
      Honor any earlier promises first; their own controls handle required payments.
      {' '}<a href="/rules#truthtrance-alliance">Alliance promise rules</a>.
    </p>
    <AlliancePromiseGuideButton {...props} />
  </section>;
}
