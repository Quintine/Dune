import type { Action, GameView } from './engine';

/** Use only the private current battle offer; the server checks existing
 * commitments before offering changed Suboid strength/support. */
export function nexusSuboidsAction(
  game: GameView,
  event: string,
): Action | null {
  const offer = game.nexusSuboids?.offer;
  const owner = game.players.find((player) => player.id === game.me);
  const battle = game.battle;
  if (
    game.status !== 'playing' ||
    game.phase !== 6 ||
    !owner ||
    owner.faction !== 'ixians' ||
    owner.ally ||
    game.nexusCards?.card !== 'ixians' ||
    game.truthtrance ||
    game.nexusCards.waiting.length ||
    game.nexusTraitors?.pending ||
    !battle ||
    ![battle.attacker, battle.defender].includes(owner.id) ||
    battle.submitted.includes(owner.id) ||
    game.nexusSuboids?.active ||
    !offer ||
    !event ||
    offer.event !== event ||
    offer.blocked
  )
    return null;
  return { type: 'nexusSuboids', event };
}

export function nexusSuboidBotActions(game: GameView): Action[] {
  const offer = game.nexusSuboids?.offer;
  const action = offer ? nexusSuboidsAction(game, offer.event) : null;
  return action ? [action] : [];
}
