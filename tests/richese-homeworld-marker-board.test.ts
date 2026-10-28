import assert from 'node:assert/strict';
import test from 'node:test';
import { createGame, newPlayer } from '../game/engine';
import { presenceAt, presenceByLocation } from '../game/force-presence';
import { forceInventory } from '../game/force-inventory';
import { quoteBattleBoard } from '../game/board-resolution-quote';
import { quoteVictory } from '../game/victory-quote';
import { createRicheseNoField, deployRicheseNoField, projectRicheseNoField } from '../game/richese-no-field';

function game() {
  const g = createGame('WORLDMARKER', newPlayer('r', 'Richese', 'richese'), true);
  g.players.push(newPlayer('a', 'Atreides', 'atreides'), newPlayer('b', 'Bene Gesserit', 'beneGesserit'));
  Object.assign(g, { status: 'playing', phase: 8, turn: 2, storm: 18,
    order: ['r', 'a', 'b'], ready: [], phaseOpening: null, active: null });
  for (const p of g.players) Object.assign(p, { forces: {}, reserves: 20, hand: [], spice: 5 });
  return g;
}
function marker(tokenId: string, location: { homeworld: string } | { territory: string; sector: number }) {
  return deployRicheseNoField(createRicheseNoField(['zero', 'three', 'five']), {
    tokenId, controller: 'r', location,
  });
}

void test('a Homeworld marker does not fabricate Arrakis presence, a board battle or a stronghold win', () => {
  const g = game(), richese = g.players[0], atreides = g.players[1];
  richese.forces = { 'carthag:11': 1, 'sietch_tabr:14': 1 };
  richese.noField = marker('three', { homeworld: 'homeworld:atreides' });
  assert.equal(presenceAt(richese, 'arrakeen'), 0);
  assert.equal(presenceAt(richese, 'homeworld:atreides'), 0);
  assert.deepEqual(presenceByLocation(richese), richese.forces);
  assert.deepEqual(quoteVictory(g).winner, []);
  atreides.forces = { 'arrakeen:10': 1 };
  assert.deepEqual(quoteBattleBoard(g).battles, []);

  // The same single marker on Arrakis continues to participate normally.
  richese.noField = marker('three', { territory: 'arrakeen', sector: 10 });
  assert.equal(presenceAt(richese, 'arrakeen'), 1);
  assert.equal(presenceByLocation(richese)['arrakeen:10'], 1);
  assert.equal(quoteBattleBoard(g).battles.length, 1);
  atreides.forces = {};
  assert.deepEqual(quoteVictory(g).winner, ['r']);
});

void test('the inspector names a Homeworld marker without adding a counter or exposing its value', () => {
  const g = game(), richese = g.players[0];
  const inventories = ['zero', 'three', 'five'].map(tokenId => {
    const state = marker(tokenId, { homeworld: 'homeworld:atreides' });
    const player = { ...richese, noField: projectRicheseNoField(state, false) };
    const inventory = forceInventory(player);
    assert.ok(inventory);
    assert.deepEqual(inventory.marker, { name: 'Caladan' });
    assert.equal(inventory.total, 20);
    assert.doesNotMatch(JSON.stringify(inventory), /zero|three|five|tokenId|lastShipped/);
    return inventory;
  });
  assert.deepEqual(inventories[0], inventories[1]);
  assert.deepEqual(inventories[1], inventories[2]);
});
