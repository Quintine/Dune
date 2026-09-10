import type { Action, GameView } from './engine';
import { ordinaryCardAvailability } from './card-availability';

function owner(g: GameView) {
  return g.players.find((p) => p.id === g.me);
}
function quiet(g: GameView) {
  return (
    g.status === 'playing' &&
    g.phase === 5 &&
    g.active === g.me &&
    !g.response &&
    !g.decision &&
    !g.truthtrance &&
    !g.phaseOpening &&
    !g.automaticContinuationPending &&
    !g.nexusCards?.waiting.length &&
    !g.nexusTraitors?.pending
  );
}
export function nexusGuildCunningActive(g: GameView) {
  if (owner(g)?.faction !== 'guild' || g.phase !== 5 || g.active !== g.me)
    return null;
  const active = g.nexusGuildCunning?.active;
  return active?.event === JSON.stringify(['nexusGuildCunning', g.turn, g.me])
    ? active
    : null;
}

/** The original shipped flag remains physical turn history. */
export function nexusGuildShipmentAvailable(g: GameView): boolean {
  const me = owner(g);
  if (!me || !quiet(g)) return false;
  const active = nexusGuildCunningActive(g);
  if (me.faction === 'guild' && g.nexusGuildCunning?.active && !active)
    return false;
  return active ? active.stage === 'secondShipment' : !me.shipped;
}
export function nexusGuildMovementAvailable(g: GameView): boolean {
  const me = owner(g);
  if (!me || !quiet(g)) return false;
  const active = nexusGuildCunningActive(g);
  if (me.faction === 'guild' && g.nexusGuildCunning?.active && !active)
    return false;
  return active
    ? active.stage === 'extraMove' && active.movesLeft > 0
    : (me.moved ?? 0) < (me.movesAllowed ?? 1);
}
export function nexusGuildCunningAction(
  g: GameView,
  event: string,
): Action | null {
  const me = owner(g);
  if (
    !quiet(g) ||
    me?.faction !== 'guild' ||
    me.ally ||
    g.nexusCards?.card !== 'guild'
  )
    return null;
  const offer = g.nexusGuildCunning?.offer;
  if (
    !offer ||
    offer.blocked ||
    g.nexusGuildCunning?.active ||
    event !== offer.event ||
    event !== JSON.stringify(['nexusGuildCunning', g.turn, g.me])
  )
    return null;
  return { type: 'endMovement', nexus: event };
}

/** Only the unused Hajr exception can prepare movement after the second shipment. */
export function nexusGuildHajrAction(g: GameView): Action | null {
  const active = nexusGuildCunningActive(g);
  if (
    !quiet(g) ||
    active?.stage !== 'extraMove' ||
    active.movesLeft > 0 ||
    !active.hajrAvailable
  )
    return null;
  const card = owner(g)?.hand?.find(
    (c) => c.effect === 'hajr' && ordinaryCardAvailability(g, c.id)?.available,
  );
  return card ? { type: 'card', card: card.id } : null;
}

/** Passing this extra shipment preserves the separate unused Hajr choice. */
export function nexusGuildSkipShipmentAction(
  g: GameView,
  event: string,
): Action | null {
  const active = nexusGuildCunningActive(g);
  if (!quiet(g) || active?.stage !== 'secondShipment' || active.event !== event)
    return null;
  return { type: 'nexusGuildSkipShipment', event };
}
