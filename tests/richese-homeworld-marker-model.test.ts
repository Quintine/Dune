import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createRicheseNoField, deployRicheseNoField, isBoardNoFieldLocation,
  isHomeworldNoFieldLocation, moveRicheseNoField, projectRicheseNoField,
  recallRicheseNoField, revealRicheseNoField, validateRicheseNoField,
  type NoFieldLocation, type RicheseNoField,
} from '../game/richese-no-field';

const ids = ['zero', 'three', 'five'];
const home = { homeworld: 'homeworld:atreides' } as const;
const planet = { territory: 'polar_sink', sector: 0 } as const;
function placed(location: NoFieldLocation = home, tokenId = 'three') {
  return deployRicheseNoField(createRicheseNoField(ids), { tokenId, controller: 'richese', location });
}

void test('Homeworld marker preserves single physical token and hides its face in public projection', () => {
  const state = placed();
  assert.equal(state.lastShipped, 'three');
  assert.deepEqual(projectRicheseNoField(state, false), {
    deployed: { controller: 'richese', location: home, effectiveForces: 1 }, lastUsed: null,
  });
  assert.deepEqual(projectRicheseNoField(state, true).private, state);
  assert.throws(() => deployRicheseNoField(state, { tokenId: 'five', controller: 'richese', location: planet }));
  assert.equal(isHomeworldNoFieldLocation(state.deployed!.location), true);
  assert.equal(isBoardNoFieldLocation(state.deployed!.location), false);
});

void test('Homeworld reveal returns only existing reserves and keeps the prior shipment history', () => {
  for (const [tokenId, reserves, forces] of [['zero', 5, 0], ['three', 1, 1], ['five', 3, 3]] as const) {
    const before = placed(home, tokenId);
    const snapshot = structuredClone(before);
    const result = revealRicheseNoField(before, { tokenId, reserves, cause: 'battle' });
    assert.equal(result.forces, forces);
    assert.deepEqual(result.location, home);
    assert.equal(result.state.deployed, null);
    assert.equal(result.state.lastShipped, tokenId);
    assert.deepEqual(before, snapshot);
    assert.throws(() => deployRicheseNoField(result.state, { tokenId, controller: 'richese', location: planet }));
  }
});

void test('board and Homeworld location custody survives JSON and a face-down recall', () => {
  const board = placed(planet);
  assert.equal(isBoardNoFieldLocation(board.deployed!.location), true);
  assert.equal(isHomeworldNoFieldLocation(board.deployed!.location), false);
  assert.deepEqual(JSON.parse(JSON.stringify(board)), board);
  validateRicheseNoField(JSON.parse(JSON.stringify(board)) as RicheseNoField);
  const moved = moveRicheseNoField(board, 'three', home);
  assert.deepEqual(board.deployed!.location, planet);
  assert.deepEqual(moved.deployed!.location, home);
  const loaded = JSON.parse(JSON.stringify(moved)) as RicheseNoField;
  validateRicheseNoField(loaded);
  const returned = recallRicheseNoField(loaded, 'three');
  assert.equal(returned.deployed, null);
  assert.equal(returned.hiddenReturn, true);
  assert.equal(projectRicheseNoField(returned, false).lastUsed, null);
  assert.throws(() => deployRicheseNoField(returned, { tokenId: 'three', controller: 'richese', location: home }));
});

void test('Homeworld locations require a canonical identity and cannot mix with territory shape', () => {
  const fresh = createRicheseNoField(ids);
  for (const location of [
    { homeworld: 'homeworld:emperor:salusa' }, { homeworld: 'homeworld:choam' },
  ]) assert.doesNotThrow(() => deployRicheseNoField(fresh, { tokenId: 'zero', controller: 'richese', location }));
  for (const location of [
    { homeworld: 'homeworld:unknown' }, { homeworld: '' },
    { homeworld: 'homeworld:atreides', territory: 'polar_sink', sector: 0 },
    { territory: 'homeworld:atreides', sector: 0 },
  ]) assert.throws(() => deployRicheseNoField(fresh, {
    tokenId: 'zero', controller: 'richese', location: location as NoFieldLocation,
  }));
});
