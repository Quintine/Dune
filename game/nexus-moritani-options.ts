import type { Action, GameView } from './engine';
import { TERRITORIES, splitLocation } from './board';
import { TERROR_STRONGHOLDS, type TerrorToken } from './moritani-terror';

export function nexusMoritaniCanAct(g: GameView): boolean {
  const owner = g.players.find((player) => player.id === g.me);
  if (owner?.faction !== 'moritani') return false;
  const offer = g.nexusMoritani;
  return !!(
    g.status === 'playing' &&
    g.phase === 8 &&
    !owner.ally &&
    g.nexusCards?.card === 'moritani' &&
    offer &&
    !offer.blocked &&
    offer.event === JSON.stringify(['nexusMoritani', g.turn, g.me]) &&
    g.decision?.kind === 'moritaniPlacement' &&
    g.decision.player === g.me &&
    !g.response &&
    !g.truthtrance &&
    !g.phaseOpening &&
    !g.automaticContinuationPending &&
    !g.nexusCards.waiting.length &&
    !g.nexusTraitors?.pending
  );
}

/** Native options keep their existing relocation rules; Cunning uses the
 * server's available supply and static Arrakis destination projection. */
export function moritaniPlacementChoices(
  g: GameView,
  useNexus: boolean,
  selectedToken = '',
) {
  if (g.players.find((player) => player.id === g.me)?.faction !== 'moritani')
    return {
      tokens: [] as TerrorToken[],
      destinations: [] as string[],
      token: undefined,
    };
  const tokens = useNexus
    ? (g.nexusMoritani?.tokens ?? []).filter(
        (token) => token.status === 'available' && token.location === null,
      )
    : (g.moritaniTerror?.tokens ?? []).filter(
        (token): token is TerrorToken =>
          'kind' in token &&
          (token.status === 'available' || token.status === 'placed'),
      );
  const token =
    tokens.find((candidate) => candidate.id === selectedToken) ?? tokens[0];
  const destinations = useNexus
    ? [...(g.nexusMoritani?.destinations ?? [])]
    : TERROR_STRONGHOLDS.filter(
        (to) =>
          to !== token?.location &&
          !g.moritaniTerror?.tokens.some(
            (candidate) =>
              candidate.status === 'placed' && candidate.location === to,
          ),
      );
  return { tokens, token, destinations };
}

export function nexusMoritaniAction(
  g: GameView,
  event: string,
  token: string,
  territory: string,
): Action | null {
  if (!nexusMoritaniCanAct(g) || event !== g.nexusMoritani!.event) return null;
  const choices = moritaniPlacementChoices(g, true, token);
  if (
    !choices.tokens.some((candidate) => candidate.id === token) ||
    !choices.destinations.includes(territory)
  )
    return null;
  return { type: 'decision', token, territory, nexus: event };
}

/** Spend Cunning for a public enemy destination unavailable to ordinary
 * placement. Hidden faces are read only from Moritani's authorized supply. */
export function nexusMoritaniBotActions(g: GameView): Action[] {
  if (!nexusMoritaniCanAct(g)) return [];
  const choices = moritaniPlacementChoices(g, true);
  const token =
    choices.tokens.find((candidate) =>
      ['robbery', 'sabotage', 'sneakAttack', 'assassination'].includes(
        candidate.kind,
      ),
    ) ?? choices.tokens[0];
  const owner = g.players.find((player) => player.id === g.me)!;
  const destination = choices.destinations.find(
    (to) =>
      (!TERROR_STRONGHOLDS.includes(to) ||
        g.moritaniTerror?.tokens.some(
          (candidate) =>
            candidate.status === 'placed' && candidate.location === to,
        )) &&
      TERRITORIES.some((place) => place.id === to) &&
      g.players.some(
        (player) =>
          player.id !== owner.id &&
          player.id !== owner.ally &&
          Object.entries(player.forces).some(
            ([key, amount]) =>
              amount > 0 && splitLocation(key).territory === to,
          ),
      ),
  );
  const action =
    token && destination
      ? nexusMoritaniAction(g, g.nexusMoritani!.event, token.id, destination)
      : null;
  return action ? [action] : [];
}
