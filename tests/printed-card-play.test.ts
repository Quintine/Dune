import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PrintedCardPlayError,
  PRINTED_CARD_EFFECTS,
  printedCardPlayCount,
  recordPrintedCardPlay,
  type PrintedCardPlayCounts,
} from '../game/printed-card-play';

void test('Box accepted activation counts extend the shared roles without changing earlier Hajr or Ghola baselines', () => {
  assert.deepEqual(PRINTED_CARD_EFFECTS, ['hajr', 'ghola', 'nullentropyBox', 'distrans', 'juiceOfSapho', 'semutaDrug',
    'ornithopter', 'residualPoison']);
  assert.equal(printedCardPlayCount(undefined, 'richese', 3, 'nullentropyBox'), 0);
  const ghola = recordPrintedCardPlay(undefined, 'richese', 3, 'ghola');
  const first = recordPrintedCardPlay(ghola, 'richese', 3, 'nullentropyBox');
  const replay = recordPrintedCardPlay(first, 'richese', 3, 'nullentropyBox');
  assert.equal(printedCardPlayCount(replay, 'richese', 3, 'nullentropyBox'), 2);
  assert.equal(printedCardPlayCount(replay, 'richese', 3, 'ghola'), 1);
  assert.equal(printedCardPlayCount(ghola, 'richese', 3, 'nullentropyBox'), 0);
  assert.deepEqual(first.plays[1], { player: 'richese', effect: 'nullentropyBox', count: 1 });
  assert.deepEqual(recordPrintedCardPlay(replay, 'richese', 4, 'nullentropyBox'),
    { turn: 4, plays: [{ player: 'richese', effect: 'nullentropyBox', count: 1 }] });
});

void test('Box activation counts retain safe overflow and strict per-player role metadata', () => {
  const full: PrintedCardPlayCounts = { turn: 3, plays: [{ player: 'richese', effect: 'nullentropyBox', count: Number.MAX_SAFE_INTEGER }] };
  const before = structuredClone(full);
  assert.throws(() => recordPrintedCardPlay(full, 'richese', 3, 'nullentropyBox'), PrintedCardPlayError);
  assert.deepEqual(full, before);
  for (const plays of [[...full.plays, ...full.plays], [{ ...full.plays[0], card: 'physical-box' }],
    [{ ...full.plays[0], effect: 'Nullentropy Box' }], [{ ...full.plays[0], count: 0 }]])
    assert.throws(() => printedCardPlayCount({ turn: 3, plays } as PrintedCardPlayCounts,
      'richese', 4, 'nullentropyBox'), PrintedCardPlayError);
});

void test('Distrans and Sapho count separate accepted printed uses and replay without recording native choices', () => {
  const original = recordPrintedCardPlay(undefined, 'richese', 2, 'nullentropyBox');
  let counts = original;
  const before = structuredClone(original);
  for (const effect of ['distrans', 'juiceOfSapho'] as const) {
    assert.equal(printedCardPlayCount(counts, 'richese', 2, effect), 0);
    counts = recordPrintedCardPlay(counts, 'richese', 2, effect);
    counts = recordPrintedCardPlay(counts, 'richese', 2, effect);
    assert.equal(printedCardPlayCount(counts, 'richese', 2, effect), 2);
    assert.equal(printedCardPlayCount(counts, 'other', 2, effect), 0);
    assert.equal(printedCardPlayCount(counts, 'richese', 3, effect), 0);
    const full: PrintedCardPlayCounts = { turn: 2, plays: [{ player: 'richese', effect, count: Number.MAX_SAFE_INTEGER }] };
    assert.throws(() => recordPrintedCardPlay(full, 'richese', 2, effect), PrintedCardPlayError);
    for (const choice of [{ recipient: 'other' }, { give: 'private-given-card' }, { scope: 'movement' }, { mode: 'first' }]) {
      const invalid = { turn: 2, plays: [{ player: 'richese', effect, count: 1, ...choice }] } as PrintedCardPlayCounts;
      assert.throws(() => printedCardPlayCount(invalid, 'richese', 3, effect), PrintedCardPlayError);
    }
  }
  assert.deepEqual(before, { turn: 2, plays: [{ player: 'richese', effect: 'nullentropyBox', count: 1 }] });
  assert.deepEqual(original, before);
  assert.equal(printedCardPlayCount(counts, 'richese', 2, 'nullentropyBox'), 1);
  assert.deepEqual(recordPrintedCardPlay(counts, 'richese', 3, 'distrans'),
    { turn: 3, plays: [{ player: 'richese', effect: 'distrans', count: 1 }] });
});

void test('Semuta counts actual physical resolutions separately from other roles without accepting commitment or selected-card metadata', () => {
  const original = recordPrintedCardPlay(undefined, 'richese', 4, 'distrans');
  assert.equal(printedCardPlayCount(original, 'richese', 4, 'semutaDrug'), 0);
  const used = recordPrintedCardPlay(original, 'richese', 4, 'semutaDrug');
  const replay = recordPrintedCardPlay(used, 'richese', 4, 'semutaDrug');
  assert.equal(printedCardPlayCount(replay, 'richese', 4, 'semutaDrug'), 2);
  assert.equal(printedCardPlayCount(replay, 'other', 4, 'semutaDrug'), 0);
  assert.equal(printedCardPlayCount(replay, 'richese', 5, 'semutaDrug'), 0);
  assert.deepEqual(original, { turn: 4, plays: [{ player: 'richese', effect: 'distrans', count: 1 }] });
  for (const extra of [{ committed: true }, { stage: 'select' }, { selected: 'private-fresh-card' }, { event: 'discard:4:2:1' }]) {
    const invalid = { turn: 4, plays: [{ player: 'richese', effect: 'semutaDrug', count: 1, ...extra }] } as PrintedCardPlayCounts;
    assert.throws(() => printedCardPlayCount(invalid, 'richese', 4, 'semutaDrug'), PrintedCardPlayError);
  }
  const full: PrintedCardPlayCounts = { turn: 4, plays: [{ player: 'richese', effect: 'semutaDrug', count: Number.MAX_SAFE_INTEGER }] };
  assert.throws(() => recordPrintedCardPlay(full, 'richese', 4, 'semutaDrug'), PrintedCardPlayError);
  assert.equal(printedCardPlayCount(full, 'richese', 4, 'semutaDrug'), Number.MAX_SAFE_INTEGER);
});

void test('Ornithopter placement and Residual Poison use retain separate exact-role counts without group or victim metadata', () => {
  const original = recordPrintedCardPlay(undefined, 'richese', 3, 'ghola');
  let counts = original;
  for (const effect of ['ornithopter', 'residualPoison'] as const) {
    assert.equal(printedCardPlayCount(counts, 'richese', 3, effect), 0);
    counts = recordPrintedCardPlay(counts, 'richese', 3, effect);
    assert.equal(printedCardPlayCount(counts, 'richese', 3, effect), 1);
    assert.equal(printedCardPlayCount(counts, 'other', 3, effect), 0);
    assert.equal(printedCardPlayCount(counts, 'richese', 4, effect), 0);
    for (const extra of [{ mode: 'twoGroups' }, { group: 2 }, { victim: 'private-leader' }, { outcome: 'killed' }]) {
      const invalid = { turn: 3, plays: [{ player: 'richese', effect, count: 1, ...extra }] } as PrintedCardPlayCounts;
      assert.throws(() => printedCardPlayCount(invalid, 'richese', 3, effect), PrintedCardPlayError);
    }
    const full: PrintedCardPlayCounts = { turn: 3, plays: [{ player: 'richese', effect, count: Number.MAX_SAFE_INTEGER }] };
    assert.throws(() => recordPrintedCardPlay(full, 'richese', 3, effect), PrintedCardPlayError);
  }
  assert.deepEqual(original, { turn: 3, plays: [{ player: 'richese', effect: 'ghola', count: 1 }] });
});

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
