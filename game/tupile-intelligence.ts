import type { FactionId } from './catalog';
import {
  homeworldForceGroups,
  HomeworldCustodyError,
  type HomeworldCustody,
  type HomeworldCustodyContext,
} from './homeworld-custody';
import { homeworldPopulations } from './homeworld-population';

/** Qualification/expiry belongs to the occupation lifecycle, not this query. */
export type TupileOccupation = 'unoccupied' | 'occupied' | 'unknown';
export type TupileIntelligenceCategory = 'weapons' | 'defenses';
export type TupileIntelligenceTarget = {
  player: string;
  faction: FactionId;
  /** Public physical contact locations, including either Emperor world. */
  contact: string[];
  blocked: string | null;
};

/** Public eligibility only. No hand, spice, battle plan, skills or hidden
 * No-Field data is accepted or consulted. Used factions persist for the game. */
export function tupileIntelligenceTargets(
  context: HomeworldCustodyContext,
  custody: HomeworldCustody,
  owner: string,
  usedFactions: readonly FactionId[],
  occupation: TupileOccupation,
): TupileIntelligenceTarget[] {
  const worlds = homeworldForceGroups(context, custody);
  const choam = context.players.find((p) => p.id === owner);
  if (choam?.faction !== 'choam')
    throw new HomeworldCustodyError('Only the native CHOAM faction may request Tupile intelligence.');
  if (!['unoccupied', 'occupied', 'unknown'].includes(occupation))
    throw new HomeworldCustodyError('Tupile intelligence needs an explicit occupation status.');
  if (!Array.isArray(usedFactions) || new Set(usedFactions).size !== usedFactions.length ||
      usedFactions.some((faction) => faction === 'choam' || !context.players.some((p) => p.faction === faction)))
    throw new HomeworldCustodyError('Tupile intelligence usage must name unique seated opposing factions.');
  const population = homeworldPopulations(context, custody).find((p) => p.native === owner)!;
  const tupile = worlds.find((home) => home.native === owner)!;
  const present = (home: typeof tupile, player: string) => {
    const group = home.forces[player];
    return !!group && group.normal + group.elite > 0;
  };
  return context.players.filter((p) => p.id !== owner).map((target) => {
    const contact = worlds.filter((home) => home.native === target.id && present(home, owner)).map((home) => home.id);
    if (present(tupile, target.id)) contact.push(tupile.id);
    const blocked = occupation === 'unknown'
      ? 'Tupile occupation must be resolved before its low advantage can be used.'
      : occupation === 'occupied'
        ? 'Occupied Tupile removes CHOAM’s low-population intelligence advantage.'
        : population.side !== 'low'
          ? 'Tupile intelligence requires at most ten native CHOAM reserves.'
          : usedFactions.includes(target.faction)
            ? 'Tupile intelligence has already been used against this faction in this game.'
            : contact.length === 0
              ? 'CHOAM must be on that faction’s Homeworld, or that faction must be on Tupile.'
              : null;
    return { player: target.id, faction: target.faction, contact, blocked };
  });
}

/** Validate a requested category without reading the answer or consuming use.
 * The eventual engine must atomically record one current private disclosure. */
export function quoteTupileIntelligenceRequest(
  context: HomeworldCustodyContext,
  custody: HomeworldCustody,
  owner: string,
  usedFactions: readonly FactionId[],
  occupation: TupileOccupation,
  target: string,
  category: TupileIntelligenceCategory,
) {
  if (category !== 'weapons' && category !== 'defenses')
    throw new HomeworldCustodyError('Choose either the weapon count or the defense count.');
  const candidate = tupileIntelligenceTargets(context, custody, owner, usedFactions, occupation)
    .find((p) => p.player === target);
  if (!candidate || candidate.blocked)
    throw new HomeworldCustodyError(candidate?.blocked ?? 'Choose a seated opposing faction for Tupile intelligence.');
  return { owner, target: candidate.player, faction: candidate.faction, category, contact: [...candidate.contact] };
}
