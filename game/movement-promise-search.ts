import type { Action, Game, Player } from './engine';
import { gameTerritories, splitLocation } from './board';
import { liveMovementPromises, movementEventAllowed, movementMatches, settleMovementEvent, type MovementEvent, type MovementPromise } from './movement-promises';
import { evaluateMovementExpression, liveMovementExpressionPromises, movementExpressionTerritories,
  MovementExpressionPromiseError, recordMovementExpressionEvent, type MovementExpression,
  type MovementExpressionPromise } from './movement-expression-promises';

export type MovementPromiseAdapter = {
  allowance: (game: Game, player: Player) => number;
  canFinish: (game: Game, player: string) => boolean;
  /** A required preparation may itself need a real first move, such as the
   * native Advanced Hajr window, even without a positive destination claim. */
  needsProgress?: (game: Game, player: string) => boolean;
  progressKey?: (game: Game, player: string) => unknown;
  preparations: (game: Game, player: string) => Iterable<{ game: Game; actions: Action[] }>;
  reachable: (game: Game, player: Player, origin: string, destination: string, sector: number) => boolean;
  project: (game: Game, player: string, action: Action) => { game: Game; event: MovementEvent } | null;
};
export type MovementCompletion = { actions: Action[]; early?: { phase: number; action: Action }[] };

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
 * Hajr, Ornithopter, Ghola, Kulon and Box use owned physical cards and known or
 * already-paid recovery choices, never invented unknown future draws.
 * The adapter shares authoritative movement validation/physical commitment.
 * Opposing arrival outcomes are not simulated or assumed. */
export function findMovementCompletion(source: Game, actor: string,
  promises: readonly MovementPromise[], adapter: MovementPromiseAdapter,
  expressions: readonly MovementExpressionPromise[] = source.movementExpressionPromises ?? []): MovementCompletion | null {
  const failed = new Set<string>();
  const retainWhole = expressions.length > 0 || source.movementExpressionPromises !== undefined;
  const search = (game: Game, pending: readonly MovementPromise[], whole: readonly MovementExpressionPromise[],
    actions: Action[]): MovementCompletion | null => {
    const live = liveMovementPromises(pending, actor, game.turn);
    const liveWhole = liveMovementExpressionPromises(whole, actor, game.turn);
    const positiveWhole = liveWhole.filter(promise => promise.answer);
    const needsMove = live.some(promise => promise.answer) || positiveWhole.length > 0;
    if (!needsMove && adapter.canFinish(game, actor)) return { actions };
    const player = game.players.find(candidate => candidate.id === actor)!;
    const physical = Object.values(player.forces).reduce((sum, amount) => sum + amount, 0);
    // A held recovery card may return more than five over several real plays
    // or Box reuse. Tanks are only an optimistic bound; the adapter still
    // validates every owned card and never inspects unknown Box faces here.
    const recovery = player.hand.some(card => card.effect === 'ghola' || card.effect === 'nullentropyBox') ? player.tanks : 0;
    const marker = player.faction === 'richese' ? player.noField?.deployed : null;
    const markerValue = marker ? player.noField!.tokens.find(token => token.id === marker.tokenId)?.value ?? 0 : 0;
    const revealable = Math.min(markerValue, player.reserves + recovery);
    const possiblePhysical = physical + (player.shipped ? revealable : player.reserves + recovery);
    if (live.some(promise => promise.answer && promise.minimum > possiblePhysical) ||
      positiveWhole.some(promise => !evaluateMovementExpression(promise.claim,
        movementExpressionTerritories(promise.claim).map(territory => ({ territory,
          maximum: Math.max(promise.progress.find(entry => entry.territory === territory)?.maximum ?? 0,
            Math.min(20, possiblePhysical)) }))))) return null;
    const key = JSON.stringify([player.forces, player.elites, player.advisors, player.moved, player.shipped, player.reserves, player.tanks, player.hand.map(card => card.id),
      player.hajrPlays, player.hajrWindow, player.ornithopterExtraMoves, player.spice, game.choamMovement,
      player.fremenMovementBlocked, player.ixMovementBlocked, player.advisorFlipMovementBlocked, game.advisorMatchingDenied,
      player.noField, player.noFieldEvent,
      game.advisorPreparation,
      game.aid, game.karamaShipping, game.guildRateBlocked, game.shipmentPromises,
      game.discard.map(card => card.id), game.movementDiscardKnowledge?.[actor], game.pendingNullentropy,
      game.choamWorthlessBlocked, game.hajr, game.ornithopter ? [game.ornithopter.mode, game.ornithopter.startingMove, game.ornithopter.completed, game.ornithopter.cohort] : null,
      live.map(promise => [promise.territory, promise.minimum, promise.answer]),
      liveWhole.map(promise => [promise.claim, promise.answer, promise.progress]), adapter.progressKey?.(game, actor)]);
    if (failed.has(key)) return null;
    const destinations = gameTerritories(game).filter(destination => !destination.id.startsWith('homeworld:'));
    const wanted = new Set([...live.filter(promise => promise.answer).map(promise => promise.territory),
      ...positiveWhole.flatMap(promise => movementExpressionTerritories(promise.claim))]);
    destinations.sort((a, b) => Number(wanted.has(b.id)) - Number(wanted.has(a.id)) ||
      (marker ? Number(['arrakeen', 'carthag'].includes(b.id)) - Number(['arrakeen', 'carthag'].includes(a.id)) : 0));
    if ((needsMove || adapter.needsProgress?.(game, actor)) && (marker || !live.some(promise => promise.answer && promise.minimum > physical)) &&
      !game.pendingNullentropy && player.moved < adapter.allowance(game, player)) {
      const origins = [...new Set([...Object.keys(player.forces).filter(key => player.forces[key] > 0)
        .map(key => splitLocation(key).territory), ...(marker ? [marker.location.territory] : [])])];
      const card = !game.ornithopter ? player.hand.find(card => card.effect === 'ornithopter') : null;
      const modes: Partial<Action>[] = game.ornithopter
        ? [{ ornithopterEvent: game.ornithopter.event }]
        : [{}, ...(card ? [{ movementCard: card.id, ornithopter: 'range3' },
          { movementCard: card.id, ornithopter: 'twoGroups' }] : [])];
      const stances: Partial<Action>[] = game.advanced && player.faction === 'beneGesserit'
        ? [{}, { fighters: true }] : [{}];
      // An exhausted ordinary move cannot leave Yes pending without an owned
      // card that could grant another move. Treat held Box/Hajr/Ornithopter
      // conservatively; their actual availability remains the adapter's job.
      const mayMoveAgain = player.moved + 1 < adapter.allowance(game, player) || !!game.ornithopter ||
        player.hand.some(card => ['hajr', 'ornithopter', 'nullentropyBox'].includes(card.effect ?? ''));
      for (const destination of destinations) for (const sector of destination.sectors) for (const origin of origins) {
        if (!adapter.reachable(game, player, origin, destination.id, sector)) continue;
        const keys = Object.keys(player.forces).filter(key => player.forces[key] > 0 && splitLocation(key).territory === origin);
        const total = keys.reduce((sum, key) => sum + player.forces[key], 0);
        const carriesMarker = marker?.location.territory === origin && !!player.noFieldEvent;
        const amounts = [...(carriesMarker ? [0] : []), ...Array.from({ length: total }, (_, i) => i + 1)];
        const helpsWhole = (expression: MovementExpression, amount: number): boolean => 'terms' in expression
          ? expression.terms.some(term => helpsWhole(term, amount))
          : expression.territory === destination.id && amount >= expression.minimum;
        const helps = (amount: number) => live.some(p => p.answer && p.territory === destination.id && amount >= p.minimum) ||
          positiveWhole.some(promise => helpsWhole(promise.claim, amount));
        amounts.sort((a, b) => Number(helps(b)) - Number(helps(a)) || a - b);
        for (const amount of amounts) {
          const event = { territory: destination.id, amount };
          if (!movementEventAllowed(live, event)) continue;
          if (!mayMoveAgain && live.some(promise => promise.answer && !movementMatches(promise, event))) continue;
          let projectedWhole: MovementExpressionPromise[];
          try { projectedWhole = recordMovementExpressionEvent(whole, actor, game.turn, event); }
          catch (error) { if (error instanceof MovementExpressionPromiseError) continue; throw error; }
          if (!mayMoveAgain && liveMovementExpressionPromises(projectedWhole, actor, game.turn).some(promise => promise.answer)) continue;
          const markers: Partial<Action>[] = carriesMarker
            ? [...(amount ? [{}] : []), { noField: marker!.tokenId, event: player.noFieldEvent }] : [{}];
          for (const group of groups(player, keys, amount)) for (const mode of modes) for (const stance of stances) for (const selected of markers) {
            const action = { ...group, ...mode, ...stance, ...selected, territory: destination.id, sector };
            const next = adapter.project(game, actor, action);
            if (!next) continue;
            const settled = settleMovementEvent(pending, actor, game.turn, next.event);
            // The projection owns the exact physical amount (markers excluded).
            // Keep promise progress on detached states only.
            let settledWhole: MovementExpressionPromise[];
            try { settledWhole = recordMovementExpressionEvent(whole, actor, game.turn, next.event); }
            catch (error) { if (error instanceof MovementExpressionPromiseError) continue; throw error; }
            next.game.movementPromises = structuredClone(settled);
            if (retainWhole) next.game.movementExpressionPromises = structuredClone(settledWhole);
            const result = search(next.game, settled, settledWhole, [...actions, action]);
            if (result) return result;
          }
        }
      }
    }
    for (const prepared of adapter.preparations(game, actor)) {
      const result = search(prepared.game, live, whole, [...actions, ...prepared.actions]);
      if (result) return result;
    }
    failed.add(key); return null;
  };
  const initial = structuredClone(source); initial.movementPromises = structuredClone([...promises]);
  if (retainWhole) initial.movementExpressionPromises = structuredClone([...expressions]);
  return search(initial, promises, expressions, []);
}
