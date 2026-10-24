import type { Action, Game, Player } from './engine';
import { gameTerritories, splitLocation } from './board';
import { liveMovementPromises, movementEventAllowed, settleMovementEvent, type MovementEvent, type MovementPromise } from './movement-promises';

export type MovementPromiseAdapter = {
  allowance: (game: Game, player: Player) => number;
  prepareHajr: (game: Game, player: string) => Game | null;
  reachable: (game: Game, player: Player, origin: string, destination: string, sector: number) => boolean;
  project: (game: Game, player: string, action: Action) => { game: Game; event: MovementEvent } | null;
};
export type MovementCompletion = { actions: Action[] };

/** Enumerate actual physical subgroups from one territory, including native
 * elite allocations and several sectors. No strategic shortlist proves legality. */
function* groups(player: Player, keys: string[], amount: number, index = 0,
  forces: Record<string, number> = {}, elites: Record<string, number> = {}): Generator<Action> {
  if (index === keys.length) {
    if (amount === 0) yield { type: 'move', forces: { ...forces }, eliteForces: { ...elites } };
    return;
  }
  const key = keys[index], special = player.elites?.forces[key] ?? 0;
  const ordinary = player.forces[key] - special;
  for (let elite = 0; elite <= Math.min(amount, special); elite++)
    for (let normal = Math.min(ordinary, amount - elite); normal >= 0; normal--) {
      const count = elite + normal;
      if (count) forces[key] = count; else delete forces[key];
      if (elite) elites[key] = elite; else delete elites[key];
      yield* groups(player, keys, amount - count, index + 1, forces, elites);
    }
  delete forces[key]; delete elites[key];
}

/** Finite owned-action reachability. Each move consumes a real entitlement;
 * Hajr and Ornithopter are existing physical cards, never invented future draws.
 * The adapter shares authoritative movement validation/physical commitment.
 * Opposing arrival outcomes are not simulated or assumed. */
export function findMovementCompletion(source: Game, actor: string,
  promises: readonly MovementPromise[], adapter: MovementPromiseAdapter): MovementCompletion | null {
  const failed = new Set<string>();
  const search = (game: Game, pending: readonly MovementPromise[], actions: Action[]): MovementCompletion | null => {
    const live = liveMovementPromises(pending, actor, game.turn);
    if (!live.some(promise => promise.answer)) return { actions };
    const player = game.players.find(candidate => candidate.id === actor)!;
    const physical = Object.values(player.forces).reduce((sum, amount) => sum + amount, 0);
    if (live.some(promise => promise.answer && promise.minimum > physical)) return null;
    const key = JSON.stringify([player.forces, player.elites, player.moved, player.hand.map(card => card.id),
      player.hajrPlays, player.ornithopterExtraMoves, game.hajr, game.ornithopter ? [game.ornithopter.mode, game.ornithopter.startingMove, game.ornithopter.completed, game.ornithopter.cohort] : null,
      live.map(promise => [promise.territory, promise.minimum, promise.answer])]);
    if (failed.has(key)) return null;
    const destinations = gameTerritories(game).filter(destination => !destination.id.startsWith('homeworld:'));
    destinations.sort((a, b) => Number(live.some(p => p.answer && p.territory === b.id)) -
      Number(live.some(p => p.answer && p.territory === a.id)));
    if (player.moved < adapter.allowance(game, player)) {
      const origins = [...new Set(Object.keys(player.forces).filter(key => player.forces[key] > 0)
        .map(key => splitLocation(key).territory))];
      const card = !game.ornithopter ? player.hand.find(card => card.effect === 'ornithopter') : null;
      const modes: Partial<Action>[] = game.ornithopter
        ? [{ ornithopterEvent: game.ornithopter.event }]
        : [{}, ...(card ? [{ movementCard: card.id, ornithopter: 'range3' },
          { movementCard: card.id, ornithopter: 'twoGroups' }] : [])];
      for (const destination of destinations) for (const sector of destination.sectors) for (const origin of origins) {
        if (!adapter.reachable(game, player, origin, destination.id, sector)) continue;
        const keys = Object.keys(player.forces).filter(key => player.forces[key] > 0 && splitLocation(key).territory === origin);
        const total = keys.reduce((sum, key) => sum + player.forces[key], 0);
        const amounts = Array.from({ length: total }, (_, i) => i + 1);
        amounts.sort((a, b) => Number(live.some(p => p.answer && p.territory === destination.id && b >= p.minimum)) -
          Number(live.some(p => p.answer && p.territory === destination.id && a >= p.minimum)) || a - b);
        for (const amount of amounts) {
          const event = { territory: destination.id, amount };
          if (!movementEventAllowed(live, event)) continue;
          for (const group of groups(player, keys, amount)) for (const mode of modes) {
            const action = { ...group, ...mode, territory: destination.id, sector };
            const next = adapter.project(game, actor, action);
            if (!next) continue;
            const settled = settleMovementEvent(pending, actor, game.turn, next.event);
            next.game.movementPromises = structuredClone(settled);
            const result = search(next.game, settled, [...actions, action]);
            if (result) return result;
          }
        }
      }
    }
    const prepared = adapter.prepareHajr(game, actor);
    if (prepared) {
      const card = player.hand.find(card => card.effect === 'hajr')!;
      const result = search(prepared, live, [...actions, { type: 'card', card: card.id }]);
      if (result) return result;
    }
    failed.add(key); return null;
  };
  const initial = structuredClone(source); initial.movementPromises = structuredClone([...promises]);
  return search(initial, promises, []);
}
