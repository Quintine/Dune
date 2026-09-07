import test from 'node:test';
import assert from 'node:assert/strict';
import { leaders, type Card } from '../game/cards';
import {
  CHOAM_AUDITOR_ID,
  isAuditorLeader,
  createAuditorLeader,
  auditCandidates,
  auditCount,
  sampleAuditCards,
} from '../game/choam-auditor';
import { matchingTraitor, traitorDeck } from '../game/traitors';

function hand(): Card[] {
  return [
    { id: 'shield-a', name: 'Shield', kind: 'shield' },
    { id: 'shield-b', name: 'Shield', kind: 'shield' },
    { id: 'hero', name: 'Cheap Hero', kind: 'hero' },
    { id: 'poison', name: 'Chaumas', kind: 'poison' },
    {
      id: 'portable',
      name: 'Portable Snooper',
      kind: 'special',
      effect: 'portableSnooper',
    },
  ];
}

void test('Auditor is a separate canonical strength-2 Advanced disc with an independent factory', () => {
  const ordinary = leaders('choam');
  const expected = {
    id: 'choam-auditor',
    name: 'Auditor',
    strength: 2,
    faction: 'choam',
    dead: false,
    deaths: 0,
  };
  assert.equal(CHOAM_AUDITOR_ID, 'choam-auditor');
  const first = createAuditorLeader();
  const second = createAuditorLeader();
  assert.deepEqual(first, expected);
  assert.notEqual(first, second);
  first.dead = true;
  first.deaths = 2;
  first.usedAt = 'arrakeen';
  first.capturedBy = 'invalid-fixture-custodian';
  assert.deepEqual(second, expected);
  assert.deepEqual(createAuditorLeader(), expected);
  assert.equal(ordinary.length, 5);
  assert.equal(ordinary.some(isAuditorLeader), false);
  assert.deepEqual(leaders('choam'), ordinary);
  const traits = traitorDeck([{ leaders: [...ordinary, second] }]);
  assert.equal(traits.length, 6);
  assert.equal(matchingTraitor(traits, CHOAM_AUDITOR_ID), CHOAM_AUDITOR_ID);
});

void test('Auditor identity uses the physical ID, independent of name or mutable battle history', () => {
  assert.equal(isAuditorLeader(createAuditorLeader()), true);
  const dead = { ...createAuditorLeader(), dead: true, deaths: 3 };
  assert.equal(isAuditorLeader(dead), true);
  assert.equal(isAuditorLeader({ id: CHOAM_AUDITOR_ID }), true);
  for (const id of [
    'Auditor',
    'choam-4',
    'choam-auditor-copy',
    'CHOAM-AUDITOR',
    '',
  ])
    assert.equal(isAuditorLeader({ ...createAuditorLeader(), id }), false);
});

void test('eligible cards exclude only exact physically used IDs, including hero and late defense', () => {
  const original = hand();
  const before = structuredClone(original);
  const used = [
    'shield-a',
    'hero',
    'poison',
    'portable',
    'discarded-weapon',
    'shield-a',
  ];
  const eligible = auditCandidates(original, used);
  assert.deepEqual(
    eligible.map((card) => card.id),
    ['shield-b'],
  );
  assert.notEqual(eligible[0], original[1]);
  eligible[0].name = 'Changed snapshot';
  assert.deepEqual(original, before);
  assert.deepEqual(
    auditCandidates(original, ['Shield']).map((card) => card.id),
    before.map((card) => card.id),
  );
  assert.deepEqual(used, [
    'shield-a',
    'hero',
    'poison',
    'portable',
    'discarded-weapon',
    'shield-a',
  ]);
});

void test('inspection and whole-audit cancellation counts depend on actual eligible pool and survival', () => {
  const original = hand();
  for (let size = 0; size <= original.length; size++) {
    const current = original.slice(0, size);
    for (const survived of [true, false]) {
      assert.equal(
        auditCount(current, [], survived),
        Math.min(size, survived ? 2 : 1),
      );
      assert.equal(
        auditCount(
          current,
          current.map((card) => card.id),
          survived,
        ),
        0,
      );
      if (size)
        assert.equal(
          auditCount(
            current,
            current.slice(1).map((card) => card.id),
            survived,
          ),
          1,
        );
    }
  }
});

void test('selecting all eligible cards or no cards consumes no RNG and returns detached snapshots', () => {
  const original = hand();
  const before = structuredClone(original);
  const neverDraw = (): number => {
    throw new Error('Unexpected randomness');
  };
  for (const survived of [true, false]) {
    const limit = survived ? 2 : 1;
    for (let size = 0; size <= limit; size++) {
      const selected = sampleAuditCards(
        original.slice(0, size),
        [],
        survived,
        neverDraw,
      );
      assert.deepEqual(selected, original.slice(0, size));
      if (selected.length) selected[0].name = 'Changed snapshot';
    }
    assert.deepEqual(
      sampleAuditCards(
        original,
        original.map((card) => card.id),
        survived,
        neverDraw,
      ),
      [],
    );
  }
  assert.deepEqual(original, before);
});

void test('partial sampling reaches every distinct ordered pair uniformly without replacement', () => {
  const original = hand();
  const before = structuredClone(original);
  const pairs = new Map<string, number>();
  for (let first = 0; first < 5; first++) {
    for (let second = 0; second < 4; second++) {
      const draws = [(first + 0.5) / 5, (second + 0.5) / 4];
      let calls = 0;
      const selected = sampleAuditCards(
        original,
        [],
        true,
        () => draws[calls++],
      );
      assert.equal(calls, 2);
      assert.equal(selected.length, 2);
      assert.notEqual(selected[0].id, selected[1].id);
      const key = selected.map((card) => card.id).join('/');
      pairs.set(key, (pairs.get(key) ?? 0) + 1);
      selected[0].name = 'Changed snapshot';
    }
  }
  assert.equal(pairs.size, 20);
  assert.deepEqual([...pairs.values()], Array(20).fill(1));
  const singles = original.map(
    (_, index) =>
      sampleAuditCards(original, [], false, () => (index + 0.5) / 5)[0].id,
  );
  assert.deepEqual(
    singles,
    original.map((card) => card.id),
  );
  assert.deepEqual(original, before);
});

void test('partial sampling honors exclusions and valid RNG endpoints without changing the physical hand', () => {
  const original = hand();
  const before = structuredClone(original);
  const used = ['shield-a', 'portable'];
  assert.deepEqual(
    sampleAuditCards(original, used, true, () => 0).map((card) => card.id),
    ['shield-b', 'hero'],
  );
  assert.deepEqual(
    sampleAuditCards(original, used, true, () => 1 - Number.EPSILON).map(
      (card) => card.id,
    ),
    ['poison', 'shield-b'],
  );
  assert.deepEqual(original, before);
});

void test('invalid physical pools, survival states and RNG draws reject without mutating inputs', () => {
  const original = hand();
  const before = structuredClone(original);
  for (const invalid of [
    NaN,
    Infinity,
    -Infinity,
    -Number.EPSILON,
    1,
    2,
    '0',
    null,
    undefined,
  ]) {
    assert.throws(
      () => sampleAuditCards(original, [], true, () => invalid as number),
      /random draws/,
    );
  }
  let calls = 0;
  assert.throws(
    () => sampleAuditCards(original, [], true, () => (calls++ === 0 ? 0 : NaN)),
    /random draws/,
  );
  assert.equal(calls, 2);
  for (const invalid of [null, undefined, 0, 1, 'true']) {
    assert.throws(
      () => auditCount(original, [], invalid as unknown as boolean),
      /survival/,
    );
    assert.throws(
      () =>
        sampleAuditCards(original, [], invalid as unknown as boolean, () => 0),
      /survival/,
    );
  }
  for (const pool of [
    [original[0], original[0]],
    [{ ...original[0], id: '' }],
    [{ ...original[0], id: ' ' }],
    [null],
  ]) {
    assert.throws(() => auditCandidates(pool as Card[], []), /unique physical/);
  }
  assert.throws(() => auditCandidates(original, ['']), /used-card IDs/);
  assert.throws(
    () => auditCandidates(original, [null as unknown as string]),
    /used-card IDs/,
  );
  assert.throws(
    () => auditCandidates(null as unknown as Card[], []),
    /requires a hand/,
  );
  assert.throws(
    () => sampleAuditCards(original, [], true, null as unknown as () => number),
    /random source/,
  );
  assert.deepEqual(original, before);
});
