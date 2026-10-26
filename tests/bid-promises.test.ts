import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BidPromiseError,
  bidClaimText,
  bidPromiseModeSupported,
  bidPromiseRange,
  bidRequired,
  liveBidPromises,
  parseBidClaim,
  recordPromisedBid,
  validateBidPromises,
  type BidOpportunity,
  type BidPromise,
} from '../game/bid-promises';

const seats = ['respondent', 'asker', 'rival'] as const;
function opportunity(extra: Partial<BidOpportunity> = {}): BidOpportunity {
  return { turn: 2, lot: 3, source: 'original-physical-lot', bid: 4,
    bidder: 'rival', passed: [], eligible: seats, ...extra };
}
function promise(event: string, minimum: number, answer = true,
  extra: Partial<BidPromise> = {}): BidPromise {
  return { event, turn: 2, lot: 3, source: 'original-physical-lot',
    player: 'respondent', asker: 'asker', answer, minimum, ...extra };
}

void test('bid claims normalize one-based safe-integer turn, lot and minimum without adding a purchase or cumulative amount', () => {
  const input = { turn: 2, lot: 3, minimum: 6 };
  const parsed = parseBidClaim(input);
  assert.deepEqual(parsed, input); assert.notEqual(parsed, input);
  assert.deepEqual(parseBidClaim({ turn: 1, lot: 1, minimum: 1 }), { turn: 1, lot: 1, minimum: 1 });
  assert.deepEqual(parseBidClaim({ turn: Number.MAX_SAFE_INTEGER, lot: Number.MAX_SAFE_INTEGER,
    minimum: Number.MAX_SAFE_INTEGER }), { turn: Number.MAX_SAFE_INTEGER, lot: Number.MAX_SAFE_INTEGER,
    minimum: Number.MAX_SAFE_INTEGER });
  for (const field of ['turn', 'lot', 'minimum'] as const)
    for (const value of [0, -1, 1.5, Number.NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '6', null, undefined])
      assert.throws(() => parseBidClaim({ ...input, [field]: value }), BidPromiseError, `${field}/${String(value)}`);
  for (const value of [null, undefined, [], '6', 6]) assert.throws(() => parseBidClaim(value), BidPromiseError);
  const text = bidClaimText(parsed);
  assert.match(text, /place a bid of at least 6 spice/); assert.match(text, /from now until ordinary lot 3 closes/);
  assert.doesNotMatch(text, /win|purchase|sum|original-physical-lot/);
});

void test('bid commitment scope retains original bare Basic and Advanced native rosters without admitting optional modules', () => {
  const classic = { advanced: false, expansions: [], players: [{ faction: 'atreides' }, { faction: 'emperor' }] };
  const native = { advanced: true, expansions: ['ix', 'choam', 'ecaz'],
    players: ['ixians', 'tleilaxu', 'choam', 'richese', 'ecaz', 'moritani'].map(faction => ({ faction })) };
  for (const game of [classic, { ...classic, advanced: true }, native, { ...native, advanced: false },
    { ...classic, expansions: ['ix', 'choam', 'ecaz'] },
    { ...classic, advanced: true, expansions: ['ecaz'], players: [{ faction: 'moritani' }, { faction: 'harkonnen' }] },
  ]) assert.equal(bidPromiseModeSupported(game), true);
  for (const option of ['homeworlds', 'nexusCards', 'leaderSkills', 'techTokens', 'strongholdCards',
    'discoveryEnabled', 'discoveries', 'discoveryStash', 'greatMaker', 'ecazTreachery',
    'semutaPreview', 'kullPreview', 'nexusKullPreview', 'richeseBetrayalPreview'] as const)
    assert.equal(bidPromiseModeSupported({ ...native, [option]: true }), false, option);
  for (const game of [
    { ...native, expansions: ['ix', 'ix'] }, { ...native, expansions: ['ix', 'choam'] },
    { ...classic, expansions: ['unknown'] }, { ...classic, players: [{ faction: 'atreides' }, { faction: 'unknown' }] },
    { ...classic, players: [{ faction: 'atreides' }] },
    { ...classic, players: [...native.players, { faction: 'atreides' }] },
    { ...classic, advanced: 'basic' as unknown as boolean },
  ]) assert.equal(bidPromiseModeSupported(game), false);
});

void test('one new accepted bid fulfills Yes while smaller bids, an old high bid and a purchase do not substitute', () => {
  const original = [promise('at-least-six', 6)];
  let records = recordPromisedBid(original, 'respondent', opportunity({ bid: 2 }), 3);
  records = recordPromisedBid(records, 'respondent', opportunity({ bid: 4 }), 5);
  assert.equal(records[0].fulfilled, undefined, 'Accepted bids 3 and 5 are not a cumulative bid of 8');
  assert.equal(bidRequired(records, 'respondent', opportunity()), true);
  assert.deepEqual(bidPromiseRange(records, 'respondent', opportunity({ bid: 6 }), 10), { minimum: 7, maximum: 10 });
  const alreadyHighest = opportunity({ bid: 9, bidder: 'respondent' });
  assert.equal(bidPromiseRange(records, 'respondent', alreadyHighest, 10), null);
  assert.equal(bidRequired(records, 'respondent', alreadyHighest), true, 'A pre-existing winning bid does not answer a new promise');
  assert.equal(records[0].fulfilled, undefined, 'Holding the high bid or later paying its invoice is not a new accepted declaration');
  const accepted = recordPromisedBid(records, 'respondent', opportunity({ bid: 6 }), 7);
  assert.equal(accepted[0].fulfilled, true, 'A qualifying accepted bid is sufficient without winning the card');
  assert.equal(bidRequired(accepted, 'respondent', opportunity({ bid: 8, bidder: 'rival' })), false);
  assert.equal(original[0].fulfilled, undefined);
});

void test('joint Yes lower bounds and No caps preserve every qualifying single-bid amount', () => {
  const records = [promise('yes-six', 6), promise('yes-seven', 7),
    promise('no-ten', 10, false), promise('no-eight', 8, false)];
  const source = opportunity();
  assert.deepEqual(bidPromiseRange(records, 'respondent', source, 20), { minimum: 7, maximum: 7 });
  assert.deepEqual(bidPromiseRange(records.slice(0, 1).concat(records.slice(2)), 'respondent', source, 20),
    { minimum: 6, maximum: 7 });
  assert.deepEqual(bidPromiseRange(records, 'respondent', source, 7), { minimum: 7, maximum: 7 });
  assert.equal(bidPromiseRange(records, 'respondent', source, 6), null, 'Funding cannot be invented to meet Yes');
  assert.equal(bidPromiseRange(records, 'respondent', opportunity({ bid: 7 }), 20), null,
    'A later competing bid can remove the entire permissible interval');
});

void test('conflicting promises have no completion while a No-only cap never requires placing a bid', () => {
  const conflict = [promise('yes-eight', 8), promise('no-eight', 8, false)];
  assert.equal(bidPromiseRange(conflict, 'respondent', opportunity(), 20), null);
  assert.equal(bidRequired(conflict, 'respondent', opportunity()), true);
  const no = [promise('stay-below-six', 6, false), promise('stay-below-nine', 9, false)];
  assert.deepEqual(bidPromiseRange(no, 'respondent', opportunity(), 20), { minimum: 5, maximum: 5 });
  assert.equal(bidRequired(no, 'respondent', opportunity()), false);
  assert.equal(bidPromiseRange(no, 'respondent', opportunity({ bid: 5 }), 20), null);
  assert.equal(bidRequired(no, 'respondent', opportunity({ bid: 5 })), false,
    'An unavailable permitted bid does not turn a No answer into a required action');
});

void test('passed, current-highest and ineligible players have no future own declaration route in this opportunity', () => {
  const records = [promise('yes-six', 6)];
  for (const source of [opportunity({ passed: ['respondent'] }),
    opportunity({ bidder: 'respondent', bid: 6 }), opportunity({ eligible: ['asker', 'rival'] })]) {
    assert.equal(bidPromiseRange(records, 'respondent', source, 20), null);
    assert.equal(records[0].fulfilled, undefined, 'Eligibility and current high bids cannot fulfill a promise');
  }
  assert.deepEqual(bidPromiseRange(records, 'respondent', opportunity({ passed: ['asker'] }), 20),
    { minimum: 6, maximum: 20 });
});

void test('live obligations retain their original turn, physical lot and respondent while independent askers combine', () => {
  const own = promise('own', 6), secondAsker = promise('second-asker', 8, false, { asker: 'rival' });
  const records = [own, secondAsker,
    promise('other-turn', 99, true, { turn: 1 }),
    promise('other-physical-lot', 99, true, { source: 'another-original-lot', lot: 4 }),
    promise('other-respondent', 99, true, { player: 'rival' }),
    promise('already-fulfilled', 99, true, { fulfilled: true }),
    promise('already-released', 99, true, { released: true })];
  assert.deepEqual(liveBidPromises(records, 'respondent', opportunity()), [own, secondAsker]);
  assert.deepEqual(bidPromiseRange(records, 'respondent', opportunity(), 20), { minimum: 6, maximum: 7 });
  const accepted = recordPromisedBid(records, 'respondent', opportunity(), 6);
  assert.equal(accepted[0].fulfilled, true); assert.equal(accepted[1], secondAsker);
  for (let index = 2; index < records.length; index++) assert.equal(accepted[index], records[index]);
  assert.deepEqual(liveBidPromises(records, 'absent', opportunity()), []);
});

void test('maximum safe bids keep exact inclusive bounds and never overflow into an invented next bid', () => {
  const maximum = Number.MAX_SAFE_INTEGER;
  const source = opportunity({ bid: maximum - 1 });
  const yes = [promise('largest-yes', maximum)];
  assert.deepEqual(bidPromiseRange(yes, 'respondent', source, maximum), { minimum: maximum, maximum });
  assert.equal(recordPromisedBid(yes, 'respondent', source, maximum)[0].fulfilled, true);
  assert.equal(bidPromiseRange(yes, 'respondent', opportunity({ bid: maximum }), maximum), null);
  assert.equal(bidPromiseRange([promise('largest-no', maximum, false)], 'respondent', source, maximum), null);
  for (const invalid of [0, -1, 1.5, Number.NaN, Infinity, maximum + 1])
    assert.equal(bidPromiseRange([], 'respondent', opportunity(), invalid), null);
  for (const invalid of [-1, 1.5, Number.NaN, Infinity, maximum + 1])
    assert.equal(bidPromiseRange([], 'respondent', opportunity({ bid: invalid }), maximum), null);
});

void test('a rejected No bid is immutable and fulfilled Yes leaves No binding for later accepted declarations', () => {
  const yes = Object.freeze(promise('yes-six', 6)), no = Object.freeze(promise('no-eight', 8, false));
  const records = Object.freeze([yes, no]); const before = structuredClone(records);
  assert.throws(() => recordPromisedBid(records, 'respondent', opportunity(), 8), BidPromiseError);
  assert.deepEqual(records, before);
  const accepted = recordPromisedBid(records, 'respondent', opportunity(), 7);
  assert.notEqual(accepted, records); assert.notEqual(accepted[0], yes); assert.equal(accepted[0].fulfilled, true);
  assert.equal(accepted[1], no); assert.equal(accepted[1].fulfilled, undefined);
  assert.equal(bidRequired(accepted, 'respondent', opportunity()), false);
  assert.deepEqual(liveBidPromises(accepted, 'respondent', opportunity()), [no]);
  assert.throws(() => recordPromisedBid(accepted, 'respondent', opportunity({ bid: 7 }), 8), BidPromiseError);
  const repeated = recordPromisedBid(accepted, 'respondent', opportunity(), 7);
  assert.equal(repeated[0], accepted[0]); assert.equal(repeated[1], no);
  assert.deepEqual(records, before);
});

void test('persisted bid records require distinct events, physical sources and two actual participants with valid status', () => {
  const valid = [promise('live', 6), promise('fulfilled', 7, true, { fulfilled: true }),
    promise('released', 8, false, { released: true })];
  const before = structuredClone(valid);
  assert.doesNotThrow(() => validateBidPromises(valid, seats)); assert.deepEqual(valid, before);
  assert.doesNotThrow(() => validateBidPromises([], seats));
  const invalid: unknown[] = [
    null, {}, [null], [valid[0], { ...valid[1], event: 'live' }],
    [{ ...valid[0], event: '' }], [{ ...valid[0], source: '' }],
    [{ ...valid[0], player: 'outsider' }], [{ ...valid[0], asker: 'outsider' }],
    [{ ...valid[0], asker: 'respondent' }], [{ ...valid[0], answer: 'yes' }],
    [{ ...valid[0], fulfilled: 'true' }], [{ ...valid[0], released: 1 }],
    [{ ...valid[0], fulfilled: true, released: true }],
    [{ ...valid[0], turn: 0 }], [{ ...valid[0], lot: 0 }], [{ ...valid[0], minimum: 0 }],
  ];
  for (const records of invalid)
    assert.throws(() => validateBidPromises(records as BidPromise[], seats), BidPromiseError);
  assert.deepEqual(valid, before);
});
