import type { Game, GameView } from './engine';
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
  if (!sandmasterModeSupported(game) || game.ecazTreachery ||
      !(nativeExpansionLeaderSkillsProfile(game) ||
        game.players.every(p => faction(p.faction).expansion === 'base')))
    return blocked('Sandmaster worm collection with other optional modules is still being integrated.');
  return sandmasterDestinationCollection(game, player, decision.territory, destination, sector, selectedPile);
}
