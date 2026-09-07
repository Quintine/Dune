import type { Card } from './cards';
import { richeseCardDefinition } from './richese-cards';
import {
  resolveBattleWeapons,
  type EffectiveWeapon,
} from './effective-weapons';

/** Keep persisted physical card shapes stable while validating their printed role. */
export function isPortableSnooper(card: Card | undefined): boolean {
  return (
    !!card && richeseCardDefinition(card)?.card.effect === 'portableSnooper'
  );
}
export function isDefenseCard(card: Card): boolean {
  return DEFENSE_KINDS.includes(card.kind) || isPortableSnooper(card);
}
export function isStoneBurner(card: Card | undefined): boolean {
  return !!card && richeseCardDefinition(card)?.card.effect === 'stoneBurner';
}
export function isWeaponCard(card: Card): boolean {
  return WEAPON_KINDS.includes(card.kind) || isStoneBurner(card);
}

export const WEAPON_KINDS = [
  'projectile',
  'poison',
  'lasgun',
  'worthless',
  'poisonBlade',
  'poisonTooth',
  'artillery',
  'weirdingWay',
  'chemistry',
];
export const DEFENSE_KINDS = [
  'shield',
  'snooper',
  'worthless',
  'shieldSnooper',
  'weirdingWay',
  'chemistry',
];
export const VOICE_KINDS = [
  'stoneBurner',
  'poison',
  'projectile',
  'lasgun',
  'shield',
  'snooper',
  'worthless',
  'hero',
  'poisonBlade',
  'poisonTooth',
  'artillery',
  'shieldSnooper',
  'weirdingWay',
  'chemistry',
];
export const BATTLE_CARD_HELP: Partial<Record<Card['kind'], string>> = {
  artillery:
    'Kills both leaders unless each is protected by a shield. Surviving leaders add no battle strength, and no leader bounty is paid. Discard after use.',
  poisonTooth:
    'After plans are revealed, choose whether to activate. If activated, attacks both leaders; Chemistry as a defense protects, while Snoopers do not. Discard if used; a winner may retain an unused tooth.',
  poisonBlade:
    'A projectile and poison weapon. Both defenses are needed to protect the opposing leader.',
  shieldSnooper:
    'Both projectile and poison defense. This is a shield and triggers a lasgun explosion.',
  weirdingWay:
    'A projectile weapon by default. With another card in the weapon slot, play it as a projectile defense. It is not a shield and does not trigger a lasgun explosion.',
  chemistry:
    'A poison defense by default. With another card in the defense slot, play it as a poison weapon. It has only the role selected for this battle.',
};

/** Roles refer to the selected slot; alternate roles need the other slot occupied. */
export function validBattleCardPair(weapon?: Card, defense?: Card) {
  return (
    (!weapon || isWeaponCard(weapon)) &&
    (!defense || isDefenseCard(defense)) &&
    (!weapon || weapon.id !== defense?.id) &&
    (weapon?.kind !== 'chemistry' || !!defense) &&
    (defense?.kind !== 'weirdingWay' || !!weapon)
  );
}
export function weaponTypes(card?: Card): string[] {
  if (!card) return [];
  if (isStoneBurner(card)) return ['stoneBurner'];
  if (card.kind === 'poisonBlade') return ['projectile', 'poison'];
  if (card.kind === 'weirdingWay') return ['projectile'];
  if (card.kind === 'chemistry' || card.kind === 'poisonTooth')
    return ['poison'];
  return [card.kind];
}
export function defenseTypes(card?: Card): string[] {
  if (!card) return [];
  if (isPortableSnooper(card)) return ['snooper'];
  if (card.kind === 'shieldSnooper') return ['shield', 'snooper'];
  if (card.kind === 'weirdingWay') return ['shield'];
  if (card.kind === 'chemistry') return ['snooper'];
  return [card.kind];
}
export function isShield(card?: Card) {
  return card?.kind === 'shield' || card?.kind === 'shieldSnooper';
}
export function weaponKills(weapon?: Card, defense?: Card) {
  return effectiveWeaponKills(
    isStoneBurner(weapon) ? 'stoneBurner' : (weapon?.kind ?? null),
    defense,
  );
}
/** Resolve attack behavior without changing a physical card's identity or role. */
function effectiveWeaponKills(
  kind: EffectiveWeapon['kind'],
  defense?: Card,
  extraSnooper = false,
) {
  if (kind === 'artillery') return !isShield(defense);
  if (kind === 'poisonTooth') return defense?.kind !== 'chemistry';
  const attack =
      kind === 'poisonBlade'
        ? ['projectile', 'poison']
        : kind === 'weirdingWay'
          ? ['projectile']
          : kind === 'chemistry'
            ? ['poison']
            : [kind],
    protect = defenseTypes(defense);
  return (
    attack.includes('lasgun') ||
    (attack.includes('projectile') && !protect.includes('shield')) ||
    (attack.includes('poison') && !protect.includes('snooper') && !extraSnooper)
  );
}
/** Compulsion considers the card's default role, never forces an alternate role. */
export function defaultVoiceMatch(card: Card, kind: string) {
  if (card.kind === kind) return true;
  return (
    isPortableSnooper(card) ||
    ['shield', 'snooper', 'shieldSnooper', 'chemistry'].includes(card.kind)
      ? defenseTypes(card)
      : weaponTypes(card)
  ).includes(kind);
}
export function playedVoiceMatch(
  card: Card | undefined,
  slot: 'weapon' | 'defense' | 'leader',
  kind: string,
) {
  return (
    !!card &&
    (card.kind === kind ||
      (slot === 'weapon'
        ? weaponTypes(card)
        : slot === 'defense'
          ? defenseTypes(card)
          : []
      ).includes(kind))
  );
}

export function battleCardLabel(kind: string) {
  return (
    (
      {
        poisonTooth: 'Poison Tooth',
        artillery: 'Artillery Strike',
        stoneBurner: 'Stone Burner',
        poisonBlade: 'Poison Blade',
        shieldSnooper: 'Shield Snooper',
        weirdingWay: 'Weirding Way',
        chemistry: 'Chemistry',
        hero: 'Cheap Hero',
        shield: 'Projectile defense',
        snooper: 'Poison defense',
        projectile: 'Projectile weapon',
        poison: 'Poison weapon',
        lasgun: 'Lasgun',
        worthless: 'Worthless card',
      } as Record<string, string>
    )[kind] ?? kind
  );
}

/** Ordinary resolution only: traitors and lasgun explosions take precedence. */
export function battleCardEffects(
  aw?: Card,
  ad?: Card,
  dw?: Card,
  dd?: Card,
  toothA = true,
  toothD = true,
  extraSnoopers: { attacker?: boolean; defender?: boolean } = {},
) {
  const weapons = resolveBattleWeapons({
    attacker: { weapon: aw, defense: ad },
    defender: { weapon: dw, defense: dd },
  });
  if (weapons.error) throw new Error(weapons.error);
  const a =
    weapons.attacker.kind === 'poisonTooth' && !toothA
      ? null
      : weapons.attacker.kind;
  const d =
    weapons.defender.kind === 'poisonTooth' && !toothD
      ? null
      : weapons.defender.kind;
  const selfAttack = (kind: EffectiveWeapon['kind']) =>
    kind === 'artillery' || kind === 'poisonTooth';
  const artillery = a === 'artillery' || d === 'artillery';
  return {
    attackerDead:
      effectiveWeaponKills(d, ad, extraSnoopers.attacker) ||
      (selfAttack(a) && effectiveWeaponKills(a, ad, extraSnoopers.attacker)),
    defenderDead:
      effectiveWeaponKills(a, dd, extraSnoopers.defender) ||
      (selfAttack(d) && effectiveWeaponKills(d, dd, extraSnoopers.defender)),
    stunned: artillery,
    noBounty: artillery,
  };
}

/** Explosion and ordinary attacks consume the same revealed weapon roles. */
export function battleWeaponsExplode(
  aw?: Card,
  ad?: Card,
  dw?: Card,
  dd?: Card,
) {
  const weapons = resolveBattleWeapons({
    attacker: { weapon: aw, defense: ad },
    defender: { weapon: dw, defense: dd },
  });
  if (weapons.error) throw new Error(weapons.error);
  return (
    (weapons.attacker.kind === 'lasgun' ||
      weapons.defender.kind === 'lasgun') &&
    (isShield(ad) || isShield(dd))
  );
}
