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
  mode: 'add' | 'remove' = 'add',
  useNexus = false,
): { blocked: string | null; action: Action | null } {
  const offer = g.grummanCollection;
  let blocked: string | null = null;
  if (!grummanCollectionCanAct(g))
    blocked = 'Wait for the current choice to finish.';
  else if (mode === 'remove') {
    if (useNexus || territory) blocked = 'Returning a token does not use Cunning or select a destination.';
    else if (offer!.removeBlocked) blocked = offer!.removeBlocked;
    else if (!offer!.removable.some(candidate => candidate.id === token))
      blocked = 'Choose one of your currently placed Terror tokens.';
  } else {
    if (useNexus && !offer!.cunning) blocked = 'You do not have a current Moritani Cunning addition.';
    else if (useNexus ? offer!.cunning!.blocked : offer!.blocked)
      blocked = useNexus ? offer!.cunning!.blocked : offer!.blocked;
    else if (!offer!.tokens.some(candidate => candidate.id === token))
      blocked = 'Choose a currently available Terror token.';
    else if (!(useNexus ? offer!.cunning!.destinations : offer!.destinations).some(candidate => candidate.id === territory))
      blocked = 'Choose a current permitted addition destination.';
  }
  return {
    blocked,
    action: blocked ? null : mode === 'remove'
      ? { type: 'decision', event: offer!.event, mode, token }
      : { type: 'decision', event: offer!.event, mode, token, territory,
          ...(useNexus ? { nexus: offer!.cunning!.event } : {}) },
  };
}

export function grummanCollectionActions(g: GameView): Action[] {
  if (!grummanCollectionCanAct(g)) return [];
  const offer = g.grummanCollection!;
  if (offer.cunning && !offer.cunning.blocked) {
    const choice = grummanCollectionChoice(g, offer.tokens[0]?.id ?? '',
      offer.cunning.destinations[0]?.id ?? '', 'add', true);
    if (choice.action) return [choice.action];
  }
  const addition = grummanCollectionChoice(g, offer.tokens[0]?.id ?? '',
    offer.destinations[0]?.id ?? '');
  if (addition.action) return [addition.action];
  const removal = grummanCollectionChoice(g, offer.removable[0]?.id ?? '', '', 'remove');
  return [removal.action ?? { type: 'decision', event: offer.event, decline: true }];
}
