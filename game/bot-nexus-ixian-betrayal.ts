import type { Action, GameView } from './engine';

/** All profiles consume only their own legal projection. No source card,
 * rival hand or Nexus face is needed to acknowledge the native attempt. */
export function botNexusIxianBetrayalActions(game: GameView): Action[] {
  const reaction = game.nexusIxianBetrayalReaction;
  if (game.status !== 'playing' || game.phase !== 3 || !reaction?.event ||
      !reaction.canPass || reaction.hasPassed || game.roomControl?.paused || game.roomControl?.closed ||
      game.automaticContinuationPending || game.truthtrance || game.response || game.decision ||
      game.phaseOpening || game.nexusCards?.waiting.length || game.nexusTraitors?.pending) return [];
  const own = game.players.find((player) => player.id === game.me);
  if (!(own?.bot ?? own?.autopilot)) return [];
  return [{
    type: reaction.canUse && !reaction.blocked ? 'nexusIxianBetrayalUse' : 'nexusIxianBetrayalPass',
    event: reaction.event,
  }];
}
