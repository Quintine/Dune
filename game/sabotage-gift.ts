/** Pure physical-card quotes for the provisional Sabotage gift overflow rule.
 * The engine owns timing, card reservations, the private decision and the
 * actual discard continuation. These helpers do not expose hands to a view. */
export class SabotageGiftError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SabotageGiftError';
  }
}

type IdentifiedCard = { id: string };
const validId = (id: unknown): id is string =>
  typeof id === 'string' && id.length > 0 && id === id.trim();
function requireGift(value: unknown, message: string): asserts value {
  if (!value) throw new SabotageGiftError(message);
}
function validateHand<T extends IdentifiedCard>(hand: readonly T[]): void {
  requireGift(Array.isArray(hand) && hand.every(card => card && validId(card.id)) &&
    new Set(hand.map(card => card.id)).size === hand.length,
  'Keep each physical Treachery card uniquely identified in its hand.');
}
function validateLimit(limit: number): void {
  requireGift(Number.isSafeInteger(limit) && limit >= 0, 'Retain the recipient’s current hand limit.');
}

/** Move one exact physical card; exceeding the limit opens one recipient choice.
 * Do not construct a fresh face, discard a card or touch the original hands. */
export function quoteSabotageGift<T extends IdentifiedCard>(input: {
  ownerHand: readonly T[];
  recipientHand: readonly T[];
  cardId: string;
  handLimit: number;
}): { card: T; ownerHand: T[]; recipientHand: T[]; overflow: 0 | 1 } {
  requireGift(input && typeof input === 'object', 'Choose the current Sabotage gift.');
  const { ownerHand, recipientHand, cardId, handLimit } = input;
  validateHand(ownerHand);
  validateHand(recipientHand);
  validateLimit(handLimit);
  requireGift(!ownerHand.some(held => recipientHand.some(other => other.id === held.id)),
    'A physical card cannot be held by both players.');
  requireGift(recipientHand.length <= handLimit, 'Resolve the recipient’s existing excess cards before giving a card.');
  requireGift(validId(cardId), 'Choose an exact card in Moritani’s hand.');
  const card = ownerHand.find(held => held.id === cardId);
  requireGift(card && !recipientHand.some(held => held.id === cardId),
    'Choose one uniquely held card from Moritani’s hand.');
  return {
    card,
    ownerHand: ownerHand.filter(held => held.id !== cardId),
    recipientHand: [...recipientHand, card],
    overflow: recipientHand.length === handLimit ? 1 : 0,
  };
}

/** The recipient, not the giver, chooses one card from the actual overflowing
 * hand. They may discard the received card. The caller stages that discard. */
export function quoteSabotageGiftDiscard<T extends IdentifiedCard>(input: {
  recipientHand: readonly T[];
  cardId: string;
  handLimit: number;
}): { card: T; recipientHand: T[]; overflow: 0 } {
  requireGift(input && typeof input === 'object', 'Resolve the current Sabotage gift.');
  const { recipientHand, cardId, handLimit } = input;
  validateHand(recipientHand);
  validateLimit(handLimit);
  requireGift(recipientHand.length === handLimit + 1,
    'The recipient must retain the original one-card Sabotage overflow.');
  requireGift(validId(cardId), 'Choose one card from your hand to discard.');
  const card = recipientHand.find(held => held.id === cardId);
  requireGift(card, 'Choose one card from your current hand to discard.');
  return { card, recipientHand: recipientHand.filter(held => held.id !== cardId), overflow: 0 };
}
