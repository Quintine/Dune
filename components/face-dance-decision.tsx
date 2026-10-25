'use client';
import { useState } from 'react';
import { territory, splitLocation } from '@/game/board';
import type { Action, GameView } from '@/game/engine';
import { FaceDanceActions, faceDanceForceChoices } from './face-dance-actions';
import { Input } from './ui/input';

type Props = { game: GameView; act: (action: Action) => void; busy: boolean };

export function FaceDanceDecision(props: Props) {
  const { game } = props;
  const d = game.decision;
  if (
    d?.kind !== 'faceDance' ||
    d.player !== game.me ||
    !game.players.some((player) => player.id === game.me)
  )
    return null;
  return <FaceDanceChoice key={`${d.territory}:${d.winner}:${d.identity}`} {...props} />;
}

function FaceDanceChoice({
  game: g,
  act,
  busy,
}: Props) {
  const d = g.decision;
  const me = g.players.find((p) => p.id === g.me)!;
  const { world, maximum, availableSources } = faceDanceForceChoices(g);
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
  const emperorReturn = g.advanced && !!g.homeworlds?.worlds &&
    g.players.some((player) => player.faction === 'emperor' &&
      (player.id === d.winner || d.winners?.includes(player.id)));
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
      {emperorReturn && (
        <p className="fine" aria-label="Provisional Emperor Face Dance return">
          Provisional return: the Emperor’s normal forces return to Kaitain;
          Sardaukar return to Salusa Secundus. This is a reserve return with no
          revival fee or income, new battle or additional battle reward.
        </p>
      )}
      {held ? (
        <>
          <p>
            Return the {d.winners ? 'winning allied side’s' : 'winner’s'} {maximum} remaining
            forces to reserves. Replace up to {maximum} with your forces. The
            selected winning leader goes to the tanks without a spice bounty.
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
        </>
      ) : (
        <p>You have no unrevealed Face Dancer matching the winning leader.</p>
      )}
      <FaceDanceActions game={g} sources={sources} sector={sector} busy={busy} act={act} />
    </>
  );
}
