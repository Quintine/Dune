'use client';

import type { Action, GameView } from '@/game/engine';
import { Button } from './ui/button';

export function MoritaniExtortionNotice({ game }: { game: GameView }) {
  const deferred = game.extortion?.deferred ?? 0;
  const pending = game.extortion?.pending;
  if (!deferred && !pending) return null;

  const payer = pending && game.players.find((player) => player.id === pending.player);
  return (
    <section className="notice" aria-label="Moritani Extortion status">
      {deferred > 0 && (
        <p>
          Moritani Extortion: {deferred} spice from the bank is set aside for
          Moritani to collect during Mentat Pause. It is not yet spendable.
        </p>
      )}
      {pending && (
        <p>
          Moritani has collected the bank award. {payer?.name ?? 'The current player'}
          {' '}may pay {pending.amount} spice to prevent Extortion’s return, or decline.
          The first payment ends the opportunity; if everyone declines, the token
          returns to Moritani’s hidden supply.
        </p>
      )}
    </section>
  );
}

export function MoritaniExtortion({
  game,
  act,
  busy,
}: {
  game: GameView;
  act: (action: Action) => void;
  busy: boolean;
}) {
  const decision = game.decision;
  const pending = game.extortion?.pending;
  if (
    decision?.kind !== 'moritaniExtortion' ||
    decision.player !== game.me ||
    !pending ||
    pending.player !== game.me ||
    pending.event !== decision.event
  ) return null;

  const disabled = busy || !!game.response || !!game.truthtrance;
  return (
    <section className="notice min-w-0 space-y-3" aria-label="Your Moritani Extortion payment choice">
      <p>
        Pay Moritani {pending.amount} spice to remove the Extortion token permanently,
        or decline. The five-spice bank award has already been collected.
      </p>
      {!pending.canPay && (
        <p className="fine">You do not have enough spice to pay. You may decline.</p>
      )}
      <Button
        className="min-h-11 w-full whitespace-normal"
        disabled={disabled || !pending.canPay}
        onClick={() => act({ type: 'decision', event: decision.event, pay: true })}
      >
        Pay {pending.amount} spice to Moritani
      </Button>
      <Button
        variant="outline"
        className="min-h-11 w-full whitespace-normal"
        disabled={disabled}
        onClick={() => act({ type: 'decision', event: decision.event, pay: false })}
      >
        Decline payment
      </Button>
    </section>
  );
}
