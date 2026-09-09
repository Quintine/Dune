import type { Card } from './cards';
import type { Game } from './engine';
import type { HomeworldId } from './homeworld-cards';
import { HomeworldCustodyError } from './homeworld-custody';
import { homeworldContext } from './homeworld-game';
import {
  homeworldPopulations,
  type HomeworldPopulation,
} from './homeworld-population';

export type HomeworldCardEconomyContext = Pick<
  Game,
  'advanced' | 'players' | 'homeworlds'
>;

/** Current native physical population. Foreign visitors and the Emperor's
 * separate Salusa allocation do not increase Kaitain's population. Occupation
 * retention and entitlement are separate lifecycle rules, not inferred here. */
export function homeworldCardEconomyPopulation(
  context: HomeworldCardEconomyContext,
  ownerId: string,
  card: HomeworldId,
): HomeworldPopulation | null {
  if (!context.homeworlds?.custody) return null;
  return (
    homeworldPopulations(
      homeworldContext(context),
      context.homeworlds.custody,
    ).find((home) => home.native === ownerId && home.card === card) ?? null
  );
}

/** Population eligibility only; the engine owns the end-of-Bidding window. */
export function highKaitainDiscardsAvailable(
  context: HomeworldCardEconomyContext,
  ownerId: string,
): boolean {
  return (
    homeworldCardEconomyPopulation(context, ownerId, 'kaitain')?.side === 'high'
  );
}

export type KaitainDiscardQuote = { cards: Card[]; cost: number };

/** Pay from spice already held, then discard these physical cards without
 * activating their effects. The caller performs payment and ordinary discard
 * reactions. An empty selection is the eligible owner's optional decline. */
export function quoteKaitainDiscards(
  context: HomeworldCardEconomyContext,
  ownerId: string,
  selectedIds: unknown,
): KaitainDiscardQuote {
  if (!highKaitainDiscardsAvailable(context, ownerId))
    throw new HomeworldCustodyError(
      'Only the Emperor with high-population Kaitain may pay to discard Treachery Cards.',
    );
  if (
    !Array.isArray(selectedIds) ||
    !selectedIds.every(
      (id: unknown) => typeof id === 'string' && id.length > 0,
    ) ||
    new Set(selectedIds).size !== selectedIds.length
  )
    throw new HomeworldCustodyError(
      'Choose a list of unique Treachery Card identities.',
    );
  const owner = context.players.find((player) => player.id === ownerId)!;
  const hand = owner.hand;
  if (
    !Array.isArray(hand) ||
    !hand.every(
      (card) => card && typeof card.id === 'string' && card.id.length > 0,
    ) ||
    new Set(hand.map((card) => card.id)).size !== hand.length
  )
    throw new HomeworldCustodyError(
      'The Emperor hand must contain unique physical Treachery Cards.',
    );
  const cards = selectedIds.map((id: string) => {
    const card = hand.find((candidate) => candidate.id === id);
    if (!card)
      throw new HomeworldCustodyError(
        'Each selected Treachery Card must still be in the Emperor hand.',
      );
    return { ...card };
  });
  const cost = cards.length * 2;
  if (!Number.isSafeInteger(owner.spice) || owner.spice < cost)
    throw new HomeworldCustodyError(
      'Kaitain costs 2 spice per discarded card, paid from spice already held.',
    );
  return { cards, cost };
}

/** Restricts both ordinary Worthless sales and duplicate-Worthless sales.
 * Non-Worthless duplicates, card trades and Advanced Karama are separate
 * actions and are not restricted by this ordinary-sale quote. */
export function homeworldWorthlessSaleBlock(
  context: HomeworldCardEconomyContext,
  ownerId: string,
  card: Pick<Card, 'kind'>,
): string | null {
  return card.kind === 'worthless' &&
    homeworldCardEconomyPopulation(context, ownerId, 'tupile')?.side === 'high'
    ? 'High-population Tupile prevents discarding Worthless Cards for spice, including duplicate sales; Advanced Karama remains available under its own rules.'
    : null;
}
