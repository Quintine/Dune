import type { Action, GameView } from './engine';

/** All four policies acknowledge only their own legal view. Neither the native
 * source nor any rival card or private traitor estimate participates. */
export function botNexusHarkonnenBetrayalActions(game: GameView): Action[] {
  const reaction = game.nexusHarkonnenBetrayalReaction;
  if (game.status !== 'playing' || game.phase !== 6 || !reaction?.event ||
      !reaction.canPass || reaction.hasPassed || game.roomControl?.paused || game.roomControl?.closed ||
      game.automaticContinuationPending || game.truthtrance || game.response || game.decision ||
      game.phaseOpening || game.nexusCards?.waiting.length || game.nexusTraitors?.pending) return [];
  const own = game.players.find((player) => player.id === game.me);
  if (!(own?.bot ?? own?.autopilot)) return [];
  return [{
    type: reaction.canUse && !reaction.blocked ? 'nexusHarkonnenBetrayalUse' : 'nexusHarkonnenBetrayalPass',
    event: reaction.event,
  }];
}
