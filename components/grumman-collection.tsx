'use client';

import { useState } from 'react';
import type { Action, GameView } from '@/game/engine';
import { TERROR_DEFINITIONS } from '@/game/moritani-terror';
import {
  grummanCollectionCanAct,
  grummanCollectionChoice,
} from '@/game/grumman-collection-options';
import { Button } from './ui/button';

type Props = { game: GameView; act: (action: Action) => void; busy: boolean };

export function GrummanCollection({ game, act, busy }: Props) {
  if (
    !game.grummanCollection ||
    game.grummanCollection.player !== game.me ||
    game.decision?.kind !== 'grummanCollection' ||
    game.decision.player !== game.me
  )
    return null;
  return (
    <CollectionChoice
      key={game.grummanCollection.event}
      game={game}
      act={act}
      busy={busy}
    />
  );
}

function CollectionChoice({ game, act, busy }: Props) {
  const offer = game.grummanCollection!;
  const [token, setToken] = useState(offer.tokens[0]?.id ?? '');
  const [destination, setDestination] = useState(
    offer.destinations[0]?.id ?? '',
  );
  const canAct = grummanCollectionCanAct(game);
  const choice = grummanCollectionChoice(game, token, destination);
  const disabled = busy || !canAct || !!offer.blocked;
  return (
    <section aria-label="Grumman collection" className="space-y-3">
      <p>
        Add one available Terror token to a stronghold to collect 4 spice. You
        receive the spice only after the addition resolves.
      </p>
      <label className="block space-y-1">
        <span>Your Terror token</span>
        <select
          aria-label="Your Terror token"
          className="w-full"
          value={token}
          disabled={disabled || !offer.tokens.length}
          onChange={(event) => setToken(event.target.value)}
        >
          {!offer.tokens.length && <option value="">No available token</option>}
          {offer.tokens.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {TERROR_DEFINITIONS[candidate.kind].name}
            </option>
          ))}
        </select>
      </label>
      <label className="block space-y-1">
        <span>Destination stronghold</span>
        <select
          aria-label="Destination stronghold"
          className="w-full"
          value={destination}
          disabled={disabled || !offer.destinations.length}
          onChange={(event) => setDestination(event.target.value)}
        >
          {!offer.destinations.length && (
            <option value="">No available stronghold</option>
          )}
          {offer.destinations.map((target) => (
            <option key={target.id} value={target.id}>
              {target.name}
            </option>
          ))}
        </select>
      </label>
      {choice.blocked && (
        <p className="fine" aria-live="polite">
          {choice.blocked}
        </p>
      )}
      <p className="fine">Removal unavailable: {offer.removeBlocked}</p>
      <div className="flex flex-wrap gap-2">
        <Button
          className="game-action"
          disabled={busy || !choice.action}
          onClick={() => {
            if (choice.action) act(choice.action);
          }}
        >
          Add token and collect 4 spice
        </Button>
        <Button
          className="game-action"
          variant="outline"
          disabled={busy || !canAct}
          onClick={() =>
            act({ type: 'decision', event: offer.event, decline: true })
          }
        >
          Pass Grumman collection
        </Button>
      </div>
    </section>
  );
}
