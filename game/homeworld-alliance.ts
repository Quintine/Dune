import { homeworldForceGroups, type HomeworldCustody, type HomeworldCustodyContext } from './homeworld-custody';

/** E3 alliance restriction uses present foreign forces, independently of any
 * saved turn entitlement to an occupied card's benefits. */
export function homeworldAllianceBlock(
  context: HomeworldCustodyContext,
  custody: HomeworldCustody,
  first: string,
  second: string,
): string | null {
  const occupied = homeworldForceGroups(context, custody).some((world) => {
    const visitor = world.native === first ? second : world.native === second ? first : null;
    const forces = visitor ? world.forces[visitor] : undefined;
    return !!forces && forces.normal + forces.elite > 0;
  });
  return occupied ? 'An alliance cannot form while either faction has forces on the other’s Homeworld.' : null;
}
