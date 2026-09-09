import type { Action, GameView } from './engine';
import type { NexusCardChoice } from './nexus-card-phase';

export function nexusCardAction(game: GameView, choice: NexusCardChoice, ownRedraws: 0 | 1 | 2 = 0): Action | null {
  const offer = game.nexusCards;
  if (game.status !== 'playing' || game.phase !== 1 || offer?.turn !== game.turn ||
    !offer.waiting.includes(game.me) || !offer.choices.includes(choice) || ![0, 1, 2].includes(ownRedraws)) return null;
  return { type: 'nexusCardChoice', turn: offer.turn, card: offer.card, choice, ownRedraws: choice === 'keep' ? 0 : ownRedraws };
}

/** Common legal ownership policy. Choosing among card effects will be handled
 * by the faction-aware effect policy once those effects are integrated. */
export function nexusCardBotActions(game: GameView): Action[] {
  const choices = game.nexusCards?.choices ?? [];
  const choice = choices.includes('draw') ? 'draw' : choices.includes('keep') ? 'keep' : null;
  const action = choice && nexusCardAction(game, choice);
  return action ? [action] : [];
}
