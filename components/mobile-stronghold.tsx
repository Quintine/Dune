'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { HelpTip } from './help-tip';
import {
  GRAPH,
  TERRITORIES,
  MOBILE_LOCATION,
  mobileRouteDistance,
  splitLocation,
  territory,
} from '@/game/board';
import type { Action, GameView } from '@/game/engine';
const label = (key: string) => {
  const loc = splitLocation(key);
  return `${territory(loc.territory).name}${loc.sector ? ` · sector ${loc.sector}` : ''}`;
};
export function MobileStronghold({
  game: g,
  act,
  busy,
  card,
}: {
  game: GameView;
  act: (action: Action) => void;
  busy: boolean;
  card?: string;
}) {
  const pointer = g.mobileStronghold?.location;
  const placement = !pointer;
  const blocked = !placement ? g.homeworldMobility?.mobileStrongholdBlocked : null;
  const [destination, setDestination] = useState('polar_sink:0');
  const [route, setRoute] = useState<string[]>(pointer ? [pointer] : []);
  const [collect, setCollect] = useState(true);
  const max = card ? 2 : 3;
  const current = route.at(-1) ?? '';
  const choices = placement
    ? TERRITORIES.filter((t) => t.type !== 'stronghold').flatMap((t) =>
        t.sectors.map((s) => `${t.id}:${s}`),
      )
    : (GRAPH[current] ?? []).filter(
        (key) =>
          mobileRouteDistance([...route, key]) <= max &&
          splitLocation(key).sector !== g.storm &&
          splitLocation(route[0]).sector !== g.storm,
      );
  const me = g.players.find((p) => p.id === g.me)!;
  const preview = route.reduce(
    (sum, key) =>
      sum + Math.min(g.spice[key] ?? 0, (me.forces[MOBILE_LOCATION] ?? 0) * 2),
    0,
  );
  const valid =
    placement ||
    (!blocked && route.length > 1 &&
      route.every((key) => splitLocation(key).sector !== g.storm) &&
      territory(splitLocation(current).territory).type !== 'stronghold');
  return (
    <div className="mobile-route">
      {blocked && <p className="notice">{blocked}</p>}
      <p>
        {placement
          ? 'Point your stronghold at a sector in any non-stronghold territory. Placement does not collect spice.'
          : `Move the stronghold up to ${max} territories. Choose each sector along the route; the forces stay inside.`}{' '}
        <HelpTip topic="mobileStronghold" />
      </p>
      {!placement && pointer && splitLocation(pointer).sector === g.storm && (
        <p className="fine">
          The pointing sector is in storm. Keep the current position until the
          storm clears.
        </p>
      )}
      {!placement && (
        <>
          <ol>
            {route.map((key) => (
              <li key={key}>
                {label(key)}
                {g.spice[key] ? ` · ${g.spice[key]} spice` : ''}
              </li>
            ))}
          </ol>
          <p className="fine">
            {mobileRouteDistance(route)} / {max} territories ·{' '}
            {collect ? preview : 0} spice to collect
          </p>
        </>
      )}
      <label>
        {placement ? 'Pointing sector' : 'Next sector'}
        <select
          aria-label={placement ? 'Pointing sector' : 'Next route sector'}
          value={placement ? destination : ''}
          onChange={(e) => {
            if (placement) setDestination(e.target.value);
            else if (e.target.value) setRoute([...route, e.target.value]);
          }}
        >
          {!placement && <option value="">Choose next sector…</option>}
          {choices.map((key) => (
            <option key={key} value={key}>
              {label(key)}
            </option>
          ))}
        </select>
      </label>
      {!placement && (
        <>
          <Button
            variant="outline"
            disabled={busy || route.length < 2}
            onClick={() => setRoute(route.slice(0, -1))}
          >
            Undo last step
          </Button>
          <label className="decision-checkbox">
            <input
              type="checkbox"
              checked={collect}
              onChange={(e) => setCollect(e.target.checked)}
            />
            Collect spice along the route
          </label>
          {!valid && route.length > 1 && (
            <p className="fine">Finish in a non-stronghold territory.</p>
          )}
        </>
      )}
      <Button
        className="game-action"
        disabled={busy || !valid}
        onClick={() =>
          act(
            placement
              ? { type: 'decision', location: destination }
              : card
                ? { type: 'card', mode: 'special', card, route, collect }
                : { type: 'decision', route, collect },
          )
        }
      >
        {placement
          ? 'Place stronghold'
          : card
            ? 'Spend Karama and relocate'
            : 'Declare stronghold route'}
      </Button>
      {!placement && !card && (
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => act({ type: 'decision', decline: true })}
        >
          Keep current position
        </Button>
      )}
    </div>
  );
}
