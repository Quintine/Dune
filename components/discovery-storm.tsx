'use client';

import type { Action, GameView } from '@/game/engine';
import { discoveryStormActions } from '@/game/discovery-storm-options';
import { Button } from './ui/button';

export function DiscoveryStormDecision({
  game,
  act,
  busy,
}: {
  game: GameView;
  act: (action: Action) => void;
  busy: boolean;
}) {
  const actions = discoveryStormActions(game),
    offer = game.ecologicalStorm;
  if (!offer || !actions.length) return null;
  const me = game.players.find((player) => player.id === game.me)!;
  return (
    <section aria-label="Ecological Testing Station" className="space-y-3">
      <p>
        Your forces occupy Ecological Testing Station. The storm will move{' '}
        {offer.base} sectors. You may decrease or increase this by one, or keep
        the ordinary movement.
      </p>
      <p className="fine">This choice cannot change Weather Control.</p>
      <div className="flex flex-wrap gap-2">
        {offer.options.map((option) => {
          const action = actions.find(
            (candidate) => candidate.delta === option.delta,
          )!;
          return (
            <Button
              key={option.delta}
              className="game-action"
              variant={option.delta === 0 ? 'outline' : 'default'}
              disabled={busy || !!me.autopilot}
              onClick={() => act(action)}
            >
              {option.delta === -1
                ? 'Decrease'
                : option.delta === 1
                  ? 'Increase'
                  : 'Keep'}
              : {option.distance} {option.distance === 1 ? 'sector' : 'sectors'}
            </Button>
          );
        })}
      </div>
    </section>
  );
}
