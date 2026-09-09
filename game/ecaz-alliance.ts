import { FACTIONS, type FactionId } from './catalog';
import type { Game } from './engine';

export type EcazAllianceSeat = {
  id: string;
  faction: FactionId;
  ally: string | null;
  allySinceTurn?: number;
};
export type EcazAllianceContext = {
  status: Game['status'];
  turn: number;
  players: readonly Readonly<EcazAllianceSeat>[];
  allianceOffers: Readonly<Record<string, string>>;
};
export class EcazAllianceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EcazAllianceError';
  }
}
function requireAlliance(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) throw new EcazAllianceError(message);
}
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

/** Quotes only public alliance identity. The caller owns Ambassador provenance,
 * consent, token commitment and continuation; Duke custody is independent. */
export function quoteEcazAlliance(
  context: EcazAllianceContext,
  ownerId: string,
  entrantId: string,
): { players: EcazAllianceSeat[]; allianceOffers: Record<string, string> } {
  requireAlliance(
    record(context) &&
      context.status === 'playing' &&
      Number.isSafeInteger(context.turn) &&
      context.turn >= 1,
    'An Ecaz alliance requires a playing game and a valid turn.',
  );
  const seats = context.players;
  requireAlliance(
    Array.isArray(seats) &&
      seats.length >= 2 &&
      seats.every(
        (seat) =>
          record(seat) &&
          text(seat.id) &&
          FACTIONS.some((faction) => faction.id === seat.faction) &&
          (seat.ally === null || text(seat.ally)) &&
          (seat.allySinceTurn === undefined ||
            (typeof seat.allySinceTurn === 'number' &&
              Number.isSafeInteger(seat.allySinceTurn) &&
              seat.allySinceTurn >= 0 &&
              seat.allySinceTurn <= context.turn)),
      ) &&
      new Set(seats.map((seat) => seat.id)).size === seats.length &&
      new Set(seats.map((seat) => seat.faction)).size === seats.length,
    'An Ecaz alliance requires unique valid seated identities and factions.',
  );
  const byId = new Map(seats.map((seat) => [seat.id, seat]));
  for (const seat of seats) {
    if (seat.ally === null) continue;
    requireAlliance(
      seat.ally !== seat.id && byId.get(seat.ally)?.ally === seat.id,
      'Existing alliances must be seated, distinct and reciprocal.',
    );
  }
  const owner = byId.get(ownerId);
  const entrant = byId.get(entrantId);
  requireAlliance(
    text(ownerId) &&
      text(entrantId) &&
      owner &&
      entrant &&
      ownerId !== entrantId &&
      owner.faction === 'ecaz',
    'Choose the seated Ecaz owner and a different seated entrant.',
  );
  requireAlliance(
    owner.ally === null && entrant.ally === null,
    'Ecaz and the entrant must both be unallied.',
  );
  requireAlliance(
    record(context.allianceOffers),
    'Alliance offers must be a valid public record.',
  );
  const offers = Object.entries(context.allianceOffers);
  requireAlliance(
    offers.every(
      ([from, to]) => text(to) && from !== to && byId.has(from) && byId.has(to),
    ),
    'Alliance offers must connect distinct seated players.',
  );
  const pair = new Set([ownerId, entrantId]);
  return {
    players: seats.map((seat) => {
      const result: EcazAllianceSeat = {
        id: seat.id,
        faction: seat.faction,
        ally: seat.ally,
      };
      if (seat.allySinceTurn !== undefined)
        result.allySinceTurn = seat.allySinceTurn;
      if (pair.has(seat.id)) {
        result.ally = seat.id === ownerId ? entrantId : ownerId;
        result.allySinceTurn = context.turn;
      }
      return result;
    }),
    allianceOffers: Object.fromEntries(
      offers.filter(([from, to]) => !pair.has(from) && !pair.has(to)),
    ),
  };
}

export function ecazAllianceBlock(
  context: EcazAllianceContext,
  ownerId: string,
  entrantId: string,
): string | null {
  try {
    quoteEcazAlliance(context, ownerId, entrantId);
    return null;
  } catch (error) {
    if (error instanceof EcazAllianceError) return error.message;
    throw error;
  }
}
