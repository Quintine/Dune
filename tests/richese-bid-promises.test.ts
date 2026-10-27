import assert from 'node:assert/strict';
import test from 'node:test';
import {
  RicheseBidPromiseError, finishRicheseBidLot, liveRicheseBidPromises,
  parseRicheseBidClaim, reconcileRicheseBidPromises, recordRicheseBid,
  richeseBidAllowedRange, richeseBidClaimText, richeseBidCompletionRange,
  richeseBidRequired, validateRicheseBidPromises,
  type RicheseBidContext, type RicheseBidOpportunity, type RicheseBidPromise,
} from '../game/richese-bid-promises';

const context: RicheseBidContext = { turn: 2, event: 'public-lot', player: 'target' };
const opportunity: RicheseBidOpportunity = { ...context, minimum: 4, maximum: 10 };
const seats = ['target', 'asker', 'other'];
const promise = (id: string, minimum: number, answer = true,
  extra: Partial<RicheseBidPromise> = {}): RicheseBidPromise => ({
    id, ...context, asker: 'asker', minimum, answer, ...extra,
  });

void test('claims retain only a safe integer turn, public lot event and positive bid minimum', () => {
  assert.deepEqual(parseRicheseBidClaim({ turn: 2, event: 'public-lot', minimum: 6, ignored: true }),
    { turn: 2, event: 'public-lot', minimum: 6 });
  for (const value of [0, -1, 1.5, Number.NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '2', null, undefined])
    for (const field of ['turn', 'minimum'])
      assert.throws(() => parseRicheseBidClaim({ turn: 2, event: 'public-lot', minimum: 6, [field]: value }), RicheseBidPromiseError);
  for (const event of ['', ' ', ' lot ', null, 1, undefined])
    assert.throws(() => parseRicheseBidClaim({ turn: 2, event, minimum: 6 }), RicheseBidPromiseError);
  for (const value of [null, undefined, [], 3, 'claim'])
    assert.throws(() => parseRicheseBidClaim(value), RicheseBidPromiseError);
  const text = richeseBidClaimText({ turn: 2, event: 'public-lot', minimum: 6 });
  assert.match(text, /bid of at least 6 spice/);
  assert.match(text, /Once Around/);
  assert.doesNotMatch(text, /win|purchase|public-lot/);
});

void test('the engine-supplied interval combines every Yes threshold and No cap', () => {
  const rows = [promise('yes-6', 6), promise('yes-7', 7), promise('no-9', 9, false), promise('no-8', 8, false)];
  assert.deepEqual(richeseBidAllowedRange(rows, opportunity), { minimum: 4, maximum: 7 });
  assert.deepEqual(richeseBidCompletionRange(rows, opportunity), { minimum: 7, maximum: 7 });
  assert.equal(richeseBidRequired(rows, context), true);
  assert.equal(richeseBidCompletionRange(rows, { ...opportunity, maximum: 6 }), null);
  assert.equal(richeseBidCompletionRange(rows, { ...opportunity, minimum: 8 }), null);
  assert.equal(richeseBidRequired([promise('no-only', 4, false)], context), false);
  assert.equal(richeseBidAllowedRange([promise('no-only', 4, false)], opportunity), null);
});

void test('live answers bind the precise bidder, turn and public lot and preserve separate receipts', () => {
  const original = [promise('yes', 6), promise('no', 9, false),
    promise('other-player', 8, true, { player: 'other' }),
    promise('other-turn', 8, true, { turn: 3 }),
    promise('other-lot', 8, true, { event: 'new-lot' }),
    promise('past', 8, true, { fulfilled: true })];
  assert.deepEqual(liveRicheseBidPromises(original, context).map(row => row.id), ['yes', 'no']);
  validateRicheseBidPromises(original, seats);
  const parsed = JSON.parse(JSON.stringify(original)) as RicheseBidPromise[];
  assert.deepEqual(liveRicheseBidPromises(parsed, context).map(row => row.id), ['yes', 'no']);
});

void test('an actual single qualifying bid fulfills Yes and No without requiring a win', () => {
  const rows = [promise('yes', 6), promise('no', 9, false), promise('other', 2, true, { event: 'next' })];
  const frozen = structuredClone(rows);
  const result = recordRicheseBid(rows, context, 7);
  assert.equal(result[0].fulfilled, true);
  assert.equal(result[1].fulfilled, true);
  assert.equal(result[2].fulfilled, undefined);
  assert.deepEqual(rows, frozen);
  assert.equal(richeseBidRequired(result, context), false);
  for (const amount of [null, 4, 5, 9, 10, 0, -1, 1.5, Number.NaN, Infinity])
    assert.throws(() => recordRicheseBid(rows, context, amount), RicheseBidPromiseError, String(amount));
});

void test('passing satisfies No but cannot evade a still-live Yes', () => {
  const no = [promise('no', 6, false)];
  assert.equal(recordRicheseBid(no, context, null)[0].fulfilled, true);
  assert.equal(recordRicheseBid(no, context, 5)[0].fulfilled, true);
  assert.throws(() => recordRicheseBid(no, context, 6), RicheseBidPromiseError);
  const yes = [promise('yes', 6)];
  assert.throws(() => recordRicheseBid(yes, context, null), RicheseBidPromiseError);
  assert.throws(() => recordRicheseBid(yes, context, 5), RicheseBidPromiseError);
  assert.equal(recordRicheseBid(yes, context, 6)[0].fulfilled, true);
});

void test('external funding or competing bid releases only individually impossible Yes', () => {
  const rows = [promise('yes-8', 8), promise('yes-6', 6), promise('no-9', 9, false)];
  const actual = { ...opportunity, maximum: 7 };
  const reduced = reconcileRicheseBidPromises(rows, context, actual, 'external');
  assert.equal(reduced[0].released, true);
  assert.equal(reduced[1].released, undefined);
  assert.equal(reduced[2].released, undefined);
  assert.deepEqual(richeseBidCompletionRange(reduced, actual), { minimum: 6, maximum: 7 });
  assert.throws(() => reconcileRicheseBidPromises(rows, context, actual, 'voluntary'), RicheseBidPromiseError);
  assert.equal(rows[0].released, undefined);
  const absent = reconcileRicheseBidPromises(rows, context, null, 'external');
  assert.equal(absent[0].released, true);
  assert.equal(absent[1].released, true);
  assert.equal(absent[2].released, undefined);
  assert.throws(() => reconcileRicheseBidPromises(rows, context, null, 'voluntary'), RicheseBidPromiseError);
});

void test('a rival bid beyond the No cap forces release, not an unlawful above-cap declaration', () => {
  const rows = [promise('yes', 6), promise('no', 8, false)];
  const rival = { ...opportunity, minimum: 8, maximum: 10 };
  assert.equal(richeseBidCompletionRange(rows, rival), null);
  const result = reconcileRicheseBidPromises(rows, context, rival, 'external');
  assert.equal(result[0].released, true);
  assert.equal(result[1].released, undefined);
  assert.equal(recordRicheseBid(result, context, null)[1].fulfilled, true);
});

void test('lot close finishes No and externally releases unfulfilled Yes without affecting other lots', () => {
  const rows = [promise('yes', 6), promise('no', 9, false), promise('next', 6, true, { event: 'next' })];
  assert.throws(() => finishRicheseBidLot(rows, context, 'voluntary'), RicheseBidPromiseError);
  const result = finishRicheseBidLot(rows, context, 'external');
  assert.equal(result[0].released, true);
  assert.equal(result[1].fulfilled, true);
  assert.equal(result[2].released, undefined);
  assert.equal(finishRicheseBidLot([rows[1]], context, 'voluntary')[0].fulfilled, true);
});

void test('invalid saved rows and mismatched opportunity contexts fail without mutating promises', () => {
  const base = promise('id', 6);
  for (const row of [
    { ...base, id: '' }, { ...base, id: ' id ' }, { ...base, asker: 'target' },
    { ...base, player: 'nobody' }, { ...base, answer: 'yes' },
    { ...base, fulfilled: true, released: true }, { ...base, fulfilled: 'yes' },
  ]) assert.throws(() => validateRicheseBidPromises([row as RicheseBidPromise], seats), RicheseBidPromiseError);
  assert.throws(() => validateRicheseBidPromises([base, { ...base, minimum: 7 }], seats), RicheseBidPromiseError);
  assert.throws(() => reconcileRicheseBidPromises([base], context, { ...opportunity, event: 'other' }, 'external'), RicheseBidPromiseError);
  assert.throws(() => reconcileRicheseBidPromises([base], context, { ...opportunity, player: 'other' }, 'external'), RicheseBidPromiseError);
  assert.throws(() => richeseBidAllowedRange([base], { ...opportunity, minimum: 0 }), RicheseBidPromiseError);
  assert.throws(() => richeseBidAllowedRange([base], { ...opportunity, maximum: Infinity }), RicheseBidPromiseError);
  assert.throws(() => richeseBidAllowedRange([base], { ...opportunity, maximum: 3 }), RicheseBidPromiseError);
  assert.equal(base.fulfilled, undefined);
  assert.equal(base.released, undefined);
});
