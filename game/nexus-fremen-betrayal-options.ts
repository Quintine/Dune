import type { Action, GameView } from './engine';

/** Only the holder's private offer authorizes spending the physical Nexus card. */
export function fremenBetrayalAction(game: GameView): Action | null {
  const offer = game.nexusFremenBetrayal;
  const owner = game.players.find(player => player.id === game.me);
  if (!offer || offer.blocked || !owner || owner.ally ||
    owner.faction === 'fremen' || game.nexusCards?.card !== 'fremen' ||
    game.automaticContinuationPending) return null;
  return { type: 'nexusFremenBetrayal', event: offer.event };
}

export function fremenBetrayalBotActions(game: GameView): Action[] {
  const action = fremenBetrayalAction(game);
  return action ? [action] : [];
}
