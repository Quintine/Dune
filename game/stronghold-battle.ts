import type { Card } from './cards';
import {
  battleCardEffects,
  isDefenseCard,
  weaponTypes,
  defenseTypes,
} from './battle-cards';
import { resolveBattleWeapons, type EffectiveWeapon } from './effective-weapons';
import type { StrongholdId } from './stronghold-cards';

/** Carthag adds a Snooper property, not a second physical card or Chemistry. */
export function strongholdSnooper(
  effect: StrongholdId | null | undefined,
  weapon?: Card,
  defense?: Card,
  effectiveKind?: EffectiveWeapon['kind'],
) {
  return (
    effect === 'carthag' &&
    !!defense &&
    defense.kind !== 'worthless' &&
    isDefenseCard(defense) &&
    !defenseTypes(defense).includes('snooper') &&
    !(effectiveKind === undefined ? weaponTypes(weapon).includes('poison') :
      ['poison', 'poisonBlade', 'poisonTooth', 'chemistry'].includes(effectiveKind ?? ''))
  );
}
export function strongholdBattleEffects(
  aw?: Card,
  ad?: Card,
  dw?: Card,
  dd?: Card,
  toothA = true,
  toothD = true,
  aEffect?: StrongholdId | null,
  dEffect?: StrongholdId | null,
) {
  const weapons = resolveBattleWeapons({
    attacker: { weapon: aw, defense: ad },
    defender: { weapon: dw, defense: dd },
  });
  return battleCardEffects(aw, ad, dw, dd, toothA, toothD, {
    attacker: strongholdSnooper(aEffect, aw, ad, weapons.attacker.kind),
    defender: strongholdSnooper(dEffect, dw, dd, weapons.defender.kind),
  }, weapons);
}
