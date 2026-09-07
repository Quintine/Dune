import type { Card } from './cards';
import { richeseCardDefinition } from './richese-cards';

export type RicheseGiftParticipant = {
  id: string;
  faction: string;
  ally?: string | null;
  hand: readonly Card[];
};

/** Exact private declaration; never expose the selected identity to unrelated seats. */
export type RicheseGiftIntent = {
  owner: string;
  recipient: string;
  cardId: string;
};

/**
 * R2 p6 permits a canonical Richese card from hand to the current ally below capacity.
 * This helper owns only physical transfer. The engine supplies its current hand limit,
 * checks pending card commitments, and preserves any nested response/decision timing.
 */
export function prepareRicheseGift(
  owner: RicheseGiftParticipant,
  recipient: RicheseGiftParticipant,
  cardId: string,
  recipientHandLimit: number,
): RicheseGiftIntent {
  if (!owner.id || !recipient.id || owner.id === recipient.id)
    throw new Error('Choose a different player as the gift recipient.');
  if (owner.faction !== 'richese')
    throw new Error('Only Richese may use this alliance gift.');
  if (owner.ally !== recipient.id || recipient.ally !== owner.id)
    throw new Error('The gift recipient must be your current mutual ally.');
  if (!Number.isSafeInteger(recipientHandLimit) || recipientHandLimit < 0)
    throw new RangeError(
      'The recipient hand limit must be a nonnegative safe integer.',
    );
  if (recipient.hand.length >= recipientHandLimit)
    throw new Error('Your ally’s Treachery hand is full.');
  const held = owner.hand.filter((card) => card.id === cardId);
  if (held.length !== 1 || !richeseCardDefinition(held[0]))
    throw new Error(
      'Choose one canonical Richese Treachery card physically in your hand.',
    );
  if (recipient.hand.some((card) => card.id === cardId))
    throw new Error('This physical card is already in the recipient’s hand.');
  return { owner: owner.id, recipient: recipient.id, cardId };
}

/** Revalidate a paused declaration against current custody before cloning either hand. */
export function transferRicheseGift(
  owner: RicheseGiftParticipant,
  recipient: RicheseGiftParticipant,
  intent: RicheseGiftIntent,
  recipientHandLimit: number,
): { ownerHand: Card[]; recipientHand: Card[]; card: Card } {
  if (intent.owner !== owner.id || intent.recipient !== recipient.id)
    throw new Error('The gift declaration belongs to different players.');
  prepareRicheseGift(owner, recipient, intent.cardId, recipientHandLimit);
  const selected = owner.hand.find((card) => card.id === intent.cardId)!;
  return {
    ownerHand: structuredClone(
      owner.hand.filter((card) => card.id !== intent.cardId),
    ),
    recipientHand: structuredClone([...recipient.hand, selected]),
    card: structuredClone(selected),
  };
}
