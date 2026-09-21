'use client';

import { useId, useState } from 'react';
import type { Action, GameView } from '@/game/engine';
import {
  planetologistLeader,
  planetologistMovementModeSupported,
  type PlanetologistMoveMode,
} from '@/game/planetologist-movement';
import { botGroundMoveAllowed } from '@/game/bot-mobility';
import {
  gameTerritories,
  location,
  splitLocation,
  territory,
} from '@/game/board';
import { isAdvisor } from '@/game/advisors';
import { presenceAt } from '@/game/force-presence';
import { Button } from './ui/button';
import { Input } from './ui/input';

type Counts = Record<string, number>;

export function planetologistMoveDraft(
  game: GameView,
  mode: PlanetologistMoveMode,
  destination: string,
  sector: number,
  forces: Counts,
  elites: Counts,
): { action: Action | null; blocked: string | null } {
  const me = game.players.find((player) => player.id === game.me);
  if (!me || !planetologistLeader(game, me.id))
    return {
      action: null,
      blocked: 'A living, uncaptured Planetologist is required.',
    };
  if (
    !planetologistMovementModeSupported(game)
  )
    return {
      action: null,
      blocked:
        'Planetologist movement with expansion factions awaits its movement audit.',
    };
  const selected = Object.entries(forces).filter(([, count]) => count > 0);
  for (const [from, count] of selected) {
    const owned = me.forces[from] ?? 0;
    if (!Number.isSafeInteger(count) || count < 1 || count > owned)
      return { action: null, blocked: 'Choose available whole force counts.' };
    const elite = elites[from] ?? 0;
    const ownedElite = me.elites?.forces[from] ?? 0;
    const minimumElite = Math.max(0, count - (owned - ownedElite));
    if (
      !Number.isSafeInteger(elite) ||
      elite < minimumElite ||
      elite > Math.min(count, ownedElite)
    )
      return {
        action: null,
        blocked: 'Choose an available normal and elite mix for every source.',
      };
  }
  const origins = new Set(
    selected.map(([from]) => splitLocation(from).territory),
  );
  if (
    (mode === 'range' && origins.size !== 1) ||
    (mode === 'gather' && origins.size !== 2)
  )
    return {
      action: null,
      blocked:
        mode === 'range'
          ? 'Select forces from one territory.'
          : 'Select forces from exactly two different territories.',
    };
  if (
    game.advanced &&
    me.faction === 'beneGesserit' &&
    new Set([...origins].map((origin) => isAdvisor(me, origin))).size > 1 &&
    !presenceAt(me, destination) &&
    game.players.some(
      (player) => player.id !== me.id && presenceAt(player, destination),
    )
  )
    return {
      action: null,
      blocked:
        'Gathering advisors and fighters into an enemy-only territory is still being implemented.',
    };
  const target = location(destination, sector);
  if (
    selected.some(
      ([from]) =>
        !botGroundMoveAllowed(game, me, from, target, elites[from] ?? 0, mode),
    )
  )
    return {
      action: null,
      blocked:
        mode === 'range'
          ? 'The selected route is beyond the boosted range or is blocked.'
          : 'Each selected source must reach the destination using its normal range.',
    };
  return {
    action: {
      type: 'move',
      planetologist: mode,
      forces: Object.fromEntries(selected),
      ...(me.elites
        ? {
            eliteForces: Object.fromEntries(
              selected.map(([from]) => [from, elites[from] ?? 0]),
            ),
          }
        : {}),
      territory: destination,
      sector,
    },
    blocked: null,
  };
}

export function PlanetologistMovement({
  game,
  act,
  busy,
  destination,
  sector,
  unavailableReason,
}: {
  game: GameView;
  act: (action: Action) => void;
  busy: boolean;
  destination: string;
  sector: number;
  unavailableReason?: string | null;
}) {
  const id = useId();
  const [mode, setMode] = useState<PlanetologistMoveMode>('range');
  const [forces, setForces] = useState<Counts>({});
  const [elites, setElites] = useState<Counts>({});
  const me = game.players.find((player) => player.id === game.me);
  const leader = me && planetologistLeader(game, me.id);
  if (!me || !leader) return null;
  const sources = Object.entries(me.forces).filter(([, count]) => count > 0);
  const draft = planetologistMoveDraft(
    game,
    mode,
    destination,
    sector,
    forces,
    elites,
  );
  const blocked =
    unavailableReason ??
    (game.phase !== 5 || game.active !== me.id
      ? 'Planetologist movement is available only during your movement turn.'
      : game.ornithopter?.active
        ? 'Finish the current Ornithopter movement first.'
        : game.truthtrance || game.nexusTraitors?.pending
          ? 'Resolve the current private response first.'
          : me.autopilot || game.automaticContinuationPending
            ? 'Wait for the current automatic action to finish.'
            : draft.blocked);
  const leaderName =
    game.allLeaders.find((candidate) => candidate.id === leader)?.name ??
    leader;
  return (
    <section
      className="my-4 flex min-w-0 flex-col gap-3"
      aria-labelledby={`${id}-heading`}
    >
      <h3 id={`${id}-heading`}>Planetologist movement</h3>
      <p>
        {leaderName} may add one territory to one movement, up to three, or
        gather forces from exactly two territories into the selected
        destination.
      </p>
      <label htmlFor={`${id}-mode`}>Movement mode</label>
      <select
        id={`${id}-mode`}
        value={mode}
        disabled={busy}
        onChange={(event) =>
          setMode(event.target.value as PlanetologistMoveMode)
        }
      >
        <option value="range">One territory farther, maximum three</option>
        <option value="gather">Gather from two territories</option>
      </select>
      <p className="fine">
        Destination: {territory(destination).name}, sector {sector}. Select the
        physical forces to move below.
      </p>
      {sources.length ? (
        sources.map(([from, owned]) => {
          const source = splitLocation(from);
          const sourceName =
            gameTerritories(game).find(
              (candidate) => candidate.id === source.territory,
            )?.name ?? source.territory;
          const selected = forces[from] ?? 0;
          const ownedElite = me.elites?.forces[from] ?? 0;
          const minimumElite = Math.max(0, selected - (owned - ownedElite));
          return (
            <div className="grid gap-2" key={from}>
              <label htmlFor={`${id}-${from}-forces`}>
                {sourceName}, sector {source.sector} · {owned} forces
                <Input
                  id={`${id}-${from}-forces`}
                  type="number"
                  min={0}
                  max={owned}
                  value={selected}
                  disabled={busy || source.sector === game.storm}
                  onChange={(event) =>
                    setForces({ ...forces, [from]: Number(event.target.value) })
                  }
                />
              </label>
              {me.elites && (
                <label htmlFor={`${id}-${from}-elites`}>
                  Elite from this group · {ownedElite} available
                  <Input
                    id={`${id}-${from}-elites`}
                    type="number"
                    min={minimumElite}
                    max={Math.min(selected, ownedElite)}
                    value={elites[from] ?? 0}
                    disabled={busy || selected === 0}
                    onChange={(event) =>
                      setElites({
                        ...elites,
                        [from]: Number(event.target.value),
                      })
                    }
                  />
                </label>
              )}
            </div>
          );
        })
      ) : (
        <p className="fine">No board forces are available to move.</p>
      )}
      {blocked && (
        <output className="notice" id={`${id}-reason`}>
          {blocked}
        </output>
      )}
      <Button
        className="min-h-11 whitespace-normal motion-reduce:transition-none"
        disabled={busy || !!blocked || !draft.action}
        aria-describedby={blocked ? `${id}-reason` : undefined}
        onClick={() => {
          if (!busy && !blocked && draft.action) act(draft.action);
        }}
      >
        Move with Planetologist
      </Button>
      <p className="fine">
        This does not combine with a No-Field or either Ornithopter movement.
        Normal movement and arrival rules still apply.
      </p>
    </section>
  );
}
