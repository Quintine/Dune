import { ordinaryLeaderSkillModeSupported } from './leader-skill-profile';
import type { Action, Game, GameView } from './engine';
import { GRAPH, location, mobileRouteDistance, splitLocation, MOBILE_LOCATION, validGameLocation } from './board';
import { isAdvisor } from './advisors';
import { strongholdPathBlocked } from './occupancy';
import { botMovementRange } from './bot-mobility';

export class SandmasterMovementError extends Error {}
export type SandmasterChoice = {
  routes: Record<string, string[]>;
  collect: string[];
};
export type SandmasterOrder = {
  group: [string, number][];
  eliteGroup: Record<string, number>;
  elite: number;
  origin: string;
  to: string;
  sector: number;
  range: number;
};
export type SandmasterMovement = SandmasterChoice & {
  leader: string;
  turn: number;
  move: number;
  order: string;
  piles: { key: string; before: number }[];
};
function requireMove(ok: unknown, message: string): asserts ok {
  if (!ok) throw new SandmasterMovementError(message);
}
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

export function sandmasterModeSupported(g: Game | GameView): boolean {
  return ordinaryLeaderSkillModeSupported(g);
}
export function sandmasterLeader(
  g: Game | GameView,
  player: string,
): string | null {
  const skill = g.leaderSkills?.assignments.find(
    (a) => a.owner === player && a.skill === 'sandmaster',
  );
  if (
    !skill ||
    ('controller' in skill && skill.controller !== player) ||
    ('faceUp' in skill && !skill.faceUp)
  )
    return null;
  const leader = g.players
    .find((p) => p.id === player)
    ?.leaders.find((l) => l.id === skill.leader);
  return leader && !leader.dead && !leader.capturedBy && !leader.gholaBy
    ? leader.id
    : null;
}

export type SandmasterDestinationCollection = {
  leader: string;
  key: string | null;
  before: number;
  blocked: string | null;
};

/** Direct relocation enters only its destination, never an invented route. */
export function sandmasterDestinationCollection(
  game: Game | GameView,
  player: string,
  origin: string,
  destination: string,
  sector: number,
): SandmasterDestinationCollection | null {
  const leader = sandmasterLeader(game, player);
  if (!leader) return null;
  const blocked = (reason: string): SandmasterDestinationCollection =>
    ({ leader, key: null, before: 0, blocked: reason });
  if (!sandmasterModeSupported(game))
    return blocked('Sandmaster collection with this configuration is still being integrated.');
  if (origin === destination || !validGameLocation(game, destination, sector) ||
      sector === game.storm)
    return blocked('Choose a different legal destination territory for Sandmaster collection.');
  let key: string | null = null;
  let before = 0;
  for (const pile in game.spice) {
    const at = splitLocation(pile);
    if (at.territory !== destination) continue;
    const amount = game.spice[pile];
    if (!validGameLocation(game, at.territory, at.sector) ||
        pile !== location(at.territory, at.sector) ||
        !Number.isSafeInteger(amount) || amount < 0)
      return blocked('Sandmaster needs a valid destination spice pile.');
    if (!amount) continue;
    if (key) return blocked('Sandmaster collection among multiple spice piles awaits its allocation ruling.');
    key = pile;
    before = amount;
  }
  if (!key) return blocked('There is no spice to collect at this destination.');
  const spice = game.players.find(p => p.id === player)?.spice;
  if (!Number.isSafeInteger(spice) || !Number.isSafeInteger(spice! + 1))
    return blocked('Sandmaster collection needs a valid spice balance.');
  return { leader, key, before, blocked: null };
}

export function sandmasterPathBlocked(
  g: Game | GameView,
  player: string,
  from: string,
  key: string,
): boolean {
  const p = g.players.find((p) => p.id === player);
  const pointer = g.mobileStronghold?.location;
  if (!p || (!Object.hasOwn(GRAPH, key) && key !== MOBILE_LOCATION)) return true;
  if (key === MOBILE_LOCATION && (!pointer || !Object.hasOwn(GRAPH, pointer) ||
    (!!splitLocation(pointer).sector && splitLocation(pointer).sector === g.storm))) return true;
  const at = splitLocation(key);
  return (
    (!!at.sector && at.sector === g.storm) ||
    strongholdPathBlocked(
      g.players,
      player,
      at.territory,
      isAdvisor(p, splitLocation(from).territory),
    )
  );
}

/** The HMS interior is a room-local dead end connected only through its pointer. */
export function sandmasterAdjacent(g: Game | GameView, key: string): string[] {
  const pointer = g.mobileStronghold?.location;
  if (key === MOBILE_LOCATION) return pointer && Object.hasOwn(GRAPH, pointer) ? [pointer] : [];
  return [...(GRAPH[key] ?? []), ...(pointer === key ? [MOBILE_LOCATION] : [])];
}

/** Ordinary forces may enter or leave HMS; this never relocates its pointer. */
export function sandmasterRouteDistance(g: Game | GameView, route: string[]): number {
  if (!route.includes(MOBILE_LOCATION)) return mobileRouteDistance(route);
  if (!route.length || route.length > Object.keys(GRAPH).length + 1 ||
    new Set(route).size !== route.length || route.slice(1, -1).includes(MOBILE_LOCATION)) return Infinity;
  let steps = 0;
  for (let index = 0; index < route.length; index++) {
    const key = route[index];
    if (key !== MOBILE_LOCATION && !Object.hasOwn(GRAPH, key)) return Infinity;
    if (key === MOBILE_LOCATION && !sandmasterAdjacent(g, key).length) return Infinity;
    if (!index) continue;
    if (!sandmasterAdjacent(g, route[index - 1]).includes(key)) return Infinity;
    steps += Number(splitLocation(route[index - 1]).territory !== splitLocation(key).territory);
  }
  return steps;
}
/** Only crossing a territory boundary enters a new collection opportunity. */
export function sandmasterEnteredTerritories(
  routes: Record<string, string[]>,
): string[] {
  return [
    ...new Set(
      Object.values(routes).flatMap((route) =>
        route.slice(1).flatMap((key, i) => {
          const id = splitLocation(key).territory;
          return id !== splitLocation(route[i]).territory ? [id] : [];
        }),
      ),
    ),
  ];
}
/** Optional collection chooses at most one existing pile in each entered territory. */
export function sandmasterCollectionPiles(
  g: Game | GameView,
  routes: Record<string, string[]>,
): Record<string, string[]> {
  const choices: Record<string, string[]> = {};
  const keys = Object.keys(g.spice);
  for (const id of sandmasterEnteredTerritories(routes)) {
    const piles = keys.filter(key => splitLocation(key).territory === id && g.spice[key] > 0).sort();
    if (piles.length) choices[id] = piles;
  }
  return choices;
}
export function quoteSandmasterMovement(
  g: Game | GameView,
  player: string,
  move: SandmasterOrder,
  value: unknown,
): SandmasterMovement {
  const p = g.players.find((p) => p.id === player),
    leader = sandmasterLeader(g, player);
  requireMove(
    sandmasterModeSupported(g) &&
      leader &&
      p &&
      g.phase === 5 &&
      g.active === player,
    'Sandmaster collection needs its living native trainer and an ordinary supported movement.',
  );
  requireMove(
    record(value) &&
      Object.keys(value).sort().join(',') === 'collect,routes' &&
      record(value.routes) &&
      Array.isArray(value.collect),
    'Choose Sandmaster routes and optional collection territories.',
  );
  const sources = move.group.map(([key]) => key);
  requireMove(
    sources.length > 0 &&
      new Set(sources).size === sources.length &&
      JSON.stringify(Object.keys(value.routes).sort()) ===
        JSON.stringify([...sources].sort()),
    'Every moving source sector needs its own Sandmaster route.',
  );
  const routes: Record<string, string[]> = {};
  for (const from of sources) {
    const route = value.routes[from];
    requireMove(
      Array.isArray(route) &&
        route.every((k) => typeof k === 'string') &&
        route[0] === from &&
        route.at(-1) === location(move.to, move.sector) &&
        sandmasterRouteDistance(g, route) <= move.range &&
        route.every((key) => !sandmasterPathBlocked(g, player, from, key)),
      'Sandmaster needs a connected route within movement range, outside blocked sectors.',
    );
    routes[from] = [...route];
  }
  const collect = value.collect;
  const offered = sandmasterCollectionPiles(g, routes);
  requireMove(
    collect.every(key => typeof key === 'string' &&
      offered[splitLocation(key).territory]?.includes(key)) &&
      new Set(collect.map(key => splitLocation(key).territory)).size === collect.length,
    'Choose at most one positive pile per entered territory, or decline its collection.',
  );
  return {
    leader,
    turn: g.turn,
    move: p.moved ?? 0,
    order: JSON.stringify(move),
    routes,
    collect: [...collect],
    piles: collect.map((key) => ({ key, before: g.spice[key] })),
  };
}
export function validateSandmasterMovement(
  g: Game,
  player: string,
  move: SandmasterOrder,
  saved: SandmasterMovement,
): void {
  requireMove(record(saved), 'The saved Sandmaster movement is missing.');
  const current = quoteSandmasterMovement(g, player, move, {
    routes: saved.routes,
    collect: saved.collect,
  });
  requireMove(
    JSON.stringify(saved) === JSON.stringify(current),
    'The saved Sandmaster movement or board spice has changed.',
  );
}

/** A deterministic shortest route is a default; humans can choose a different legal route. */
export function sandmasterShortestRoute(
  g: Game | GameView,
  player: string,
  from: string,
  to: string,
  range: number,
): string[] | null {
  if (sandmasterPathBlocked(g, player, from, from)) return null;
  const queue = [{ route: [from], cost: 0 }],
    best = new Map([[from, 0]]);
  while (queue.length) {
    queue.sort((a, b) => a.cost - b.cost || a.route.length - b.route.length);
    const { route, cost } = queue.shift()!,
      last = route.at(-1)!;
    if (cost !== best.get(last)) continue;
    if (last === to) return route;
    for (const key of sandmasterAdjacent(g, last)) {
      if (sandmasterPathBlocked(g, player, from, key)) continue;
      const next =
        cost +
        Number(splitLocation(last).territory !== splitLocation(key).territory);
      if (next <= range && next < (best.get(key) ?? Infinity)) {
        best.set(key, next);
        queue.push({ route: [...route, key], cost: next });
      }
    }
  }
  return null;
}
export function sandmasterActionOrder(
  g: GameView,
  player: string,
  action: Action,
): SandmasterOrder | null {
  const p = g.players.find((p) => p.id === player);
  if (
    !p ||
    action.type !== 'move' ||
    action.noField !== undefined ||
    action.planetologist !== undefined ||
    action.movementCard !== undefined ||
    action.ornithopterEvent !== undefined ||
    action.discoveryOrnithopter !== undefined ||
    g.ornithopter?.active
  )
    return null;
  const group: [string, number][] = record(action.forces)
    ? (Object.entries(action.forces).filter(
        ([, n]) => typeof n === 'number' && n > 0,
      ) as [string, number][])
    : typeof action.from === 'string' && typeof action.amount === 'number'
      ? [[action.from, action.amount]]
      : [];
  if (
    !group.length ||
    group.some(
      ([key, n]) =>
        !Number.isSafeInteger(n) || n <= 0 || n > (p.forces[key] ?? 0),
    ) ||
    new Set(group.map(([key]) => splitLocation(key).territory)).size !== 1 ||
    typeof action.territory !== 'string' ||
    typeof action.sector !== 'number'
  )
    return null;
  const eliteGroup = Object.fromEntries(
    group.map(([key]) => [
      key,
      Number(
        record(action.eliteForces)
          ? (action.eliteForces[key] ?? 0)
          : (action.elite ?? 0),
      ),
    ]),
  );
  const elite = Object.values(eliteGroup).reduce((a, b) => a + b, 0);
  return {
    group,
    eliteGroup,
    elite,
    origin: splitLocation(group[0][0]).territory,
    to: action.territory,
    sector: action.sector,
    range: botMovementRange(g, p, elite),
  };
}
export function sandmasterDefaultChoice(
  g: GameView,
  player: string,
  action: Action,
): SandmasterChoice | null {
  if (!sandmasterModeSupported(g) || !sandmasterLeader(g, player)) return null;
  const move = sandmasterActionOrder(g, player, action);
  if (!move) return null;
  const routes: Record<string, string[]> = {};
  for (const [from] of move.group) {
    const route = sandmasterShortestRoute(
      g,
      player,
      from,
      location(move.to, move.sector),
      move.range,
    );
    if (!route) return null;
    routes[from] = route;
  }
  return { routes, collect: Object.values(sandmasterCollectionPiles(g, routes)).map(piles => piles[0]) };
}
