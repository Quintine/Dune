import assert from 'node:assert/strict';
import test from 'node:test';
import {
  forceCountCounterError,
  forceCountFactMatches,
  forceCountFactText,
  parseForceCountFact,
  type ForceCountFact,
  type ForceCountPlayer,
} from '../game/truthtrance-force-count';

const locations = [
  { territory: 'arrakeen', sector: 10 },
  { territory: 'imperial_basin', sector: 9 },
] as const;

function fact(
  zone: ForceCountFact['zone'],
  counter: ForceCountFact['counter'] = 'total',
  compare: ForceCountFact['compare'] = 'eq',
  value = 0,
): ForceCountFact {
  return { kind: 'forceCount', zone, counter, compare, value };
}

void test('parser accepts exact live pools and rejects extra, mutually exclusive, unknown, and unsafe fields immutably', () => {
  const input = {
    kind: 'forceCount',
    zone: { kind: 'location', territory: 'arrakeen', sector: 10 },
    counter: 'elite',
    compare: 'gte',
    value: 2,
  };
  const before = structuredClone(input);
  assert.deepEqual(parseForceCountFact(input, locations), input);
  assert.deepEqual(input, before);
  for (const zone of [
    { kind: 'reserves' },
    { kind: 'tanks' },
    { kind: 'location', territory: 'imperial_basin', sector: 9 },
  ])
    assert.deepEqual(
      parseForceCountFact({ ...input, zone }, locations).zone,
      zone,
    );

  for (const malformed of [
    { ...input, privateHint: true },
    { ...input, zone: { kind: 'reserves', territory: 'arrakeen' } },
    {
      ...input,
      zone: {
        kind: 'location',
        territory: 'arrakeen',
        sector: 10,
        pool: 'reserves',
      },
    },
    { ...input, zone: { kind: 'location', territory: 'arrakeen', sector: 9 } },
    { ...input, zone: { kind: 'location', territory: 'unknown', sector: 10 } },
    {
      ...input,
      zone: { kind: 'location', territory: 'arrakeen', sector: 10.5 },
    },
    { ...input, zone: { kind: 'homeworld', territory: 'caladan', sector: 0 } },
  ])
    assert.throws(() => parseForceCountFact(malformed, locations));

  for (const counter of ['special', '', 1, null, undefined])
    assert.throws(() => parseForceCountFact({ ...input, counter }, locations));
  for (const compare of ['gt', '=', '', 1, null, undefined])
    assert.throws(() => parseForceCountFact({ ...input, compare }, locations));
  for (const value of [
    -1,
    0.5,
    NaN,
    Infinity,
    Number.MAX_SAFE_INTEGER + 1,
    '2',
    null,
  ])
    assert.throws(() => parseForceCountFact({ ...input, value }, locations));
});

void test('current totals include elites while normal counts subtract the tracked physical subset in every pool', () => {
  const player: ForceCountPlayer = {
    faction: 'ixians',
    reserves: 10,
    tanks: 4,
    forces: { 'arrakeen:10': 6 },
    elites: {
      reserves: 3,
      tanks: 1,
      forces: { 'arrakeen:10': 2 },
    },
  };
  const before = structuredClone(player);
  for (const [zone, totals] of [
    [{ kind: 'reserves' }, [10, 7, 3]],
    [{ kind: 'tanks' }, [4, 3, 1]],
    [{ kind: 'location', territory: 'arrakeen', sector: 10 }, [6, 4, 2]],
    [{ kind: 'location', territory: 'imperial_basin', sector: 9 }, [0, 0, 0]],
  ] as const)
    for (const [index, counter] of (
      ['total', 'normal', 'elite'] as const
    ).entries()) {
      const value = totals[index];
      assert.equal(
        forceCountFactMatches(player, fact(zone, counter, 'eq', value)),
        true,
      );
      assert.equal(
        forceCountFactMatches(player, fact(zone, counter, 'gte', value)),
        true,
      );
      assert.equal(
        forceCountFactMatches(player, fact(zone, counter, 'lte', value)),
        true,
      );
      assert.equal(
        forceCountFactMatches(player, fact(zone, counter, 'gte', value + 1)),
        false,
      );
    }
  assert.deepEqual(player, before);
});

void test('ordinary factions need no fabricated elite ledger, while split factions fail closed for denomination questions', () => {
  const ordinary: ForceCountPlayer = {
    faction: 'atreides',
    reserves: 8,
    tanks: 2,
    forces: { 'arrakeen:10': 5 },
  };
  assert.equal(forceCountCounterError(ordinary, 'normal'), null);
  assert.equal(
    forceCountFactMatches(
      ordinary,
      fact({ kind: 'reserves' }, 'normal', 'eq', 8),
    ),
    true,
  );
  assert.equal(
    forceCountFactMatches(
      ordinary,
      fact({ kind: 'reserves' }, 'elite', 'eq', 0),
    ),
    true,
  );

  const untracked: ForceCountPlayer = { ...ordinary, faction: 'emperor' };
  assert.equal(forceCountCounterError(untracked, 'total'), null);
  assert.match(forceCountCounterError(untracked, 'elite')!, /unavailable/);
  assert.equal(
    forceCountFactMatches(
      untracked,
      fact({ kind: 'reserves' }, 'total', 'eq', 8),
    ),
    true,
  );
  assert.throws(
    () =>
      forceCountFactMatches(
        untracked,
        fact({ kind: 'reserves' }, 'normal', 'eq', 8),
      ),
    /unavailable/,
  );
});

void test('matcher validates only the queried pool and rejects malformed selected totals or elite subsets', () => {
  const base: ForceCountPlayer = {
    faction: 'ixians',
    reserves: 7,
    tanks: 2,
    forces: { 'arrakeen:10': 4 },
    elites: { reserves: 2, tanks: 1, forces: { 'arrakeen:10': 1 } },
  };
  const unrelated = {
    ...structuredClone(base),
    tanks: -3,
    forces: null,
  } as unknown as ForceCountPlayer;
  assert.equal(
    forceCountFactMatches(
      unrelated,
      fact({ kind: 'reserves' }, 'normal', 'eq', 5),
    ),
    true,
  );

  for (const reserves of [-1, 1.5, NaN, Number.MAX_SAFE_INTEGER + 1])
    assert.throws(() =>
      forceCountFactMatches({ ...base, reserves }, fact({ kind: 'reserves' })),
    );
  assert.throws(
    () =>
      forceCountFactMatches(
        { ...base, elites: { ...base.elites!, reserves: 8 } },
        fact({ kind: 'reserves' }, 'total', 'eq', 7),
      ),
    /exceeds/,
  );
  assert.throws(
    () =>
      forceCountFactMatches(
        { ...base, elites: { ...base.elites!, forces: { 'arrakeen:10': 5 } } },
        fact({ kind: 'location', territory: 'arrakeen', sector: 10 }, 'elite'),
      ),
    /exceeds/,
  );
  assert.throws(
    () =>
      forceCountFactMatches(
        { ...base, elites: { ...base.elites!, tanks: -1 } },
        fact({ kind: 'tanks' }, 'total'),
      ),
    /nonnegative/,
  );
});

void test('question text uses printed territory display and states current pool, denomination, and comparison', () => {
  assert.equal(
    forceCountFactText(fact({ kind: 'reserves' }, 'total', 'eq', 1)),
    'you currently have exactly 1 physical force in your reserves',
  );
  assert.equal(
    forceCountFactText(fact({ kind: 'tanks' }, 'normal', 'lte', 2)),
    'you currently have at most 2 normal forces in the Tleilaxu Tanks',
  );
  assert.equal(
    forceCountFactText(
      fact(
        { kind: 'location', territory: 'arrakeen', sector: 10 },
        'elite',
        'gte',
        3,
      ),
    ),
    'you currently have at least 3 elite forces in Arrakeen, sector 10',
  );
});
