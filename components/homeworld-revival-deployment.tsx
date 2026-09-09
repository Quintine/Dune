'use client';

import { useState } from 'react';
import type { Action, GameView } from '@/game/engine';
import {
  homeworldRevivalDeploymentCanAct,
  homeworldRevivalDeploymentChoice,
} from '@/game/homeworld-revival-deployment-options';
import { Button } from './ui/button';

type Props = {
  game: GameView;
  act: (action: Action) => void;
  busy: boolean;
};

export function HomeworldRevivalDeployment({ game, act, busy }: Props) {
  if (
    !game.homeworldRevivalDeployment ||
    game.homeworldRevivalDeployment.player !== game.me ||
    game.decision?.kind !== 'homeworldRevivalDeployment' ||
    game.decision.player !== game.me
  )
    return null;
  return (
    <DeploymentChoice
      key={game.homeworldRevivalDeployment.event}
      game={game}
      act={act}
      busy={busy}
    />
  );
}

function DeploymentChoice({ game, act, busy }: Props) {
  const offer = game.homeworldRevivalDeployment!;
  const [destination, setDestination] = useState(
    offer.destinations.find((target) => !target.blocked)?.id ?? '',
  );
  const canAct = homeworldRevivalDeploymentCanAct(game);
  const choice = homeworldRevivalDeploymentChoice(game, destination);
  const amount = offer.normal + offer.elite;
  return (
    <section aria-label="Revival deployment" className="space-y-3">
      <h3>
        {offer.kind === 'fedaykin'
          ? 'Place revived Fedaykin'
          : 'Place revived forces'}
      </h3>
      <p>
        Place the entire eligible revived group in one destination, or leave it
        in reserves.
      </p>
      <p className="fine">
        {offer.normal} ordinary · {offer.elite} starred · {amount} total
      </p>
      <label className="block space-y-1">
        <span>Revival destination</span>
        <select
          aria-label="Revival destination"
          className="w-full"
          value={destination}
          disabled={busy || !canAct || !!offer.blocked}
          onChange={(event) => setDestination(event.target.value)}
        >
          {!offer.destinations.some((target) => !target.blocked) && (
            <option value="">No legal revival destination</option>
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
          Place {amount} revived {amount === 1 ? 'force' : 'forces'}
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
