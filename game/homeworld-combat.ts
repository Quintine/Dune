import { HOMEWORLD_CARDS, type HomeworldId } from './homeworld-cards';
import {
  homeworldForceGroups,
  type HomeworldCustody,
  type HomeworldCustodyContext,
  type HomeworldForces,
  type HomeworldReserveSeat,
} from './homeworld-custody';
import { homeworldPopulations } from './homeworld-population';

export type HomeworldCombatContext = Omit<
  HomeworldCustodyContext,
  'players'
> & {
  players: readonly (HomeworldReserveSeat & { ally?: string | null })[];
  order: readonly string[];
};
export type HomeworldCombatLocation = {
  id: string;
  name: string;
  native: string;
  card: HomeworldId;
  population: number;
  side: 'high' | 'low';
  nativeBattleStrength: number;
  forces: Record<string, HomeworldForces>;
};
export type HomeworldCombatArmy = HomeworldForces & {
  player: string;
  native: boolean;
  nativeBattleStrength: number;
};
export type HomeworldCombatPair = {
  territory: string;
  attacker: string;
  defender: string;
};
export class HomeworldCombatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HomeworldCombatError';
  }
}
function requireCombat(condition: unknown, message: string): asserts condition {
  if (!condition) throw new HomeworldCombatError(message);
}

function locations(context: HomeworldCombatContext, custody: HomeworldCustody) {
  // Custody validates seated identities and all typed pools before any lookup.
  const groups = homeworldForceGroups(context, custody);
  const seats = new Map(context.players.map((player) => [player.id, player]));
  requireCombat(
    Array.isArray(context.order) &&
      context.order.length === seats.size &&
      new Set(context.order).size === seats.size &&
      context.order.every((id) => seats.has(id)),
    'Homeworld combat needs the current complete distinct player order.',
  );
  for (const player of context.players) {
    const ally = player.ally;
    requireCombat(
      ally === undefined ||
        ally === null ||
        (typeof ally === 'string' &&
          ally !== player.id &&
          seats.has(ally) &&
          seats.get(ally)!.ally === player.id),
      'Homeworld combat needs reciprocal alliances between distinct seated players.',
    );
  }
  const populations = new Map(
    homeworldPopulations(context, custody).map((home) => [home.location, home]),
  );
  return groups.map((home): HomeworldCombatLocation => {
    const population = populations.get(home.id)!;
    const card = HOMEWORLD_CARDS.find((card) => card.id === population.card)!;
    return {
      id: home.id,
      name: card.name,
      native: home.native,
      card: population.card,
      population: population.population,
      side: population.side,
      nativeBattleStrength: population.nativeBattleStrength,
      forces: home.forces,
    };
  });
}

/** Canonical public location facts only. Presence does not award occupation,
 * authorize an action, change a card face, or grant an Arrakis territory rule. */
export function homeworldCombatLocation(
  context: HomeworldCombatContext,
  custody: HomeworldCustody,
  location: string,
): HomeworldCombatLocation {
  const home = locations(context, custody).find((home) => home.id === location);
  requireCombat(
    home,
    'Choose a canonical Homeworld belonging to a seated faction.',
  );
  return home;
}

/** Exact physical pool; native strength is additional printed battle strength,
 * not a conversion of special counters. Basic retains the same typed pieces. */
export function homeworldCombatArmy(
  context: HomeworldCombatContext,
  custody: HomeworldCustody,
  location: string,
  player: string,
): HomeworldCombatArmy {
  const home = homeworldCombatLocation(context, custody, location);
  requireCombat(
    context.players.some((seat) => seat.id === player),
    'Choose a seated Homeworld combatant.',
  );
  const forces = Object.hasOwn(home.forces, player)
    ? home.forces[player]
    : { normal: 0, elite: 0 };
  const native = player === home.native;
  return {
    player,
    normal: forces.normal,
    elite: forces.elite,
    native,
    nativeBattleStrength: native ? home.nativeBattleStrength : 0,
  };
}

/** Ordinary attacker-order pairing over positive armies. Homeworlds have no
 * storm sectors, stronghold capacity or advisor stance. An empty native pool
 * creates no defender; two foreign armies can still require their own battle. */
export function quoteHomeworldBattles(
  context: HomeworldCombatContext,
  custody: HomeworldCustody,
): HomeworldCombatPair[] {
  const homes = locations(context, custody);
  const seats = new Map(context.players.map((player) => [player.id, player]));
  const rank = new Map(context.order.map((id, index) => [id, index]));
  const positive = (home: HomeworldCombatLocation, id: string) =>
    Object.hasOwn(home.forces, id) &&
    home.forces[id].normal + home.forces[id].elite > 0;
  const battles: HomeworldCombatPair[] = [];
  for (const id of context.order) {
    const player = seats.get(id)!;
    for (const home of homes) {
      if (!positive(home, id)) continue;
      for (const other of context.players) {
        if (
          rank.get(other.id)! <= rank.get(id)! ||
          other.id === player.ally ||
          !positive(home, other.id)
        )
          continue;
        battles.push({ territory: home.id, attacker: id, defender: other.id });
      }
    }
  }
  return battles;
}
