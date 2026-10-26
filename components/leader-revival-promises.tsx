'use client';

import type { Action, GameView } from '@/game/engine';
import { leaderRevivalClaimText, leaderRevivalPromiseModeSupported, liveLeaderRevivalPromises } from '@/game/leader-revival-promises';
import { Button } from './ui/button';

type LeaderRevivalPromiseProps = { game: GameView; busy: boolean; send: (action: Action) => void };
const leaderName = (game: GameView, id: string) => id === 'kwisatz' ? 'Kwisatz Haderach'
  : game.allLeaders.find(leader => leader.id === id)?.name ?? 'the named leader';

/** Forward the exact projected preparation or ordinary return packet. The
 * client does not reconstruct leader eligibility, cycle restrictions or cost. */
export function LeaderRevivalPromiseGuideButton(props: LeaderRevivalPromiseProps) {
  const game = props.game, guide = game.leaderRevivalPromiseGuide;
  if (!guide) return null;
  const actor = game.me, turn = game.turn, phase = guide.phase, order = game.revivalOrder;
  const action = guide.action, event = action.leaderRevivalPromiseEvent, signature = JSON.stringify(action);
  const canAct = () => {
    const current = props.game, me = current.players.find(player => player.id === current.me);
    const payment = phase === 3 && action.type === 'decision' &&
      current.decision?.kind === 'auctionPayment' && current.decision.player === actor;
    const native = current.richeseAuction;
    const nativePass = phase === 3 && action.type === 'richeseBid' && native &&
      native.event === action.event && !native.outcome && native.eligible.includes(actor) &&
      (native.method === 'silent' ? !native.submitted.includes(actor) && action.amount === 0
        : native.active === actor && action.amount === null) && action.allyPayment === 0;
    const request = current.revivalRequests[actor];
    const acceptedQuote = action.type === 'acceptLeaderRevival' && !!request && !request.declined &&
      typeof request.price === 'number' && request.price === action.leaderRevivalPrice;
    const opportunity = phase === 2
      ? !current.ready.includes(actor) && (action.type === 'charity' || action.type === 'ready')
      : phase === 3
        ? payment || nativePass || action.type === 'passBid' && !native && current.auction?.active === actor
        : phase === 4 && !current.ready.includes(actor) &&
          (action.type === 'reviveLeader' || action.type === 'reviveKwisatz' || acceptedQuote || action.type === 'revive' || action.type === 'ready') &&
          current.revivalOrder === order && (!current.revivalOrder || current.revivalOrder.turn === turn &&
            current.revivalOrder.remaining[0] === actor && current.active === actor);
    return !props.busy && current === game && leaderRevivalPromiseModeSupported(current) &&
      current.status === 'playing' && current.phase === phase && current.me === actor && current.turn === turn && opportunity &&
      current.leaderRevivalPromiseGuide === guide && current.leaderRevivalPromiseGuide.phase === phase &&
      current.leaderRevivalPromiseGuide.action === action && JSON.stringify(action) === signature && typeof event === 'string' &&
      liveLeaderRevivalPromises(current.leaderRevivalPromises, actor, turn).some(promise => promise.event === event) && !!me && !me.autopilot &&
      !current.truthtrance && !current.response && (!current.decision || payment) && !current.phaseOpening &&
      !current.automaticContinuationPending && !current.roomControl?.paused && !current.roomControl?.closed;
  };
  return <Button className="game-action min-h-11 whitespace-normal" data-testid="leader-revival-promise-guide"
    disabled={!canAct()} onClick={() => { if (canAct()) props.send(action); }}>
    {action.type === 'charity' ? 'Claim Charity for your later leader Revival'
      : action.type === 'richeseBid' ? action.amount === 0
        ? 'Submit zero in this Silent auction while preserving your leader Revival answers'
        : 'Pass this Richese bid while preserving your leader Revival answers'
      : action.type === 'passBid' ? 'Pass this bid while preserving your leader Revival answers'
      : action.type === 'decision' ? action.karama === true
        ? 'Use the quoted Karama auction payment for your later leader Revival'
        : 'Pay the current auction price while preserving your leader Revival answers'
      : action.type === 'reviveLeader' ? `Revive ${leaderName(game, typeof action.leader === 'string' ? action.leader : '')} while honoring your answers`
      : action.type === 'reviveKwisatz' ? 'Revive Kwisatz Haderach while honoring your answers'
      : action.type === 'acceptLeaderRevival' ? 'Accept the current quoted leader revival while honoring your answers'
      : action.type === 'revive' ? `Revive ${typeof action.amount === 'number' ? action.amount : 'the suggested number of'} ${action.amount === 1 ? 'force' : 'forces'} to prepare your leader Revival`
      : phase === 2 ? 'Finish Charity while preserving your leader Revival answers'
      : 'Finish Revival while honoring your named-leader answers'}
  </Button>;
}

export function LeaderRevivalPromises(props: LeaderRevivalPromiseProps) {
  const own = props.game.leaderRevivalPromises.filter(promise => promise.player === props.game.me);
  if (!own.length) return null;
  const live = liveLeaderRevivalPromises(own, props.game.me, props.game.turn).length > 0;
  const other = props.game.revivalOrder?.remaining[0];
  const waiting = live && (props.game.phase < 4 || props.game.phase === 4 && other && other !== props.game.me);
  return <section className="notice space-y-3" aria-label="Your Truthtrance leader Revival promises" id="leader-revival-promise-guidance">
    <h3>Your leader Revival promises</h3>
    <ul>{own.map(promise => <li key={promise.event}>
      Turn {promise.turn}: You answered {promise.answer ? 'Yes' : 'No'} to {leaderRevivalClaimText(promise, id => leaderName(props.game, id))}.
      {promise.released ? ' Released: this commitment is no longer possible.'
        : promise.fulfilled ? ' Fulfilled: this commitment is complete.' : ' This answer is binding for this turn.'}
    </li>)}</ul>
    <p>
      Yes requires the named leader’s future actual ordinary native return while it remains possible.
      No forbids that named ordinary return until your Revival opportunity ends this turn.
      A request alone is not a return. Prior returns, Ghola, foreign leaders and special card returns do not count.
    </p>
    <p className="fine">
      Original revival cycles, costs, limits and turn order still apply.
      Preparation may return forces or complete an earlier payment without returning the named leader.
      A guide may accept an existing, current Tleilaxu quote; it does not arrange a new agreement or promise future consent.
      {' '}<a href="/rules#truthtrance-leader-revival">Leader Revival promise rules</a>.
    </p>
    {props.game.phase < 4 && <p>
      Your leader Revival opportunity is still ahead. Continue the current phase and preserve its required resources;
      Charity and auction preparation do not themselves fulfill a named-leader answer.
    </p>}
    {waiting && props.game.phase === 4 && <p>Your leader Revival opportunity is still ahead; this promise remains visible while the current actor finishes.</p>}
    <LeaderRevivalPromiseGuideButton {...props} />
  </section>;
}
