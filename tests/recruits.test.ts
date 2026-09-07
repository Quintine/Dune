import test from 'node:test';
import assert from 'node:assert/strict';
import {
  recruitsRevivalAllowance,
  type RecruitsRevivalFacts,
} from '../game/recruits';
import {
  eliteRevivalRemaining,
  forceRevivalLimit,
  forceRevivalPrice,
  newRevivalRules,
} from '../game/revival';
import { FACTIONS } from '../game/catalog';

// GF9 Ecaz & Moritani pp11,16: double CURRENT rate, ordinary limit7;
// low-threshold Fremen4 doubles but is capped7. Other policy inputs below
// are supplied facts, not a resolution of the open questions in
// docs/RECRUITS_RULES.md (late paid revivals, pending quotes, unlimited caps).
// https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf
const active = { turn: 4, recruits: { turn: 4 } } as const;
const facts = (
  overrides: Partial<RecruitsRevivalFacts> = {},
): RecruitsRevivalFacts => ({
  currentFreeRate: 2,
  currentLimit: 3,
  revived: 0,
  freeAllowanceUsed: 0,
  freeRateCap: 7,
  ...overrides,
});

void test('Recruits doubles every current ordinary rate and raises three/five-force totals to seven', () => {
  for (const faction of FACTIONS) {
    const baseLimit = forceRevivalLimit(
      {},
      { id: faction.id, faction: faction.id },
    );
    const allowance = recruitsRevivalAllowance(
      active,
      facts({ currentFreeRate: faction.revival, currentLimit: baseLimit }),
    );
    assert.equal(
      allowance.freeRate,
      Math.min(faction.revival * 2, 7),
      faction.id,
    );
    assert.equal(
      allowance.limit,
      ['choam', 'tleilaxu'].includes(faction.id) ? 20 : 7,
    );
    assert.equal(allowance.remaining, allowance.limit);
    assert.equal(allowance.freeRemaining, allowance.freeRate);
  }
  assert.equal(
    recruitsRevivalAllowance(active, facts({ currentLimit: 5 })).limit,
    7,
  );
});

void test('the official current-rate Fremen example is four doubled and capped at seven', () => {
  assert.deepEqual(
    recruitsRevivalAllowance(active, facts({ currentFreeRate: 4 })),
    {
      active: true,
      freeRate: 7,
      limit: 7,
      remaining: 7,
      freeRemaining: 7,
    },
  );
  // A settled ally grant/current rate is input; printed faction metadata is
  // intentionally not consulted or permanently changed by this calculator.
  assert.equal(
    recruitsRevivalAllowance(active, facts({ currentFreeRate: 3 })).freeRate,
    6,
  );
});

void test('prior total revivals and explicitly resolved free usage consume different ledgers', () => {
  const base = facts({ revived: 3, freeAllowanceUsed: 2 });
  const freeUsed = recruitsRevivalAllowance(active, base);
  assert.equal(freeUsed.remaining, 4);
  assert.equal(freeUsed.freeRemaining, 2);
  // The caller can instead supply total-revival usage if that is the chosen
  // late-play ruling. The helper neither assumes it nor refunds the paid unit.
  const totalUsed = recruitsRevivalAllowance(active, {
    ...base,
    freeAllowanceUsed: 3,
  });
  assert.equal(totalUsed.remaining, 4);
  assert.equal(totalUsed.freeRemaining, 1);
  const exhausted = recruitsRevivalAllowance(
    active,
    facts({ revived: 8, freeAllowanceUsed: 9 }),
  );
  assert.equal(exhausted.remaining, 0);
  assert.equal(exhausted.freeRemaining, 0);
  assert.equal(
    recruitsRevivalAllowance(
      active,
      facts({ revived: 6, freeAllowanceUsed: 0 }),
    ).freeRemaining,
    1,
    'unspent free entitlement cannot exceed the remaining physical limit',
  );
});

void test('turn stamps expire in either direction and repeated inspection never compounds the rate', () => {
  const input = Object.freeze(facts());
  const scope = Object.freeze({
    turn: 4,
    recruits: Object.freeze({ turn: 4 }),
  });
  assert.deepEqual(
    recruitsRevivalAllowance(scope, input),
    recruitsRevivalAllowance(scope, input),
  );
  for (const scope of [
    { turn: 4 },
    { turn: 4, recruits: null },
    { turn: 5, recruits: { turn: 4 } },
    { turn: 3, recruits: { turn: 4 } },
  ]) {
    const result = recruitsRevivalAllowance(scope, input);
    assert.equal(result.active, false);
    assert.equal(result.freeRate, 2);
    assert.equal(result.limit, 3);
  }
  assert.equal(input.currentFreeRate, 2);
});

void test('unlimited physical allowances remain twenty and their free caps are explicit resolved inputs', () => {
  const rules = { revivalRules: newRevivalRules() };
  for (const faction of ['choam', 'tleilaxu'] as const) {
    const limit = forceRevivalLimit(rules, { id: faction, faction });
    assert.equal(limit, 20);
    const result = recruitsRevivalAllowance(
      active,
      facts({
        currentLimit: limit,
        currentFreeRate: faction === 'choam' ? 0 : 2,
        revived: 8,
        freeAllowanceUsed: 4,
      }),
    );
    assert.equal(result.limit, 20);
    assert.equal(result.remaining, 12);
    assert.equal(result.freeRemaining, 0);
  }
  // This hypothetical is intentionally caller-resolved; no global seven-free
  // rule is invented for a faction whose ordinary total cap does not apply.
  for (const freeRateCap of [7, 8])
    assert.equal(
      recruitsRevivalAllowance(
        active,
        facts({ currentFreeRate: 4, currentLimit: 20, freeRateCap }),
      ).freeRate,
      freeRateCap,
    );
});

void test('resolved cancellation facts affect the faction advantage, while free/normal prevention never grants units', () => {
  const rules = {
    revivalRules: {
      ...newRevivalRules(),
      choamBlocked: true,
      limitBlocked: true,
    },
  };
  for (const faction of ['choam', 'tleilaxu'] as const) {
    const currentLimit = forceRevivalLimit(rules, { id: faction, faction });
    assert.equal(currentLimit, 3);
    const result = recruitsRevivalAllowance(
      active,
      facts({ currentLimit, freeBlocked: true }),
    );
    assert.equal(
      result.limit,
      7,
      'independent ordinary card raise, given these resolved facts',
    );
    assert.equal(result.freeRate, 0);
    assert.equal(result.freeRemaining, 0);
    assert.equal(result.remaining, 7);
  }
  for (const recruits of [undefined, { turn: 4 }]) {
    const result = recruitsRevivalAllowance(
      { turn: 4, recruits },
      facts({ revivalBlocked: true }),
    );
    assert.equal(result.remaining, 0);
    assert.equal(result.freeRemaining, 0);
  }
});

void test('doubling free allowance does not make paid units free or change CHOAM/Tleilaxu prices', () => {
  const ordinary = recruitsRevivalAllowance(active, facts());
  assert.deepEqual(
    forceRevivalPrice('atreides', 7, 0, ordinary.freeRemaining, false),
    { free: 4, normalCost: 6, cost: 6 },
  );
  const tleilaxu = recruitsRevivalAllowance(
    active,
    facts({ currentLimit: 20 }),
  );
  assert.deepEqual(
    forceRevivalPrice('tleilaxu', 10, 0, tleilaxu.freeRemaining, true),
    { free: 4, normalCost: 12, cost: 6 },
  );
  const choam = recruitsRevivalAllowance(
    active,
    facts({ currentFreeRate: 0, currentLimit: 20 }),
  );
  assert.deepEqual(
    forceRevivalPrice('choam', 7, 0, choam.freeRemaining, false),
    { free: 0, normalCost: 14, cost: 7 },
  );
  assert.deepEqual(
    forceRevivalPrice(
      'choam',
      7,
      0,
      choam.freeRemaining,
      false,
      undefined,
      true,
    ),
    { free: 0, normalCost: 14, cost: 14 },
  );
});

void test('Ixian free-cyborg selection retains physical quantities and the existing surcharge', () => {
  const result = recruitsRevivalAllowance(
    active,
    facts({ currentFreeRate: 1 }),
  );
  assert.equal(result.freeRemaining, 2);
  // Four physical units, two Cyborgs. A free Cyborg is one free unit, not two.
  assert.deepEqual(
    forceRevivalPrice('ixians', 4, 2, result.freeRemaining, false, 1),
    { free: 2, normalCost: 5, cost: 5 },
  );
  assert.deepEqual(
    forceRevivalPrice('ixians', 4, 2, result.freeRemaining, false, 2),
    { free: 2, normalCost: 4, cost: 4 },
  );
  assert.equal(
    result.remaining,
    7,
    'pricing has not consumed or doubled physical allowance',
  );
});

void test('Recruits does not bypass per-turn Fedaykin/Sardaukar revival restrictions or invent Ixian stock', () => {
  for (const faction of ['fremen', 'emperor', 'ixians'] as const) {
    const p = {
      faction,
      elites: { tanks: 2, reserves: 0, forces: {}, revived: 1 },
    };
    const before = structuredClone(p);
    const result = recruitsRevivalAllowance(
      active,
      facts({
        currentFreeRate: faction === 'fremen' ? 3 : 1,
        revived: 1,
        freeAllowanceUsed: 1,
      }),
    );
    assert.equal(result.remaining, 6);
    assert.equal(eliteRevivalRemaining(p), faction === 'ixians' ? 2 : 0);
    assert.deepEqual(p, before);
  }
});

void test('calculation is JSON-stable, mutation-free and cannot spend spice, revise pending prices or draw RNG', (t) => {
  const state = {
    ...active,
    spice: 12,
    pendingRevival: { cost: 4, free: 2, amount: 4 },
  };
  const input = facts({ revived: 2, freeAllowanceUsed: 2 });
  const before = JSON.stringify({ state, input });
  const random = t.mock.method(crypto, 'getRandomValues', () => {
    throw new Error('No RNG allowed');
  });
  const a = recruitsRevivalAllowance(state, input);
  const roundTrip = JSON.parse(before);
  assert.deepEqual(
    a,
    recruitsRevivalAllowance(roundTrip.state, roundTrip.input),
  );
  assert.equal(random.mock.callCount(), 0);
  assert.equal(JSON.stringify({ state, input }), before);
});

void test('invalid or missing force-count facts cannot silently choose an unresolved policy or return NaN', () => {
  for (const key of [
    'currentFreeRate',
    'currentLimit',
    'revived',
    'freeAllowanceUsed',
    'freeRateCap',
  ] as const)
    for (const bad of [-1, 1.5, NaN, Infinity, undefined])
      assert.throws(
        () =>
          recruitsRevivalAllowance(active, {
            ...facts(),
            [key]: bad,
          } as RecruitsRevivalFacts),
        RangeError,
      );
});
