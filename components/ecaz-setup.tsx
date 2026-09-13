'use client';

import { useState } from 'react';
import type { Action, GameView } from '@/game/engine';
import {
  ECAZ_START_FORCES,
  ECAZ_START_LOCATIONS,
  quoteEcazStartingForces,
} from '@/game/ecaz-setup';
import { splitLocation } from '@/game/board';
import { Button } from './ui/button';
import { Input } from './ui/input';

export function EcazSetup({
  game,
  act,
  busy,
}: {
  game: GameView;
  act: (action: Action) => void;
  busy: boolean;
}) {
  const [placements, setPlacements] = useState<Record<string, number>>({
    [ECAZ_START_LOCATIONS[0]]: ECAZ_START_FORCES,
  });
  const me = game.players.find((player) => player.id === game.me);
  if (
    game.status !== 'setup' ||
    game.setupStage !== 'forces' ||
    me?.faction !== 'ecaz' ||
    me.reserves !== 20 ||
    !game.setupPending.includes(game.me)
  )
    return null;
  let quoted: Record<string, number> | null = null;
  try {
    quoted = quoteEcazStartingForces(placements);
  } catch {
    /* Show the allocation until its total is legal. */
  }
  const total = Object.values(placements).reduce(
    (sum, count) => sum + count,
    0,
  );
  return (
    <section aria-label="Ecaz starting forces" className="flex flex-col gap-3">
      <p>
        Place six forces in Imperial Basin. Choose how many go in each sector;
        fourteen forces remain in reserves.
      </p>
      {ECAZ_START_LOCATIONS.map((location) => (
        <label key={location} htmlFor={`ecaz-start-${location}`}>
          Imperial Basin · Sector {splitLocation(location).sector}
          <Input
            id={`ecaz-start-${location}`}
            type="number"
            min={0}
            max={ECAZ_START_FORCES}
            step={1}
            value={placements[location] ?? 0}
            disabled={busy}
            onChange={(event) =>
              setPlacements({
                ...placements,
                [location]: Number(event.target.value),
              })
            }
          />
        </label>
      ))}
      <p className="fine" aria-live="polite">
        {total} / {ECAZ_START_FORCES} forces assigned
      </p>
      <Button
        className="game-action min-h-11"
        disabled={busy || !quoted}
        onClick={() => {
          if (!busy && quoted) act({ type: 'ecazSetup', placements: quoted });
        }}
      >
        Place Ecaz starting forces
      </Button>
    </section>
  );
}
