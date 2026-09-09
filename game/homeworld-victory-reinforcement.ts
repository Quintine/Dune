import type { Game } from './engine';
import {
  gameTerritories,
  location,
  MOBILE_STRONGHOLD,
  splitLocation,
  validLocation,
} from './board';
import { fighterCount } from './advisors';
import { territoryEntryBlock } from './occupancy';
import { homeworldContext } from './homeworld-game';
import {
  HomeworldCustodyError,
  homeworldForceGroups,
  quoteHomeworldCustody,
} from './homeworld-custody';
import { homeworldPopulations } from './homeworld-population';
import { HOMEWORLD_CARDS } from './homeworld-cards';
import { quoteNativeReserveWithdrawal } from './homeworld-native-reserves';
import { lowGrummanRevealBlock } from './homeworld-collection';

export type HomeworldVictoryReinforcementContext = Pick<
  Game,
  | 'advanced'
  | 'players'
  | 'homeworlds'
  | 'storm'
  | 'mobileStronghold'
  | 'moritaniTerror'
>;
export type HomeworldVictoryWitness = {
  event: string;
  turn: number;
  player: string;
  territory: string;
  result: 'normal' | 'traitor';
};
export type HomeworldVictoryReinforcementDestination = {
  id: string;
  name: string;
  territory?: string;
  sector?: number;
  homeworld?: string;
  blocked: string | null;
};
export type HomeworldVictoryReinforcementQuote = HomeworldVictoryWitness & {
  population: number;
  survivors: number;
  amount: 0 | 1;
  blocked: string | null;
  destinations: HomeworldVictoryReinforcementDestination[];
};

function validCount(n: unknown): n is number {
  return Number.isSafeInteger(n) && (n as number) >= 0 && (n as number) <= 20;
}
function invalid(message: string): never {
  throw new HomeworldCustodyError(message);
}

/** Printed Caladan high face; E3 p9's continuous native threshold applies at
 * actual use, after winner casualties. The caller proves this original victory
 * against its battle receipt and owns ordering, single use and entry reactions.
 * Face Dance priority is not selected here. */
export function quoteHomeworldVictoryReinforcement(
  g: HomeworldVictoryReinforcementContext,
  victory: HomeworldVictoryWitness,
): HomeworldVictoryReinforcementQuote {
  if (
    !victory ||
    typeof victory !== 'object' ||
    Array.isArray(victory) ||
    Object.keys(victory).sort().join(',') !==
      'event,player,result,territory,turn' ||
    typeof victory.event !== 'string' ||
    !victory.event ||
    typeof victory.player !== 'string' ||
    !victory.player ||
    typeof victory.territory !== 'string' ||
    !victory.territory ||
    !Number.isSafeInteger(victory.turn) ||
    victory.turn < 1 ||
    !['normal', 'traitor'].includes(victory.result)
  )
    invalid(
      'Caladan reinforcement requires one original winning battle receipt.',
    );
  const owner = g.players.find((p) => p.id === victory.player);
  if (!owner || g.players.filter((p) => p.id === victory.player).length !== 1)
    invalid('The original winning faction must be seated.');
  const board = gameTerritories(g).find((t) => t.id === victory.territory);
  const worlds = g.homeworlds?.custody
    ? homeworldForceGroups(homeworldContext(g), g.homeworlds.custody)
    : [];
  const home = worlds.find((world) => world.id === victory.territory);
  if (!board && !home)
    invalid('Choose the actual battle territory or active Homeworld.');
  let survivors = 0;
  if (home) {
    const forces = home.forces[owner.id];
    survivors = forces ? forces.normal + forces.elite : 0;
  } else {
    for (const [key, amount] of Object.entries(owner.forces)) {
      const at = splitLocation(key);
      if (
        !validLocation(at.territory, at.sector) ||
        location(at.territory, at.sector) !== key ||
        !validCount(amount)
      )
        invalid(
          'Caladan reinforcement requires valid surviving physical forces.',
        );
      if (at.territory === victory.territory) survivors += amount;
    }
  }
  if (!validCount(survivors))
    invalid('The surviving army exceeds its physical force inventory.');
  const population = g.homeworlds?.custody
    ? (homeworldPopulations(homeworldContext(g), g.homeworlds.custody).find(
        (world) => world.native === owner.id && world.card === 'caladan',
      )?.population ?? 0)
    : 0;
  const quote: HomeworldVictoryReinforcementQuote = {
    ...victory,
    population,
    survivors,
    amount: 0,
    blocked: null,
    destinations: [],
  };
  if (owner.faction !== 'atreides' || !g.homeworlds?.custody) return quote;
  if (population < 6)
    return {
      ...quote,
      blocked:
        'Caladan requires at least six native reserves for victory reinforcement.',
    };
  if (survivors === 0)
    return {
      ...quote,
      blocked: 'An Atreides force must survive at the battle location.',
    };
  // All native reserves already occupy Caladan. Moving one within that same
  // custody pool cannot add a counter or return one from the Tanks.
  if (home?.native === owner.id)
    return {
      ...quote,
      blocked:
        'The native reserve forces are already on Caladan; no additional force can be placed there.',
    };
  quote.amount = 1;
  if (home) {
    const native = g.players.find((seat) => seat.id === home.native)!;
    quote.destinations.push({
      id: home.id,
      name: HOMEWORLD_CARDS.find(
        (card) =>
          card.faction === native.faction &&
          (card.id === 'salusa_secundus') === home.secondary,
      )!.name,
      homeworld: home.id,
      blocked:
        owner.ally === native.id && native.ally === owner.id
          ? 'You cannot reinforce on your ally’s Homeworld.'
          : null,
    });
    return quote;
  }
  if (!Number.isSafeInteger(g.storm) || g.storm < 1 || g.storm > 18)
    invalid('Caladan reinforcement requires the current storm sector.');
  const bg = g.players.find((seat) => seat.faction === 'beneGesserit');
  const moritani = g.players.find((seat) => seat.faction === 'moritani');
  quote.destinations = board!.sectors.map((sector) => {
    let blocked: string | null = null;
    if (board!.id === MOBILE_STRONGHOLD)
      blocked =
        'Caladan reinforcement in the Hidden Mobile Stronghold awaits its entry-classification ruling.';
    if (!blocked && sector === g.storm)
      blocked =
        'Caladan reinforcement into a sector in storm awaits its placement-permission ruling.';
    blocked ??= territoryEntryBlock(g.players, owner.id, board!.id);
    if (!blocked && g.advanced && bg && fighterCount(bg, board!.id) > 0)
      blocked =
        'Intrusion after Caladan reinforcement awaits an entry-classification ruling.';
    if (
      !blocked &&
      moritani &&
      owner.id !== moritani.ally &&
      !lowGrummanRevealBlock(g, moritani.id, 1) &&
      g.moritaniTerror?.tokens.some(
        (token) => token.status === 'placed' && token.location === board!.id,
      )
    )
      blocked =
        'Terror after Caladan reinforcement awaits an entry-classification ruling.';
    return {
      id: location(board!.id, sector),
      name: `${board!.name}${sector ? ` · sector ${sector}` : ''}`,
      territory: board!.id,
      sector,
      blocked,
    };
  });
  return quote;
}

/** One actual native normal counter; never a revival, fee or ordinary shipment. */
export function quoteHomeworldVictoryReinforcementDestination(
  g: HomeworldVictoryReinforcementContext,
  victory: HomeworldVictoryWitness,
  destination: string,
) {
  const quote = quoteHomeworldVictoryReinforcement(g, victory);
  const selected = quote.destinations.find(
    (choice) => choice.id === destination,
  );
  if (quote.amount !== 1 || !selected || selected.blocked)
    invalid(
      quote.blocked ??
        selected?.blocked ??
        'Choose one eligible destination at the won battle location.',
    );
  const forces = { normal: 1, elite: 0 };
  const context = homeworldContext(g);
  const transfer = selected.homeworld
    ? quoteHomeworldCustody(context, g.homeworlds!.custody!, [
        {
          homeworld: 'homeworld:atreides',
          player: victory.player,
          withdraw: forces,
          deposit: { normal: 0, elite: 0 },
        },
        {
          homeworld: selected.homeworld,
          player: victory.player,
          withdraw: { normal: 0, elite: 0 },
          deposit: forces,
        },
      ])
    : quoteNativeReserveWithdrawal(
        context,
        g.homeworlds!.custody!,
        victory.player,
        forces,
      );
  return { quote, selected, transfer };
}
