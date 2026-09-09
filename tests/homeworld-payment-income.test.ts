import test from 'node:test';
import assert from 'node:assert/strict';
import { newPlayer } from '../game/engine';
import {
  createHomeworldCustody,
  HomeworldCustodyError,
} from '../game/homeworld-custody';
import { homeworldContext } from '../game/homeworld-game';
import {
  quoteGuildPaymentRounding,
  quoteHomeworldPaymentIncome,
} from '../game/homeworld-payment-income';

function fixture(
  faction: 'guild' | 'emperor',
  reserves: number,
  advanced = true,
) {
  const players = [
    newPlayer('native', 'Native', faction),
    newPlayer('visitor', 'Visitor', 'harkonnen'),
  ];
  players[0].reserves = reserves;
  if (players[0].elites) players[0].elites.reserves = 0;
  const context = { advanced, players };
  return {
    ...context,
    homeworlds: { custody: createHomeworldCustody(homeworldContext(context)) },
  };
}

void test('Junction and Kaitain halve one eligible payment below five native forces in either mode', () => {
  for (const advanced of [false, true])
    for (const [faction, kind] of [
      ['guild', 'shipment'],
      ['emperor', 'treachery'],
    ] as const)
      for (const reserves of [0, 4, 5, 20]) {
        const context = fixture(faction, reserves, advanced);
        assert.deepEqual(
          quoteHomeworldPaymentIncome(context, 'native', kind, 5),
          {
            gross: 5,
            income: reserves < 5 ? 3 : 5,
            bank: reserves < 5 ? 2 : 0,
            low: reserves < 5,
          },
        );
      }
});

void test('odd, even, zero and maximal safe single payment conserve spice', () => {
  const context = fixture('guild', 4);
  for (const [gross, income] of [
    [0, 0],
    [1, 1],
    [2, 1],
    [3, 2],
    [5, 3],
    [6, 3],
    [Number.MAX_SAFE_INTEGER, 4_503_599_627_370_496],
  ]) {
    const quote = quoteHomeworldPaymentIncome(
      context,
      'native',
      'shipment',
      gross,
    );
    assert.equal(quote.income, income);
    assert.equal(quote.bank + quote.income, gross);
    assert.equal(quote.low, true);
  }
});

void test('Guild rounding comparisons agree for single payer, even-even and mixed parity contributions', () => {
  for (const [gross, contributions, income] of [
    [0, [], 0],
    [0, [0, 0], 0],
    [1, [1], 1],
    [5, [5], 3],
    [5, [0, 5], 3],
    [6, [2, 4], 3],
    [5, [2, 3], 3],
    [Number.MAX_SAFE_INTEGER, [Number.MAX_SAFE_INTEGER], 4_503_599_627_370_496],
  ] as [number, number[], number][]) {
    const before = JSON.stringify(contributions);
    Object.freeze(contributions);
    assert.deepEqual(quoteGuildPaymentRounding(gross, contributions), {
      transaction: income,
      contribution: income,
      unambiguous: true,
    });
    assert.equal(JSON.stringify(contributions), before);
  }
});

void test('Guild rounding exposes odd-odd disagreement without selecting either interpretation', () => {
  assert.deepEqual(quoteGuildPaymentRounding(2, [1, 1]), {
    transaction: 1,
    contribution: 2,
    unambiguous: false,
  });
  const restored = JSON.parse('[3,3]') as number[];
  assert.deepEqual(quoteGuildPaymentRounding(6, restored), {
    transaction: 3,
    contribution: 4,
    unambiguous: false,
  });
  assert.deepEqual(restored, [3, 3]);
});

void test('Guild rounding rejects malformed amounts, overflow, sparse arrays and mismatched payment totals', () => {
  const invalid: [unknown, unknown][] = [
    [-1, []],
    [NaN, []],
    [Infinity, []],
    [0.5, [0.5]],
    [Number.MAX_SAFE_INTEGER + 1, [Number.MAX_SAFE_INTEGER, 1]],
    [0, undefined],
    [0, null],
    [0, {}],
    [1, '1'],
    [0, [0, 0, 0]],
    [0, [-1, 1]],
    [0, [NaN]],
    [1, [Infinity]],
    [1, [0.5, 0.5]],
    [1, ['1']],
    [0, Array(1)],
    [1, []],
    [3, [1, 1]],
    [Number.MAX_SAFE_INTEGER, [Number.MAX_SAFE_INTEGER, 1]],
  ];
  for (const [gross, contributions] of invalid) {
    const before = JSON.stringify(contributions);
    assert.throws(
      () =>
        quoteGuildPaymentRounding(gross as number, contributions as number[]),
      HomeworldCustodyError,
    );
    assert.equal(JSON.stringify(contributions), before);
  }
});

void test('typed Kaitain natives count while Salusa allocation and visiting armies do not', () => {
  const context = fixture('emperor', 10);
  context.players[0].elites = { reserves: 5, tanks: 0, forces: {}, revived: 0 };
  context.homeworlds.custody.salusa = { normal: 1, elite: 5 };
  context.players[1].reserves = 0;
  context.homeworlds.custody.visitors['homeworld:emperor'] = {
    visitor: { normal: 20, elite: 0 },
  };
  assert.equal(
    quoteHomeworldPaymentIncome(context, 'native', 'treachery', 5).income,
    3,
  );
  context.homeworlds.custody.salusa.elite--;
  assert.equal(
    quoteHomeworldPaymentIncome(context, 'native', 'treachery', 5).income,
    5,
  );
  context.homeworlds.custody.salusa.normal++;
  assert.equal(
    quoteHomeworldPaymentIncome(context, 'native', 'treachery', 5).income,
    3,
  );
});

void test('Junction visitors do not raise physical native population or earn a new payment', () => {
  const context = fixture('guild', 4);
  context.players[1].reserves = 0;
  context.homeworlds.custody.visitors['homeworld:guild'] = {
    visitor: { normal: 20, elite: 0 },
  };
  assert.deepEqual(
    quoteHomeworldPaymentIncome(context, 'native', 'shipment', 5),
    {
      gross: 5,
      income: 3,
      bank: 2,
      low: true,
    },
  );
  assert.throws(
    () => quoteHomeworldPaymentIncome(context, 'visitor', 'shipment', 5),
    /Only the Guild/,
  );
});

void test('absent and uninitialized module preserve native income and current population is rechecked', () => {
  for (const homeworlds of [undefined, null, { custody: null }]) {
    const context = { ...fixture('emperor', 0), homeworlds };
    assert.deepEqual(
      quoteHomeworldPaymentIncome(context, 'native', 'treachery', 5),
      {
        gross: 5,
        income: 5,
        bank: 0,
        low: false,
      },
    );
  }
  const context = fixture('guild', 4);
  assert.equal(
    quoteHomeworldPaymentIncome(context, 'native', 'shipment', 5).low,
    true,
  );
  context.players[0].reserves++;
  assert.equal(
    quoteHomeworldPaymentIncome(context, 'native', 'shipment', 5).low,
    false,
  );
  context.players[0].reserves--;
  assert.equal(
    quoteHomeworldPaymentIncome(context, 'native', 'shipment', 5).low,
    true,
  );
});

void test('invalid payment, owner, kind and physical custody reject without mutation', () => {
  const context = fixture('emperor', 4);
  for (const gross of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    const before = JSON.stringify(context);
    assert.throws(
      () => quoteHomeworldPaymentIncome(context, 'native', 'treachery', gross),
      HomeworldCustodyError,
    );
    assert.equal(JSON.stringify(context), before);
  }
  for (const [owner, kind] of [
    ['native', 'shipment'],
    ['visitor', 'treachery'],
    ['absent', 'treachery'],
    ['native', 'unknown'],
  ] as const) {
    const before = JSON.stringify(context);
    assert.throws(
      () => quoteHomeworldPaymentIncome(context, owner, kind as 'treachery', 5),
      HomeworldCustodyError,
    );
    assert.equal(JSON.stringify(context), before);
  }
  context.homeworlds.custody.salusa = { normal: 0, elite: 1 };
  const before = JSON.stringify(context);
  assert.throws(
    () => quoteHomeworldPaymentIncome(context, 'native', 'treachery', 5),
    HomeworldCustodyError,
  );
  assert.equal(JSON.stringify(context), before);
});

void test('payment quotes survive JSON, frozen inputs and throwing private getters on every player', () => {
  const context = fixture('emperor', 4);
  const restored = JSON.parse(JSON.stringify(context)) as typeof context;
  const expected = quoteHomeworldPaymentIncome(
    restored,
    'native',
    'treachery',
    5,
  );
  for (const player of context.players) {
    for (const field of [
      'hand',
      'spice',
      'traitors',
      'prediction',
      'knownTraitors',
      'faceDancers',
    ])
      Object.defineProperty(player, field, {
        get() {
          throw new Error(`private ${field}`);
        },
      });
    Object.freeze(player.elites);
    Object.freeze(player);
  }
  Object.freeze(context.players);
  Object.freeze(context.homeworlds.custody.salusa);
  Object.freeze(context.homeworlds.custody.visitors);
  Object.freeze(context.homeworlds.custody);
  Object.freeze(context.homeworlds);
  Object.freeze(context);
  assert.deepEqual(
    quoteHomeworldPaymentIncome(context, 'native', 'treachery', 5),
    expected,
  );
});
