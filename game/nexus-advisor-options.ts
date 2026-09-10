import type { Action, GameView } from './engine';
import { fighterCount } from './advisors';

export function nexusAdvisorCanAct(game: GameView): boolean {
  const owner = game.players.find((player) => player.id === game.me);
  return !!(
    game.status === 'playing' &&
    game.advanced &&
    game.phase === 5 &&
    game.active === game.me &&
    owner?.faction === 'beneGesserit' &&
    !owner.ally &&
    game.nexusCards?.card === 'beneGesserit' &&
    !game.automaticContinuationPending &&
    !game.truthtrance &&
    !game.response &&
    !game.decision &&
    !game.phaseOpening &&
    !game.nexusCards.waiting.length &&
    !game.nexusTraitors?.pending &&
    !game.nexusAdvisors?.pending &&
    game.nexusAdvisors?.offer &&
    !game.nexusAdvisors.offer.blocked
  );
}

/** Whole-territory legality and quantities come from the private server quote. */
export function nexusAdvisorAction(
  game: GameView,
  event: string,
  territories: readonly string[],
): Action | null {
  if (!nexusAdvisorCanAct(game)) return null;
  const offer = game.nexusAdvisors!.offer!;
  if (
    !event ||
    offer.event !== event ||
    !territories.length ||
    new Set(territories).size !== territories.length ||
    !territories.every((territory) =>
      offer.territories.some(
        (choice) =>
          choice.territory === territory &&
          !choice.blocked &&
          Number.isSafeInteger(choice.count) &&
          choice.count > 0,
      ),
    )
  )
    return null;
  return { type: 'nexusAdvisors', event, territories: [...territories] };
}

/** Prefer publicly favorable battles, using no hidden cards or No-Field values.
 * This is the shared legal policy, not a calibrated battle-strength estimate. */
export function nexusAdvisorBotActions(game: GameView): Action[] {
  if (!nexusAdvisorCanAct(game)) return [];
  const owner = game.players.find((player) => player.id === game.me)!;
  const offer = game.nexusAdvisors!.offer!;
  const territories = offer.territories
    .filter((choice) => {
      if (choice.blocked) return false;
      const enemies = game.players
        .filter((player) => player.id !== owner.id && player.id !== owner.ally)
        .reduce(
          (count, player) => count + fighterCount(player, choice.territory),
          0,
        );
      return enemies > 0 && enemies < choice.count;
    })
    .map((choice) => choice.territory);
  const action = nexusAdvisorAction(game, offer.event, territories);
  return action ? [action] : [];
}
