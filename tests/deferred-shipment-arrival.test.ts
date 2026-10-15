import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, type Action, type Game } from '../game/engine';
import {
  legacyGuildArrival,
  shipmentArrivalAction,
  shipmentArrivalGame,
  shipmentArrivalPlayer,
  shipmentArrivalReload,
} from './fixture-deferred-shipment-arrival';


function reject(g: Game, player: string, action: Action) {
  const before = structuredClone(g);
  assert.throws(() => applyAction(g, player, action));
  assert.deepEqual(g, before);
}


void test('a supported Guild allowance still commits once and opens the advisor choice', () => {
  let g = shipmentArrivalGame();
  g = applyAction(g, 'guild', shipmentArrivalAction);
  assert.equal(g.decision?.kind, 'guildShipment');
  g = applyAction(shipmentArrivalReload(g), 'guild', {
    type: 'decision',
    allow: true,
  });
  assert.deepEqual(shipmentArrivalPlayer(g, 'guild').forces, {
    'carthag:11': 4,
  });
  assert.equal(shipmentArrivalPlayer(g, 'guild').reserves, 16);
  assert.equal(shipmentArrivalPlayer(g, 'guild').shipped, true);
  assert.equal(g.pendingShipment, null);
  assert.equal(g.decision?.kind, 'advisor');
  assert.equal(g.decision?.player, 'bg');
});

void test('a malformed saved shipment remains rejected and is not treated as a recoverable arrival overlap', () => {
  const g = legacyGuildArrival();
  g.pendingShipment!.cost++;
  reject(g, 'guild', { type: 'decision', allow: true });
});

