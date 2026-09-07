import type { Card } from './cards';
import { richeseCardDefinition } from './richese-cards';

export type BattleWeaponSide = 'attacker' | 'defender';
export type EffectiveBattleWeapon = {
  physicalId: string | null;
  copiedFrom: string | null;
  kind: Card['kind'] | 'stoneBurner' | null;
  choice: 'poisonTooth' | 'stoneBurner' | null;
};
/** Public name used by effective attack/defense integration. */
export type EffectiveWeapon = EffectiveBattleWeapon;
type SelectedBattleCards = { weapon?: Card; defense?: Card };
export type BattleWeaponResolution = {
  attacker: EffectiveBattleWeapon;
  defender: EffectiveBattleWeapon;
  choiceOrder: {
    side: BattleWeaponSide;
    kind: 'poisonTooth' | 'stoneBurner';
  }[];
  error: string | null;
};
const mirrorId = 'richese-mirror-weapon';
const isMirror = (card?: Card) =>
  !!card && richeseCardDefinition(card)?.card.effect === 'mirrorWeapon';
const claimsMirror = (card: Card) =>
  card.id === mirrorId ||
  card.name === 'Mirror Weapon' ||
  card.effect === 'mirrorWeapon';
const empty = (card?: Card): EffectiveBattleWeapon => ({
  physicalId: card?.id ?? null,
  copiedFrom: null,
  kind: null,
  choice: null,
});

/** The caller validates whole plans. Here Chemistry's selected weapon role must
 * have its original second defense; a copied effect does not require that card.
 */
function originalWeapon({
  weapon,
  defense,
}: SelectedBattleCards): EffectiveBattleWeapon {
  const result = empty(weapon);
  if (!weapon || isMirror(weapon)) return result;
  const canonical = richeseCardDefinition(weapon);
  if (canonical) {
    if (canonical.card.effect === 'stoneBurner') {
      result.kind = 'stoneBurner';
      result.choice = 'stoneBurner';
    }
    return result;
  }
  // A tampered Richese physical identity cannot acquire a base attack by changing kind.
  if (weapon.id.startsWith('richese-')) return result;
  switch (weapon.kind) {
    case 'projectile':
    case 'poison':
    case 'lasgun':
    case 'poisonBlade':
    case 'weirdingWay':
    case 'artillery':
    case 'poisonTooth':
      result.kind = weapon.kind;
      break;
    case 'chemistry': {
      const validDefense =
        defense &&
        defense.id !== weapon.id &&
        ([
          'shield',
          'snooper',
          'worthless',
          'shieldSnooper',
          'weirdingWay',
          'chemistry',
        ].includes(defense.kind) ||
          richeseCardDefinition(defense)?.card.effect === 'portableSnooper');
      if (validDefense) result.kind = weapon.kind;
      break;
    }
  }
  if (result.kind === 'poisonTooth') result.choice = 'poisonTooth';
  return result;
}

/** Resolve only revealed selected weapon roles; never replace physical cards.
 * This establishes a copy-first dependency, not general battle turn order.
 * Without that dependency choiceOrder follows input attacker/defender order;
 * callers retain the existing ordinary storm-order choice policy as required.
 * This helper decides neither activation answers nor physical-card retention.
 */
export function resolveBattleWeapons(input: {
  attacker: SelectedBattleCards;
  defender: SelectedBattleCards;
}): BattleWeaponResolution {
  const result: BattleWeaponResolution = {
    attacker: empty(input.attacker.weapon),
    defender: empty(input.defender.weapon),
    choiceOrder: [],
    error: null,
  };
  const cards = [
    input.attacker.weapon,
    input.attacker.defense,
    input.defender.weapon,
    input.defender.defense,
  ].filter((card): card is Card => !!card);
  if (cards.some((card) => claimsMirror(card) && !isMirror(card))) {
    result.error = 'Mirror Weapon must match its canonical physical identity.';
    return result;
  }
  if (cards.filter(isMirror).length > 1) {
    result.error =
      'Only one physical Mirror Weapon exists; duplicated custody is invalid.';
    return result;
  }
  result.attacker = originalWeapon(input.attacker);
  result.defender = originalWeapon(input.defender);
  for (const side of ['attacker', 'defender'] as const) {
    if (!isMirror(input[side].weapon)) continue;
    const other = side === 'attacker' ? 'defender' : 'attacker';
    const original = result[other];
    if (original.kind !== null) {
      result[side] = {
        physicalId: input[side].weapon!.id,
        copiedFrom: original.physicalId,
        kind: original.kind,
        choice: original.choice,
      };
    }
  }
  const order: BattleWeaponSide[] =
    result.defender.copiedFrom && result.defender.choice
      ? ['defender', 'attacker']
      : ['attacker', 'defender'];
  for (const side of order) {
    const choice = result[side].choice;
    if (choice) result.choiceOrder.push({ side, kind: choice });
  }
  return result;
}
