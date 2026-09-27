'use client';

import type { Action, GameView } from '@/game/engine';
import { nexusChoamBetrayalAction } from '@/game/nexus-choam-betrayal-options';
import { Button } from '@/components/ui/button';

export function NexusChoamBetrayal({
  game,
  act,
  busy,
}: {
  game: GameView;
  act: (action: Action) => void;
  busy: boolean;
}) {
  const offer = game.nexusChoamBetrayal;
  if (!offer || game.nexusCards?.card !== 'choam') return null;
  const action = nexusChoamBetrayalAction(game);
  const disabled = busy || !action;
  return (
    <section className="min-w-0 space-y-3" aria-label="CHOAM Nexus Betrayal">
      <h3 className="font-serif text-xl">CHOAM Betrayal</h3>
      <p className="text-base leading-7">
        Spend your CHOAM Nexus card to make {offer.target.name} discard one
        uniformly random held Treachery card.{' '}
        {offer.target.handSize !== null &&
          `CHOAM holds ${offer.target.handSize} ${offer.target.handSize === 1 ? 'card' : 'cards'} during Bidding. `}
        You do not choose or see the card before the ordinary discard reveal.
        CHOAM receives no spice.
      </p>
      {offer.blocked && <p className="notice">{offer.blocked}</p>}
      <Button
        className="game-action min-h-11 whitespace-normal"
        disabled={disabled}
        onClick={() => { if (!disabled && action) act(action); }}
      >
        Spend CHOAM Nexus for random discard
      </Button>
    </section>
  );
}
