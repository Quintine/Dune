import { FACTIONS } from './catalog';

export type IxStartingCardGame = {
  advanced: boolean;
  players: readonly { id: string; faction: string }[];
};
export type IxStartingCardDealPlan = {
  kind: 'advanced-pool' | 'legacy-deck-bonus';
  seats: { player: string; amount: number }[];
  deckBonus: string | null;
};
export class IxStartingCardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IxStartingCardError';
  }
}

function validateStartingRoster(game: IxStartingCardGame): void {
  if (!game || typeof game !== 'object' || typeof game.advanced !== 'boolean' ||
    !Array.isArray(game.players) || game.players.length < 2 || game.players.length > 6)
    throw new IxStartingCardError('Ixian starting cards require a two-to-six-player native roster and rules mode.');
  const ids = new Set<string>();
  const factions = new Set<string>();
  for (const player of game.players) {
    if (!player || typeof player !== 'object' || typeof player.id !== 'string' ||
      !player.id || player.id.trim() !== player.id || ids.has(player.id) ||
      !FACTIONS.some(faction => faction.id === player.faction) || factions.has(player.faction))
      throw new IxStartingCardError('Ixian starting cards require distinct registered factions and player identities.');
    ids.add(player.id);
    factions.add(player.faction);
  }
  if (!factions.has('ixians'))
    throw new IxStartingCardError('The starting-card pool requires the native Ixian faction.');
}

/** Fresh supplied Advanced p34 includes Harkonnen's second card in Ixians' pool. */
export function ixStartingCardPoolSize(game: IxStartingCardGame): number {
  validateStartingRoster(game);
  return game.players.length +
    (game.advanced && game.players.some(player => player.faction === 'harkonnen') ? 1 : 0);
}

/** poolCount is the recorded original pool, including the card Ixians will keep.
 * Old N-card and historical short pools retain the original deck-bonus suffix.
 */
export function ixStartingCardDealPlan(game: IxStartingCardGame, poolCount: number): IxStartingCardDealPlan {
  const maximum = ixStartingCardPoolSize(game);
  if (!Number.isSafeInteger(poolCount) || poolCount < 1 || poolCount > maximum)
    throw new IxStartingCardError('The recorded Ixian starting-card pool has an invalid size.');
  const harkonnen = game.players.find(player => player.faction === 'harkonnen');
  const advancedPool = game.advanced && !!harkonnen && poolCount === game.players.length + 1;
  return {
    kind: advancedPool ? 'advanced-pool' : 'legacy-deck-bonus',
    seats: game.players.filter(player => player.faction !== 'ixians').map(player => ({
      player: player.id,
      amount: advancedPool && player.faction === 'harkonnen' ? 2 : 1,
    })),
    deckBonus: advancedPool ? null : harkonnen?.id ?? null,
  };
}
