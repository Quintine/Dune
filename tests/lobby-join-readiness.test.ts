import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, createGame, joinGame, newPlayer, type Game } from '../game/engine';

for (const change of ['join', 'faction'] as const) {
  void test(`human ${change} clears human readiness while AI remains ready through saved start`, () => {
    let game = createGame('READY234', newPlayer('host', 'Host', 'atreides'), false);
    game = applyAction(game, 'host', { type: 'addBot', faction: 'harkonnen', difficulty: 'Easy' });
    game = applyAction(game, 'host', { type: 'ready' });
    if (change === 'join') joinGame(game, newPlayer('guest', 'Guest', 'emperor'));
    else game = applyAction(game, 'host', { type: 'faction', faction: 'emperor' });
    assert.ok(game.players.filter(p => !p.bot).every(p => !p.ready));
    assert.ok(game.players.filter(p => p.bot).every(p => p.ready));
    game = JSON.parse(JSON.stringify(game)) as Game;
    for (const player of game.players.filter(p => !p.bot)) game = applyAction(game, player.id, { type: 'ready' });
    const started = applyAction(game, 'host', { type: 'start' });
    assert.equal(started.status, 'setup');
    assert.equal(started.players.length, change === 'join' ? 3 : 2);
  });
}
