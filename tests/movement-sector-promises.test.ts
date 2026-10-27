import assert from 'node:assert/strict';
import test from 'node:test';
import { TERRITORIES } from '../game/board';
import {
  finishMovementPromises, movementClaimText, movementEventAllowed, movementMatches,
  parseMovementClaim, settleMovementEvent, validMovementClaim, type MovementPromise,
} from '../game/movement-promises';

const destination = TERRITORIES.find(row => row.sectors.length >= 2)!;
assert.ok(destination);
const [first, second] = destination.sectors;
const promise = (sector: number | undefined, answer: boolean, minimum = 2): MovementPromise => ({
  territory: destination.id, minimum, ...(sector === undefined ? {} : { sector }),
  event: 'promise', turn: 1, player: 'owner', asker: 'asker', answer,
});
const movement = (sector: number | undefined, amount = 2) => ({
  territory: destination.id, amount, ...(sector === undefined ? {} : { sector }),
});

void test('movement claim accepts one actual printed sector and preserves original territory-only data', () => {
  const claim = { territory: destination.id, minimum: 2, sector: first };
  assert.deepEqual(parseMovementClaim(claim), claim);
  assert.match(movementClaimText(claim), new RegExp(`sector ${first}`));
  assert.deepEqual(parseMovementClaim({ territory: destination.id, minimum: 2 }),
    { territory: destination.id, minimum: 2 });
  assert.equal(JSON.stringify(parseMovementClaim({ territory: destination.id, minimum: 2 })),
    JSON.stringify({ territory: destination.id, minimum: 2 }));
  assert.deepEqual(parseMovementClaim({ ...claim, turn: 1, player: 'owner' }), claim);
  for (const invalid of [undefined, null, -1, 1.1, '1', Math.max(...destination.sectors) + 100]) {
    assert.equal(validMovementClaim({ ...claim, sector: invalid }), false);
    assert.throws(() => parseMovementClaim({ ...claim, sector: invalid }));
  }
});

void test('sector match requires the actual movement destination, not a missing or different sector', () => {
  const exact = promise(first, true), generic = promise(undefined, true);
  assert.equal(movementMatches(exact, movement(first)), true);
  assert.equal(movementMatches(exact, movement(second)), false);
  assert.equal(movementMatches(exact, movement(undefined)), false);
  assert.equal(movementMatches(exact, movement(first, 1)), false);
  assert.equal(movementMatches(exact, movement(first, 21)), false);
  assert.equal(movementMatches(exact, null), false);
  assert.equal(movementMatches(generic, movement(first)), true);
  assert.equal(movementMatches(generic, movement(second)), true);
  assert.equal(movementMatches(generic, movement(undefined)), true);
});

void test('Yes remains live through other sectors and smaller groups; one actual group fulfills it', () => {
  const original = [promise(first, true, 3)];
  const other = settleMovementEvent(original, 'owner', 1, movement(second, 4));
  assert.equal(other[0].fulfilled, undefined);
  const small = settleMovementEvent(other, 'owner', 1, movement(first, 2));
  assert.equal(small[0].fulfilled, undefined);
  assert.throws(() => finishMovementPromises(small, 'owner', 1));
  const matching = settleMovementEvent(small, 'owner', 1, movement(first, 3));
  assert.equal(matching[0].fulfilled, true);
  assert.equal(original[0].fulfilled, undefined);
  assert.equal(finishMovementPromises(matching, 'owner', 1)[0].fulfilled, true);
});

void test('No blocks only its exact sector and retains the restriction across other movements', () => {
  const original = [promise(first, false)];
  assert.equal(movementEventAllowed(original, movement(first)), false);
  assert.throws(() => settleMovementEvent(original, 'owner', 1, movement(first)));
  const allowed = settleMovementEvent(original, 'owner', 1, movement(second));
  assert.equal(allowed[0].fulfilled, undefined);
  assert.equal(movementEventAllowed(allowed, movement(first)), false);
  assert.equal(finishMovementPromises(allowed, 'owner', 1)[0].fulfilled, true);
});

void test('distinct exact-sector Yes claims can be fulfilled by two distinct physical moves', () => {
  const rows = [promise(first, true), { ...promise(second, true), event: 'second-promise' }];
  const firstMove = settleMovementEvent(rows, 'owner', 1, movement(first));
  assert.equal(firstMove[0].fulfilled, true); assert.equal(firstMove[1].fulfilled, undefined);
  assert.throws(() => finishMovementPromises(firstMove, 'owner', 1));
  const secondMove = settleMovementEvent(firstMove, 'owner', 1, movement(second));
  assert.ok(secondMove.every(row => row.fulfilled));
});
