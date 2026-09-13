/** A global card effect expires when the authoritative turn changes. */
export type RecruitsEffect = Readonly<{ turn: number }>;
export const RECRUITS_CARD_ID = 'ecaz-recruits' as const;
export type RecruitsPlay = Readonly<{
  type: 'card';
  card: typeof RECRUITS_CARD_ID;
  blocked: string | null;
}>;
export type RecruitsPreview = Readonly<{
  active: boolean;
  playedTurn?: number;
  playedBy?: string;
  play: RecruitsPlay | null;
  rates: ReadonlyArray<Readonly<{ player: string; freeRate: number; limit: number }>>;
  grantRevivalBlocked: string | null;
}>;

/** A single shared control adapter for UI and bots; blocked details stay display-only. */
export function recruitsPlayAction(
  preview?: Pick<RecruitsPreview, 'play'> | null,
): { type: 'card'; card: typeof RECRUITS_CARD_ID } | null {
  const play = preview?.play;
  return play && !play.blocked ? { type: 'card', card: play.card } : null;
}
export type RecruitsScope = Readonly<{
  turn: number;
  recruits?: RecruitsEffect | null;
}>;

/**
 * Resolved facts, measured in physical forces, never battle strength.
 * The caller resolves faction, ally, prevention and Homeworld interactions.
 * freeAllowanceUsed is deliberately separate from total revived: the sources
 * do not settle whether earlier paid revivals consume a newly raised free rate.
 * freeRateCap is explicit because the ordinary Fremen cap example does not
 * decide every interaction with an unlimited-revival faction.
 */
export type RecruitsRevivalFacts = Readonly<{
  currentFreeRate: number;
  currentLimit: number;
  revived: number;
  freeAllowanceUsed: number;
  freeRateCap: number;
  freeBlocked?: boolean;
  revivalBlocked?: boolean;
}>;
export type RecruitsRevivalAllowance = Readonly<{
  active: boolean;
  freeRate: number;
  limit: number;
  freeRemaining: number;
  remaining: number;
}>;

/**
 * Pure resolved-facts arithmetic, not runtime-certified Recruits activation.
 * It does not play/discard a card, reopen revival, refund spice, alter a pending
 * quote, choose free elite units, or relax an elite unit's separate revival cap.
 * Existing unlimited physical limits (currently 20) survive the ordinary raise.
 */
export function recruitsRevivalAllowance(
  scope: RecruitsScope,
  facts: RecruitsRevivalFacts,
): RecruitsRevivalAllowance {
  for (const key of [
    'currentFreeRate',
    'currentLimit',
    'revived',
    'freeAllowanceUsed',
    'freeRateCap',
  ] as const)
    if (!Number.isSafeInteger(facts[key]) || facts[key] < 0)
      throw new RangeError(`${key} must be a nonnegative integer force count.`);

  const active = scope.recruits?.turn === scope.turn;
  const limit = active ? Math.max(7, facts.currentLimit) : facts.currentLimit;
  const freeRate = facts.freeBlocked
    ? 0
    : Math.min(
        facts.currentFreeRate * (active ? 2 : 1),
        facts.freeRateCap,
        limit,
      );
  const remaining = facts.revivalBlocked
    ? 0
    : Math.max(0, limit - facts.revived);
  return {
    active,
    freeRate,
    limit,
    remaining,
    freeRemaining: Math.min(
      remaining,
      Math.max(0, freeRate - facts.freeAllowanceUsed),
    ),
  };
}
