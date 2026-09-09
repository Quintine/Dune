'use client';

import { useState } from 'react';
import type { Action, GameView } from '@/game/engine';
import { specialForceName } from '@/game/combat';
import {
  homeworldName,
  homeworldShipmentChoice,
  type HomeworldShipmentSources,
} from '@/game/homeworld-shipment-options';
import { Button } from './ui/button';
import { Input } from './ui/input';

export function HomeworldShipment({
  game: g,
  act,
  busy,
}: {
  game: GameView;
  act: (action: Action) => void;
  busy: boolean;
}) {
  const worlds = g.homeworlds?.worlds ?? [];
  const me = g.players.find((player) => player.id === g.me)!;
  const available = worlds.filter((world) => {
    const force = world.forces[g.me];
    return force && force.normal + force.elite > 0;
  });
  const targets = worlds.filter(
    (world) =>
      (world.native !== g.me || me.faction === 'guild') &&
      world.native !== me.ally,
  );
  const [origin, setOrigin] = useState(available[0]?.id ?? '');
  const [destination, setDestination] = useState(
    targets.find((world) => world.id !== available[0]?.id)?.id ?? '',
  );
  const [sources, setSources] = useState<HomeworldShipmentSources>({});
  const [allyPayment, setAllyPayment] = useState(0);
  const option = g.homeworldShipment;
  if (!option) return null;
  const imperial = g.advanced && me.faction === 'emperor';
  const selectedOrigins = available.filter((world) =>
    origin === 'imperial-pair' ? world.native === me.id : world.id === origin,
  );
  const selected = Object.fromEntries(
    selectedOrigins.flatMap((world) => {
      const choice = sources[world.id];
      return choice && choice.normal + choice.elite !== 0
        ? [[world.id, choice]]
        : [];
    }),
  );
  const quote = homeworldShipmentChoice(g, destination, selected, allyPayment);
  const special = specialForceName(me.faction);
  return (
    <details className="rounded-lg border border-[#a88b60]/50 p-3">
      <summary className="cursor-pointer py-2">
        Ship to another Homeworld
      </summary>
      <p className="fine">
        Use your shipment to send forces from one Homeworld to another. Native
        reserves and foreign garrisons have separate source pools.{' '}
        {me.faction === 'guild'
          ? 'Guild may also return a foreign garrison to Junction.'
          : 'Your own Homeworld cannot be a destination.'}{' '}
        Allied Homeworlds cannot be destinations.
      </p>
      <p className="fine">
        {me.faction === 'guild'
          ? 'Guild pays one spice per two forces, rounded up.'
          : 'Pay one spice per force.'}{' '}
        This uses your shipment; your normal movement remains available.
      </p>
      {option.blocked && (
        <output className="notice block">{option.blocked}</output>
      )}
      <fieldset disabled={busy || !!option.blocked} className="space-y-3 pt-3">
        <label className="block space-y-1">
          <span>Source Homeworld</span>
          <select
            aria-label="Source Homeworld"
            className="w-full"
            value={origin}
            onChange={(event) => {
              setOrigin(event.target.value);
              setSources({});
            }}
          >
            {!available.length && (
              <option value="">No forces on Homeworlds</option>
            )}
            {available.map((world) => (
              <option key={world.id} value={world.id}>
                {homeworldName(g, world.id)} ·{' '}
                {world.native === me.id
                  ? 'native reserves'
                  : 'foreign garrison'}
              </option>
            ))}
            {imperial &&
              available.filter((world) => world.native === me.id).length ===
                2 && (
                <option value="imperial-pair">
                  Kaitain + Salusa Secundus · combined native shipment
                </option>
              )}
          </select>
        </label>
        {selectedOrigins.map((world) => {
          const pool = world.forces[me.id];
          const chosen = sources[world.id] ?? { normal: 0, elite: 0 };
          return (
            <fieldset
              key={world.id}
              className="space-y-2 rounded border border-[#a88b60]/30 p-3"
            >
              <legend>
                {homeworldName(g, world.id)} ·{' '}
                {world.native === me.id
                  ? 'native reserves'
                  : 'foreign garrison'}
              </legend>
              <p className="fine">
                Available: {pool.normal} normal
                {pool.elite > 0 ? ` + ${pool.elite} ${special}` : ''}.
              </p>
              {(['normal', 'elite'] as const)
                .filter((kind) => kind === 'normal' || pool.elite > 0)
                .map((kind) => (
                  <label key={kind} className="block space-y-1">
                    <span>
                      {kind === 'normal' ? 'Normal forces' : special} from{' '}
                      {homeworldName(g, world.id)}
                    </span>
                    <Input
                      type="number"
                      min={0}
                      max={pool[kind]}
                      step={1}
                      value={chosen[kind]}
                      onChange={(event) =>
                        setSources({
                          ...sources,
                          [world.id]: {
                            ...chosen,
                            [kind]: Number(event.target.value),
                          },
                        })
                      }
                    />
                  </label>
                ))}
            </fieldset>
          );
        })}
        <label className="block space-y-1">
          <span>Destination Homeworld</span>
          <select
            aria-label="Destination Homeworld"
            className="w-full"
            value={destination}
            onChange={(event) => setDestination(event.target.value)}
          >
            {!targets.length && (
              <option value="">No eligible destination</option>
            )}
            {targets.map((world) => (
              <option
                key={world.id}
                value={world.id}
                disabled={selectedOrigins.some(
                  (source) => source.id === world.id,
                )}
              >
                {homeworldName(g, world.id)} ·{' '}
                {world.native === me.id
                  ? 'return to your Homeworld'
                  : g.players.find((player) => player.id === world.native)
                      ?.name}
              </option>
            ))}
          </select>
        </label>
        {me.ally && (
          <label className="block space-y-1">
            <span>Allied spice contribution · {g.aid.available} pledged</span>
            <Input
              type="number"
              min={0}
              max={Math.min(quote.cost, g.aid.available)}
              step={1}
              value={allyPayment}
              onChange={(event) => setAllyPayment(Number(event.target.value))}
            />
          </label>
        )}
        <p className="fine">
          Your available spice: {me.spice ?? 0}. Allied pledge:{' '}
          {g.aid.available}.
        </p>
        <output className="notice block" aria-live="polite">
          {quote.amount} forces · {quote.cost} spice total
          {quote.amount > 0
            ? ` · you pay ${quote.ownPayment}, ally pays ${quote.allyPayment}`
            : ''}
          .{quote.blocked && ` ${quote.blocked}`}
        </output>
        <Button
          className="game-action"
          disabled={busy || !quote.action}
          onClick={() => {
            if (quote.action) act(quote.action);
          }}
        >
          Ship to {homeworldName(g, destination)}
        </Button>
      </fieldset>
    </details>
  );
}
