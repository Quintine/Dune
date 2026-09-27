import type { Action, GameView } from './engine';

/** Server-owned private offer binds the selected physical group and turn. */
export function nexusFremenRevivalAction(game: GameView, elite: number): Action | null {
  const offer = game.nexusFremenRevival;
  const owner = game.players.find(player => player.id === game.me);
  if (!offer || !owner || owner.ally || game.nexusCards?.card !== 'fremen' ||
    game.players.some(player => player.faction === 'fremen') ||
    game.status !== 'playing' || game.phase !== 4 ||
    game.response || game.decision || game.truthtrance || game.phaseOpening ||
    game.automaticContinuationPending || game.nexusCards.waiting.length ||
    game.nexusTraitors?.pending || offer.blocked ||
    !Number.isSafeInteger(elite) || !offer.eliteOptions.includes(elite)) return null;
  return { type: 'nexusFremenRevive', event: offer.event, elite };
}
