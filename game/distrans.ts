import type { Card } from './cards';
import { richeseCardDefinition } from './richese-cards';

export type DistransParticipant = { id: string; hand: readonly Card[] };
export type DistransTransfer = {
  ownerHand: Card[];
  recipientHand: Card[];
  discarded: Card;
  transferred: Card;
};

/**
 * Physical custody only: transfer one other held card, then discard Distrans.
 * The engine owns bid timing, committed cards, private projections and discard
 * events. A returned receipt is not an extra physical copy or a public reveal.
 */
export function transferDistrans(
  owner: DistransParticipant,
  recipient: DistransParticipant,
  activatingCardId: string,
  transferredCardId: string,
  recipientHandLimit: number,
): DistransTransfer {
  if (!owner.id || !recipient.id || owner.id === recipient.id)
    throw new Error('Choose a different player to receive the card.');
  if (!Number.isSafeInteger(recipientHandLimit) || recipientHandLimit < 0)
    throw new RangeError(
      'The recipient hand limit must be a nonnegative safe integer.',
    );
  const ids = new Set<string>();
  // Array.from includes sparse slots so malformed restored custody cannot pass.
  for (const card of [
    ...Array.from(owner.hand),
    ...Array.from(recipient.hand),
  ]) {
    if (!card || typeof card.id !== 'string' || !card.id || ids.has(card.id))
      throw new Error(
        'Both hands must contain unique physical card identities.',
      );
    ids.add(card.id);
  }
  const activation = owner.hand.find((card) => card.id === activatingCardId);
  if (
    !activation ||
    richeseCardDefinition(activation)?.card.effect !== 'distrans'
  )
    throw new Error('Play the canonical Distrans physically in your hand.');
  if (transferredCardId === activatingCardId)
    throw new Error(
      'Giving Distrans itself is unresolved; choose a different card.',
    );
  const given = owner.hand.find((card) => card.id === transferredCardId);
  if (!given)
    throw new Error('Choose another card physically in your own hand.');
  if (recipient.hand.length >= recipientHandLimit)
    throw new Error('The recipient’s Treachery hand is full.');
  return {
    ownerHand: structuredClone(
      owner.hand.filter(
        (card) => card.id !== activatingCardId && card.id !== transferredCardId,
      ),
    ),
    recipientHand: structuredClone([...recipient.hand, given]),
    discarded: structuredClone(activation),
    transferred: structuredClone(given),
  };
}
