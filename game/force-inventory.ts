import { splitLocation, territory } from './board';
import type { FactionId } from './catalog';
import { specialForceName } from './combat';
import { isAdvisor } from './advisors';
import { HOMEWORLD_CARDS } from './homeworld-cards';

/** Public physical custody only. No private cards, commitments or token faces. */
export type PublicForcePlayer = {
  id: string;
  name: string;
  faction: FactionId;
  reserves: number;
  tanks: number;
  forces: Readonly<Record<string, number>>;
  elites?: { reserves: number; tanks: number; forces: Readonly<Record<string, number>> };
  advisors?: Record<string, { lockedTurn?: number }>;
  noField?: { deployed: { location: { territory: string; sector: number } } | null } | null;
};
export type PublicForceWorld = {
  id: string;
  native: string;
  card: string;
  forces: Readonly<Record<string, { normal: number; elite: number }>>;
};
export type ForcePool = {
  id: string;
  name: string;
  total: number;
  normal: number;
  elite: number;
  advisors: boolean;
};

export function forceCounterName(faction: FactionId, kind: 'force' | 'special' | 'advisor') {
  if (kind === 'advisor') return 'Advisor';
  if (kind === 'special') return specialForceName(faction);
  return faction === 'ixians' ? 'Suboid' : faction === 'beneGesserit' ? 'Fighter' : 'Force';
}

function locationName(id: string, sector: number) {
  if (!Number.isSafeInteger(sector) || sector < 0) throw new Error('Invalid force location.');
  const name = territory(id).name;
  return sector > 0 ? `${name} · sector ${sector}` : name;
}

function pool(id: string, name: string, total: number, elite = 0, advisors = false): ForcePool {
  if (![total, elite].every(n => Number.isSafeInteger(n) && n >= 0) || elite > total)
    throw new Error('Invalid public force count.');
  return { id, name, total, normal: total - elite, elite, advisors };
}

/** Native Homeworlds subdivide reserves; only foreign deployments add a pool.
 * Concealed No-Fields are markers, never physical counters or inferred values.
 * A malformed projection produces no fabricated totals and cannot crash a table. */
export function forceInventory(player: PublicForcePlayer, worlds: readonly PublicForceWorld[] | null = null) {
  try {
    const reserves = pool('reserves', 'Reserves', player.reserves, player.elites?.reserves);
    const tanks = pool('tanks', 'Tleilaxu Tanks', player.tanks, player.elites?.tanks);
    const rows = [reserves, tanks];
    for (const key of [...new Set([...Object.keys(player.forces), ...Object.keys(player.elites?.forces ?? {})])].sort()) {
      const { territory: id, sector } = splitLocation(key);
      const row = pool(key, locationName(id, sector), player.forces[key] ?? 0,
        player.elites?.forces[key], isAdvisor(player, id));
      if (row.total > 0) rows.push(row);
    }
    const nativeReserves: ForcePool[] = [];
    for (const world of worlds ?? []) {
      const force = world.forces[player.id];
      if (!force) continue;
      const card = HOMEWORLD_CARDS.find(c => c.id === world.card);
      if (!card) throw new Error('Unknown Homeworld.');
      const row = pool(world.id, card.name, force.normal + force.elite, force.elite);
      if (world.native === player.id) nativeReserves.push(row);
      else if (row.total > 0) rows.push(row);
    }
    if (nativeReserves.length && (nativeReserves.reduce((n, r) => n + r.total, 0) !== reserves.total ||
      nativeReserves.reduce((n, r) => n + r.elite, 0) !== reserves.elite))
      throw new Error('Native reserves disagree with their Homeworld breakdown.');
    const marker = player.noField?.deployed?.location;
    const total = rows.reduce((n, r) => n + r.total, 0);
    if (!Number.isSafeInteger(total)) throw new Error('Invalid force inventory.');
    return {
      rows, nativeReserves,
      total,
      normal: rows.reduce((n, r) => n + r.normal, 0),
      elite: rows.reduce((n, r) => n + r.elite, 0),
      advisors: rows.reduce((n, r) => n + (r.advisors ? r.total : 0), 0),
      split: !!player.elites,
      marker: marker ? { name: locationName(marker.territory, marker.sector) } : null,
    };
  } catch {
    return null;
  }
}
