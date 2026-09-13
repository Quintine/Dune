import {
  casualtyOptions,
  validCombatForces,
  type CombatForces,
} from './combat';
import type { Card } from './cards';
import { ecazTreacheryDefinition } from './ecaz-cards';

export const HARASS_WITHDRAW_CARD = 'ecaz-harass-withdraw' as const;
export type HarassWithdrawForces = Readonly<{ normal: number; elite: number }>;
export type HarassWithdrawSelection = Readonly<
  Record<string, HarassWithdrawForces>
>;
export type HarassWithdrawContext = Readonly<{
  blocked: string | null;
  forces: CombatForces;
  locations: Readonly<Record<string, HarassWithdrawForces>>;
}>;
export type HarassWithdrawPreview = HarassWithdrawContext &
  Readonly<{
    card: typeof HARASS_WITHDRAW_CARD;
    /** New battle protocol allows the physical return to be chosen after reveal. */
    allowAllocation?: boolean;
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
function record(value: unknown): value is Record<string, unknown> {
  return (
    !!value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    [Object.prototype, null].includes(Object.getPrototypeOf(value))
  );
}
function physicalGroup(value: unknown): value is HarassWithdrawForces {
  return (
    record(value) &&
    Object.keys(value).sort().join(',') === 'elite,normal' &&
    [value.normal, value.elite].every(
      (n) => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0,
    )
  );
}
function validateContext(context: HarassWithdrawContext) {
  requireHarass(
    record(context) &&
      (context.blocked === null || typeof context.blocked === 'string'),
    'Harass & Withdraw needs a valid physical battle context.',
  );
  requireHarass(
    !context.blocked,
    context.blocked ?? 'Harass & Withdraw is unavailable.',
  );
  const forces = context.forces;
  requireHarass(
    validCombatForces(forces) && !forces.temporaryElite,
    'Harass & Withdraw needs ordinary physical force roles.',
  );
  requireHarass(
    record(context.locations),
    'Harass & Withdraw needs named physical force locations.',
  );
  const locations = Object.entries(context.locations);
  requireHarass(
    locations.every(([key, group]) => key.length > 0 && physicalGroup(group)) &&
      locations.reduce((n, [, group]) => n + group.normal, 0) ===
        forces.normal &&
      locations.reduce((n, [, group]) => n + group.elite, 0) === forces.elite,
    'Harass & Withdraw must match the user’s physical forces in this battle.',
  );
  return locations;
}
/** Distinct physical dial commitments; equivalent support allocations are not extra choices. */
export function harassWithdrawCommitments(
  context: HarassWithdrawContext,
  dial: number,
  support: number,
): { normal: number; elite: number }[] {
  validateContext(context);
  const choices = casualtyOptions(context.forces, dial, support);
  requireHarass(
    choices.length > 0,
    'Dial and spice must match a legal physical force commitment.',
  );
  return [
    ...new Map(
      choices.map(({ normal, elite }) => [
        `${normal}:${elite}`,
        { normal, elite },
      ]),
    ).values(),
  ];
}
function ambiguousAllocation(
  context: HarassWithdrawContext,
  physical: readonly HarassWithdrawForces[],
) {
  if (physical.length !== 1) return true;
  return (['normal', 'elite'] as const).some((type) => {
    const returned = context.forces[type] - physical[0][type];
    return (
      returned !== 0 &&
      returned !== context.forces[type] &&
      Object.values(context.locations).filter((group) => group[type] > 0)
        .length > 1
    );
  });
}
/** Invalid plans still throw; true means only a legal physical/sector choice remains. */
export function harassWithdrawNeedsAllocation(
  context: HarassWithdrawContext,
  dial: number,
  support: number,
): boolean {
  return ambiguousAllocation(
    context,
    harassWithdrawCommitments(context, dial, support),
  );
}
/** Stable fallback policy only: the selected (or first legal) commitment, then sorted locations. */
export function defaultHarassWithdrawAllocation(
  context: HarassWithdrawContext,
  dial: number,
  support: number,
  selected?: HarassWithdrawForces,
): Record<string, { normal: number; elite: number }> {
  const choices = harassWithdrawCommitments(context, dial, support);
  requireHarass(
    selected === undefined ||
      (physicalGroup(selected) &&
        choices.some(
          (choice) =>
            choice.normal === selected.normal &&
            choice.elite === selected.elite,
        )),
    'Choose one legal physical dial commitment before allocating its return.',
  );
  const commitment = selected ?? choices[0];
  const remaining = {
    normal: context.forces.normal - commitment.normal,
    elite: context.forces.elite - commitment.elite,
  };
  return Object.fromEntries(
    Object.entries(context.locations)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .flatMap(([key, group]) => {
        const returned = {
          normal: Math.min(remaining.normal, group.normal),
          elite: Math.min(remaining.elite, group.elite),
        };
        remaining.normal -= returned.normal;
        remaining.elite -= returned.elite;
        return returned.normal || returned.elite ? [[key, returned]] : [];
      }),
  );
}
/** Resolve only the user's physical counters. Neither opposing plans nor outcomes are inputs. */
export function quoteHarassWithdraw(
  context: HarassWithdrawContext,
  dial: number,
  support: number,
  selection?: HarassWithdrawSelection,
): HarassWithdrawQuote {
  const physical = harassWithdrawCommitments(context, dial, support);
  const forces = context.forces;
  if (selection !== undefined) {
    requireHarass(
      record(selection),
      'Choose the returned physical forces by location.',
    );
    const entries = Object.entries(selection);
    requireHarass(
      entries.every(
        ([key, group]) =>
          Object.hasOwn(context.locations, key) &&
          physicalGroup(group) &&
          group.normal <= context.locations[key].normal &&
          group.elite <= context.locations[key].elite,
      ),
      'Returned forces must be whole available normal and elite counters at known battle locations.',
    );
    const returned = entries.reduce(
      (sum, [, group]) => ({
        normal: sum.normal + group.normal,
        elite: sum.elite + group.elite,
      }),
      { normal: 0, elite: 0 },
    );
    const committed = physical.find(
      (choice) =>
        choice.normal === forces.normal - returned.normal &&
        choice.elite === forces.elite - returned.elite,
    );
    requireHarass(
      committed,
      'The returned counters must be the exact undialed complement of a legal physical commitment.',
    );
    return {
      returned,
      remaining: { ...forces, ...committed },
      locations: Object.fromEntries(
        entries
          .filter(([, group]) => group.normal || group.elite)
          .map(([key, group]) => [
            key,
            { normal: group.normal, elite: group.elite },
          ]),
      ),
    };
  }
  requireHarass(
    physical.length === 1,
    'Harass & Withdraw with an ambiguous regular/elite commitment is still being implemented. Choose a uniquely determined physical commitment.',
  );
  const committed = physical[0];
  const returned = {
    normal: forces.normal - committed.normal,
    elite: forces.elite - committed.elite,
  };
  const locations = Object.entries(context.locations);
  const allocation = new Map<string, { normal: number; elite: number }>();
  for (const type of ['normal', 'elite'] as const) {
    const amount = returned[type],
      occupied = locations.filter(([, group]) => group[type] > 0);
    requireHarass(
      amount === 0 || amount === forces[type] || occupied.length === 1,
      'Harass & Withdraw with an ambiguous allocation among sectors is still being implemented. Choose a uniquely determined physical commitment.',
    );
    // Preserve legacy insertion order as well as the uniquely determined counts.
    for (const [key, group] of occupied) {
      const count =
        amount === forces[type]
          ? group[type]
          : occupied.length === 1
            ? amount
            : 0;
      if (count) {
        const selected = allocation.get(key) ?? { normal: 0, elite: 0 };
        selected[type] = count;
        allocation.set(key, selected);
      }
    }
  }
  return {
    returned,
    remaining: { ...forces, normal: committed.normal, elite: committed.elite },
    locations: Object.fromEntries(allocation),
  };
}
