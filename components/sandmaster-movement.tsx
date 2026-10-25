'use client';

import { useId, useState } from 'react';
import type { Action, GameView } from '@/game/engine';
import {
  gameTerritories,
  location,
  splitLocation,
} from '@/game/board';
import {
  sandmasterActionOrder,
  sandmasterDefaultChoice,
  sandmasterLeader,
  sandmasterModeSupported,
  sandmasterPathBlocked,
  sandmasterAdjacent,
  sandmasterRouteDistance,
} from '@/game/sandmaster-movement';
import {
  planetologistFlightSelection as movementFlightSelection,
  type PlanetologistFlight as MovementFlight,
} from '@/game/planetologist-flight';
import {
  SandmasterMovementAction, sandmasterMoveDraft, sandmasterMovementBlocked, sandmasterMovementSelection,
} from './sandmaster-movement-action';
import { Button } from './ui/button';

export { sandmasterMoveDraft } from './sandmaster-movement-action';

type RouteDraft = {
  key: string;
  routes: Record<string, string[]>;
  declined: string[];
};

function placeName(game: GameView, key: string) {
  const at = splitLocation(key);
  const name =
    gameTerritories(game).find((candidate) => candidate.id === at.territory)
      ?.name ?? at.territory;
  return `${name}, sector ${at.sector}`;
}

type Props = {
  game: GameView;
  move: Action | null;
  act: (action: Action) => void;
  busy: boolean;
  unavailableReason?: string | null;
};

export function SandmasterMovement(props: Props) {
  const me = props.game.players.find(player => player.id === props.game.me);
  return <SandmasterMovementDraft
    key={JSON.stringify([props.game.me, props.game.turn, me?.moved,
      props.game.ornithopter?.card?.id, props.game.ornithopter?.active?.event,
      props.game.ornithopter?.active?.completed, props.game.discoveryOrnithopter?.token,
      props.game.richeseNoField?.owner === props.game.me ? props.game.richeseNoField.event : null])}
    {...props}
  />;
}

function SandmasterMovementDraft({
  game,
  move,
  act,
  busy,
  unavailableReason,
}: Props) {
  const id = useId();
  const [flight, setFlight] = useState<MovementFlight | undefined>(undefined);
  const me = game.players.find((player) => player.id === game.me);
  const leader = sandmasterLeader(game, game.me);
  const selected = sandmasterMovementSelection(game, move, flight);
  const defaults = selected.move ? sandmasterDefaultChoice(game, game.me, selected.move) : null;
  const order = selected.move ? sandmasterActionOrder(game, game.me, selected.move) : null;
  const draftKey = JSON.stringify([
    game.turn,
    me?.moved ?? 0,
    selected.move,
    defaults?.routes,
  ]);
  const [saved, setSaved] = useState<RouteDraft | null>(null);
  if (
    !me ||
    !leader ||
    !sandmasterModeSupported(game) ||
    !move
  )
    return null;
  const routes = saved?.key === draftKey ? saved.routes : defaults?.routes ?? {};
  const declined = saved?.key === draftKey ? saved.declined : [];
  const draft = sandmasterMoveDraft(game, move, Object.keys(routes).length ? routes : undefined, declined, flight);
  const updateRoutes = (next: Record<string, string[]>) =>
    setSaved({ key: draftKey, routes: next, declined });
  const blocked = sandmasterMovementBlocked(game, draft, unavailableReason, selected.flight);
  const leaderName =
    game.allLeaders.find((candidate) => candidate.id === leader)?.name ??
    leader;
  const destination = order ? location(order.to, order.sector) : null;
  return (
    <section
      className="my-4 flex min-w-0 flex-col gap-3"
      aria-labelledby={`${id}-heading`}
    >
      <h3 id={`${id}-heading`}>Sandmaster movement</h3>
      <p>
        {leaderName} may collect 1 spice in each distinct territory these forces
        enter or pass through. Choose one existing pile per territory, or decline
        that collection, and select the exact sector route for every source.
      </p>
      <p className="fine">Provisional multi-pile policy: you choose which sector supplies the one spice; this is not a publisher allocation ruling.</p>
      {(game.ornithopter || game.discoveryOrnithopter) && (
        <>
          <label htmlFor={`${id}-flight`}>Movement transport</label>
          <select id={`${id}-flight`} value={game.ornithopter?.active?.mode ?? selected.flight}
            disabled={busy || !!game.ornithopter?.active}
            onChange={event => setFlight(event.target.value as MovementFlight)}>
            {(['ordinary', 'range3', 'twoGroups', 'discovery'] as const).map(choice => {
              const offer = movementFlightSelection(game, choice);
              const label = choice === 'ordinary' ? 'Ordinary movement' : choice === 'range3'
                ? 'Ornithopter card: fixed range three' : choice === 'twoGroups'
                  ? 'Ornithopter card: two different movements' : 'Carried Discovery Ornithopter';
              return <option key={choice} value={choice} disabled={!!offer.blocked}>
                {label}{offer.blocked ? ' — unavailable' : ''}
              </option>;
            })}
          </select>
          <p className="fine" aria-label="Provisional Sandmaster flight composition">
            Provisional flight composition: the fixed-range card and Discovery
            flight allow routes up to three territories. Each two-group card
            movement keeps normal range and uses different original forces.
            Choose each actual route and optional spice collection before moving.
            Only one flight source may be used; Planetologist remains separate.
          </p>
          {game.ornithopter?.active && !selected.transport.blocked && <p className="notice">
            {game.ornithopter.active.completed} card movements completed ·{' '}
            {game.ornithopter.active.remaining} remaining. Use the original unmoved cohort.
          </p>}
        </>
      )}
      {order?.noField && <p className="fine" aria-label="Provisional Sandmaster concealed marker">
        Provisional marker composition: your concealed No-Field moves as one
        force, including zero, and may collect along its route without revealing
        its value. A marker and physical forces in the same source sector share
        one route and collect only once per entered territory.
      </p>}
      {order && Object.keys(defaults?.routes ?? routes).map((from) => {
        const route = routes[from] ?? [from];
        const last = route.at(-1)!;
        const extensions =
          last === destination
            ? []
            : sandmasterAdjacent(game, last).filter(
                (next) =>
                  !route.includes(next) &&
                  !sandmasterPathBlocked(game, game.me, from, next) &&
                  sandmasterRouteDistance(game, [...route, next]) <= order.range,
              );
        return (
          <fieldset className="space-y-2" key={from}>
            <legend>{placeName(game, from)} route</legend>
            <p className="fine">
              {route.map((key) => placeName(game, key)).join(' → ')} ·{' '}
              {sandmasterRouteDistance(game, route)} / {order.range} territories
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
                    JSON.stringify(defaults?.routes[from])
                }
                onClick={() =>
                  defaults && updateRoutes({ ...routes, [from]: defaults.routes[from] })
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
            <label className="decision-checkbox flex items-start gap-2" key={key}>
              <input
                type="checkbox"
                className="mt-1 shrink-0"
                checked={draft.choice?.collect.includes(key) ?? false}
                disabled={busy}
                onChange={(event) => {
                  const peers = draft.collectible.filter(candidate =>
                    splitLocation(candidate).territory === splitLocation(key).territory);
                  setSaved({
                    key: draftKey,
                    routes,
                    declined: event.target.checked
                      ? [...new Set([...declined.filter(candidate => !peers.includes(candidate)),
                          ...peers.filter(candidate => candidate !== key)])]
                      : [...new Set([...declined, ...peers])],
                  });
                }}
              />
              <span>Collect 1 spice in {placeName(game, key)} ({game.spice[key]} on the pile)</span>
            </label>
          ))}
        </fieldset>
      ) : (
        <p className="fine">
          This route enters no territory with positive spice.
          You may still declare the route without collecting.
        </p>
      )}
      {blocked && (
        <output className="notice" id={`${id}-reason`}>
          {blocked}
        </output>
      )}
      <SandmasterMovementAction game={game} move={move} routes={Object.keys(routes).length ? routes : undefined}
        declined={declined} flight={flight} busy={busy} unavailableReason={unavailableReason}
        reasonId={`${id}-reason`} act={act} />
      <p className="fine">
        Use the normal Move forces button to decline Sandmaster. A canceled
        movement collects no spice.
      </p>
    </section>
  );
}
