'use client';

import type { Action, GameView } from '@/game/engine';
import { territory } from '@/game/board';
import { Button } from './ui/button';

export function NexusFremenRideBetrayal({ game, act, busy }: {
  game: GameView;
  act: (action: Action) => void;
  busy: boolean;
}) {
  const reaction = game.nexusFremenRideBetrayal;
  if (!reaction) return null;
  const source = reaction.source;
  const rider = game.players.find(player => player.id === source.player)?.name ?? 'The rider';
  const responder = game.players.find(player => player.id === reaction.player)?.name ?? 'The current responder';
  const hasPassed = reaction.passed.includes(game.me);
  const canRespond = reaction.player === game.me && !hasPassed;
  const disabled = busy || game.status !== 'playing';
  return (
    <section className="notice min-w-0 space-y-3" aria-label="Fremen Nexus before-ride Betrayal">
      <h3>Fremen Nexus Betrayal · before a ride</h3>
      <p>
        {source.kind === 'wormRide'
          ? `${rider} has a worm ride from ${territory(source.territory).name} waiting.`
          : source.kind === 'nexusFremenCunningRide'
          ? `${rider} has a Fremen Nexus Cunning ride waiting.`
          : `${rider} has a Great Maker ride waiting.`}
      </p>
      <p className="fine">
        This before-ride response is offered without revealing anyone’s secret
        Nexus identity. Continue to allow the original ride choices, or use an
        eligible Fremen Nexus to prevent the remaining rides this turn.
      </p>
      <p className="fine">
        The worm, Spice Blow and any Nexus that have already resolved stay
        resolved. Prevention does not move or destroy forces. Previous payments
        and effects are not repeated.
      </p>
      {!canRespond ? (
        <p aria-live="polite">
          {hasPassed
            ? 'You have continued. Waiting for the remaining ride responses.'
            : `Waiting for ${responder} to respond before the ride.`}
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button
            data-testid="nexus-fremen-ride-continue"
            className="game-action min-h-11 whitespace-normal"
            disabled={disabled}
            onClick={() => {
              if (!disabled) act({ type: 'decision', event: reaction.event, use: false });
            }}
          >
            Continue · allow rides
          </Button>
          {reaction.canUse && (
            <Button
              data-testid="nexus-fremen-ride-prevent"
              className="game-action min-h-11 whitespace-normal"
              disabled={disabled}
              onClick={() => {
                if (!disabled) act({ type: 'decision', event: reaction.event, use: true });
              }}
            >
              Use Fremen Nexus · prevent remaining rides
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
