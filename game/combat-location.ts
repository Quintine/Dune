import type { Game } from './engine';
import { gameTerritories } from './board';
import { homeworldContext } from './homeworld-game';
import {
  homeworldCombatLocation,
  quoteHomeworldBattles,
} from './homeworld-combat';
import { homeworldLocations, type HomeworldForces } from './homeworld-custody';
import {
  quoteBattleBoard,
  quoteBattleBoardContinuation,
} from './board-resolution-quote';

export type PublicCombatLocation = {
  id: string;
  name: string;
  kind: 'territory' | 'homeworld';
  native?: string;
  nativeBattleStrength?: number;
  forces?: Record<string, HomeworldForces>;
};
export function homeworldBattleLocation(g: Game, id: string) {
  if (!id.startsWith('homeworld:')) return null;
  if (!g.homeworlds?.custody)
    throw new Error('Homeworld combat requires saved Homeworld custody.');
  const context = homeworldContext(g);
  return homeworldCombatLocation(
    {
      ...context,
      order: g.order,
      players: context.players.map((p) => ({
        ...p,
        ally: g.players.find((seat) => seat.id === p.id)!.ally,
      })),
    },
    g.homeworlds.custody,
    id,
  );
}
export function combatLocations(g: Game): PublicCombatLocation[] {
  const board: PublicCombatLocation[] = gameTerritories(g).map(
    ({ id, name }) => ({ id, name, kind: 'territory' }),
  );
  if (!g.homeworlds?.custody) return board;
  return [
    ...board,
    ...homeworldLocations(homeworldContext(g)).map(({ id }) => {
      const home = homeworldBattleLocation(g, id)!;
      return {
        id,
        name: home.name,
        kind: 'homeworld' as const,
        native: home.native,
        nativeBattleStrength: home.nativeBattleStrength,
        forces: home.forces,
      };
    }),
  ];
}
export function combatLocationName(g: Game, id: string): string {
  const home = homeworldBattleLocation(g, id);
  const name = home?.name ?? gameTerritories(g).find((t) => t.id === id)?.name;
  if (!name) throw new Error('Choose a current combat location.');
  return name;
}
export function combatArmy(
  g: Game,
  player: string,
  id: string,
): HomeworldForces {
  const home = homeworldBattleLocation(g, id);
  if (home) return { ...(home.forces[player] ?? { normal: 0, elite: 0 }) };
  combatLocationName(g, id);
  const p = g.players.find((p) => p.id === player);
  if (!p) throw new Error('Choose a seated combatant.');
  const count = (map: Record<string, number>) =>
    Object.entries(map).reduce(
      (sum, [key, n]) =>
        sum + (key.slice(0, key.lastIndexOf(':')) === id ? n : 0),
      0,
    );
  const elite = count(p.elites?.forces ?? {});
  return { normal: count(p.forces) - elite, elite };
}
export function quoteCombatBoard(g: Game) {
  const board = quoteBattleBoard(g);
  if (!g.homeworlds?.custody) return board;
  const context = homeworldContext(g);
  const worlds = quoteHomeworldBattles(
    {
      ...context,
      order: g.order,
      players: context.players.map((p) => ({
        ...p,
        ally: g.players.find((seat) => seat.id === p.id)!.ally,
      })),
    },
    g.homeworlds.custody,
  );
  return {
    ...board,
    battles: [...board.battles, ...worlds].sort(
      (a, b) => g.order.indexOf(a.attacker) - g.order.indexOf(b.attacker),
    ),
  };
}
export function quoteCombatBoardContinuation(g: Game) {
  const board = quoteCombatBoard(g);
  return board.battles.length
    ? { board, phase: null }
    : quoteBattleBoardContinuation(g);
}
