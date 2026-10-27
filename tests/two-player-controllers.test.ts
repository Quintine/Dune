import assert from 'node:assert/strict';
import test from 'node:test';
import {
  TwoPlayerControllersError,
  addTwoPlayerControlledSeat as add,
  controllerStrongholdTarget as target,
  createTwoPlayerControllers as create,
  physicalControllerCount as count,
  validateTwoPlayerControllersComplete as complete,
  validateTwoPlayerControllersLobby as lobby,
  type TwoPlayerControllers,
} from '../game/two-player-controllers';

const seats = ['atreides', 'harkonnen', 'fremen', 'guild'];
function assembled(): TwoPlayerControllers {
  let state = create();
  state = add(state, seats, 'atreides', 'atreides');
  state = add(state, seats, 'atreides', 'fremen');
  state = add(state, seats, 'harkonnen', 'harkonnen');
  return add(state, seats, 'harkonnen', 'guild');
}

void test('lobby additions create two distinct primary controllers without mutating inputs', () => {
  const empty = create(), first = add(empty, seats, 'atreides', 'atreides');
  const prior = structuredClone(first);
  const second = add(first, seats, 'atreides', 'fremen');
  assert.deepEqual(empty, { version: 1, controllers: [] });
  assert.deepEqual(first, prior);
  assert.notEqual(second.controllers, first.controllers);
  assert.notEqual(second.controllers[0].seats, first.controllers[0].seats);
  lobby(second, seats);
  assert.throws(() => complete(second, seats), TwoPlayerControllersError);
  const ready = assembled();
  complete(ready, seats);
  assert.deepEqual(ready.controllers, [
    { id: 'atreides', seats: ['atreides', 'fremen'] },
    { id: 'harkonnen', seats: ['harkonnen', 'guild'] },
  ]);
});

void test('full mapping counts two people and keeps faction alliances separate', () => {
  const state = assembled();
  assert.equal(count(seats, state), 2);
  assert.equal(target(seats, state, false), 4);
  assert.equal(target(seats, state, true), 4);
  assert.deepEqual(state.controllers[0].seats, ['atreides', 'fremen']);
  // Without the explicit mode, four faction seats remain four players.
  assert.equal(count(seats), 4);
  assert.equal(target(seats, undefined, false), 3);
  assert.equal(target(seats, undefined, true), 4);
  assert.equal(target(seats.slice(0, 2), null, false), 4);
  assert.equal(count(['a', 'b', 'c', 'd', 'e', 'f']), 6);
});

void test('lobby mapping rejects duplicate, foreign, missing and forged primary assignments', () => {
  for (const value of [
    { version: 1, controllers: [{ id: 'atreides', seats: ['atreides', 'atreides'] }] },
    { version: 1, controllers: [{ id: 'atreides', seats: ['fremen'] }] },
    { version: 1, controllers: [{ id: 'atreides', seats: ['atreides', 'foreign'] }] },
    { version: 1, controllers: [
      { id: 'atreides', seats: ['atreides', 'fremen'] },
      { id: 'harkonnen', seats: ['harkonnen', 'fremen'] },
    ] },
    { version: 1, controllers: [{ id: 'atreides', seats: [] }] },
    { version: 1, controllers: [{ id: 'atreides', seats: ['atreides'], secret: 'x' }] },
    { version: 2, controllers: [] },
    { version: 1, controllers: [], extra: true },
  ]) assert.throws(() => lobby(value, seats), TwoPlayerControllersError);
  const state = assembled(), snapshot = structuredClone(state);
  assert.throws(() => lobby(state, seats.slice(0, 3)), TwoPlayerControllersError);
  assert.throws(() => lobby(state, ['atreides', 'atreides']), TwoPlayerControllersError);
  assert.deepEqual(state, snapshot);
});

void test('incremental additions cannot steal, duplicate or exceed a controller seat', () => {
  let state = add(create(), seats, 'atreides', 'atreides');
  const before = structuredClone(state);
  assert.throws(() => add(state, seats, 'atreides', 'atreides'), TwoPlayerControllersError);
  assert.throws(() => add(state, seats, 'harkonnen', 'guild'), TwoPlayerControllersError);
  assert.throws(() => add(state, seats, 'atreides', 'unknown'), TwoPlayerControllersError);
  assert.deepEqual(state, before);
  state = add(state, seats, 'atreides', 'fremen');
  assert.throws(() => add(state, seats, 'atreides', 'guild'), TwoPlayerControllersError);
  state = add(state, seats, 'harkonnen', 'harkonnen');
  assert.throws(() => add(state, seats, 'guild', 'guild'), TwoPlayerControllersError);
});

void test('a partial or malformed mapping cannot alter victory calculations', () => {
  const partial = add(create(), seats, 'atreides', 'atreides');
  assert.throws(() => count(seats, partial), TwoPlayerControllersError);
  assert.throws(() => target(seats, partial, false), TwoPlayerControllersError);
  assert.throws(() => target(seats, partial, true), TwoPlayerControllersError);
  assert.throws(() => count([], undefined), TwoPlayerControllersError);
  assert.throws(() => count(['a', 'a'], undefined), TwoPlayerControllersError);
  const restored = JSON.parse(JSON.stringify(assembled())) as TwoPlayerControllers;
  complete(restored, seats);
  assert.equal(target(seats, restored, false), 4);
});
