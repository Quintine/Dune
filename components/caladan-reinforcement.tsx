'use client';

import { useState } from 'react';
import type { Action, GameView } from '@/game/engine';
import {
  caladanReinforcementCanAct,
  caladanReinforcementChoice,
} from '@/game/caladan-reinforcement-options';
import { Button } from './ui/button';

type Props = { game: GameView; act: (action: Action) => void; busy: boolean };

export function CaladanReinforcement({ game, act, busy }: Props) {
  if (
    !game.caladanReinforcement ||
    game.caladanReinforcement.player !== game.me ||
    game.decision?.kind !== 'caladanReinforcement' ||
    game.decision.player !== game.me
  )
    return null;
  return (
    <ReinforcementChoice
      key={game.caladanReinforcement.event}
      game={game}
      act={act}
      busy={busy}
    />
  );
}

function ReinforcementChoice({ game, act, busy }: Props) {
  const offer = game.caladanReinforcement!;
  const [destination, setDestination] = useState(
    offer.destinations.find((target) => !target.blocked)?.id ?? '',
  );
  const canAct = caladanReinforcementCanAct(game);
  const choice = caladanReinforcementChoice(game, destination);
  return (
    <section aria-label="Caladan reinforcement" className="space-y-3">
      <p>
        Add one reserve force at the battle location, or leave it in reserves.
      </p>
      <label className="block space-y-1">
        <span>Reinforcement destination</span>
        <select
          aria-label="Reinforcement destination"
          className="w-full"
          value={destination}
          disabled={busy || !canAct || !!offer.blocked}
          onChange={(event) => setDestination(event.target.value)}
        >
          {!offer.destinations.some((target) => !target.blocked) && (
            <option value="">No legal reinforcement destination</option>
          )}
          {offer.destinations.map((target) => (
            <option
              key={target.id}
              value={target.id}
              disabled={!!target.blocked}
            >
              {target.name}
              {target.blocked ? ` — ${target.blocked}` : ''}
            </option>
          ))}
        </select>
      </label>
      {choice.blocked && (
        <p className="fine" aria-live="polite">
          {choice.blocked}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          className="game-action"
          disabled={busy || !choice.action}
          onClick={() => {
            if (choice.action) act(choice.action);
          }}
        >
          Add one reserve force
        </Button>
        <Button
          className="game-action"
          variant="outline"
          disabled={busy || !canAct}
          onClick={() =>
            act({ type: 'decision', event: offer.event, decline: true })
          }
        >
          Leave in reserves
        </Button>
      </div>
    </section>
  );
}
