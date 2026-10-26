'use client';

import type { Action, GameView } from '@/game/engine';
import { bribeAction } from '@/game/bribe-options';
import { bribeClaimText, bribePromiseModeSupported, liveBribePromises } from '@/game/bribe-promises';
import { liveBribeExpressionPromises } from '@/game/bribe-expression-promises';
import { Button } from './ui/button';

type BribePromiseProps = { game: GameView; busy: boolean; send: (action: Action) => void };

/** Native timing/funding remains in the current projected bribe options. An
 * ordinary bribe may be made outside this sender's phase action turn. */
export function BribePromiseGuideButton(props: BribePromiseProps) {
  const game = props.game, guide = game.bribePromiseGuide;
  if (!guide) return null;
  const actor = game.me, turn = game.turn, phase = game.phase, action = guide.action;
  const event = action.bribePromiseEvent, signature = JSON.stringify(action);
  const canAct = () => {
    const current = props.game, me = current.players.find(player => player.id === current.me), options = current.bribeOptions;
    const target = typeof action.target === 'string' ? current.players.find(player => player.id === action.target) : undefined;
    const limit = options.targets.find(recipient => recipient.id === action.target);
    return !props.busy && current === game && bribePromiseModeSupported(current) && current.status === 'playing' &&
      Number.isSafeInteger(current.phase) && current.phase >= 0 && current.phase <= 8 && current.phase === phase &&
      current.turn === turn && current.me === actor &&
      current.bribePromiseGuide === guide && current.bribePromiseGuide.action === action && JSON.stringify(action) === signature &&
      action.type === 'bribe' && typeof event === 'string' &&
      (liveBribePromises(current.bribePromises, actor, turn).some(promise => promise.event === event) ||
        liveBribeExpressionPromises(current.bribeExpressionPromises, actor, turn).some(promise => promise.event === event)) &&
      !!me && !me.autopilot && !!target && target.id !== actor && target.id !== me.ally &&
      options.blocked === null && Number.isSafeInteger(options.available) &&
      typeof action.amount === 'number' && action.amount <= options.available &&
      !!limit && Number.isSafeInteger(limit.maximum) && action.amount <= limit.maximum &&
      !!bribeAction(options, target.id, action.amount) &&
      !current.truthtrance && !current.response && !current.decision && !current.phaseOpening &&
      !current.automaticContinuationPending && !current.roomControl?.paused && !current.roomControl?.closed;
  };
  const recipient = game.players.find(player => player.id === action.target)?.name ?? 'the quoted recipient';
  return <Button className="game-action min-h-11 whitespace-normal" data-testid="bribe-promise-guide"
    disabled={!canAct()} onClick={() => { if (canAct()) props.send(action); }}>
    Pay {typeof action.amount === 'number' ? action.amount : 'the quoted'} spice to {recipient} while honoring your answers
  </Button>;
}

export function BribePromises(props: BribePromiseProps) {
  const own = props.game.bribePromises.filter(promise => promise.player === props.game.me);
  if (!own.length) return null;
  const name = (id: string) => props.game.players.find(player => player.id === id)?.name ?? 'the named recipient';
  return <section className="notice space-y-3" aria-label="Your Truthtrance bribe promises" id="bribe-promise-guidance">
    <h3>Your bribe promises</h3>
    <ul>{own.map(promise => <li key={promise.event}>
      Turn {promise.turn}: You answered {promise.answer ? 'Yes' : 'No'} to {bribeClaimText(promise, name)}.
      {' '}Recorded future ordinary payments to {name(promise.recipient)}: {promise.progress} spice.
      {promise.released ? ' Released: this commitment is no longer possible.'
        : promise.fulfilled ? ' Fulfilled: this commitment is complete.' : ' This answer is binding for this turn.'}
    </li>)}</ul>
    <p>
      Yes requires reaching the cumulative minimum while it remains possible; preserve the needed spendable spice.
      No forbids reaching that minimum during the rest of this turn. Smaller payments to the named recipient add together.
      Prior payments, gifts and ally aid do not count.
    </p>
    <p className="fine">
      The sender pays immediately. The recipient collects the payment at the start of Mentat Pause.
      Payments made during Mentat Pause wait until the start of next turn&apos;s Mentat Pause.
      Ordinary bribes can be paid out of turn when the current bribe controls permit them; original timing and payment rules still apply.
      {' '}<a href="/rules#truthtrance-bribe">Bribe promise rules</a>.
    </p>
    <BribePromiseGuideButton {...props} />
  </section>;
}
