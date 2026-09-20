import { smugglerShipmentGame } from './smuggler-shipment-fixture';
import type { Action } from '../game/engine';

/** Genuine Leader Skills setup, followed by a conserved post-Nexus ride position. */
export function sandmasterWormGame(advanced = false, intrusion = false) {
  const g = smugglerShipmentGame('fremen', advanced, 'sandmaster', intrusion ? 'beneGesserit' : 'guild');
  const own = g.players[0];
  own.name = 'Sandmaster rider';
  own.forces = { 'wind_pass:14': 2, 'wind_pass:15': 2 };
  own.reserves = 16; own.spice = 5; own.moved = 1;
  if (own.elites) own.elites = { forces: { 'wind_pass:14': 1, 'wind_pass:15': 1 }, reserves: 1, tanks: 0, revived: 0 };
  Object.assign(g, { phase: 1, nexus: true, spiceSequence: { pile: 1, skipped: [] },
    wormRides: [], movementRemaining: null, decision: { kind: 'wormRide', player: 'p', territory: 'wind_pass' },
    spice: { 'wind_pass:14': 7, 'red_chasm:7': 2 } });
  if (intrusion) {
    const bg = g.players[1];
    bg.forces = { 'red_chasm:7': 1 }; bg.reserves = 19;
    bg.advisors = {};
  }
  return g;
}
export function sandmasterRide(collect: boolean | undefined = true): Action {
  return { type: 'decision', accept: true, territory: 'red_chasm', sector: 7,
    forces: { 'wind_pass:14': 2, 'wind_pass:15': 2 },
    eliteForces: { 'wind_pass:14': 1, 'wind_pass:15': 1 },
    ...(collect === undefined ? {} : { sandmasterCollect: collect }) };
}
