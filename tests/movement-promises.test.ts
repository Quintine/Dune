import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MovementClaimError, parseMovementClaim, validMovementClaim, movementClaimText,
  movementMatches, liveMovementPromises, movementEventAllowed,
  settleMovementEvent, finishMovementPromises, movementPromiseTargetAvailable,
  type MovementPromise,
} from '../game/movement-promises';
import { createGame, joinGame, newPlayer, type Game } from '../game/engine';

const claim = { territory: 'carthag', minimum: 6 };
const promise = (overrides: Partial<MovementPromise> = {}): MovementPromise => ({
  ...claim, turn: 2, player: 'target', asker: 'asker', answer: true, ...overrides,
});

void test('movement claims validate printed destinations and safe physical minima while extracting only claim fields', () => {
  assert.deepEqual(parseMovementClaim({ kind: 'movement', target: 'target', ...claim }), claim);
  assert.equal(validMovementClaim(promise()), true);
  assert.equal(movementClaimText(claim), 'make a ground movement of at least 6 physical forces to Carthag');
  for (const minimum of [0, -1, 1.5, 21, Infinity, NaN, '6', null, undefined])
    assert.throws(() => parseMovementClaim({ ...claim, minimum }), MovementClaimError);
  for (const territory of ['', 'homeworld:caladan', 'mobile_stronghold', 'missing', null])
    assert.equal(validMovementClaim({ ...claim, territory }), false);
  for (const value of [null, [], 'carthag', 6])
    assert.throws(() => parseMovementClaim(value), MovementClaimError);
  assert.deepEqual(parseMovementClaim({ territory: 'polar_sink', minimum: 1 }), { territory: 'polar_sink', minimum: 1 });
  assert.equal(validMovementClaim({ ...claim, minimum: 20 }), true);
});

void test('a movement promise needs one matching event rather than an aggregate of smaller arrivals', () => {
  let ledger = [promise()];
  const original = structuredClone(ledger);
  for (const amount of [2, 4, 5]) {
    ledger = settleMovementEvent(ledger, 'target', 2, { territory: 'carthag', amount });
    assert.equal(ledger[0].fulfilled, undefined);
  }
  assert.deepEqual(ledger, original);
  assert.equal(movementMatches(claim, null), false);
  assert.equal(movementMatches(claim, { territory: 'arrakeen', amount: 20 }), false);
  assert.equal(movementMatches(claim, { territory: 'carthag', amount: Infinity }), false);
  assert.equal(movementMatches(claim, { territory: 'carthag', amount: 6 }), true);
  const fulfilled = settleMovementEvent(ledger, 'target', 2, { territory: 'carthag', amount: 7 });
  assert.equal(fulfilled[0].fulfilled, true);
  assert.deepEqual(ledger, original);
});

void test('No survives a nonmatching first move and still rejects a later Hajr or Ornithopter matching event', () => {
  const original = [promise({ answer: false })];
  const afterFirst = settleMovementEvent(original, 'target', 2, { territory: 'arrakeen', amount: 8 });
  assert.equal(afterFirst[0].fulfilled, undefined);
  assert.equal(movementEventAllowed(afterFirst, { territory: 'carthag', amount: 6 }), false);
  assert.throws(() => settleMovementEvent(afterFirst, 'target', 2, { territory: 'carthag', amount: 6 }),
    /accepted No/);
  assert.deepEqual(afterFirst, original);
  assert.equal(movementEventAllowed(afterFirst, { territory: 'carthag', amount: 5 }), true);
  const finished = finishMovementPromises(afterFirst, 'target', 2);
  assert.equal(finished[0].fulfilled, true); assert.equal(original[0].fulfilled, undefined);
});

void test('a fulfilled Yes remains satisfied through later moves and actual turn completion', () => {
  const original = [promise()];
  assert.throws(() => finishMovementPromises(original, 'target', 2), /before ending movement/);
  const fulfilled = settleMovementEvent(original, 'target', 2, { territory: 'carthag', amount: 6 });
  const afterLater = settleMovementEvent(fulfilled, 'target', 2, { territory: 'arrakeen', amount: 1 });
  assert.equal(afterLater[0].fulfilled, true);
  assert.deepEqual(finishMovementPromises(afterLater, 'target', 2), afterLater);
  assert.equal(original[0].fulfilled, undefined);
});

void test('settlement and closing affect only live current-player promises and preserve their metadata', () => {
  const ledger = [
    { ...promise(), note: { source: 'original' } },
    { ...promise({ player: 'other', answer: false }), note: { source: 'other' } },
    { ...promise({ turn: 1, answer: false }), note: { source: 'old' } },
    { ...promise({ released: true }), note: { source: 'released' } },
    { ...promise({ fulfilled: true }), note: { source: 'fulfilled' } },
  ];
  const before = structuredClone(ledger);
  assert.deepEqual(liveMovementPromises(ledger, 'target', 2), [ledger[0]]);
  const result = settleMovementEvent(ledger, 'target', 2, { territory: 'carthag', amount: 6 });
  assert.equal(result[0].fulfilled, true); assert.deepEqual(result[0].note, ledger[0].note);
  assert.deepEqual(result.slice(1), ledger.slice(1)); assert.deepEqual(ledger, before);
  assert.deepEqual(finishMovementPromises(result, 'target', 2), result);
  assert.deepEqual(settleMovementEvent(ledger, 'target', 3, { territory: 'carthag', amount: 6 }), ledger);
  assert.equal(movementEventAllowed([promise({ answer: false, fulfilled: true }), promise({ answer: false, released: true })],
    { territory: 'carthag', amount: 6 }), true);
});

function movementBoundary(): Game {
  const g = createGame('MOVEMENTPROMISEBOUNDARY', newPlayer('target', 'Target', 'atreides'), false);
  joinGame(g, newPlayer('asker', 'Asker', 'emperor'));
  g.status = 'playing'; g.phase = 5; g.turn = 2; g.active = 'target';
  g.movementRemaining = ['target', 'asker']; g.players[0].shipped = true;
  return g;
}
void test('the Basic profile permits a clean active post-shipment respondent with Truthtrance or ordinary flight open', () => {
  const g = movementBoundary(); assert.equal(movementPromiseTargetAvailable(g, 'target'), true);
  g.truthtrance = { stage: 'ask', queue: [], passed: [], question: null };
  assert.equal(movementPromiseTargetAvailable(g, 'target'), true);
  g.ornithopter = { event: 'flight', player: 'target', turn: 2, mode: 'twoGroups', startingMove: 0, completed: 0,
    card: { id: 'richese-ornithopter', name: 'Ornithopter', kind: 'special', effect: 'ornithopter' } };
  assert.equal(movementPromiseTargetAvailable(g, 'target'), true);
  g.players[0].shipped = false; g.players[0].moved = 1;
  assert.equal(movementPromiseTargetAvailable(g, 'target'), true);
  assert.equal(movementPromiseTargetAvailable(g, 'asker'), false);
});
void test('movement question profile permits an unspent shipment but rejects an exhausted turn and active opposing response', () => {
  const unused = movementBoundary(); unused.players[0].shipped = false;
  assert.equal(movementPromiseTargetAvailable(unused, 'target'), true);
  const ended = movementBoundary(); ended.movementRemaining = ['asker'];
  assert.equal(movementPromiseTargetAvailable(ended, 'target'), false);
  const response = movementBoundary(); response.response = { kind: 'fremenMovement', owner: 'target', location: 'carthag:11', amount: 1, passed: [] };
  assert.equal(movementPromiseTargetAvailable(response, 'target'), false);
  const advanced = movementBoundary(); advanced.advanced = true;
  assert.equal(movementPromiseTargetAvailable(advanced, 'target'), false);
});
void test('Basic native selected families qualify, while optional modules and undeclared native families do not', () => {
  const native = movementBoundary(); native.players[0].faction = 'ixians'; native.expansions = ['ix'];
  assert.equal(movementPromiseTargetAvailable(native, 'target'), true);
  const missingFamily = structuredClone(native); missingFamily.expansions = [];
  assert.equal(movementPromiseTargetAvailable(missingFamily, 'target'), false);
  for (const key of ['homeworlds', 'nexusCards', 'leaderSkills', 'techTokens', 'strongholdCards',
    'discoveryEnabled', 'discoveries', 'discoveryStash', 'greatMaker', 'ecazTreachery'] as const) {
    const configured = { ...native, [key]: true } as unknown as Game;
    assert.equal(movementPromiseTargetAvailable(configured, 'target'), false, key);
  }
});
