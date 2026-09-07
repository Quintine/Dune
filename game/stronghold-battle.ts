import type { Card } from './cards';
import {
  battleCardEffects,
  isDefenseCard,
  weaponTypes,
  defenseTypes,
} from './battle-cards';
import type { StrongholdId } from './stronghold-cards';

/** Carthag adds a Snooper property, not a second physical card or Chemistry. */
export function strongholdSnooper(
  effect: StrongholdId | null | undefined,
  weapon?: Card,
  defense?: Card,
) {
  return (
    effect === 'carthag' &&
    !!defense &&
    defense.kind !== 'worthless' &&
    isDefenseCard(defense) &&
    !defenseTypes(defense).includes('snooper') &&
    !weaponTypes(weapon).includes('poison')
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
  return battleCardEffects(aw, ad, dw, dd, toothA, toothD, {
    attacker: strongholdSnooper(aEffect, aw, ad),
    defender: strongholdSnooper(dEffect, dw, dd),
  });
}
