import type { Action, GameView } from './engine';

/** The owner-only server offer verifies the five-counter army and the
 * feasibility of existing commitments. Preserve its exact battle event. */
export function nexusSardaukarAction(
  game: GameView,
  event: string,
): Action | null {
  const state = game.nexusSardaukar;
  const owner = game.players.find((player) => player.id === game.me);
  const battle = game.battle;
  if (
    game.status !== 'playing' ||
    !game.advanced ||
    game.phase !== 6 ||
    !owner ||
    owner.faction !== 'emperor' ||
    owner.ally ||
    game.nexusCards?.card !== 'emperor' ||
    !battle ||
    ![battle.attacker, battle.defender].includes(owner.id) ||
    battle.submitted.includes(owner.id) ||
    game.automaticContinuationPending ||
    game.truthtrance ||
    game.response ||
    game.decision ||
    game.phaseOpening ||
    game.nexusCards.waiting.length ||
    game.nexusTraitors?.pending ||
    state?.pending ||
    state?.active ||
    !state?.offer ||
    !event ||
    state.offer.event !== event ||
    state.offer.blocked
  )
    return null;
  return { type: 'nexusSardaukar', event };
}
export function nexusSardaukarBotActions(game: GameView): Action[] {
  const offer = game.nexusSardaukar?.offer;
  const action = offer ? nexusSardaukarAction(game, offer.event) : null;
  return action ? [action] : [];
}
