import type { Card } from './cards';
import type { Plan, Battle } from './engine';
import { isPortableSnooper, playedVoiceMatch } from './battle-cards';

/** The revealed plan remains immutable; a late defense uses its spare card slot. */
export function portableSnooperPlanBlock(
  plan: Plan,
  hand: readonly Card[],
  card: Card,
  voice?: Battle['voice'],
): string | null {
  if (!isPortableSnooper(card)) return 'Choose the canonical Portable Snooper.';
  if (!plan.leader)
    return 'Without a leader or Cheap Hero, no battle cards can be played.';
  const weapon = hand.find((c) => c.id === plan.weapon);
  const defense = hand.find((c) => c.id === plan.defense);
  if ((plan.weapon && !weapon) || (plan.defense && !defense))
    return 'A revealed battle card is missing from its reserved hand.';
  if (defense && defense.kind !== 'worthless')
    return 'Your revealed plan already contains a defense.';
  if (weapon && defense)
    return 'Portable Snooper cannot follow a weapon and Worthless card or another two-card plan.';
  if (voice && !voice.must && playedVoiceMatch(card, 'defense', voice.kind))
    return 'The Bene Gesserit Voice forbids this poison defense.';
  return null;
}
