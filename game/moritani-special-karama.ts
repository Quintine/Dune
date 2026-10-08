import type { Card } from './cards';
import type { FactionId } from './catalog';
import type { ResolvedBattleReceipt } from './karama-battle-preflight';

export class MoritaniSpecialKaramaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MoritaniSpecialKaramaError';
  }
}

/** Prototype precedence, not a publisher clarification of Moritani F. */
export const MORITANI_SPECIAL_KARAMA_BOUNDARY =
  'Provisional first-version precedence: mandatory named-card disposal wins. Force keep applies only to ordinarily retainable cards; this is not a publisher clarification.';

export type MoritaniSpecialKaramaSource = {
  event: string;
  turn: number;
  territory: string;
  owner: string;
  opponent: string;
};

export type MoritaniSpecialKaramaInput = {
  advanced: boolean;
  phase: number;
  battlePresent: boolean;
  turn: number;
  owner: { id: string; faction: FactionId };
  used: boolean;
  /** The actual resolved battle, never a prospective or reconstructed result. */
  battle: ResolvedBattleReceipt;
  /** Owned, unreserved actual Karama Cards, supplied by the integration owner. */
  karamas: readonly Card[];
  /** Only publicly revealed winner cards played in this battle, never their hand. */
  playedCards: readonly Card[];
  /** Public played identities still in the winner's physical custody. */
  heldPlayedIds: readonly string[];
  /** Normal retainable identities after compulsory named-card disposal. */
  keepableIds: readonly string[];
};

export type MoritaniSpecialKaramaQuote = {
  source: MoritaniSpecialKaramaSource;
  karamas: readonly Card[];
  /** Public played cards still held; all are legal force-discard targets. */
  playedCards: readonly Card[];
  keepableIds: readonly string[];
  boundary: string;
};

/** Project only to source.owner; independent of GameView and hidden hands. */
export type MoritaniSpecialKaramaView = MoritaniSpecialKaramaQuote;

export type MoritaniSpecialKaramaAction = {
  type: 'card';
  mode: 'special';
  card: string;
  event: string;
  keep: string[];
  discard: string[];
};

/** Detached instruction only: the caller owns cost, once-use and continuation. */
export type MoritaniSpecialKaramaChoice = {
  source: MoritaniSpecialKaramaSource;
  card: string;
  keep: string[];
  discard: string[];
};

function requireMoritani(condition: unknown, message: string): asserts condition {
  if (!condition) throw new MoritaniSpecialKaramaError(message);
}

function id(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function ids(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(id) && new Set(value).size === value.length;
}

function cardList(value: unknown): value is Card[] {
  return Array.isArray(value) &&
    value.every(card => card && id(card.id) && id(card.name) && id(card.kind)) &&
    new Set(value.map(card => card.id)).size === value.length;
}

/**
 * Call after compulsory aftermath and before optional winner disposal. The
 * supplied played-card list is already public; this helper never finds cards
 * in an opposing hand or infers whether an unrevealed card was played.
 */
export function quoteMoritaniSpecialKarama(
  input: MoritaniSpecialKaramaInput,
): MoritaniSpecialKaramaQuote | null {
  if (!input.advanced || input.owner.faction !== 'moritani' || input.used ||
    input.phase !== 6 || input.battlePresent) return null;
  const battle = input.battle;
  requireMoritani(
    battle && id(battle.event) && Number.isSafeInteger(input.turn) && input.turn >= 1 &&
      battle.turn === input.turn && id(battle.territory) && id(input.owner.id) &&
      ids(battle.combatants) && battle.combatants.length === 2 &&
      ['normal', 'traitor', 'mutualTraitors', 'explosion', 'legacy'].includes(battle.result) &&
      (battle.winner === null || (id(battle.winner) && battle.combatants.includes(battle.winner))) &&
      ((battle.result === 'mutualTraitors' || battle.result === 'explosion')
        ? battle.winner === null : battle.winner !== null),
    'Moritani special Karama needs the current resolved battle receipt.',
  );
  if (!battle.combatants.includes(input.owner.id) || battle.winner === null ||
    battle.winner === input.owner.id) return null;
  requireMoritani(
    cardList(input.karamas) && input.karamas.every(card => card.kind === 'special' && card.effect === 'karama'),
    'Supply only unique, owned, available actual Karama Cards.',
  );
  requireMoritani(
    cardList(input.playedCards) && ids(input.heldPlayedIds) && ids(input.keepableIds) &&
      input.heldPlayedIds.every(card => input.playedCards.some(played => played.id === card)) &&
      input.keepableIds.every(card => input.heldPlayedIds.includes(card)) &&
      !input.karamas.some(card => input.playedCards.some(played => played.id === card.id)),
    'Supply unique public played cards, their current custody, and normal retainable identities.',
  );
  const playedCards = input.playedCards.filter(card => input.heldPlayedIds.includes(card.id));
  if (!input.karamas.length || !playedCards.length) return null;
  return {
    source: {
      event: battle.event,
      turn: battle.turn,
      territory: battle.territory,
      owner: input.owner.id,
      opponent: battle.winner,
    },
    karamas: input.karamas,
    playedCards,
    keepableIds: input.keepableIds,
    boundary: MORITANI_SPECIAL_KARAMA_BOUNDARY,
  };
}

/** Validate against a freshly rebuilt quote for the exact pending opportunity. */
export function validateMoritaniSpecialKaramaChoice(
  quote: MoritaniSpecialKaramaQuote,
  source: MoritaniSpecialKaramaSource,
  actor: string,
  action: unknown,
): MoritaniSpecialKaramaChoice {
  requireMoritani(
    source.event === quote.source.event && source.turn === quote.source.turn &&
      source.territory === quote.source.territory && source.owner === quote.source.owner &&
      source.opponent === quote.source.opponent,
    'This Moritani special Karama must resume its exact original battle opportunity.',
  );
  requireMoritani(action && typeof action === 'object' && !Array.isArray(action),
    'Choose a Moritani special Karama disposition.');
  const choice = action as Record<string, unknown>;
  requireMoritani(
    actor === quote.source.owner && choice.type === 'card' && choice.mode === 'special' &&
      choice.event === quote.source.event &&
      Object.keys(choice).every(key => ['type', 'mode', 'card', 'event', 'keep', 'discard'].includes(key)),
    'This Moritani special Karama must match its owner and original battle event.',
  );
  requireMoritani(id(choice.card) && quote.karamas.some(card => card.id === choice.card),
    'Spend one of your available actual Karama Cards.');
  requireMoritani(ids(choice.keep) && ids(choice.discard),
    'Keep and discard must be unique card-identity lists.');
  const keep = choice.keep;
  const discard = choice.discard;
  requireMoritani(keep.length + discard.length > 0,
    'Force at least one disposition, or decline the opportunity without spending a Karama.');
  requireMoritani(
    keep.every(card => quote.keepableIds.includes(card) && quote.playedCards.some(played => played.id === card)) &&
      discard.every(card => quote.playedCards.some(played => played.id === card)) &&
      !keep.some(card => discard.includes(card)),
    'Choose disjoint played cards still held; force keep only normally retainable cards.',
  );
  return {
    source: { ...quote.source },
    card: choice.card,
    keep: [...keep],
    discard: [...discard],
  };
}
