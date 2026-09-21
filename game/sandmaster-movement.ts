import { ordinaryLeaderSkillModeSupported } from './leader-skill-profile';
import type { Action, Game, GameView } from './engine';
import { GRAPH, location, mobileRouteDistance, splitLocation } from './board';
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
export function sandmasterPathBlocked(
  g: Game | GameView,
  player: string,
  from: string,
  key: string,
): boolean {
  const p = g.players.find((p) => p.id === player);
  if (!p || !Object.hasOwn(GRAPH, key)) return true;
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
/** Multiple piles retain the existing unresolved physical-pile boundary. */
export function sandmasterCollectible(
  g: Game | GameView,
  routes: Record<string, string[]>,
): string[] {
  return sandmasterEnteredTerritories(routes).flatMap((id) => {
    const piles = Object.entries(g.spice).filter(
      ([key, n]) => splitLocation(key).territory === id && n > 0,
    );
    return piles.length === 1 ? [piles[0][0]] : [];
  });
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
        mobileRouteDistance(route) <= move.range &&
        route.every((key) => !sandmasterPathBlocked(g, player, from, key)),
      'Sandmaster needs a connected route within movement range, outside blocked sectors.',
    );
    routes[from] = [...route];
  }
  const collect = value.collect;
  const available = sandmasterCollectible(g, routes);
  requireMove(
    collect.every(
      (key) => typeof key === 'string' && available.includes(key),
    ) && new Set(collect).size === collect.length,
    'Collect once per entered territory with one unambiguous spice pile, or decline that collection.',
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
    for (const key of GRAPH[last] ?? []) {
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
  return { routes, collect: sandmasterCollectible(g, routes) };
}
