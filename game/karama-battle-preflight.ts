import type { Card } from './cards';
import type { MoritaniRetention } from './moritani-retention';

export class KaramaBattlePreflightError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'KaramaBattlePreflightError';
  }
}
export type ResolvedBattleReceipt = {
  event: string;
  turn: number;
  territory: string;
  combatants: string[];
  winner: string | null;
  result: 'normal' | 'traitor' | 'mutualTraitors' | 'explosion' | 'legacy';
};
export type BattleCleanupContextInput = {
  phase: number;
  turn: number;
  battlePresent: boolean;
  lastBattle: readonly string[];
  playerIds: readonly string[];
  /** Current board territories, including Mobile Stronghold only when present. */
  territoryIds: readonly string[];
  territory: string;
  winner: string | null;
  /** An independent completed-battle receipt, or absent on legacy cleanup saves. */
  context?: unknown;
};
export type BattleCleanupContextQuote =
  | { kind: 'existing'; context: ResolvedBattleReceipt }
  | {
      kind: 'legacy';
      /** Pure seed only: the live caller allocates/preserves the event once. */
      seed: Omit<ResolvedBattleReceipt, 'event'> & {
        result: 'legacy';
        winner: string;
      };
    };
export type MoritaniCancellationInput = Omit<
  BattleCleanupContextInput,
  'territory' | 'winner'
> & {
  responseOwner: string;
  /** Validate saved data before dereferencing fields, not just a trusted TS shape. */
  pending: unknown;
  /** The actual pending player's current hand. */
  hand: readonly Card[];
  /** All live physical card zones, including this hand; exclude knowledge/receipt aliases. */
  physicalCards: readonly { id: string }[];
};
export type MoritaniCancellationQuote = {
  player: string;
  discardIds: string[];
  context: BattleCleanupContextQuote;
};
function requireBattle(condition: unknown, message: string): asserts condition {
  if (!condition) throw new KaramaBattlePreflightError(message);
}
function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
function id(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
function ids(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.every(id) &&
    new Set(value).size === value.length
  );
}

/** Validate a cleanup receipt without allocating an event or reconstructing combat. */
export function validateBattleCleanupContext(
  input: BattleCleanupContextInput,
): BattleCleanupContextQuote {
  const {
    phase,
    turn,
    lastBattle,
    playerIds,
    territoryIds,
    territory,
    winner,
    context,
  } = input;
  requireBattle(
    phase === 6 &&
      input.battlePresent === false &&
      Number.isSafeInteger(turn) &&
      turn >= 1 &&
      ids(playerIds) &&
      ids(lastBattle) &&
      lastBattle.length === 2 &&
      lastBattle.every((p) => playerIds.includes(p)) &&
      Array.isArray(territoryIds) &&
      id(territory) &&
      territoryIds.includes(territory) &&
      (winner === null || (id(winner) && lastBattle.includes(winner))),
    'The saved battle cleanup is missing its resolved combatants.',
  );
  if (context === undefined || context === null) {
    requireBattle(
      winner !== null,
      'The saved battle cleanup is missing its resolved combatants.',
    );
    return {
      kind: 'legacy',
      seed: {
        turn,
        territory,
        combatants: [...lastBattle],
        winner,
        result: 'legacy',
      },
    };
  }
  requireBattle(
    record(context) &&
      id(context.event) &&
      context.turn === turn &&
      context.territory === territory &&
      context.winner === winner &&
      ids(context.combatants) &&
      context.combatants.length === 2 &&
      context.combatants.every((p, index) => p === lastBattle[index]) &&
      ['normal', 'traitor', 'mutualTraitors', 'explosion', 'legacy'].includes(
        context.result as string,
      ) &&
      (context.result === 'mutualTraitors' || context.result === 'explosion'
        ? winner === null
        : winner !== null),
    'The saved cleanup does not match the completed battle.',
  );
  return {
    kind: 'existing',
    context: {
      event: context.event,
      turn,
      territory,
      combatants: [...context.combatants],
      winner,
      result: context.result as ResolvedBattleReceipt['result'],
    },
  };
}

function canceledRetention(
  value: unknown,
  turn: number,
  responseOwner: string,
): asserts value is MoritaniRetention {
  requireBattle(
    record(value) &&
      value.stage === 'response' &&
      id(value.owner) &&
      value.owner === responseOwner &&
      id(value.player) &&
      value.player !== value.owner &&
      value.turn === turn &&
      id(value.territory) &&
      ids(value.played) &&
      value.played.length > 0 &&
      ids(value.eligible) &&
      value.eligible.length > 0 &&
      value.eligible.every((card) =>
        (value.played as string[]).includes(card),
      ) &&
      id(value.keep) &&
      value.eligible.includes(value.keep),
    'No Moritani alliance retention is awaiting this response.',
  );
}

/**
 * Canceled Moritani retention discards every committed played card. This quote
 * validates only that discard and its completed-battle context. It does not
 * execute finishBattle, choose a retained card, settle other aftermath, or
 * prove the entire Harkonnen-traitor cancellation suffix executable.
 */
export function preflightMoritaniRetentionCancellation(
  input: MoritaniCancellationInput,
): MoritaniCancellationQuote {
  const pending = input.pending;
  canceledRetention(pending, input.turn, input.responseOwner);
  requireBattle(
    Array.isArray(input.playerIds) &&
      input.playerIds.includes(pending.owner) &&
      input.playerIds.includes(pending.player) &&
      Array.isArray(input.lastBattle) &&
      input.lastBattle.includes(pending.player),
    'This alliance card cleanup is no longer current.',
  );
  requireBattle(
    Array.isArray(input.hand) &&
      Array.isArray(input.physicalCards) &&
      pending.played.every(
        (card) =>
          input.hand.filter((held) => held && held.id === card).length === 1 &&
          input.physicalCards.filter((held) => held && held.id === card)
            .length === 1,
      ),
    'Cards committed to alliance cleanup must remain available with unique physical custody.',
  );
  const context = validateBattleCleanupContext({
    phase: input.phase,
    turn: input.turn,
    battlePresent: input.battlePresent,
    lastBattle: input.lastBattle,
    playerIds: input.playerIds,
    territoryIds: input.territoryIds,
    context: input.context,
    territory: pending.territory,
    winner:
      input.lastBattle.find((player) => player !== pending.player) ?? null,
  });
  return { player: pending.player, discardIds: [...pending.played], context };
}
