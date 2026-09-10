import { terrorEntryLocationAllowed, type TerrorLocationContext } from './terror-location';
import {
  validateGuildAmbassadorArrivalContext,
  GuildAmbassadorContinuationError,
} from './guild-ambassador-continuation';
import type { Game, ResponseWindow } from './engine';
import { validLocation } from './board';
import {
  validateAmbassadorRelocationContext,
  MovementCancellationError,
} from './karama-movement-cancellation';
import { TERROR_KINDS } from './moritani-terror';
import { validateTerrorEntrySignature } from './terror-entry-receipt';

export class MoritaniAllianceCancellationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MoritaniAllianceCancellationError';
  }
}
export type MoritaniAllianceCancellationContext = Pick<
  Game,
  | 'status'
  | 'turn'
  | 'phase'
  | 'players'
  | 'pendingTerrorEntry'
  | 'moritaniTerror'
  | 'pendingAmbassador'
  | 'ecazAmbassadors'
> & TerrorLocationContext;
export type MoritaniAllianceCancellationQuote = {
  kind: 'moritaniAlliance';
  owner: string;
  entry: NonNullable<Game['pendingTerrorEntry']> & {
    stage: 'offer';
    allianceBlocked: true;
  };
  decision: {
    kind: 'moritaniTerror';
    player: string;
    entrant: string;
    territory: string;
  };
};
function requireSource(condition: unknown, message: string): asserts condition {
  if (!condition) throw new MoritaniAllianceCancellationError(message);
}
const whole = (n: unknown): n is number =>
  Number.isSafeInteger(n) && (n as number) >= 0;

/** Prove only cancellation's return to the existing hidden-token choice.
 * Do not replay entry, form an alliance, reveal/return a token, or pre-accept
 * its future effect. Board occupation, resources and leader custody can change
 * during an interruption without changing the original entry receipt. */
export function quoteMoritaniAllianceCancellation(
  g: MoritaniAllianceCancellationContext,
  response: ResponseWindow,
): MoritaniAllianceCancellationQuote | null {
  if (response.kind !== 'moritaniAlliance') return null;
  requireSource(
    g.status === 'playing' &&
      whole(g.turn) &&
      g.turn > 0 &&
      Array.isArray(g.players),
    'Enemy of My Enemy cancellation needs its current active game.',
  );
  const owners = g.players.filter((p) => p.id === response.owner);
  requireSource(
    owners.length === 1 &&
      owners[0].faction === 'moritani' &&
      g.players.filter((p) => p.faction === 'moritani').length === 1,
    'Enemy of My Enemy cancellation needs its seated Moritani owner.',
  );
  const entry = g.pendingTerrorEntry;
  requireSource(
    entry &&
      entry.stage === 'allianceResponse' &&
      entry.turn === g.turn &&
      entry.phase === g.phase &&
      (entry.allianceBlocked === undefined || entry.allianceBlocked === false),
    'This Enemy of My Enemy opportunity is no longer current.',
  );
  const entrants = g.players.filter((p) => p.id === entry.entrant);
  try {
    validateTerrorEntrySignature(entry);
  } catch (error) {
    throw new MoritaniAllianceCancellationError((error as Error).message);
  }
  requireSource(
    entrants.length === 1 &&
      entrants[0].id !== response.owner &&
      entrants[0].faction !== 'ecaz',
    'The alliance opportunity needs its original opposing entrant.',
  );
  requireSource(
    typeof entry.territory === 'string' &&
      terrorEntryLocationAllowed(g,entry) &&
      whole(entry.sector) &&
      validLocation(entry.territory, entry.sector) &&
      whole(entry.amount) &&
      whole(entry.elite) &&
      entry.elite <= entry.amount,
    'The alliance opportunity has an invalid original territory or entry amount.',
  );
  if (entry.cause === 'ambassador') {
    if (g.pendingAmbassador?.effect === 'guild') {
      try {
        const next = g.pendingAmbassador.shipmentReceipt?.next;
        requireSource(
          next === 'accompany' || next === 'finish',
          'The Guild Ambassador Terror child has an invalid continuation.',
        );
        const receipt = validateGuildAmbassadorArrivalContext(
          g,
          entry.ambassadorEvent,
          next,
        );
        const arrival =
          next === 'finish' ? receipt.advisorArrival! : receipt.order;
        requireSource(
          entry.resume === 'ambassador' &&
            entry.entrant === arrival.player &&
            entry.territory === arrival.territory &&
            entry.sector === arrival.sector &&
            entry.amount === arrival.amount &&
            entry.elite === arrival.elite,
          'The alliance opportunity does not match its Guild Ambassador arrival.',
        );
      } catch (error) {
        if (error instanceof GuildAmbassadorContinuationError)
          throw new MoritaniAllianceCancellationError(error.message);
        throw error;
      }
    } else {
      let order;
      try {
        order = validateAmbassadorRelocationContext(
          g,
          entry.ambassadorEvent,
          'finish',
        );
      } catch (error) {
        if (error instanceof MovementCancellationError)
          throw new MoritaniAllianceCancellationError(error.message);
        throw error;
      }
      requireSource(
        entry.resume === 'ambassador' &&
          entry.entrant === order.player &&
          entry.territory === order.to &&
          entry.sector === order.sector &&
          entry.amount === order.total &&
          entry.elite === order.elite &&
          order.origin !== order.to,
        'The alliance opportunity does not match its completed Ambassador relocation.',
      );
    }
  } else {
    requireSource(
      entry.ambassadorEvent === undefined,
      'Only an Ambassador entry may carry its event.',
    );
    requireSource(
      entry.cause === 'wormRide'
        ? g.phase === 1 &&
            entry.resume === 'wormRide' &&
            entrants[0].faction === 'fremen'
        : g.phase === 5 &&
            entry.resume === 'none' &&
            ['shipment', 'movement', 'guildTransport', 'advisor'].includes(
              entry.cause,
            ) &&
            (entry.cause !== 'advisor' ||
              entrants[0].faction === 'beneGesserit'),
      'The alliance opportunity has an invalid entry continuation.',
    );
  }
  const tokens = g.moritaniTerror?.tokens;
  requireSource(
    Array.isArray(tokens),
    'The alliance opportunity has no Terror token pool.',
  );
  const matches = tokens.filter((token) => token.id === entry.token);
  requireSource(
    typeof entry.token === 'string' &&
      entry.token.length > 0 &&
      matches.length === 1 &&
      matches[0].status === 'placed' &&
      matches[0].location === entry.territory &&
      TERROR_KINDS.includes(matches[0].kind),
    'The alliance opportunity no longer has its original hidden Terror token.',
  );
  return {
    kind: 'moritaniAlliance',
    owner: response.owner,
    entry: { ...entry, stage: 'offer', allianceBlocked: true },
    decision: {
      kind: 'moritaniTerror',
      player: response.owner,
      entrant: entry.entrant,
      territory: entry.territory,
    },
  };
}
