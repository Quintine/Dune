'use client';
import type { Action, GameView } from '@/game/engine';
import { liveShipmentPromises } from '@/game/shipment-promises';
import { territory } from '@/game/board';
import { reserveShipmentCost, guildShipmentCost } from '@/game/shipment-price';
import { Button } from './ui/button';

export function ShipmentPromises({
  game: g,
  act,
  busy,
}: {
  game: GameView;
  act: (action: Action) => void;
  busy: boolean;
}) {
  const promises = liveShipmentPromises(g.shipmentPromises, g.me, g.turn);
  if (!promises.length) return null;
  const me = g.players.find((p) => p.id === g.me)!;
  const next = g.shipmentCompletion?.actions[0];
  const shipping = next && (next.type === 'ship' || next.type === 'guildShip');
  const cost = shipping
    ? next.type === 'guildShip'
      ? guildShipmentCost(
          territory(String(next.territory)).type,
          Number(next.amount),
        )
      : reserveShipmentCost(
          {
            faction: me.faction,
            halfRate:
              me.faction === 'guild' ||
              g.players.some(
                (p) => p.faction === 'guild' && p.id === me.ally,
              ) ||
              g.karamaShipping?.player === me.id,
          },
          territory(String(next.territory)).type,
          Number(next.amount),
        )
    : null;
  const share = shipping
    ? Number(next.allyPayment ?? Math.max(0, cost! - (me.spice ?? 0)))
    : 0;
  const description = next
    ? shipping
      ? `Ship ${Number(next.amount)} forces to ${territory(String(next.territory)).name}, sector ${Number(next.sector)}`
      : next.type === 'pledgeAid'
        ? 'Reclaim your unused ally pledge'
        : `Play ${me.hand?.find((c) => c.id === next.card)?.name ?? 'your preparation card'}${next.amount ? ` to revive ${Number(next.amount)} forces` : ' for your shipment discount'}`
    : '';
  return (
    <section
      className="notice"
      aria-label="Your Truthtrance shipment promises"
      id="shipment-promise-guidance"
    >
      <h3>Your shipment promises</h3>
      <ul>
        {promises.map((p, index) => (
          <li key={index}>
            {p.answer ? 'Ship' : 'Do not ship'} at least {p.minimum} physical
            forces from reserves to {territory(p.territory).name} this turn.
          </li>
        ))}
      </ul>
      {promises.some((p) => p.answer) && (
        <p>
          Complete a qualifying shipment before ground movement or finishing
          your turn. You can choose any legal count, sector and funding that
          honor your answers.
        </p>
      )}
      {next && (
        <details>
          <summary>Suggested next step · private</summary>
          <p>{description}.</p>
          {cost !== null && (
            <p>
              Cost: {cost} spice · Your payment: {cost - share} · Ally pledge:{' '}
              {share}.
            </p>
          )}
          <Button
            className="game-action"
            disabled={
              busy ||
              !!g.truthtrance ||
              !!g.response ||
              !!g.decision ||
              !!g.phaseOpening
            }
            onClick={() => act(next)}
          >
            {description}
          </Button>
        </details>
      )}
    </section>
  );
}
