import type { Leader } from './cards';
import type { FactionId } from './catalog';
/** Original identity is permanent; capture temporarily overrides ghola control. */
export function controlsLeader(
  player: { id: string; faction: FactionId },
  leader: Leader,
) {
  if (leader.capturedBy) return leader.capturedBy === player.id;
  if (leader.gholaBy) return leader.gholaBy === player.id;
  if (leader.controller !== undefined) return leader.controller === player.id;
  return leader.faction === player.faction;
}
export function nativeAvailable(leader: Leader) {
  return !leader.dead && !leader.capturedBy && !leader.gholaBy;
}
