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
  const initialMode = offer.blocked && !offer.removeBlocked ? 'remove' : 'add';
  const [mode, setMode] = useState<'add' | 'remove'>(initialMode);
  const [token, setToken] = useState(
    (initialMode === 'remove' ? offer.removable : offer.tokens)[0]?.id ?? '',
  );
  const [destination, setDestination] = useState(offer.destinations[0]?.id ?? '');
  const [useCunning, setUseCunning] = useState(false);
  const canAct = grummanCollectionCanAct(game);
  const tokens = mode === 'remove' ? offer.removable : offer.tokens;
  const destinations = useCunning && offer.cunning ? offer.cunning.destinations : offer.destinations;
  const choice = grummanCollectionChoice(game, token, mode === 'add' ? destination : '', mode, useCunning);
  const disabled = busy || !canAct;
  return (
    <section aria-label="Grumman collection" className="space-y-3">
      <p>
        Add one available Terror token or return one unrevealed placed token to
        hidden supply to collect 4 spice. Only one completed operation pays this
        Collection; your separate Mentat placement remains unchanged.
      </p>
      <label className="block space-y-1">
        <span>Grumman operation</span>
        <select aria-label="Grumman operation" className="w-full" value={mode} disabled={disabled}
          onChange={event => {
            const next = event.target.value === 'remove' ? 'remove' : 'add';
            setMode(next);
            setUseCunning(false);
            setToken((next === 'remove' ? offer.removable : offer.tokens)[0]?.id ?? '');
            setDestination(offer.destinations[0]?.id ?? '');
          }}>
          <option value="add">Add from supply</option>
          <option value="remove">Return placed token to hidden supply</option>
        </select>
      </label>
      <label className="block space-y-1">
        <span>Your Terror token</span>
        <select aria-label="Your Terror token" className="w-full" value={token}
          disabled={disabled || !tokens.length} onChange={event => setToken(event.target.value)}>
          {!tokens.length && <option value="">No eligible token</option>}
          {tokens.map(candidate => (
            <option key={candidate.id} value={candidate.id}>
              {TERROR_DEFINITIONS[candidate.kind].name}
              {'name' in candidate && typeof candidate.name === 'string' ? ` · ${candidate.name}` : ''}
            </option>
          ))}
        </select>
      </label>
      {mode === 'add' && <>
        {offer.cunning && <label className="decision-checkbox min-h-11">
          <input type="checkbox" checked={useCunning} disabled={disabled || !!offer.cunning.blocked}
            onChange={event => {
              const use = event.target.checked;
              setUseCunning(use);
              const choices = use ? offer.cunning!.destinations : offer.destinations;
              if (!choices.some(place => place.id === destination))
                setDestination(choices[0]?.id ?? '');
            }} />
          <span>Use Moritani Nexus Cunning for this eligible addition</span>
        </label>}
        <label className="block space-y-1">
          <span>{useCunning ? 'Destination Arrakis territory' : 'Destination stronghold'}</span>
          <select aria-label={useCunning ? 'Destination Arrakis territory' : 'Destination stronghold'}
            className="w-full" value={destination} disabled={disabled || !destinations.length}
            onChange={event => setDestination(event.target.value)}>
            {!destinations.length && <option value="">No eligible destination</option>}
            {destinations.map(target => <option key={target.id} value={target.id}>{target.name}</option>)}
          </select>
        </label>
        {offer.cunning && <p className="fine">
          Cunning requires an ordinary eligible supply addition at a stronghold
          already holding Terror. It spends the Nexus card, not your Mentat
          placement, and never permits relocation, Homeworlds or the Hidden
          Mobile Stronghold.
        </p>}
      </>}
      {mode === 'remove' && <p className="fine">
        The token stays unrevealed and becomes reusable in hidden supply.
        Hidden supply identities rotate; other placed tokens remain where they are.
      </p>}
      {choice.blocked && <p className="fine" aria-live="polite">{choice.blocked}</p>}
      <div className="flex flex-wrap gap-2">
        <Button className="game-action" disabled={busy || !choice.action}
          onClick={() => { if (choice.action) act(choice.action); }}>
          {mode === 'remove' ? 'Return token and collect 4 spice' : 'Add token and collect 4 spice'}
        </Button>
        <Button className="game-action" variant="outline" disabled={disabled}
          onClick={() => act({ type: 'decision', event: offer.event, decline: true })}>
          Pass Grumman collection
        </Button>
      </div>
    </section>
  );
}
