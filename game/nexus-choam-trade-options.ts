import type { Action, GameView } from './engine';

/** Human and AI use the same private, server-quoted physical card choices. */
export function nexusChoamTradeAction(game: GameView, card: string): Action | null {
  const offer = game.nexusChoamTrade;
  if (game.status !== 'playing' || game.phase !== 7 ||
    game.nexusCards?.card !== 'choam' || game.automaticContinuationPending ||
    !offer || offer.blocked || !offer.cards.some(choice => choice.id === card)) return null;
  return { type: 'nexusChoamTrade', event: offer.event, card };
}
export function nexusChoamTradeBotActions(game: GameView): Action[] {
  const card = game.nexusChoamTrade?.cards[0];
  const action = card ? nexusChoamTradeAction(game, card.id) : null;
  return action ? [action] : [];
}
