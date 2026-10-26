'use client';

import type { Action, GameView } from '@/game/engine';
import type { MixedActionExpression } from '@/game/mixed-action-question';
import type { BribePaymentClaim } from '@/game/mixed-bribe-question';
import { liveBribePromises } from '@/game/bribe-promises';
import { liveBribeExpressionPromises } from '@/game/bribe-expression-promises';
import { truthQuestionText } from '@/game/truthtrance';
import { CHEAP_HERO_TRAITOR } from '@/game/traitors';
import { BribePromiseGuideButton } from './bribe-promises';

function recipients(mixed: MixedActionExpression<BribePaymentClaim>): string[] {
  const found = new Set<string>();
  const visit = (node: MixedActionExpression<BribePaymentClaim>): void => {
    if (node.kind === 'action') found.add(node.action.recipient);
    else if (node.kind === 'and' || node.kind === 'or') node.terms.forEach(visit);
  };
  visit(mixed);
  return [...found];
}

/** Only the original question, aggregate answer and cumulative payments are
 * public. Never evaluate facts or inspect the private compiled commitment. */
export function MixedBribePromises(props: { game: GameView; busy: boolean; send: (action: Action) => void }) {
  const game = props.game, own = game.mixedBribePromises.filter(promise => promise.player === game.me);
  if (!own.length) return null;
  const name = (id: string) => game.players.find(player => player.id === id)?.name ?? 'the named recipient';
  const live = own.some(promise => promise.turn === game.turn && !promise.fulfilled && !promise.released);
  const sharedGuideElsewhere = liveBribePromises(game.bribePromises, game.me, game.turn).length > 0 ||
    liveBribeExpressionPromises(game.bribeExpressionPromises, game.me, game.turn).length > 0;
  return <section className="notice space-y-3" aria-label="Your Truthtrance mixed bribe promises" id="mixed-bribe-promise-guidance">
    <h3>Your mixed bribe promises</h3>
    <ul>{own.map(promise => <li key={promise.event}>
      Turn {promise.turn}: You answered {promise.answer ? 'Yes' : 'No'} to {truthQuestionText({ kind: 'mixedBribe', target: promise.player,
        turn: promise.turn, mixed: promise.mixed }, id => id === CHEAP_HERO_TRAITOR ? 'Cheap Hero / Heroine'
        : game.allLeaders.find(leader => leader.id === id)?.name ?? id,
      id => game.combatLocations.find(location => location.id === id)?.name ?? id, name)}
      {' '}Recorded future ordinary payments: {recipients(promise.mixed).map(recipient =>
        `${name(recipient)}: ${promise.progress.find(progress => progress.recipient === recipient)?.amount ?? 0} spice`).join('; ')}.
      {promise.released ? ' Released: this whole commitment is no longer possible.'
        : promise.fulfilled ? ' Fulfilled: this whole commitment is complete.' : ' This whole answer is binding for this turn.'}
    </li>)}</ul>
    <p>Current facts are evaluated at the answer. They create no promise to keep cards, spice or forces afterward.
      Only the aggregate answer is shared. Individual fact answers and any reduced future branch remain private.
      AND requires every condition; OR requires at least one. No negates the whole expression, not each condition separately.
      Legal alternatives remain available; no fixed branch is selected for you.</p>
    <p className="fine">Smaller payments to the same recipient add together after the answer. Prior payments, gifts and ally aid do not count.
      Preserve the spendable spice needed for your Yes answers.
      The sender pays immediately. The recipient collects the payment at the next Mentat opening.
      Payments made during Mentat Pause wait until the start of next turn&apos;s Mentat Pause.
      Collection does not count the payment a second time.
      Ordinary bribes can be paid out of turn when the current bribe controls permit them; original timing and payment rules still apply.
      {' '}<a href="/rules#truthtrance-mixed-bribe">Mixed bribe rules</a>.</p>
    {live && <p>{game.phase === 8
      ? 'Late payments still honor this turn’s answers; their recipients collect at next turn’s Mentat opening.'
      : 'Your next Mentat opening is still ahead. Accepted payments count now and their recipients collect at that opening.'}
      {' '}No stays binding until the actual turn ends; opening collection does not end it.</p>}
    {live && !sharedGuideElsewhere && <BribePromiseGuideButton {...props} />}
  </section>;
}
