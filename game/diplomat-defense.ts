import { ordinaryLeaderSkillModeSupported, type LeaderSkillProfile } from './leader-skill-profile';
import { baseDeck, ixDeck, type Card } from './cards';
import type { BattleLeaderSkill } from './leader-skill-combat';
import { isPortableSnooper, validBattleCardPair } from './battle-cards';

export type DiplomatDefenseQuote = {
  leader: string;
  cards: string[];
  source: string;
  kind: 'shield' | 'snooper' | 'shieldSnooper' | 'weirdingWay' | 'chemistry';
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

/** Consumer-facing role label; hybrid and non-Shield printed roles stay distinct. */
const DEFENSE_LABELS: Record<DiplomatDefenseQuote['kind'], string> = {
  shield: 'Projectile defense',
  snooper: 'Poison defense',
  shieldSnooper: 'Projectile and poison defense (Shield)',
  weirdingWay: 'Projectile defense (not a Shield)',
  chemistry: 'Poison defense (stops Poison Tooth)',
};

export function diplomatDefenseLabel(kind: DiplomatDefenseQuote['kind']): string {
  return DEFENSE_LABELS[kind];
}

/** Classify the used defensive role; the quote below checks the canonical face.
 * A sealed Portable Snooper has the ordinary poison-defense role. */
export function copiedDefenseKind(
  card: Card | undefined,
): DiplomatDefenseQuote['kind'] | null {
  if (!card) return null;
  if (isPortableSnooper(card)) return 'snooper';
  return Object.hasOwn(DEFENSE_LABELS, card.kind)
    ? (card.kind as DiplomatDefenseQuote['kind'])
    : null;
}

const baseCards = baseDeck();
const baseDefenses: Partial<Record<string, Card>> = Object.fromEntries(
  baseCards
    .filter((card) => card.kind === 'shield' || card.kind === 'snooper')
    .map((card) => [card.id, card]),
);

const printedDefenses: Partial<Record<string, Card>> = Object.fromEntries(
  [...baseCards, ...ixDeck()]
    .filter((card) => copiedDefenseKind(card))
    .map((card) => [card.id, card]),
);

/** A copied role does not change either physical card or either sealed plan.
 * `expandedDefenses` defaults to true for new battles and direct callers; an
 * already-open version-1 battle passes false so it keeps exactly its original
 * canonical base Shield/Snooper sources, with no retroactive choice or pair
 * validation. */
export function quoteDiplomatDefense(input: {
  assignments: readonly BattleLeaderSkill[];
  selectedLeader: string | null | undefined;
  weapon?: Card;
  defense?: Card;
  opposingDefense?: Card;
  opposingWeapon?: Card;
  expandedDefenses?: boolean;
}): DiplomatDefenseQuote | null {
  const assignment = diplomatTrainer(input.assignments, input.selectedLeader);
  if (!assignment || (input.defense && input.defense.kind !== 'worthless'))
    return null;
  const expanded = input.expandedDefenses !== false;
  const source = input.opposingDefense;
  const kind = copiedDefenseKind(source);
  const printed =
    source && (expanded ? printedDefenses[source.id] : baseDefenses[source.id]);
  if (
    !source ||
    !kind ||
    (!(expanded && isPortableSnooper(source)) &&
      (!printed ||
        printed.kind !== source.kind ||
        printed.name !== source.name ||
        printed.effect !== source.effect)) ||
    (expanded && !validBattleCardPair(input.opposingWeapon, source))
  )
    return null;
  const cards = [input.weapon, input.defense]
    .filter((card): card is Card => card?.kind === 'worthless')
    .map((card) => card.id);
  if (!cards.length || new Set(cards).size !== cards.length) return null;
  return { leader: assignment.leader, cards, source: source.id, kind };
}

/** Copy the already-used role, not its original own-slot prerequisite or activation.
 * Native skill inputs must already exclude dead or foreign-ghola trainers. */
export function copiedDiplomatDefense(
  quote: DiplomatDefenseQuote,
  card: string,
): Card {
  if (!quote.cards.includes(card))
    throw new Error('Choose one committed Worthless card for Diplomat.');
  return { id: card, name: 'Diplomat defense', kind: quote.kind };
}

export function diplomatDefenseModeSupported(game: LeaderSkillProfile): boolean {
  return ordinaryLeaderSkillModeSupported(game);
}
