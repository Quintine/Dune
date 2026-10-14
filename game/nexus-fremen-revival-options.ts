import type { Action, GameView } from './engine';

/** Enable the server-owned phase quota; original revival controls choose the forces. */
export function nexusFremenRevivalAction(game: GameView): Action | null {
  const offer = game.nexusFremenRevival;
  const owner = game.players.find(player => player.id === game.me);
  if (!offer || !owner || owner.ally || game.nexusCards?.card !== 'fremen' ||
    game.players.some(player => player.faction === 'fremen') ||
    game.status !== 'playing' || game.phase !== 4 ||
    game.response || game.decision || game.truthtrance || game.phaseOpening ||
    game.automaticContinuationPending || game.nexusCards.waiting.length ||
    game.nexusTraitors?.pending || offer.blocked || offer.maxForces < 1) return null;
  return { type: 'nexusFremenRevival', event: offer.event };
}
