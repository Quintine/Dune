'use client';

import { useId, useState } from 'react';
import type { Action, GameView } from '@/game/engine';
import { faction } from '@/game/catalog';
import { territory, MOBILE_STRONGHOLD } from '@/game/board';
import { fighterCount } from '@/game/advisors';
import { reserveShipmentCost } from '@/game/shipment-price';
import type { RicheseNoFieldView } from '@/game/richese-no-field';
import { ShipmentQuote } from './shipment-quote';
import { Button } from './ui/button';

/** This renderer receives public player data only, never the private token model. */
export function NoFieldBoardMarkers({
  players,
}: {
  players: readonly {
    id: string;
    name: string;
    faction: string;
    noField?: RicheseNoFieldView | null;
  }[];
}) {
  return players.flatMap((player) => {
    const marker = player.noField?.deployed;
    if (!marker) return [];
    const t = territory(marker.location.territory);
    const label = `${player.name}: concealed No-Field in ${t.name}, sector ${marker.location.sector}. Counts as one force until revealed.`;
    return [
      <g
        key={`no-field-${player.id}`}
        aria-label={label}
        transform={`translate(${t.center[0] - 45},${t.center[1] - 23})`}
        pointerEvents="none"
      >
        <title>{label}</title>
        <rect
          x="-16"
          y="-15"
          width="32"
          height="30"
          rx="5"
          fill="#181921"
          stroke={faction(player.faction).color}
          strokeWidth="3"
          strokeDasharray="5 2"
        />
        <text
          y="5"
          textAnchor="middle"
          fill="#f5ebd1"
          fontSize="12"
          fontWeight="800"
        >
          NF
        </text>
      </g>,
    ];
  });
}

export function RicheseNoFieldControls({
  game,
  act,
  busy,
  destination,
  sector,
  allyPayment,
}: {
  game: GameView;
  act: (action: Action) => void;
  busy: boolean;
  destination: string;
  sector: number;
  allyPayment: string;
}) {
  const id = useId();
  const [selection, setSelection] = useState('');
  const info = game.richeseNoField;
  const me = game.players.find((player) => player.id === game.me);
  if (!info || info.owner !== game.me || !info.private || !me) return null;
  const state = info.private;
  const available = state.tokens.filter(
    (token) => token.id !== state.lastShipped,
  );
  const selected =
    available.find((token) => token.id === selection) ?? available[0];
  const deployed = state.deployed;
  const selectedTerritory = territory(destination);
  const rate = {
    faction: me.faction,
    halfRate:
      me.faction === 'guild' ||
      game.players.some(
        (player) => player.faction === 'guild' && player.id === me.ally,
      ) ||
      game.karamaShipping?.player === me.id,
  };
  const cost = reserveShipmentCost(rate, selectedTerritory.type, 1);
  const share =
    !me.ally || allyPayment === ''
      ? Math.max(0, cost - (me.spice ?? 0))
      : Number(allyPayment);
  const validShare = Number.isSafeInteger(share) && share >= 0 && share <= cost;
  const problems: string[] = [];
  if (!info.canShip)
    problems.push(info.shipBlock ?? 'No-Field shipment is not available now.');
  if (!selected) problems.push('No different No-Field token is available.');
  if (destination === MOBILE_STRONGHOLD)
    problems.push('You cannot ship directly into the mobile stronghold.');
  if (
    selectedTerritory.type === 'stronghold' &&
    game.players.filter(
      (player) => player.id !== me.id && fighterCount(player, destination) > 0,
    ).length >= 2
  )
    problems.push('Two other factions already occupy this stronghold.');
  if (!selectedTerritory.sectors.includes(sector))
    problems.push('Select a sector in the destination territory.');
  if (sector === game.storm)
    problems.push('You cannot ship into the storm sector.');
  if (!validShare) problems.push(`Choose an ally payment from 0 to ${cost}.`);
  else {
    if (share > game.aid.available)
      problems.push(
        `Only ${game.aid.available} pledged ally spice is available.`,
      );
    if (cost - share > (me.spice ?? 0))
      problems.push('Your spice does not cover the chosen payment.');
  }
  const showShipment = game.phase === 5 && game.active === me.id && !me.shipped;
  return (
    <details className="my-4" open={showShipment || !!deployed}>
      <summary className="min-h-11 cursor-pointer py-3 font-semibold">
        Your No-Field tokens
      </summary>
      <div className="flex flex-col gap-3 py-3">
        <p className="fine">
          Your token values are private until revealed. A concealed marker
          counts as one force, even when its value is zero. Physical forces
          remain in reserves until revelation.
        </p>
        <ul
          className="m-0 flex flex-wrap gap-3 p-0"
          aria-label="Private No-Field inventory"
        >
          {state.tokens.map((token) => (
            <li
              key={token.id}
              className="list-none rounded border border-[#8e8159] px-3 py-2"
            >
              <strong>No-Field {token.value}</strong>
              <span className="block text-sm">
                {deployed?.tokenId === token.id
                  ? 'Concealed on the board'
                  : state.lastShipped === token.id
                    ? 'Last used · cannot repeat'
                    : 'Available'}
              </span>
            </li>
          ))}
        </ul>
        {deployed && (
          <>
            <p>
              Concealed at {territory(deployed.location.territory).name}, sector{' '}
              {deployed.location.sector}. Use the movement controls to move the
              marker alone or with physical forces from that territory.
            </p>
            <Button
              className="min-h-11 whitespace-normal"
              disabled={busy || !info.canReveal}
              aria-describedby={
                !info.canReveal ? `${id}-reveal-reason` : undefined
              }
              onClick={() => {
                if (!busy && info.canReveal)
                  act({
                    type: 'revealNoField',
                    event: info.event,
                    token: deployed.tokenId,
                  });
              }}
            >
              Reveal your No-Field
            </Button>
            {!info.canReveal && (
              <p id={`${id}-reveal-reason`} className="fine">
                {info.revealBlock ??
                  'Voluntary revelation is not available now.'}
              </p>
            )}
          </>
        )}
        {showShipment && (
          <>
            <label htmlFor={`${id}-token`}>Private token to ship</label>
            <select
              id={`${id}-token`}
              className="min-h-11"
              value={selected?.id ?? ''}
              disabled={busy || !!deployed}
              onChange={(event) => setSelection(event.target.value)}
            >
              {state.tokens.map((token) => (
                <option
                  key={token.id}
                  value={token.id}
                  disabled={token.id === state.lastShipped}
                >
                  No-Field {token.value}
                  {token.id === state.lastShipped ? ' · cannot repeat' : ''}
                </option>
              ))}
            </select>
            <p className="fine">
              Destination: {selectedTerritory.name}, sector {sector}. Choose
              another destination on the map or in the shipment controls. This
              replaces your normal shipment at the price of one force.
            </p>
            <ShipmentQuote
              id={`${id}-quote`}
              quote={
                validShare
                  ? {
                      cost,
                      normalCost: reserveShipmentCost(
                        { ...rate, halfRate: false },
                        selectedTerritory.type,
                        1,
                      ),
                      ownPayment: cost - share,
                      pledgedPayment: share,
                    }
                  : null
              }
              funding={{
                ownSpice: me.spice ?? 0,
                pledgedSpice: game.aid.available,
              }}
              unavailableReasons={problems}
            />
            <Button
              className="min-h-11 whitespace-normal"
              disabled={busy || problems.length > 0}
              aria-describedby={`${id}-quote`}
              onClick={() => {
                if (!busy && problems.length === 0 && selected)
                  act({
                    type: 'ship',
                    noField: selected.id,
                    event: info.event,
                    territory: destination,
                    sector,
                    allyPayment: share,
                  });
              }}
            >
              Ship concealed No-Field {selected?.value ?? ''} · {cost} spice
            </Button>
          </>
        )}
      </div>
    </details>
  );
}
