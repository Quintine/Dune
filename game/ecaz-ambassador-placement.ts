import type { Game, Player } from './engine';
import { MOBILE_STRONGHOLD, TERRITORIES, territory } from './board';
import { placeAmbassador } from './ecaz-ambassadors';

export type AmbassadorPlacementBoard = Pick<
  Game,
  'turn' | 'storm' | 'mobileStronghold' | 'ecazAmbassadors'
>;

function mobileStrongholdPlaced(g: AmbassadorPlacementBoard): boolean {
  const pointer = g.mobileStronghold?.location;
  return (
    typeof pointer === 'string' &&
    TERRITORIES.some(
      (destination) =>
        destination.type !== 'stronghold' &&
        destination.sectors.some(
          (sector) => pointer === `${destination.id}:${sector}`,
        ),
    )
  );
}

/** Compose E3 p.7's any-stronghold permission with E1 p.9's sheltered HMS.
 * This is a general-rule composition, not a separate HMS/Ambassador ruling.
 */
export function ambassadorPlacementDestination(
  g: AmbassadorPlacementBoard,
  to: string,
): { id: string; stronghold: boolean; inStorm: boolean; allowed: boolean } {
  const destination = TERRITORIES.find((candidate) => candidate.id === to);
  const mobile = to === MOBILE_STRONGHOLD && mobileStrongholdPlaced(g);
  return {
    id: to,
    stronghold: mobile || destination?.type === 'stronghold',
    inStorm: mobile ? false : !destination || destination.sectors.includes(g.storm),
    allowed: mobile || !!destination,
  };
}

/** Location choices only; token supply, funds and the placement turn are quoted
 * separately. Other dynamic locations do not inherit the HMS permission.
 */
export function ambassadorPlacementDestinations(
  g: AmbassadorPlacementBoard,
): { id: string; name: string; sheltered: boolean }[] {
  const destinations = TERRITORIES.filter(
    (destination) => destination.type === 'stronghold',
  ).map(({ id, name }) => ({ id, name, sheltered: false }));
  if (mobileStrongholdPlaced(g))
    destinations.push({
      id: MOBILE_STRONGHOLD,
      name: territory(MOBILE_STRONGHOLD).name,
      sheltered: true,
    });
  return destinations.filter(({ id }) => {
    const destination = ambassadorPlacementDestination(g, id);
    return (
      destination.stronghold &&
      destination.allowed &&
      !destination.inStorm &&
      !g.ecazAmbassadors?.tokens.some(
        (token) => token.zone === 'placed' && token.location === id,
      )
    );
  });
}

export function quoteEcazAmbassadorPlacement(
  g: AmbassadorPlacementBoard,
  owner: Pick<Player, 'spice'>,
  token: string,
  to: string,
): ReturnType<typeof placeAmbassador> {
  if (!g.ecazAmbassadors) throw new Error('No Ambassador supply is available.');
  return placeAmbassador(g.ecazAmbassadors, token, {
    turn: g.turn,
    availableSpice: owner.spice,
    destination: ambassadorPlacementDestination(g, to),
  });
}
