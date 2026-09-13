import type { Card } from './cards';
import {
  CARD_CATEGORIES,
  printedCardCategory,
  type CardCategory,
} from './card-category';

/** A current custody question, not a promise to retain cards or use them. */
export type HandInventoryFact = {
  kind: 'handInventory';
  category: 'all' | CardCategory;
  compare: 'eq' | 'gte' | 'lte';
  value: number;
};

export const HAND_INVENTORY_LABELS: Record<
  HandInventoryFact['category'],
  string
> = {
  all: 'All cards in hand',
  weapon: 'Weapons · primary role',
  defense: 'Defenses · primary role',
  worthless: 'Worthless cards',
  hero: 'Cheap Heroes and Heroines',
  special: 'Special cards without a primary battle role',
};

export function parseHandInventoryFact(
  v: Record<string, unknown>,
): HandInventoryFact {
  if (
    v.kind !== 'handInventory' ||
    (v.category !== 'all' &&
      !CARD_CATEGORIES.includes(v.category as CardCategory))
  )
    throw new Error('Choose all held cards or a known primary card role.');
  if (v.compare !== 'eq' && v.compare !== 'gte' && v.compare !== 'lte')
    throw new Error('Compare held cards using exactly, at least, or at most.');
  if (
    typeof v.value !== 'number' ||
    !Number.isSafeInteger(v.value) ||
    v.value < 0
  )
    throw new Error(
      'Choose a nonnegative whole card count within the safe integer range.',
    );
  return {
    kind: 'handInventory',
    category: v.category as HandInventoryFact['category'],
    compare: v.compare,
    value: v.value,
  };
}

export function handInventoryFactMatches(
  hand: readonly Card[],
  fact: HandInventoryFact,
): boolean {
  const count =
    fact.category === 'all'
      ? hand.length
      : hand.filter((card) => printedCardCategory(card) === fact.category)
          .length;
  return fact.compare === 'eq'
    ? count === fact.value
    : fact.compare === 'gte'
      ? count >= fact.value
      : count <= fact.value;
}

export function handInventoryFactText(fact: HandInventoryFact): string {
  const comparison =
    fact.compare === 'eq'
      ? 'exactly'
      : fact.compare === 'gte'
        ? 'at least'
        : 'at most';
  const cards = fact.value === 1 ? 'card' : 'cards';
  const description: Record<HandInventoryFact['category'], string> = {
    all: `${cards} in your hand`,
    weapon: `${cards} whose primary role is a weapon`,
    defense: `${cards} whose primary role is a defense`,
    worthless: `Worthless ${cards}`,
    hero: `Cheap Hero or Cheap Heroine ${cards}`,
    special: `Special ${cards} without a primary battle role`,
  };
  return `you currently hold ${comparison} ${fact.value} ${description[fact.category]}`;
}
