import type { Action, GameView } from './engine';

/** The target list is public; only the server reads its hidden Traitor Cards. */
export function ecazInquiryAction(game: GameView, target: string): Action | null {
  const offer = game.nexusEcazInquiry.offer;
  const owner = game.players.find(player => player.id === game.me);
  if (game.status !== 'playing' || game.automaticContinuationPending || !owner ||
    owner.ally || game.nexusCards?.card !== 'ecaz' || !offer || offer.blocked ||
    !offer.targets.some(player => player.id === target)) return null;
  return { type: 'nexusEcazInquiry', event: offer.event, target };
}

export function ecazInquiryBotActions(game: GameView): Action[] {
  const target = game.nexusEcazInquiry.offer?.targets.find(player => player.id !== game.me);
  const action = target && ecazInquiryAction(game, target.id);
  return action ? [action] : [];
}
