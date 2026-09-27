import type { Action, GameView } from './engine';

export function moritaniBetrayalAction(game: GameView, token: string): Action | null {
  const offer = game.nexusMoritaniBetrayal;
  if (!offer || offer.blocked || game.nexusCards?.card !== 'moritani' ||
    game.automaticContinuationPending || !offer.tokens.some(choice => choice.id === token)) return null;
  return { type: 'nexusMoritaniBetrayal', event: offer.event, token };
}

export function moritaniBetrayalBotActions(game: GameView): Action[] {
  const token = game.nexusMoritaniBetrayal?.tokens[0];
  const action = token ? moritaniBetrayalAction(game, token.id) : null;
  return action ? [action] : [];
}
