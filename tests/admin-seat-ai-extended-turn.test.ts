import assert from 'node:assert/strict';
import test from 'node:test';
import { adminSeatAiCoreShape } from '../game/admin-seat-ai-shape';
import { applyAction, createGame, joinGame, newPlayer, type Game } from '../game/engine';

/** Genuine public Advanced setup; only the calendar fields below are staged. */
function source(advanced = true): Game {
  let game = createGame('SEATEXTENDED', newPlayer('a', 'Atreides', 'atreides'), advanced);
  joinGame(game, newPlayer('e', 'Emperor', 'emperor'));
  for (const player of game.players) game = applyAction(game, player.id, { type: 'ready' });
  return applyAction(game, game.host, { type: 'start', ...(advanced ? { advancedPreview: true } : {}) });
}

void test('seat AI shape accepts existing turns and explicitly bounded extended Basic and Advanced turns', () => {
  const original = source();
  for (const turn of [1, 2, 10]) {
    const game = structuredClone(original);
    game.turn = turn;
    assert.equal(adminSeatAiCoreShape(game), true, `existing turn ${turn}`);
  }
  for (const [turn, finalTurn] of [[10, 11], [11, 11], [11, 12], [12, 12], [11, Number.MAX_SAFE_INTEGER]]) {
    const game = structuredClone(original) as Game & { victoryFinalTurn: number };
    game.turn = turn;
    game.victoryFinalTurn = finalTurn;
    const before = structuredClone(game);
    assert.equal(adminSeatAiCoreShape(game), true, `turn ${turn} / final ${finalTurn}`);
    assert.deepEqual(game, before);
  }
  const basic = source(false) as Game & { victoryFinalTurn: number };
  basic.turn = 11;
  basic.victoryFinalTurn = 11;
  assert.equal(adminSeatAiCoreShape(basic), true);
});

void test('seat AI shape rejects absent or malformed extended-turn bounds without repair', () => {
  const original = source();
  for (const finalTurn of [undefined, null, 9, 10, -1, 11.5, '11', NaN, Infinity]) {
    const game = structuredClone(original) as unknown as Record<string, unknown>;
    game.turn = 11;
    if (finalTurn !== undefined) game.victoryFinalTurn = finalTurn;
    const before = structuredClone(game);
    assert.equal(adminSeatAiCoreShape(game), false, `turn 11 / bound ${String(finalTurn)}`);
    assert.deepEqual(game, before);
  }
  const invalidEarly = structuredClone(original) as unknown as Record<string, unknown>;
  invalidEarly.victoryFinalTurn = 9;
  assert.equal(adminSeatAiCoreShape(invalidEarly), false);
});
