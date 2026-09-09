'use client';

import { useId, useState } from 'react';
import type { Action, GameView } from '@/game/engine';
import { location, splitLocation, territory } from '@/game/board';
import { Button } from './ui/button';
import { Input } from './ui/input';

const bounded = (value: number | undefined, minimum: number, maximum: number) =>
  Math.max(
    minimum,
    Math.min(maximum, Number.isSafeInteger(value) ? value! : minimum),
  );

/** A draft belongs to this Ambassador event, never to the entrant's normal move. */
export function AmbassadorMovement({
  game,
  act,
  busy,
}: {
  game: GameView;
  act: (action: Action) => void;
  busy: boolean;
}) {
  const id = useId();
  const [sourceId, setSourceId] = useState('');
  const [destinationKey, setDestinationKey] = useState('');
  const [forces, setForces] = useState<Record<string, number>>({});
  const [elites, setElites] = useState<Record<string, number>>({});
  const [takeMarker, setTakeMarker] = useState(false);
  const [fighters, setFighters] = useState(false);
  const entry = game.ambassadorEntry;
  if (
    entry?.stage !== 'move' ||
    entry.beneficiary !== game.me ||
    game.decision?.kind !== 'ecazAmbassador' ||
    game.decision.player !== game.me ||
    !entry.movement
  )
    return null;
  const sources = entry.movement.sources;
  const source = sources.find((s) => s.territory === sourceId) ?? sources[0];
  if (!source)
    return (
      <p className="m-0 text-sm leading-6">
        No legal relocation is currently available.
      </p>
    );
  const destinations = source.destinations;
  const destination =
    destinations.find(
      (d) => location(d.territory, d.sector) === destinationKey,
    ) ??
    destinations.find((d) => !d.blocked) ??
    destinations[0];
  const target = destination
    ? location(destination.territory, destination.sector)
    : '';
  const rows = source.sectors.map((s) => {
    const count = s.key === target ? 0 : bounded(forces[s.key], 0, s.forces);
    const minimum = Math.max(0, count - (s.forces - s.elites));
    return {
      ...s,
      count,
      minimum,
      maximum: Math.min(count, s.elites),
      elite: bounded(elites[s.key], minimum, Math.min(count, s.elites)),
    };
  });
  const selectedForces = Object.fromEntries(
    rows.filter((s) => s.count > 0).map((s) => [s.key, s.count]),
  );
  const selectedElites = Object.fromEntries(
    rows.filter((s) => s.count > 0).map((s) => [s.key, s.elite]),
  );
  const total = rows.reduce((n, s) => n + s.count, 0);
  const markerAtTarget =
    !!source.marker &&
    location(source.territory, source.marker.sector) === target;
  const includesMarker = !!source.marker && takeMarker && !markerAtTarget;
  const reason =
    destination?.blocked ??
    (!destination
      ? 'Choose an available destination.'
      : !total && !includesMarker
        ? 'Choose physical forces or the concealed No-Field to relocate.'
        : destination.maximum !== null &&
            total + Number(includesMarker) > destination.maximum
          ? `At most ${destination.maximum} entering forces are currently supported at this destination; the concealed marker counts as one.`
          : null);
  const chooseDestination = (key: string) => {
    setDestinationKey(key);
    setForces((old) => ({ ...old, [key]: 0 }));
    setElites((old) => ({ ...old, [key]: 0 }));
    setFighters(false);
  };
  const targetTerritories = [...new Set(destinations.map((d) => d.territory))];
  return (
    <div
      className="flex min-w-0 flex-col gap-4"
      aria-label="Ambassador force relocation"
    >
      <p className="m-0 text-sm leading-6">
        Relocate a group from one territory. This does not spend your ordinary
        shipment or movement. The Ambassador has already been triggered.
      </p>
      <label className="flex flex-col gap-2" htmlFor={`${id}-source`}>
        Source territory
        <select
          id={`${id}-source`}
          className="min-h-11"
          disabled={busy}
          value={source.territory}
          onChange={(event) => {
            setSourceId(event.target.value);
            setDestinationKey('');
            setForces({});
            setElites({});
            setTakeMarker(false);
            setFighters(false);
          }}
        >
          {sources.map((s) => (
            <option key={s.territory} value={s.territory}>
              {territory(s.territory).name}
            </option>
          ))}
        </select>
      </label>
      {rows.map((s) => (
        <fieldset
          className="flex min-w-0 flex-col gap-3 rounded-lg border p-3"
          key={s.key}
          disabled={busy}
        >
          <legend className="px-1 text-sm">
            Sector {splitLocation(s.key).sector} · {s.forces} physical forces
            available
          </legend>
          <label
            className="flex flex-col gap-2"
            htmlFor={`${id}-forces-${s.key}`}
          >
            Physical forces to relocate
            <Input
              id={`${id}-forces-${s.key}`}
              className="min-h-11"
              type="number"
              min={0}
              max={s.forces}
              step={1}
              value={s.count}
              disabled={s.key === target}
              onChange={(e) =>
                setForces({
                  ...forces,
                  [s.key]: bounded(Number(e.target.value), 0, s.forces),
                })
              }
            />
          </label>
          {s.elites > 0 && (
            <label
              className="flex flex-col gap-2"
              htmlFor={`${id}-elites-${s.key}`}
            >
              Elite forces included · {s.minimum}–{s.maximum}
              <Input
                id={`${id}-elites-${s.key}`}
                className="min-h-11"
                type="number"
                min={s.minimum}
                max={s.maximum}
                step={1}
                value={s.elite}
                disabled={s.key === target || !s.count}
                onChange={(e) =>
                  setElites({
                    ...elites,
                    [s.key]: bounded(
                      Number(e.target.value),
                      s.minimum,
                      s.maximum,
                    ),
                  })
                }
              />
            </label>
          )}
          {s.key === target && (
            <p className="m-0 text-sm">
              Forces already in the destination sector stay in place.
            </p>
          )}
        </fieldset>
      ))}
      {source.marker && (
        <div className="flex flex-col gap-2">
          <label className="flex min-h-11 items-center gap-3">
            <input
              type="checkbox"
              disabled={busy || markerAtTarget}
              checked={includesMarker}
              onChange={(e) => setTakeMarker(e.target.checked)}
            />
            Include concealed No-Field from sector {source.marker.sector}
          </label>
          <p className="m-0 text-sm">
            The marker can move alone or with physical forces. Its concealed
            value stays unchanged.
            {markerAtTarget
              ? ' It is already in the destination sector and stays in place.'
              : ''}
          </p>
        </div>
      )}
      <label className="flex flex-col gap-2" htmlFor={`${id}-destination`}>
        Destination territory
        <select
          id={`${id}-destination`}
          className="min-h-11"
          disabled={busy}
          value={destination?.territory ?? ''}
          onChange={(e) => {
            const options = destinations.filter(
              (d) => d.territory === e.target.value,
            );
            const chosen = options.find((d) => !d.blocked) ?? options[0];
            if (chosen)
              chooseDestination(location(chosen.territory, chosen.sector));
          }}
        >
          {targetTerritories.map((t) => (
            <option key={t} value={t}>
              {territory(t).name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-2" htmlFor={`${id}-sector`}>
        Destination sector
        <select
          id={`${id}-sector`}
          className="min-h-11"
          disabled={busy}
          value={target}
          onChange={(e) => chooseDestination(e.target.value)}
        >
          {destinations
            .filter((d) => d.territory === destination?.territory)
            .map((d) => (
              <option key={d.sector} value={location(d.territory, d.sector)}>
                {d.sector === 0 ? 'Sheltered interior' : d.sector}
                {d.blocked ? ' · Unavailable' : ''}
              </option>
            ))}
        </select>
      </label>
      {destination?.advisors && (
        <p className="m-0 text-sm">This group arrives as advisors.</p>
      )}
      {destination?.canFight && (
        <label className="flex min-h-11 items-center gap-3">
          <input
            type="checkbox"
            checked={fighters}
            disabled={busy}
            onChange={(e) => setFighters(e.target.checked)}
          />
          Request a flip to fighters on arrival
        </label>
      )}
      <p className="m-0 text-sm" aria-live="polite">
        Selected: {total} physical forces
        {includesMarker ? ' and one concealed No-Field' : ''}.
      </p>
      {reason && (
        <p className="m-0 text-sm leading-6" id={`${id}-reason`}>
          {reason}
        </p>
      )}
      <Button
        className="min-h-11 whitespace-normal"
        disabled={busy || !!reason}
        aria-describedby={reason ? `${id}-reason` : undefined}
        onClick={() => {
          if (busy || reason || !destination) return;
          act({
            type: 'decision',
            event: entry.event,
            forces: selectedForces,
            eliteForces: selectedElites,
            territory: destination.territory,
            sector: destination.sector,
            ...(includesMarker && source.marker
              ? {
                  noField: {
                    tokenId: source.marker.tokenId,
                    event: source.marker.event,
                  },
                }
              : {}),
            ...(fighters && destination.canFight ? { fighters: true } : {}),
          });
        }}
      >
        Relocate selected forces
      </Button>
    </div>
  );
}
