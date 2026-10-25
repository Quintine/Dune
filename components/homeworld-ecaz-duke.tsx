'use client';

import type { Action, GameView } from '@/game/engine';
import { Button } from './ui/button';

export function HomeworldEcazDuke({
  game,
  act,
  busy,
}: {
  game: GameView;
  act: (action: Action) => void;
  busy: boolean;
}) {
  const offer = game.homeworldEcazDuke;
  if (!offer || offer.occupier !== game.me) return null;
  const blocked = offer.blocked ?? (!offer.event
    ? 'This Duke grant is not currently available.'
    : !offer.recipients.length ? 'No eligible recipient is currently available.' : null);
  const disabled = busy || blocked !== null;
  return (
    <section className="notice space-y-3" aria-label="Occupied Ecaz Duke grant">
      <h3 className="font-serif text-xl">Occupied Ecaz: grant Duke Vidal</h3>
      <p className="muted">
        Provisional occupation benefit: grant the living shared Duke Vidal to
        yourself or your reciprocal ally. The recipient may use him in one
        battle, following the Duke’s ordinary lifecycle. Only Ecaz may revive him.
      </p>
      {blocked !== null && (
        <p className="notice" id="homeworld-ecaz-duke-unavailable">{blocked}</p>
      )}
      <div className="flex flex-wrap gap-2">
        {offer.recipients.map((recipient) => (
          <Button
            key={recipient.id}
            data-testid={`homeworld-ecaz-duke-${recipient.id}`}
            className="game-action min-h-11 whitespace-normal"
            disabled={disabled}
            aria-describedby={blocked !== null ? 'homeworld-ecaz-duke-unavailable' : undefined}
            onClick={() => {
              if (!disabled && offer.event)
                act({ type: 'homeworldDuke', event: offer.event, recipient: recipient.id });
            }}
          >
            Grant Duke Vidal to {recipient.name}
          </Button>
        ))}
      </div>
    </section>
  );
}
