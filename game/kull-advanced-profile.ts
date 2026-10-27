import type { KullDefaultProfile, KullDefaultEligibility } from './kull-default-profile';

const classic = new Set(['atreides', 'beneGesserit', 'emperor', 'fremen', 'guild', 'harkonnen']);
const blocked = (reason: string): KullDefaultEligibility => ({ eligible: false, reason });

/** Public configuration for the existing Advanced printed-Kull prototype.
 * This does not select it, inspect private hands, validate fresh inventory, or
 * authorize a start. In particular, the genuine initializer remains the owner
 * of the saved-game, physical deck and readiness checks. */
export function advancedKullLobbyProfile(game: KullDefaultProfile): KullDefaultEligibility {
  if (game.status !== 'lobby') return blocked('Advanced Kull applies only to a fresh lobby.');
  if (game.advanced !== true) return blocked('Choose Advanced preview rules for this Kull profile.');
  if (!Array.isArray(game.expansions) || game.expansions.length !== 2 ||
    !game.expansions.includes('choam') || !game.expansions.includes('ix'))
    return blocked('Advanced Kull currently needs exactly the CHOAM and Ix decks.');
  if (!Array.isArray(game.players) || game.players.length < 1 || game.players.length > 6 ||
    !game.players.some(player => player?.faction === 'choam') ||
    !game.players.every(player => !!player && typeof player.faction === 'string' &&
      (player.faction === 'choam' || classic.has(player.faction))) ||
    new Set(game.players.map(player => player.faction)).size !== game.players.length)
    return blocked('Advanced Kull currently needs CHOAM and up to five distinct classic factions.');
  const options = game.lobbyOptions, projected = game.lobbyModules;
  if (options?.leaderSkills || options?.ecazTreachery || projected?.leaderSkills || projected?.ecazTreachery ||
    projected?.nexusCards || projected?.discoveries || game.leaderSkills || game.ecazTreachery || game.nexusCards ||
    game.discoveryEnabled || game.discoveries || game.discoveryStash || game.greatMaker ||
    game.homeworlds || game.techTokens || game.strongholdCards)
    return blocked('Advanced Kull currently excludes optional modules.');
  return { eligible: true, reason: null };
}

/** Eligibility remains independent of any host selection or opt-out. */
export function advancedKullLobbyEligible(game: KullDefaultProfile): boolean {
  return advancedKullLobbyProfile(game).eligible;
}
