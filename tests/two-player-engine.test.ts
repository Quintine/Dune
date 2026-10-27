import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, createGame, joinControlledFaction, joinGame, newPlayer, viewGame, type Game } from '../game/engine';

function lobby(): Game {
  let game = createGame('TWOPEOPLE', newPlayer('a', 'A', 'atreides'));
  game = applyAction(game, 'a', { type: 'twoPlayerMode', enabled: true });
  joinControlledFaction(game, newPlayer('b', 'A second', 'emperor'), 'a');
  joinGame(game, newPlayer('c', 'C', 'guild'));
  joinControlledFaction(game, newPlayer('d', 'C second', 'harkonnen'), 'c');
  return game;
}

void test('two people can independently ready their two physical factions and finish setup', () => {
  let game = lobby();
  assert.deepEqual(game.twoPlayerControllers, { version: 1, controllers: [
    { id: 'a', seats: ['a', 'b'] }, { id: 'c', seats: ['c', 'd'] },
  ] });
  assert.deepEqual(viewGame(game, 'b').controlledFactionSeats.map(seat => seat.id), ['a', 'b']);
  assert.deepEqual(viewGame(game, 'd').controlledFactionSeats.map(seat => seat.id), ['c', 'd']);
  for (const id of ['a', 'b', 'c', 'd']) game = applyAction(game, id, { type: 'ready' });
  game = applyAction(game, 'a', { type: 'start' });
  assert.equal(game.status, 'setup');
  for (const id of ['a', 'b', 'c', 'd']) {
    const privateView = viewGame(game, id);
    for (const seat of privateView.players) {
      assert.equal('traitorChoices' in seat, seat.id === id);
      assert.equal('hand' in seat, seat.id === id);
    }
  }
  // Harkonnen automatically keeps all four dealt traitors; the other factions
  // each choose one before play begins.
  assert.equal(game.players.find(player => player.id === 'd')!.traitors.length, 4);
  assert.equal(game.players.find(player => player.id === 'd')!.traitorChoices.length, 0);
  for (const id of ['a', 'b', 'c']) {
    const player = game.players.find(seat => seat.id === id)!;
    game = applyAction(game, id, { type: 'traitor', leader: player.traitorChoices[0] });
  }
  assert.equal(game.status, 'playing');
  assert.equal(game.players.every(player => player.ally === null), true);
  if (game.phaseOpening) {
    for (const id of ['a', 'b', 'c', 'd']) game = applyAction(game, id, { type: 'ready' });
  }
  const dialers = [...game.stormDialers];
  for (const id of dialers) game = applyAction(game, id, { type: 'stormDial', amount: 1 });
  assert.equal(game.stormPending, 2);
});

void test('lobby preserves separate controller seats and refuses incomplete, excess and AI setup', () => {
  let game = createGame('TWOPEOPLE', newPlayer('a', 'A', 'atreides'));
  game = applyAction(game, 'a', { type: 'twoPlayerMode', enabled: true });
  assert.throws(() => joinControlledFaction(game, newPlayer('x', 'X', 'emperor'), 'other'), /controller/);
  joinControlledFaction(game, newPlayer('b', 'B', 'emperor'), 'a');
  assert.throws(() => joinControlledFaction(game, newPlayer('x', 'X', 'guild'), 'b'), /two faction/);
  assert.throws(() => applyAction(game, 'a', { type: 'twoPlayerMode', enabled: false }), /cannot be disabled/);
  assert.throws(() => applyAction(game, 'a', { type: 'addBot', faction: 'guild', difficulty: 'Easy' }), /human/);
  game = applyAction(game, 'a', { type: 'ready' });
  game = applyAction(game, 'b', { type: 'ready' });
  assert.throws(() => applyAction(game, 'a', { type: 'start' }), /exactly two controllers/);
  assert.equal(game.players.length, 2);
});

void test('forged or missing controller assignments reject without mutating the game', () => {
  const game = lobby();
  game.twoPlayerControllers!.controllers[1].seats[1] = 'b';
  const before = structuredClone(game);
  assert.throws(() => viewGame(game, 'a'), /only one controller/);
  assert.throws(() => applyAction(game, 'a', { type: 'ready' }), /only one controller/);
  assert.deepEqual(game, before);
});
