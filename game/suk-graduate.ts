import type { Casualties, CombatForces } from './combat';
import type { BattleLeaderSkill } from './leader-skill-combat';

export type SukGraduateSkill = { leader: string; mode: 'normal' | 'skilled' };
export type SukForceGroup = { key: string; normal: number; elite: number };
export type SukRescueOption = {
  normal: number;
  elite: number;
  /** The saved counter never leaves its original sector. */
  kept: { key: string; kind: 'normal' | 'elite' } | null;
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
export function sukRescueOptions(skill: SukGraduateSkill, pool: readonly SukForceGroup[], losses: Casualties): SukRescueOption[] {
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
  return options;
}

/** Quote removals and destinations without touching tanks, reserves or battle-loss counters. */
export function quoteSukRescue(skill: SukGraduateSkill, pool: readonly SukForceGroup[], losses: Casualties, option: SukRescueOption) {
  if (!sukRescueOptions(skill, pool, losses).some((o) => JSON.stringify(o) === JSON.stringify(option)))
    throw new Error('Choose an available Suk Graduate rescue.');
  const groups = sukCasualtyGroups(pool, losses);
  return {
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
