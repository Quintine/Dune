import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, type Action, type Game } from '../game/engine';
import {
  addShipmentArrivalAmbassador,
  legacyGuildArrival,
  richeseNoFieldArrivalAction,
  shipmentArrivalAction,
  shipmentArrivalGame,
  shipmentArrivalPlayer,
  shipmentArrivalReload,
  shipmentArrivalResources,
} from './fixture-deferred-shipment-arrival';

const overlap = /Ambassadors combined with another arrival reaction/;

function reject(g: Game, player: string, action: Action, pattern: RegExp) {
  const before = structuredClone(g);
  assert.throws(() => applyAction(g, player, action), pattern);
  assert.deepEqual(g, before);
}

void test('an ordinary Guild shipment rejects a known Ambassador and advisor overlap before declaration or payment', (t) => {
  const g = shipmentArrivalGame();
  addShipmentArrivalAmbassador(g);
  const resources = structuredClone(shipmentArrivalResources(g));
  const uuid = t.mock.method(crypto, 'randomUUID', () => {
    throw Error('Unsupported shipment allocated an event');
  });
  reject(g, 'guild', shipmentArrivalAction, overlap);
  assert.deepEqual(shipmentArrivalResources(g), resources);
  assert.equal(g.pendingShipment, null);
  assert.equal(g.decision, null);
  assert.equal(uuid.mock.callCount(), 0);
});

void test('an own Richese No-Field rejects the unsupported arrival before saving its private cancellation response', () => {
  const g = shipmentArrivalGame();
  g.active = 'richese';
  shipmentArrivalPlayer(g, 'richese').shipped = false;
  addShipmentArrivalAmbassador(g);
  const action = richeseNoFieldArrivalAction(g);
  const before = structuredClone(g);
  assert.throws(() => applyAction(g, 'richese', action), overlap);
  assert.deepEqual(g, before);
  assert.equal(g.pendingShipment, null);
  assert.equal(g.response, null);
  assert.equal(g.decision, null);
  assert.equal(shipmentArrivalPlayer(g, 'richese').noField!.deployed, null);
});

void test('a saved Guild allowance returns only the uncommitted ordinary shipment and permits a safe replacement', () => {
  const g = legacyGuildArrival();
  const before = structuredClone(g);
  const resources = structuredClone(shipmentArrivalResources(g));
  const returned = applyAction(shipmentArrivalReload(g), 'guild', {
    type: 'decision',
    allow: true,
  });
  assert.deepEqual(g, before);
  assert.deepEqual(shipmentArrivalResources(returned), resources);
  assert.equal(returned.pendingShipment, null);
  assert.equal(returned.decision, null);
  assert.equal(shipmentArrivalPlayer(returned, 'guild').shipped, false);
  assert.deepEqual(shipmentArrivalPlayer(returned, 'guild').forces, {});
  assert.match(returned.log.at(-1)!.text, overlap);
  assert.match(
    returned.log.at(-1)!.text,
    /No forces, spice, cards or shipment allowance were spent/,
  );

  const retried = applyAction(returned, 'guild', {
    ...shipmentArrivalAction,
    territory: 'polar_sink',
    sector: 0,
  });
  assert.equal(retried.decision?.kind, 'guildShipment');
  assert.equal(retried.pendingShipment?.territory, 'polar_sink');
});

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
  reject(
    g,
    'guild',
    { type: 'decision', allow: true },
    /declared shipment price is no longer current/,
  );
});

void test('forged or null special receipts cannot enter the ordinary legacy return path', () => {
  for (const corrupt of [
    (g: Game) => {
      g.pendingShipment!.ambassadorEvent = 'forged';
    },
    (g: Game) => {
      g.pendingShipment!.guildSecretEvent = null as unknown as string;
    },
  ]) {
    const g = legacyGuildArrival();
    corrupt(g);
    reject(g, 'guild', { type: 'decision', allow: true }, overlap);
    assert.ok(g.pendingShipment);
    assert.equal(g.decision?.kind, 'guildShipment');
  }
});
