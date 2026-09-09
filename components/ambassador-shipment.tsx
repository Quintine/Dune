'use client';

import { useId, useState } from 'react';
import type { Action, GameView } from '@/game/engine';
import { location, territory } from '@/game/board';
import { Button } from './ui/button';
import { Input } from './ui/input';

const bounded = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, Number.isSafeInteger(value) ? value : min));

/** Mounted with the Ambassador event key so an earlier shipment draft cannot carry over. */
export function AmbassadorShipment({
  game,
  act,
  busy,
}: {
  game: GameView;
  act: (action: Action) => void;
  busy: boolean;
}) {
  const id = useId();
  const [destinationKey, setDestinationKey] = useState('');
  const [count, setCount] = useState<number | null>(null);
  const [eliteCount, setEliteCount] = useState(0);
  const entry = game.ambassadorEntry;
  if (
    entry?.stage !== 'ship' ||
    entry.beneficiary !== game.me ||
    game.decision?.kind !== 'ecazAmbassador' ||
    game.decision.player !== game.me ||
    !entry.shipment
  )
    return null;
  const me = game.players.find((p) => p.id === game.me)!;
  const shipment = entry.shipment;
  const destination =
    shipment.destinations.find(
      (d) => location(d.territory, d.sector) === destinationKey,
    ) ??
    shipment.destinations.find((d) => !d.blocked) ??
    shipment.destinations[0];
  const maximum = Math.min(
    shipment.maximum,
    me.reserves,
    destination?.maximum ?? shipment.maximum,
  );
  const amount = maximum ? bounded(count ?? maximum, 1, maximum) : 0;
  const minimumElite = Math.max(
    0,
    amount - (me.reserves - shipment.eliteReserves),
  );
  const maximumElite = Math.min(amount, shipment.eliteReserves);
  const elite = bounded(eliteCount, minimumElite, maximumElite);
  const reason = !amount
    ? 'You have no reserve forces available for this shipment.'
    : !destination
      ? 'No shipment destination is currently available.'
      : destination.blocked;
  const territories = [
    ...new Set(shipment.destinations.map((d) => d.territory)),
  ];
  return (
    <div
      className="flex min-w-0 flex-col gap-4"
      aria-label="Ambassador reserve shipment"
    >
      <p className="m-0 text-sm leading-6">
        Send up to four of your reserve forces for free, or send no forces. This
        does not spend your ordinary shipment or movement. The Ambassador has
        already been triggered.
      </p>
      <label className="flex flex-col gap-2" htmlFor={`${id}-amount`}>
        Physical forces to ship · up to {maximum}
        <Input
          id={`${id}-amount`}
          className="min-h-11"
          type="number"
          min={maximum ? 1 : 0}
          max={maximum}
          step={1}
          value={amount}
          disabled={busy || !maximum}
          onChange={(e) =>
            setCount(bounded(Number(e.target.value), 1, maximum))
          }
        />
      </label>
      {shipment.eliteReserves > 0 && (
        <label className="flex flex-col gap-2" htmlFor={`${id}-elites`}>
          Elite forces included · {minimumElite}–{maximumElite}
          <Input
            id={`${id}-elites`}
            className="min-h-11"
            type="number"
            min={minimumElite}
            max={maximumElite}
            step={1}
            value={elite}
            disabled={busy || !amount}
            onChange={(e) =>
              setEliteCount(
                bounded(Number(e.target.value), minimumElite, maximumElite),
              )
            }
          />
        </label>
      )}
      <label className="flex flex-col gap-2" htmlFor={`${id}-territory`}>
        Destination territory
        <select
          id={`${id}-territory`}
          className="min-h-11"
          value={destination?.territory ?? ''}
          disabled={busy || !shipment.destinations.length}
          onChange={(e) => {
            const options = shipment.destinations.filter(
              (d) => d.territory === e.target.value,
            );
            const chosen = options.find((d) => !d.blocked) ?? options[0];
            if (chosen)
              setDestinationKey(location(chosen.territory, chosen.sector));
          }}
        >
          {territories.map((t) => (
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
          value={
            destination
              ? location(destination.territory, destination.sector)
              : ''
          }
          disabled={busy || !destination}
          onChange={(e) => setDestinationKey(e.target.value)}
        >
          {shipment.destinations
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
        <p className="m-0 text-sm">These forces join your advisors.</p>
      )}
      <p className="m-0 text-sm" aria-live="polite">
        Selected: {amount} physical forces, including {elite} elites. Cost: 0
        spice.
      </p>
      <p className="m-0 text-sm">
        No-Field substitution for this effect remains unfinished.
      </p>
      {reason && (
        <p id={`${id}-reason`} className="m-0 text-sm leading-6">
          {reason}
        </p>
      )}
      <Button
        className="min-h-11 whitespace-normal"
        disabled={busy || !!reason}
        aria-describedby={reason ? `${id}-reason` : undefined}
        onClick={() => {
          if (!busy && !reason && destination)
            act({
              type: 'decision',
              event: entry.event,
              amount,
              elite,
              territory: destination.territory,
              sector: destination.sector,
            });
        }}
      >
        Ship selected forces for free
      </Button>
      <Button
        className="min-h-11 whitespace-normal"
        variant="outline"
        disabled={busy}
        onClick={() => {
          if (!busy) act({ type: 'decision', event: entry.event, amount: 0 });
        }}
      >
        Send no forces
      </Button>
    </div>
  );
}
