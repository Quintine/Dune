'use client';

import { useId, useState } from 'react';
import type { Action, GameView } from '@/game/engine';
import {
  GRAPH,
  gameTerritories,
  location,
  mobileRouteDistance,
  splitLocation,
} from '@/game/board';
import {
  quoteSandmasterMovement,
  sandmasterActionOrder,
  sandmasterCollectible,
  sandmasterDefaultChoice,
  sandmasterLeader,
  sandmasterModeSupported,
  sandmasterPathBlocked,
  type SandmasterChoice,
} from '@/game/sandmaster-movement';
import { Button } from './ui/button';

type RouteDraft = {
  key: string;
  routes: Record<string, string[]>;
  declined: string[];
};

export function sandmasterMoveDraft(
  game: GameView,
  move: Action,
  routes?: Record<string, string[]>,
  declined: readonly string[] = [],
): {
  action: Action | null;
  choice: SandmasterChoice | null;
  collectible: string[];
  blocked: string | null;
} {
  const defaults = sandmasterDefaultChoice(game, game.me, move);
  const order = sandmasterActionOrder(game, game.me, move);
  if (!defaults || !order)
    return {
      action: null,
      choice: null,
      collectible: [],
      blocked:
        'Sandmaster needs a supported ordinary force movement and its living native trainer.',
    };
  const selectedRoutes = routes ?? defaults.routes;
  const collectible = sandmasterCollectible(game, selectedRoutes);
  const choice = {
    routes: selectedRoutes,
    collect: collectible.filter((key) => !declined.includes(key)),
  };
  try {
    quoteSandmasterMovement(game, game.me, order, choice);
    return {
      action: { ...move, sandmaster: choice },
      choice,
      collectible,
      blocked: null,
    };
  } catch (error) {
    return {
      action: null,
      choice,
      collectible,
      blocked:
        error instanceof Error
          ? error.message
          : 'Choose a legal Sandmaster route.',
    };
  }
}

function placeName(game: GameView, key: string) {
  const at = splitLocation(key);
  const name =
    gameTerritories(game).find((candidate) => candidate.id === at.territory)
      ?.name ?? at.territory;
  return `${name}, sector ${at.sector}`;
}

export function SandmasterMovement({
  game,
  move,
  act,
  busy,
  unavailableReason,
}: {
  game: GameView;
  move: Action | null;
  act: (action: Action) => void;
  busy: boolean;
  unavailableReason?: string | null;
}) {
  const id = useId();
  const me = game.players.find((player) => player.id === game.me);
  const leader = sandmasterLeader(game, game.me);
  const defaults = move ? sandmasterDefaultChoice(game, game.me, move) : null;
  const order = move ? sandmasterActionOrder(game, game.me, move) : null;
  const draftKey = JSON.stringify([
    game.turn,
    me?.moved ?? 0,
    move,
    defaults?.routes,
  ]);
  const [saved, setSaved] = useState<RouteDraft | null>(null);
  if (
    !me ||
    !leader ||
    !sandmasterModeSupported(game) ||
    !move ||
    !defaults ||
    !order
  )
    return null;
  const routes = saved?.key === draftKey ? saved.routes : defaults.routes;
  const declined = saved?.key === draftKey ? saved.declined : [];
  const draft = sandmasterMoveDraft(game, move, routes, declined);
  const updateRoutes = (next: Record<string, string[]>) =>
    setSaved({ key: draftKey, routes: next, declined });
  const blocked = unavailableReason ?? draft.blocked;
  const leaderName =
    game.allLeaders.find((candidate) => candidate.id === leader)?.name ??
    leader;
  const destination = location(order.to, order.sector);
  return (
    <section
      className="my-4 flex min-w-0 flex-col gap-3"
      aria-labelledby={`${id}-heading`}
    >
      <h3 id={`${id}-heading`}>Sandmaster movement</h3>
      <p>
        {leaderName} may collect 1 spice from one unambiguous pile in each
        distinct territory these forces enter or pass through. Choose the exact
        sector route for every moving source.
      </p>
      {order.group.map(([from]) => {
        const route = routes[from] ?? [from];
        const last = route.at(-1)!;
        const extensions =
          last === destination
            ? []
            : (GRAPH[last] ?? []).filter(
                (next) =>
                  !route.includes(next) &&
                  !sandmasterPathBlocked(game, game.me, from, next) &&
                  mobileRouteDistance([...route, next]) <= order.range,
              );
        return (
          <fieldset className="space-y-2" key={from}>
            <legend>{placeName(game, from)} route</legend>
            <p className="fine">
              {route.map((key) => placeName(game, key)).join(' → ')} ·{' '}
              {mobileRouteDistance(route)} / {order.range} territories
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={busy || route.length === 1}
                onClick={() =>
                  updateRoutes({ ...routes, [from]: route.slice(0, -1) })
                }
              >
                Remove last route step
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy || route.length === 1}
                onClick={() => updateRoutes({ ...routes, [from]: [from] })}
              >
                Reset route to source
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={
                  busy ||
                  JSON.stringify(route) ===
                    JSON.stringify(defaults.routes[from])
                }
                onClick={() =>
                  updateRoutes({ ...routes, [from]: defaults.routes[from] })
                }
              >
                Use shortest route
              </Button>
            </div>
            {last !== destination && (
              <label htmlFor={`${id}-${from}-next`}>
                Add connected sector
                <select
                  id={`${id}-${from}-next`}
                  value=""
                  disabled={busy || extensions.length === 0}
                  onChange={(event) => {
                    if (!event.target.value) return;
                    updateRoutes({
                      ...routes,
                      [from]: [...route, event.target.value],
                    });
                  }}
                >
                  <option value="">Choose the next sector</option>
                  {extensions.map((next) => (
                    <option key={next} value={next}>
                      {placeName(game, next)}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </fieldset>
        );
      })}
      {draft.collectible.length ? (
        <fieldset className="space-y-2">
          <legend>Optional spice collection</legend>
          {draft.collectible.map((key) => (
            <label className="decision-checkbox" key={key}>
              <input
                type="checkbox"
                checked={!declined.includes(key)}
                disabled={busy}
                onChange={(event) =>
                  setSaved({
                    key: draftKey,
                    routes,
                    declined: event.target.checked
                      ? declined.filter((candidate) => candidate !== key)
                      : [...new Set([...declined, key])],
                  })
                }
              />
              Collect 1 spice in {placeName(game, key)} ({game.spice[key]} on
              the pile)
            </label>
          ))}
        </fieldset>
      ) : (
        <p className="fine">
          This route enters no territory with one unambiguous positive spice
          pile. You may still declare the route without collecting.
        </p>
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
        Move with Sandmaster
      </Button>
      <p className="fine">
        Use the normal Move forces button to decline Sandmaster. A canceled
        movement collects no spice.
      </p>
    </section>
  );
}
