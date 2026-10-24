import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, createGame, joinGame, newPlayer } from '../game/engine';
import { faction, type FactionId } from '../game/catalog';

function lobby(roster: FactionId[]) {
  const expansions = [...new Set(roster.map(id => faction(id).expansion).filter(id => id !== 'base'))];
  let game = createGame('BASICECAZNATIVEENTRY', newPlayer(roster[0], roster[0], roster[0]), false, expansions);
  for (const id of roster.slice(1)) joinGame(game, newPlayer(id, id, id));
  for (const p of game.players) game = applyAction(game, p.id, { type: 'ready' });
  return game;
}
for (const native of ['ixians', 'choam', 'richese'] as const)
  void test(`a fresh public Basic Ecaz/${native} lobby starts with its actual native selected family`, () => {
    const source = lobby(['ecaz', native, 'guild']), before = structuredClone(source);
    const game = applyAction(source, source.host, { type: 'start' });
    assert.equal(game.status, 'setup'); assert.equal(game.advanced, false);
    assert.equal(game.ecazOccupyPreview, true);
    assert.deepEqual(game.expansions, source.expansions);
    assert.deepEqual(game.players.map(p => p.faction), source.players.map(p => p.faction));
    assert.equal(game.leaderSkills, undefined); assert.equal(game.ecazTreachery, undefined);
    assert.deepEqual(source, before);
  });
void test('the fresh six-native Basic lobby preserves all three selected families through public start', () => {
  const source = lobby(['ecaz', 'ixians', 'choam', 'richese', 'moritani', 'tleilaxu']);
  const game = applyAction(source, source.host, { type: 'start' });
  assert.equal(game.status, 'setup'); assert.equal(game.advanced, false);
  assert.equal(game.players.length, 6); assert.deepEqual(new Set(game.expansions), new Set(['ecaz', 'ix', 'choam']));
});
