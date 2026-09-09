import type { Game, Player } from './engine';
import { faction, type FactionId } from './catalog';
import { isAuditorLeader } from './choam-auditor';
import { homeworldLowBonus } from './homeworld-benefits';
type RevivalRateContext = Pick<
  Game,
  'advanced' | 'players' | 'homeworlds' | 'revivalRules' | 'freeRevival'
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
  p: Pick<Player, 'id' | 'faction'>,
) {
  return Math.max(forceRevivalLimit(g, p), freeRevivalRate(g, p));
}
export function freeRevivalRemaining(
  g: RevivalRateContext,
  p: Pick<Player, 'id' | 'faction' | 'revived'>,
) {
  return Math.max(0, freeRevivalRate(g, p) - p.revived);
}
export function forceRevivalQuote(
  g: RevivalRateContext,
  p: Pick<Player, 'id' | 'faction' | 'revived'>,
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
  p: Pick<Player, 'id' | 'faction' | 'revived' | 'tanks'>,
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
  p: Pick<Player, 'leaders' | 'revivalCycle'>,
) {
  return p.leaders.every((l) => l.dead || l.capturedBy || l.gholaBy)
    ? Math.min(...p.leaders.map((l) => (l.dead ? l.deaths : l.deaths + 1)))
    : p.revivalCycle;
}

/** Native leader options for the existing ordinary cycle and Tleilaxu self-service.
 * Shared discs are deliberately separate: Ecaz's six-disc cycle is not implemented here.
 * This is a pure quote; committing an action, not reading a view, advances the cycle.
 */
export function leaderRevivalOptions(g: Game, p: Player) {
  const cycle = normalRevivalCycle(p);
  const enabled = g.phase === 4 && !revivalPrevented(g, p.id);
  const discount = revivalDiscount(g, p);
  const leaders = p.leaders.flatMap((leader) => {
    if (!enabled || !leader.dead || leader.capturedBy || leader.gholaBy)
      return [];
    // Auditor's first return expressly waives the all-in-Tanks prerequisite.
    // Repeat-death and sixth-disc cycle interpretations remain separately unverified.
    const auditorFirstReturn =
      g.advanced &&
      p.faction === 'choam' &&
      isAuditorLeader(leader) &&
      leader.deaths === 1;
    const normal =
      !p.leaderRevived &&
      (auditorFirstReturn || (cycle > 0 && leader.deaths === cycle));
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
  return { cycle, leaders, kwisatz };
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
