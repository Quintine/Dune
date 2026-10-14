import test from 'node:test';
import assert from 'node:assert/strict';
import { HomeworldCustodyError } from '../game/homeworld-custody';
import { quoteHomeworldBankPayment } from '../game/homeworld-payment-income';

void test('whole-invoice low Bank halves attribute odd-odd rounding to the declared primary payer', () => {
  assert.deepEqual(
    quoteHomeworldBankPayment(
      [{ payer: 'primary', amount: 5 }, { payer: 'ally', amount: 3 }],
      4,
    ),
    [{ payer: 'primary', amount: 3 }, { payer: 'ally', amount: 1 }],
  );
  assert.deepEqual(
    quoteHomeworldBankPayment(
      [{ payer: 'primary', amount: 7 }, { payer: 'ally', amount: 1 }],
      4,
    ),
    [{ payer: 'primary', amount: 4 }],
  );
  assert.deepEqual(
    quoteHomeworldBankPayment(
      [{ payer: 'ally', amount: 3 }, { payer: 'primary', amount: 5 }],
      4,
    ),
    [{ payer: 'ally', amount: 2 }, { payer: 'primary', amount: 2 }],
  );
});

void test('native Bank zero and canceled full income preserve the actual original payer legs', () => {
  const contributions = [
    { payer: 'primary', amount: 5 },
    { payer: 'ally', amount: 3 },
  ];
  assert.deepEqual(quoteHomeworldBankPayment(contributions, 0), []);
  assert.deepEqual(quoteHomeworldBankPayment(contributions, 8), contributions);
  assert.deepEqual(quoteHomeworldBankPayment([], 0), []);
  assert.deepEqual(
    quoteHomeworldBankPayment([{ payer: 'primary', amount: 1 }], 0),
    [],
  );
  assert.deepEqual(
    quoteHomeworldBankPayment([{ payer: 'primary', amount: 1 }], 1),
    [{ payer: 'primary', amount: 1 }],
  );
});

void test('occupied cancellation uses the frozen ceil Bank remainder rather than the ordinary low floor', () => {
  const contributions = [
    { payer: 'primary', amount: 5 },
    { payer: 'ally', amount: 4 },
  ];
  assert.deepEqual(
    quoteHomeworldBankPayment(contributions, 4),
    [{ payer: 'primary', amount: 2 }, { payer: 'ally', amount: 2 }],
  );
  assert.deepEqual(
    quoteHomeworldBankPayment(contributions, 5),
    [{ payer: 'primary', amount: 3 }, { payer: 'ally', amount: 2 }],
  );
  assert.deepEqual(quoteHomeworldBankPayment(contributions, 0), []);
});

void test('Bureaucrat combines its diversion with the same payer final Bank half, never another payer', () => {
  const bankLegs = quoteHomeworldBankPayment(
    [{ payer: 'primary', amount: 5 }, { payer: 'ally', amount: 3 }],
    3,
    { payer: 'primary', amount: 2 },
  );
  assert.deepEqual(bankLegs, [
    { payer: 'primary', amount: 4 },
    { payer: 'ally', amount: 1 },
  ]);
  assert.deepEqual(
    bankLegs.filter((leg) => leg.amount >= 4).map((leg) => leg.payer),
    ['primary'],
  );
});

void test('two qualifying Bureaucrat contributions use the selected first eligible payer in original order', () => {
  const firstFive = quoteHomeworldBankPayment(
    [{ payer: 'primary', amount: 5 }, { payer: 'ally', amount: 6 }],
    4,
    { payer: 'primary', amount: 2 },
  );
  assert.deepEqual(firstFive, [
    { payer: 'primary', amount: 3 },
    { payer: 'ally', amount: 3 },
  ]);
  assert.deepEqual(firstFive.filter((leg) => leg.amount >= 4), []);
  const firstSix = quoteHomeworldBankPayment(
    [{ payer: 'primary', amount: 6 }, { payer: 'ally', amount: 5 }],
    4,
    { payer: 'primary', amount: 2 },
  );
  assert.deepEqual(firstSix, [
    { payer: 'primary', amount: 4 },
    { payer: 'ally', amount: 2 },
  ]);
  assert.deepEqual(
    firstSix.filter((leg) => leg.amount >= 4).map((leg) => leg.payer),
    ['primary'],
  );
});

void test('Bureaucrat can select the ally when the declared primary contribution is below five', () => {
  assert.deepEqual(
    quoteHomeworldBankPayment(
      [{ payer: 'primary', amount: 4 }, { payer: 'ally', amount: 5 }],
      3,
      { payer: 'ally', amount: 2 },
    ),
    [{ payer: 'primary', amount: 2 }, { payer: 'ally', amount: 3 }],
  );
});

void test('diversion is excluded before zero, full, floor and occupied ceil Bank allocation', () => {
  const contributions = [
    { payer: 'primary', amount: 5 },
    { payer: 'ally', amount: 4 },
  ];
  const diversion = { payer: 'primary', amount: 2 } as const;
  assert.deepEqual(
    quoteHomeworldBankPayment(contributions, 0, diversion),
    [{ payer: 'primary', amount: 2 }],
  );
  assert.deepEqual(
    quoteHomeworldBankPayment(contributions, 7, diversion),
    [{ payer: 'primary', amount: 5 }, { payer: 'ally', amount: 4 }],
  );
  assert.deepEqual(
    quoteHomeworldBankPayment(contributions, 3, diversion),
    [{ payer: 'primary', amount: 3 }, { payer: 'ally', amount: 2 }],
  );
  assert.deepEqual(
    quoteHomeworldBankPayment(contributions, 4, diversion),
    [{ payer: 'primary', amount: 4 }, { payer: 'ally', amount: 2 }],
  );
});

void test('distinct payer and distinct invoice Bank payments are not pooled into a Banker threshold', () => {
  const funded = quoteHomeworldBankPayment(
    [{ payer: 'primary', amount: 5 }, { payer: 'ally', amount: 3 }],
    4,
  );
  assert.deepEqual(funded, [
    { payer: 'primary', amount: 3 },
    { payer: 'ally', amount: 1 },
  ]);
  assert.deepEqual(funded.filter((leg) => leg.amount >= 4), []);
  for (let invoice = 0; invoice < 2; invoice++) {
    const bankLegs = quoteHomeworldBankPayment(
      [{ payer: 'primary', amount: 5 }],
      2,
    );
    assert.deepEqual(bankLegs, [{ payer: 'primary', amount: 2 }]);
    assert.deepEqual(bankLegs.filter((leg) => leg.amount >= 4), []);
  }
});

void test('all valid final Bank modes conserve each original contribution across odd and even funded payments', () => {
  for (let primary = 1; primary <= 11; primary++)
    for (let ally = 1; ally <= 11; ally++) {
      const contributions = [
        { payer: 'primary', amount: primary },
        { payer: 'ally', amount: ally },
      ];
      const diversions = [
        undefined,
        ...(primary >= 5 ? [{ payer: 'primary', amount: 2 } as const] : []),
        ...(ally >= 5 ? [{ payer: 'ally', amount: 2 } as const] : []),
      ];
      for (const diversion of diversions) {
        const remaining = primary + ally - (diversion ? 2 : 0);
        for (const bank of [0, remaining, Math.floor(remaining / 2), Math.ceil(remaining / 2)]) {
          const legs = quoteHomeworldBankPayment(contributions, bank, diversion);
          assert.equal(
            legs.reduce((sum, leg) => sum + leg.amount, 0),
            bank + (diversion ? 2 : 0),
          );
          for (const leg of legs) {
            const original = contributions.find((paid) => paid.payer === leg.payer)!;
            assert.ok(Number.isSafeInteger(leg.amount) && leg.amount > 0);
            assert.ok(leg.amount <= original.amount);
            assert.equal(legs.filter((paid) => paid.payer === leg.payer).length, 1);
          }
        }
      }
    }
});

void test('Bank attribution preserves exact maximal safe payments and their half rounding', () => {
  const contributions = [{ payer: 'primary', amount: Number.MAX_SAFE_INTEGER }];
  assert.deepEqual(
    quoteHomeworldBankPayment(contributions, 4_503_599_627_370_495),
    [{ payer: 'primary', amount: 4_503_599_627_370_495 }],
  );
  assert.deepEqual(
    quoteHomeworldBankPayment(contributions, 4_503_599_627_370_496),
    [{ payer: 'primary', amount: 4_503_599_627_370_496 }],
  );
  assert.deepEqual(
    quoteHomeworldBankPayment(contributions, 4_503_599_627_370_494, { payer: 'primary', amount: 2 }),
    [{ payer: 'primary', amount: 4_503_599_627_370_496 }],
  );
  assert.deepEqual(
    quoteHomeworldBankPayment(contributions, Number.MAX_SAFE_INTEGER),
    contributions,
  );
});

void test('Bank allocation survives JSON and frozen inputs without changing original payments or diversion', () => {
  const contributions = Object.freeze([
    Object.freeze({ payer: 'primary', amount: 5 }),
    Object.freeze({ payer: 'ally', amount: 3 }),
  ]);
  const diversion = Object.freeze({ payer: 'primary', amount: 2 } as const);
  const before = JSON.stringify({ contributions, diversion });
  const legs = quoteHomeworldBankPayment(contributions, 3, diversion);
  assert.deepEqual(legs, [
    { payer: 'primary', amount: 4 },
    { payer: 'ally', amount: 1 },
  ]);
  assert.deepEqual(
    quoteHomeworldBankPayment(JSON.parse(JSON.stringify(contributions)), 3, JSON.parse(JSON.stringify(diversion))),
    legs,
  );
  legs[0].amount = 1;
  assert.equal(JSON.stringify({ contributions, diversion }), before);
});

void test('invalid original payer attribution, contribution amounts and frozen Bank modes throw typed errors without mutation', () => {
  const valid = [{ payer: 'primary', amount: 5 }, { payer: 'ally', amount: 3 }];
  const invalid: [unknown, unknown][] = [
    [undefined, 0],
    [null, 0],
    [{}, 0],
    ['primary', 0],
    [Array(1), 0],
    [[null], 0],
    [[{}], 0],
    [[{ payer: '', amount: 5 }], 2],
    [[{ payer: ' ', amount: 5 }], 2],
    [[{ payer: 1, amount: 5 }], 2],
    [[{ payer: 'primary', amount: 0 }], 0],
    [[{ payer: 'primary', amount: -1 }], 0],
    [[{ payer: 'primary', amount: NaN }], 0],
    [[{ payer: 'primary', amount: Infinity }], 0],
    [[{ payer: 'primary', amount: 1.5 }], 0],
    [[{ payer: 'primary', amount: '5' }], 2],
    [[{ payer: 'primary', amount: Number.MAX_SAFE_INTEGER + 1 }], 0],
    [[{ payer: 'primary', amount: Number.MAX_SAFE_INTEGER }, { payer: 'ally', amount: 1 }], 0],
    [[{ payer: 'primary', amount: 5 }, { payer: 'primary', amount: 3 }], 4],
    [valid, -1],
    [valid, 1.5],
    [valid, NaN],
    [valid, Infinity],
    [valid, '4'],
    [valid, Number.MAX_SAFE_INTEGER + 1],
    [valid, 3],
    [valid, 9],
    [[], 1],
  ];
  for (const [contributions, bank] of invalid) {
    const before = JSON.stringify(contributions);
    assert.throws(
      () => quoteHomeworldBankPayment(
        contributions as Parameters<typeof quoteHomeworldBankPayment>[0],
        bank as number,
      ),
      HomeworldCustodyError,
    );
    assert.equal(JSON.stringify(contributions), before);
  }
});

void test('invalid Bureaucrat selection or diversion amount rejects without changing the invoice', () => {
  const contributions = Object.freeze([
    Object.freeze({ payer: 'primary', amount: 4 }),
    Object.freeze({ payer: 'ally', amount: 5 }),
  ]);
  const invalid: unknown[] = [
    null,
    {},
    { payer: 'absent', amount: 2 },
    { payer: 'primary', amount: 2 },
    { payer: 'ally', amount: 0 },
    { payer: 'ally', amount: 1 },
    { payer: 'ally', amount: 3 },
    { payer: 'ally', amount: 2.5 },
    { payer: 'ally', amount: '2' },
    { payer: 1, amount: 2 },
  ];
  for (const diversion of invalid) {
    const before = JSON.stringify({ contributions, diversion });
    assert.throws(
      () => quoteHomeworldBankPayment(
        contributions,
        3,
        diversion as Parameters<typeof quoteHomeworldBankPayment>[2],
      ),
      HomeworldCustodyError,
    );
    assert.equal(JSON.stringify({ contributions, diversion }), before);
  }
  assert.throws(
    () => quoteHomeworldBankPayment(contributions, 5, { payer: 'ally', amount: 2 }),
    HomeworldCustodyError,
  );
  assert.throws(
    () => quoteHomeworldBankPayment([], 0, { payer: 'ally', amount: 2 }),
    HomeworldCustodyError,
  );
});
