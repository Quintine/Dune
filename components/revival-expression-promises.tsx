'use client';

import type { Action, GameView } from '@/game/engine';
import { liveRevivalExpressionPromises, revivalExpressionPromiseModeSupported, revivalExpressionText } from '@/game/revival-expression-promises';
import { Button } from './ui/button';

type RevivalExpressionPromiseProps = { game: GameView; busy: boolean; send: (action: Action) => void };
const leaderName = (game: GameView, id: string) => id === 'kwisatz' ? 'Kwisatz Haderach'
  : game.allLeaders.find(leader => leader.id === id)?.name ?? 'the named leader';

/** Preserve the authoritative whole-expression preparation or return quote.
 * A guide suggests a legal next action without committing to a fixed branch. */
export function RevivalExpressionPromiseGuideButton(props: RevivalExpressionPromiseProps) {
  const game = props.game, guide = game.revivalExpressionPromiseGuide;
  if (!guide) return null;
  const actor = game.me, turn = game.turn, phase = guide.phase, order = game.revivalOrder;
  const action = guide.action, event = action.revivalExpressionPromiseEvent, signature = JSON.stringify(action);
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
          (action.type === 'revive' || action.type === 'reviveLeader' || action.type === 'reviveKwisatz' || acceptedQuote || action.type === 'ready') &&
          current.revivalOrder === order && (!current.revivalOrder || current.revivalOrder.turn === turn &&
            current.revivalOrder.remaining[0] === actor && current.active === actor);
    return !props.busy && current === game && revivalExpressionPromiseModeSupported(current) &&
      current.status === 'playing' && current.phase === phase && current.me === actor && current.turn === turn && opportunity &&
      current.revivalExpressionPromiseGuide === guide && current.revivalExpressionPromiseGuide.phase === phase &&
      current.revivalExpressionPromiseGuide.action === action && JSON.stringify(action) === signature && typeof event === 'string' &&
      (liveRevivalExpressionPromises(current.revivalExpressionPromises, actor, turn).some(promise => promise.event === event) ||
        (current.mixedRevivalPromises ?? []).some(promise => promise.event === event && promise.player === actor &&
          promise.turn === turn && !promise.fulfilled && !promise.released)) && !!me && !me.autopilot &&
      !current.truthtrance && !current.response && (!current.decision || payment) && !current.phaseOpening &&
      !current.automaticContinuationPending && !current.roomControl?.paused && !current.roomControl?.closed;
  };
  return <Button className="game-action min-h-11 whitespace-normal" data-testid="revival-expression-promise-guide"
    disabled={!canAct()} onClick={() => { if (canAct()) props.send(action); }}>
    {action.type === 'charity' ? 'Claim Charity while preserving your Revival expression answers'
      : action.type === 'richeseBid' ? action.amount === 0
        ? 'Submit zero in this Silent auction while preserving your Revival expression answers'
        : 'Pass this Richese bid while preserving your Revival expression answers'
      : action.type === 'passBid' ? 'Pass this bid while preserving your Revival expression answers'
      : action.type === 'decision' ? action.karama === true
        ? 'Use the quoted Karama auction payment while preserving your Revival expression answers'
        : 'Pay the current auction price while preserving your Revival expression answers'
      : action.type === 'reviveLeader' ? `Revive ${leaderName(game, typeof action.leader === 'string' ? action.leader : '')} while honoring the whole expression`
      : action.type === 'reviveKwisatz' ? 'Revive Kwisatz Haderach while honoring the whole expression'
      : action.type === 'acceptLeaderRevival' ? 'Accept the current quoted leader revival while honoring the whole expression'
      : action.type === 'revive' ? `Revive ${typeof action.amount === 'number' ? action.amount : 'the suggested number of'} ${action.amount === 1 ? 'force' : 'forces'} while honoring the whole expression`
      : phase === 2 ? 'Finish Charity while preserving your Revival expression answers'
      : 'Finish Revival while honoring the whole expression'}
  </Button>;
}

export function RevivalExpressionPromises(props: RevivalExpressionPromiseProps) {
  const own = props.game.revivalExpressionPromises.filter(promise => promise.player === props.game.me);
  if (!own.length) return null;
  const live = liveRevivalExpressionPromises(own, props.game.me, props.game.turn).length > 0;
  const other = props.game.revivalOrder?.remaining[0];
  const waiting = live && (props.game.phase < 4 || props.game.phase === 4 && other && other !== props.game.me);
  return <section className="notice space-y-3" aria-label="Your Truthtrance Revival expression promises" id="revival-expression-promise-guidance">
    <h3>Your Revival expression promises</h3>
    <ul>{own.map(promise => <li key={promise.event}>
      Turn {promise.turn}: You answered {promise.answer ? 'Yes' : 'No'} to {revivalExpressionText(promise.claim, id => leaderName(props.game, id))}.
      {' '}Future ordinary progress: {promise.progress.total} physical forces ({promise.progress.normal} normal, {promise.progress.elite} elite);
      {' '}returned leaders: {promise.progress.leaders.length ? promise.progress.leaders.map(id => leaderName(props.game, id)).join(', ') : 'none'}.
      {promise.released ? ' Released: this commitment is no longer possible.'
        : promise.fulfilled ? ' Fulfilled: this commitment is complete.' : ' This whole answer is binding for this turn.'}
    </li>)}</ul>
    <p>
      AND requires every condition; OR requires at least one. No negates the whole expression, not each condition separately.
      Legal alternatives remain available; no fixed branch is selected for you.
      Only future actual ordinary native force and named-leader returns after the answer count.
      Prior returns, requests alone, Ghola, foreign leaders and special card returns do not count.
    </p>
    <p className="fine">
      Physical force progress is cumulative across smaller returns; each normal or elite counter counts once.
      Original costs, revival cycles, limits and turn order still apply.
      A guide may accept an existing current Tleilaxu quote; it does not arrange new consent.
      {' '}<a href="/rules#truthtrance-revival-expression">Revival expression rules</a>.
    </p>
    {waiting && <p>Your Revival opportunity is still ahead; {props.game.phase < 4
      ? 'continue the current phase and preserve the resources for your whole answer.'
      : 'this promise remains visible while the current actor finishes.'}</p>}
    {live && <RevivalExpressionPromiseGuideButton {...props} />}
  </section>;
}
