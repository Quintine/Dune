import type { FactionId } from './catalog';

const supported = new Set<FactionId>([
  'atreides', 'harkonnen', 'emperor', 'guild', 'beneGesserit', 'fremen',
  'choam', 'richese',
]);

/** Public configuration only: never inspect an opponent's hand or sealed plan. */
export function mirrorWeaponModeBlock(g: {
  expansions: readonly string[];
  players: readonly { faction: FactionId }[];
  homeworlds?: unknown;
  nexusCards?: unknown;
  leaderSkills?: unknown;
  discoveries?: unknown;
  sandtrout?: boolean;
}): string | null {
  if (g.expansions.length !== 1 || g.expansions[0] !== 'choam' ||
      g.players.some((p) => !supported.has(p.faction)))
    return 'Mirror Weapon currently needs the CHOAM/Richese expansion with classic or CHOAM/Richese factions.';
  if (g.homeworlds || g.nexusCards || g.leaderSkills || g.discoveries || g.sandtrout)
    return 'Mirror Weapon with combined optional modules is still being integrated.';
  return null;
}
