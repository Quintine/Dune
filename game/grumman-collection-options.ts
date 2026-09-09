import type { Action, GameView } from './engine';

/** Use the current private projection; do not reconstruct hidden Terror supply. */
export function grummanCollectionCanAct(g: GameView): boolean {
  return !!(
    g.status === 'playing' &&
    g.grummanCollection?.player === g.me &&
    g.decision?.kind === 'grummanCollection' &&
    g.decision.player === g.me &&
    g.decision.event === g.grummanCollection.event &&
    !g.response &&
    !g.truthtrance &&
    !g.phaseOpening &&
    !g.automaticContinuationPending
  );
}

export function grummanCollectionChoice(
  g: GameView,
  token: string,
  territory: string,
): { blocked: string | null; action: Action | null } {
  const offer = g.grummanCollection;
  let blocked: string | null = null;
  if (!grummanCollectionCanAct(g))
    blocked = 'Wait for the current choice to finish.';
  else if (offer!.blocked) blocked = offer!.blocked;
  else if (!offer!.tokens.some((candidate) => candidate.id === token))
    blocked = 'Choose a currently available Terror token.';
  else if (!offer!.destinations.some((candidate) => candidate.id === territory))
    blocked = 'Choose a current destination stronghold.';
  return {
    blocked,
    action: blocked
      ? null
      : {
          type: 'decision',
          event: offer!.event,
          mode: 'add',
          token,
          territory,
        },
  };
}

export function grummanCollectionActions(g: GameView): Action[] {
  if (!grummanCollectionCanAct(g)) return [];
  const offer = g.grummanCollection!;
  const choice = grummanCollectionChoice(
    g,
    offer.tokens[0]?.id ?? '',
    offer.destinations[0]?.id ?? '',
  );
  return [
    choice.action ?? { type: 'decision', event: offer.event, decline: true },
  ];
}
