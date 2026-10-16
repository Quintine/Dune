import type { FactionId } from './catalog';

const supported = new Set<FactionId>([
  'atreides', 'harkonnen', 'emperor', 'guild', 'beneGesserit', 'fremen',
  'choam', 'richese', 'ecaz', 'moritani',
  'ixians', 'tleilaxu',
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
  techTokens?: unknown;
  strongholdCards?: unknown;
}): string | null {
  if (!g.expansions.includes('choam') ||
      g.expansions.some(id => id !== 'choam' && id !== 'ecaz' && id !== 'ix') ||
      (g.expansions.includes('ecaz') && g.advanced !== true) ||
      g.players.some((p) => !supported.has(p.faction)))
    return 'Mirror Weapon needs selected CHOAM/Richese with supported native factions; Ecaz/Moritani combinations require Advanced.';
  if (g.expansions.includes('ix') && g.expansions.includes('ecaz') && (g.techTokens || g.strongholdCards))
    return 'Mixed E3 Stone/Mirror with Tech Tokens or Stronghold Cards remains outside this profile.';
  if (g.homeworlds || g.nexusCards || g.leaderSkills || g.discoveries || g.sandtrout)
    return 'Mirror Weapon with combined optional modules is still being integrated.';
  return null;
}
