'use client';

import { useState } from 'react';
import type { Action, GameView } from '@/game/engine';
import {
  junctionTransportChoice,
  junctionTransportDestinations,
  junctionTransportOrigins,
} from '@/game/junction-transport-options';
import type { HomeworldShipmentSources } from '@/game/homeworld-shipment-options';
import { Button } from './ui/button';
import { Input } from './ui/input';

export function JunctionTransport({
  game: g,
  act,
  busy,
}: {
  game: GameView;
  act: (action: Action) => void;
  busy: boolean;
}) {
  const origins = junctionTransportOrigins(g);
  const destinations = junctionTransportDestinations(g);
  const [origin, setOrigin] = useState(origins[0]?.id ?? '');
  const [destination, setDestination] = useState(destinations[0]?.id ?? '');
  const [sources, setSources] = useState<HomeworldShipmentSources>({});
  const [allyPayment, setAllyPayment] = useState(0);
  const option = g.junctionTransport;
  const me = g.players.find((p) => p.id === g.me);
  if (!option || !me || ![option.owner, option.recipient].includes(me.id))
    return null;
  const recipient = g.players.find((p) => p.id === option.recipient);
  if (me.id === option.owner)
    return (
      <details className="rounded-lg border border-[#a88b60]/50 p-3">
        <summary className="cursor-pointer py-2">
          Offer Junction transport
        </summary>
        <p className="fine">
          Junction allows you to offer {recipient?.name ?? 'the active faction'}{' '}
          cross-shipment at half or full price, including travel to and from
          Homeworlds. They choose whether to use it for their shipment.
        </p>
        {option.offer && (
          <p className="fine">Current offer: {option.offer.rate} price.</p>
        )}
        {option.blocked && (
          <output className="notice block">{option.blocked}</output>
        )}
        <div className="flex flex-wrap gap-2 pt-3">
          {(['half', 'full'] as const).map((rate) => (
            <Button
              key={rate}
              disabled={busy || !option.canOffer || option.offer?.rate === rate}
              onClick={() =>
                act({
                  type: 'offerJunctionTransport',
                  event: option.offerEvent,
                  rate,
                })
              }
            >
              Offer {rate} price
            </Button>
          ))}
        </div>
      </details>
    );
  const selectedOrigin = origins.find((candidate) => candidate.id === origin);
  const selected = Object.fromEntries(
    (selectedOrigin?.pools ?? []).flatMap((pool) => {
      const chosen = sources[pool.key];
      return chosen && chosen.normal + chosen.elite > 0
        ? [[pool.key, chosen]]
        : [];
    }),
  );
  const quote = junctionTransportChoice(g, destination, selected, allyPayment);
  return (
    <details className="rounded-lg border border-[#a88b60]/50 p-3">
      <summary className="cursor-pointer py-2">
        Junction transport{option.offer ? ` · ${option.offer.rate} price` : ''}
      </summary>
      <p className="fine">
        Guild’s offer allows one transport from an Arrakis territory or
        Homeworld, including a return to your own Homeworld. This uses your
        shipment; movement remains available.
      </p>
      {!option.offer ? (
        <output className="notice block">
          Guild has not offered transport for this shipment. Your ordinary
          actions remain available.
        </output>
      ) : (
        <>
          <p className="fine">
            One force costs one spice to a Homeworld or stronghold, two
            elsewhere. The Guild’s {option.offer.rate}-price offer applies to
            the total; fractions round up.
          </p>
          {option.blocked && (
            <output className="notice block">{option.blocked}</output>
          )}
          <fieldset
            disabled={busy || !!option.blocked}
            className="space-y-3 pt-3"
          >
            <label className="block space-y-1">
              <span>Junction transport source</span>
              <select
                aria-label="Junction transport source"
                className="w-full"
                value={origin}
                onChange={(event) => {
                  setOrigin(event.target.value);
                  setSources({});
                }}
              >
                {!origins.length && (
                  <option value="">No available physical source</option>
                )}
                {origins.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.name}
                  </option>
                ))}
              </select>
            </label>
            {selectedOrigin?.pools.map((pool) => (
              <div key={pool.key} className="space-y-2">
                <p className="fine">
                  {pool.name}
                  {pool.sector && pool.sector === g.storm
                    ? ' · blocked by storm'
                    : ''}
                </p>
                {(['normal', 'elite'] as const)
                  .filter((kind) => kind === 'normal' || pool.elite > 0)
                  .map((kind) => (
                    <label key={kind} className="block space-y-1">
                      <span>
                        {kind === 'normal' ? 'Normal' : 'Special'} forces ·{' '}
                        {pool[kind]} available
                      </span>
                      <Input
                        aria-label={`${kind === 'normal' ? 'Normal' : 'Special'} forces from ${pool.name} for Junction transport`}
                        type="number"
                        min={0}
                        max={pool[kind]}
                        step={1}
                        disabled={
                          pool.sector !== null &&
                          pool.sector !== 0 &&
                          pool.sector === g.storm
                        }
                        value={sources[pool.key]?.[kind] ?? 0}
                        onChange={(event) =>
                          setSources({
                            ...sources,
                            [pool.key]: {
                              normal: sources[pool.key]?.normal ?? 0,
                              elite: sources[pool.key]?.elite ?? 0,
                              [kind]: Number(event.target.value),
                            },
                          })
                        }
                      />
                    </label>
                  ))}
              </div>
            ))}
            <label className="block space-y-1">
              <span>Junction transport destination</span>
              <select
                aria-label="Junction transport destination"
                className="w-full"
                value={destination}
                onChange={(event) => setDestination(event.target.value)}
              >
                {destinations.map((target) => (
                  <option key={target.id} value={target.id}>
                    {target.name}
                  </option>
                ))}
              </select>
            </label>
            {me.ally && (
              <label className="block space-y-1">
                <span>Allied contribution · {g.aid.available} pledged</span>
                <Input
                  aria-label="Allied contribution for Junction transport"
                  type="number"
                  min={0}
                  max={Math.min(quote.cost, g.aid.available)}
                  step={1}
                  value={allyPayment}
                  onChange={(event) =>
                    setAllyPayment(Number(event.target.value))
                  }
                />
              </label>
            )}
            <p className="fine">
              Your available spice: {me.spice ?? 0}. Allied pledge:{' '}
              {g.aid.available}.
            </p>
            <output className="notice block" aria-live="polite">
              {quote.amount} forces ({quote.elite} special) · {quote.cost} spice
              {quote.amount > 0
                ? ` · you pay ${quote.ownPayment}, ally pays ${quote.allyPayment}`
                : ''}
              {quote.advisors ? ' · arrives as advisors' : ''}.
              {quote.blocked ? ` ${quote.blocked}` : ''}
            </output>
            <Button
              className="game-action"
              disabled={busy || !quote.action}
              onClick={() => {
                if (quote.action) act(quote.action);
              }}
            >
              Use Junction transport
            </Button>
          </fieldset>
        </>
      )}
    </details>
  );
}
