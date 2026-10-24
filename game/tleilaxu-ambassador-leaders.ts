import type { Game, Player } from './engine';
import type { Leader } from './cards';
import { createDukeVidal, DUKE_VIDAL_ID } from './duke-vidal';
import { resolveEcazDukeRevival, type EcazDukeRevivalContext } from './ecaz-duke-revival';
import {
  quoteLeaderRevivalCohort, type LeaderRevivalCohortPlayer,
  type LeaderRevivalCohortQuote,
} from './revival';

type Context = Pick<Game, 'advanced'> & Partial<Omit<EcazDukeRevivalContext, 'advanced'>>;
type Beneficiary = Pick<Player, 'faction' | 'leaders' | 'kwisatz' | 'battleLosses'> &
  Partial<Pick<Player, 'id' | 'revivalCycle' | 'ecazRevivalCohort'>>;
export type TleilaxuAmbassadorLeaderChoice = {
  id: string; name: string; strength: number; destination?: 'setAside';
};
const dukeIdentity = createDukeVidal().leader;

/** Legacy identity-only callers retain their first-death grant. Repeated
 * returns need the actual seated owner's ordinary cohort, never invented facts
 * or the native Tleilaxu negotiated early-revival service. */
function ordinaryCohort(context: Context, player: Beneficiary): LeaderRevivalCohortQuote | null {
  if (typeof player.id !== 'string' || !Number.isSafeInteger(player.revivalCycle) ||
    player.revivalCycle! < 0 || context.status !== 'playing' ||
    !Number.isSafeInteger(context.turn) || context.turn! <= 0 ||
    !Array.isArray(context.players) ||
    !context.players.some(seated => seated.id === player.id && seated.faction === player.faction)) return null;
  try {
    return quoteLeaderRevivalCohort(context as EcazDukeRevivalContext, player as LeaderRevivalCohortPlayer);
  } catch {
    return null;
  }
}

const ownLeader = (player: Beneficiary, leader: Leader, cohort: LeaderRevivalCohortQuote | null) =>
  leader.id !== DUKE_VIDAL_ID && leader.faction === player.faction && leader.dead &&
  !leader.capturedBy && !leader.gholaBy &&
  Number.isSafeInteger(leader.deaths) &&
  (leader.deaths === 1 || (leader.deaths > 1 && !!cohort?.leaders.includes(leader.id)));

/** Snapshot an actually open ordinary cycle before an independent return
 * clears death. This does not waive a closed first cohort or mutate its owner. */
export function tleilaxuAmbassadorLeaderOpening(context: Context, player: Beneficiary): number | null {
  const cycle = ordinaryCohort(context, player)?.cycle;
  return cycle !== undefined && Number.isSafeInteger(cycle) && cycle > 0 ? cycle : null;
}

/** Duke's independent Ecaz-only permission retains its original death history.
 * Reuse native identity/custody validation, projecting every unavailable source
 * uniformly rather than exposing capture details or a profile-specific reason. */
function sharedDuke(context: Context, player: Beneficiary): boolean {
  if (player.faction !== 'ecaz' || typeof player.id !== 'string') return false;
  try {
    resolveEcazDukeRevival(context as EcazDukeRevivalContext, player.id);
    return true;
  } catch {
    return false;
  }
}

/** KH keeps its own next-cohort marker, never a sixth native disc. The first
 * return remains immediate; later returns need the actual ordinary cohort. */
function eligibleKwisatz(context: Context, player: Beneficiary): boolean {
  if (!context.advanced || player.faction !== 'atreides' || !(player.battleLosses >= 7) ||
      player.kwisatz?.dead !== true) return false;
  const marker = player.kwisatz.revivalCycle ?? 1;
  if (!Number.isSafeInteger(marker) || marker < 1) return false;
  if (marker === 1) return true;
  const cycle = tleilaxuAmbassadorLeaderOpening(context, player);
  return cycle !== null && cycle >= marker;
}

/** Return the actual own identity, never a foreign disc or a cloned physical leader. */
export function tleilaxuAmbassadorLeaderSelection(
  context: Context, player: Beneficiary, id: unknown,
): Leader | 'kwisatz' | typeof DUKE_VIDAL_ID | null {
  if (id === DUKE_VIDAL_ID) return sharedDuke(context, player) ? DUKE_VIDAL_ID : null;
  if (id === 'kwisatz') return eligibleKwisatz(context, player) ? 'kwisatz' : null;
  const cohort = ordinaryCohort(context, player);
  return player.leaders.find(leader => leader.id === id && ownLeader(player, leader, cohort)) ?? null;
}

export function tleilaxuAmbassadorLeaderChoices(
  context: Context, player: Beneficiary,
): TleilaxuAmbassadorLeaderChoice[] {
  const choices: TleilaxuAmbassadorLeaderChoice[] = [];
  const cohort = ordinaryCohort(context, player);
  for (const leader of player.leaders)
    if (ownLeader(player, leader, cohort)) choices.push({ id: leader.id, name: leader.name, strength: leader.strength });
  if (sharedDuke(context, player)) choices.push({
    id: DUKE_VIDAL_ID, name: dukeIdentity.name, strength: dukeIdentity.strength, destination: 'setAside',
  });
  if (eligibleKwisatz(context, player)) choices.push({ id: 'kwisatz', name: 'Kwisatz Haderach', strength: 2 });
  return choices;
}
