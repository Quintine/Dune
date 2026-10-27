import assert from 'node:assert/strict';
import test from 'node:test';
import { TERRITORIES } from '../game/board';
import { compileMixedActionExpression, type MixedActionExpression } from '../game/mixed-action-question';
import {
  parseTravelActionClaim, recordTravelShipment, travelBranches, travelPromiseValue, validateTravelPromises,
  type TravelActionClaim, type TravelPromise,
} from '../game/travel-expression-promises';

const destination = TERRITORIES.find(territory => territory.sectors.length >= 2)!;
assert.ok(destination);
const [first, second] = destination.sectors;
const ship = (minimum: number, sector?: number): MixedActionExpression<TravelActionClaim> => ({
  kind: 'action', action: { kind: 'ship', territory: destination.id, minimum,
    ...(sector === undefined ? {} : { sector }) },
});
const group = (kind: 'and' | 'or', ...terms: MixedActionExpression<TravelActionClaim>[]): MixedActionExpression<TravelActionClaim> =>
  ({ kind, terms });
function promise(mixed: MixedActionExpression<TravelActionClaim>, answer = true): TravelPromise {
  return { turn: 1, mixed, event: 'travel', player: 'owner', asker: 'asker', answer,
    compiled: compileMixedActionExpression(mixed, () => 'yes', answer),
    shipment: { pending: true, event: null }, progress: [], movementClosed: false,
    fulfilled: false, released: false };
}

void test('only a physical reserve shipment may name a real printed destination sector', () => {
  const input = { kind: 'ship', territory: destination.id, minimum: 2, sector: first };
  assert.deepEqual(parseTravelActionClaim(input), input);
  assert.deepEqual(parseTravelActionClaim({ kind: 'ship', territory: destination.id, minimum: 2 }),
    { kind: 'ship', territory: destination.id, minimum: 2 });
  for (const value of [
    { ...input, kind: 'move' }, { ...input, sector: -1 }, { ...input, sector: 1.2 },
    { ...input, sector: undefined }, { ...input, minimum: 0 }, { ...input, extra: true },
    { ...input, sector: Math.max(...destination.sectors) + 100 },
  ]) assert.throws(() => parseTravelActionClaim(value));
});

void test('sector claims compare actual destination and counts without inventing a legacy sector', () => {
  const row = promise(ship(2, first));
  const [correct] = recordTravelShipment([row], 'owner', 1, { territory: destination.id, amount: 2, sector: first });
  assert.equal(correct.fulfilled, true);
  assert.equal(travelPromiseValue(correct), true);
  assert.deepEqual(correct.shipment.event, { territory: destination.id, amount: 2, sector: first });
  const [otherSector] = recordTravelShipment([row], 'owner', 1, { territory: destination.id, amount: 2, sector: second });
  assert.equal(otherSector.fulfilled, false);
  assert.equal(travelPromiseValue(otherSector), false);
  const [legacy] = recordTravelShipment([row], 'owner', 1, { territory: destination.id, amount: 2 });
  assert.equal(travelPromiseValue(legacy), false);
  assert.deepEqual(legacy.shipment.event, { territory: destination.id, amount: 2 });
  validateTravelPromises([JSON.parse(JSON.stringify(correct))], ['owner', 'asker']);
});

void test('sectorless original questions retain their original serialized receipt shape', () => {
  const row = promise(ship(2));
  const [settled] = recordTravelShipment([row], 'owner', 1, { territory: destination.id, amount: 2, sector: first });
  assert.equal(settled.fulfilled, true);
  assert.deepEqual(settled.shipment.event, { territory: destination.id, amount: 2 });
  validateTravelPromises([JSON.parse(JSON.stringify(settled))], ['owner', 'asker']);
});

void test('a whole No blocks the matching sector and permits another legal sector or no shipment', () => {
  const row = promise(ship(2, first), false);
  assert.throws(() => recordTravelShipment([row], 'owner', 1, { territory: destination.id, amount: 2, sector: first }));
  const [different] = recordTravelShipment([row], 'owner', 1, { territory: destination.id, amount: 2, sector: second });
  assert.equal(travelPromiseValue(different), false);
  const [absent] = recordTravelShipment([row], 'owner', 1, null);
  assert.equal(travelPromiseValue(absent), false);
});

void test('AND and No alternatives retain single-shipment sector correlations', () => {
  const incompatible = promise(group('and', ship(1, first), ship(1, second)));
  assert.deepEqual([...travelBranches(incompatible)], []);
  const compatible = promise(group('and', ship(2), ship(3, first)));
  const branches = [...travelBranches(compatible)];
  assert.equal(branches.length, 1);
  assert.equal(branches[0].length, 2);
  const alternative = promise(group('and', ship(2), ship(3, first)), false);
  assert.equal([...travelBranches(alternative)].length, 2);
  const mixed = promise(group('and', ship(3, first), ship(2)), false);
  const [matching] = recordTravelShipment([mixed], 'owner', 1, { territory: destination.id, amount: 3, sector: second });
  assert.equal(travelPromiseValue(matching), false);
});

void test('stored sector receipts reject mismatched or invented printed sectors', () => {
  const row = promise(ship(2, first));
  for (const event of [
    { territory: destination.id, amount: 1, sector: -1 },
    { territory: destination.id, amount: 1, sector: Math.max(...destination.sectors) + 100 },
    { territory: destination.id, amount: 1, sector: first, extra: true },
  ]) assert.throws(() => recordTravelShipment([row], 'owner', 1, event));
});
