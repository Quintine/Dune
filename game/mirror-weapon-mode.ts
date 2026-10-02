import type { FactionId } from './catalog';

const supported = new Set<FactionId>([
  'atreides', 'harkonnen', 'emperor', 'guild', 'beneGesserit', 'fremen',
  'choam', 'richese', 'ecaz', 'moritani',
]);

/** Public configuration only: never inspect an opponent's hand or sealed plan. */
export function mirrorWeaponModeBlock(g: {
  expansions: readonly string[];
  advanced?: boolean;
  players: readonly { faction: FactionId }[];
  homeworlds?: unknown;
  nexusCards?: unknown;
  leaderSkills?: unknown;
  discoveries?: unknown;
  sandtrout?: boolean;
}): string | null {
  if (!g.expansions.includes('choam') ||
      g.expansions.some(id => id !== 'choam' && id !== 'ecaz') ||
      (g.expansions.includes('ecaz') && g.advanced !== true) ||
      g.players.some((p) => !supported.has(p.faction)))
    return 'Mirror Weapon currently needs CHOAM/Richese with classic or native Ecaz/Moritani factions; Ix timing remains unresolved.';
  if (g.homeworlds || g.nexusCards || g.leaderSkills || g.discoveries || g.sandtrout)
    return 'Mirror Weapon with combined optional modules is still being integrated.';
  return null;
}
