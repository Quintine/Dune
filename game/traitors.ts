import type { Card } from './cards';

export const CHEAP_HERO_TRAITOR = 'cheap-hero-traitor';

export function traitorDeck(
  players: { leaders: { id: string }[] }[],
  includeCheapHero = false,
) {
  return [
    ...players.flatMap((p) => p.leaders.map((l) => l.id)),
    ...(includeCheapHero ? [CHEAP_HERO_TRAITOR] : []),
  ];
}

/** A hero card has no faction leader disc; both printed hero cards share one traitor identity. */
export function matchingTraitor(
  held: readonly string[],
  leader: string | null,
  card?: Card,
) {
  const identity = card?.kind === 'hero' ? CHEAP_HERO_TRAITOR : leader;
  return identity && held.includes(identity) ? identity : undefined;
}
