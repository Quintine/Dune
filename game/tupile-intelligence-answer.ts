import { baseDeck, ixDeck, type Card } from './cards';
import { ecazTreacheryCards } from './ecaz-cards';
import { HomeworldCustodyError } from './homeworld-custody';
import { richeseCards, richeseCardDefinition } from './richese-cards';
import type { TupileIntelligenceCategory } from './tupile-intelligence';

const inventory = new Map(
  [...baseDeck(), ...ixDeck(), ...richeseCards(), ...ecazTreacheryCards()].map(
    (card) => [card.id, card] as const,
  ),
);

/** Printed primary categories, never permissive battle-slot eligibility.
 * Weirding Way and Chemistry follow the documented default-role composition;
 * no dedicated Tupile FAQ ruling is claimed. */
function primaryCategory(card: Card): TupileIntelligenceCategory | null {
  const richese = richeseCardDefinition(card);
  if (richese)
    return richese.printedType === 'Weapon - Special'
      ? 'weapons'
      : richese.printedType === 'Defense - Poison'
        ? 'defenses'
        : null;
  switch (card.kind) {
    case 'projectile':
    case 'poison':
    case 'lasgun':
    case 'poisonBlade':
    case 'poisonTooth':
    case 'artillery':
    case 'weirdingWay':
      return 'weapons';
    case 'shield':
    case 'snooper':
    case 'shieldSnooper':
    case 'chemistry':
      return 'defenses';
    case 'worthless':
    case 'hero':
    case 'special':
      return null;
  }
}

function fail(): never {
  // Never include a private identity, balance or partially computed count.
  throw new HomeworldCustodyError(
    'Tupile intelligence needs a valid private hand, spice balance and selected category.',
  );
}

/** The caller authorizes and records this disclosure atomically. This returns
 * only a detached historical answer; it does not check contact, reveal cards,
 * consume usage or expose a second category. No expansion is activated here. */
export function quoteTupileIntelligenceAnswer(
  hand: readonly Card[],
  spice: number,
  category: TupileIntelligenceCategory,
): { spice: number; count: number } {
  if (
    !Array.isArray(hand) ||
    !Number.isSafeInteger(spice) ||
    spice < 0 ||
    (category !== 'weapons' && category !== 'defenses')
  )
    fail();
  const seen = new Set<string>();
  let count = 0;
  for (const card of hand) {
    if (
      !card ||
      typeof card !== 'object' ||
      Array.isArray(card) ||
      typeof card.id !== 'string' ||
      seen.has(card.id)
    )
      fail();
    const canonical = inventory.get(card.id);
    if (
      !canonical ||
      canonical.kind !== card.kind ||
      canonical.effect !== card.effect ||
      (canonical.name !== card.name &&
        !(card.id === 'treachery-7' && card.name === 'Basilia Weapon'))
    )
      fail();
    seen.add(card.id);
    if (primaryCategory(canonical) === category) count++;
  }
  return { spice, count };
}
