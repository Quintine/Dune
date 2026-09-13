import { baseDeck, type Card } from './cards';
import type { BattleLeaderSkill } from './leader-skill-combat';

export type DiplomatDefenseQuote = {
  leader: string;
  cards: string[];
  source: string;
  kind: 'shield' | 'snooper';
};

/** Planning eligibility does not inspect the opponent's unsubmitted cards. */
export function diplomatTrainer(
  assignments: readonly BattleLeaderSkill[],
  selectedLeader: string | null | undefined,
): BattleLeaderSkill | undefined {
  return assignments.find(
    (a) =>
      a.skill === 'diplomat' &&
      !a.captured &&
      (a.faceUp || a.leader === selectedLeader),
  );
}

const baseDefenses = new Map(
  baseDeck()
    .filter((card) => card.kind === 'shield' || card.kind === 'snooper')
    .map((card) => [card.id, card]),
);

/** A copied role does not change either physical card or either sealed plan. */
export function quoteDiplomatDefense(input: {
  assignments: readonly BattleLeaderSkill[];
  selectedLeader: string | null | undefined;
  weapon?: Card;
  defense?: Card;
  opposingDefense?: Card;
}): DiplomatDefenseQuote | null {
  const assignment = diplomatTrainer(input.assignments, input.selectedLeader);
  if (!assignment || (input.defense && input.defense.kind !== 'worthless'))
    return null;
  const source = input.opposingDefense;
  const printed = source && baseDefenses.get(source.id);
  if (
    !source ||
    !printed ||
    printed.kind !== source.kind ||
    printed.name !== source.name
  )
    return null;
  const cards = [input.weapon, input.defense]
    .filter((card): card is Card => card?.kind === 'worthless')
    .map((card) => card.id);
  if (!cards.length || new Set(cards).size !== cards.length) return null;
  return {
    leader: assignment.leader,
    cards,
    source: source.id,
    kind: source.kind as 'shield' | 'snooper',
  };
}

/** Native skill inputs must already exclude dead or foreign-ghola trainers. */
export function copiedDiplomatDefense(
  quote: DiplomatDefenseQuote,
  card: string,
): Card {
  if (!quote.cards.includes(card))
    throw new Error('Choose one committed Worthless card for Diplomat.');
  return { id: card, name: 'Diplomat defense', kind: quote.kind };
}

export function diplomatDefenseModeSupported(game: {
  expansions: readonly string[];
  homeworlds?: unknown;
  nexusCards?: unknown;
  discoveries?: unknown;
  discoveryEnabled?: unknown;
  strongholdCards?: unknown;
  techTokens?: unknown;
}): boolean {
  return (
    !game.expansions.length &&
    !game.homeworlds &&
    !game.nexusCards &&
    !game.discoveries &&
    !game.discoveryEnabled &&
    !game.strongholdCards &&
    !game.techTokens
  );
}
