import test from 'node:test';
import assert from 'node:assert/strict';
import { invalidShipmentClause } from '../components/shipment-claim-fields';

void test('empty, fractional and out-of-range compound counts stay invalid rather than coercing to a different promise', () => {
  for (const minimum of [NaN, 0, 2.5, 21]) {
    assert.equal(invalidShipmentClause({ territory: 'arrakeen', minimum }), true);
  }
  for (const minimum of [1, 20]) assert.equal(invalidShipmentClause({ territory: 'arrakeen', minimum }), false);
});

