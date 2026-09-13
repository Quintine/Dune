import { treacheryDeck, type Card } from './cards';
import { richeseCards } from './richese-cards';
import { quoteTupileIntelligenceAnswer } from './tupile-intelligence-answer';

export class MentatQuestionError extends Error {}
export const MENTAT_EMPTY_HAND =
  'Mentat cannot ask while the opponent has no Treachery Card to show; the empty-hand ruling remains unresolved. This question was skipped without a disclosure.';
export type MentatQuestionReceipt = {
  event: string;
  battle: string;
  turn: number;
  territory: string;
  owner: string;
  target: string;
  leader: string;
  stage: 'name' | 'reveal' | 'answered' | 'declined' | 'unavailable';
  weapon: string | null;
  card: Card | null;
  /** Private snapshot for this atomic question; never a later hand obligation. */
  hand: Card[];
  signature: string;
};
export type MentatObservation = Omit<
  MentatQuestionReceipt,
  'stage' | 'hand' | 'weapon' | 'card'
> & { weapon: string; card: Card };
export type MentatView = {
  pending: null | {
    event: string;
    owner: string;
    target: string;
    player: string;
    stage: 'name' | 'reveal';
    weapon: string | null;
    weapons: string[];
    cards: Card[];
    blocked: string | null;
  };
  history: Omit<MentatObservation, 'signature'>[];
};
export function mentatQuestionModeSupported(game: {
  expansions: readonly string[];
  homeworlds?: unknown;
  nexusCards?: unknown;
  discoveries?: unknown;
  discoveryEnabled?: unknown;
  strongholdCards?: unknown;
  techTokens?: unknown;
}): boolean {
  return (
    (!game.expansions.length ||
      (game.expansions.length === 1 && game.expansions[0] === 'choam')) &&
    !game.homeworlds &&
    !game.nexusCards &&
    !game.discoveries &&
    !game.discoveryEnabled &&
    !game.strongholdCards &&
    !game.techTokens
  );
}
function inventory(expansions: readonly string[]): Card[] {
  return [
    ...treacheryDeck(expansions),
    ...(expansions.includes('choam') ? richeseCards() : []),
  ];
}
/** Printed/default held-card roles, shared with Tupile; never battle-slot legality. */
export function mentatWeaponNames(expansions: readonly string[]): string[] {
  return [
    ...new Set(
      inventory(expansions)
        .filter(
          (card) =>
            quoteTupileIntelligenceAnswer([card], 0, 'weapons').count === 1,
        )
        .map((card) => card.name),
    ),
  ];
}
export function mentatHand(
  hand: readonly Card[],
  expansions: readonly string[],
): Card[] {
  const canonical = new Map(
    inventory(expansions).map((card) => [card.id, card]),
  );
  if (
    !Array.isArray(hand) ||
    hand.some(
      (card) =>
        !card ||
        !canonical.has(card.id) ||
        JSON.stringify(card) !== JSON.stringify(canonical.get(card.id)),
    ) ||
    new Set(hand.map((card) => card.id)).size !== hand.length
  )
    throw new MentatQuestionError(
      'Mentat needs a valid uniquely held physical Treachery hand.',
    );
  return hand.map((card) => ({ ...card }));
}
export function quoteMentatReveal(
  hand: readonly Card[],
  weapon: string,
  expansions: readonly string[],
): { cards: Card[] } {
  if (!mentatWeaponNames(expansions).includes(weapon))
    throw new MentatQuestionError('Name one specific canonical weapon.');
  const held = mentatHand(hand, expansions);
  if (!held.length) throw new MentatQuestionError(MENTAT_EMPTY_HAND);
  const matching = held.filter((card) => card.name === weapon);
  return {
    cards: matching.length ? matching : held,
  };
}
export function mentatSignature(
  receipt: MentatQuestionReceipt | MentatObservation,
): string {
  return JSON.stringify({ ...receipt, signature: undefined });
}
