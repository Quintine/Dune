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
  const world =
    d?.kind === 'faceDance'
      ? g.combatLocations?.find(
          (place) => place.id === d.territory && place.kind === 'homeworld',
        )
      : undefined;
  const foreign =
    d?.kind === 'faceDance' ? world?.forces?.[d.winner] : undefined;
  const maximum =
    d?.kind === 'faceDance'
      ? world
        ? (foreign?.normal ?? 0) + (foreign?.elite ?? 0)
        : Object.entries(g.players.find((p) => p.id === d.winner)!.forces)
            .filter(([key]) => splitLocation(key).territory === d.territory)
            .reduce((sum, [, count]) => sum + count, 0)
      : 0;
  const [sources, setSources] = useState<Record<string, number>>(
    world
      ? {}
      : {
          reserves: Math.min(me.reserves, maximum),
        },
  );
  const [sector, setSector] = useState(
    d?.kind === 'faceDance' && !world ? territory(d.territory).sectors[0] : 0,
  );
  if (d?.kind !== 'faceDance') return null;
  const held = me.faceDancers?.some(
    (c) => !c.revealed && c.leader === d.identity,
  );
  const total = Object.values(sources).reduce((sum, n) => sum + n, 0);
  const availableSources = world
    ? me.forces
    : { reserves: me.reserves, ...me.forces };
  return (
    <>
      <h2>Face Dancer opportunity</h2>
      <p>
        {g.players.find((p) => p.id === d.winner)?.name} won in{' '}
        {world?.name ?? territory(d.territory).name}. Their battle rewards
        remain theirs.
      </p>
      {d.blocked && (
        <output className="notice block">
          {d.blocked}
        </output>
      )}
      {held ? (
        <>
          <p>
            Return the winner’s {maximum} remaining forces to reserves. Replace
            up to {maximum} with your forces. Their leader goes to the tanks
            without a spice bounty.
          </p>
          {world && (
            <p>
              Your native forces already at {world.name} remain there. Choose
              any additional replacement forces from your positions on Arrakis,
              or reveal with zero additional forces.
            </p>
          )}
          {Object.entries(availableSources).map(([key, available]) => (
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
          ))}
          {!world && (
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
          )}
          <p>
            {total} / {maximum} replacement forces selected
          </p>
          <Button
            disabled={
              busy ||
              !!d.blocked ||
              total > maximum ||
              Object.entries(sources).some(
                ([key, n]) =>
                  n < 0 ||
                  !Number.isSafeInteger(n) ||
                  n > (availableSources[key] ?? 0),
              )
            }
            onClick={() =>
              act({
                type: 'decision',
                reveal: true,
                sources,
                ...(world ? {} : { sector }),
              })
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
