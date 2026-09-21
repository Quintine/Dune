import type { Card } from './cards';
import { CARD_CATEGORIES, printedCardCategory, type CardCategory } from './card-category';

export type HandCategory = 'all' | CardCategory;
export type HandSort = 'hand' | 'name' | 'category';

const normalized = (name: string) => name.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();

/** Select already-visible physical cards without changing their saved order or identity.
 * Printed categories organize the display; they never decide action legality. */
export function browseHand<T extends Card>(cards: readonly T[], query: string, category: HandCategory, sort: HandSort): T[] {
  const needle = normalized(query.trim());
  const result = cards.filter(card =>
    (!needle || normalized(card.name).includes(needle)) &&
    (category === 'all' || printedCardCategory(card) === category),
  );
  if (sort !== 'hand') result.sort((a, b) =>
    (sort === 'category'
      ? CARD_CATEGORIES.indexOf(printedCardCategory(a)) - CARD_CATEGORIES.indexOf(printedCardCategory(b))
      : 0) || a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }),
  );
  return result;
}
