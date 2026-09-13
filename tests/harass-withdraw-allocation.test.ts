import test from 'node:test';
import assert from 'node:assert/strict';
import { casualtyOptions } from '../game/combat';
import {
  defaultHarassWithdrawAllocation,
  harassWithdrawCommitments,
  harassWithdrawNeedsAllocation,
  quoteHarassWithdraw,
  HarassWithdrawError,
  type HarassWithdrawContext,
  type HarassWithdrawSelection,
} from '../game/harass-withdraw';

const mixed = (): HarassWithdrawContext => ({
  blocked: null,
  forces: { normal: 3, elite: 2, eliteStrength: 1, freeSupport: true },
  locations: {
    'imperial_basin:9': { normal: 2, elite: 1 },
    'imperial_basin:10': { normal: 1, elite: 1 },
  },
});
const ordinary = (): HarassWithdrawContext => ({
  blocked: null,
  forces: { normal: 5, elite: 0, eliteStrength: 1, freeSupport: false },
  locations: {
    'imperial_basin:9': { normal: 2, elite: 0 },
    'imperial_basin:10': { normal: 3, elite: 0 },
  },
});
function reject(
  context: HarassWithdrawContext,
  dial: number,
  support: number,
  selection: unknown,
) {
  const before = structuredClone({ context, selection });
  assert.throws(
    () =>
      quoteHarassWithdraw(
        context,
        dial,
        support,
        selection as HarassWithdrawSelection,
      ),
    HarassWithdrawError,
  );
  assert.deepEqual({ context, selection }, before);
}

void test('mixed regular/elite commitments are physical choices; explicit returns select one without mutating custody', () => {
  const context = mixed();
  const before = structuredClone(context);
  assert.deepEqual(harassWithdrawCommitments(context, 2, 0), [
    { normal: 2, elite: 0 },
    { normal: 1, elite: 1 },
    { normal: 0, elite: 2 },
  ]);
  assert.equal(harassWithdrawNeedsAllocation(context, 2, 0), true);
  assert.throws(
    () => quoteHarassWithdraw(context, 2, 0),
    /ambiguous regular\/elite/,
  );
  const selection = {
    'imperial_basin:9': { normal: 1, elite: 1 },
    'imperial_basin:10': { normal: 1, elite: 0 },
  };
  const quote = quoteHarassWithdraw(context, 2, 0, selection);
  assert.deepEqual(quote.returned, { normal: 2, elite: 1 });
  assert.deepEqual(quote.remaining, { ...context.forces, normal: 1, elite: 1 });
  assert.deepEqual(quote.locations, selection);
  assert.notEqual(quote.locations, selection);
  assert.notEqual(
    quote.locations['imperial_basin:9'],
    selection['imperial_basin:9'],
  );
  assert.deepEqual(context, before);
});

void test('multiple sectors may explicitly divide a uniquely typed return while legacy callers retain the sector guard', () => {
  const context = ordinary();
  assert.deepEqual(harassWithdrawCommitments(context, 2, 2), [
    { normal: 2, elite: 0 },
  ]);
  assert.equal(harassWithdrawNeedsAllocation(context, 2, 2), true);
  assert.throws(
    () => quoteHarassWithdraw(context, 2, 2),
    /ambiguous allocation among sectors/,
  );
  for (const [a, b] of [
    [0, 3],
    [1, 2],
    [2, 1],
  ]) {
    const quote = quoteHarassWithdraw(context, 2, 2, {
      'imperial_basin:9': { normal: a, elite: 0 },
      'imperial_basin:10': { normal: b, elite: 0 },
    });
    assert.deepEqual(quote.returned, { normal: 3, elite: 0 });
    assert.deepEqual(quote.remaining, { ...context.forces, normal: 2 });
    assert.ok(
      Object.values(quote.locations).every(
        (group) => group.normal + group.elite > 0,
      ),
    );
  }
});

void test('Advanced paid/unpaid and Ixian half-strength commitments retain exact regular/elite complements', () => {
  for (const forces of [
    { normal: 3, elite: 2, eliteStrength: 2 as const, freeSupport: false },
    {
      normal: 3,
      elite: 2,
      eliteStrength: 2 as const,
      freeSupport: false,
      normalFixedHalf: true,
    },
    {
      normal: 3,
      elite: 2,
      eliteStrength: 1 as const,
      freeSupport: false,
      eliteFreeSupport: true,
    },
  ]) {
    const context: HarassWithdrawContext = { ...mixed(), forces };
    for (const [dial, support] of [
      [0.5, 0],
      [2, 0],
      [2, 1],
      [3, 2],
    ]) {
      const choices = casualtyOptions(forces, dial, support);
      if (!choices.length) continue;
      const physical = harassWithdrawCommitments(context, dial, support);
      assert.equal(
        new Set(physical.map((choice) => JSON.stringify(choice))).size,
        physical.length,
      );
      assert.ok(
        physical.every(
          (choice) => Object.keys(choice).sort().join(',') === 'elite,normal',
        ),
      );
      for (const choice of physical) {
        let normal = forces.normal - choice.normal,
          elite = forces.elite - choice.elite;
        const selection = Object.fromEntries(
          Object.entries(context.locations).map(([key, group]) => {
            const selected = {
              normal: Math.min(normal, group.normal),
              elite: Math.min(elite, group.elite),
            };
            normal -= selected.normal;
            elite -= selected.elite;
            return [key, selected];
          }),
        );
        const quote = quoteHarassWithdraw(context, dial, support, selection);
        assert.deepEqual(
          { normal: quote.remaining.normal, elite: quote.remaining.elite },
          choice,
        );
      }
    }
  }
});

void test('default physical returns are deterministic across location insertion order and are always legal', () => {
  const context = mixed(),
    before = structuredClone(context);
  const reversed = {
    ...context,
    locations: Object.fromEntries(Object.entries(context.locations).reverse()),
  };
  for (const dial of [0, 1, 2, 5]) {
    const allocation = defaultHarassWithdrawAllocation(context, dial, 0);
    assert.deepEqual(
      allocation,
      defaultHarassWithdrawAllocation(reversed, dial, 0),
    );
    const quote = quoteHarassWithdraw(context, dial, 0, allocation);
    assert.deepEqual(quote.locations, allocation);
    assert.deepEqual(
      { normal: quote.remaining.normal, elite: quote.remaining.elite },
      harassWithdrawCommitments(context, dial, 0)[0],
    );
  }
  assert.deepEqual(context, before);
});

void test('a chosen physical commitment gets a shared legal default, while invented or malformed commitments reject', () => {
  const context = mixed(),
    before = structuredClone(context);
  for (const commitment of harassWithdrawCommitments(context, 2, 0)) {
    const selection = defaultHarassWithdrawAllocation(
      context,
      2,
      0,
      commitment,
    );
    const quote = quoteHarassWithdraw(context, 2, 0, selection);
    assert.deepEqual(
      { normal: quote.remaining.normal, elite: quote.remaining.elite },
      commitment,
    );
  }
  for (const commitment of [
    { normal: 3, elite: 0 },
    { normal: 1, elite: 0 },
    { normal: 1, elite: 1, paidNormal: 0 },
    { normal: -1, elite: 3 },
    null,
  ])
    assert.throws(
      () => defaultHarassWithdrawAllocation(context, 2, 0, commitment as never),
      HarassWithdrawError,
    );
  assert.deepEqual(context, before);
});

void test('explicit empty returns require a full physical commitment, while zero dial returns every physical counter', () => {
  const context = ordinary();
  assert.deepEqual(quoteHarassWithdraw(context, 5, 5, {}).returned, {
    normal: 0,
    elite: 0,
  });
  assert.equal(harassWithdrawNeedsAllocation(context, 5, 5), false);
  assert.deepEqual(
    quoteHarassWithdraw(context, 5, 5),
    quoteHarassWithdraw(context, 5, 5, {}),
  );
  reject(context, 2, 2, {});
  assert.equal(harassWithdrawNeedsAllocation(context, 0, 0), false);
  assert.deepEqual(
    quoteHarassWithdraw(context, 0, 0).locations,
    context.locations,
  );
  assert.deepEqual(
    quoteHarassWithdraw(context, 0, 0, context.locations).remaining,
    { ...context.forces, normal: 0, elite: 0 },
  );
});

void test('return selection rejects malformed groups, unknown locations, overdraw and a wrong typed complement immutably', () => {
  const context = mixed();
  for (const selection of [
    null,
    [],
    2,
    'all',
    { 'unknown:0': { normal: 3, elite: 0 } },
    { 'imperial_basin:9': { normal: 3, elite: 0 } },
    { 'imperial_basin:9': { normal: 0, elite: 2 } },
    { 'imperial_basin:9': { normal: 1 } },
    { 'imperial_basin:9': { normal: 1, elite: 1, paidNormal: 1 } },
    { 'imperial_basin:9': { normal: -1, elite: 0 } },
    { 'imperial_basin:9': { normal: 0.5, elite: 0 } },
    { 'imperial_basin:9': { normal: NaN, elite: 0 } },
    { 'imperial_basin:9': { normal: Number.MAX_SAFE_INTEGER + 1, elite: 0 } },
    { 'imperial_basin:9': { normal: '2', elite: 1 } },
    { 'imperial_basin:9': { normal: 1, elite: 0 } },
  ])
    reject(context, 2, 0, selection);
  const advanced = {
    ...context,
    forces: { ...context.forces, eliteStrength: 2 as const },
  };
  // Leaves two regular counters: strength two, not the revealed strength four.
  reject(advanced, 4, 0, {
    'imperial_basin:9': { normal: 1, elite: 1 },
    'imperial_basin:10': { normal: 0, elite: 1 },
  });
});

void test('all allocation helpers validate context and dial before reporting an ambiguous or default choice', () => {
  for (const context of [
    { ...mixed(), blocked: 'A combined rule remains guarded.' },
    { ...mixed(), locations: null },
    { ...mixed(), locations: [] },
    { ...mixed(), locations: { 'imperial_basin:9': { normal: 3, elite: 1 } } },
    {
      ...mixed(),
      locations: { 'imperial_basin:9': { normal: 3, elite: 2, other: 0 } },
    },
    { ...mixed(), forces: { ...mixed().forces, elite: 0, temporaryElite: 1 } },
  ] as unknown as HarassWithdrawContext[]) {
    const before = structuredClone(context);
    for (const helper of [
      harassWithdrawCommitments,
      harassWithdrawNeedsAllocation,
      defaultHarassWithdrawAllocation,
    ])
      assert.throws(() => helper(context, 2, 0), HarassWithdrawError);
    assert.deepEqual(context, before);
  }
  for (const [dial, support] of [
    [NaN, 0],
    [1.25, 0],
    [-1, 0],
    [2, 0.5],
    [2, 6],
  ])
    for (const helper of [
      harassWithdrawCommitments,
      harassWithdrawNeedsAllocation,
      defaultHarassWithdrawAllocation,
    ])
      assert.throws(
        () => helper(ordinary(), dial, support),
        HarassWithdrawError,
      );
});

void test('legacy omitted returns retain insertion order and unique allocation JSON shape', () => {
  const context: HarassWithdrawContext = {
    blocked: null,
    forces: { normal: 3, elite: 2, eliteStrength: 2, freeSupport: true },
    locations: {
      'imperial_basin:9': { normal: 0, elite: 2 },
      'imperial_basin:11': { normal: 3, elite: 0 },
    },
  };
  const quote = quoteHarassWithdraw(context, 0, 0);
  assert.equal(
    JSON.stringify(quote.locations),
    '{"imperial_basin:11":{"normal":3,"elite":0},"imperial_basin:9":{"normal":0,"elite":2}}',
  );
  assert.equal(harassWithdrawNeedsAllocation(context, 0, 0), false);
});
