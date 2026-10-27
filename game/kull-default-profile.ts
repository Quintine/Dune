/** Public lobby facts only. This controls fresh Basic setup and never examines
 * a player's cards, spice or any hidden Karama/counter eligibility. */
export type KullDefaultProfile = {
  status: string;
  advanced: boolean;
  expansions: readonly string[];
  players: readonly { faction: string }[];
  lobbyOptions?: { leaderSkills?: unknown; ecazTreachery?: unknown } | null;
  /** Same public selections on a projected lobby view. */
  lobbyModules?: { leaderSkills?: unknown; ecazTreachery?: unknown; nexusCards?: unknown; discoveries?: unknown } | null;
  leaderSkills?: unknown;
  ecazTreachery?: unknown;
  nexusCards?: unknown;
  discoveryEnabled?: unknown;
  discoveries?: unknown;
  discoveryStash?: unknown;
  greatMaker?: unknown;
  homeworlds?: unknown;
  techTokens?: unknown;
  strongholdCards?: unknown;
};
export type KullDefaultEligibility = { eligible: boolean; reason: string | null };

const classic = new Set(['atreides', 'beneGesserit', 'emperor', 'fremen', 'guild', 'harkonnen']);
const ix = new Set(['ixians', 'tleilaxu']);
const choam = new Set(['choam', 'richese']);
const ecaz = new Set(['ecaz', 'moritani']);
const blocked = (reason: string): KullDefaultEligibility => ({ eligible: false, reason });

/** Public profile eligibility is independent of the host's explicit opt-out.
 * A lone CHOAM seat can see the choice while waiting for others; the native
 * start still checks readiness, minimum seats and all fresh private inventory.
 * This quote cannot authorize a start or inspect pending/private game state. */
export function kullDefaultProfile(game: KullDefaultProfile): KullDefaultEligibility {
  if (game.status !== 'lobby') return blocked('Automatic Kull applies only to a fresh lobby.');
  if (game.advanced !== false) return blocked('Automatic Kull currently supports Basic rules only.');
  if (!Array.isArray(game.expansions) ||
    !(game.expansions.length === 2 || game.expansions.length === 3 && game.expansions.includes('ecaz')) ||
    !game.expansions.includes('choam') || !game.expansions.includes('ix') ||
    new Set(game.expansions).size !== game.expansions.length)
    return blocked('Automatic Kull currently needs the CHOAM and Ix decks, with Ecaz optional.');
  if (!Array.isArray(game.players) || game.players.length < 1 || game.players.length > 6 ||
    !game.players.some(player => player?.faction === 'choam') ||
    !game.players.every(player => !!player && typeof player.faction === 'string' &&
      (classic.has(player.faction) || ix.has(player.faction) && game.expansions.includes('ix') ||
       choam.has(player.faction) && game.expansions.includes('choam') ||
       ecaz.has(player.faction) && game.expansions.includes('ecaz'))) ||
    new Set(game.players.map(player => player.faction)).size !== game.players.length)
    return blocked('Automatic Kull needs one to six distinct factions, including CHOAM, with their selected decks.');
  const options = game.lobbyOptions, projected = game.lobbyModules;
  if (options?.leaderSkills || options?.ecazTreachery || projected?.leaderSkills || projected?.ecazTreachery ||
    projected?.nexusCards || projected?.discoveries || game.leaderSkills || game.ecazTreachery || game.nexusCards ||
    game.discoveryEnabled || game.discoveries || game.discoveryStash || game.greatMaker ||
    game.homeworlds || game.techTokens || game.strongholdCards)
    return blocked('Automatic Kull currently excludes optional modules.');
  return { eligible: true, reason: null };
}

export function kullDefaultEligible(game: KullDefaultProfile): boolean {
  return kullDefaultProfile(game).eligible;
}
