import { location, territory } from './board';
import type { FactionId } from './catalog';

/** Sector zero remains supported for legacy storm continuations. Callers validate ranges. */
export function stormSectorAfter(from: number, distance: number) {
  return ((from - 1 + distance) % 18) + 1;
}

export function stormExposesTerritory(id: string, shieldWallDestroyed = false) {
  const t = territory(id);
  return (t.type === 'sand' && t.id !== 'imperial_basin') ||
    (shieldWallDestroyed && ['arrakeen', 'carthag', 'imperial_basin'].includes(t.id));
}

export function wormConsumesForces(player: { id: string; faction: FactionId }, protectedAlly?: string, protectFremen = true) {
  return (!protectFremen || player.faction !== 'fremen') && player.id !== protectedAlly;
}

/** A territory card adds to existing spice unless its printed sector is under storm. */
export function quoteSpicePlacement(spice: Readonly<Record<string, number>>, storm: number,
  card: Readonly<{ territory: string; sector: number; amount: number }>) {
  const key = location(card.territory, card.sector);
  const added = card.sector === storm ? 0 : card.amount;
  return { key, added, total: (spice[key] ?? 0) + added, blocked: card.sector === storm };
}
