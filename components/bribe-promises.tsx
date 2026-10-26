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
  const send = props.send, charity = game.charity;
  const charityOwner = action.type === 'charity' ? game.players.find(player => player.id === actor) : undefined;
  const charitySource = (current: GameView) => {
    const owner = current.players.find(player => player.id === actor);
    return JSON.stringify({ quote: current.charity, claimed: owner?.charityClaimed, spice: owner?.spice });
  };
  const charitySignature = action.type === 'charity' ? charitySource(game) : null;
  const canAct = () => {
    const current = props.game, me = current.players.find(player => player.id === current.me), options = current.bribeOptions;
    const target = typeof action.target === 'string' ? current.players.find(player => player.id === action.target) : undefined;
    const limit = options.targets.find(recipient => recipient.id === action.target);
    const payment = action.type === 'bribe' && !!me && !!target && target.id !== actor && target.id !== me.ally &&
      options.blocked === null && Number.isSafeInteger(options.available) &&
      typeof action.amount === 'number' && action.amount <= options.available &&
      !!limit && Number.isSafeInteger(limit.maximum) && action.amount <= limit.maximum &&
      !!bribeAction(options, target.id, action.amount);
    const claim = action.type === 'charity' && phase === 2 && !!me && me === charityOwner &&
      Object.keys(action).every(key => ['type', 'bribePromiseEvent'].includes(key)) &&
      !current.ready.includes(actor) && me.charityClaimed === false && current.charity === charity &&
      charitySource(current) === charitySignature && current.charity.incomePending === false &&
      Number.isSafeInteger(current.charity.amount) && current.charity.amount > 0;
    return !props.busy && props.send === send && current === game && bribePromiseModeSupported(current) && current.status === 'playing' &&
      Number.isSafeInteger(current.phase) && current.phase >= 0 && current.phase <= 8 && current.phase === phase &&
      current.turn === turn && current.me === actor &&
      current.bribePromiseGuide === guide && current.bribePromiseGuide.action === action && JSON.stringify(action) === signature &&
      typeof event === 'string' &&
      (liveBribePromises(current.bribePromises, actor, turn).some(promise => promise.event === event) ||
        liveBribeExpressionPromises(current.bribeExpressionPromises, actor, turn).some(promise => promise.event === event) ||
        current.mixedBribePromises.some(promise => promise.event === event && promise.player === actor && promise.turn === turn &&
          !promise.fulfilled && !promise.released)) &&
      !!me && !me.autopilot && (payment || claim) &&
      !current.truthtrance && !current.response && !current.decision && !current.phaseOpening &&
      !current.automaticContinuationPending && !current.roomControl?.paused && !current.roomControl?.closed;
  };
  const recipient = game.players.find(player => player.id === action.target)?.name ?? 'the quoted recipient';
  return <Button className="game-action min-h-11 whitespace-normal" data-testid="bribe-promise-guide"
    disabled={!canAct()} onClick={() => { if (canAct()) send(action); }}>
    {action.type === 'charity' ? `Claim ${game.charity.amount} Charity spice to continue your payments`
      : `Pay ${typeof action.amount === 'number' ? action.amount : 'the quoted'} spice to ${recipient} while honoring your answers`}
  </Button>;
}

export function BribePromises(props: BribePromiseProps) {
  const own = props.game.bribePromises.filter(promise => promise.player === props.game.me);
  if (!own.length) return null;
  const live = liveBribePromises(own, props.game.me, props.game.turn).length > 0;
  const pendingChoamIncome = live && props.game.status === 'playing' &&
    props.game.players.find(player => player.id === props.game.me)?.faction === 'choam' &&
    Number.isSafeInteger(props.game.phase) && props.game.phase >= 0 && props.game.phase <= 2 &&
    props.game.charity.incomePending && !props.game.charity.incomeCanceled && props.game.charity.multiplier > 0;
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
    {pendingChoamIncome && <p className="fine" data-testid="choam-pending-payment-income">
      Automatic CHOAM income resolves at the Charity opening. It is not current spendable cash.
      Your ordinary Charity claim is separate. Karama or opposing claims can change the funding.
      Current payment guides may still offer legal prepayments.</p>}
    <p className="fine">
      The sender pays immediately. The recipient collects the payment at the start of Mentat Pause.
      Payments made during Mentat Pause wait until the start of next turn&apos;s Mentat Pause.
      Ordinary bribes can be paid out of turn when the current bribe controls permit them; original timing and payment rules still apply.
      A legal timeline may use payments now, one remaining Charity claim and later installments.
      The future claim is not current spendable spice; only actual payments add to the recorded total.
      {' '}<a href="/rules#truthtrance-bribe">Bribe promise rules</a>.
    </p>
    {live && <BribePromiseGuideButton {...props} />}
  </section>;
}
