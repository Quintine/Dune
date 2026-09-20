import { distance, splitLocation, territory } from './board';
import { strongholdPathBlocked, territoryEntryBlock, type OccupancySeat } from './occupancy';

export const INTRODUCTION_MOVE_SOURCE = 'red_chasm:7';
export const INTRODUCTION_MOVE_DESTINATIONS = [
  'pasty_mesa:5', 'shield_wall:8', 'imperial_basin:9', 'tueks_sietch:5',
] as const;
export type IntroductionMoveDestination = typeof INTRODUCTION_MOVE_DESTINATIONS[number];
export type IntroductionMovementChoice = {
  moveDestination: IntroductionMoveDestination;
  moveForces: number;
  moveCity: boolean;
  moveStorm: boolean;
};

/** Fixed Basic teaching position; shared map geometry and occupancy rules. */
export function introductionMovement(s: IntroductionMovementChoice) {
  const target = splitLocation(s.moveDestination);
  const forces: Record<string, number> = { [INTRODUCTION_MOVE_SOURCE]: 5 };
  if (s.moveCity) forces['arrakeen:10'] = 1;
  const players: OccupancySeat[] = [
    { id: 'you', faction: 'atreides', forces },
    { id: 'guild', faction: 'guild', forces: { 'tueks_sietch:5': 1 } },
    { id: 'emperor', faction: 'emperor', forces: { 'tueks_sietch:5': 1 } },
  ];
  const storm = s.moveStorm ? target.sector : 18;
  const range = s.moveCity ? 3 : 1;
  const steps = distance(INTRODUCTION_MOVE_SOURCE, s.moveDestination, key => {
    const at = splitLocation(key);
    return at.sector === storm || strongholdPathBlocked(players, 'you', at.territory);
  });
  const blocked = !Number.isSafeInteger(s.moveForces) || s.moveForces < 1 || s.moveForces > 5
    ? 'Choose one to five of your source forces.'
    : target.sector === storm ? 'Forces cannot enter a sector covered by the storm.'
    : territoryEntryBlock(players, 'you', target.territory)
      ?? (steps > range ? `This destination is beyond your ${range}-territory movement range.` : null);
  return { name: territory(target.territory).name, sector: target.sector,
    range, steps, blocked, allowed: blocked === null,
    sourceRemaining: 5 - s.moveForces, arrived: s.moveForces };
}
