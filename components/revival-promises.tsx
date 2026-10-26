'use client';

import type { Action, GameView } from '@/game/engine';
import { liveRevivalPromises, revivalClaimText, revivalPromiseModeSupported } from '@/game/revival-promises';
import { Button } from './ui/button';

type RevivalPromiseProps = { game: GameView; busy: boolean; send: (action: Action) => void };

/** Preserve the server's exact native return/Ready quote. The client checks
 * only the live personalized event and current owned action opportunity. */
export function RevivalPromiseGuideButton(props: RevivalPromiseProps) {
  const game = props.game, guide = game.revivalPromiseGuide;
  if (!guide) return null;
  const actor = game.me, turn = game.turn, order = game.revivalOrder;
  const action = guide.action, event = action.revivalPromiseEvent, signature = JSON.stringify(action);
  const canAct = () => {
    const current = props.game, me = current.players.find(player => player.id === current.me);
    return !props.busy && current === game && revivalPromiseModeSupported(current) &&
      current.status === 'playing' && current.phase === 4 && current.me === actor && current.turn === turn &&
      !current.ready.includes(actor) && current.revivalOrder === order &&
      (!current.revivalOrder || current.revivalOrder.turn === turn && current.revivalOrder.remaining[0] === actor && current.active === actor) &&
      current.revivalPromiseGuide === guide && current.revivalPromiseGuide.action === action && JSON.stringify(action) === signature &&
      typeof event === 'string' && (action.type === 'revive' || action.type === 'ready') &&
      liveRevivalPromises(current.revivalPromises, actor, turn).some(promise => promise.event === event) && !!me && !me.autopilot &&
      !current.truthtrance && !current.response && !current.decision && !current.phaseOpening &&
      !current.automaticContinuationPending && !current.roomControl?.paused && !current.roomControl?.closed;
  };
  return <Button className="game-action min-h-11 whitespace-normal" data-testid="revival-promise-guide"
    disabled={!canAct()} onClick={() => { if (canAct()) props.send(action); }}>
    {action.type === 'revive'
      ? `Revive ${typeof action.amount === 'number' ? action.amount : 'the suggested number of'} forces while honoring your answers`
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
    {waiting && <p>Your Revival opportunity is still ahead; this promise remains visible while the current actor finishes.</p>}
    <RevivalPromiseGuideButton {...props} />
  </section>;
}
