'use client';
import { useState } from 'react';
import type { Action, GameView } from '@/game/engine';
import { greatMakerRideAction } from '@/game/great-maker-options';
import { Button } from './ui/button';

type Props = { game: GameView; act: (action: Action) => void; busy: boolean };
export function GreatMakerDecision({ game, act, busy }: Props) {
  const [destination, setDestination] = useState(''),
    [amount, setAmount] = useState(1),
    [elite, setElite] = useState(0);
  const d = game.decision,
    frame = game.greatMaker;
  if (!frame || !d || d.player !== game.me) return null;
  if (d.kind === 'greatMakerVote')
    return (
      <section aria-label="Great Maker vote" className="space-y-3">
        <h3>Great Maker · Nexus vote</h3>
        <p>
          Vote in storm order. A majority must vote yes for this encounter to
          create a Nexus; a tie means no Nexus.
        </p>
        {frame.votes.map((vote) => (
          <p key={vote.player}>
            {game.players.find((p) => p.id === vote.player)?.name}:{' '}
            {vote.yes ? 'Yes' : 'No'}
          </p>
        ))}
        <div className="flex flex-wrap gap-2">
          {[true, false].map((yes) => (
            <Button
              key={String(yes)}
              disabled={busy}
              onClick={() => act({ type: 'decision', event: d.event, yes })}
            >
              {yes ? 'Yes — create a Nexus' : 'No Nexus'}
            </Button>
          ))}
        </div>
      </section>
    );
  const offer = frame.ride;
  if (d.kind !== 'greatMakerRide' || !offer) return null;
  const to =
    offer.destinations.find(
      (to) => `${to.territory}:${to.sector}` === destination,
    ) ?? offer.destinations[0];
  const n = Math.max(1, Math.min(amount, offer.max)),
    minimumElite = Math.max(0, n - (offer.max - offer.eliteMax));
  const e = Math.max(minimumElite, Math.min(elite, n, offer.eliteMax));
  const action = to
    ? greatMakerRideAction(game, to.territory, to.sector, n, e)
    : null;
  return (
    <section aria-label="Great Maker reserve ride" className="space-y-3">
      <h3>Ride the Great Maker</h3>
      <p>
        Move any number of reserve forces to one legal destination. This uses no
        spice, shipment or movement. Forces already on the board stay where they
        are.
      </p>
      <label className="block">
        Destination
        <select
          value={to ? `${to.territory}:${to.sector}` : ''}
          disabled={busy}
          onChange={(event) => setDestination(event.target.value)}
        >
          {offer.destinations.map((to) => (
            <option
              key={`${to.territory}:${to.sector}`}
              value={`${to.territory}:${to.sector}`}
            >
              {to.name} · sector {to.sector}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        Forces
        <input
          type="number"
          min={1}
          max={offer.max}
          value={n}
          disabled={busy}
          onChange={(event) => setAmount(Number(event.target.value))}
        />
      </label>
      {offer.eliteMax > 0 && (
        <label className="block">
          Fedaykin included
          <input
            type="number"
            min={minimumElite}
            max={Math.min(n, offer.eliteMax)}
            value={e}
            disabled={busy}
            onChange={(event) => setElite(Number(event.target.value))}
          />
        </label>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={busy || !action}
          onClick={() => {
            if (action) act(action);
          }}
        >
          Ride with {n} forces
        </Button>
        <Button
          variant="outline"
          disabled={busy}
          onClick={() =>
            act({ type: 'decision', event: d.event, accept: false })
          }
        >
          Leave forces in reserves
        </Button>
      </div>
    </section>
  );
}
