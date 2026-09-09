import {
  HomeworldCustodyError,
  quoteHomeworldCustody,
  type HomeworldCustody,
  type HomeworldCustodyContext,
  type HomeworldForces,
} from './homeworld-custody';
import { homeworldPopulations } from './homeworld-population';

export type EmperorHomeworld = 'homeworld:emperor' | 'homeworld:emperor:salusa';
export type EmperorHomeworldMoveContext = HomeworldCustodyContext & {
  status: 'lobby' | 'setup' | 'playing' | 'finished';
  phase: number;
  currentPlayer: string | null;
  /** Remaining complete movements, including a legally granted Hajr movement.
   * The caller owns control/overlay eligibility and the authoritative budget. */
  movesLeft: number;
};
export type EmperorHomeworldMove = {
  origin: EmperorHomeworld;
  forces: HomeworldForces;
};
export class EmperorHomeworldMoveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EmperorHomeworldMoveError';
  }
}
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const whole = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
function requireMove(condition: unknown, message: string): asserts condition {
  if (!condition) throw new EmperorHomeworldMoveError(message);
}

/** E3 p.10 permits this transfer as Emperor's movement. It is Homeworld module
 * permission, immune to Karama; no ordinary faction-cancellation flag is read.
 * Hajr obeys own-turn movement timing (November 2020 FAQ p.8) and supplies an
 * additional movement, not a separate once-per-turn transfer entitlement.
 *
 * This quote commits nothing: no shipment, charge, phase/queue change, arrival
 * effect, occupation entitlement or random event is produced. */
export function quoteEmperorHomeworldMove(
  context: EmperorHomeworldMoveContext,
  custody: HomeworldCustody,
  actor: string,
  order: EmperorHomeworldMove,
) {
  requireMove(
    record(context) &&
      context.status === 'playing' &&
      context.advanced === true &&
      context.phase === 5 &&
      typeof actor === 'string' &&
      actor.trim().length > 0 &&
      context.currentPlayer === actor &&
      whole(context.movesLeft) &&
      context.movesLeft > 0,
    'Emperor Homeworld movement requires an unused movement during the active Advanced Shipment and Movement turn.',
  );
  requireMove(
    record(order) &&
      Object.keys(order).length === 2 &&
      (order.origin === 'homeworld:emperor' ||
        order.origin === 'homeworld:emperor:salusa') &&
      record(order.forces) &&
      Object.keys(order.forces).length === 2 &&
      whole(order.forces.normal) &&
      whole(order.forces.elite) &&
      Number.isSafeInteger(order.forces.normal + order.forces.elite) &&
      order.forces.normal + order.forces.elite > 0 &&
      order.forces.normal + order.forces.elite <= 20,
    'Choose a positive typed force group from Kaitain or Salusa Secundus.',
  );
  try {
    // Shared projection validates the entire public physical roster and custody.
    const before = homeworldPopulations(context, custody);
    const emperor = context.players.find((p) => p.id === actor);
    requireMove(
      emperor?.faction === 'emperor',
      'Only the seated Emperor can move between its Homeworlds.',
    );
    const origin: EmperorHomeworld = order.origin;
    const destination: EmperorHomeworld =
      origin === 'homeworld:emperor'
        ? 'homeworld:emperor:salusa'
        : 'homeworld:emperor';
    const forces = { normal: order.forces.normal, elite: order.forces.elite };
    const transferred = quoteHomeworldCustody(context, custody, [
      {
        homeworld: origin,
        player: actor,
        withdraw: forces,
        deposit: { normal: 0, elite: 0 },
      },
      {
        homeworld: destination,
        player: actor,
        withdraw: { normal: 0, elite: 0 },
        deposit: forces,
      },
    ]);
    // A move redistributes the existing native reserve total. It cannot create
    // an additional native pool or consume somebody else's visitor counters.
    requireMove(
      transferred.players.every((seat) => {
        const original = context.players.find((p) => p.id === seat.id)!;
        return (
          seat.reserves === original.reserves &&
          seat.eliteReserves === original.eliteReserves
        );
      }),
      'Emperor Homeworld movement must preserve every native reserve total.',
    );
    const after = homeworldPopulations(
      { advanced: context.advanced, players: transferred.players },
      transferred.state,
    );
    return {
      player: actor,
      origin,
      destination,
      forces,
      movementSpent: 1 as const,
      movesLeft: context.movesLeft - 1,
      players: transferred.players,
      state: transferred.state,
      receipts: transferred.receipts,
      populations: { before, after },
    };
  } catch (error) {
    if (error instanceof HomeworldCustodyError)
      throw new EmperorHomeworldMoveError(error.message);
    throw error;
  }
}
