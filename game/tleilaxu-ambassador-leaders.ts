import type { Game, Player } from './engine';
import type { Leader } from './cards';

type Context = Pick<Game, 'advanced'>;
type Beneficiary = Pick<Player, 'faction' | 'leaders' | 'kwisatz' | 'battleLosses'>;
export type TleilaxuAmbassadorLeaderChoice = { id: string; name: string; strength: number };

const ownFirstDeath = (player: Beneficiary, leader: Leader) =>
  leader.faction === player.faction && leader.dead && leader.deaths === 1 &&
  !leader.capturedBy && !leader.gholaBy;

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
): Leader | 'kwisatz' | null {
  if (id === 'kwisatz') return firstKwisatz(context, player) ? 'kwisatz' : null;
  return player.leaders.find(leader => leader.id === id && ownFirstDeath(player, leader)) ?? null;
}

export function tleilaxuAmbassadorLeaderChoices(
  context: Context, player: Beneficiary,
): TleilaxuAmbassadorLeaderChoice[] {
  const choices: TleilaxuAmbassadorLeaderChoice[] = [];
  for (const leader of player.leaders)
    if (ownFirstDeath(player, leader)) choices.push({ id: leader.id, name: leader.name, strength: leader.strength });
  if (firstKwisatz(context, player)) choices.push({ id: 'kwisatz', name: 'Kwisatz Haderach', strength: 2 });
  return choices;
}
