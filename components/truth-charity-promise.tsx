'use client';

import type { Action, GameView } from '@/game/engine';
import { bribeAction } from '@/game/bribe-options';
import { Button } from './ui/button';

type Props = { game: GameView; busy: boolean; send: (action: Action) => void };

/** The server supplies an exact native claim or payment, never a simulated transfer. */
export function TruthCharityPromise({ game, busy, send }: Props) {
  const own = game.truthCharityPromises.filter(promise => promise.turn === game.turn && promise.player === game.me);
  if (!own.length) return null;
  const guide = game.truthCharityGuide, actor = game.me, turn = game.turn, action = guide?.action;
  const signature = JSON.stringify(action), event = action?.charityPromiseEvent;
  const canAct = () => {
    const me = game.players.find(player => player.id === actor);
    const recipient = typeof action?.target === 'string' ? game.players.find(player => player.id === action.target) : undefined;
    const amount = action?.amount;
    const payment = action?.type === 'bribe' && !!me && !!recipient && recipient.id !== actor && recipient.id !== me.ally &&
      typeof amount === 'number' && !!bribeAction(game.bribeOptions, recipient.id, amount);
    const claim = action?.type === 'charity' && !!me && !me.charityClaimed &&
      !game.ready.includes(actor) && !game.charity.truthBlocked && !game.charity.incomePending &&
      !game.charity.orderBlocked && game.charity.amount > 0;
    return !busy && !!guide && !!action && game.truthCharityGuide === guide && guide.action === action &&
      JSON.stringify(action) === signature && typeof event === 'string' && action.charityPromiseTurn === turn &&
      game.truthCharityPromises.some(promise => promise.player === actor && promise.turn === turn &&
        promise.event === event && promise.answer && !promise.fulfilled && !promise.released) &&
      game.status === 'playing' && game.phase === 2 && game.me === actor && game.turn === turn &&
      !!me && !me.autopilot && (payment || claim) && !game.truthtrance && !game.response &&
      !game.decision && !game.phaseOpening && !game.automaticContinuationPending &&
      !game.roomControl?.paused && !game.roomControl?.closed;
  };
  const recipient = game.players.find(player => player.id === action?.target)?.name ?? 'the quoted recipient';
  return <section className="notice space-y-3" aria-label="Your Truthtrance Charity promises" id="charity-promise-guidance">
    <h3>Your Charity promises</h3>
    <ul>{own.map(promise => <li key={promise.event}>
      You answered {promise.answer ? 'Yes' : 'No'} to claiming Charity in this phase.
      {' '}{promise.released ? 'Released: this commitment is no longer possible.'
        : promise.fulfilled ? 'Fulfilled: this commitment is complete.' : 'This answer remains binding while possible.'}
    </li>)}</ul>
    <p>Yes requires an actual eligible claim after the answer; No forbids claiming during the rest of this Charity phase. Earlier claims do not count.</p>
    {guide && action?.type === 'bribe' && <p className="fine">The quoted payment can make you eligible for Charity. You pay immediately; the other player receives the bribe at the start of Mentat Pause.</p>}
    {guide && action && <Button className="game-action min-h-11 whitespace-normal" data-testid="charity-promise-guide"
      disabled={!canAct()} onClick={() => { if (canAct()) send(action); }}>
      {action.type === 'bribe' ? `Pay ${typeof action.amount === 'number' ? action.amount : 'the quoted'} spice to ${recipient} to prepare for Charity`
        : `Claim ${game.charity.amount} Charity spice to honor your answer`}
    </Button>}
  </section>;
}
