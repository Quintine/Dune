import type { Action, GameView } from './engine';

/** Bind the current private offer without inspecting another player's cards. */
export function nexusEmperorRevivalAction(
  game: GameView,
  elite: number,
): Action | null {
  const offer = game.nexusEmperorSecretAlly;
  const owner = game.players.find((player) => player.id === game.me);
  if (
    !offer ||
    !owner ||
    owner.ally ||
    game.nexusCards?.card !== 'emperor' ||
    game.players.some((player) => player.faction === 'emperor') ||
    game.status !== 'playing' ||
    game.phase !== 4 ||
    game.response ||
    game.decision ||
    game.truthtrance ||
    game.phaseOpening ||
    game.automaticContinuationPending ||
    game.nexusCards.waiting.length ||
    game.nexusTraitors?.pending ||
    offer.revival.blocked ||
    !Number.isSafeInteger(elite) ||
    !offer.revival.eliteOptions.includes(elite)
  )
    return null;
  return { type: 'nexusEmperorRevive', event: offer.event, elite };
}
