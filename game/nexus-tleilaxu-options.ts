import type { Action, GameView } from './engine';

/** The server's private offer binds the complete revealed replacement group.
 * Do not reconstruct eligibility from private Face Dancer hands. */
export function nexusFaceDancersAction(
  game: GameView,
  event: string,
): Action | null {
  const offer = game.nexusTleilaxu?.cunning;
  const owner = game.players.find((player) => player.id === game.me);
  if (
    game.status !== 'playing' ||
    !owner ||
    owner.faction !== 'tleilaxu' ||
    owner.ally ||
    game.nexusCards?.card !== 'tleilaxu' ||
    game.truthtrance ||
    game.nexusCards.waiting.length ||
    game.nexusTraitors?.pending ||
    !offer ||
    !event ||
    offer.event !== event ||
    offer.blocked ||
    !Number.isSafeInteger(offer.count) ||
    offer.count < 1
  )
    return null;
  return { type: 'nexusFaceDancers', event };
}

/** All profiles share the legal replacement policy. There is no post-draw
 * choice and no access to another player's hand or the reserve order. */
export function nexusTleilaxuBotActions(game: GameView): Action[] {
  const offer = game.nexusTleilaxu?.cunning;
  const action = offer ? nexusFaceDancersAction(game, offer.event) : null;
  return action ? [action] : [];
}
