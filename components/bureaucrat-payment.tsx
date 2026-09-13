'use client';

import type { Action, GameView } from '@/game/engine';
import { Button } from '@/components/ui/button';

export function BureaucratPayment({
  game,
  act,
  busy,
}: {
  game: GameView;
  act: (action: Action) => void;
  busy: boolean;
}) {
  const pending = game.bureaucrat?.pending;
  const decision = game.decision;
  if (
    !pending ||
    decision?.kind !== 'bureaucratPayment' ||
    decision.player !== game.me ||
    decision.event !== pending.event ||
    pending.owner !== game.me
  )
    return null;
  const payer = game.players.find((player) => player.id === pending.payer)?.name ?? pending.payer;
  const payee = game.players.find((player) => player.id === pending.payee)?.name ?? pending.payee;
  const redirectAmount = pending.amount - pending.redirect;
  return (
    <section className="min-w-0 space-y-3" aria-label="Bureaucrat payment">
      <h3 className="font-serif text-xl">Bureaucrat payment</h3>
      <p className="text-base leading-7">
        The payment from {payer} to {payee} is {pending.amount} spice. You may redirect {pending.redirect}{' '}
        spice to the Bank: {payee} receives {redirectAmount} spice and the Bank receives{' '}
        {pending.redirect}, while {payer} still pays the full amount.
      </p>
      {pending.kind === 'bribe' && (
        <p className="text-base leading-7">
          The recipient keeps this spice in front of their shield until the next Mentat Pause.
          It cannot be spent before then.
        </p>
      )}
      <p className="fine">
        Allowing the full payment preserves Bureaucrat for later use this phase.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          className="min-h-11 whitespace-normal"
          disabled={busy}
          onClick={() =>
            !busy && act({ type: 'decision', event: pending.event, redirect: true })
          }
        >
          Redirect {pending.redirect} spice to the Bank
        </Button>
        <Button
          variant="outline"
          className="min-h-11 whitespace-normal"
          disabled={busy}
          onClick={() =>
            !busy && act({ type: 'decision', event: pending.event, redirect: false })
          }
        >
          Allow full {pending.amount}-spice payment
        </Button>
      </div>
    </section>
  );
}
