import type { Action, GameView } from './engine';

/** The resolved battle's projected opportunity is the sole client authority. */
export function caladanReinforcementCanAct(g: GameView): boolean {
  return !!(
    g.status === 'playing' &&
    g.caladanReinforcement?.player === g.me &&
    g.decision?.kind === 'caladanReinforcement' &&
    g.decision.player === g.me &&
    g.decision.event === g.caladanReinforcement.event &&
    !g.response &&
    !g.truthtrance &&
    !g.phaseOpening &&
    !g.automaticContinuationPending
  );
}

export function caladanReinforcementChoice(
  g: GameView,
  destination: string,
): { blocked: string | null; action: Action | null } {
  const offer = g.caladanReinforcement;
  const target = offer?.destinations.find(
    (option) => option.id === destination,
  );
  let blocked: string | null = null;
  if (!caladanReinforcementCanAct(g))
    blocked = 'Wait for the current choice to finish.';
  else if (offer!.blocked) blocked = offer!.blocked;
  else if (offer!.amount !== 1)
    blocked = 'This battle reinforcement is no longer available.';
  else if (!target) blocked = 'Choose a current reinforcement destination.';
  else if (target.blocked) blocked = target.blocked;
  return {
    blocked,
    action: blocked
      ? null
      : { type: 'decision', event: offer!.event, destination, amount: 1 },
  };
}

/** Reinforce an already occupied sector when possible. No opposing private
 * information or reconstructed battle result is needed for this fallback. */
export function caladanReinforcementActions(g: GameView): Action[] {
  if (!caladanReinforcementCanAct(g)) return [];
  const offer = g.caladanReinforcement!;
  const own = g.players.find((player) => player.id === g.me);
  const choices = offer.destinations
    .map((target) => ({
      target,
      action: caladanReinforcementChoice(g, target.id).action,
    }))
    .filter((choice) => choice.action);
  const occupied = choices.find(
    ({ target }) =>
      (own?.forces[
        target.sector === undefined
          ? target.id
          : `${offer.territory}:${target.sector}`
      ] ?? 0) > 0,
  );
  return [
    occupied?.action ??
      choices[0]?.action ?? {
        type: 'decision',
        event: offer.event,
        decline: true,
      },
  ];
}
