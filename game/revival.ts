import type { Game, Player } from './engine';
import { faction, type FactionId } from './catalog';
import { isAuditorLeader } from './choam-auditor';
import { homeworldLowBonus } from './homeworld-benefits';
import { recruitsRevivalAllowance } from './recruits';
import { DUKE_VIDAL_ID } from './duke-vidal';
import { ecazDukeRevivalBlock, quoteEcazDukeRevival } from './ecaz-duke-revival';
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
  choamBlocked?: boolean;
  freeBlocked?: string[];
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
  return recruitsRevivalAllowance(g, {
    currentFreeRate,
    currentLimit: Math.max(forceRevivalLimit(g, p), currentFreeRate),
    revived: p.revived,
    // A Recruits activation is rejected when this ledger is absent and use is
    // nonzero. The fallback preserves old-room behavior while the card is idle.
    freeAllowanceUsed:
      g.recruits?.turn === g.turn ? (p.freeForcesRevived ?? p.revived) : p.revived,
    freeRateCap: 20,
  });
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

/** The five-disc Ecaz opening is recorded in revivalCycle on the first
 * accepted ordinary return. Later six-disc cohorts are not established by E3:
 * keep their native returns gated rather than guessing from death counters. */
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
    | 'leaderRevived'
    | 'spice'
    | 'kwisatz'
  >,
) {
  const shared = p.faction === 'ecaz' && g.dukeVidal;
  const dukeContext = shared && g.status === 'playing' ? g : null;
  const dukeBlocked = dukeContext ? ecazDukeRevivalBlock(dukeContext, p.id) : null;
  const dukeAvailable = !!dukeContext && !dukeBlocked;
  const repeatHistory = !!shared &&
    (g.dukeVidal!.leader.deaths > 1 || p.leaders.some((l) => l.deaths > 1) ||
      p.revivalCycle > 1);
  const firstOpening = !!shared && !repeatHistory &&
    (p.leaders.filter((l) => l.dead && !l.capturedBy && !l.gholaBy && l.deaths === 1).length +
      (g.dukeVidal!.leader.dead && dukeAvailable &&
      g.dukeVidal!.leader.deaths === 1 ? 1 : 0) >= 5 ||
      p.leaders.every((l) => l.dead || l.capturedBy || l.gholaBy));
  const cycle = shared
    ? (!repeatHistory && (p.revivalCycle === 1 || firstOpening) ? 1 : 0)
    : normalRevivalCycle(p);
  const enabled = g.phase === 4 && !revivalPrevented(g, p.id);
  const discount = revivalDiscount(g, p);
  const leaders = p.leaders.flatMap((leader) => {
    if (!enabled || !leader.dead || leader.capturedBy || leader.gholaBy)
      return [];
    // Supplied Advanced p29 E permits Auditor revival each turn regardless
    // of the other leaders in Tanks; retain the ordinary one-leader allowance.
    const auditorReturn =
      g.advanced &&
      p.faction === 'choam' &&
      isAuditorLeader(leader);
    const normal =
      !p.leaderRevived &&
      (auditorReturn || (cycle > 0 && leader.deaths === cycle));
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
    const quote = quoteEcazDukeRevival(dukeContext!, p.id, !!discount);
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
    cycleBlock: repeatHistory
      ? 'Ecaz six-disc repeated revival cycles are not yet resolved.' : null };
}
export type PendingRevival = {
  player: string;
  kind: 'forces' | 'leader' | 'kwisatz' | 'foreignGhola';
  payer?: string;
  emperorExtra?: boolean;
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
