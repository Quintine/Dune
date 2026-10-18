import { FACTIONS } from './catalog';
import type { Game } from './engine';

/** Native Nexus effects use the original initialized module and registered
 * roster. Their own occurrence, card, timing and arrival checks remain separate;
 * selecting another module does not remove the printed Fremen card effect. */
export function fremenNexusModeSupported(game: Game): boolean {
  return !!game.nexusCards?.cards && typeof game.advanced === 'boolean' &&
    game.players.length >= (game.techTokens ? 3 : 2) && game.players.length <= 6 &&
    game.players.some(player => player.faction === 'fremen') &&
    new Set(game.players.map(player => player.faction)).size === game.players.length &&
    game.expansions.length <= 3 &&
    game.expansions.every((family, index) => ['ix', 'choam', 'ecaz'].includes(family) &&
      game.expansions.indexOf(family) === index) &&
    (!game.strongholdCards || game.advanced) &&
    game.players.every(player => FACTIONS.some(faction => faction.id === player.faction &&
      (faction.expansion === 'base' || game.expansions.includes(faction.expansion))));
}
