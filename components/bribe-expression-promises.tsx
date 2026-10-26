'use client';

import type { Action, GameView } from '@/game/engine';
import { bribeExpressionRecipients, bribeExpressionText, liveBribeExpressionPromises } from '@/game/bribe-expression-promises';
import { liveBribePromises } from '@/game/bribe-promises';
import { BribePromiseGuideButton } from './bribe-promises';

type BribeExpressionPromiseProps = { game: GameView; busy: boolean; send: (action: Action) => void };

export function BribeExpressionPromises(props: BribeExpressionPromiseProps) {
  const game = props.game, own = game.bribeExpressionPromises.filter(promise => promise.player === game.me);
  if (!own.length) return null;
  const name = (id: string) => game.players.find(player => player.id === id)?.name ?? 'the named recipient';
  const live = liveBribeExpressionPromises(own, game.me, game.turn).length > 0;
  return <section className="notice space-y-3" aria-label="Your Truthtrance bribe expression promises" id="bribe-expression-promise-guidance">
    <h3>Your bribe expression promises</h3>
    <ul>{own.map(promise => <li key={promise.event}>
      Turn {promise.turn}: You answered {promise.answer ? 'Yes' : 'No'} to {bribeExpressionText(promise.claim, name)}.
      {' '}Recorded future ordinary payments: {bribeExpressionRecipients(promise.claim).map(recipient =>
        `${name(recipient)}: ${promise.progress.find(progress => progress.recipient === recipient)?.amount ?? 0} spice`).join('; ')}.
      {promise.released ? ' Released: this commitment is no longer possible.'
        : promise.fulfilled ? ' Fulfilled: this commitment is complete.' : ' This whole answer is binding for this turn.'}
    </li>)}</ul>
    <p>
      AND requires every condition; OR requires at least one. No negates the whole expression, not each condition separately.
      Legal alternatives remain available; no fixed branch is selected for you.
      Smaller payments to the same recipient add together after the answer. Prior payments, gifts and ally aid do not count.
      Preserve the spendable spice needed for your Yes answers.
    </p>
    <p className="fine">
      The sender pays immediately. The recipient collects the payment at the next Mentat opening.
      Payments made during Mentat Pause wait until the start of next turn&apos;s Mentat Pause.
      Collection does not count the payment a second time.
      Ordinary bribes can be paid out of turn when the current bribe controls permit them; original timing and payment rules still apply.
      {' '}<a href="/rules#truthtrance-bribe-expression">Bribe expression rules</a>.
    </p>
    {live && <p>{game.phase === 8
      ? 'Late payments still honor this turn’s answers; their recipients collect at next turn’s Mentat opening.'
      : 'Your next Mentat opening is still ahead. Accepted payments count now and their recipients collect at that opening.'}
      {' '}No stays binding until the actual turn ends; opening collection does not end it.</p>}
    {live && !liveBribePromises(game.bribePromises, game.me, game.turn).length && <BribePromiseGuideButton {...props} />}
  </section>;
}
