'use client';
import type { Action, GameView } from '@/game/engine';
import { liveShipmentPromises, matchesShipment, shipmentClaimText } from '@/game/shipment-promises';
import { liveMovementPromises } from '@/game/movement-promises';
import { truthQuestionText } from '@/game/truthtrance';
import { CHEAP_HERO_TRAITOR } from '@/game/traitors';
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
  const early = g.phase < 5;
  const movement = liveMovementPromises(g.movementPromises ?? [], g.me, g.turn);
  const jointMovement = movement.length > 0;
  const next = g.phase === 5 && !jointMovement ? g.shipmentCompletion?.actions[0] : undefined;
  const preparation = early && !movement.some(promise => promise.answer) ? g.shipmentPreparation?.actions[0] : undefined;
  const preparationCard = preparation?.type === 'card'
    ? me.hand?.find(card => card.id === preparation.card) : undefined;
  const preparationLabel = preparation?.type === 'charity'
    ? 'Claim charity'
    : preparation?.type === 'revive'
      ? `Revive ${Number(preparation.amount)} force${Number(preparation.amount) === 1 ? '' : 's'} in Revival`
      : preparationCard ? `Play ${preparationCard.name}` : null;
  const blocked = busy || !!g.truthtrance || !!g.response || !!g.decision || !!g.phaseOpening;
  const shipping = next && (next.type === 'ship' || next.type === 'guildShip');
  const halfRate = g.karamaShipping?.player === me.id ||
    (!g.guildRateCanceled &&
      (me.faction === 'guild' ||
        g.players.some((p) => p.faction === 'guild' && p.id === me.ally)));
  const cost = shipping
    ? next.type === 'guildShip'
      ? guildShipmentCost(
          String(next.territory) === 'reserves'
            ? 'reserves'
            : territory(String(next.territory)).type,
          Number(next.amount),
          g.karamaShipping?.player === me.id || !g.guildRateCanceled,
        )
      : reserveShipmentCost(
          { faction: me.faction, halfRate },
          territory(String(next.territory)).type,
          Number(next.amount),
        )
    : null;
  const share = shipping
    ? Number(next.allyPayment ?? Math.max(0, cost! - (me.spice ?? 0)))
    : 0;
  const elite = Number(next?.elite ?? 0);
  const allocation =
    elite > 0
      ? `, including ${elite} ${me.faction === 'emperor' ? 'Sardaukar' : me.faction === 'fremen' ? 'Fedaykin' : 'elite force' + (elite === 1 ? '' : 's')}`
      : '';
  const description = next
    ? shipping
      ? `Ship ${Number(next.amount)} forces${allocation} to ${territory(String(next.territory)).name}, sector ${Number(next.sector)}`
      : next.type === 'pledgeAid'
        ? 'Reclaim your unused ally pledge'
        : `Play ${me.hand?.find((c) => c.id === next.card)?.name ?? 'your preparation card'}${next.amount ? ` to revive ${Number(next.amount)} forces${allocation}` : ' for your shipment discount'}`
    : '';
  return (
    <section
      className="notice"
      aria-label="Your Truthtrance shipment promises"
      id="shipment-promise-guidance"
    >
      <h3>Your shipment promises</h3>
      {jointMovement && <p>Your ground-movement promise guidance below keeps both sets of answers possible.</p>}
      {early ? <p>
        Your shipment opportunity is later this turn, during Shipment and
        Movement. Keep your needed spice, forces and cards available to honor
        these answers while you continue playing the current phase normally.
      </p> : g.active !== g.me && <p>
        Your shipment turn is still ahead. This answer stays binding while
        other players finish; shipment actions become available on your turn.
      </p>}
      <ul>
        {promises.map((p, index) => (
          <li key={index}>
            You answered {p.answer ? 'Yes' : 'No'} to:{' '}
            {p.mixed
              ? truthQuestionText(
                  { kind: 'mixedShipment', target: p.player, mixed: p.mixed },
                  id => id === CHEAP_HERO_TRAITOR
                    ? 'Cheap Hero / Heroine'
                    : g.allLeaders.find(leader => leader.id === id)?.name ?? id,
                  id => g.combatLocations.find(place => place.id === id)!.name,
                )
              : `Will you ${shipmentClaimText(p)} this turn?`}
          </li>
        ))}
      </ul>
      {promises.some((p) => matchesShipment(p, null) !== p.answer) ? (
        <p>
          {early
            ? 'During your later Shipment and Movement turn, complete a qualifying shipment before ground movement or finishing that turn: skipping would not honor the whole claim you answered.'
            : 'Complete a qualifying shipment before ground movement or finishing your turn: skipping would not honor the whole claim you answered.'}
          {' '}
          You can choose any legal count, sector and funding that honor all
          your answers. Current facts remain fixed at the time of your answer.
        </p>
      ) : (
        <p>
          Skipping shipment honors your whole claims. If you ship, choose a
          legal shipment that honors every answer. Current facts are historical
          and create no later card, spice or force holding obligation.
        </p>
      )}
      {preparation && preparationLabel && (
        <section aria-label="Current shipment preparation">
          <p>
            This preparation is available in the current phase. Your shipment
            remains later this turn.
          </p>
          <Button className="game-action" disabled={blocked} onClick={() => {
            if (blocked) return;
            act(preparation);
          }}>
            {preparationLabel}
          </Button>
        </section>
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
