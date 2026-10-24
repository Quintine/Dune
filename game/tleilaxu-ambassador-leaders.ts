import type { Game, Player } from './engine';
import type { Leader } from './cards';
import { createDukeVidal, DUKE_VIDAL_ID } from './duke-vidal';
import { resolveEcazDukeRevival, type EcazDukeRevivalContext } from './ecaz-duke-revival';

type Context = Pick<Game, 'advanced'> & Partial<Omit<EcazDukeRevivalContext, 'advanced'>>;
type Beneficiary = Pick<Player, 'faction' | 'leaders' | 'kwisatz' | 'battleLosses'> & Partial<Pick<Player, 'id'>>;
export type TleilaxuAmbassadorLeaderChoice = {
  id: string; name: string; strength: number; destination?: 'setAside';
};
const dukeIdentity = createDukeVidal().leader;

const ownFirstDeath = (player: Beneficiary, leader: Leader) =>
  leader.id !== DUKE_VIDAL_ID && leader.faction === player.faction && leader.dead && leader.deaths === 1 &&
  !leader.capturedBy && !leader.gholaBy;

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

/** Base p17 revives KH like a leader without adding it to the ordinary roster.
 * Native KH death records start at cycle1; every existing return advances that
 * marker. Repeat-return/ordinary-quota interpretation remains outside this grant. */
function firstKwisatz(context: Context, player: Beneficiary): boolean {
  return context.advanced && player.faction === 'atreides' && player.battleLosses >= 7 &&
    player.kwisatz?.dead === true && (player.kwisatz.revivalCycle ?? 1) === 1;
}

/** Return the actual own identity, never a foreign disc or a cloned physical leader. */
export function tleilaxuAmbassadorLeaderSelection(
  context: Context, player: Beneficiary, id: unknown,
): Leader | 'kwisatz' | typeof DUKE_VIDAL_ID | null {
  if (id === DUKE_VIDAL_ID) return sharedDuke(context, player) ? DUKE_VIDAL_ID : null;
  if (id === 'kwisatz') return firstKwisatz(context, player) ? 'kwisatz' : null;
  return player.leaders.find(leader => leader.id === id && ownFirstDeath(player, leader)) ?? null;
}

export function tleilaxuAmbassadorLeaderChoices(
  context: Context, player: Beneficiary,
): TleilaxuAmbassadorLeaderChoice[] {
  const choices: TleilaxuAmbassadorLeaderChoice[] = [];
  for (const leader of player.leaders)
    if (ownFirstDeath(player, leader)) choices.push({ id: leader.id, name: leader.name, strength: leader.strength });
  if (sharedDuke(context, player)) choices.push({
    id: DUKE_VIDAL_ID, name: dukeIdentity.name, strength: dukeIdentity.strength, destination: 'setAside',
  });
  if (firstKwisatz(context, player)) choices.push({ id: 'kwisatz', name: 'Kwisatz Haderach', strength: 2 });
  return choices;
}
