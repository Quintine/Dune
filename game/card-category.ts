import type { Card } from './cards';
import { richeseCardDefinition } from './richese-cards';

export const CARD_CATEGORIES = [
  'weapon',
  'defense',
  'worthless',
  'hero',
  'special',
] as const;
export type CardCategory = (typeof CARD_CATEGORIES)[number];

const PRIMARY_CATEGORY: Record<Card['kind'], CardCategory> = {
  projectile: 'weapon',
  poison: 'weapon',
  lasgun: 'weapon',
  poisonBlade: 'weapon',
  poisonTooth: 'weapon',
  artillery: 'weapon',
  weirdingWay: 'weapon',
  shield: 'defense',
  snooper: 'defense',
  shieldSnooper: 'defense',
  chemistry: 'defense',
  worthless: 'worthless',
  hero: 'hero',
  special: 'special',
};

/** Primary component role, independent of chosen battle slots or faction powers.
 * Richese's physical definitions distinguish weapons/defenses stored as special.
 * Weirding Way and Chemistry retain their defaults; Worthless remains separate.
 */
export function printedCardCategory(card: Card): CardCategory {
  const definition = richeseCardDefinition(card);
  if (definition?.behavior.battleCategory === 'weapon') return 'weapon';
  if (definition?.behavior.battleCategory === 'poison-defense')
    return 'defense';
  return PRIMARY_CATEGORY[card.kind];
}
