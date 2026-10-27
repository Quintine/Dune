import assert from 'node:assert/strict';
import test from 'node:test';
import { continueVictoryCalendar, victoryFinalTurn, VictoryCalendarError } from '../game/victory-calendar';

void test('an unstamped game retains turn ten as its final turn without mutation', () => {
  const game = { turn: 4 };
  assert.equal(victoryFinalTurn(game), 10);
  assert.equal(continueVictoryCalendar(game), 10);
  assert.deepEqual(game, { turn: 4 });
});

void test('unanimous continuation at the final turn moves the fallback one full turn', () => {
  assert.equal(continueVictoryCalendar({ turn: 10 }), 11);
  assert.equal(victoryFinalTurn({ turn: 11, victoryFinalTurn: 11 }), 11);
  assert.equal(continueVictoryCalendar({ turn: 11, victoryFinalTurn: 11 }), 12);
  assert.equal(continueVictoryCalendar({ turn: 10, victoryFinalTurn: 11 }), 11);
});

void test('an extended final-turn stamp survives an ordinary JSON continuation', () => {
  const saved = JSON.parse(JSON.stringify({ turn: 11, victoryFinalTurn: 12 }));
  assert.equal(victoryFinalTurn(saved), 12);
  assert.equal(continueVictoryCalendar(saved), 12);
});

void test('invalid or expired calendars reject rather than silently extending', () => {
  for (const game of [
    { turn: 0 }, { turn: 1.5 }, { turn: 11 },
    { turn: 10, victoryFinalTurn: 9 }, { turn: 11, victoryFinalTurn: 10 },
    { turn: 11, victoryFinalTurn: 11.5 }, { turn: NaN, victoryFinalTurn: 10 },
  ]) assert.throws(() => victoryFinalTurn(game), VictoryCalendarError);
  assert.throws(() => victoryFinalTurn({ turn: 1, victoryFinalTurn: null } as never), VictoryCalendarError);
});

void test('extension rejects safe-integer overflow without changing the saved calendar', () => {
  const game = { turn: Number.MAX_SAFE_INTEGER, victoryFinalTurn: Number.MAX_SAFE_INTEGER };
  assert.throws(() => continueVictoryCalendar(game), VictoryCalendarError);
  assert.equal(game.victoryFinalTurn, Number.MAX_SAFE_INTEGER);
});
