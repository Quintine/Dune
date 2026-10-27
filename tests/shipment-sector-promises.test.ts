import test from 'node:test';
import assert from 'node:assert/strict';
import {
  matchesShipment,
  parseShipmentClaim,
  parseShipmentExpression,
  shipmentClaimDestinations,
  shipmentClaimText,
  shipmentExpressionOf,
  ShipmentClaimError,
  validShipmentClaim,
} from '../game/shipment-promises';

void test('sector-specific flat shipment keeps the selected physical destination', () => {
  const claim = parseShipmentClaim({ territory: 'wind_pass', minimum: 3, sector: 15 });
  assert.deepEqual(claim, { territory: 'wind_pass', minimum: 3, sector: 15 });
  assert.deepEqual(shipmentExpressionOf(claim), claim);
  assert.equal(shipmentClaimText(claim), 'ship at least 3 physical forces from your reserves to Wind Pass, sector 15');
  assert.equal(matchesShipment(claim, { territory: 'wind_pass', sector: 15, amount: 3 }), true);
  assert.equal(matchesShipment(claim, { territory: 'wind_pass', sector: 14, amount: 3 }), false);
  assert.equal(matchesShipment(claim, { territory: 'wind_pass', amount: 20 }), false);
  assert.equal(matchesShipment(claim, { territory: 'wind_pass', sector: 15, amount: 2 }), false);
  assert.equal(matchesShipment(claim, { territory: 'false_wall_west', sector: 15, amount: 3 }), false);
  assert.equal(matchesShipment(claim, null), false);
});

void test('sector constraints validate against the territory and reject invalid inputs', () => {
  for (const sector of [14.5, -1, 0, 19, NaN, Infinity, '15', null, undefined]) {
    assert.throws(() => parseShipmentClaim({ territory: 'wind_pass', minimum: 1, sector }), ShipmentClaimError);
    assert.equal(validShipmentClaim({ territory: 'wind_pass', minimum: 1, sector }), false);
  }
  assert.throws(() => parseShipmentExpression({ territory: 'wind_pass', minimum: 1, sector: 14, extra: true }), ShipmentClaimError);
  assert.throws(() => parseShipmentClaim({ claim: { territory: 'wind_pass', minimum: 1 }, sector: 14 }), ShipmentClaimError);
  assert.equal(validShipmentClaim({ territory: 'wind_pass', minimum: 1, sector: 14 }), true);
});

void test('nested sector alternatives share the actual one shipment and retain three-valued facts', () => {
  const claim = parseShipmentClaim({ claim: { op: 'or', terms: [
    { territory: 'wind_pass', minimum: 3, sector: 14 },
    { op: 'and', terms: [
      { territory: 'wind_pass', minimum: 5, sector: 15 },
      { constant: 'unknown' },
    ] },
  ] } }, { allowConstants: true });
  assert.deepEqual(shipmentClaimDestinations(claim), ['wind_pass']);
  assert.equal(matchesShipment(claim, { territory: 'wind_pass', sector: 14, amount: 3 }), true);
  assert.equal(matchesShipment(claim, { territory: 'wind_pass', sector: 15, amount: 5 }), null);
  assert.equal(matchesShipment(claim, { territory: 'wind_pass', sector: 16, amount: 5 }), false);
  assert.equal(matchesShipment(claim, { territory: 'wind_pass', amount: 5 }), false);
  assert.throws(() => shipmentClaimText(claim), ShipmentClaimError);
  const visible = parseShipmentClaim({ claim: { op: 'and', terms: [
    { territory: 'wind_pass', minimum: 1, sector: 14 },
    { territory: 'wind_pass', minimum: 2 },
  ] } });
  assert.match(shipmentClaimText(visible), /Wind Pass, sector 14 AND .*Wind Pass\)/);
});

void test('legacy territory-only claims preserve their exact JSON and match every sector', () => {
  const input = { territory: 'wind_pass', minimum: 2 };
  const claim = parseShipmentClaim(input);
  assert.deepEqual(claim, input);
  assert.equal(JSON.stringify(shipmentExpressionOf(claim)), JSON.stringify(input));
  assert.equal(shipmentClaimText(claim), 'ship at least 2 physical forces from your reserves to Wind Pass');
  assert.equal(matchesShipment(claim, { territory: 'wind_pass', sector: 15, amount: 2 }), true);
  assert.equal(matchesShipment(claim, { territory: 'wind_pass', sector: 14, amount: 2 }), true);
  assert.equal(matchesShipment(claim, { territory: 'wind_pass', amount: 2 }), true);
  assert.equal(matchesShipment(claim, null), false);
});
