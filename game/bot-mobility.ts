import type { GameView } from './engine';
import { guildShipmentCost } from './shipment-price';
import { fighterCount, isAdvisor } from './advisors';
import { presenceAt } from './force-presence';
import { EcazOccupancyError } from './ecaz-occupy';
import { territoryEntryBlock, strongholdPathBlocked } from './occupancy';
import {
  distance,
  gameDistance,
  location,
  MOBILE_STRONGHOLD,
  splitLocation,
  territory,
} from './board';

type Seat = GameView['players'][number];
/** These checks consume only the same personalized projection as the bot policy. */
function advisorArrival(g: GameView, p: Seat, to: string, source?: string) {
  if (
    !g.advanced ||
    p.faction !== 'beneGesserit' ||
    !g.players.some((other) => other.id !== p.id && presenceAt(other, to))
  )
    return false;
  return presenceAt(p, to)
    ? isAdvisor(p, to)
    : !!source && isAdvisor(p, source);
}
export function botEntryAllowed(
  g: GameView,
  p: Seat,
  to: string,
  sector: number,
  kind: 'move' | 'ship' | 'guildShip',
  source?: string,
) {
  if (
    to === MOBILE_STRONGHOLD &&
    (!g.mobileStronghold?.location ||
      (kind !== 'move' && p.faction !== 'ixians'))
  )
    return false;
  if (
    sector !== 0 &&
    sector === g.storm &&
    !(kind === 'ship' && g.advanced && p.faction === 'fremen')
  )
    return false;
  const advisors = advisorArrival(
    g,
    p,
    to,
    kind === 'move' ? source : undefined,
  );
  if (
    source &&
    !advisors &&
    p.advisors?.[source]?.lockedTurn === g.turn &&
    g.players.some((other) => other.id !== p.id && presenceAt(other, to))
  )
    return false;
  try {
    return !territoryEntryBlock(g.players, p.id, to, advisors);
  } catch (error) {
    if (error instanceof EcazOccupancyError) return false;
    throw error;
  }
}
export function botMovementRange(g: GameView, p: Seat, elite: number) {
  const base =
    fighterCount(p, 'arrakeen') || fighterCount(p, 'carthag')
      ? 3
      : (p.faction === 'fremen' && !p.fremenMovementBlocked) ||
          (p.faction === 'ixians' && elite > 0 && !p.ixMovementBlocked)
        ? 2
        : 1;
  return base + (p.faction === 'choam' ? g.choamMovementBonus : 0);
}
export function botGroundMoveAllowed(
  g: GameView,
  p: Seat,
  from: string,
  to: string,
  elite: number,
) {
  const source = splitLocation(from),
    target = splitLocation(to);
  if (
    from === to ||
    (source.sector !== 0 && source.sector === g.storm) ||
    !botEntryAllowed(
      g,
      p,
      target.territory,
      target.sector,
      'move',
      source.territory,
    )
  )
    return false;
  if (
    source.territory !== target.territory &&
    g.balisetRestrictions.some(
      (b) => b.player === p.id && b.territory === target.territory,
    ) &&
    g.players.some(
      (other) =>
        other.faction === 'choam' && presenceAt(other, target.territory),
    )
  )
    return false;
  const advisors = isAdvisor(p, source.territory);
  return (
    gameDistance(g, from, to, (key) => {
      const loc = splitLocation(key);
      return (
        (loc.sector !== 0 && loc.sector === g.storm) ||
        strongholdPathBlocked(g.players, p.id, loc.territory, advisors)
      );
    }) <= botMovementRange(g, p, elite)
  );
}
/** Fremen reinforcement radius is static territory geometry, not a ground route. */
export function fremenReserveEntry(to: string) {
  return territory('the_great_flat').sectors.some((from) =>
    territory(to).sectors.some(
      (sector) =>
        distance(location('the_great_flat', from), location(to, sector)) <= 2,
    ),
  );
}
/** Guild cross-shipping is paid transport, including allied Fremen reserves. */
export function guildTransportCost(to: string, amount: number) {
  return guildShipmentCost(
    to === 'reserves' ? 'reserves' : territory(to).type,
    amount,
  );
}
