import type { Game, GameView } from './engine';
import { TERRITORIES, splitLocation } from './board';
import { faction } from './catalog';
import { nativeExpansionLeaderSkillsProfile } from './leader-skill-profile';
import { sandmasterDestinationCollection, sandmasterLeader, sandmasterModeSupported,
  type SandmasterDestinationCollection } from './sandmaster-movement';

/** A worm ride names a destination, not a traversed ground route. */
export function sandmasterWormCollection(
  game: Game | GameView,
  player: string,
  destination: string,
  sector: number,
  decision: Game['decision'] | GameView['decision'] = game.decision,
  selectedPile?: string,
): SandmasterDestinationCollection | null {
  const leader = sandmasterLeader(game, player);
  if (!leader || game.phase !== 1 || decision?.kind !== 'wormRide' ||
      decision.player !== player ||
      game.players.find(p => p.id === player)?.faction !== 'fremen') return null;
  const blocked = (reason: string): SandmasterDestinationCollection =>
    ({ leader, key: null, before: 0, piles: [], blocked: reason });
  if (!sandmasterModeSupported(game) ||
      !(nativeExpansionLeaderSkillsProfile(game) ||
        game.players.every(p => faction(p.faction).expansion === 'base')))
    return blocked('Sandmaster worm collection with other optional modules is still being integrated.');
  return sandmasterDestinationCollection(game, player, decision.territory, destination, sector, selectedPile);
}

/** Cunning is still a worm ride; its selected source is the remote desert,
 * rather than the territory of the already resolved empty appearance. */
export function sandmasterCunningCollection(
  game: Game | GameView,
  player: string,
  source: string,
  destination: string,
  sector: number,
  selectedPile?: string,
  decision: Game['decision'] | GameView['decision'] = game.decision,
): SandmasterDestinationCollection | null {
  const leader = sandmasterLeader(game, player);
  const rider = game.players.find(p => p.id === player);
  if (!leader || game.phase !== 1 || decision?.kind !== 'nexusFremenCunningRide' ||
    decision.player !== player || rider?.faction !== 'fremen') return null;
  if (!TERRITORIES.some(t => t.id === source && t.type === 'sand') ||
    !Object.entries(rider.forces).some(([key, amount]) => amount > 0 &&
      splitLocation(key).territory === source && splitLocation(key).sector !== game.storm))
    return { leader, key: null, before: 0, piles: [], blocked: 'Choose an occupied desert source for this remote ride.' };
  return sandmasterDestinationCollection(game, player, source, destination, sector, selectedPile);
}
