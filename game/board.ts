import data from './board-data.json';
import graphData from './board-graph.json';
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
export type MobileBoard = {
  mobileStronghold?: { location: string | null } | null;
};
/** Static printed board data stays shared; the mobile territory belongs to a room. */
export function gameTerritories(g: MobileBoard) {
  return g.mobileStronghold?.location
    ? [...TERRITORIES, mobileTerritory]
    : TERRITORIES;
}
export const territory = (id: string) => {
  const t =
    id === MOBILE_STRONGHOLD
      ? mobileTerritory
      : TERRITORIES.find((t) => t.id === id);
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
  return (
    TERRITORIES.find((t) => t.id === id)?.sectors.includes(sector) ?? false
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

/** The mobile stronghold is a dead end, one territory from its pointing sector. */
export function gameDistance(
  g: MobileBoard,
  from: string,
  to: string,
  blocked: (key: string) => boolean = () => false,
): number {
  if (from !== MOBILE_LOCATION && to !== MOBILE_LOCATION)
    return distance(from, to, blocked);
  const pointer = g.mobileStronghold?.location;
  if (!pointer || blocked(from) || blocked(to)) return Infinity;
  if (from === to) return 0;
  return (
    1 +
    distance(
      from === MOBILE_LOCATION ? pointer : from,
      to === MOBILE_LOCATION ? pointer : to,
      blocked,
    )
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
