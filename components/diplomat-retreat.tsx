'use client';

import { useId, useState } from 'react';
import { splitLocation, territory } from '@/game/board';
import type { Action, GameView } from '@/game/engine';
import { Button } from './ui/button';

export function DiplomatRetreat({
  game,
  act,
  busy,
}: {
  game: GameView;
  act: (action: Action) => void;
  busy: boolean;
}) {
  const id = useId();
  const [destination, setDestination] = useState<string | null>(null);
  const [choiceIndex, setChoiceIndex] = useState(0);
  const decision = game.decision?.kind === 'diplomatRetreat' ? game.decision : null;
  if (!decision || decision.player !== game.me) return null;

  const selectedDestination = decision.destinations.find((offer) => offer.location === destination)
    ?? decision.destinations[0];
  const choice = selectedDestination?.choices[choiceIndex] ?? selectedDestination?.choices[0];
  const selectedLocation = selectedDestination ? splitLocation(selectedDestination.location) : null;

  return (
    <section className="flex flex-col gap-3" aria-label="Diplomat retreat choice">
      <p>
        Your skilled Diplomat lost this battle. Move up to their strength in
        undialed physical forces to one empty adjacent non-stronghold territory,
        or leave the forces where they are.
      </p>
      {selectedDestination && choice && selectedLocation ? (
        <>
          <label htmlFor={`${id}-destination`}>Retreat destination</label>
          <select
            id={`${id}-destination`}
            value={selectedDestination.location}
            disabled={busy}
            onChange={(event) => {
              setDestination(event.target.value);
              setChoiceIndex(0);
            }}
          >
            {decision.destinations.map((offer) => {
              const location = splitLocation(offer.location);
              return (
                <option key={offer.location} value={offer.location}>
                  {territory(location.territory).name} · sector {location.sector}
                </option>
              );
            })}
          </select>
          <label htmlFor={`${id}-forces`}>Physical forces to retreat</label>
          <select
            id={`${id}-forces`}
            value={selectedDestination.choices.indexOf(choice)}
            disabled={busy}
            onChange={(event) => setChoiceIndex(Number(event.target.value))}
          >
            {selectedDestination.choices.map((amount, index) => (
              <option key={`${amount.normal}:${amount.elite}`} value={index}>
                {amount.normal} ordinary · {amount.elite} elite
              </option>
            ))}
          </select>
          <Button
            className="game-action min-h-11 whitespace-normal"
            disabled={busy}
            onClick={() => !busy && act({
              type: 'decision', event: decision.event,
              destination: selectedDestination.location, normal: choice.normal, elite: choice.elite,
            })}
          >
            Retreat to {territory(selectedLocation.territory).name} · sector {selectedLocation.sector}
          </Button>
        </>
      ) : (
        <p className="muted">No legal retreat destination and force combination is available.</p>
      )}
      <Button
        variant="outline"
        className="game-action min-h-11 whitespace-normal"
        disabled={busy}
        onClick={() => !busy && act({
          type: 'decision', event: decision.event,
          destination: null, normal: 0, elite: 0,
        })}
      >
        Decline Diplomat retreat
      </Button>
    </section>
  );
}
