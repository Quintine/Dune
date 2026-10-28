import {
  HomeworldCustodyError, homeworldForceGroups, type HomeworldCustody,
} from './homeworld-custody';
import type { HomeworldShipmentContext } from './homeworld-shipment';
import { deployRicheseNoField, type RicheseNoField } from './richese-no-field';

export type RicheseHomeworldMarkerShipmentIntent = {
  player: string;
  destination: string;
  tokenId: string;
};

const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
function requireMarker(condition: unknown, message: string): asserts condition {
  if (!condition) throw new HomeworldCustodyError(message);
}

/** Quote one concealed Richese marker as a single shipment, not a physical
 * counter. The engine owns timing, payment, response windows and commitment.
 * Nothing in the input state is mutated, and the marker's denomination never
 * changes its invoice or causes reserve counters to move. */
export function quoteRicheseHomeworldMarkerShipment(
  context: HomeworldShipmentContext,
  custody: HomeworldCustody,
  intent: RicheseHomeworldMarkerShipmentIntent,
  noField: RicheseNoField,
) {
  // This validates all physical reserve and foreign garrison custody first.
  const worlds = homeworldForceGroups(context, custody);
  requireMarker(record(intent) && Object.keys(intent).sort().join(',') === 'destination,player,tokenId' &&
    typeof intent.player === 'string' && typeof intent.destination === 'string' && typeof intent.tokenId === 'string',
  'Choose a Richese player, one active Homeworld and one physical No-Field.');
  requireMarker(context.players.every(seat => seat.ally === null ||
    typeof seat.ally === 'string' && seat.ally !== seat.id && context.players.some(other => other.id === seat.ally)),
  'Homeworld shipment needs valid seated alliance identities.');
  const player = context.players.find(seat => seat.id === intent.player);
  const source = worlds.find(world => world.id === 'homeworld:richese');
  const destination = worlds.find(world => world.id === intent.destination);
  requireMarker(player?.faction === 'richese' && source?.native === player.id,
    'Only native Richese can ship its concealed No-Field.');
  requireMarker(destination && destination.native !== player.id,
    'Choose another seated faction’s Homeworld.');
  const native = context.players.find(seat => seat.id === destination.native)!;
  requireMarker(!(player.ally === native.id && native.ally === player.id),
    'You cannot ship to your ally’s Homeworld.');

  let deployed: RicheseNoField;
  try {
    deployed = deployRicheseNoField(noField, {
      tokenId: intent.tokenId,
      controller: player.id,
      location: { homeworld: destination.id },
    });
  } catch (error) {
    throw new HomeworldCustodyError(error instanceof Error ? error.message : 'Invalid No-Field shipment.');
  }
  return {
    player: player.id,
    tokenId: intent.tokenId,
    source: source.id,
    destination: destination.id,
    amount: 1,
    elite: 0,
    cost: 1,
    noField: deployed,
  };
}
