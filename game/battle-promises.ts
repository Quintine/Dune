import { richeseCards } from './richese-cards';
import type { Plan } from './engine';
import { treacheryDeck, type Card } from './cards';
import { CHEAP_HERO_TRAITOR } from './traitors';

export type PlanClaim =
  | { kind: 'dial' | 'support'; compare: 'eq' | 'gte' | 'lte'; value: number }
  | { kind: 'weapon' | 'defense'; name: string | null }
  | { kind: 'leader'; leader: string | null }
  | { kind: 'kwisatz'; use: boolean }
  | { kind: 'and' | 'or'; terms: PlanClaim[] };
export type BattlePromise = {
  player: string;
  asker: string;
  claim: PlanClaim;
  answer: boolean;
  released?: boolean;
};
export class PlanClaimError extends Error {}
export function parsePlanClaim(
  value: unknown,
  leaders: string[],
  depth = 0,
  budget = { remaining: 16 },
): PlanClaim {
  const fail = (): never => {
    throw new PlanClaimError(
      'Choose a valid battle-plan condition (at most 16 clauses and four grouping levels).',
    );
  };
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    depth > 4 ||
    budget.remaining-- <= 0
  )
    return fail();
  const v = value as Record<string, unknown>;
  if (v.kind === 'and' || v.kind === 'or') {
    if (!Array.isArray(v.terms) || v.terms.length < 2 || v.terms.length > 8)
      return fail();
    return {
      kind: v.kind,
      terms: v.terms.map((term) =>
        parsePlanClaim(term, leaders, depth + 1, budget),
      ),
    };
  }
  if (v.kind === 'dial' || v.kind === 'support') {
    if (
      !['eq', 'gte', 'lte'].includes(String(v.compare)) ||
      typeof v.value !== 'number' ||
      !Number.isFinite(v.value) ||
      v.value < 0 ||
      v.value > 40 ||
      !Number.isInteger(v.value * (v.kind === 'dial' ? 2 : 1))
    )
      return fail();
    return {
      kind: v.kind,
      compare: v.compare as 'eq' | 'gte' | 'lte',
      value: v.value,
    };
  }
  if (v.kind === 'weapon' || v.kind === 'defense') {
    if (
      v.name !== null &&
      (typeof v.name !== 'string' ||
        ![...treacheryDeck(['ix']), ...richeseCards()].some((c) => c.name === v.name))
    )
      return fail();
    return { kind: v.kind, name: v.name };
  }
  if (v.kind === 'leader') {
    if (
      v.leader !== null &&
      (typeof v.leader !== 'string' ||
        (!leaders.includes(v.leader) && v.leader !== CHEAP_HERO_TRAITOR))
    )
      return fail();
    return { kind: v.kind, leader: v.leader };
  }
  if (v.kind === 'kwisatz' && typeof v.use === 'boolean')
    return { kind: 'kwisatz', use: v.use };
  return fail();
}
/** Undefined means a partial candidate cannot yet determine the answer. */
export function matchesPlanClaim(
  claim: PlanClaim,
  plan: Partial<Plan>,
  hand: readonly Card[],
): boolean | undefined {
  if (claim.kind === 'and' || claim.kind === 'or') {
    const terms = claim.terms.map((c) => matchesPlanClaim(c, plan, hand));
    if (claim.kind === 'and')
      return terms.includes(false)
        ? false
        : terms.includes(undefined)
          ? undefined
          : true;
    return terms.includes(true)
      ? true
      : terms.includes(undefined)
        ? undefined
        : false;
  }
  if (claim.kind === 'kwisatz')
    return plan.kwisatz === undefined ? undefined : plan.kwisatz === claim.use;
  if (claim.kind === 'dial' || claim.kind === 'support') {
    const n = plan[claim.kind];
    if (n === undefined) return undefined;
    return claim.compare === 'eq'
      ? n === claim.value
      : claim.compare === 'gte'
        ? n >= claim.value
        : n <= claim.value;
  }
  if (claim.kind === 'weapon' || claim.kind === 'defense') {
    const id = plan[claim.kind];
    if (id === undefined) return undefined;
    return (
      (id === null ? null : hand.find((c) => c.id === id)?.name) === claim.name
    );
  }
  if (claim.kind === 'leader') {
    if (plan.leader === undefined) return undefined;
    return (
      (hand.find((c) => c.id === plan.leader)?.kind === 'hero'
        ? CHEAP_HERO_TRAITOR
        : plan.leader) === claim.leader
    );
  }
}
export function respectsBattlePromises(
  promises: readonly BattlePromise[],
  player: string,
  plan: Partial<Plan>,
  hand: readonly Card[],
): boolean {
  return promises
    .filter((p) => p.player === player && !p.released)
    .every((p) => {
      const match = matchesPlanClaim(p.claim, plan, hand);
      return match === undefined || match === p.answer;
    });
}
export function planClaimText(
  c: PlanClaim,
  leaderName: (id: string) => string,
): string {
  if (c.kind === 'and' || c.kind === 'or')
    return `(${c.terms.map((term) => planClaimText(term, leaderName)).join(c.kind === 'and' ? ' AND ' : ' OR ')})`;
  if (c.kind === 'dial' || c.kind === 'support')
    return `your ${c.kind === 'dial' ? 'dial' : 'spice support'} is ${c.compare === 'eq' ? 'exactly' : c.compare === 'gte' ? 'at least' : 'at most'} ${c.value}`;
  if (c.kind === 'weapon' || c.kind === 'defense')
    return c.name === null
      ? `your ${c.kind} slot is empty`
      : `you play ${c.name} in your ${c.kind} slot`;
  if (c.kind === 'leader')
    return c.leader === null
      ? 'you use no leader or hero'
      : `you use ${c.leader === CHEAP_HERO_TRAITOR ? 'a Cheap Hero / Heroine' : leaderName(c.leader)}`;
  if (c.kind === 'kwisatz')
    return `you ${c.use ? 'use' : 'do not use'} the Kwisatz Haderach`;
  throw new PlanClaimError('Unknown battle condition.');
}
