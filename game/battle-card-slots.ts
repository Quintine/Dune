import type { Card } from './cards';
import { isDefenseCard, isWeaponCard } from './battle-cards';
import { ecazTreacheryDefinition } from './ecaz-cards';
import {
  isPlanetologistBattleSpecialCard,
  validLeaderSkillBattleCardPair,
} from './leader-skill-combat';

export type BattleCardSlot = 'weapon' | 'defense';
export type BattlePlanInspectionField = BattleCardSlot | 'leader' | 'dial';
export type BattleCategoryInspectionValue = string | number | null;

function canonicalEcazBattleSpecial(card: Card | undefined) {
  if (
    !card ||
    Object.keys(card).sort().join(',') !== 'effect,id,kind,name'
  )
    return false;
  const definition = ecazTreacheryDefinition(card);
  return (
    definition?.card.effect === 'reinforcements' ||
    definition?.card.effect === 'harassWithdraw'
  );
}

/**
 * Single-slot role eligibility only. The caller still applies paired-card rules
 * such as Chemistry/Weirding Way dependencies and validates the selected
 * Planetologist leader before setting planetologistWeapon.
 */
export function battleCardSlotEligible(
  slot: BattleCardSlot,
  card: Card | undefined,
  options: Readonly<{ planetologistWeapon?: boolean }> = {},
): boolean {
  if (!card) return true;
  if (canonicalEcazBattleSpecial(card)) return true;
  if (slot === 'defense') return isDefenseCard(card);
  return (
    isWeaponCard(card) ||
    (!!options.planetologistWeapon && isPlanetologistBattleSpecialCard(card))
  );
}

/** Slot-only specials do not supply the opposite category for alternate roles. */
export function validBattleSlotPair(
  weapon?: Card,
  defense?: Card,
  planetologistWeapon = false,
): boolean {
  if (!canonicalEcazBattleSpecial(weapon) && !canonicalEcazBattleSpecial(defense))
    return validLeaderSkillBattleCardPair(weapon, defense, planetologistWeapon);
  return (
    battleCardSlotEligible('weapon', weapon, { planetologistWeapon }) &&
    battleCardSlotEligible('defense', defense) &&
    (!weapon || weapon.id !== defense?.id) &&
    (weapon?.kind !== 'chemistry' || (!!defense && isDefenseCard(defense))) &&
    (defense?.kind !== 'weirdingWay' || (!!weapon && isWeaponCard(weapon)))
  );
}

/**
 * Prescience asks for the selected category rather than physical slot
 * occupancy. Exact Ecaz battle specials answer null without revealing their
 * identity. Existing Planetologist inspection behavior is a separate contract.
 */
export function battleCategoryInspectionValue(
  field: BattlePlanInspectionField,
  value: BattleCategoryInspectionValue | undefined,
  card?: Card,
): BattleCategoryInspectionValue | undefined {
  if (value === undefined || field === 'leader' || field === 'dial' || value === null)
    return value;
  if (card && card.id !== value)
    throw new Error('The inspected card does not match the selected battle slot.');
  if (canonicalEcazBattleSpecial(card))
    return null;
  return value;
}

/** Partial plan search leaves an unspecified candidate unconstrained. */
export function fixedBattleInspectionMatches(
  field: BattlePlanInspectionField,
  fixed: BattleCategoryInspectionValue,
  candidate: BattleCategoryInspectionValue | undefined,
  card?: Card,
): boolean {
  return (
    candidate === undefined ||
    battleCategoryInspectionValue(field, candidate, card) === fixed
  );
}
