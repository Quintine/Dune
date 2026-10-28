import assert from 'node:assert/strict';
import test from 'node:test';
import {
  EarlyRicheseBidError, attachEarlyRicheseBids, bindEarlyRicheseBid,
  earlyRicheseBidAnswerOptions, earlyRicheseBidClaimText,
  liveEarlyRicheseBidPromises, parseEarlyRicheseBidClaim,
  reconcileEarlyRicheseBids, validateEarlyRicheseBidPromises,
  type EarlyRicheseBidPromise,
} from '../game/early-richese-bid';

const claim = { turn: 3, minimum: 4 };
const bind = (rows: EarlyRicheseBidPromise[], minimum: number, answer: boolean, id: string, maximum = 8) =>
  bindEarlyRicheseBid(rows, { turn: 3, minimum }, 'target', 'asker', answer, id, maximum);

void test('the early claim binds a turn and positive bid without a speculative lot', () => {
  assert.deepEqual(parseEarlyRicheseBidClaim({ ...claim, event: 'discarded' }), claim);
  assert.match(earlyRicheseBidClaimText(claim), /first Richese cache auction/);
  for (const input of [null, {}, { turn: 0, minimum: 1 }, { turn: 2, minimum: 0 },
    { turn: 2, minimum: 1.5 }, { turn: 2, minimum: Infinity }])
    assert.throws(() => parseEarlyRicheseBidClaim(input), EarlyRicheseBidError);
});

void test('candidate answers preserve all jointly feasible waiting promises', () => {
  assert.deepEqual(earlyRicheseBidAnswerOptions([], claim, 'target', 'asker', 8), [true, false]);
  assert.deepEqual(earlyRicheseBidAnswerOptions([], claim, 'target', 'asker', 3), [false]);
  assert.deepEqual(earlyRicheseBidAnswerOptions([], claim, 'target', 'asker', 0), [false]);
  const yes = bind([], 4, true, 'yes');
  assert.deepEqual(earlyRicheseBidAnswerOptions(yes, { turn: 3, minimum: 4 }, 'target', 'asker', 8), [true]);
  const no = bind([], 5, false, 'no');
  assert.deepEqual(earlyRicheseBidAnswerOptions(no, { turn: 3, minimum: 4 }, 'target', 'asker', 8), [true, false]);
  assert.deepEqual(earlyRicheseBidAnswerOptions(no, { turn: 3, minimum: 5 }, 'target', 'asker', 8), [false]);
  assert.throws(() => bind(yes, 4, false, 'no'), /compatible/);
  assert.throws(() => bind(yes, 4, true, 'yes'), /distinct receipt/);
  assert.throws(() => earlyRicheseBidAnswerOptions([], claim, 'target', 'target', 8));
  assert.throws(() => earlyRicheseBidAnswerOptions([], claim, 'target', 'asker', -1));
});

void test('first actual cache event attaches waiting receipts once without changing other turns', () => {
  const source = [...bind([], 4, true, 'yes'),
    { ...claim, turn: 2, id: 'old', player: 'target', asker: 'asker', answer: false },
    { ...claim, id: 'closed', player: 'target', asker: 'asker', answer: true, released: true }];
  const before = structuredClone(source);
  const attached = attachEarlyRicheseBids(source, 3, 'real-cache-event');
  assert.deepEqual(source, before);
  assert.deepEqual(attached.bound, [{ ...claim, id: 'yes', player: 'target', asker: 'asker', answer: true, event: 'real-cache-event' }]);
  assert.equal(attached.promises[0].boundEvent, 'real-cache-event');
  assert.deepEqual(liveEarlyRicheseBidPromises(attached.promises, 'target', 3), []);
  assert.deepEqual(attachEarlyRicheseBids(attached.promises, 3, 'another-event').bound, []);
  validateEarlyRicheseBidPromises(attached.promises, ['target', 'asker']);
});

void test('voluntary losses cannot abandon a Yes, external losses release only impossible promises', () => {
  const rows = bind(bind([], 4, true, 'y4'), 7, true, 'y7');
  const witness = { cachePending: true, canBid: true, maximum: 5, change: 'voluntary' as const };
  assert.throws(() => reconcileEarlyRicheseBids(rows, 'target', 3, witness), /last funded/);
  assert.deepEqual(rows, bind(bind([], 4, true, 'y4'), 7, true, 'y7'));
  const external = reconcileEarlyRicheseBids(rows, 'target', 3, { ...witness, change: 'external' });
  assert.equal(external[0].released, undefined);
  assert.equal(external[1].released, true);
  const noCapacity = reconcileEarlyRicheseBids(external, 'target', 3,
    { cachePending: true, canBid: false, maximum: 5, change: 'external' });
  assert.equal(noCapacity[0].released, true);
});

void test('closing unavailable cache releases Yes and establishes No', () => {
  const rows = bind(bind([], 4, true, 'yes'), 7, false, 'no');
  assert.throws(() => reconcileEarlyRicheseBids(rows, 'target', 3,
    { cachePending: false, canBid: false, maximum: 0, change: 'voluntary' }));
  const closed = reconcileEarlyRicheseBids(rows, 'target', 3,
    { cachePending: false, canBid: false, maximum: 0, change: 'external' });
  assert.equal(closed[0].released, true);
  assert.equal(closed[1].fulfilled, true);
  assert.deepEqual(attachEarlyRicheseBids(closed, 3, 'later-cache').bound, []);
  validateEarlyRicheseBidPromises(closed, ['target', 'asker']);
});

void test('validation rejects malformed or duplicated receipts and conflicting states', () => {
  const valid = bind([], 4, true, 'one');
  validateEarlyRicheseBidPromises(valid, ['target', 'asker']);
  assert.throws(() => validateEarlyRicheseBidPromises([...valid, valid[0]], ['target', 'asker']));
  assert.throws(() => validateEarlyRicheseBidPromises(valid, ['target']));
  assert.throws(() => validateEarlyRicheseBidPromises([{ ...valid[0], fulfilled: true, released: true }], ['target', 'asker']));
  assert.throws(() => validateEarlyRicheseBidPromises([{ ...valid[0], boundEvent: 'event', released: true }], ['target', 'asker']));
});
