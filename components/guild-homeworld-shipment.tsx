'use client';

import { useState } from 'react';
import type { Action, GameView } from '@/game/engine';
import {
  guildHomeworldShipmentChoice,
  guildHomeworldShipmentOrigins,
} from '@/game/guild-homeworld-shipment-options';
import {
  homeworldName,
  type HomeworldShipmentSources,
} from '@/game/homeworld-shipment-options';
import { Button } from './ui/button';
import { Input } from './ui/input';

export function GuildHomeworldShipment({
  game: g,
  act,
  busy,
}: {
  game: GameView;
  act: (action: Action) => void;
  busy: boolean;
}) {
  const origins = guildHomeworldShipmentOrigins(g);
  const me = g.players.find((player) => player.id === g.me)!;
  const targets = (g.homeworlds?.worlds ?? []).filter(
    (world) => world.native !== me.ally,
  );
  const [origin, setOrigin] = useState(origins[0]?.territory.id ?? '');
  const [destination, setDestination] = useState(
    targets.find((world) => world.native === me.id)?.id ?? targets[0]?.id ?? '',
  );
  const [sources, setSources] = useState<HomeworldShipmentSources>({});
  const [allyPayment, setAllyPayment] = useState(0);
  const option = g.guildHomeworldShipment;
  if (!option || me.faction !== 'guild') return null;
  const selectedOrigin = origins.find(
    (candidate) => candidate.territory.id === origin,
  );
  const selected = Object.fromEntries(
    (selectedOrigin?.pools ?? []).flatMap((pool) => {
      const chosen = sources[pool.key];
      return chosen && chosen.normal + chosen.elite > 0
        ? [[pool.key, chosen]]
        : [];
    }),
  );
  const quote = guildHomeworldShipmentChoice(
    g,
    destination,
    selected,
    allyPayment,
  );
  return (
    <details className="rounded-lg border border-[#a88b60]/50 p-3">
      <summary className="cursor-pointer py-2">
        Guild transport from Arrakis to a Homeworld
      </summary>
      <p className="fine">
        Ship forces from one Arrakis territory to Junction or another faction’s
        Homeworld. You may combine forces in different sectors of that
        territory. Allied Homeworlds cannot be destinations.
      </p>
      <p className="fine">
        Pay one spice per two forces, rounded up. This uses your shipment; your
        normal movement remains available.
      </p>
      {option.blocked && (
        <output className="notice block">{option.blocked}</output>
      )}
      <fieldset disabled={busy || !!option.blocked} className="space-y-3 pt-3">
        <label className="block space-y-1">
          <span>Arrakis source territory</span>
          <select
            aria-label="Arrakis source territory"
            className="w-full"
            value={origin}
            onChange={(event) => {
              setOrigin(event.target.value);
              setSources({});
            }}
          >
            {!origins.length && (
              <option value="">No Guild forces on Arrakis</option>
            )}
            {origins.map((candidate) => (
              <option
                key={candidate.territory.id}
                value={candidate.territory.id}
              >
                {candidate.territory.name}
              </option>
            ))}
          </select>
        </label>
        {selectedOrigin?.pools.map((pool) => {
          const label = `${selectedOrigin.territory.name}${pool.sector === null ? '' : ` sector ${pool.sector}`}`;
          const storm = pool.sector === g.storm;
          return (
            <label key={pool.key} className="block space-y-1">
              <span>
                Forces from {label} · {pool.normal} available
                {storm ? ' · blocked by storm' : ''}
              </span>
              <Input
                aria-label={`Guild forces from ${label}`}
                type="number"
                min={0}
                max={pool.normal}
                step={1}
                disabled={storm}
                value={sources[pool.key]?.normal ?? 0}
                onChange={(event) =>
                  setSources({
                    ...sources,
                    [pool.key]: {
                      normal: Number(event.target.value),
                      elite: 0,
                    },
                  })
                }
              />
            </label>
          );
        })}
        <label className="block space-y-1">
          <span>Homeworld destination for Guild transport</span>
          <select
            aria-label="Homeworld destination for Guild transport"
            className="w-full"
            value={destination}
            onChange={(event) => setDestination(event.target.value)}
          >
            {targets.map((world) => (
              <option key={world.id} value={world.id}>
                {homeworldName(g, world.id)}
                {world.native === me.id ? ' · return to your Homeworld' : ''}
              </option>
            ))}
          </select>
        </label>
        {me.ally && (
          <label className="block space-y-1">
            <span>
              Allied contribution for Guild transport · {g.aid.available}{' '}
              pledged
            </span>
            <Input
              aria-label="Allied contribution for Guild transport"
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
          Transport to {homeworldName(g, destination)}
        </Button>
      </fieldset>
    </details>
  );
}
