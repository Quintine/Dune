import type { Action, GameView } from './engine';

/** Bind the action to the private projected offer, never to a client-picked hand card. */
export function nexusChoamBetrayalAction(game: GameView): Action | null {
  const offer = game.nexusChoamBetrayal;
  const owner = game.players.find((player) => player.id === game.me);
  if (
    game.status !== 'playing' ||
    game.automaticContinuationPending ||
    !owner ||
    owner.ally ||
    game.nexusCards?.card !== 'choam' ||
    !offer ||
    !offer.event ||
    offer.blocked ||
    !game.players.some((player) => player.id === offer.target.id && player.faction === 'choam')
  ) return null;
  return { type: 'nexusChoamBetrayal', event: offer.event };
}

/** Bots use only Bidding's public hand count, avoiding blind invalid attempts. */
export function nexusChoamBetrayalBotActions(game: GameView): Action[] {
  if (game.phase !== 3) return [];
  const action = nexusChoamBetrayalAction(game);
  return action ? [action] : [];
}
