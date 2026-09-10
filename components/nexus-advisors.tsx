'use client';

import { useState } from 'react';
import type { Action, GameView } from '@/game/engine';
import { gameTerritories } from '@/game/board';
import {
  nexusAdvisorAction,
  nexusAdvisorCanAct,
} from '@/game/nexus-advisor-options';
import { Button } from './ui/button';

type Props = { game: GameView; act: (action: Action) => void; busy: boolean };
export function NexusAdvisors({ game, act, busy }: Props) {
  const state = game.nexusAdvisors;
  if (state?.pending) {
    const places = gameTerritories(game);
    return (
      <section
        aria-label="Bene Gesserit Nexus conversion pending"
        className="notice"
      >
        <p>
          {game.players.find((p) => p.id === state.pending!.owner)?.name ??
            'Bene Gesserit'}{' '}
          declared advisor conversion in{' '}
          {state.pending.territories
            .map(
              (id) =>
                places.find((t) => t.id === id)?.name ??
                'an unavailable territory',
            )
            .join(', ')}
          .
        </p>
        <p>
          Karama can cancel the entire selection. The advisors become fighters
          together after this response.
        </p>
      </section>
    );
  }
  if (
    game.nexusCards?.card !== 'beneGesserit' ||
    game.players.find((p) => p.id === game.me)?.faction !== 'beneGesserit' ||
    !state?.offer
  )
    return null;
  return (
    <AdvisorSelection
      key={state.offer.event}
      game={game}
      act={act}
      busy={busy}
    />
  );
}

function AdvisorSelection({ game, act, busy }: Props) {
  const offer = game.nexusAdvisors!.offer!;
  const [selected, setSelected] = useState<string[]>([]);
  const places = gameTerritories(game);
  const eligible = offer.territories.filter(
    (choice) => !choice.blocked && choice.count > 0,
  );
  const disabled = busy || !nexusAdvisorCanAct(game);
  const action = nexusAdvisorAction(game, offer.event, selected);
  return (
    <section
      aria-label="Bene Gesserit Nexus Cunning"
      className="space-y-3 rounded-lg border border-[#a88b60]/50 p-3"
    >
      <h3>Bene Gesserit Nexus · Cunning</h3>
      <p>
        Choose territories whose advisors will become fighters. Every Bene
        Gesserit force in each selected territory changes together, across all
        sectors.
      </p>
      <p className="fine">
        This spends your Nexus card once. Karama may cancel the entire
        selection. It costs no spice and uses no shipment or movement allowance.
      </p>
      {offer.blocked && <p className="notice">{offer.blocked}</p>}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          disabled={disabled || !eligible.length}
          onClick={() =>
            setSelected(eligible.map((choice) => choice.territory))
          }
        >
          Select all available
        </Button>
        <Button
          variant="outline"
          disabled={disabled || !selected.length}
          onClick={() => setSelected([])}
        >
          Clear selection
        </Button>
      </div>
      {offer.territories.map((choice) => {
        const name =
          places.find((t) => t.id === choice.territory)?.name ??
          'Unavailable territory';
        return (
          <div
            key={choice.territory}
            className="rounded border border-[#a88b60]/40 p-3"
          >
            <label
              aria-label={`${name}: ${choice.count} advisors`}
              className="decision-checkbox min-h-11"
            >
              <input
                type="checkbox"
                checked={selected.includes(choice.territory)}
                disabled={disabled || !!choice.blocked || choice.count <= 0}
                onChange={() =>
                  setSelected((old) =>
                    old.includes(choice.territory)
                      ? old.filter((id) => id !== choice.territory)
                      : [...old, choice.territory],
                  )
                }
              />
              <span>
                {name} · {choice.count}{' '}
                {choice.count === 1 ? 'advisor' : 'advisors'}
              </span>
            </label>
            {choice.blocked && <p className="fine">{choice.blocked}</p>}
          </div>
        );
      })}
      {!eligible.length && (
        <p className="notice">
          No advisor group is currently available for this conversion.
        </p>
      )}
      <p className="fine" aria-live="polite">
        {selected.length} {selected.length === 1 ? 'territory' : 'territories'}{' '}
        selected.
      </p>
      <Button
        className="game-action min-h-11 whitespace-normal"
        disabled={disabled || !action}
        onClick={() => {
          if (!disabled && action) act(action);
        }}
      >
        Convert selected advisors to fighters
      </Button>
    </section>
  );
}
