import { fighterCount, isAdvisor } from './advisors';
import { splitLocation, TERRITORIES } from './board';
import type { OrdinaryCardPlayer } from './card-availability';
import { presenceByLocation } from './force-presence';

export type FamilyAtomicsState = {
  advanced?: boolean;
  turn?: number;
  phase: number;
  shieldWallDestroyed: boolean;
  storm?: number;
  stormPending?: number | null;
  stormCardWindowOpen?: boolean;
  stormResolution?: unknown;
};
export type FamilyAtomicsPlayer = Pick<OrdinaryCardPlayer, 'id' | 'faction' | 'forces' | 'advisors' | 'noField'>;

const wall = TERRITORIES.find(territory => territory.id === 'shield_wall')!;
const nearby = TERRITORIES.filter(territory => territory.id === wall.id || territory.neighbors.includes(wall.id));

/** Supplied Advanced physical39/printed37 changes timing and the sector test.
 * Basic keeps the original territory-level fighter quote. No card custody,
 * modal priority or force destruction is decided by this helper.
 */
export function familyAtomicsBlock(state: FamilyAtomicsState, player: FamilyAtomicsPlayer): string | null {
  if (state.shieldWallDestroyed || state.phase !== 0 || state.stormCardWindowOpen === false || state.stormResolution)
    return 'Play Family Atomics before storm movement.';
  // A concealed No-Field is one force for all effects (supplied physical36 B),
  // including denomination0. Its public location suffices; never read private
  // value, reserve capacity or token inventory merely to qualify this card.
  const marker = player.noField?.deployed;
  const markerHere = marker?.controller === player.id && nearby.some(territory =>
    territory.id === marker.location.territory && territory.sectors.includes(marker.location.sector));
  const forces = presenceByLocation({ forces: player.forces,
    noField: markerHere ? { deployed: { location: marker!.location } } : null });
  const effective = { faction: player.faction, advisors: player.advisors, forces };
  if (!state.advanced)
    return nearby.some(territory => fighterCount(effective, territory.id) > 0)
      ? null : 'You need forces on or adjacent to the Shield Wall.';
  if (!Number.isSafeInteger(state.turn) || (state.turn ?? 0) <= 1)
    return 'Play Family Atomics after the first game turn.';
  if (!Number.isSafeInteger(state.stormPending) || (state.stormPending ?? -1) < 0 || (state.stormPending ?? 41) > 40)
    return 'Wait until storm movement is calculated before playing Family Atomics.';
  // Zero is tolerated as an inactive/legacy position, not a physical board sector.
  if (!Number.isSafeInteger(state.storm) || (state.storm ?? -1) < 0 || (state.storm ?? 19) > 18)
    return 'Family Atomics needs the current storm position.';
  const storm = state.storm!;
  const qualified = Object.entries(forces).some(([key, amount]) => {
    if (!Number.isSafeInteger(amount) || amount <= 0) return false;
    const source = splitLocation(key);
    const territory = nearby.find(candidate => candidate.id === source.territory);
    if (!territory || !territory.sectors.includes(source.sector) ||
      key !== `${source.territory}:${source.sector}` || isAdvisor(player, territory.id)) return false;
    // Adjacent regions touch the Wall in their shared sector. Use the direct
    // interval inside that region, never a circular detour around the storm.
    return wall.sectors.filter(sector => territory.sectors.includes(sector)).some(touching => {
      const first = Math.min(source.sector, touching), last = Math.max(source.sector, touching);
      return !(storm > first && storm < last);
    });
  });
  return qualified ? null : 'You need fighters on or adjacent to the Shield Wall with no intervening storm.';
}
