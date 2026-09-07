import type { Card } from './cards';
import { richeseCardDefinition } from './richese-cards';

export type NullentropyBoxResult = {
  ownerHand: Card[];
  discard: Card[];
  selected: Card;
};

function validatePhysicalCards(cards: readonly Card[]) {
  const ids = new Set<string>();
  for (const card of Array.from(cards)) {
    if (!card || typeof card.id !== 'string' || !card.id || ids.has(card.id))
      throw new Error('Cards must have unique physical identities.');
    ids.add(card.id);
  }
}

const isAnyBox = (card: Card) =>
  card.effect === 'nullentropyBox' || card.name === 'Nullentropy Box';

/** Pure filtering does not grant a viewer permission to inspect the discard. */
export function eligibleNullentropyCards(discard: readonly Card[]): Card[] {
  validatePhysicalCards(discard);
  return structuredClone(discard.filter((card) => !isAnyBox(card)));
}

/**
 * The caller supplies the server-shuffled order after authorizing and charging
 * the private search. This helper neither shuffles nor spends spice. Last is top.
 * The selected receipt is independently cloned, not a second physical copy.
 */
export function resolveNullentropyBox(
  ownerHand: readonly Card[],
  activatingBoxId: string,
  discard: readonly Card[],
  selectedId: string,
  remainingOrderIds: readonly string[],
  handLimit: number,
): NullentropyBoxResult {
  if (!Number.isSafeInteger(handLimit) || handLimit < 0)
    throw new RangeError('The hand limit must be a nonnegative safe integer.');
  validatePhysicalCards([...Array.from(ownerHand), ...Array.from(discard)]);
  const box = ownerHand.find((card) => card.id === activatingBoxId);
  if (!box || richeseCardDefinition(box)?.card.effect !== 'nullentropyBox')
    throw new Error(
      'Use the canonical Nullentropy Box physically in your hand.',
    );
  if (ownerHand.length >= handLimit)
    throw new Error(
      'Full-hand Nullentropy Box use is unresolved; a pre-existing free hand slot is required by the current guard.',
    );
  const selected = discard.find((card) => card.id === selectedId);
  if (!selected || isAnyBox(selected))
    throw new Error('Choose a discard card other than any Nullentropy Box.');
  const remaining = new Map(
    discard
      .filter((card) => card.id !== selectedId)
      .map((card) => [card.id, card]),
  );
  const order = Array.from(remainingOrderIds);
  if (
    order.length !== remaining.size ||
    new Set(order).size !== order.length ||
    order.some((id) => typeof id !== 'string' || !remaining.has(id))
  )
    throw new Error(
      'The remaining discard order must be an exact permutation.',
    );
  return {
    ownerHand: structuredClone([
      ...ownerHand.filter((card) => card.id !== activatingBoxId),
      selected,
    ]),
    discard: structuredClone([...order.map((id) => remaining.get(id)!), box]),
    selected: structuredClone(selected),
  };
}
