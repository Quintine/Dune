import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BribePromiseError,
  bribeClaimText,
  bribePromiseModeSupported,
  bribePromiseRequirements,
  liveBribePromises,
  parseBribeClaim,
  recordPromisedBribe,
  validateBribePromises,
  type BribePromise,
} from '../game/bribe-promises';

const seats = ['payer', 'asker', 'recipient-a', 'recipient-b', 'other-payer'] as const;
function promise(event: string, minimum: number, extra: Partial<BribePromise> = {}): BribePromise {
  return { event, turn: 2, recipient: 'recipient-a', minimum, player: 'payer', asker: 'asker',
    answer: true, progress: 0, ...extra };
}

void test('bribe claims canonicalize positive safe turn and threshold while retaining an exact trimmed recipient', () => {
  const input = { turn: 2, recipient: 'recipient-a', minimum: 6, priorPayments: 4, privateSpice: 9 };
  const parsed = parseBribeClaim(input);
  assert.deepEqual(parsed, { turn: 2, recipient: 'recipient-a', minimum: 6 });
  assert.notEqual(parsed, input);
  assert.deepEqual(parseBribeClaim({ turn: Number.MAX_SAFE_INTEGER, recipient: 'recipient-a', minimum: Number.MAX_SAFE_INTEGER }),
    { turn: Number.MAX_SAFE_INTEGER, recipient: 'recipient-a', minimum: Number.MAX_SAFE_INTEGER });
  for (const field of ['turn', 'minimum'] as const)
    for (const value of [0, -1, 0.5, Number.NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '6', null, undefined])
      assert.throws(() => parseBribeClaim({ ...input, [field]: value }), BribePromiseError);
  for (const recipient of ['', ' ', ' recipient-a', 'recipient-a ', 1, null, undefined])
    assert.throws(() => parseBribeClaim({ ...input, recipient }), BribePromiseError);
  for (const value of [null, undefined, [], 'six', 6]) assert.throws(() => parseBribeClaim(value), BribePromiseError);
  assert.match(bribeClaimText(parsed, id => id === 'recipient-a' ? 'Atreides' : id), /at least 6 spice to Atreides/);
  assert.match(bribeClaimText(parsed), /ordinary bribes from now until this turn ends/);
});

void test('ordinary bribe scope preserves bare classic and selected native modes without widening optional modules', () => {
  const classic = { advanced: false, expansions: [], players: [{ faction: 'atreides' }, { faction: 'emperor' }] };
  const native = { advanced: true, expansions: ['ix', 'choam', 'ecaz'],
    players: ['ixians', 'tleilaxu', 'choam', 'richese', 'ecaz', 'moritani'].map(faction => ({ faction })) };
  for (const game of [classic, { ...classic, advanced: true }, native, { ...native, advanced: false },
    { ...classic, expansions: ['ix', 'choam', 'ecaz'] },
    { ...classic, advanced: true, expansions: ['ecaz'], players: [{ faction: 'moritani' }, { faction: 'harkonnen' }] },
  ]) assert.equal(bribePromiseModeSupported(game), true);
  const basicRichese = { advanced: false, expansions: ['choam'], semutaPreview: true,
    players: [{ faction: 'richese' }, { faction: 'atreides' }, { faction: 'emperor' }] };
  assert.equal(bribePromiseModeSupported(basicRichese), true);
  for (const game of [
    { ...basicRichese, advanced: true }, { ...basicRichese, kullPreview: true },
    { ...basicRichese, homeworlds: {} }, { ...basicRichese, nexusCards: {} },
    { ...basicRichese, players: classic.players },
  ]) assert.equal(bribePromiseModeSupported(game), false);
  for (const option of ['homeworlds', 'nexusCards', 'leaderSkills', 'techTokens', 'strongholdCards',
    'discoveryEnabled', 'discoveries', 'discoveryStash', 'greatMaker', 'ecazTreachery',
    'semutaPreview', 'kullPreview', 'nexusKullPreview', 'richeseBetrayalPreview'] as const)
    assert.equal(bribePromiseModeSupported({ ...native, [option]: true }), false, option);
  for (const game of [
    { ...native, expansions: ['ix', 'choam'] }, { ...native, expansions: ['ix', 'ix', 'ecaz'] },
    { ...classic, expansions: ['unknown'] }, { ...classic, players: [{ faction: 'atreides' }, { faction: 'unknown' }] },
    { ...classic, players: [{ faction: 'atreides' }] }, { ...classic, players: [...native.players, { faction: 'atreides' }] },
    { ...classic, advanced: 'basic' as unknown as boolean },
  ]) assert.equal(bribePromiseModeSupported(game), false);
});

void test('future payments accumulate only for the exact recipient and a later answer excludes earlier payments', () => {
  const original = [promise('first-answer', 5), promise('other-recipient', 2, { recipient: 'recipient-b' })];
  const first = recordPromisedBribe(original, 'payer', 2, { recipient: 'recipient-a', amount: 2 });
  assert.equal(first[0].progress, 2); assert.equal(first[0].fulfilled, undefined); assert.equal(first[1], original[1]);
  const second = recordPromisedBribe(first, 'payer', 2, { recipient: 'recipient-a', amount: 3 });
  assert.equal(second[0].progress, 5); assert.equal(second[0].fulfilled, true);
  const later = [...second, promise('later-answer', 2)];
  assert.deepEqual(bribePromiseRequirements(later, 'payer', 2), [
    { recipient: 'recipient-b', amount: 2 }, { recipient: 'recipient-a', amount: 2 },
  ], 'The earlier five-spice payment does not prepay the newly answered question');
  const third = recordPromisedBribe(later, 'payer', 2, { recipient: 'recipient-a', amount: 1 });
  assert.equal(third[0], second[0]); assert.equal(third[2].progress, 1); assert.equal(third[2].fulfilled, undefined);
  assert.equal(original[0].progress, 0); assert.equal(first[0].progress, 2);
});

void test('overlapping Yes answers share a recipient payment while different recipients require separate spice', () => {
  const records = [promise('a-five', 5, { progress: 2 }), promise('a-eight', 8, { progress: 3 }),
    promise('a-below-ten', 10, { answer: false, progress: 4 }),
    promise('b-four', 4, { recipient: 'recipient-b', progress: 1 })];
  assert.deepEqual(bribePromiseRequirements(records, 'payer', 2), [
    { recipient: 'recipient-a', amount: 5 }, { recipient: 'recipient-b', amount: 3 },
  ], 'Use maximum additional Yes deficit per recipient, not the sum of overlapping questions');
  const paidA = recordPromisedBribe(records, 'payer', 2, { recipient: 'recipient-a', amount: 5 });
  assert.deepEqual(paidA.map(record => record.progress), [7, 8, 9, 1]);
  assert.deepEqual(paidA.map(record => !!record.fulfilled), [true, true, false, false]);
  assert.deepEqual(bribePromiseRequirements(paidA, 'payer', 2), [{ recipient: 'recipient-b', amount: 3 }]);
  const paidB = recordPromisedBribe(paidA, 'payer', 2, { recipient: 'recipient-b', amount: 3 });
  assert.deepEqual(bribePromiseRequirements(paidB, 'payer', 2), []);
  assert.equal(paidB[2].fulfilled, undefined, 'The smaller No recipient total remains constrained to turn end');
});

void test('a recipient No cap rejects incompatible joint Yes while independent recipients and No-only answers remain possible', () => {
  const yes = promise('a-needs-five-more', 8, { progress: 3 });
  assert.equal(bribePromiseRequirements([yes, promise('a-only-four-more', 9, { answer: false, progress: 4 })], 'payer', 2), null);
  assert.deepEqual(bribePromiseRequirements([yes,
    promise('a-can-pay-five', 10, { answer: false, progress: 4 }),
    promise('b-below-one', 1, { recipient: 'recipient-b', answer: false }),
  ], 'payer', 2), [{ recipient: 'recipient-a', amount: 5 }]);
  assert.deepEqual(bribePromiseRequirements([promise('only-no', 3, { answer: false, progress: 2 })], 'payer', 2), []);
  assert.deepEqual(bribePromiseRequirements([], 'payer', 2), []);
});

void test('No prevents threshold evasion by split payments and rejected payment cannot partly fulfill another answer', () => {
  const original = [promise('yes-seven', 7), promise('no-seven', 7, { answer: false })];
  const first = recordPromisedBribe(original, 'payer', 2, { recipient: 'recipient-a', amount: 3 });
  const second = recordPromisedBribe(first, 'payer', 2, { recipient: 'recipient-a', amount: 3 });
  assert.deepEqual(second.map(record => record.progress), [6, 6]);
  const before = structuredClone(second); second.forEach(Object.freeze); Object.freeze(second);
  assert.throws(() => recordPromisedBribe(second, 'payer', 2, { recipient: 'recipient-a', amount: 1 }), BribePromiseError);
  assert.deepEqual(second, before); assert.equal(second[0].fulfilled, undefined);
  assert.equal(original[0].progress, 0); assert.equal(original[1].progress, 0);
});

void test('terminal, other-player, other-turn and other-recipient records preserve their exact references', () => {
  const records = [promise('live', 4), promise('different-asker', 6, { asker: 'recipient-b', answer: false }),
    promise('fulfilled', 1, { progress: 1, fulfilled: true }), promise('released', 1, { released: true }),
    promise('other-player', 1, { player: 'other-payer' }), promise('other-turn', 1, { turn: 1 }),
    promise('other-recipient', 1, { recipient: 'recipient-b' })];
  records.forEach(Object.freeze); Object.freeze(records);
  assert.deepEqual(liveBribePromises(records, 'payer', 2), [records[0], records[1], records[6]]);
  const paid = recordPromisedBribe(records, 'payer', 2, { recipient: 'recipient-a', amount: 4 });
  assert.equal(paid[0].fulfilled, true); assert.equal(paid[1].progress, 4); assert.equal(paid[1].fulfilled, undefined);
  for (let index = 2; index < records.length; index++) assert.equal(paid[index], records[index]);
  const unrelated = recordPromisedBribe(records, 'absent', 2, { recipient: 'recipient-a', amount: 1 });
  records.forEach((record, index) => assert.equal(unrelated[index], record));
});

void test('safe currency arithmetic preserves the inclusive maximum and refuses overflowing records or combined requirements', () => {
  const maximum = Number.MAX_SAFE_INTEGER;
  const lastOne = promise('largest-progress', maximum, { progress: maximum - 1 });
  assert.deepEqual(bribePromiseRequirements([lastOne], 'payer', 2), [{ recipient: 'recipient-a', amount: 1 }]);
  assert.equal(recordPromisedBribe([lastOne], 'payer', 2, { recipient: 'recipient-a', amount: 1 })[0].progress, maximum);
  const before = structuredClone(lastOne);
  assert.throws(() => recordPromisedBribe([lastOne], 'payer', 2, { recipient: 'recipient-a', amount: 2 }), BribePromiseError);
  assert.deepEqual(lastOne, before);
  assert.equal(bribePromiseRequirements([promise('a-maximum', maximum),
    promise('b-one', 1, { recipient: 'recipient-b' })], 'payer', 2), null);
  assert.deepEqual(bribePromiseRequirements([promise('a-maximum-minus-one', maximum - 1),
    promise('b-one', 1, { recipient: 'recipient-b' })], 'payer', 2), [
    { recipient: 'recipient-a', amount: maximum - 1 }, { recipient: 'recipient-b', amount: 1 },
  ]);
  assert.equal(bribePromiseRequirements([lastOne,
    promise('no-maximum', maximum, { answer: false, progress: maximum - 1 })], 'payer', 2), null);
  assert.throws(() => recordPromisedBribe([promise('no-maximum', maximum, { answer: false, progress: maximum - 1 })],
    'payer', 2, { recipient: 'recipient-a', amount: 1 }), BribePromiseError);
});

void test('actual payment inputs and malformed live progress fail without creating requirements or altering records', () => {
  const records = [promise('original', 3)]; const before = structuredClone(records);
  for (const amount of [0, -1, 0.5, Number.NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])
    assert.throws(() => recordPromisedBribe(records, 'payer', 2, { recipient: 'recipient-a', amount }), BribePromiseError);
  for (const recipient of ['', ' ', ' recipient-a', 'recipient-a '])
    assert.throws(() => recordPromisedBribe(records, 'payer', 2, { recipient, amount: 1 }), BribePromiseError);
  for (const progress of [-1, 0.5, Number.NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    const malformed = [{ ...records[0], progress }];
    assert.throws(() => bribePromiseRequirements(malformed, 'payer', 2), BribePromiseError);
    assert.throws(() => recordPromisedBribe(malformed, 'payer', 2, { recipient: 'recipient-a', amount: 1 }), BribePromiseError);
  }
  assert.deepEqual(records, before);
});

void test('record validation binds events, actual payer and recipient seats and consistent cumulative terminal states', () => {
  const valid = [promise('live-yes', 3, { progress: 2 }),
    promise('fulfilled-yes', 3, { progress: 3, fulfilled: true }),
    promise('released-yes', 3, { progress: 1, released: true }),
    promise('live-no', 3, { progress: 2, answer: false }),
    promise('completed-no', 3, { progress: 2, answer: false, fulfilled: true }),
    promise('released-no', 3, { progress: 2, answer: false, released: true }),
    promise('pay-the-asker', 1, { recipient: 'asker' })];
  const before = structuredClone(valid);
  assert.doesNotThrow(() => validateBribePromises(valid, seats)); assert.deepEqual(valid, before);
  assert.doesNotThrow(() => validateBribePromises(JSON.parse(JSON.stringify(valid)) as BribePromise[], seats));
  assert.doesNotThrow(() => validateBribePromises([], seats));
  const base = promise('event', 3);
  const invalid: unknown[] = [null, {}, [null], [base, { ...base }],
    ...[{ event: '' }, { event: ' ' }, { player: 'outsider' }, { asker: 'outsider' }, { asker: 'payer' },
      { recipient: 'outsider' }, { recipient: 'payer' }, { recipient: ' recipient-a' },
      { answer: 'yes' }, { progress: -1 }, { progress: 0.5 }, { progress: Number.NaN },
      { progress: Number.MAX_SAFE_INTEGER + 1 }, { fulfilled: 1 }, { released: 'true' },
      { fulfilled: true, progress: 2 }, { fulfilled: false, progress: 3 }, { progress: 3 },
      { fulfilled: true, released: true, progress: 3 }, { answer: false, progress: 3 },
      { answer: false, progress: 3, fulfilled: true }, { answer: false, progress: 3, released: true },
      { turn: 0 }, { minimum: 0 }].map(extra => [{ ...base, ...extra }])];
  for (const records of invalid)
    assert.throws(() => validateBribePromises(records as BribePromise[], seats), BribePromiseError);
  assert.deepEqual(valid, before);
});
