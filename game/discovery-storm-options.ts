import type { Action, GameView } from './engine';

/** Both human controls and bots use only the owner's projected storm offer. */
export function discoveryStormActions(game: GameView): Action[] {
  const decision = game.decision,
    offer = game.ecologicalStorm;
  if (
    game.status !== 'playing' ||
    decision?.kind !== 'ecologicalStorm' ||
    decision.player !== game.me ||
    !offer ||
    offer.owner !== game.me ||
    offer.event !== decision.event ||
    offer.blocked
  )
    return [];
  // Keeping the current cumulative distance is the conservative policy.
  return [...offer.options]
    .sort((a, b) => Math.abs(a.delta) - Math.abs(b.delta))
    .map((option) => ({
      type: 'decision',
      event: offer.event,
      delta: option.delta,
    }));
}
