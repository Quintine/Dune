import { HOMEWORLD_CARDS, type HomeworldId } from './homeworld-cards';
import {
  homeworldForceGroups,
  type HomeworldCustody,
  type HomeworldCustodyContext,
} from './homeworld-custody';

export type HomeworldPopulation = {
  location: string;
  card: HomeworldId;
  native: string;
  population: number;
  side: 'high' | 'low';
  nativeBattleStrength: number;
  /** Printed potential, not an award or proof of occupation eligibility. */
  printedOccupiedSpice: number;
  /** Added only when the native faction is otherwise taking the named benefit. */
  extraFreeRevival: number;
  extraCharity: number;
};

/** Public physical projection only. Occupier entitlements and effect timing are
 * separate: occupation can retain a low penalty after native population rises.
 * No player advantage, income, battle result or game action is applied here. */
export function homeworldPopulations(
  context: HomeworldCustodyContext,
  custody: HomeworldCustody,
): HomeworldPopulation[] {
  return homeworldForceGroups(context, custody).map((home) => {
    const faction = context.players.find((p) => p.id === home.native)!.faction;
    const card = HOMEWORLD_CARDS.find((candidate) =>
      home.secondary
        ? candidate.id === 'salusa_secundus'
        : candidate.faction === faction && candidate.id !== 'salusa_secundus',
    )!;
    const native = home.forces[home.native];
    const population =
      card.reserveType === 'sardaukar'
        ? native.elite
        : native.normal + native.elite;
    // Global minimum-high rule resolves Salusa's overlapping printed endpoints.
    const side = population >= card.high.reserves.min ? 'high' : 'low';
    const bonus = side === 'low' && card.id !== 'salusa_secundus' ? 1 : 0;
    return {
      location: home.id,
      card: card.id,
      native: home.native,
      population,
      side,
      nativeBattleStrength: card[side].battleStrength,
      printedOccupiedSpice: card.occupied.spiceIcons,
      extraFreeRevival: bonus,
      extraCharity: bonus,
    };
  });
}
