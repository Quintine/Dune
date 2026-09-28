import type { Action, GameView } from './engine';

/** Only the owner's private offer authorizes this physical Nexus play. The
 * public Duke controller is informational, never a substitute for the offer. */
export function nexusEcazDukeAction(game: GameView): Action | null {
  const offer = game.nexusEcazDuke;
  if (!offer || !offer.event || offer.blocked || game.status !== 'playing' ||
    game.phase !== 6 || game.phaseOpening || game.battle ||
    game.automaticContinuationPending || game.truthtrance || game.response ||
    game.decision || game.nexusTraitors?.pending || game.nexusCards?.waiting.length ||
    game.roomControl?.paused || game.roomControl?.closed ||
    game.nexusCards?.card !== 'ecaz') return null;
  const owner = game.players.find(player => player.id === game.me);
  if (!owner || owner.faction !== 'ecaz' || owner.ally) return null;
  return { type: 'nexusEcazDuke', event: offer.event };
}

export function nexusEcazDukeBotActions(game: GameView): Action[] {
  const action = nexusEcazDukeAction(game);
  return action ? [action] : [];
}
