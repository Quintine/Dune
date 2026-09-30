import type { Action, GameView } from './engine';

/** All profiles obey the same seat-private legality, including promised cards
 * and committed budgets. Held-card hints cannot override the projected offer. */
export function botNexusRicheseBetrayalActions(game: GameView): Action[] {
  const reaction = game.richeseBetrayalReaction;
  if (game.status !== 'playing' || !reaction?.event ||
      !reaction.canPass || reaction.hasPassed) return [];
  const own = game.players.find((player) => player.id === game.me);
  if (!(own?.bot ?? own?.autopilot)) return [];
  return [{
    type: reaction.canUse && !reaction.blocked ? 'richeseBetrayalUse' : 'richeseBetrayalPass',
    event: reaction.event,
  }];
}
