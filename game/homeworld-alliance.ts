import { HomeworldCustodyError, homeworldForceGroups, type HomeworldCustody, type HomeworldCustodyContext } from './homeworld-custody';

/** Public marker presence only; token identity and denomination are private. */
export type HomeworldAllianceMarker = { homeworld: string; controller: string };

/** E3 alliance restriction uses present foreign forces, independently of any
 * saved turn entitlement to an occupied card's benefits. */
export function homeworldAllianceBlock(
  context: HomeworldCustodyContext,
  custody: HomeworldCustody,
  first: string,
  second: string,
  marker?: HomeworldAllianceMarker | null,
): string | null {
  const worlds = homeworldForceGroups(context, custody);
  if (marker) {
    const world = worlds.find(row => row.id === marker.homeworld);
    const controller = context.players.find(row => row.id === marker.controller);
    if (!world || !controller || controller.faction !== 'richese' || world.native === controller.id)
      throw new HomeworldCustodyError('Homeworld alliance marker needs its seated Richese controller and an active foreign world.');
    if ((world.native === first && controller.id === second) ||
        (world.native === second && controller.id === first))
      return 'An alliance cannot form while either faction has forces on the other’s Homeworld.';
  }
  const occupied = worlds.some((world) => {
    const visitor = world.native === first ? second : world.native === second ? first : null;
    const forces = visitor ? world.forces[visitor] : undefined;
    return !!forces && forces.normal + forces.elite > 0;
  });
  return occupied ? 'An alliance cannot form while either faction has forces on the other’s Homeworld.' : null;
}
