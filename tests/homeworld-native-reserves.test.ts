import test from 'node:test';
import assert from 'node:assert/strict';
import {
  quoteNativeReserveWithdrawal as withdraw,
  quoteNativeRevivalDeposit as revive,
  NativeReserveError,
  type NativeReserveSelections,
} from '../game/homeworld-native-reserves';
import {
  createHomeworldCustody,
  homeworldForceGroups,
  type HomeworldCustodyContext,
  type HomeworldCustody,
  type HomeworldForces,
} from '../game/homeworld-custody';

const kaitain = 'homeworld:emperor';
const salusa = 'homeworld:emperor:salusa';
const units = (normal = 0, elite = 0): HomeworldForces => ({ normal, elite });
function fixture(): {
  context: HomeworldCustodyContext;
  state: HomeworldCustody;
} {
  return {
    context: {
      advanced: true,
      players: [
        { id: 'e', faction: 'emperor', reserves: 10, eliteReserves: 3 },
        { id: 'i', faction: 'ixians', reserves: 10, eliteReserves: 2 },
      ],
    },
    state: {
      salusa: units(3, 2),
      visitors: {
        [kaitain]: { i: units(2) },
        'homeworld:ixians': { e: units(1, 1) },
      },
    },
  };
}
function pools(context: HomeworldCustodyContext, state: HomeworldCustody) {
  return homeworldForceGroups(context, state)
    .filter((h) => h.native === 'e')
    .map((h) => h.forces.e);
}
function reject(requested: HomeworldForces, sources?: NativeReserveSelections) {
  const { context, state } = fixture();
  const before = structuredClone({ context, state, requested, sources });
  assert.throws(
    () => withdraw(context, state, 'e', requested, sources),
    NativeReserveError,
  );
  assert.deepEqual({ context, state, requested, sources }, before);
}

void test('explicit mixed-world sources exactly withdraw both types without borrowing visitor forces', () => {
  const { context, state } = fixture();
  const sources = { [kaitain]: units(2, 1), [salusa]: units(1, 1) };
  const before = structuredClone({ context, state, sources });
  const result = withdraw(context, state, 'e', units(3, 2), sources);
  assert.deepEqual(result.players[0], {
    id: 'e',
    faction: 'emperor',
    reserves: 5,
    eliteReserves: 1,
  });
  assert.deepEqual(result.players[1], context.players[1]);
  assert.deepEqual(result.state.salusa, units(2, 1));
  assert.deepEqual(result.state.visitors, state.visitors);
  assert.deepEqual(result.receipts, [
    { homeworld: kaitain, player: 'e', before: units(4, 1), after: units(2) },
    { homeworld: salusa, player: 'e', before: units(3, 2), after: units(2, 1) },
  ]);
  assert.deepEqual(
    pools({ advanced: true, players: result.players }, result.state),
    [units(2), units(2, 1)],
  );
  assert.deepEqual({ context, state, sources }, before);
  result.state.visitors[kaitain].i.normal = 1;
  result.receipts[0].before.normal = 99;
  assert.deepEqual({ context, state, sources }, before);
});

void test('full withdrawal across both worlds is unique for each type and does not need a source choice', () => {
  const { context, state } = fixture();
  const result = withdraw(context, state, 'e', units(7, 3));
  assert.equal(result.players[0].reserves, 0);
  assert.equal(result.players[0].eliteReserves, 0);
  assert.deepEqual(result.state.salusa, units());
  assert.deepEqual(result.state.visitors, state.visitors);
  assert.deepEqual(
    result.receipts.map((r) => r.before),
    [units(4, 1), units(3, 2)],
  );
  assert.ok(
    result.receipts.every((r) => r.after.normal === 0 && r.after.elite === 0),
  );
});

void test('partial withdrawals require an explicit choice only for types with multiple feasible allocations', () => {
  const { context, state } = fixture();
  for (const requested of [units(1), units(0, 1), units(7, 1), units(1, 3)]) {
    assert.throws(
      () => withdraw(context, state, 'e', requested),
      /Choose the Homeworld sources/,
    );
  }
  const initial = createHomeworldCustody(context);
  const unique = withdraw(context, initial, 'e', units(2, 1));
  assert.deepEqual(
    unique.receipts.map((r) => [r.homeworld, r.after]),
    [
      [kaitain, units(5)],
      [salusa, units(0, 2)],
    ],
  );
  const chosen = withdraw(context, state, 'e', units(1), {
    [salusa]: units(1),
  });
  assert.deepEqual(chosen.state.salusa, units(2, 2));
  assert.equal(chosen.receipts.length, 1);
});

void test('exact source maps reject mismatched sums, foreign locations, unavailable type counts and malformed force records', () => {
  for (const sources of [
    {},
    { [kaitain]: units(1) },
    { [kaitain]: units(3) },
    { 'homeworld:ixians': units(2) },
    { unknown: units(2) },
    { [kaitain]: units(2), [salusa]: units(1) },
    { [kaitain]: units(2, 0), [salusa]: { normal: 0 } },
    { [kaitain]: { normal: 2, elite: 0, amount: 2 } },
  ])
    reject(units(2), sources as NativeReserveSelections);
  reject(units(5), { [kaitain]: units(5) });
  reject(units(0, 2), { [kaitain]: units(0, 2) });
  for (const sources of [null, [], 'kaitain'])
    reject(units(2), sources as unknown as NativeReserveSelections);
  for (const requested of [
    units(8),
    units(0, 4),
    units(-1),
    units(1.5),
    units(NaN),
    units(Infinity),
    units(Number.MAX_SAFE_INTEGER, 1),
    { normal: 1 },
    { normal: 1, elite: 0, amount: 1 },
  ])
    reject(requested as HomeworldForces);
  const inherited = Object.assign(Object.create({ normal: 2 }), {
    elite: 0,
    decoy: 2,
  });
  assert.throws(
    () =>
      withdraw(fixture().context, fixture().state, 'e', units(2), {
        [kaitain]: inherited,
      }),
    NativeReserveError,
  );
});

void test('revival deterministically restores Emperor normal forces to Kaitain and Sardaukar to Salusa even after mixed transfers', () => {
  const { context, state } = fixture();
  const before = structuredClone({ context, state });
  const result = revive(context, state, 'e', units(2, 1));
  assert.deepEqual(result.players[0], {
    id: 'e',
    faction: 'emperor',
    reserves: 13,
    eliteReserves: 4,
  });
  assert.deepEqual(result.state.salusa, units(3, 3));
  assert.deepEqual(result.receipts, [
    {
      homeworld: kaitain,
      player: 'e',
      before: units(4, 1),
      after: units(6, 1),
    },
    { homeworld: salusa, player: 'e', before: units(3, 2), after: units(3, 3) },
  ]);
  assert.deepEqual({ context, state }, before);
});

void test('Basic Emperor and other factions use one native world while all seven Ixian special counters remain legal', () => {
  const basic: HomeworldCustodyContext = {
    advanced: false,
    players: [
      { id: 'e', faction: 'emperor', reserves: 2, eliteReserves: 1 },
      { id: 'i', faction: 'ixians', reserves: 3, eliteReserves: 2 },
    ],
  };
  const initial = createHomeworldCustody(basic);
  const emperor = revive(basic, initial, 'e', units(1, 1));
  assert.equal(emperor.state.salusa, null);
  assert.deepEqual(emperor.receipts, [
    {
      homeworld: kaitain,
      player: 'e',
      before: units(1, 1),
      after: units(2, 2),
    },
  ]);
  const ixians = revive(basic, initial, 'i', units(0, 5));
  assert.equal(ixians.players[1].eliteReserves, 7);
  assert.deepEqual(ixians.receipts[0].after, units(1, 7));
  const removed = withdraw(
    { advanced: false, players: ixians.players },
    ixians.state,
    'i',
    units(0, 7),
  );
  assert.equal(removed.players[1].reserves, 1);
  assert.equal(removed.players[1].eliteReserves, 0);
  assert.throws(
    () =>
      revive(
        { advanced: false, players: ixians.players },
        ixians.state,
        'i',
        units(0, 1),
      ),
    NativeReserveError,
  );
});

void test('shared validation rejects excess physical totals including foreign deployments and never treats invaders as native reserves', () => {
  const { context, state } = fixture();
  const before = structuredClone({ context, state });
  assert.throws(
    () => revive(context, state, 'e', units(9)),
    NativeReserveError,
  );
  assert.throws(
    () => revive(context, state, 'e', units(0, 2)),
    NativeReserveError,
  );
  for (const actor of ['', 'absent']) {
    assert.throws(
      () => withdraw(context, state, actor, units()),
      NativeReserveError,
    );
    assert.throws(
      () => revive(context, state, actor, units()),
      NativeReserveError,
    );
  }
  assert.deepEqual({ context, state }, before);
  const changed = structuredClone(state);
  changed.salusa!.elite = 4;
  assert.throws(
    () => withdraw(context, changed, 'e', units()),
    NativeReserveError,
  );
  assert.throws(
    () => revive(context, changed, 'e', units()),
    NativeReserveError,
  );
});

void test('zero amounts are detached no-op quotes and explicit zero sources still require a native location', () => {
  const { context, state } = fixture();
  for (const result of [
    withdraw(context, state, 'e', units()),
    withdraw(context, state, 'e', units(), {}),
    revive(context, state, 'e', units()),
  ]) {
    assert.deepEqual(result.players, context.players);
    assert.deepEqual(result.state, state);
    assert.deepEqual(result.receipts, []);
    assert.notEqual(result.state, state);
    assert.notEqual(result.players[0], context.players[0]);
  }
  reject(units(), { 'homeworld:ixians': units() });
});

void test('JSON source choices remain deterministic and quotes do not inspect hands, spice, Tanks, counters or RNG', () => {
  const { context, state } = fixture();
  const sources = { [kaitain]: units(2, 1), [salusa]: units(1, 1) };
  const expected = withdraw(context, state, 'e', units(3, 2), sources);
  assert.deepEqual(
    withdraw(
      JSON.parse(JSON.stringify(context)),
      JSON.parse(JSON.stringify(state)),
      'e',
      units(3, 2),
      JSON.parse(JSON.stringify(sources)),
    ),
    expected,
  );
  const deposited = revive(context, state, 'e', units(1));
  const forbidden = {
    enumerable: true,
    get() {
      throw new Error('private field read');
    },
  };
  for (const key of ['deck', 'rng', 'spice', 'phase', 'pendingShipment'])
    Object.defineProperty(context, key, forbidden);
  for (const seat of context.players)
    for (const key of ['hand', 'spice', 'tanks', 'revived', 'prediction'])
      Object.defineProperty(seat, key, forbidden);
  const original = Math.random;
  Math.random = () => {
    throw new Error('RNG read');
  };
  try {
    assert.deepEqual(
      withdraw(context, state, 'e', units(3, 2), sources),
      expected,
    );
    assert.deepEqual(revive(context, state, 'e', units(1)), deposited);
  } finally {
    Math.random = original;
  }
});
