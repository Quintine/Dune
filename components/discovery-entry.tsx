'use client';

import { useId, useState } from 'react';
import type { Action, GameView } from '@/game/engine';
import { splitLocation, territory } from '@/game/board';
import { DISCOVERY_LOCATION_BY_ID } from '@/game/discoveries';
import { specialForceName } from '@/game/combat';
import {
  discoveryEntryDeclineAction,
  discoveryEntryMoveAction,
} from '@/game/discovery-entry-options';
import type { DiscoveryEntrySource } from '@/game/discovery-entry';
import { Button } from './ui/button';
import { Input } from './ui/input';

type Props = {
  game: GameView;
  act: (action: Action) => void;
  busy: boolean;
};
type Counts = Record<string, { normal: number; elite: number }>;

export function DiscoveryEntryDecision({ game, act, busy }: Props) {
  const decision = game.decision,
    offer = game.discoveryEntry;
  if (
    decision?.kind !== 'discoveryEntry' ||
    decision.player !== game.me ||
    !offer ||
    offer.owner !== game.me ||
    offer.event !== decision.event
  )
    return null;
  return (
    <DiscoveryEntryChoice
      key={`${offer.event}:${offer.token}:${offer.owner}`}
      game={game}
      act={act}
      busy={busy}
    />
  );
}

function DiscoveryEntryChoice({ game, act, busy }: Props) {
  const controlId = useId();
  const offer = game.discoveryEntry!;
  const [counts, setCounts] = useState<Counts>(() =>
    Object.fromEntries(
      offer.sources.map((source) => [
        source.source,
        { normal: source.normal, elite: source.elite },
      ]),
    ),
  );
  const me = game.players.find((player) => player.id === game.me)!;
  const eliteName = specialForceName(me.faction);
  const groups: DiscoveryEntrySource[] = offer.sources.flatMap((source) => {
    const selected = counts[source.source] ?? { normal: 0, elite: 0 };
    return selected.normal + selected.elite > 0
      ? [{ source: source.source, ...selected }]
      : [];
  });
  const amount = groups.reduce(
    (sum, group) => sum + group.normal + group.elite,
    0,
  );
  const move = discoveryEntryMoveAction(game, groups);
  const decline = discoveryEntryDeclineAction(game);
  const disabled = busy || !!me.autopilot || !!offer.blocked;

  const setCount = (
    source: DiscoveryEntrySource,
    kind: 'normal' | 'elite',
    value: number,
  ) => {
    const maximum = source[kind];
    const next = Number.isFinite(value)
      ? Math.max(0, Math.min(maximum, Math.floor(value)))
      : 0;
    setCounts((current) => ({
      ...current,
      [source.source]: {
        ...(current[source.source] ?? { normal: 0, elite: 0 }),
        [kind]: next,
      },
    }));
  };
  const selectAll = (selected: boolean) =>
    setCounts(
      Object.fromEntries(
        offer.sources.map((source) => [
          source.source,
          selected
            ? { normal: source.normal, elite: source.elite }
            : { normal: 0, elite: 0 },
        ]),
      ),
    );

  return (
    <section aria-label="Discovery location entry" className="space-y-4">
      <div>
        <h3>Enter {DISCOVERY_LOCATION_BY_ID[offer.destination].name}</h3>
        <p>
          Move any number of your non-advisor forces from{' '}
          {territory(offer.parent).name} into this newly revealed location.
          This free entry happens before the storm and does not use shipment or
          movement.
        </p>
      </div>
      {offer.blocked && (
        <p className="notice" aria-live="polite">
          {offer.blocked}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={disabled || !offer.sources.length}
          onClick={() => selectAll(true)}
        >
          Select all forces
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={disabled || !offer.sources.length}
          onClick={() => selectAll(false)}
        >
          Clear selection
        </Button>
      </div>
      <div className="space-y-3">
        {offer.sources.map((source) => {
          const selected = counts[source.source] ?? { normal: 0, elite: 0 };
          const where = splitLocation(source.source);
          const sourceId = `${controlId}-${source.source.replace(/[^a-z0-9_-]/gi, '-')}`;
          return (
            <fieldset
              key={source.source}
              className="space-y-2 rounded-lg border border-[#a88b60]/40 p-3"
            >
              <legend className="px-1 font-semibold">
                {territory(where.territory).name} · sector {where.sector}
              </legend>
              <p className="fine">
                Available: {source.normal} ordinary
                {source.elite > 0
                  ? ` · ${source.elite} ${eliteName}`
                  : ''}
              </p>
              <label className="grid gap-1" htmlFor={`${sourceId}-normal`}>
                <span>Ordinary forces</span>
                <Input
                  id={`${sourceId}-normal`}
                  aria-label={`${source.source} ordinary forces`}
                  type="number"
                  min={0}
                  max={source.normal}
                  value={selected.normal}
                  disabled={disabled}
                  onChange={(event) =>
                    setCount(source, 'normal', Number(event.target.value))
                  }
                />
              </label>
              {source.elite > 0 && (
                <label className="grid gap-1" htmlFor={`${sourceId}-elite`}>
                  <span>{eliteName}</span>
                  <Input
                    id={`${sourceId}-elite`}
                    aria-label={`${source.source} ${eliteName}`}
                    type="number"
                    min={0}
                    max={source.elite}
                    value={selected.elite}
                    disabled={disabled}
                    onChange={(event) =>
                      setCount(source, 'elite', Number(event.target.value))
                    }
                  />
                </label>
              )}
            </fieldset>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          className="game-action"
          disabled={disabled || !move}
          onClick={() => {
            if (move) act(move);
          }}
        >
          Move {amount} {amount === 1 ? 'force' : 'forces'} inside
        </Button>
        <Button
          className="game-action"
          variant="outline"
          disabled={busy || !!me.autopilot || !decline}
          onClick={() => {
            if (decline) act(decline);
          }}
        >
          Leave forces outside
        </Button>
      </div>
    </section>
  );
}
