import type { Game } from './engine';
import type { HomeworldId } from './homeworld-cards';
import { quoteStableHomeworldOccupation } from './homeworld-stable-occupation';

export type OccupiedHomeworldDefenseQuote = {
  status: 'allowed' | 'prohibited' | 'unresolved';
  blocked: string | null;
};

function occupiedTargetQuote(
  game: Game,
  card: HomeworldId,
  target: string,
  reason: string,
): OccupiedHomeworldDefenseQuote {
  const { entitlement, blocked } = quoteStableHomeworldOccupation(game, card);
  if (blocked) return { status: 'unresolved', blocked };
  return entitlement && (target === entitlement.occupier || target === entitlement.ally)
    ? { status: 'prohibited', blocked: reason } : { status: 'allowed', blocked: null };
}

/** Wallach IX's original occupied face protects the occupier and their current
 * reciprocal ally from native Bene Gesserit Voice, wherever the battle occurs. */
export function quoteOccupiedHomeworldVoice(game: Game, target: string): OccupiedHomeworldDefenseQuote {
  return occupiedTargetQuote(game, 'wallach_ix', target,
    'The Wallach IX occupier and their ally are immune to Bene Gesserit Voice.');
}

/** Tleilax's original occupied face restricts native Face Dancer reveals. */
export function quoteOccupiedHomeworldFaceDancer(game: Game, target: string): OccupiedHomeworldDefenseQuote {
  return occupiedTargetQuote(game, 'tleilax', target,
    'Tleilaxu cannot reveal Face Dancers against the Tleilax occupier or their ally.');
}

/** Grumman's original occupied face applies to the entrant, not the token's
 * territory or Moritani's own alliance. The separate low entry-size rule remains. */
export function quoteOccupiedHomeworldTerror(game: Game, entrant: string): OccupiedHomeworldDefenseQuote {
  return occupiedTargetQuote(game, 'grumman', entrant,
    'Moritani cannot reveal Terror when the Grumman occupier or their ally enters.');
}

/** Salusa's original occupied face removes native Sardaukar's advantage only.
 * This quote never converts, relocates or removes actual starred counters.
 * A blocked quote is not permission to select either possible combat strength. */
export function occupiedHomeworldSardaukarStatus(
  game: Game,
): { suppressed: boolean; blocked: string | null } {
  const { entitlement, blocked } = quoteStableHomeworldOccupation(game, 'salusa_secundus');
  return { suppressed: entitlement !== null, blocked };
}
