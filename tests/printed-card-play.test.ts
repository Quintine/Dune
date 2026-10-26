import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PrintedCardPlayError,
  printedCardPlayCount,
  recordPrintedCardPlay,
  type PrintedCardPlayCounts,
} from '../game/printed-card-play';

void test('missing legacy counts and other turn/player/effect baselines read as zero', () => {
  assert.equal(printedCardPlayCount(undefined, 'atreides', 1, 'hajr'), 0);
  const counts = recordPrintedCardPlay(undefined, 'atreides', 1, 'hajr');
  assert.equal(printedCardPlayCount(counts, 'atreides', 1, 'hajr'), 1);
  assert.equal(printedCardPlayCount(counts, 'atreides', 2, 'hajr'), 0);
  assert.equal(printedCardPlayCount(counts, 'emperor', 1, 'hajr'), 0);
  assert.equal(printedCardPlayCount(counts, 'atreides', 1, 'ghola'), 0);
});

void test('accepted printed-role plays count once per call and genuine replay increments without physical IDs', () => {
  const first = recordPrintedCardPlay(undefined, 'atreides', 3, 'hajr');
  const second = recordPrintedCardPlay(first, 'atreides', 3, 'hajr');
  const ghola = recordPrintedCardPlay(second, 'atreides', 3, 'ghola');
  const other = recordPrintedCardPlay(ghola, 'emperor', 3, 'hajr');
  assert.deepEqual(other, { turn: 3, plays: [
    { player: 'atreides', effect: 'hajr', count: 2 }, { player: 'atreides', effect: 'ghola', count: 1 },
    { player: 'emperor', effect: 'hajr', count: 1 },
  ] });
  assert.deepEqual(first, { turn: 3, plays: [{ player: 'atreides', effect: 'hajr', count: 1 }] });
  assert.notEqual(second, first);
  assert.notEqual(second.plays, first.plays);
  assert.notEqual(second.plays[0], first.plays[0]);
});

void test('a newer turn resets the list while a past-turn write rejects without changing the baseline', () => {
  const old = recordPrintedCardPlay(undefined, 'atreides', 3, 'hajr');
  const next = recordPrintedCardPlay(old, 'emperor', 4, 'ghola');
  assert.deepEqual(next, { turn: 4, plays: [{ player: 'emperor', effect: 'ghola', count: 1 }] });
  assert.equal(printedCardPlayCount(next, 'atreides', 3, 'hajr'), 0);
  const before = structuredClone(next);
  assert.throws(() => recordPrintedCardPlay(next, 'atreides', 3, 'hajr'), PrintedCardPlayError);
  assert.deepEqual(next, before);
});

void test('safe integer counts reject overflow immutably', () => {
  const full: PrintedCardPlayCounts = { turn: 1, plays: [{ player: 'atreides', effect: 'hajr', count: Number.MAX_SAFE_INTEGER }] };
  const before = structuredClone(full);
  assert.equal(printedCardPlayCount(full, 'atreides', 1, 'hajr'), Number.MAX_SAFE_INTEGER);
  assert.throws(() => recordPrintedCardPlay(full, 'atreides', 1, 'hajr'), PrintedCardPlayError);
  assert.deepEqual(full, before);
  assert.equal(recordPrintedCardPlay(full, 'atreides', 1, 'ghola').plays[1].count, 1);
});

void test('strict stored counts reject malformed state even when another turn would reset or miss it', () => {
  const play = { player: 'atreides', effect: 'hajr', count: 1 };
  const invalid: unknown[] = [null, [], {}, { turn: 0, plays: [] }, { turn: 1, plays: null },
    { turn: 1, plays: [], source: 'card-id' }, { turn: 1, plays: [play, play] },
    ...[0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '1'].map(count => ({ turn: 1, plays: [{ ...play, count }] })),
    { turn: 1, plays: [{ ...play, player: ' atreides' }] }, { turn: 1, plays: [{ ...play, effect: 'karama' }] },
    { turn: 1, plays: [{ ...play, card: 'hajr' }] }, { turn: 1, plays: [{ ...play, printed: true }] }];
  for (const value of invalid) {
    assert.throws(() => printedCardPlayCount(value as PrintedCardPlayCounts, 'atreides', 2, 'hajr'), PrintedCardPlayError);
    assert.throws(() => recordPrintedCardPlay(value as PrintedCardPlayCounts, 'atreides', 2, 'hajr'), PrintedCardPlayError);
  }
  assert.doesNotThrow(() => printedCardPlayCount({ turn: 1, plays: [] }, 'atreides', 1, 'hajr'));
});

void test('request metadata remains exact, safe and uncoerced for both lookup and recording', () => {
  for (const [player, turn, effect] of [['', 1, 'hajr'], ['atreides ', 1, 'ghola'], ['atreides', 0, 'hajr'],
    ['atreides', 1.5, 'hajr'], ['atreides', Number.MAX_SAFE_INTEGER + 1, 'hajr'], ['atreides', '1', 'hajr'],
    ['atreides', 1, 'Ghola'], ['atreides', 1, 'karama']]) {
    assert.throws(() => printedCardPlayCount(undefined, player as string, turn as number, effect as never), PrintedCardPlayError);
    assert.throws(() => recordPrintedCardPlay(undefined, player as string, turn as number, effect as never), PrintedCardPlayError);
  }
});
