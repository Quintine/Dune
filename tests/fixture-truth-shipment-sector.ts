import assert from 'node:assert/strict';
import { type Action, type Game } from '../game/engine';
import {
  actTruthTurnAction, createTruthTurnActionFixture, declareTruthTurnAction,
  truthTurnActionInventory, truthTurnActionPlayer,
} from './fixture-truth-turn-action';

export const actTruthShipmentSector = actTruthTurnAction;
export const sectorShipment = (territory: string, sector: number, minimum = 1) => ({
  kind: 'action' as const, action: { kind: 'ship' as const, territory, minimum, sector },
});
/** Genuine original Harkonnen/Atreides/Emperor Basic setup, including both
 * truly dealt original Truthtrances, real auction/Revival and prior movement.
 * This adapter selects two printed Imperial Basin sectors outside the actual
 * current storm; it changes no card, resource, piece, clock or saved state. */
export function createTruthShipmentSectorFixture() {
  const base = createTruthTurnActionFixture();
  const game = structuredClone(base.game), territory = 'imperial_basin';
  const sectors = [9, 10, 11].filter(sector => sector !== game.storm);
  assert.ok(sectors.length >= 2); const [sector, alternative] = sectors;
  assert.equal(game.advanced, false); assert.equal(game.turn, 1); assert.equal(game.phase, 5);
  assert.equal(game.active, base.target); assert.equal(truthTurnActionPlayer(game, base.target).shipped, false);
  assert.ok(truthTurnActionPlayer(game, base.target).spice >= 2);
  assert.deepEqual(truthTurnActionInventory(game), base.originalCards);
  const mixed = sectorShipment(territory, sector);
  const shipment = (where: number): Action => ({ type: 'ship', territory, sector: where,
    amount: 1, elite: 0, allyPayment: 0 });
  return { base, game, asker: base.asker, target: base.target, observer: base.observer,
    truths: base.truths, originalCards: base.originalCards, territory, sector, alternative, mixed, shipment };
}
export type TruthShipmentSectorFixture = ReturnType<typeof createTruthShipmentSectorFixture>;
export function askTruthShipmentSector(game: Game, f: TruthShipmentSectorFixture, mixed: unknown = f.mixed): Game {
  return actTruthShipmentSector(game, f.asker, { type: 'truthAsk', question: {
    kind: 'turnActions', target: f.target, turn: game.turn, mixed: structuredClone(mixed),
  } } as Action);
}
export function bindTruthShipmentSector(f: TruthShipmentSectorFixture, answer: 'yes' | 'no',
  mixed: unknown = f.mixed, source: Game = f.game, copy: 0 | 1 = 0) {
  const declared = declareTruthTurnAction(f.base, source, copy).game;
  const asked = askTruthShipmentSector(declared, f, mixed);
  const game = actTruthShipmentSector(asked, f.target, { type: 'truthAnswer', answer });
  return { declared, asked, game };
}
