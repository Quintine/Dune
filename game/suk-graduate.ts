import type { Casualties, CombatForces } from './combat';
import type { BattleLeaderSkill } from './leader-skill-combat';
import { homeworldForceGroups, quoteHomeworldCustody, type HomeworldCustody, type HomeworldForces } from './homeworld-custody';
import { quoteHomeworldCombatLoss, type HomeworldCombatLossContext, type HomeworldCombatLossPlayer } from './homeworld-combat-loss';
import type { NativeReserveSelections } from './homeworld-native-reserves';

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
  /** Ecaz-led Occupy settles the ally's variable losses before this own-force rescue. */
  occupyCasualties?: { owner: string; forces: CombatForces; dial: number; support: number; options: Casualties[] };
  pool: SukForceGroup[];
  cards: string[];
  physical: string;
  losses: Casualties | null;
  /** New Ixian receipts preserve the actual per-sector cyborg Tank losses. */
  eliteOrigins?: true;
  signature: string;
};

/** Non-revival placement choice for counters returning from Arrakis or a foreign
 * Homeworld. It never relocates rescued counters already in native reserves. */
export type SukReserveDestinations = NativeReserveSelections;
export type SukPhysicalRescueRequest = {
  player: string;
  territory: string;
  skill: SukGraduateSkill;
  pool: readonly SukForceGroup[];
  losses: Casualties;
  option: SukRescueOption;
  destinations?: SukReserveDestinations;
  /** Preserve actual per-source Cyborg Tank losses for subsequent substitution. */
  eliteOrigins?: true;
};
export type SukPhysicalRescueReceipt = {
  player: string;
  territory: string;
  source: 'arrakis' | 'native-homeworld' | 'visitor-homeworld';
  saved: HomeworldForces;
  kept: SukRescueOption['kept'];
  destinations: Record<string, HomeworldForces>;
  tanks: HomeworldForces;
};
export type SukPhysicalRescueQuote = {
  custody: HomeworldCustody;
  players: HomeworldCombatLossPlayer[];
  removed: SukForceGroup[];
  receipt: SukPhysicalRescueReceipt;
  eliteTanks?: Record<string, number>;
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

export class SukPhysicalRescueError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SukPhysicalRescueError';
  }
}

/** Detached Homeworld settlement, including Arrakis rescue returns.
 * Printed Suk saves only real casualties. Native Homeworld forces already ARE
 * reserves, so every saved native counter remains in its original pool.
 *
 * For external returns the single native home is unambiguous. The application
 * asks the player for a typed allocation when two homes exist; this is not the
 * printed Emperor revival placement rule or a ruling on other return routes. */
export function quoteSukPhysicalRescue(
  context: HomeworldCombatLossContext,
  custody: HomeworldCustody,
  request: SukPhysicalRescueRequest,
): SukPhysicalRescueQuote {
  const homes = homeworldForceGroups(context, custody);
  const nativeHomes = homes.filter(home => home.native === request.player);
  if (!nativeHomes.length) throw new SukPhysicalRescueError('Suk Graduate needs a seated native reserve owner.');
  // Reuse the existing complete twenty-counter and special-identity validator.
  quoteHomeworldCombatLoss(context, custody, {
    location: nativeHomes[0].id, player: request.player, losses: { normal: 0, elite: 0 },
  });
  const rescue = quoteSukRescue(request.skill, request.pool, request.losses, request.option, request.eliteOrigins);
  const home = homes.find(candidate => candidate.id === request.territory);
  if (request.territory.startsWith('homeworld:') && !home)
    throw new SukPhysicalRescueError('Suk Graduate needs its original canonical battle Homeworld.');
  const native = home?.native === request.player;
  if (home) {
    const army = home.forces[request.player] ?? { normal: 0, elite: 0 };
    if (request.pool.length !== 1 || request.pool[0].key !== home.id ||
        request.pool[0].normal !== army.normal || request.pool[0].elite !== army.elite)
      throw new SukPhysicalRescueError('Suk Graduate needs the exact native or visitor battle army.');
  } else if (request.pool.some(group => group.key.startsWith('homeworld:')))
    throw new SukPhysicalRescueError('Arrakis Suk Graduate casualties cannot borrow Homeworld pools.');

  const returned = native ? { normal: 0, elite: 0 } : rescue.reserves;
  const destinations: Record<string, HomeworldForces> = {};
  if (request.destinations !== undefined) {
    if (!request.destinations || typeof request.destinations !== 'object' || Array.isArray(request.destinations))
      throw new SukPhysicalRescueError('Choose a typed Suk Graduate native-home allocation.');
    for (const [location, forces] of Object.entries(request.destinations)) {
      if (!nativeHomes.some(candidate => candidate.id === location) ||
          !forces || typeof forces !== 'object' || Array.isArray(forces) ||
          Object.keys(forces).length !== 2 ||
          !Object.hasOwn(forces, 'normal') || !Object.hasOwn(forces, 'elite') ||
          ![forces.normal, forces.elite].every(value => Number.isSafeInteger(value) && value >= 0))
        throw new SukPhysicalRescueError('Suk Graduate reserve destinations must be exact typed native Homeworlds.');
      destinations[location] = { normal: forces.normal, elite: forces.elite };
    }
    const total = Object.values(destinations).reduce((sum, forces) => ({
      normal: sum.normal + forces.normal, elite: sum.elite + forces.elite,
    }), { normal: 0, elite: 0 });
    if (total.normal !== returned.normal || total.elite !== returned.elite)
      throw new SukPhysicalRescueError('Suk Graduate destinations must match only the counters actually returning to reserves.');
  } else if (returned.normal + returned.elite) {
    if (nativeHomes.length !== 1)
      throw new SukPhysicalRescueError('Choose the Suk Graduate return allocation between your native Homeworlds.');
    destinations[nativeHomes[0].id] = { ...returned };
  }
  const removed = native
    ? [{ key: request.territory, ...rescue.tanks }]
    : rescue.removed;
  const removedTotal = removed.reduce((sum, group) => ({
    normal: sum.normal + group.normal, elite: sum.elite + group.elite,
  }), { normal: 0, elite: 0 });
  const transaction = quoteHomeworldCustody(context, custody, [
    ...(home ? [{ homeworld: home.id, player: request.player,
      withdraw: removedTotal, deposit: { normal: 0, elite: 0 } }] : []),
    ...Object.entries(destinations).filter(([, forces]) => forces.normal + forces.elite > 0)
      .map(([homeworld, deposit]) => ({
        homeworld, player: request.player, withdraw: { normal: 0, elite: 0 }, deposit,
      })),
  ]);
  const players: HomeworldCombatLossPlayer[] = context.players.map((player, index) => ({
    ...transaction.players[index],
    tanks: player.tanks + (player.id === request.player ? rescue.tanks.normal + rescue.tanks.elite : 0),
    eliteTanks: player.eliteTanks + (player.id === request.player ? rescue.tanks.elite : 0),
    battleLosses: player.battleLosses + (player.id === request.player ? rescue.tanks.normal + rescue.tanks.elite : 0),
    boardForces: !home && player.id === request.player
      ? { normal: player.boardForces.normal - removedTotal.normal, elite: player.boardForces.elite - removedTotal.elite }
      : { ...player.boardForces },
  }));
  quoteHomeworldCombatLoss({ advanced: context.advanced, players }, transaction.state, {
    location: nativeHomes[0].id, player: request.player, losses: { normal: 0, elite: 0 },
  });
  return {
    custody: transaction.state, players, removed, eliteTanks: rescue.eliteTanks,
    receipt: {
      player: request.player, territory: request.territory,
      source: home ? native ? 'native-homeworld' : 'visitor-homeworld' : 'arrakis',
      saved: { normal: request.option.normal, elite: request.option.elite },
      kept: request.option.kept ? { ...request.option.kept } : null,
      destinations, tanks: { ...rescue.tanks },
    },
  };
}
