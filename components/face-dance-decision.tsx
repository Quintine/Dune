'use client';
import { useState } from 'react';
import { territory, splitLocation } from '@/game/board';
import type { Action, GameView } from '@/game/engine';
import { Button } from './ui/button';
import { Input } from './ui/input';
export function FaceDanceDecision({
  game: g,
  act,
  busy,
}: {
  game: GameView;
  act: (a: Action) => void;
  busy: boolean;
}) {
  const d = g.decision;
  const me = g.players.find((p) => p.id === g.me)!;
  const maximum =
    d?.kind === 'faceDance'
      ? Object.entries(g.players.find((p) => p.id === d.winner)!.forces)
          .filter(([key]) => splitLocation(key).territory === d.territory)
          .reduce((sum, [, count]) => sum + count, 0)
      : 0;
  const [sources, setSources] = useState<Record<string, number>>({
    reserves: Math.min(me.reserves, maximum),
  });
  const [sector, setSector] = useState(
    d?.kind === 'faceDance' ? territory(d.territory).sectors[0] : 0,
  );
  if (d?.kind !== 'faceDance') return null;
  const held = me.faceDancers?.some(
    (c) => !c.revealed && c.leader === d.identity,
  );
  const total = Object.values(sources).reduce((sum, n) => sum + n, 0);
  return (
    <>
      <h2>Face Dancer opportunity</h2>
      <p>
        {g.players.find((p) => p.id === d.winner)?.name} won in{' '}
        {territory(d.territory).name}. Their battle rewards remain theirs.
      </p>
      {held ? (
        <>
          <p>
            Return the winner’s {maximum} remaining forces to reserves. Replace
            up to {maximum} with your forces. Their leader goes to the tanks
            without a spice bounty.
          </p>
          {Object.entries({ reserves: me.reserves, ...me.forces }).map(
            ([key, available]) => (
              <label key={key} htmlFor={`face-source-${key}`}>
                {key === 'reserves'
                  ? 'Reserves'
                  : `${territory(splitLocation(key).territory).name} · sector ${splitLocation(key).sector}`}{' '}
                ({available} available)
                <Input
                  id={`face-source-${key}`}
                  type="number"
                  min={0}
                  max={Math.min(available, maximum)}
                  value={sources[key] ?? 0}
                  onChange={(e) =>
                    setSources({ ...sources, [key]: Number(e.target.value) })
                  }
                />
              </label>
            ),
          )}
          <label htmlFor="face-sector">
            Replacement sector
            <select
              id="face-sector"
              value={sector}
              onChange={(e) => setSector(Number(e.target.value))}
            >
              {territory(d.territory).sectors.map((s) => (
                <option value={s} key={s}>
                  {s === 0 ? 'Polar Sink' : `Sector ${s}`}
                </option>
              ))}
            </select>
          </label>
          <p>
            {total} / {maximum} replacement forces selected
          </p>
          <Button
            disabled={
              busy ||
              total > maximum ||
              Object.values(sources).some((n) => n < 0 || !Number.isInteger(n))
            }
            onClick={() =>
              act({ type: 'decision', reveal: true, sources, sector })
            }
          >
            Reveal Face Dancer
          </Button>
        </>
      ) : (
        <p>You have no unrevealed Face Dancer matching the winning leader.</p>
      )}
      <Button
        variant="outline"
        disabled={busy}
        onClick={() => act({ type: 'decision', reveal: false })}
      >
        Decline Face Dancer
      </Button>
    </>
  );
}
