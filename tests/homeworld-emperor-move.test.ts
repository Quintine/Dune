import test from 'node:test';
import assert from 'node:assert/strict';
import {
  quoteEmperorHomeworldMove as quote,
  EmperorHomeworldMoveError,
  type EmperorHomeworldMoveContext,
  type EmperorHomeworldMove,
} from '../game/homeworld-emperor-move';
import {
  homeworldForceGroups,
  type HomeworldCustody,
} from '../game/homeworld-custody';

function fixture(): {
  context: EmperorHomeworldMoveContext;
  custody: HomeworldCustody;
} {
  return {
    context: {
      advanced: true,
      status: 'playing',
      phase: 5,
      currentPlayer: 'e',
      movesLeft: 1,
      players: [
        { id: 'e', faction: 'emperor', reserves: 8, eliteReserves: 3 },
        { id: 'a', faction: 'atreides', reserves: 18, eliteReserves: 0 },
      ],
    },
    custody: {
      salusa: { normal: 2, elite: 2 },
      visitors: { 'homeworld:emperor': { a: { normal: 2, elite: 0 } } },
    },
  };
}
const move: EmperorHomeworldMove = {
  origin: 'homeworld:emperor',
  forces: { normal: 2, elite: 1 },
};
function rejected(
  context: EmperorHomeworldMoveContext,
  custody: HomeworldCustody,
  order = move,
  actor = 'e',
) {
  const before = structuredClone({ context, custody, order });
  assert.throws(
    () => quote(context, custody, actor, order),
    EmperorHomeworldMoveError,
  );
  assert.deepEqual({ context, custody, order }, before);
}

void test('a mixed Kaitain-to-Salusa transfer spends exactly one movement and changes neither native totals nor foreign custody', () => {
  const { context, custody } = fixture();
  const before = structuredClone({ context, custody });
  const result = quote(context, custody, 'e', move);
  assert.equal(result.origin, 'homeworld:emperor');
  assert.equal(result.destination, 'homeworld:emperor:salusa');
  assert.equal(result.movementSpent, 1);
  assert.equal(result.movesLeft, 0);
  assert.deepEqual(result.players, context.players);
  assert.deepEqual(result.state.salusa, { normal: 4, elite: 3 });
  assert.deepEqual(result.state.visitors, custody.visitors);
  assert.deepEqual(result.receipts, [
    {
      homeworld: 'homeworld:emperor',
      player: 'e',
      before: { normal: 3, elite: 1 },
      after: { normal: 1, elite: 0 },
    },
    {
      homeworld: 'homeworld:emperor:salusa',
      player: 'e',
      before: { normal: 2, elite: 2 },
      after: { normal: 4, elite: 3 },
    },
  ]);
  assert.deepEqual({ context, custody }, before);
  assert.notEqual(result.forces, move.forces);
  result.state.visitors['homeworld:emperor'].a.normal = 1;
  result.players[0].reserves = 0;
  assert.deepEqual({ context, custody }, before);
});

void test('Salusa-to-Kaitain transfers allow normal and Sardaukar counters together and return exact population changes', () => {
  const { context, custody } = fixture();
  const result = quote(context, custody, 'e', {
    origin: 'homeworld:emperor:salusa',
    forces: { normal: 2, elite: 1 },
  });
  assert.deepEqual(result.state.salusa, { normal: 0, elite: 1 });
  const native = (side: 'before' | 'after') =>
    result.populations[side]
      .filter((p) => p.native === 'e')
      .map((p) => [
        p.card,
        p.population,
        p.side,
        p.nativeBattleStrength,
        p.extraFreeRevival,
      ]);
  assert.deepEqual(native('before'), [
    ['kaitain', 4, 'low', 3, 1],
    ['salusa_secundus', 2, 'high', 3, 0],
  ]);
  assert.deepEqual(native('after'), [
    ['kaitain', 7, 'high', 2, 0],
    ['salusa_secundus', 1, 'low', 2, 0],
  ]);
  assert.deepEqual(
    result.populations.after.filter((p) => p.native !== 'e'),
    result.populations.before.filter((p) => p.native !== 'e'),
  );
  assert.deepEqual(result.players, context.players);
});

void test('normal-only transfers do not raise Salusa Sardaukar population and single-counter groups are legal', () => {
  for (const forces of [
    { normal: 1, elite: 0 },
    { normal: 0, elite: 1 },
  ]) {
    const { context, custody } = fixture();
    const result = quote(context, custody, 'e', {
      origin: 'homeworld:emperor',
      forces,
    });
    const salusa = result.populations.after.find(
      (p) => p.card === 'salusa_secundus',
    )!;
    assert.equal(salusa.population, 2 + forces.elite);
    assert.equal(result.movesLeft, 0);
  }
});

void test('each available whole movement can transfer again after JSON, including an additional Hajr movement', () => {
  const { context, custody } = fixture();
  context.movesLeft = 2;
  const first = quote(context, custody, 'e', move);
  const restored = JSON.parse(JSON.stringify(first));
  const nextContext = {
    ...context,
    players: restored.players,
    movesLeft: restored.movesLeft,
  };
  const second = quote(nextContext, restored.state, 'e', {
    origin: first.destination,
    forces: first.forces,
  });
  assert.equal(first.movesLeft, 1);
  assert.equal(second.movesLeft, 0);
  assert.deepEqual(second.state, custody);
  assert.deepEqual(second.players, context.players);
  rejected({ ...context, players: second.players, movesLeft: 0 }, second.state);
});

void test('rejects unavailable movement, wrong actor, wrong phase and Basic or nonplaying source', () => {
  for (const change of [
    { advanced: false },
    { phase: 1 },
    { phase: 4 },
    { phase: 6 },
    { status: 'lobby' },
    { status: 'setup' },
    { status: 'finished' },
    { currentPlayer: null },
    { currentPlayer: 'a' },
    ...[0, -1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '1'].map(
      (movesLeft) => ({ movesLeft }),
    ),
  ]) {
    const { context, custody } = fixture();
    rejected({ ...context, ...change } as EmperorHomeworldMoveContext, custody);
  }
  for (const actor of ['a', 'absent', '']) {
    const { context, custody } = fixture();
    context.currentPlayer = actor;
    rejected(context, custody, move, actor);
  }
});

void test('rejects malformed order and unavailable typed source counters without substituting or borrowing visitor units', () => {
  const orders: unknown[] = [
    null,
    {},
    { origin: 'homeworld:atreides', forces: { normal: 1, elite: 0 } },
    { origin: 'arrakeen', forces: { normal: 1, elite: 0 } },
    { ...move, destination: 'homeworld:atreides' },
    ...[
      { normal: 0, elite: 0 },
      { normal: -1, elite: 1 },
      { normal: 0.5, elite: 0 },
      { normal: NaN, elite: 0 },
      { normal: Infinity, elite: 0 },
      { normal: Number.MAX_SAFE_INTEGER, elite: 1 },
      { normal: 21, elite: 0 },
      { normal: 1 },
      { normal: 1, elite: 0, advisors: true },
      { normal: '1', elite: 0 },
      { normal: 4, elite: 0 },
      { normal: 0, elite: 2 },
    ].map((forces) => ({ origin: 'homeworld:emperor', forces })),
  ];
  for (const order of orders) {
    const { context, custody } = fixture();
    rejected(context, custody, order as EmperorHomeworldMove);
  }
});

void test('complete shared custody validation rejects corrupt source rosters and Salusa allocations before a quote is issued', () => {
  for (const mutate of [
    (c: EmperorHomeworldMoveContext, s: HomeworldCustody) => {
      s.salusa = null;
    },
    (c: EmperorHomeworldMoveContext, s: HomeworldCustody) => {
      s.salusa!.elite = 4;
    },
    (c: EmperorHomeworldMoveContext, s: HomeworldCustody) => {
      s.salusa!.normal = 6;
    },
    (c: EmperorHomeworldMoveContext, s: HomeworldCustody) => {
      s.visitors['homeworld:emperor'].e = { normal: 1, elite: 0 };
    },
    (c: EmperorHomeworldMoveContext, s: HomeworldCustody) => {
      s.visitors['homeworld:emperor'].a.normal = 3;
    },
    (c: EmperorHomeworldMoveContext) => {
      c.players = [...c.players, { ...c.players[0] }];
    },
    (c: EmperorHomeworldMoveContext) => {
      c.players = c.players.map((p) =>
        p.id === 'e' ? { ...p, eliteReserves: 6 } : p,
      );
    },
  ]) {
    const { context, custody } = fixture();
    mutate(context, custody);
    rejected(context, custody);
  }
});

void test('movement ignores ordinary Emperor cancellation and reads no private state, turn RNG or unrelated action counters', () => {
  const { context, custody } = fixture();
  const expected = quote(context, custody, 'e', move);
  Object.defineProperty(context, 'emperorCanceled', {
    value: true,
    enumerable: true,
  });
  assert.deepEqual(quote(context, custody, 'e', move), expected);
  for (const key of [
    'hands',
    'deck',
    'rng',
    'spice',
    'shipped',
    'hajr',
    'response',
    'prediction',
  ])
    Object.defineProperty(context, key, {
      enumerable: true,
      get() {
        throw new Error('unrelated/private context read');
      },
    });
  for (const p of context.players)
    for (const key of ['hand', 'spice', 'leaders', 'prediction'])
      Object.defineProperty(p, key, {
        enumerable: true,
        get() {
          throw new Error('private seat read');
        },
      });
  const random = Math.random;
  Math.random = () => {
    throw new Error('randomness read');
  };
  try {
    assert.deepEqual(quote(context, custody, 'e', move), expected);
    assert.deepEqual(quote(context, custody, 'e', move), expected);
    assert.deepEqual(homeworldForceGroups(context, custody)[0].forces.e, {
      normal: 3,
      elite: 1,
    });
  } finally {
    Math.random = random;
  }
});
