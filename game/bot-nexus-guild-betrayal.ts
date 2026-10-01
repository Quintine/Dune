import type { Action, GameView } from './engine';

/** Public acknowledgement never depends on a hidden card or another seat's
 * resources. Only the server's own-seat offer authorizes taking the payment. */
export function botNexusGuildBetrayalActions(game: GameView): Action[] {
  const reaction = game.guildBetrayalReaction;
  if (game.status !== 'playing' || !reaction?.event ||
      !reaction.canPass || reaction.hasPassed) return [];
  const own = game.players.find((player) => player.id === game.me);
  if (!(own?.bot ?? own?.autopilot)) return [];
  return [{
    type: reaction.canUse && !reaction.blocked ? 'guildBetrayalUse' : 'guildBetrayalPass',
    event: reaction.event,
  }];
}
