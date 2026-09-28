import type { Card } from './cards';
import { richeseCardDefinition } from './richese-cards';
import { canRetainBattleCard } from './moritani-retention';

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
export type EffectiveWeaponChoice = {
  side: BattleWeaponSide;
  kind: 'poisonTooth' | 'stoneBurner';
  /** The committed card making this decision, never the copied source card. */
  physicalId: string;
  copiedFrom: string | null;
};
export type BattleWeaponResolution = {
  attacker: EffectiveBattleWeapon;
  defender: EffectiveBattleWeapon;
  choiceOrder: EffectiveWeaponChoice[];
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

function appendChoice(result: BattleWeaponResolution, side: BattleWeaponSide) {
  const weapon = result[side];
  if (weapon.choice && weapon.physicalId)
    result.choiceOrder.push({
      side,
      kind: weapon.choice,
      physicalId: weapon.physicalId,
      copiedFrom: weapon.copiedFrom,
    });
}

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
 * Choice entries identify the physical owner of each independent decision.
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
  const aw = input.attacker.weapon;
  const ad = input.attacker.defense;
  const dw = input.defender.weapon;
  const dd = input.defender.defense;
  const attackerMirror = isMirror(aw);
  const attackerDefenseMirror = isMirror(ad);
  const defenderMirror = isMirror(dw);
  const defenderDefenseMirror = isMirror(dd);
  if (
    (aw && claimsMirror(aw) && !attackerMirror) ||
    (ad && claimsMirror(ad) && !attackerDefenseMirror) ||
    (dw && claimsMirror(dw) && !defenderMirror) ||
    (dd && claimsMirror(dd) && !defenderDefenseMirror)
  ) {
    result.error = 'Mirror Weapon must match its canonical physical identity.';
    return result;
  }
  if (
    Number(attackerMirror) +
      Number(attackerDefenseMirror) +
      Number(defenderMirror) +
      Number(defenderDefenseMirror) >
    1
  ) {
    result.error =
      'Only one physical Mirror Weapon exists; duplicated custody is invalid.';
    return result;
  }
  result.attacker = originalWeapon(input.attacker);
  result.defender = originalWeapon(input.defender);
  if (attackerMirror && result.defender.kind !== null) {
    result.attacker = {
      physicalId: aw!.id,
      copiedFrom: result.defender.physicalId,
      kind: result.defender.kind,
      choice: result.defender.choice,
    };
  } else if (defenderMirror && result.attacker.kind !== null) {
    result.defender = {
      physicalId: dw!.id,
      copiedFrom: result.attacker.physicalId,
      kind: result.attacker.kind,
      choice: result.attacker.choice,
    };
  }
  if (result.defender.copiedFrom && result.defender.choice) {
    appendChoice(result, 'defender');
    appendChoice(result, 'attacker');
  } else {
    appendChoice(result, 'attacker');
    appendChoice(result, 'defender');
  }
  return result;
}

/** Ordinary battle cleanup quote for one committed physical card. The copy's
 * effective kind is deliberately not an input: mandatory Tooth/Artillery
 * disposal applies to those original physical cards, not to Mirror. Moritani's
 * separate losing-ally interception is outside ordinary winner/loser cleanup.
 */
export function quoteBattleWeaponRetention(input: {
  card: Card;
  outcome: 'winner' | 'loser';
  traitorDecided: boolean;
  toothUsed: boolean;
}): { physicalId: string; mayRetain: boolean } {
  const { card, outcome, traitorDecided, toothUsed } = input;
  if (claimsMirror(card) && !isMirror(card))
    throw new Error('Mirror Weapon must match its canonical physical identity.');
  return {
    physicalId: card.id,
    mayRetain:
      outcome === 'winner' &&
      canRetainBattleCard(card, traitorDecided, toothUsed),
  };
}
