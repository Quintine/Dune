import type { Game, Player } from './engine';
import type { Leader } from './cards';
import { DUKE_VIDAL_ID, type DukeState } from './duke-vidal';

export const DUKE_REVIVAL_NORMAL_COST = 5 as const;
export type EcazDukeRevivalContext = {
  status: Game['status'];
  turn: number;
  advanced: boolean;
  players: readonly (Pick<Player, 'id' | 'faction'> & {
    leaders: readonly Pick<Leader, 'id'>[];
  })[];
  dukeVidal?: DukeState;
};
export type EcazDukeRevivalSource = {
  source: 'sharedDuke';
  player: string;
  leader: typeof DUKE_VIDAL_ID;
  normalCost: typeof DUKE_REVIVAL_NORMAL_COST;
  /** The original dead disc, detached for inspection. This is NOT a revival outcome. */
  duke: DukeState;
};
export type EcazDukeRevivalQuote = EcazDukeRevivalSource & {
  cost: 3 | 5;
  discounted: boolean;
};
export type EcazDukeRevivalFailure =
  | 'context'
  | 'owner'
  | 'table'
  | 'custody'
  | 'price';
const unavailable = 'Duke Vidal is unavailable for this revival.';
const tableBlock =
  'Duke Vidal revival with Advanced Harkonnen is still being implemented.';
export class EcazDukeRevivalError extends Error {
  constructor(
    message: string,
    readonly reason: EcazDukeRevivalFailure = 'custody',
  ) {
    super(message);
    this.name = 'EcazDukeRevivalError';
  }
}
function requireDuke(
  condition: unknown,
  reason: EcazDukeRevivalFailure = 'custody',
): asserts condition {
  if (!condition)
    throw new EcazDukeRevivalError(
      reason === 'table' ? tableBlock : unavailable,
      reason,
    );
}
const whole = (n: unknown): n is number =>
  Number.isSafeInteger(n) && (n as number) >= 0;

/** E3 pp.8–9: the same shared Ecaz disc costs five to revive, irrespective
 * of native dead-leader count, and only Ecaz may revive it (including Ghola).
 * This validates existing identity/custody only. It neither revives nor assigns
 * a future controller, advances a cycle, spends a slot, or authorizes a window. */
export function resolveEcazDukeRevival(
  g: EcazDukeRevivalContext,
  ownerId: string,
): EcazDukeRevivalSource {
  requireDuke(
    g.status === 'playing' &&
      whole(g.turn) &&
      g.turn > 0 &&
      typeof g.advanced === 'boolean' &&
      Array.isArray(g.players) &&
      g.players.every(
        (p) => p && typeof p.id === 'string' && p.id.length > 0,
      ) &&
      new Set(g.players.map((p) => p.id)).size === g.players.length,
    'context',
  );
  requireDuke(
    typeof ownerId === 'string' &&
      g.players.filter((p) => p.faction === 'ecaz').length === 1 &&
      g.players.some((p) => p.id === ownerId && p.faction === 'ecaz'),
    'owner',
  );
  requireDuke(
    !(g.advanced && g.players.some((p) => p.faction === 'harkonnen')),
    'table',
  );
  const duke = g.dukeVidal;
  requireDuke(
    duke &&
      typeof duke === 'object' &&
      !Array.isArray(duke) &&
      duke.leader &&
      typeof duke.leader === 'object' &&
      !Array.isArray(duke.leader),
  );
  const leader = duke.leader;
  requireDuke(
    leader.id === DUKE_VIDAL_ID &&
      leader.faction === 'ecaz' &&
      leader.strength === 6 &&
      typeof leader.name === 'string' &&
      leader.name.length > 0 &&
      leader.dead === true &&
      whole(leader.deaths) &&
      leader.deaths > 0 &&
      (leader.usedAt === undefined ||
        (typeof leader.usedAt === 'string' && leader.usedAt.length > 0)) &&
      leader.capturedBy === undefined &&
      leader.gholaBy === undefined &&
      leader.concealed === undefined,
  );
  requireDuke(
    g.players.every(
      (p) =>
        Array.isArray(p.leaders) &&
        p.leaders.every(
          (l: Pick<Leader, 'id'>) =>
            l && typeof l.id === 'string' && l.id !== DUKE_VIDAL_ID,
        ),
    ),
  );
  requireDuke(
    duke.controller === null
      ? duke.acquiredTurn === null && duke.source === null
      : typeof duke.controller === 'string' &&
          g.players.some((p) => p.id === duke.controller) &&
          whole(duke.acquiredTurn) &&
          duke.acquiredTurn > 0 &&
          duke.acquiredTurn <= g.turn &&
          ['ecaz', 'moritani', 'ally'].includes(duke.source!),
  );
  return {
    source: 'sharedDuke',
    player: ownerId,
    leader: DUKE_VIDAL_ID,
    normalCost: DUKE_REVIVAL_NORMAL_COST,
    duke: structuredClone(duke),
  };
}
/** The caller supplies revivalDiscount(g, owner) for a NEW paid quote.
 * Keeping that calculation outside this module permits revival.ts to reuse
 * the resolver without an import cycle. Saved quotes must never be repriced
 * merely because a current discount has changed. Ghola uses the resolver only. */
export function quoteEcazDukeRevival(
  g: EcazDukeRevivalContext,
  ownerId: string,
  discounted: boolean,
): EcazDukeRevivalQuote {
  const source = resolveEcazDukeRevival(g, ownerId);
  requireDuke(typeof discounted === 'boolean', 'price');
  return { ...source, cost: discounted ? 3 : 5, discounted };
}
/** No exceptional hidden custody detail appears in the projected explanation. */
export function ecazDukeRevivalBlock(
  g: EcazDukeRevivalContext,
  ownerId: string,
): string | null {
  try {
    resolveEcazDukeRevival(g, ownerId);
    return null;
  } catch (error) {
    return error instanceof EcazDukeRevivalError && error.reason === 'table'
      ? tableBlock
      : unavailable;
  }
}
