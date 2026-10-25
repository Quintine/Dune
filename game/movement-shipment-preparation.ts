import { gameDistance, gameTerritories, splitLocation, territory } from './board';
import type { Action, Game } from './engine';
import { liveMovementPromises } from './movement-promises';

/** Ordinary physical reserve shipments, not an AI shortlist. The authoritative
 * dispatcher supplies cost, funding, route and arrival legality. */
export function* movementShipmentPreparations(game: Game, actor: string,
  project: (game: Game, actor: string, action: Action) => Game | null,
): Generator<{ game: Game; actions: Action[] }> {
  const player = game.players.find(player => player.id === actor);
  if (!player || player.shipped || game.pendingNullentropy) return;
  const present = (territory: string) => Object.entries(player.forces)
    .filter(([key]) => splitLocation(key).territory === territory)
    .reduce((sum, [, amount]) => sum + amount, 0);
  const wanted = liveMovementPromises(game.movementPromises ?? [], actor, game.turn)
    .filter(promise => promise.answer).map(promise => territory(promise.territory));
  const destinations = [...gameTerritories(game)];
  const proximity = new Map(destinations.map(destination => [destination.id, wanted.length
    ? Math.min(...wanted.flatMap(target => destination.id === target.id ? [Number.MAX_SAFE_INTEGER]
      : destination.sectors.flatMap(from => target.sectors.map(to =>
        gameDistance(game, `${destination.id}:${from}`, `${target.id}:${to}`))))) : 0]));
  destinations.sort((a, b) => present(b.id) - present(a.id) ||
    Number(b.type === 'stronghold') - Number(a.type === 'stronghold') || proximity.get(a.id)! - proximity.get(b.id)!);
  for (const destination of destinations) for (const sector of destination.sectors) {
    if (player.faction === 'richese' && player.noField && !player.noField.deployed && player.noFieldEvent) {
      for (const token of player.noField.tokens.filter(token => token.id !== player.noField!.lastShipped)) {
        for (let allyPayment = Math.min(2, game.aid[player.ally ?? '']?.amount ?? 0); allyPayment >= 0; allyPayment--) {
          const action: Action = { type: 'ship', territory: destination.id, sector, amount: 1, elite: 0,
            allyPayment, noField: token.id, event: player.noFieldEvent };
          const next = project(game, actor, action);
          if (next) yield { game: next, actions: [action] };
        }
      }
    }
    for (let amount = 1; amount <= player.reserves; amount++) {
      const special = player.elites?.reserves ?? 0;
      for (let elite = Math.max(0, amount - (player.reserves - special)); elite <= Math.min(amount, special); elite++) {
        // The bare ordinary desert tariff is at most two per force. Enumerate
        // funding splits as well: retaining owned spice can preserve a later
        // Box fee. The dispatcher rejects stale/ineligible/over-price pledges.
        const maximum = Math.min(2 * amount, game.aid[player.ally ?? '']?.amount ?? 0);
        for (let allyPayment = maximum; allyPayment >= 0; allyPayment--) {
          const action: Action = { type: 'ship', territory: destination.id, sector, amount, elite, allyPayment };
          const next = project(game, actor, action);
          if (next) yield { game: next, actions: [action] };
        }
      }
    }
  }
}
