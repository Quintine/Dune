import {
  homeworldCombatLocation,
  quoteHomeworldBattles,
  type HomeworldCombatContext,
  type HomeworldCombatPair,
} from './homeworld-combat';
import { homeworldForceGroups, type HomeworldCustody } from './homeworld-custody';

/** Only public marker presence enters this helper. The physical identity and
 * printed value are not needed to identify a battle. */
export type PublicHomeworldNoField = {
  controller: string;
  location: { homeworld: string };
};

export type HomeworldNoFieldPresence = {
  homeworld: string;
  controller: string;
  effectiveForces: 1;
};

/** This is public presence, not a deposit into physical Homeworld custody.
 * The engine retains ownership of entry, reveal, reserve withdrawal and loss. */
export function homeworldNoFieldPresence(
  context: HomeworldCombatContext,
  custody: HomeworldCustody,
  marker: PublicHomeworldNoField | null | undefined,
): HomeworldNoFieldPresence | null {
  if (marker == null) return null;
  if (!marker || typeof marker !== 'object' || typeof marker.controller !== 'string' ||
      !marker.location || typeof marker.location !== 'object' ||
      typeof marker.location.homeworld !== 'string')
    throw new Error('Choose a valid public Homeworld No-Field location and controller.');
  const owner = context.players.find(player => player.id === marker.controller);
  if (!owner || owner.faction !== 'richese')
    throw new Error('A Homeworld No-Field needs its seated Richese controller.');
  const home = homeworldCombatLocation(context, custody, marker.location.homeworld);
  if (home.native === owner.id)
    throw new Error('A concealed No-Field on its own Homeworld is not supported.');
  return { homeworld: home.id, controller: owner.id, effectiveForces: 1 };
}

/** Add the marker's real participant to native world battle pairing without
 * adding a fictitious typed counter to custody or native population. A hidden
 * zero still counts as a marker until the original reveal resolves. */
export function quoteHomeworldBattlesWithNoField(
  context: HomeworldCombatContext,
  custody: HomeworldCustody,
  marker: PublicHomeworldNoField | null | undefined,
): HomeworldCombatPair[] {
  const battles = quoteHomeworldBattles(context, custody);
  const presence = homeworldNoFieldPresence(context, custody, marker);
  if (!presence) return battles;
  const home = homeworldCombatLocation(context, custody, presence.homeworld);
  const owner = context.players.find(player => player.id === presence.controller)!;
  const rank = new Map(context.order.map((id, index) => [id, index]));
  for (const opponent of context.players) {
    const forces = home.forces[opponent.id];
    if (opponent.id === owner.id || opponent.id === owner.ally || !forces ||
        forces.normal + forces.elite <= 0) continue;
    const ownerFirst = rank.get(owner.id)! < rank.get(opponent.id)!;
    const attacker = ownerFirst ? owner.id : opponent.id;
    const defender = ownerFirst ? opponent.id : owner.id;
    if (!battles.some(pair => pair.territory === home.id &&
        pair.attacker === attacker && pair.defender === defender))
      battles.push({ territory: home.id, attacker, defender });
  }
  // Preserve the native ordering: storm-order attacker, canonical Homeworld,
  // then the native player-list order for defenders.
  const worldOrder = new Map(homeworldForceGroups(context, custody).map((world, index) => [world.id, index]));
  const playerOrder = new Map(context.players.map((player, index) => [player.id, index]));
  return battles.sort((left, right) =>
    rank.get(left.attacker)! - rank.get(right.attacker)! ||
    worldOrder.get(left.territory)! - worldOrder.get(right.territory)! ||
    playerOrder.get(left.defender)! - playerOrder.get(right.defender)!,
  );
}
