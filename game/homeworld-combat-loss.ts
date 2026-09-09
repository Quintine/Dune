import {
  HomeworldCustodyError,
  homeworldForceGroups,
  quoteHomeworldCustody,
  type HomeworldCustody,
  type HomeworldCustodyContext,
  type HomeworldForces,
  type HomeworldReserveSeat,
} from './homeworld-custody';

export type HomeworldCombatLossPlayer = HomeworldReserveSeat & {
  tanks: number;
  eliteTanks: number;
  battleLosses: number;
  /** Arrakis counters only; foreign Homeworld armies are held in custody. */
  boardForces: HomeworldForces;
};
export type HomeworldCombatLossContext = Omit<
  HomeworldCustodyContext,
  'players'
> & {
  players: readonly HomeworldCombatLossPlayer[];
};
export type HomeworldCombatLossRequest = {
  location: string;
  player: string;
  losses: HomeworldForces;
};
export class HomeworldCombatLossError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HomeworldCombatLossError';
  }
}
function requireLoss(condition: unknown, message: string): asserts condition {
  if (!condition) throw new HomeworldCombatLossError(message);
}
const whole = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
function typed(value: unknown): asserts value is HomeworldForces {
  requireLoss(
    !!value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      Object.keys(value).length === 2 &&
      Object.hasOwn(value, 'normal') &&
      Object.hasOwn(value, 'elite') &&
      whole((value as HomeworldForces).normal) &&
      whole((value as HomeworldForces).elite) &&
      (value as HomeworldForces).normal + (value as HomeworldForces).elite <=
        20,
    'Homeworld combat needs exact physical normal and special counter counts.',
  );
}
function conserved(
  context: HomeworldCombatLossContext,
  custody: HomeworldCustody,
) {
  const groups = homeworldForceGroups(context, custody);
  for (const player of context.players) {
    typed(player.boardForces);
    requireLoss(
      whole(player.tanks) &&
        player.tanks <= 20 &&
        whole(player.eliteTanks) &&
        player.eliteTanks <= player.tanks &&
        whole(player.battleLosses),
      'Homeworld combat needs valid Tanks and battle-loss totals.',
    );
    const visitors = groups.reduce(
      (sum, home) => {
        const pool =
          home.native !== player.id && Object.hasOwn(home.forces, player.id)
            ? home.forces[player.id]
            : { normal: 0, elite: 0 };
        return {
          normal: sum.normal + pool.normal,
          elite: sum.elite + pool.elite,
        };
      },
      { normal: 0, elite: 0 },
    );
    const supply =
      player.faction === 'emperor'
        ? 5
        : player.faction === 'fremen'
          ? 3
          : player.faction === 'ixians'
            ? 7
            : 0;
    requireLoss(
      player.reserves +
        player.tanks +
        player.boardForces.normal +
        player.boardForces.elite +
        visitors.normal +
        visitors.elite ===
        20 &&
        player.eliteReserves +
          player.eliteTanks +
          player.boardForces.elite +
          visitors.elite ===
          supply,
      'Homeworld combat must conserve all 20 physical counters and their special identities.',
    );
  }
}

/** Detached physical settlement only. The battle resolver authorizes the exact
 * casualty choice. Zero casualties are valid; printed strength never becomes
 * a counter, and no Arrakis force keys, occupation effects or payments occur. */
export function quoteHomeworldCombatLoss(
  context: HomeworldCombatLossContext,
  custody: HomeworldCustody,
  request: HomeworldCombatLossRequest,
) {
  try {
    conserved(context, custody);
    requireLoss(
      !!request && typeof request === 'object' && !Array.isArray(request),
      'Choose a Homeworld combat loss.',
    );
    typed(request.losses);
    const quote = quoteHomeworldCustody(context, custody, [
      {
        homeworld: request.location,
        player: request.player,
        withdraw: request.losses,
        deposit: { normal: 0, elite: 0 },
      },
    ]);
    const total = request.losses.normal + request.losses.elite;
    const players = context.players.map(
      (player, index): HomeworldCombatLossPlayer => ({
        ...quote.players[index],
        tanks: player.tanks + (player.id === request.player ? total : 0),
        eliteTanks:
          player.eliteTanks +
          (player.id === request.player ? request.losses.elite : 0),
        battleLosses:
          player.battleLosses + (player.id === request.player ? total : 0),
        boardForces: { ...player.boardForces },
      }),
    );
    conserved({ advanced: context.advanced, players }, quote.state);
    const receipt = quote.receipts[0];
    return {
      custody: quote.state,
      players,
      receipt: {
        location: receipt.homeworld,
        player: receipt.player,
        before: { ...receipt.before },
        after: { ...receipt.after },
        losses: { ...request.losses },
      },
    };
  } catch (error) {
    if (error instanceof HomeworldCustodyError)
      throw new HomeworldCombatLossError(error.message);
    throw error;
  }
}
