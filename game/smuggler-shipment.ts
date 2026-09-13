import type { Game, GameView } from './engine';
import { presenceAt } from './force-presence';

/** The amount is the entire physical shipment, including its one free companion. */
export type SmugglerShipment = { leader: string; amount: number };

/** Public leader custody and whole-territory presence suffice; no private hand is read. */
export function quoteSmugglerShipment(
  game: Game | GameView,
  player: string,
  territory: string,
  amount: number,
): SmugglerShipment | null {
  if (!Number.isSafeInteger(amount) || amount < 2) return null;
  // Classic Fremen reserves are on-planet; their normal reinforcement is not off-planet shipping.
  if (game.players.find((p) => p.id === player)?.faction === 'fremen')
    return null;
  const assignment = game.leaderSkills?.assignments.find(
    (a) => a.owner === player && a.skill === 'smuggler',
  );
  if (
    !assignment ||
    ('controller' in assignment && assignment.controller !== player) ||
    ('faceUp' in assignment && !assignment.faceUp)
  )
    return null;
  const leader = game.players
    .find((p) => p.id === player)
    ?.leaders.find((l) => l.id === assignment.leader);
  if (
    !leader ||
    leader.dead ||
    leader.capturedBy ||
    leader.gholaBy ||
    game.players.some((p) => presenceAt(p, territory) > 0)
  )
    return null;
  return { leader: leader.id, amount };
}
