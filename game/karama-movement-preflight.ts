import type { FactionId } from './catalog';
import { fighterCount } from './advisors';
import { canTriggerAmbassador, type AmbassadorToken } from './ecaz-ambassadors';
import type { ForcePresence } from './force-presence';
import type { TerrorToken } from './moritani-terror';
import type { OrnithopterMode } from './ornithopter';

export class MovementArrivalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MovementArrivalError';
  }
}

export type MovementArrivalPlayer = Readonly<
  ForcePresence & {
    id: string;
    faction: FactionId;
    ally: string | null;
    advisors?: Readonly<Record<string, { lockedTurn?: number }>>;
  }
>;

export type CompletedMovementArrivalInput = Readonly<{
  advanced: boolean;
  players: readonly MovementArrivalPlayer[];
  order: Readonly<{
    player: string;
    origin: string;
    to: string;
    advisors: boolean;
    wantsFighters: boolean;
  }>;
  ambassadors: readonly Readonly<
    Pick<AmbassadorToken, 'zone' | 'location' | 'effect'>
  >[];
  terror: readonly Readonly<Pick<TerrorToken, 'status' | 'location'>>[];
  /** Controls that will remain after the canceled parent is cleared. */
  controls: Readonly<{
    response: boolean;
    decision: boolean;
    pendingTerror: boolean;
    pendingAmbassador: boolean;
    paidBox: boolean;
  }>;
  /** Current flight, before this validated move increments completed. */
  flight?: Readonly<{
    player: string;
    mode: OrnithopterMode;
    completed: number;
  }> | null;
}>;

export type CompletedMovementArrivalQuote = Readonly<{
  intrusion: boolean;
  reaction: 'ambassador' | 'terror' | null;
  retiresOrnithopter: boolean;
}>;

/**
 * Pure guards for a validated move's resulting arrival, before any forces move.
 * The caller owns order/route/flight/cohort/marker/promise validation. An order
 * rejected by resumeChoamMovement's existing catch is an accepted no-move and
 * must not reach this helper. This does not settle controls, create events,
 * traverse storms/worms, or preview effects on a cloned game.
 */
export function quoteCompletedMovementArrival(
  input: CompletedMovementArrivalInput,
): CompletedMovementArrivalQuote {
  const { order, controls, flight, players } = input;
  const entrant = players.find((p) => p.id === order.player);
  if (!entrant)
    throw new MovementArrivalError('You are not seated at this table.');
  const retiresOrnithopter =
    !!flight &&
    flight.player === entrant.id &&
    flight.completed + 1 === (flight.mode === 'twoGroups' ? 2 : 1);
  if (retiresOrnithopter && controls.paidBox)
    throw new MovementArrivalError(
      'Finish the paid search before completing the movement card.',
    );

  // Only the mover changes stance. Another BG faction's current fighters are
  // untouched, so this is exactly intrusion() without placing or flipping.
  const bg = players.find((p) => p.faction === 'beneGesserit');
  const intrusion = !!(
    input.advanced &&
    bg &&
    bg.id !== entrant.id &&
    fighterCount(bg, order.to)
  );
  const base = { intrusion, retiresOrnithopter };
  // Intrusion also runs between sectors of one territory; entry does not.
  if (order.origin === order.to) return { ...base, reaction: null };

  const ecaz = players.find((p) => p.faction === 'ecaz');
  const ambassador = input.ambassadors.find(
    (t) => t.zone === 'placed' && t.location === order.to,
  );
  const triggersAmbassador = !!(
    ecaz &&
    ambassador &&
    canTriggerAmbassador({
      owner: ecaz.id,
      ally: ecaz.ally,
      entrant: entrant.id,
      entrantFaction: entrant.faction,
      advisors: entrant.faction === 'beneGesserit' && order.advisors,
      effect: ambassador.effect,
    })
  );
  const moritani = players.find((p) => p.faction === 'moritani');
  const triggersTerror = !!(
    moritani &&
    entrant.id !== moritani.id &&
    entrant.id !== moritani.ally &&
    input.terror.some((t) => t.status === 'placed' && t.location === order.to)
  );
  const response = controls.response || order.wantsFighters;
  const decision = controls.decision || intrusion;
  if (triggersAmbassador) {
    if (
      response ||
      decision ||
      controls.pendingTerror ||
      controls.pendingAmbassador ||
      triggersTerror
    )
      throw new MovementArrivalError(
        'Ambassadors combined with another arrival reaction are still being implemented. This entry has not been committed.',
      );
    return { ...base, reaction: 'ambassador' };
  }
  if (triggersTerror) {
    if (controls.pendingTerror)
      throw new MovementArrivalError('Resolve the pending Terror entry first.');
    if (response || decision)
      throw new MovementArrivalError(
        'Terror combined with another arrival reaction is still being implemented. This entry has not been committed.',
      );
    return { ...base, reaction: 'terror' };
  }
  return { ...base, reaction: null };
}
