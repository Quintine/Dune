import type { Action, GameView } from './engine';

/** The private offer binds the exact territory and current card to this turn. */
export function ecazBetrayalAction(game: GameView, territory: string): Action | null {
  const offer = game.nexusEcazBetrayal;
  const owner = game.players.find(player => player.id === game.me);
  if (!offer || offer.blocked || !owner || owner.ally || owner.faction === 'ecaz' ||
    game.nexusCards?.card !== 'ecaz' || game.automaticContinuationPending ||
    !offer.territories.some(choice => choice.territory === territory)) return null;
  return { type: 'nexusEcazBetrayal', event: offer.event, territory };
}

export function ecazBetrayalBotActions(game: GameView): Action[] {
  const territory = game.nexusEcazBetrayal?.territories[0]?.territory;
  const action = territory ? ecazBetrayalAction(game, territory) : null;
  return action ? [action] : [];
}
