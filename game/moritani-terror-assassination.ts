import {
  CHOAM_AUDITOR_ID,
  createAuditorLeader,
  leaders,
  type Leader,
} from './cards';
import { FACTIONS, type FactionId } from './catalog';
import {
  createDukeVidal,
  DUKE_VIDAL_ID,
  dukeController,
  type DukeState,
} from './duke-vidal';
import { controlsLeader } from './leader-control';

export type MoritaniTerrorAssassinationContext = Readonly<{
  players: readonly Readonly<{
    id: string;
    faction: FactionId;
    leaders: readonly Leader[];
  }>[];
  advanced?: boolean;
  dukeVidal?: Readonly<DukeState>;
}>;

// Identity metadata only: candidates always come from the actual server state.
const printed: Readonly<Record<string, Leader | undefined>> = Object.fromEntries(
  [
    ...FACTIONS.flatMap((faction) => leaders(faction.id)),
    createAuditorLeader(),
    createDukeVidal().leader,
  ].map((leader) => [leader.id, leader] as const),
);
const nativeIds: Readonly<Partial<Record<FactionId, readonly string[]>>> = Object.fromEntries(
  FACTIONS.map((faction) => [
    faction.id,
    leaders(faction.id).map((leader) => leader.id),
  ] as const),
);
function requirePool(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
function physical(leader: Leader): Leader {
  const original = printed[leader.id];
  requirePool(
    original && leader.name === original.name &&
      leader.faction === original.faction && leader.strength === original.strength &&
      typeof leader.dead === 'boolean' &&
      Number.isSafeInteger(leader.deaths) && leader.deaths >= 0 &&
      (leader.usedAt === undefined ||
        (typeof leader.usedAt === 'string' && !!leader.usedAt.trim())),
    'Terror Assassination requires an unaltered physical leader identity and history.',
  );
  return original;
}

/** Server-only provisional effective-control pool; never project or gate an offer on it.
 * Battle use does not remove a living disc. The caller alone draws, reveals and kills. */
export function moritaniTerrorAssassinationPool(
  g: MoritaniTerrorAssassinationContext,
  entrantId: string,
): Leader[] {
  const seats = new Map(g.players.map((player) => [player.id, player]));
  requirePool(
    seats.size === g.players.length &&
      g.players.every((player) => typeof player.id === 'string' && !!player.id.trim()) &&
      new Set(g.players.map((player) => player.faction)).size === g.players.length,
    'Terror Assassination requires unique native player custody.',
  );
  const entrant = seats.get(entrantId);
  requirePool(entrant, 'Terror Assassination requires the actual entrant.');
  const seen = new Set<string>();
  const pool: Leader[] = [];
  function custody(leader: Leader, owner: string | null) {
    physical(leader);
    requirePool(!seen.has(leader.id), 'Terror Assassination found a duplicated physical leader.');
    seen.add(leader.id);
    if (leader.gholaBy !== undefined)
      requirePool(
        g.advanced === true && leader.id !== DUKE_VIDAL_ID &&
          leader.id !== CHOAM_AUDITOR_ID && leader.gholaBy !== owner &&
          seats.get(leader.gholaBy)?.faction === 'tleilaxu',
        'Terror Assassination requires original foreign-Ghola custody; Duke revival is Ecaz-only.',
      );
    if (leader.capturedBy !== undefined)
      requirePool(
        g.advanced === true && leader.id !== CHOAM_AUDITOR_ID &&
          leader.capturedBy !== (leader.gholaBy ?? owner) &&
          seats.get(leader.capturedBy)?.faction === 'harkonnen',
        'Terror Assassination requires the actual native Harkonnen captor.',
      );
  }
  for (const player of g.players) {
    const ordinary = nativeIds[player.faction];
    const hasAuditor = player.leaders.some((leader) => leader.id === CHOAM_AUDITOR_ID);
    requirePool(
      ordinary?.length === 5 &&
        player.leaders.length === 5 + (hasAuditor ? 1 : 0) &&
        ordinary.every((id) => player.leaders.some((leader) => leader.id === id)) &&
        (!hasAuditor || (g.advanced === true && player.faction === 'choam')),
      'Terror Assassination requires the original five native discs and only the actual optional Auditor.',
    );
    for (const leader of player.leaders) {
      requirePool(
        leader.id !== DUKE_VIDAL_ID && leader.faction === player.faction &&
          (leader.controller === undefined || leader.controller === player.id),
        'Terror Assassination requires each disc in its original native roster.',
      );
      custody(leader, player.id);
      if (!leader.dead && controlsLeader(entrant, leader)) pool.push(leader);
    }
  }
  if (g.dukeVidal) {
    const duke = g.dukeVidal;
    requirePool(
      duke.leader.id === DUKE_VIDAL_ID &&
        (duke.leader.controller === undefined || duke.leader.controller === duke.controller) &&
        (duke.controller === null
          ? duke.acquiredTurn === null && duke.source === null
          : seats.has(duke.controller) && Number.isSafeInteger(duke.acquiredTurn) &&
            duke.acquiredTurn! > 0 &&
            ['moritani', 'ecaz', 'ecazNexus', 'ally'].includes(duke.source!)),
      'Terror Assassination requires the canonical separate shared Duke custody.',
    );
    custody(duke.leader, duke.controller);
    if (!duke.leader.dead && dukeController(duke) === entrantId) pool.push(duke.leader);
  }
  return pool;
}

/** Printed bounty, never Zoal's copied battle strength or a battle-skill bonus. */
export function moritaniTerrorAssassinationValue(leader: Leader): number {
  const original = physical(leader);
  if (original.id === 'tleilaxu-0') return 3;
  if (original.id === DUKE_VIDAL_ID) return 6;
  return original.strength;
}
