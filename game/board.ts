import data from './board-data.json';
import graphData from './board-graph.json';
import { DISCOVERY_LOCATIONS, isDiscoveryLocationId } from './discoveries';
export const TERRITORIES = data;
export const MOBILE_STRONGHOLD = 'hidden_mobile_stronghold';
export const MOBILE_LOCATION = `${MOBILE_STRONGHOLD}:0`;
const mobileTerritory = {
  id: MOBILE_STRONGHOLD,
  name: 'Hidden Mobile Stronghold',
  sectors: [0],
  type: 'stronghold',
  points: [
    [930, 80],
    [1160, 80],
    [1160, 150],
    [930, 150],
  ],
  center: [1045, 110],
  neighbors: [],
};
const discoveryTerritories = DISCOVERY_LOCATIONS.map((entry, index) => {
  const top = 180 + index * 80;
  return {
    id: entry.id,
    name: entry.name,
    sectors: [0],
    // Shipping and the shared two-faction admission rule treat every revealed
    // location like a stronghold. Victory applies its narrower rule separately.
    type: 'stronghold',
    points: [
      [930, top],
      [1160, top],
      [1160, top + 60],
      [930, top + 60],
    ],
    center: [1045, top + 30],
    neighbors: [],
  };
});
type DiscoveryBoardToken = {
  face: string | null;
  status: string;
  territory: string | null;
  sector: number | null;
  revealedTurn: number | null;
};
export type MobileBoard = {
  mobileStronghold?: { location: string | null } | null;
  discoveries?: { tokens: readonly DiscoveryBoardToken[] } | null;
};
function revealedDiscoveryLocations(g: MobileBoard) {
  const locations = new Map<string, { territory: string; sector: number }>();
  for (const token of g.discoveries?.tokens ?? []) {
    if (
      token.status !== 'placed' ||
      !Number.isSafeInteger(token.revealedTurn) ||
      (token.revealedTurn ?? 0) < 1 ||
      !isDiscoveryLocationId(token.face) ||
      typeof token.territory !== 'string' ||
      typeof token.sector !== 'number'
    )
      continue;
    const parent = TERRITORIES.find((t) => t.id === token.territory);
    if (!parent?.sectors.includes(token.sector)) continue;
    locations.set(token.face, {
      territory: token.territory,
      sector: token.sector,
    });
  }
  return locations;
}
/** Static printed board data stays shared; mobile and revealed Discovery
 * territories belong to a room. */
export function gameTerritories(g: MobileBoard) {
  const revealed = revealedDiscoveryLocations(g);
  const dynamic = [
    ...(g.mobileStronghold?.location ? [mobileTerritory] : []),
    ...discoveryTerritories.filter((t) => revealed.has(t.id)),
  ];
  return dynamic.length ? [...TERRITORIES, ...dynamic] : TERRITORIES;
}
export const territory = (id: string) => {
  const t =
    id === MOBILE_STRONGHOLD
      ? mobileTerritory
      : (discoveryTerritories.find((t) => t.id === id) ??
        TERRITORIES.find((t) => t.id === id));
  if (!t) throw new Error('Unknown territory.');
  return t;
};
export const GRAPH: Record<string, string[]> = graphData;
export const location = (id: string, sector: number) => `${id}:${sector}`;
export function splitLocation(key: string) {
  const [id, s] = key.split(':');
  return { territory: id, sector: Number(s) };
}
export function validLocation(id: string, sector: number) {
  if (id === MOBILE_STRONGHOLD) return sector === 0;
  if (isDiscoveryLocationId(id)) return sector === 0;
  return (
    TERRITORIES.find((t) => t.id === id)?.sectors.includes(sector) ?? false
  );
}
/** Structural location validity plus the room-local reveal requirement. The
 * mobile stronghold remains structurally available while awaiting placement. */
export function validGameLocation(g: MobileBoard, id: string, sector: number) {
  return (
    validLocation(id, sector) &&
    (!isDiscoveryLocationId(id) || revealedDiscoveryLocations(g).has(id))
  );
}
export function distance(
  from: string,
  to: string,
  blocked: (key: string) => boolean = () => false,
): number {
  if (blocked(from) || blocked(to)) return Infinity;
  if (from === to) return 0;
  const queue: [string, number][] = [[from, 0]],
    best = new Map([[from, 0]]);
  while (queue.length) {
    const [node, d] = queue.shift()!;
    for (const n of GRAPH[node] ?? []) {
      if (blocked(n)) continue;
      const next =
        d +
        (splitLocation(node).territory === splitLocation(n).territory ? 0 : 1);
      if (next < (best.get(n) ?? Infinity)) {
        best.set(n, next);
        queue.push([n, next]);
      }
    }
  }
  return best.get(to) ?? Infinity;
}

export const FREMEN_START = [
  'sietch_tabr',
  'false_wall_south',
  'false_wall_west',
];
export const FREMEN_START_LOCATIONS = FREMEN_START.flatMap((id) =>
  territory(id).sectors.map((s) => location(id, s)),
);

function dynamicEntrances(g: MobileBoard, key: string): string[] | undefined {
  if (key === MOBILE_LOCATION)
    return g.mobileStronghold?.location ? [g.mobileStronghold.location] : [];
  const at = splitLocation(key);
  if (!isDiscoveryLocationId(at.territory)) return undefined;
  if (at.sector !== 0) return [];
  const parent = revealedDiscoveryLocations(g).get(at.territory);
  if (!parent) return [];
  return territory(parent.territory).sectors.map((sector) =>
    location(parent.territory, sector),
  );
}

/** Room-local nested territories are dead ends. The mobile stronghold connects
 * through its pointer; a revealed Discovery location connects through any
 * sector of the surrounding territory and costs one extra movement territory. */
export function gameDistance(
  g: MobileBoard,
  from: string,
  to: string,
  blocked: (key: string) => boolean = () => false,
): number {
  const fromEntrances = dynamicEntrances(g, from);
  const toEntrances = dynamicEntrances(g, to);
  if (fromEntrances === undefined && toEntrances === undefined)
    return distance(from, to, blocked);
  if (!fromEntrances?.length && fromEntrances !== undefined) return Infinity;
  if (!toEntrances?.length && toEntrances !== undefined) return Infinity;
  // Preserve the mobile stronghold contract: battle callers project its
  // interior to the storm-covered pointer in their obstruction callback.
  if (
    (from === MOBILE_LOCATION && blocked(from)) ||
    (to === MOBILE_LOCATION && blocked(to))
  )
    return Infinity;
  if (from === to) return 0;
  const starts = fromEntrances ?? [from];
  const ends = toEntrances ?? [to];
  const endpointCost =
    Number(fromEntrances !== undefined) + Number(toEntrances !== undefined);
  return Math.min(
    ...starts.flatMap((start) =>
      ends.map((end) => endpointCost + distance(start, end, blocked)),
    ),
  );
}
/** A declared sector-by-sector route makes spice collection auditable. */
export function mobileRouteDistance(route: string[]): number {
  if (
    !route.length ||
    route.length > Object.keys(GRAPH).length ||
    new Set(route).size !== route.length
  )
    return Infinity;
  let steps = 0;
  for (let i = 0; i < route.length; i++) {
    if (!Object.hasOwn(GRAPH, route[i])) return Infinity;
    if (i) {
      if (!(GRAPH[route[i - 1]] ?? []).includes(route[i])) return Infinity;
      if (
        splitLocation(route[i - 1]).territory !==
        splitLocation(route[i]).territory
      )
        steps++;
    }
  }
  return steps;
}

/** One shortest connected route to each possible destination, for AI candidates. */
export function mobileRoutes(
  g: MobileBoard & { storm?: number },
  max: number,
): string[][] {
  const origin = g.mobileStronghold?.location;
  if (!origin || splitLocation(origin).sector === g.storm) return [];
  const queue: { route: string[]; cost: number }[] = [
    { route: [origin], cost: 0 },
  ];
  const best = new Map([[origin, 0]]);
  const result: string[][] = [];
  while (queue.length) {
    queue.sort((a, b) => a.cost - b.cost || a.route.length - b.route.length);
    const { route, cost } = queue.shift()!;
    const current = route.at(-1)!;
    if (cost !== best.get(current)) continue;
    if (
      route.length > 1 &&
      territory(splitLocation(current).territory).type !== 'stronghold'
    )
      result.push(route);
    for (const key of GRAPH[current] ?? []) {
      if (splitLocation(key).sector === g.storm) continue;
      const next =
        cost +
        (splitLocation(current).territory === splitLocation(key).territory
          ? 0
          : 1);
      if (next <= max && next < (best.get(key) ?? Infinity)) {
        best.set(key, next);
        queue.push({ route: [...route, key], cost: next });
      }
    }
  }
  return result;
}
