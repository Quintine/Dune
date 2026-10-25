import type { Game, Player } from './engine';
import type { Leader } from './cards';
import { faction, type FactionId } from './catalog';
import { isAuditorLeader } from './choam-auditor';
import { homeworldLowBonus } from './homeworld-benefits';
import { recruitsRevivalAllowance } from './recruits';
import { DUKE_VIDAL_ID } from './duke-vidal';
import { ecazDukeRevivalBlock, quoteEcazDukeRevival, type EcazDukeRevivalContext } from './ecaz-duke-revival';
import {
  quoteEcazRevivalCohort, completeEcazRevivalCohortUse,
  recordEcazRevivalOpening, recordEcazFirstExecution,
} from './ecaz-revival-cohort';
type RevivalRateContext = Pick<
  Game,
  | 'advanced'
  | 'players'
  | 'homeworlds'
  | 'revivalRules'
  | 'freeRevival'
  | 'turn'
  | 'recruits'
>;
export type RevivalRules = {
  expanded: string[];
  /** Provisional shared five-return permission from the actual absent-faction Nexus grant. */
  nexusTleilaxu?: string[];
  /** Independent fixed ordinary free quota; native Recruits rates remain separate. */
  nexusFremen?: { turn: number; owners: string[] };
  choamBlocked?: boolean;
  freeBlocked?: string[];
  /** This Revival turn's prevented native Fremen-to-ally grant opportunities. */
  fremenGrantBlocked?: string[];
  limitBlocked: boolean;
  fullPrice: boolean;
  allyDiscount: string | null;
  discountBlocked: boolean;
  earlyBlocked: string[];
};
export const newRevivalRules = (): RevivalRules => ({
  expanded: [],
  limitBlocked: false,
  fullPrice: false,
  allyDiscount: null,
  discountBlocked: false,
  earlyBlocked: [],
});
export function forceRevivalLimit(
  g: Pick<Game, 'revivalRules'>,
  p: Pick<Player, 'id' | 'faction'>,
) {
  if (p.faction === 'choam' && !g.revivalRules?.choamBlocked) return 20;
  if (g.revivalRules?.nexusTleilaxu?.includes(p.id)) return 5;
  if (g.revivalRules?.limitBlocked) return 3;
  if (p.faction === 'tleilaxu') return 20;
  return g.revivalRules?.expanded.includes(p.id) ? 5 : 3;
}
export function revivalDiscount(
  g: Pick<Game, 'players' | 'revivalRules'>,
  p: Pick<Player, 'id' | 'faction'>,
) {
  if (p.faction === 'tleilaxu') return !g.revivalRules?.fullPrice;
  return (
    !g.revivalRules?.discountBlocked &&
    g.revivalRules?.allyDiscount === p.id &&
    g.players.some((t) => t.faction === 'tleilaxu' && t.ally === p.id)
  );
}
export function freeRevivalRate(
  g: RevivalRateContext,
  p: Pick<Player, 'id' | 'faction'>,
) {
  return g.revivalRules?.freeBlocked?.includes(p.id)
    ? 0
    : (g.freeRevival.includes(p.id) ? 3 : faction(p.faction).revival) +
        homeworldLowBonus(g, p.id);
}
/** E3's explicit four-free Fremen rate may exceed the ordinary three-return cap;
 * the extra free rate never creates an additional paid allowance. */
export function normalForceRevivalLimit(
  g: RevivalRateContext,
  p: Pick<Player, 'id' | 'faction' | 'revived' | 'freeForcesRevived'>,
) {
  return normalRevivalAllowance(g, p).limit;
}
export function normalRevivalAllowance(
  g: RevivalRateContext,
  p: Pick<Player, 'id' | 'faction' | 'revived' | 'freeForcesRevived'>,
) {
  const currentFreeRate = freeRevivalRate(g, p);
  const native = recruitsRevivalAllowance(g, {
    currentFreeRate,
    currentLimit: Math.max(forceRevivalLimit(g, p), currentFreeRate),
    revived: p.revived,
    // A Recruits activation is rejected when this ledger is absent and use is
    // nonzero. The fallback preserves old-room behavior while the card is idle.
    freeAllowanceUsed:
      g.recruits?.turn === g.turn ? (p.freeForcesRevived ?? p.revived) : p.revived,
    freeRateCap: 20,
  });
  if (g.revivalRules?.nexusFremen?.turn !== g.turn ||
    !g.revivalRules.nexusFremen.owners.includes(p.id) ||
    g.revivalRules.freeBlocked?.includes(p.id)) return native;
  const used = p.freeForcesRevived ?? (p.revived === 0 ? 0 : undefined);
  if (used === undefined || !Number.isSafeInteger(used) || used < 0 || used > p.revived)
    throw new RangeError('The Fremen Nexus quota needs the actual prior free-return ledger.');
  const freeRate = Math.max(native.freeRate, 3);
  return { ...native, freeRate,
    freeRemaining: Math.min(native.remaining, Math.max(0, freeRate - used)) };
}
export function freeRevivalRemaining(
  g: RevivalRateContext,
  p: Pick<Player, 'id' | 'faction' | 'revived' | 'freeForcesRevived'>,
) {
  return normalRevivalAllowance(g, p).freeRemaining;
}
export function forceRevivalQuote(
  g: RevivalRateContext,
  p: Pick<Player, 'id' | 'faction' | 'revived' | 'freeForcesRevived'>,
  amount: number,
  elite = 0,
  freeElite?: number,
) {
  const free = Math.min(amount, freeRevivalRemaining(g, p));
  return forceRevivalPrice(
    p.faction,
    amount,
    elite,
    free,
    !!revivalDiscount(g, p),
    freeElite,
    !!g.revivalRules?.choamBlocked,
  );
}

/** Normal force returns only; Emperor-funded extra revivals and card effects are separate. */
export function forceRevivalRemaining(
  g: RevivalRateContext,
  p: Pick<Player, 'id' | 'faction' | 'revived' | 'freeForcesRevived' | 'tanks'>,
) {
  return Math.max(
    0,
    Math.min(
      p.tanks,
      normalForceRevivalLimit(g, p) - p.revived,
      // GF9 November 2020 FAQ p. 5 permits paid Fremen revivals with Tleilaxu in play.
      // Selecting expansion cards alone does not provide that faction's permission.
      p.faction === 'fremen' &&
        !g.players.some((player) => player.faction === 'tleilaxu')
        ? freeRevivalRemaining(g, p)
        : Infinity,
    ),
  );
}
export function normalRevivalCycle(
  p: Pick<Player, 'faction' | 'leaders' | 'revivalCycle'>,
) {
  let cycle = Infinity;
  for (const leader of p.leaders) {
    // Provisional CHOAM policy: the independently revivable extra Auditor
    // does not open or delay the ordinary five-disc cohort.
    if (p.faction === 'choam' && isAuditorLeader(leader)) continue;
    if (!leader.dead && !leader.capturedBy && !leader.gholaBy)
      return p.revivalCycle;
    cycle = Math.min(cycle, leader.dead ? leader.deaths : leader.deaths + 1);
  }
  return cycle;
}

export type LeaderRevivalCohortContext = EcazDukeRevivalContext;
export type LeaderRevivalCohortPlayer = Pick<
  Player, 'id' | 'faction' | 'leaders' | 'revivalCycle' | 'ecazRevivalCohort'
>;
export type LeaderRevivalCohortQuote = {
  cycle: number;
  leaders: readonly string[];
  dukeAvailable: boolean;
  dukeBlocked: string | null;
};

/** Ordinary death/cohort permission only, independent of phase, allowance,
 * payment and prevention. The native Tleilaxu early service is separate.
 * Ecaz keeps native identity separate from independent Duke deaths; only the
 * absent-Tleilaxu card quote may waive the unopened first cohort. */
export function quoteLeaderRevivalCohort(
  g: LeaderRevivalCohortContext,
  p: LeaderRevivalCohortPlayer,
  waiveOpening = false,
): LeaderRevivalCohortQuote {
  const shared = p.faction === 'ecaz' && g.dukeVidal;
  const dukeContext = shared && g.status === 'playing' ? g : null;
  const dukeBlocked = dukeContext ? ecazDukeRevivalBlock(dukeContext, p.id) : null;
  const dukeAvailable = !!dukeContext && !dukeBlocked;
  const cohort = shared ? quoteEcazRevivalCohort(p, dukeAvailable, waiveOpening) : null;
  let cycle = cohort?.cycle ?? normalRevivalCycle(p);
  if (waiveOpening && !cohort) cycle = Math.max(1, cycle);
  const leaders = p.leaders.flatMap((leader) => {
    if (!leader.dead || leader.capturedBy || leader.gholaBy) return [];
    // Supplied Advanced p29 E permits Auditor revival each turn regardless
    // of the ordinary five-disc cohort, including its repeated deaths.
    const auditorReturn = g.advanced && p.faction === 'choam' && isAuditorLeader(leader);
    return auditorReturn || (cycle > 0 && (cohort
      ? !cohort.returned.includes(leader.id) : leader.deaths === cycle))
      ? [leader.id] : [];
  });
  return { cycle, leaders, dukeAvailable, dukeBlocked };
}

export function leaderRevivalOptions(
  g: Pick<
    Game,
    | 'advanced'
    | 'phase'
    | 'turn'
    | 'revivalPrevention'
    | 'players'
    | 'revivalRules'
    | 'status'
    | 'dukeVidal'
  >,
  p: Pick<
    Player,
    | 'id'
    | 'faction'
    | 'leaders'
    | 'revivalCycle'
    | 'ecazRevivalCohort'
    | 'leaderRevived'
    | 'spice'
    | 'kwisatz'
  >,
  waiveOpening = false,
) {
  const shared = p.faction === 'ecaz' && g.dukeVidal;
  const { cycle, leaders: cohortLeaders, dukeAvailable, dukeBlocked } =
    quoteLeaderRevivalCohort(g, p, waiveOpening);
  const enabled = g.phase === 4 && !revivalPrevented(g, p.id);
  const discount = revivalDiscount(g, p);
  const leaders = p.leaders.flatMap((leader) => {
    if (!enabled || !leader.dead || leader.capturedBy || leader.gholaBy)
      return [];
    const normal = !p.leaderRevived && cohortLeaders.includes(leader.id);
    if (
      !normal &&
      (p.faction !== 'tleilaxu' ||
        g.revivalRules?.earlyBlocked.includes(`${p.id}:${leader.id}`))
    )
      return [];
    const cost = discount ? Math.ceil(leader.strength / 2) : leader.strength;
    return [
      {
        id: leader.id,
        name: leader.name,
        normalCost: leader.strength,
        cost,
        early: !normal,
        affordable: p.spice >= cost,
      },
    ];
  });
  if (dukeAvailable && enabled && !p.leaderRevived) {
    const quote = quoteEcazDukeRevival(g, p.id, !!discount);
    leaders.push({
      id: DUKE_VIDAL_ID,
      name: quote.duke.leader.name,
      normalCost: quote.normalCost,
      cost: quote.cost,
      early: false,
      affordable: p.spice >= quote.cost,
    });
  }
  const kwisatzCost = discount ? 1 : 2;
  const kwisatz =
    enabled &&
    g.advanced &&
    p.faction === 'atreides' &&
    p.kwisatz?.dead &&
    !p.leaderRevived &&
    cycle >= (p.kwisatz.revivalCycle ?? 1)
      ? { cost: kwisatzCost, affordable: p.spice >= kwisatzCost }
      : null;
  return { cycle, leaders, kwisatz, dukeBlocked,
    ...(g.advanced && p.faction === 'choam' && p.leaders.some(isAuditorLeader)
      ? { auditorCyclePolicy: 'Supplied Advanced p29 permits Auditor revival each turn. Provisional ordinary-cycle policy: only the five ordinary CHOAM discs determine revival cycles; a living or repeatedly killed Auditor neither delays nor opens them. Auditor still uses the normal one-leader allowance.' }
      : {}),
    ...(shared ? { ecazCyclePolicy: 'Provisional Ecaz cohort policy: five physical leaders in Tanks, including Duke, or no available native leaders opens ordinary returns. A completed native return waits for the remaining native cohort and another opening. A late first death may join the current cohort; independent Duke deaths do not set ordinary cohort numbers.' } : {}) };
}

function ecazCohortOwner(g: Game, leader: string): Player | null {
  if (!g.dukeVidal) return null;
  const owner = g.players.find(player => player.faction === 'ecaz');
  return owner && (leader === DUKE_VIDAL_ID || owner.leaders.some(l => l.id === leader))
    ? owner : null;
}

/** Every actual native return, including independent Ghola/Ambassador/foreign
 * return, consumes that disc's current ordinary cohort, never an extra slot. */
export function recordEcazLeaderReturn(g: Game, leader: Pick<Leader, 'id'>): void {
  const owner = ecazCohortOwner(g, leader.id);
  if (!owner) return;
  const dukeInTanks = g.dukeVidal!.leader.dead && !ecazDukeRevivalBlock(g, owner.id);
  if (leader.id === DUKE_VIDAL_ID) recordEcazRevivalOpening(owner, dukeInTanks);
  else completeEcazRevivalCohortUse(owner, dukeInTanks, leader.id);
}

/** Only the first execution skips the first ordinary death cohort. */
export function recordEcazLeaderExecution(g: Game, leader: Pick<Leader, 'id'>): void {
  if (leader.id === DUKE_VIDAL_ID) return;
  const owner = ecazCohortOwner(g, leader.id);
  if (owner) recordEcazFirstExecution(owner,
    g.dukeVidal!.leader.dead && !ecazDukeRevivalBlock(g, owner.id), leader.id);
}
export type PendingRevival = {
  player: string;
  kind: 'forces' | 'leader' | 'kwisatz' | 'foreignGhola';
  payer?: string;
  emperorExtra?: boolean;
  /** Independent fixed-three source; never native Emperor funding or ordinary usage. */
  nexusEmperorEvent?: string;
  /** Frozen physical Ix HIGH grant, additional to ordinary allowance. Absent
   * on requests accepted before this effect was implemented. */
  ixSuboidBonus?: number;
  amount?: number;
  elite?: number;
  leader?: string;
  normalCost: number;
  cost: number;
  free: number;
  checks: (
    | 'choamRevival'
    | 'revivalLimit'
    | 'revivalDiscount'
    | 'earlyRevival'
    | 'foreignGhola'
  )[];
};

export function revivalPrevented(
  g: Pick<Game, 'turn' | 'phase' | 'revivalPrevention'>,
  player: string,
) {
  return (
    g.phase === 4 &&
    g.revivalPrevention?.turn === g.turn &&
    g.revivalPrevention.player === player
  );
}

export function eliteRevivalRemaining(
  p: Pick<Player, 'faction' | 'elites'>,
  advanced = true,
) {
  return !advanced || p.faction === 'ixians'
    ? (p.elites?.tanks ?? 0)
    : Math.min(p.elites?.tanks ?? 0, Math.max(0, 1 - (p.elites?.revived ?? 0)));
}
export function paidForceRevivalCost(
  p: Pick<Player, 'faction'>,
  amount: number,
  elite = 0,
) {
  return amount * 2 + (p.faction === 'ixians' ? elite : 0);
}

export function forceRevivalPrice(
  faction: FactionId,
  amount: number,
  elite: number,
  free: number,
  discount: boolean,
  freeElite?: number,
  choamBlocked = false,
) {
  const freeCyborgs =
    faction === 'ixians' ? (freeElite ?? Math.min(free, elite)) : 0;
  const normalCost = paidForceRevivalCost(
    { faction },
    amount - free,
    faction === 'ixians' ? elite - freeCyborgs : 0,
  );
  const factionCost =
    faction === 'choam' && !choamBlocked ? amount - free : normalCost;
  return {
    free,
    normalCost,
    cost: discount ? Math.ceil(factionCost / 2) : factionCost,
  };
}
