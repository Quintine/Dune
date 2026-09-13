import assert from 'node:assert/strict';
import type { FactionId } from '../game/catalog';
import type { Action, Game } from '../game/engine';
import { viewGame } from '../game/engine';
import {
  GRAPH,
  mobileRouteDistance,
  splitLocation,
  territory,
} from '../game/board';
import {
  sandmasterDefaultChoice,
  sandmasterEnteredTerritories,
  sandmasterShortestRoute,
} from '../game/sandmaster-movement';
import { smugglerShipmentGame } from './smuggler-shipment-fixture';

export function sandmasterMovementGame(
  faction: FactionId = 'emperor',
  advanced = false,
): Game {
  const g = smugglerShipmentGame(faction, advanced, 'sandmaster');
  g.players[0].shipped = true;
  g.players[0].forces = { 'red_chasm:7': 3 };
  g.players[0].reserves = 17;
  if (faction !== 'fremen') {
    g.players[0].forces['arrakeen:10'] = 1;
    g.players[0].reserves--;
  }
  g.spice = {};
  return g;
}
export function sandmasterMove(g: Game, steps = 2): Action {
  const from = 'red_chasm:7';
  const route = Object.keys(GRAPH)
    .map((to) => sandmasterShortestRoute(g, 'p', from, to, steps))
    .find(
      (route) =>
        route &&
        mobileRouteDistance(route) === steps &&
        sandmasterEnteredTerritories({ [from]: route }).length === steps &&
        sandmasterEnteredTerritories({ [from]: route }).every(
          (id) => territory(id).type === 'sand',
        ),
    );
  assert.ok(route);
  for (const id of sandmasterEnteredTerritories({ [from]: route })) {
    const sector = territory(id).sectors.find((s) => s !== g.storm)!;
    g.spice[`${id}:${sector}`] = 4;
  }
  const target = splitLocation(route.at(-1)!);
  const action: Action = {
    type: 'move',
    from,
    amount: 3,
    territory: target.territory,
    sector: target.sector,
  };
  action.sandmaster = sandmasterDefaultChoice(viewGame(g, 'p'), 'p', action);
  return action;
}
