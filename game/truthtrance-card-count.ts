import type { Card } from './cards';

/** A fact about current hand custody, never a promise to retain these cards. */
export type CardCountFact = {
  kind: 'handCount';
  name: string;
  compare: 'eq' | 'gte' | 'lte';
  value: number;
};

/** The caller supplies the same canonical name list used by ordinary hand facts. */
export function parseCardCountFact(
  value: Record<string, unknown>,
  knownNames: readonly string[],
): CardCountFact {
  if (
    value.kind !== 'handCount' ||
    typeof value.name !== 'string' ||
    !knownNames.includes(value.name)
  )
    throw new Error('Choose a known treachery card name to count.');
  if (!['eq', 'gte', 'lte'].includes(value.compare as string))
    throw new Error('Compare held cards using exactly, at least, or at most.');
  if (
    typeof value.value !== 'number' ||
    !Number.isSafeInteger(value.value) ||
    value.value < 0
  )
    throw new Error(
      'Choose a nonnegative whole card count within the safe integer range.',
    );
  return {
    kind: 'handCount',
    name: value.name,
    compare: value.compare as CardCountFact['compare'],
    value: value.value,
  };
}

/**
 * Count physical entries of the exact printed card name in the supplied hand.
 * Used cards retained in hand still count; deck/discard/table cards do not.
 * Canonical game inventory validation belongs to the engine, not this predicate.
 */
export function cardCountFactMatches(
  hand: readonly Pick<Card, 'id' | 'name'>[],
  fact: CardCountFact,
): boolean {
  const count = hand.filter((card) => card.name === fact.name).length;
  return fact.compare === 'eq'
    ? count === fact.value
    : fact.compare === 'gte'
      ? count >= fact.value
      : count <= fact.value;
}

export function cardCountFactText(fact: CardCountFact): string {
  const comparison =
    fact.compare === 'eq'
      ? 'exactly'
      : fact.compare === 'gte'
        ? 'at least'
        : 'at most';
  return `you currently hold ${comparison} ${fact.value} card${fact.value === 1 ? '' : 's'} named ${fact.name}`;
}
