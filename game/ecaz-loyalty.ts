import { leaders } from './cards';
import type { Game } from './engine';

/** A separate physical Traitor Card, face up for the rest of this game. */
export type EcazLoyalty = { player: string; card: string | null };

export function chooseEcazLoyalty(deck: readonly string[], roll: number): string {
  const candidates = leaders('ecaz').map(leader => leader.id);
  if (!Number.isFinite(roll) || roll < 0 || roll >= 1 ||
    new Set(deck).size !== deck.length || candidates.some(card => !deck.includes(card)))
    throw new Error('Ecaz Loyalty requires the intact native Traitor inventory and a valid random draw.');
  return candidates[Math.floor(roll * candidates.length)];
}

export function withoutEcazLoyalty(deck: readonly string[], loyalty?: EcazLoyalty): string[] {
  return deck.filter(card => card !== loyalty?.card);
}

/** Missing markers belong to older games and never remove an already-dealt card. */
export function validateEcazLoyalty(game: Pick<Game, 'ecazLoyalty' | 'advanced' | 'players' | 'status' | 'setupStage' | 'traitorReserve' | 'moritaniAssassinate'>): void {
  const loyalty = game.ecazLoyalty;
  if (loyalty === undefined) return;
  if (!loyalty || !game.advanced || game.status === 'lobby' ||
    !game.players.some(player => player.id === loyalty.player && player.faction === 'ecaz'))
    throw new Error('Ecaz Loyalty must belong to the native Advanced Ecaz player.');
  const circulating = [
    ...(game.traitorReserve ?? []),
    ...game.players.flatMap(player => [...player.traitors, ...player.traitorChoices, ...(player.faceDancers ?? []).map(card => card.leader)]),
  ];
  if (loyalty.card === null) {
    if (game.status !== 'setup' || !['prediction', 'skillTreachery', 'leaderSkills'].includes(game.setupStage ?? '') || circulating.length)
      throw new Error('Ecaz Loyalty must be revealed before initial Traitor dealing.');
    return;
  }
  if (!leaders('ecaz').some(leader => leader.id === loyalty.card) || circulating.includes(loyalty.card) ||
    game.moritaniAssassinate?.opportunities.some(receipt => receipt.card === loyalty.card))
    throw new Error('The public Ecaz Loyalty card must remain separate from all circulating or retired Traitors.');
}
