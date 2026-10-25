import assert from 'node:assert/strict';
import { viewGame, type Action } from '../game/engine';
import { createRicheseNoField, deployRicheseNoField, type NoFieldValue } from '../game/richese-no-field';
import { sandmasterDefaultChoice } from '../game/sandmaster-movement';
import { smugglerShipmentGame } from './smuggler-shipment-fixture';
import { sandmasterMove } from './sandmaster-movement-fixture';

/** Controlled conserved movement/pile supplement, not a played shipment source.
 * Native flight fixtures separately earn their actual sources and Spice blows. */
export function createSandmasterMarkerFixture(value: NoFieldValue = 0, physical = false, advanced = false) {
  const game = smugglerShipmentGame('richese', advanced, 'sandmaster', 'guild', ['choam']);
  const actor = 'p', player = game.players.find(seat => seat.id === actor)!;
  player.forces = { 'red_chasm:7': 3, 'arrakeen:10': 1 };
  player.reserves = 16; player.tanks = 0; player.shipped = true; player.moved = 0;
  const state = player.noField ?? createRicheseNoField(['controlled-marker-0', 'controlled-marker-3', 'controlled-marker-5']);
  const token = state.tokens.find(candidate => candidate.value === value); assert.ok(token);
  player.noField = deployRicheseNoField(state, { tokenId: token.id, controller: actor,
    location: { territory: 'red_chasm', sector: 7 } });
  player.noFieldEvent = 'controlled-sandmaster-marker-event';
  game.spice = {};
  const route = sandmasterMove(game, 2);
  const action: Action = { type: 'move', forces: physical ? { 'red_chasm:7': 3 } : {},
    noField: token.id, event: player.noFieldEvent, territory: route.territory, sector: route.sector };
  const choice = sandmasterDefaultChoice(viewGame(game, actor), actor, action); assert.ok(choice);
  action.sandmaster = choice;
  assert.equal(Object.keys(choice.routes).length, 1, 'Mixed marker/physical source shares one declared route');
  assert.equal(choice.collect.length, 2);
  return { game, actor, token, value, physical, advanced, action, choice,
    source: 'red_chasm:7', target: `${String(action.territory)}:${String(action.sector)}`,
    originalNoField: structuredClone(player.noField), originalEvent: player.noFieldEvent,
    originalSpice: structuredClone(game.spice), originalWallet: player.spice,
    staging: 'Explicitly controlled physical positions, deployed original token and positive piles; no native shipment/Spice chronology claimed.' };
}
