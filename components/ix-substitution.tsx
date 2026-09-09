'use client';
import { useState } from 'react';
import type { Action, GameView } from '@/game/engine';
import { splitLocation } from '@/game/board';
import { Button } from './ui/button';
import { Input } from './ui/input';
export function IxSubstitution({
  game: g,
  act,
  busy,
}: {
  game: GameView;
  act: (action: Action) => void;
  busy: boolean;
}) {
  const [sources, setSources] = useState<Record<string, number>>({});
  const [recover, setRecover] = useState<Record<string, number>>({});
  if (g.decision?.kind !== 'ixSubstitution') return null;
  const d = g.decision;
  const me = g.players.find((p) => p.id === g.me)!;
  const world = g.combatLocations?.find(
    (place) => place.id === d.territory && place.kind === 'homeworld',
  );
  const available = (
    world
      ? [[world.id, world.forces?.[me.id]?.normal ?? 0] as const]
      : Object.entries(me.forces)
          .filter(([key]) => splitLocation(key).territory === d.territory)
          .map(
            ([key, count]) =>
              [key, count - (me.elites?.forces[key] ?? 0)] as const,
          )
  ).filter(([, count]) => count > 0);
  const total = (value: Record<string, number>) =>
    Object.values(value).reduce((a, b) => a + b, 0);
  const invalid = (
    selected: Record<string, number>,
    limits: Record<string, number>,
  ) =>
    Object.entries(selected).some(
      ([key, count]) =>
        !Number.isSafeInteger(count) || count < 0 || count > (limits[key] ?? 0),
    );
  return (
    <>
      <p>
        Exchange surviving suboids, one for one, to retain cyborgs lost in this
        battle. Retained cyborgs return to{' '}
        {world ? world.name : 'their casualty sectors'}. Opponents may cancel
        this substitution with Karama.
      </p>
      <h3>Suboids to sacrifice</h3>
      {available.map(([key, max]) => (
        <label key={key}>
          {world ? world.name : `Sector ${splitLocation(key).sector}`} · {max}{' '}
          suboids available
          <Input
            type="number"
            min={0}
            max={max}
            value={sources[key] ?? 0}
            onChange={(e) =>
              setSources({ ...sources, [key]: Number(e.target.value) })
            }
          />
        </label>
      ))}
      <h3>Cyborgs to retain</h3>
      {Object.entries(d.losses).map(([key, max]) => (
        <label key={key}>
          {world ? world.name : `Sector ${splitLocation(key).sector}`} · {max}{' '}
          cyborgs lost
          <Input
            type="number"
            min={0}
            max={max}
            value={recover[key] ?? 0}
            onChange={(e) =>
              setRecover({ ...recover, [key]: Number(e.target.value) })
            }
          />
        </label>
      ))}
      <p>
        {total(sources)} suboids for {total(recover)} cyborgs
      </p>
      <Button
        disabled={
          busy ||
          !total(sources) ||
          total(sources) !== total(recover) ||
          invalid(sources, Object.fromEntries(available)) ||
          invalid(recover, d.losses)
        }
        onClick={() => act({ type: 'decision', sources, recover })}
      >
        Confirm substitution
      </Button>
      <Button
        variant="outline"
        disabled={busy}
        onClick={() => act({ type: 'decision', decline: true })}
      >
        Keep these casualties
      </Button>
    </>
  );
}
