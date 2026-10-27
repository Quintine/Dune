import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PhaseBidPromiseError,
  finishPhaseBidPhase,
  livePhaseBidPromises,
  parsePhaseBidClaim,
  phaseBidAllowedRange,
  phaseBidClaimText,
  phaseBidCompletionRange,
  reconcilePhaseBidPromises,
  recordPhaseBid,
  validatePhaseBidPromises,
  type PhaseBidOpportunity,
  type PhaseBidPromise,
} from '../game/turn-bid-promises';

const seats = ['respondent', 'asker', 'rival'];
const promise = (event: string, minimum: number, answer = true,
  extra: Partial<PhaseBidPromise> = {}): PhaseBidPromise =>
  ({ event, turn: 2, minimum, player: 'respondent', asker: 'asker', answer, ...extra });
const opportunity = (extra: Partial<PhaseBidOpportunity> = {}): PhaseBidOpportunity =>
  ({ turn: 2, player: 'respondent', kind: 'current', minimum: 1, maximum: 9, ...extra });

void test('phase bid claim is one positive safe turn and threshold, with no lot or cumulative payment', () => {
  const claim = parsePhaseBidClaim({ turn: 2, minimum: 6 });
  assert.deepEqual(claim, { turn: 2, minimum: 6 });
  assert.match(phaseBidClaimText(claim), /bid of at least 6 spice/);
  assert.match(phaseBidClaimText(claim), /Bidding phase closes/);
  for (const field of ['turn', 'minimum'] as const)
    for (const value of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '6', null, undefined])
      assert.throws(() => parsePhaseBidClaim({ turn: 2, minimum: 6, [field]: value }), PhaseBidPromiseError);
  for (const value of [null, undefined, [], '6', 6])
    assert.throws(() => parsePhaseBidClaim(value), PhaseBidPromiseError);
});

void test('Yes survives a smaller accepted bid and lot close when a funded later lot is genuinely witnessed', () => {
  const start = Object.freeze([Object.freeze(promise('yes-six', 6))]);
  let rows = recordPhaseBid(start, 'respondent', 2, 3);
  assert.equal(rows[0].fulfilled, undefined);
  const future = opportunity({ kind: 'future', minimum: 1, maximum: 7 });
  rows = reconcilePhaseBidPromises(rows, 'respondent', 2, [future], 'voluntary');
  assert.equal(rows[0].released, undefined);
  rows = recordPhaseBid(rows, 'respondent', 2, 5);
  assert.equal(rows[0].fulfilled, undefined, 'Separate bids are not summed');
  rows = recordPhaseBid(rows, 'respondent', 2, 6);
  assert.equal(rows[0].fulfilled, true, 'An accepted declaration suffices even without winning the card');
  assert.equal(start[0].fulfilled, undefined);
});

void test('No caps all later native lots and remains binding after Yes is fulfilled', () => {
  const yes = promise('yes-six', 6), no = promise('no-eight', 8, false);
  const source = Object.freeze([Object.freeze(yes), Object.freeze(no)]);
  const before = structuredClone(source);
  assert.deepEqual(phaseBidAllowedRange(source, opportunity()), { minimum: 1, maximum: 7 });
  assert.deepEqual(phaseBidCompletionRange(source, opportunity()), { minimum: 6, maximum: 7 });
  const rows = recordPhaseBid(source, 'respondent', 2, 7);
  assert.equal(rows[0].fulfilled, true); assert.equal(rows[1].fulfilled, undefined);
  assert.throws(() => recordPhaseBid(rows, 'respondent', 2, 8), PhaseBidPromiseError);
  assert.deepEqual(source, before);
  assert.equal(recordPhaseBid(rows, 'rival', 2, 8)[1], no);
  assert.equal(recordPhaseBid(rows, 'respondent', 3, 8)[1], no);
  const finished = finishPhaseBidPhase(rows, 'respondent', 2, 'external');
  assert.equal(finished[1].fulfilled, true);
});

void test('funded witnesses and other No caps constrain joint completion without forcing each bid to qualify', () => {
  const rows = [promise('yes-six', 6), promise('yes-seven', 7), promise('no-eight', 8, false)];
  assert.deepEqual(phaseBidAllowedRange(rows, opportunity()), { minimum: 1, maximum: 7 });
  assert.deepEqual(phaseBidCompletionRange(rows, opportunity()), { minimum: 7, maximum: 7 });
  assert.equal(phaseBidCompletionRange(rows, opportunity({ maximum: 6 })), null);
  assert.equal(phaseBidCompletionRange(rows, opportunity({ minimum: 8 })), null);
  assert.equal(phaseBidCompletionRange([promise('yes-eight', 8), promise('no-eight', 8, false)], opportunity()), null);
  assert.deepEqual(phaseBidAllowedRange([promise('no-eight', 8, false)], opportunity()), { minimum: 1, maximum: 7 });
});

void test('own action cannot abandon the last real witness, while outside impossibility releases only affected Yes rows', () => {
  const rows = Object.freeze([Object.freeze(promise('yes-five', 5)), Object.freeze(promise('yes-eight', 8)),
    Object.freeze(promise('no-ten', 10, false))]);
  const before = structuredClone(rows);
  const limited = [opportunity({ maximum: 5 })];
  assert.throws(() => reconcilePhaseBidPromises(rows, 'respondent', 2, limited, 'voluntary'), PhaseBidPromiseError);
  assert.throws(() => reconcilePhaseBidPromises(rows, 'respondent', 2, [], 'voluntary'), PhaseBidPromiseError);
  const after = reconcilePhaseBidPromises(rows, 'respondent', 2, limited, 'external');
  assert.equal(after[0].released, undefined); assert.equal(after[1].released, true);
  assert.equal(after[2].released, undefined, 'An impossible Yes does not erase a No restriction');
  assert.deepEqual(rows, before);
  assert.throws(() => finishPhaseBidPhase(rows, 'respondent', 2, 'voluntary'), PhaseBidPromiseError);
  const closed = finishPhaseBidPhase(rows, 'respondent', 2, 'external');
  assert.equal(closed[0].released, true); assert.equal(closed[1].released, true); assert.equal(closed[2].fulfilled, true);
});

void test('only actual verified intervals for the respondent and turn can witness a promise', () => {
  const rows = [promise('yes-six', 6)];
  for (const wrong of [opportunity({ turn: 3 }), opportunity({ player: 'rival' })])
    assert.throws(() => reconcilePhaseBidPromises(rows, 'respondent', 2, [wrong], 'voluntary'), PhaseBidPromiseError);
  for (const invalid of [opportunity({ maximum: 0 }), opportunity({ minimum: 4, maximum: 3 }),
    opportunity({ maximum: Infinity }), opportunity({ kind: 'invented' as 'future' })])
    assert.throws(() => phaseBidAllowedRange(rows, invalid), PhaseBidPromiseError);
  assert.throws(() => recordPhaseBid(rows, 'respondent', 2, 0), PhaseBidPromiseError);
  assert.deepEqual(livePhaseBidPromises([rows[0], promise('old', 8, true, { turn: 1 }),
    promise('someone-else', 9, true, { player: 'rival' })], 'respondent', 2), [rows[0]]);
});

void test('phase records preserve event identities, actual participants and mutually exclusive terminal status', () => {
  const valid = [promise('live', 6), promise('fulfilled', 7, true, { fulfilled: true }),
    promise('released', 8, true, { released: true })];
  assert.doesNotThrow(() => validatePhaseBidPromises(valid, seats));
  const invalid: unknown[] = [null, [null], [valid[0], { ...valid[1], event: 'live' }],
    [{ ...valid[0], event: '' }], [{ ...valid[0], asker: 'outsider' }],
    [{ ...valid[0], player: 'outsider' }], [{ ...valid[0], asker: 'respondent' }],
    [{ ...valid[0], minimum: 0 }], [{ ...valid[0], turn: 0 }], [{ ...valid[0], answer: 'yes' }],
    [{ ...valid[0], fulfilled: 'true' }], [{ ...valid[0], released: 1 }],
    [{ ...valid[0], fulfilled: true, released: true }]];
  for (const input of invalid)
    assert.throws(() => validatePhaseBidPromises(input as PhaseBidPromise[], seats), PhaseBidPromiseError);
});
