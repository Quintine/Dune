import {
  HomeworldCombatLossError,
  quoteHomeworldCombatLoss,
  type HomeworldCombatLossContext,
} from './homeworld-combat-loss';
import {
  HomeworldCustodyError,
  quoteHomeworldCustody,
  type HomeworldCustody,
} from './homeworld-custody';

export type HomeworldSubstitutionRequest = {
  location: string;
  player: string;
  amount: number;
  /** Bound to the resolved battle by the caller, never all historical deaths. */
  cyborgsLost: number;
};
export class HomeworldSubstitutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HomeworldSubstitutionError';
  }
}
function requireSubstitution(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) throw new HomeworldSubstitutionError(message);
}

/** Exact post-casualty exchange. Event identity, declaration timing and Karama
 * permission are caller-owned. The lost Cyborgs stay at this battle location;
 * surviving Suboids take their place in the Tanks, without revival or transport. */
export function quoteHomeworldSubstitution(
  context: HomeworldCombatLossContext,
  custody: HomeworldCustody,
  request: HomeworldSubstitutionRequest,
) {
  try {
    requireSubstitution(
      !!request &&
        typeof request === 'object' &&
        !Array.isArray(request) &&
        Number.isSafeInteger(request.amount) &&
        request.amount > 0 &&
        Number.isSafeInteger(request.cyborgsLost) &&
        request.cyborgsLost <= 7 &&
        request.amount <= request.cyborgsLost,
      'Exchange a positive number of Suboids for Cyborgs lost in this battle.',
    );
    // A zero loss validates the entire physical inventory and detaches custody
    // without temporarily increasing an accumulated battle-loss counter.
    const before = quoteHomeworldCombatLoss(context, custody, {
      location: request.location,
      player: request.player,
      losses: { normal: 0, elite: 0 },
    });
    const owner = before.players.find(
      (player) => player.id === request.player,
    )!;
    requireSubstitution(
      owner.faction === 'ixians' &&
        owner.eliteTanks >= request.cyborgsLost &&
        owner.battleLosses >= request.cyborgsLost &&
        before.receipt.before.normal >= request.amount,
      'Use surviving Ixian Suboids here and the Cyborg casualties of this battle.',
    );
    const exchange = quoteHomeworldCustody(
      { advanced: context.advanced, players: before.players },
      before.custody,
      [
        {
          homeworld: request.location,
          player: request.player,
          withdraw: { normal: request.amount, elite: 0 },
          deposit: { normal: 0, elite: request.amount },
        },
      ],
    );
    const players = before.players.map((player, index) => ({
      ...player,
      ...exchange.players[index],
      eliteTanks:
        player.eliteTanks - (player.id === request.player ? request.amount : 0),
    }));
    const after = quoteHomeworldCombatLoss(
      { advanced: context.advanced, players },
      exchange.state,
      {
        location: request.location,
        player: request.player,
        losses: { normal: 0, elite: 0 },
      },
    );
    return {
      custody: after.custody,
      players: after.players,
      receipt: {
        location: request.location,
        player: request.player,
        amount: request.amount,
        cyborgsLost: request.cyborgsLost,
        before: { ...before.receipt.before },
        after: { ...after.receipt.after },
      },
    };
  } catch (error) {
    if (
      error instanceof HomeworldCustodyError ||
      error instanceof HomeworldCombatLossError
    )
      throw new HomeworldSubstitutionError(error.message);
    throw error;
  }
}
