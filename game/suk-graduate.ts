import type { Casualties, CombatForces } from './combat';
import type { BattleLeaderSkill } from './leader-skill-combat';

export type SukGraduateSkill = { leader: string; mode: 'normal' | 'skilled' };
export type SukForceGroup = { key: string; normal: number; elite: number };
export type SukRescueOption = {
  normal: number;
  elite: number;
  /** The saved counter never leaves its original sector. */
  kept: { key: string; kind: 'normal' | 'elite' } | null;
  /** Distinct rescued cyborg origins when later Ixian substitution needs them. */
  eliteReserves?: Record<string, number>;
};
export type SukRescueReceipt = {
  event: string;
  turn: number;
  player: string;
  territory: string;
  skill: SukGraduateSkill;
  commitment: { forces: CombatForces; dial: number; support: number; options: Casualties[] };
  pool: SukForceGroup[];
  cards: string[];
  physical: string;
  losses: Casualties | null;
  /** New Ixian receipts preserve the actual per-sector cyborg Tank losses. */
  eliteOrigins?: true;
  signature: string;
};

export function sukReceiptSignature(receipt: SukRescueReceipt): string {
  const { signature: _signature, ...value } = receipt;
  return JSON.stringify(value);
}

/** Freeze entitlement while the revealed plan and captured controller still exist. */
export function sukGraduateSkill(
  assignments: readonly BattleLeaderSkill[],
  leader: { id: string; dead: boolean } | undefined,
  survives: boolean,
): SukGraduateSkill | null {
  const skill = assignments.find((a) => a.skill === 'suk-graduate');
  if (!skill) return null;
  if (skill.leader === leader?.id)
    return !leader.dead && survives && (!skill.faceUp || skill.captured)
      ? { leader: skill.leader, mode: 'skilled' }
      : null;
  return skill.faceUp && !skill.captured
    ? { leader: skill.leader, mode: 'normal' }
    : null;
}

/** Match the engine's ordinary physical casualty allocation in location order. */
export function sukCasualtyGroups(pool: readonly SukForceGroup[], losses: Casualties): SukForceGroup[] {
  let normal = losses.normal, elite = losses.elite;
  if (![normal, elite, ...pool.flatMap((g) => [g.normal, g.elite])].every((n) => Number.isSafeInteger(n) && n >= 0) ||
      new Set(pool.map((g) => g.key)).size !== pool.length)
    throw new Error('Invalid Suk Graduate physical casualty pool.');
  const groups = pool.map((g) => {
    const n = Math.min(normal, g.normal), e = Math.min(elite, g.elite);
    normal -= n; elite -= e;
    return { key: g.key, normal: n, elite: e };
  });
  if (normal || elite) throw new Error('The Suk Graduate casualties are no longer available.');
  return groups;
}

/** Only the actual dialed counters can be rescued; the two bands never add. */
export function sukRescueOptions(skill: SukGraduateSkill, pool: readonly SukForceGroup[], losses: Casualties, eliteOrigins = false): SukRescueOption[] {
  const groups = sukCasualtyGroups(pool, losses);
  const total = losses.normal + losses.elite;
  if (!total) return [];
  const options: SukRescueOption[] = [];
  if (skill.mode === 'skilled') options.push({ normal: 0, elite: 0, kept: null });
  const maximum = skill.mode === 'normal' ? 1 : Math.min(3, total);
  for (let saved = 1; saved <= maximum; saved++) {
    for (let elite = 0; elite <= Math.min(saved, losses.elite); elite++) {
      const normal = saved - elite;
      if (normal > losses.normal) continue;
      if (skill.mode === 'normal') options.push({ normal, elite, kept: null });
      else for (const group of groups)
        for (const kind of ['normal', 'elite'] as const)
          if (group[kind] > 0 && (kind === 'normal' ? normal : elite) > 0)
            options.push({ normal, elite, kept: { key: group.key, kind } });
    }
  }
  if (!eliteOrigins) return options;
  return options.flatMap(option => {
    const allocations = rescuedEliteOrigins(groups, option);
    return allocations.length > 1
      ? allocations.map(eliteReserves => ({ ...option, eliteReserves })) : [option];
  });
}

/** Enumerate physical reserve rescues, excluding the counter kept on the board. */
function rescuedEliteOrigins(groups: readonly SukForceGroup[], option: SukRescueOption): Record<string, number>[] {
  const remaining = option.elite - (option.kept?.kind === 'elite' ? 1 : 0);
  const result: Record<string, number>[] = [];
  const visit = (index: number, left: number, selected: Record<string, number>) => {
    if (index === groups.length) {
      if (!left) result.push(selected);
      return;
    }
    const group = groups[index];
    const available = group.elite - (option.kept?.key === group.key && option.kept.kind === 'elite' ? 1 : 0);
    for (let count = 0; count <= Math.min(left, available); count++)
      visit(index + 1, left - count, count ? { ...selected, [group.key]: count } : selected);
  };
  visit(0, remaining, {});
  return result;
}

/** Quote removals and destinations without touching tanks, reserves or battle-loss counters. */
export function quoteSukRescue(skill: SukGraduateSkill, pool: readonly SukForceGroup[], losses: Casualties, option: SukRescueOption, eliteOrigins = false) {
  if (!sukRescueOptions(skill, pool, losses, eliteOrigins).some((o) => JSON.stringify(o) === JSON.stringify(option)))
    throw new Error('Choose an available Suk Graduate rescue.');
  const groups = sukCasualtyGroups(pool, losses);
  const rescued = eliteOrigins ? option.eliteReserves ?? rescuedEliteOrigins(groups, option)[0] : null;
  return {
    ...(rescued ? { eliteTanks: Object.fromEntries(groups.map(group => [group.key,
      group.elite - (rescued[group.key] ?? 0) - (option.kept?.key === group.key && option.kept.kind === 'elite' ? 1 : 0),
    ]).filter(([, count]) => Number(count) > 0)) as Record<string, number> } : {}),
    removed: groups.map((g) => ({ ...g,
      normal: g.normal - (option.kept?.key === g.key && option.kept.kind === 'normal' ? 1 : 0),
      elite: g.elite - (option.kept?.key === g.key && option.kept.kind === 'elite' ? 1 : 0),
    })),
    reserves: {
      normal: option.normal - (option.kept?.kind === 'normal' ? 1 : 0),
      elite: option.elite - (option.kept?.kind === 'elite' ? 1 : 0),
    },
    tanks: { normal: losses.normal - option.normal, elite: losses.elite - option.elite },
  };
}
