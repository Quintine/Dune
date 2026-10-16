import { treacheryDeck } from './cards';
import { richeseCards } from './richese-cards';
import { ecazTreacheryCards } from './ecaz-cards';

/** Known physical names, not permission to deal/play an unselected family.
 * Current hand facts and named battle-slot promises share this registry. */
export const TRUTH_CARD_NAMES = [
  ...new Set([...treacheryDeck(['ix']), ...richeseCards(), ...ecazTreacheryCards()].map(card => card.name)),
].sort();
