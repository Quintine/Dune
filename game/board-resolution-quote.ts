import type { Player } from './engine';
import type { ForcePresence } from './force-presence';
import { presenceAt, presenceByLocation } from './force-presence';
import { fighterCount, isAdvisor } from './advisors';
import { quoteAidRefunds, PhaseResourceError } from './phase-resource-quote';
import { ecazOccupancyIdentity } from './ecaz-occupy';
import type { SharedSpiceLot } from './ecaz-spice-allocation';
import {
  gameDistance,
  gameTerritories,
  MOBILE_LOCATION,
  splitLocation,
  validLocation,
  type MobileBoard,
} from './board';

export class BoardResolutionError extends Error {}
function requireBoard(condition: unknown, message: string): asserts condition {
  if (!condition) throw new BoardResolutionError(message);
}
const whole = (n: unknown): n is number =>
  Number.isSafeInteger(n) && (n as number) >= 0;
export type BoardSeat = Pick<Player, 'id' | 'faction' | 'ally' | 'advisors'> &
  ForcePresence;
export type BoardContext = MobileBoard & {
  advanced: boolean;
  storm: number;
  order: readonly string[];
  players: readonly BoardSeat[];
};
export type AdvisorRelease = { player: string; territory: string };
function validKey(key: string) {
  const p = splitLocation(key);
  return (
    key === `${p.territory}:${p.sector}` && validLocation(p.territory, p.sector)
  );
}
/** A public board projection: no leader, hand, secret No-Field value or resource
 * reads. It returns stance changes instead of applying settleAdvisors to a clone. */
export function settledBoard(g: BoardContext) {
  requireBoard(
    whole(g.storm) &&
      g.storm <= 18 &&
      Array.isArray(g.order) &&
      new Set(g.order).size === g.order.length &&
      new Set(g.players.map((p) => p.id)).size === g.players.length &&
      g.order.length === g.players.length &&
      g.players.every((p) => g.order.includes(p.id)),
    'Board resolution needs the current distinct player order and storm sector.',
  );
  if (g.mobileStronghold?.location)
    requireBoard(
      validKey(g.mobileStronghold.location) &&
        g.mobileStronghold.location !== MOBILE_LOCATION,
      'The mobile stronghold needs its board pointer.',
    );
  for (const p of g.players) {
    requireBoard(
      Object.entries(p.forces).every(([key, n]) => validKey(key) && whole(n)) &&
        whole(Object.values(p.forces).reduce((a, n) => a + n, 0)),
      'Board resolution needs valid physical force locations and counts.',
    );
    const marker = p.noField?.deployed?.location;
    if (marker)
      requireBoard(
        validLocation(marker.territory, marker.sector),
        'The No-Field needs a valid board location.',
      );
  }
  const released: AdvisorRelease[] = [];
  const players = g.players.map((p) => {
    if (!g.advanced || p.faction !== 'beneGesserit' || !p.advisors) return p;
    const advisors = { ...p.advisors };
    for (const t of Object.keys(advisors))
      if (
        !presenceAt(p, t) ||
        !g.players.some((other) => other.id !== p.id && presenceAt(other, t))
      ) {
        delete advisors[t];
        released.push({ player: p.id, territory: t });
      }
    return {
      id: p.id,
      faction: p.faction,
      ally: p.ally,
      forces: p.forces,
      noField: p.noField,
      advisors,
    };
  });
  return { players, released };
}
export function quoteBattleBoard(g: BoardContext) {
  const { players, released } = settledBoard(g);
  const battles: { territory: string; attacker: string; defender: string }[] =
    [];
  for (const id of g.order) {
    const p = players.find((p) => p.id === id)!;
    for (const t of gameTerritories(g)) {
      if (t.type === 'polar' || !fighterCount(p, t.id)) continue;
      for (const other of players) {
        if (
          other.id === id ||
          other.id === p.ally ||
          !fighterCount(other, t.id) ||
          g.order.indexOf(other.id) < g.order.indexOf(id)
        )
          continue;
        const keys = (s: BoardSeat) =>
          Object.entries(presenceByLocation(s))
            .filter(
              ([key, n]) => n > 0 && splitLocation(key).territory === t.id,
            )
            .map(([key]) => key);
        if (
          keys(p).some((x) =>
            keys(other).some(
              (y) =>
                gameDistance(
                  g,
                  x,
                  y,
                  (key) =>
                    splitLocation(
                      key === MOBILE_LOCATION
                        ? (g.mobileStronghold?.location ?? key)
                        : key,
                    ).sector === g.storm,
                ) === 0,
            ),
          )
        )
          battles.push({ territory: t.id, attacker: id, defender: other.id });
      }
    }
  }
  return { released, battles };
}
export type CollectionContext = Omit<BoardContext, 'players'> & {
  players: readonly (BoardSeat & Pick<Player, 'spice' | 'elites'>)[];
  spice: Readonly<Record<string, number>>;
};
export type CollectionQuote = {
  released: AdvisorRelease[];
  spice: Record<string, number>;
  receipts: {
    player: string;
    strongholds: number;
    collected: number;
    /** Actual desert deposits, excluding bank income and shared escrow. */
    desert: number;
    balance: number;
  }[];
  /** Removed from the map, but not credited until the allies resolve allocation. */
  shared: SharedSpiceLot[];
  collectionBonus: {
    owner: string;
    ally: string;
    strongholds: string[];
    amount: number;
  } | null;
};
/** Ordinary collection retains storm order. Ecaz's jointly collected desert
 * lots are quoted once into escrow; this function never assumes agreement. */
export function quoteSpiceCollection(
  g: CollectionContext,
  ecazCollectionCanceled = false,
): CollectionQuote {
  const record = (value: unknown): value is Record<string, unknown> =>
    !!value && typeof value === 'object' && !Array.isArray(value);
  requireBoard(
    record(g) &&
      typeof g.advanced === 'boolean' &&
      typeof ecazCollectionCanceled === 'boolean' &&
      Array.isArray(g.players) &&
      g.players.length > 0 &&
      g.players.every((p) => record(p) && record(p.forces)) &&
      record(g.spice),
    'Collection needs a public board, seated players and spice deposits.',
  );
  try {
    ecazOccupancyIdentity(g.players, g.players[0].id, {
      kind: 'territory',
      id: 'polar_sink',
    });
  } catch (error) {
    throw new BoardResolutionError((error as Error).message);
  }
  const sites = gameTerritories(g);
  for (const p of g.players) {
    requireBoard(whole(p.spice), 'Collection needs a valid spice balance.');
    if (p.advisors !== undefined)
      requireBoard(
        record(p.advisors) &&
          Object.entries(p.advisors).every(
            ([id, stance]) =>
              sites.some((t) => t.id === id) &&
              record(stance) &&
              (stance.lockedTurn === undefined || whole(stance.lockedTurn)),
          ),
        'Collection needs valid advisor stances.',
      );
    if (p.elites !== undefined)
      requireBoard(
        record(p.elites) &&
          record(p.elites.forces) &&
          Object.entries(p.elites.forces).every(
            ([key, n]) =>
              validKey(key) && whole(n) && n <= (p.forces[key] ?? 0),
          ),
        'Collection needs valid physical elite groups.',
      );
  }
  const { players, released } = settledBoard(g);
  const spice = { ...g.spice };
  requireBoard(
    Object.entries(spice).every(([key, n]) => validKey(key) && whole(n)),
    'Collection needs valid spice locations and quantities.',
  );
  const capacities = new Map<string, Map<string, number>>();
  for (const p of players) {
    const original = g.players.find((other) => other.id === p.id)!;
    const rate =
      fighterCount(p, 'arrakeen') || fighterCount(p, 'carthag') ? 3 : 2;
    const capacity = new Map<string, number>();
    for (const [key, n] of Object.entries(presenceByLocation(p))) {
      if (
        splitLocation(key).sector === g.storm ||
        isAdvisor(p, splitLocation(key).territory)
      )
        continue;
      const cyborgs =
        p.faction === 'ixians' ? (original.elites?.forces[key] ?? 0) : 0;
      const amount = (n - cyborgs) * rate + cyborgs * 3;
      requireBoard(
        whole(n) && whole(amount),
        'Collection capacity would overflow its physical group.',
      );
      capacity.set(key, amount);
    }
    capacities.set(p.id, capacity);
  }
  const ecaz = players.find((p) => p.faction === 'ecaz');
  const ally = ecaz && players.find((p) => p.id === ecaz.ally);
  const jointTerritories = new Set<string>();
  if (ecaz && ally)
    for (const t of sites.filter((site) => site.type === 'sand')) {
      const collecting = (id: string) =>
        [...capacities.get(id)!].some(
          ([key, n]) =>
            n > 0 &&
            (spice[key] ?? 0) > 0 &&
            splitLocation(key).territory === t.id,
        );
      if (collecting(ecaz.id) && collecting(ally.id))
        jointTerritories.add(t.id);
    }
  let collectionBonus: CollectionQuote['collectionBonus'] = null;
  if (g.advanced && ecaz && ally) {
    const strongholds = ['arrakeen', 'carthag', 'tueks_sietch'].filter(
      (t) => fighterCount(ecaz, t) > 0 && fighterCount(ally, t) > 0,
    );
    if (strongholds.length)
      collectionBonus = {
        owner: ecaz.id,
        ally: ally.id,
        strongholds,
        amount: strongholds.reduce(
          (total, t) => total + (t === 'tueks_sietch' ? 1 : 2),
          0,
        ),
      };
  }
  const shared: SharedSpiceLot[] = [];
  const pooled = new Set<string>();
  const receipts: CollectionQuote['receipts'] = [];
  for (const id of g.order) {
    const p = players.find((p) => p.id === id)!,
      original = g.players.find((p) => p.id === id)!;
    let strongholds = g.advanced
      ? (fighterCount(p, 'arrakeen') ? 2 : 0) +
        (fighterCount(p, 'carthag') ? 2 : 0) +
        (fighterCount(p, 'tueks_sietch') ? 1 : 0)
      : 0;
    if (ecazCollectionCanceled && collectionBonus?.owner === id)
      strongholds -= collectionBonus.amount;
    let collected = 0;
    let desert = 0;
    for (const [key, capacity] of capacities.get(id)!) {
      const t = splitLocation(key).territory;
      if (
        ecaz &&
        ally &&
        (id === ecaz.id || id === ally.id) &&
        jointTerritories.has(t)
      ) {
        if (pooled.has(t)) continue;
        pooled.add(t);
        let amount = 0;
        for (const [at, remaining] of Object.entries(spice)) {
          if (splitLocation(at).territory !== t) continue;
          const jointCapacity =
            (capacities.get(ecaz.id)!.get(at) ?? 0) +
            (capacities.get(ally.id)!.get(at) ?? 0);
          requireBoard(
            whole(jointCapacity),
            'Joint collection capacity would overflow.',
          );
          const take = Math.min(remaining, jointCapacity);
          amount += take;
          requireBoard(whole(amount), 'Joint collection would overflow.');
          spice[at] = remaining - take;
        }
        if (amount > 0)
          shared.push({ territory: t, ecaz: ecaz.id, ally: ally.id, amount });
        continue;
      }
      const amount = Math.min(spice[key] ?? 0, capacity);
      collected += amount;
      if (sites.some((site) => site.id === t && site.type === 'sand'))
        desert += amount;
      spice[key] = (spice[key] ?? 0) - amount;
    }
    const balance = original.spice + strongholds + collected;
    requireBoard(
      whole(collected) && whole(balance),
      'Collection would overflow the spice balance.',
    );
    receipts.push({ player: id, strongholds, collected, desert, balance });
  }
  return { released, spice, receipts, shared, collectionBonus };
}

export type BattlePhaseEndContext = CollectionContext & {
  expansions: readonly string[];
  aid: Readonly<Record<string, { recipient: string; amount: number }>>;
};
/** Refund currently escrowed aid before the next phase. Ix opens a real phase
 * opportunity before collection, so future collection is not pre-accepted. */
export function quoteBattlePhaseAdvance(g: BattlePhaseEndContext) {
  let refunds: ReturnType<typeof quoteAidRefunds>;
  try {
    refunds = quoteAidRefunds(g.players, g.aid);
  } catch (error) {
    if (error instanceof PhaseResourceError)
      throw new BoardResolutionError(error.message);
    throw error;
  }
  const collection = g.expansions.includes('ix')
    ? null
    : quoteSpiceCollection({
        ...g,
        players: g.players.map((p) => ({
          id: p.id,
          faction: p.faction,
          ally: p.ally,
          advisors: p.advisors,
          forces: p.forces,
          elites: p.elites,
          noField: p.noField,
          spice: refunds.find((r) => r.player === p.id)?.balance ?? p.spice,
        })),
      });
  return { refunds, collection };
}

/** Stop at a remaining battle or the CHOAM market; neither is an automatic
 * permission to advance the phase. */
export function quoteBattleBoardContinuation(g: BattlePhaseEndContext) {
  const board = quoteBattleBoard(g);
  const phase =
    board.battles.length || g.players.some((p) => p.faction === 'choam')
      ? null
      : quoteBattlePhaseAdvance(g);
  return { board, phase };
}
