import assert from 'node:assert/strict';
import { applyAction, viewGame, type Game } from '../game/engine';
import { gameDistance, gameTerritories, splitLocation } from '../game/board';
import { discoveryFixture, enterDiscoveryCollection } from './fixture-discovery';

export const flightOrigin = 'red_chasm:7';
/** Start from the actual base audit setup and acquire the actual token through
 * Collection. Reposition existing physical forces for a focused movement turn. */
export function discoveryFlightFixture(advanced = false, owner = 'a',
  ids: [string, string, string] = ['a', 'g', 'f']) {
  let game = discoveryFixture(advanced, ids);
  const token = enterDiscoveryCollection(game, 'ornithopter', owner);
  if (viewGame(game, owner).discoveries?.canInspect.includes(token.id))
    game = applyAction(game, owner, { type: 'discovery', token: token.id, reveal: false });
  game = applyAction(game, owner, { type: 'discovery', token: token.id, reveal: true });
  const acquiredTurn = game.turn;
  game.turn++;
  Object.assign(game, { phase: 5, active: owner, phaseOpening: null, response: null,
    decision: null, stormPending: null, storm: 18, ready: [], movementRemaining: [owner] });
  for (const player of game.players) {
    player.reserves += Object.values(player.forces).reduce((a, b) => a + b, 0);
    player.forces = {};
    if (player.elites) {
      player.elites.reserves += Object.values(player.elites.forces).reduce((a, b) => a + b, 0);
      player.elites.forces = {};
    }
    game.deck.push(...player.hand);
    player.hand = [];
    player.shipped = true;
    player.moved = 0;
  }
  const pilot = game.players.find(player => player.id === owner)!;
  pilot.reserves -= 5;
  pilot.forces[flightOrigin] = 5;
  return { game, token: token.id, owner, acquiredTurn };
}

export function flightDestination(game: Game, steps = 3, from = flightOrigin) {
  const target = gameTerritories(game).flatMap(t => t.sectors.map(sector => `${t.id}:${sector}`))
    .find(key => splitLocation(key).territory !== splitLocation(from).territory &&
      splitLocation(key).sector !== game.storm &&
      gameDistance(game, from, key, key => splitLocation(key).sector === game.storm) === steps);
  assert.ok(target, `a ${steps}-territory route exists`);
  return target;
}
