import {
  casualtyOptions,
  validCombatForces,
  type CombatForces,
} from './combat';
import type { Card } from './cards';
import { ecazTreacheryDefinition } from './ecaz-cards';

export const HARASS_WITHDRAW_CARD = 'ecaz-harass-withdraw' as const;
export type HarassWithdrawForces = Readonly<{ normal: number; elite: number }>;
export type HarassWithdrawContext = Readonly<{
  blocked: string | null;
  forces: CombatForces;
  locations: Readonly<Record<string, HarassWithdrawForces>>;
}>;
export type HarassWithdrawPreview = HarassWithdrawContext &
  Readonly<{
    card: typeof HARASS_WITHDRAW_CARD;
  }>;
export type HarassWithdrawQuote = {
  returned: { normal: number; elite: number };
  remaining: CombatForces;
  locations: Record<string, { normal: number; elite: number }>;
};
export class HarassWithdrawError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HarassWithdrawError';
  }
}
export function isHarassWithdraw(card: Card | undefined): boolean {
  return (
    !!card &&
    card.id === HARASS_WITHDRAW_CARD &&
    Object.keys(card).sort().join(',') === 'effect,id,kind,name' &&
    ecazTreacheryDefinition(card)?.card.effect === 'harassWithdraw'
  );
}
function requireHarass(condition: unknown, message: string): asserts condition {
  if (!condition) throw new HarassWithdrawError(message);
}
/** Resolve only the user's physical counters. Neither opposing plans nor outcomes are inputs. */
export function quoteHarassWithdraw(
  context: HarassWithdrawContext,
  dial: number,
  support: number,
): HarassWithdrawQuote {
  requireHarass(
    !context.blocked,
    context.blocked ?? 'Harass & Withdraw is unavailable.',
  );
  const forces = context.forces;
  requireHarass(
    validCombatForces(forces) && !forces.temporaryElite,
    'Harass & Withdraw needs ordinary physical force roles.',
  );
  const locations = Object.entries(context.locations);
  requireHarass(
    locations.every(
      ([key, group]) =>
        key.length > 0 &&
        group &&
        Object.keys(group).sort().join(',') === 'elite,normal' &&
        [group.normal, group.elite].every(
          (n) => Number.isSafeInteger(n) && n >= 0,
        ),
    ) &&
      locations.reduce((n, [, group]) => n + group.normal, 0) ===
        forces.normal &&
      locations.reduce((n, [, group]) => n + group.elite, 0) === forces.elite,
    'Harass & Withdraw must match the user’s physical forces in this battle.',
  );
  const choices = casualtyOptions(forces, dial, support);
  requireHarass(
    choices.length > 0,
    'Dial and spice must match a legal physical force commitment.',
  );
  const physical = [
    ...new Map(
      choices.map((choice) => [`${choice.normal}:${choice.elite}`, choice]),
    ).values(),
  ];
  requireHarass(
    physical.length === 1,
    'Harass & Withdraw with an ambiguous regular/elite commitment is still being implemented. Choose a uniquely determined physical commitment.',
  );
  const committed = physical[0];
  const returned = {
    normal: forces.normal - committed.normal,
    elite: forces.elite - committed.elite,
  };
  const allocation: HarassWithdrawQuote['locations'] = {};
  for (const type of ['normal', 'elite'] as const) {
    const amount = returned[type],
      occupied = locations.filter(([, group]) => group[type] > 0);
    requireHarass(
      amount === 0 || amount === forces[type] || occupied.length === 1,
      'Harass & Withdraw with an ambiguous allocation among sectors is still being implemented. Choose a uniquely determined physical commitment.',
    );
    for (const [key, group] of occupied) {
      const count =
        amount === forces[type]
          ? group[type]
          : occupied.length === 1
            ? amount
            : 0;
      if (count) (allocation[key] ??= { normal: 0, elite: 0 })[type] = count;
    }
  }
  return {
    returned,
    remaining: { ...forces, normal: committed.normal, elite: committed.elite },
    locations: allocation,
  };
}
