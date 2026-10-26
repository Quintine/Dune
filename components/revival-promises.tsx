'use client';

import type { Action, GameView } from '@/game/engine';
import { liveRevivalPromises, revivalClaimText, revivalPromiseModeSupported } from '@/game/revival-promises';
import { Button } from './ui/button';

type RevivalPromiseProps = { game: GameView; busy: boolean; send: (action: Action) => void };

/** Preserve the server's exact preparation or native return/Ready quote. The
 * client checks only its live event and current owned action opportunity. */
export function RevivalPromiseGuideButton(props: RevivalPromiseProps) {
  const game = props.game, guide = game.revivalPromiseGuide;
  if (!guide) return null;
  const actor = game.me, turn = game.turn, phase = guide.phase, order = game.revivalOrder;
  const action = guide.action, event = action.revivalPromiseEvent, signature = JSON.stringify(action);
  const canAct = () => {
    const current = props.game, me = current.players.find(player => player.id === current.me);
    const payment = phase === 3 && action.type === 'decision' &&
      current.decision?.kind === 'auctionPayment' && current.decision.player === actor;
    const native = current.richeseAuction;
    const nativePass = phase === 3 && action.type === 'richeseBid' && native &&
      native.event === action.event && !native.outcome && native.eligible.includes(actor) &&
      (native.method === 'silent' ? !native.submitted.includes(actor) && action.amount === 0
        : native.active === actor && action.amount === null) && action.allyPayment === 0;
    const opportunity = phase === 2
      ? !current.ready.includes(actor) && (action.type === 'charity' || action.type === 'ready')
      : phase === 3
        ? payment || nativePass || action.type === 'passBid' && !native && current.auction?.active === actor
        : phase === 4 && !current.ready.includes(actor) && (action.type === 'revive' || action.type === 'ready') &&
          current.revivalOrder === order && (!current.revivalOrder || current.revivalOrder.turn === turn &&
            current.revivalOrder.remaining[0] === actor && current.active === actor);
    return !props.busy && current === game && revivalPromiseModeSupported(current) &&
      current.status === 'playing' && current.phase === phase && current.me === actor && current.turn === turn && opportunity &&
      current.revivalPromiseGuide === guide && current.revivalPromiseGuide.phase === phase &&
      current.revivalPromiseGuide.action === action && JSON.stringify(action) === signature && typeof event === 'string' &&
      liveRevivalPromises(current.revivalPromises, actor, turn).some(promise => promise.event === event) && !!me && !me.autopilot &&
      !current.truthtrance && !current.response && (!current.decision || payment) && !current.phaseOpening &&
      !current.automaticContinuationPending && !current.roomControl?.paused && !current.roomControl?.closed;
  };
  return <Button className="game-action min-h-11 whitespace-normal" data-testid="revival-promise-guide"
    disabled={!canAct()} onClick={() => { if (canAct()) props.send(action); }}>
    {action.type === 'charity' ? 'Claim Charity for your later Revival'
      : action.type === 'richeseBid' ? action.amount === 0
        ? 'Submit zero in this Silent auction while preserving your Revival answers'
        : 'Pass this Richese bid while preserving your Revival answers'
      : action.type === 'passBid' ? 'Pass this bid while preserving your Revival answers'
      : action.type === 'decision' ? action.karama === true
        ? 'Use the quoted Karama auction payment for your later Revival'
        : 'Pay the current auction price while preserving your Revival answers'
      : action.type === 'revive' ? `Revive ${typeof action.amount === 'number' ? action.amount : 'the suggested number of'} forces while honoring your answers`
      : phase === 2 ? 'Finish Charity while preserving your Revival answers'
      : 'Finish Revival while honoring your answers'}
  </Button>;
}

export function RevivalPromises(props: RevivalPromiseProps) {
  const own = props.game.revivalPromises.filter(promise => promise.player === props.game.me);
  if (!own.length) return null;
  const live = liveRevivalPromises(own, props.game.me, props.game.turn).length > 0;
  const other = props.game.revivalOrder?.remaining[0];
  const waiting = live && (props.game.phase < 4 || props.game.phase === 4 && other && other !== props.game.me);
  return <section className="notice space-y-3" aria-label="Your Truthtrance Revival promises" id="revival-promise-guidance">
    <h3>Your Revival promises</h3>
    <ul>{own.map(promise => <li key={promise.event}>
      Turn {promise.turn}: You answered {promise.answer ? 'Yes' : 'No'} to {revivalClaimText(promise)}.
      {' '}Recorded future ordinary returns: {promise.progress} {promise.counter === 'total' ? 'physical' : promise.counter} force{promise.progress === 1 ? '' : 's'}.
      {promise.released ? ' Released: this commitment is no longer possible.'
        : promise.fulfilled ? ' Fulfilled: this commitment is complete.' : ' This answer is binding for this turn.'}
    </li>)}</ul>
    <p>
      Yes requires reaching the cumulative minimum through future ordinary native returns while it remains possible.
      No keeps your cumulative future returns below that minimum, including across smaller split requests.
      Prior returns, card effects, Ghola and Emperor extra revivals do not count.
    </p>
    <p className="fine">
      Each normal or elite force counter counts once; total includes both types.
      Original revival costs, limits and turn order still apply. Optional modules remain outside this commitment.
      {' '}<a href="/rules#truthtrance-revival">Revival promise rules</a>.
    </p>
    {props.game.phase < 4 && <p>
      A current preparation may claim Charity, pass an auction bid, or complete an already committed auction payment.
      These steps preserve your later Revival; they do not count as returned forces.
    </p>}
    {waiting && <p>Your Revival opportunity is still ahead; {props.game.phase < 4
      ? 'continue the current phase and keep the required spice and forces available.'
      : 'this promise remains visible while the current actor finishes.'}</p>}
    <RevivalPromiseGuideButton {...props} />
  </section>;
}
