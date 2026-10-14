'use client';

import type { Action, GameView } from '@/game/engine';
import { Button } from './ui/button';

export function NexusEmperorPayment({ game, send, busy }: {
  game: GameView;
  send: (action: Action) => void;
  busy: boolean;
}) {
  const decision = game.decision;
  if (decision?.kind !== 'nexusEmperorPayment' || decision.player !== game.me) return null;
  const own = game.players.find(player => player.id === game.me);
  const offer = game.nexusEmperorPayment;
  const emperor = offer && game.players.find(player => player.id === offer.emperor);
  const winner = offer && game.players.find(player => player.id === offer.winner);
  const disabled = busy || game.status !== 'playing' || game.phase !== 3 ||
    game.automaticContinuationPending || !!game.phaseOpening || !!game.response ||
    !!game.truthtrance || !!game.nexusTraitors?.pending ||
    !!game.roomControl?.paused || !!game.roomControl?.closed || !!own?.autopilot;
  const canUse = !!offer && offer.event === decision.event && offer.canUse && !offer.blocked;

  return (
    <section aria-label="Auction payment acknowledgement" className="notice min-w-0 space-y-3 break-words">
      <h3>Auction payment acknowledgement</h3>
      <p>Continue to allow the original winning bid to proceed. Every publicly possible unallied Nexus holder
        acknowledges this payment, regardless of their private card.</p>
      {offer && <>
        <h4>Emperor Nexus · Betrayal</h4>
        <p>Force {emperor?.name ?? offer.emperor} to cover the full {offer.price}-spice price of
          {' '}{winner?.name ?? offer.winner}’s original winning Treachery Card bid.</p>
        <p className="fine">Provisional interpretation, not a publisher ruling:
          {' '}{offer.policy} Your Nexus Card is spent. The buyer keeps their own spice.
          Original Emperor income may still be canceled without refunding the funded purchase.</p>
        {offer.blocked && <output className="fine block">{offer.blocked}</output>}
      </>}
      <Button className="game-action min-h-11 whitespace-normal" disabled={disabled}
        onClick={() => { if (!disabled) send({ type: 'nexusEmperorPayment', event: decision.event, use: false }); }}>
        Continue
      </Button>
      {canUse && <Button className="game-action min-h-11 whitespace-normal" disabled={disabled}
        onClick={() => { if (!disabled) send({ type: 'nexusEmperorPayment', event: decision.event, use: true }); }}>
        Use Emperor Nexus · force full-price payment
      </Button>}
    </section>
  );
}
