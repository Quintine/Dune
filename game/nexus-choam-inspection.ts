import type { Card } from './cards';
import type { Game } from './engine';
import { nexusCardMode } from './nexus-cards';

export type NexusChoamInspectionReceipt = {
  event: string;
  opponent: string;
  usedCards: string[];
  stage: 'pending' | 'offer' | 'complete';
  inspected?: string;
  signature: string;
};

export function nexusChoamInspectionSignature(
  receipt: NexusChoamInspectionReceipt,
): string {
  return JSON.stringify([
    receipt.event, receipt.opponent, receipt.usedCards, receipt.stage,
    receipt.inspected ?? null,
  ]);
}

/** Every winner gets the same public window. Only its owner's projection may
 * reveal whether a usable Secret Ally card and an unused opposing card exist. */
export function quoteNexusChoamInspection(
  game: Game, viewer: string, decision: Game['decision'] = game.decision,
) {
  const context = game.lastBattleContext;
  const receipt = context?.nexusChoamInspection;
  if (!context?.winner || !receipt || receipt.stage !== 'offer' ||
      decision?.kind !== 'nexusChoamInspection' || viewer !== context.winner)
    return null;
  const owner = game.players.find(player => player.id === viewer)!;
  const opponent = game.players.find(player => player.id === receipt.opponent)!;
  const canInspect = !owner.ally &&
    game.nexusCards?.cards?.hands[viewer] === 'choam' &&
    nexusCardMode('choam', owner.faction, game.players.map(player => player.faction)) === 'secretAlly' &&
    opponent.hand.some(card => !receipt.usedCards.includes(card.id));
  return { event: receipt.event, opponent: receipt.opponent, canInspect };
}

/** Uniform one-card sample; no hidden hand or randomness is read by a view. */
export function sampleNexusChoamInspection(
  hand: readonly Card[],
  usedCards: readonly string[],
  random: () => number,
): Card {
  if (!Array.isArray(hand) || !Array.isArray(usedCards) ||
      usedCards.some(id => typeof id !== 'string' || !id) ||
      new Set(usedCards).size !== usedCards.length)
    throw new Error('CHOAM inspection needs the original physical used-card IDs.');
  const used = new Set(usedCards);
  let count = 0;
  for (const card of hand) {
    if (!card || typeof card.id !== 'string' || !card.id)
      throw new Error('CHOAM inspection needs physical opposing hand cards.');
    if (!used.has(card.id)) count++;
  }
  if (!count) throw new Error('The opposing hand has no unused card to inspect.');
  const draw = random();
  if (!Number.isFinite(draw) || draw < 0 || draw >= 1)
    throw new Error('CHOAM inspection needs a finite random draw in [0, 1).');
  let index = Math.floor(draw * count);
  for (const card of hand)
    if (!used.has(card.id) && index-- === 0) return structuredClone(card);
  throw new Error('The opposing hand changed during CHOAM inspection.');
}
