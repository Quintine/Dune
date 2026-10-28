import {
  HomeworldCustodyError, homeworldForceGroups, type HomeworldCustody,
} from './homeworld-custody';
import { quoteHomeworldShipment, type HomeworldShipmentContext } from './homeworld-shipment';
import type { HomeworldForces } from './homeworld-custody';
import { deployRicheseNoField, isHomeworldNoFieldLocation, moveRicheseNoField, type RicheseNoField } from './richese-no-field';

export type RicheseHomeworldMarkerShipmentIntent = {
  player: string;
  destination: string;
  tokenId: string;
};
export type RicheseHomeworldMarkerTransferIntent = RicheseHomeworldMarkerShipmentIntent & {
  source: string;
  forces?: HomeworldForces;
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

/** A deployed marker can be transported like one force between eligible
 * Homeworlds, provisionally alongside physical forces from that same source.
 * Its denomination never enters the price or physical custody. */
export function quoteRicheseHomeworldMarkerTransfer(
  context: HomeworldShipmentContext,
  custody: HomeworldCustody,
  intent: RicheseHomeworldMarkerTransferIntent,
  noField: RicheseNoField,
) {
  const worlds = homeworldForceGroups(context, custody);
  requireMarker(record(intent) &&
    (Object.keys(intent).sort().join(',') === 'destination,player,source,tokenId' ||
     Object.keys(intent).sort().join(',') === 'destination,forces,player,source,tokenId') &&
    typeof intent.player === 'string' && typeof intent.source === 'string' &&
    typeof intent.destination === 'string' && typeof intent.tokenId === 'string',
  'Choose the current Homeworld marker, its source and another Homeworld.');
  if ('forces' in intent) {
    requireMarker(record(intent.forces) && Object.keys(intent.forces).sort().join(',') === 'elite,normal' &&
      Number.isSafeInteger(intent.forces.normal) && Number.isSafeInteger(intent.forces.elite) &&
      intent.forces.normal >= 0 && intent.forces.elite >= 0,
    'Choose a valid physical normal and special counter group.');
  }
  requireMarker(context.players.every(seat => seat.ally === null ||
    typeof seat.ally === 'string' && seat.ally !== seat.id && context.players.some(other => other.id === seat.ally)),
  'Homeworld shipment needs valid seated alliance identities.');
  const player = context.players.find(seat => seat.id === intent.player);
  const source = worlds.find(world => world.id === intent.source);
  const destination = worlds.find(world => world.id === intent.destination);
  requireMarker(player?.faction === 'richese' && source && destination &&
    source.native !== player.id && destination.native !== player.id && source.id !== destination.id,
  'Choose two different active foreign Homeworlds for native Richese.');
  const native = context.players.find(seat => seat.id === destination.native)!;
  requireMarker(!(player.ally === native.id && native.ally === player.id),
    'You cannot ship to your ally’s Homeworld.');
  const marker = noField?.deployed;
  requireMarker(marker?.controller === player.id && marker.tokenId === intent.tokenId &&
    isHomeworldNoFieldLocation(marker.location) && marker.location.homeworld === source.id,
  'The chosen concealed marker is no longer on its original Homeworld.');
  let moved: RicheseNoField;
  try {
    moved = moveRicheseNoField(noField, intent.tokenId, { homeworld: destination.id });
  } catch (error) {
    throw new HomeworldCustodyError(error instanceof Error ? error.message : 'Invalid No-Field transfer.');
  }
  const forces = intent.forces;
  if (forces && forces.normal + forces.elite > 0) {
    const physical = quoteHomeworldShipment(context, custody, {
      player: player.id, destination: destination.id, sources: { [source.id]: forces },
    });
    const amount = 1 + physical.amount;
    return { player: player.id, tokenId: intent.tokenId, source: source.id,
      destination: destination.id, amount, elite: physical.elite,
      cost: context.purchasedGuildRate ? Math.ceil(amount / 2) : amount, noField: moved,
      state: physical.state, players: physical.players, sources: physical.sources };
  }
  return { player: player.id, tokenId: intent.tokenId, source: source.id,
    destination: destination.id, amount: 1, elite: 0, cost: 1, noField: moved };
}
