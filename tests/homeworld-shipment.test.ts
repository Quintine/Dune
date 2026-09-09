import test from 'node:test';
import assert from 'node:assert/strict';
import {
  quoteHomeworldShipment as quote,
  type HomeworldShipmentContext,
  type HomeworldShipmentIntent,
} from '../game/homeworld-shipment';
import {
  HomeworldCustodyError,
  homeworldForceGroups,
  type HomeworldCustody,
} from '../game/homeworld-custody';

function fixture(): {
  context: HomeworldShipmentContext;
  custody: HomeworldCustody;
} {
  return {
    context: {
      advanced: true,
      players: [
        {
          id: 'e',
          faction: 'emperor',
          reserves: 15,
          eliteReserves: 4,
          ally: null,
        },
        {
          id: 'a',
          faction: 'atreides',
          reserves: 17,
          eliteReserves: 0,
          ally: null,
        },
        {
          id: 'g',
          faction: 'guild',
          reserves: 20,
          eliteReserves: 0,
          ally: null,
        },
        {
          id: 'f',
          faction: 'fremen',
          reserves: 20,
          eliteReserves: 3,
          ally: null,
        },
      ],
    },
    custody: {
      salusa: { normal: 2, elite: 3 },
      visitors: {
        'homeworld:atreides': { e: { normal: 4, elite: 1 } },
        'homeworld:emperor': { a: { normal: 3, elite: 0 } },
      },
    },
  };
}
const invasion: HomeworldShipmentIntent = {
  player: 'e',
  destination: 'homeworld:guild',
  sources: { 'homeworld:emperor': { normal: 3, elite: 1 } },
};
function rejected(
  context: HomeworldShipmentContext,
  custody: HomeworldCustody,
  intent: unknown = invasion,
) {
  const before = structuredClone({ context, custody, intent });
  assert.throws(
    () => quote(context, custody, intent as HomeworldShipmentIntent),
    HomeworldCustodyError,
  );
  assert.deepEqual({ context, custody, intent }, before);
}
function totals(context: HomeworldShipmentContext, custody: HomeworldCustody) {
  const groups = homeworldForceGroups(context, custody);
  return context.players.map((p) => ({
    player: p.id,
    normal: groups.reduce((n, w) => n + (w.forces[p.id]?.normal ?? 0), 0),
    elite: groups.reduce((n, w) => n + (w.forces[p.id]?.elite ?? 0), 0),
  }));
}

void test('native invasion preserves typed global custody and yields detached source and destination receipts', () => {
  const { context, custody } = fixture();
  const before = structuredClone({ context, custody, invasion });
  const result = quote(context, custody, invasion);
  assert.equal(result.amount, 4);
  assert.equal(result.elite, 1);
  assert.equal(result.cost, 4);
  assert.deepEqual(result.sources, [
    {
      homeworld: 'homeworld:emperor',
      player: 'e',
      before: { normal: 9, elite: 1 },
      after: { normal: 6, elite: 0 },
    },
  ]);
  assert.equal(result.receipts.length, 2);
  assert.deepEqual(result.state.visitors['homeworld:guild'].e, {
    normal: 3,
    elite: 1,
  });
  assert.deepEqual(result.state.salusa, custody.salusa);
  assert.equal(result.players[0].reserves, 11);
  assert.equal(result.players[0].eliteReserves, 3);
  const next = {
    ...context,
    players: result.players.map((p) => ({ ...p, ally: null })),
  };
  assert.deepEqual(totals(next, result.state), totals(context, custody));
  assert.deepEqual({ context, custody, invasion }, before);
  result.sources[0].before.normal = 0;
  result.state.salusa!.normal = 0;
  result.state.visitors['homeworld:atreides'].e.normal = 0;
  result.players[0].reserves = 0;
  assert.deepEqual({ context, custody, invasion }, before);
});

void test('Guild may return an exact foreign garrison to its native world at the rounded half rate', () => {
  const { context, custody } = fixture();
  const outward = quote(context, custody, {
    player: 'g',
    destination: 'homeworld:atreides',
    sources: { 'homeworld:guild': { normal: 5, elite: 0 } },
  });
  const next = {
    ...context,
    players: outward.players.map((p) => ({ ...p, ally: null })),
  };
  const before = structuredClone({ next, custody: outward.state });
  const returned = quote(next, outward.state, {
    player: 'g',
    destination: 'homeworld:guild',
    sources: { 'homeworld:atreides': { normal: 5, elite: 0 } },
  });
  assert.equal(returned.amount, 5);
  assert.equal(returned.cost, 3);
  assert.equal(returned.players[2].reserves, 20);
  assert.deepEqual(returned.state, custody);
  assert.deepEqual(returned.sources[0], {
    homeworld: 'homeworld:atreides',
    player: 'g',
    before: { normal: 5, elite: 0 },
    after: { normal: 0, elite: 0 },
  });
  assert.deepEqual({ next, custody: outward.state }, before);
  rejected(context, custody, {
    player: 'g',
    destination: 'homeworld:guild',
    sources: { 'homeworld:guild': { normal: 1, elite: 0 } },
  });
});

void test('Guild rounds the half rate once for odd and even counts including one and twenty', () => {
  for (const amount of [1, 2, 3, 4, 5, 19, 20]) {
    const { context, custody } = fixture();
    const result = quote(context, custody, {
      player: 'g',
      destination: 'homeworld:atreides',
      sources: { 'homeworld:guild': { normal: amount, elite: 0 } },
    });
    assert.equal(result.cost, Math.ceil(amount / 2));
    assert.equal(result.amount, amount);
  }
});

void test('Fremen invasion pays for normal and special counters; Guild alliance does not grant invasion discounts', () => {
  const { context, custody } = fixture();
  context.players[2].ally = 'f';
  context.players[3].ally = 'g';
  const result = quote(context, custody, {
    player: 'f',
    destination: 'homeworld:atreides',
    sources: { 'homeworld:fremen': { normal: 2, elite: 3 } },
  });
  assert.equal(result.cost, 5);
  assert.equal(result.amount, 5);
  assert.equal(result.elite, 3);
  assert.equal(result.players[3].reserves, 15);
  assert.equal(result.players[3].eliteReserves, 0);
});

void test('foreign source departure moves only that explicit garrison and survives JSON restoration', () => {
  const { context, custody } = fixture();
  const result = quote(context, custody, {
    player: 'e',
    destination: 'homeworld:guild',
    sources: { 'homeworld:atreides': { normal: 4, elite: 1 } },
  });
  assert.equal(result.cost, 5);
  assert.equal(result.state.visitors['homeworld:atreides'], undefined);
  assert.deepEqual(
    result.players,
    context.players.map(({ ally: _ally, ...p }) => p),
  );
  const restored = JSON.parse(JSON.stringify(result)) as typeof result;
  const second = quote(
    {
      ...context,
      players: restored.players.map((p) => ({ ...p, ally: null })),
    },
    restored.state,
    {
      player: 'e',
      destination: 'homeworld:atreides',
      sources: { 'homeworld:guild': { normal: 4, elite: 1 } },
    },
  );
  assert.deepEqual(second.state, custody);
  assert.deepEqual(second.players, result.players);
  rejected(context, custody, {
    player: 'e',
    destination: 'homeworld:guild',
    sources: { 'homeworld:atreides': { normal: 5, elite: 0 } },
  });
});

void test('Advanced Emperor may combine its two native origins and retains precise Salusa allocation', () => {
  const { context, custody } = fixture();
  const result = quote(context, custody, {
    ...invasion,
    sources: {
      'homeworld:emperor': { normal: 3, elite: 1 },
      'homeworld:emperor:salusa': { normal: 2, elite: 2 },
    },
  });
  assert.equal(result.amount, 8);
  assert.equal(result.elite, 3);
  assert.equal(result.cost, 8);
  assert.equal(result.sources.length, 2);
  assert.deepEqual(result.state.salusa, { normal: 0, elite: 1 });
  assert.deepEqual(result.state.visitors['homeworld:guild'].e, {
    normal: 5,
    elite: 3,
  });
  assert.equal(result.players[0].reserves, 7);
  assert.equal(result.players[0].eliteReserves, 1);
  assert.deepEqual(
    result.sources.map((r) => r.before),
    [
      { normal: 9, elite: 1 },
      { normal: 2, elite: 3 },
    ],
  );
});

void test('own and mutual ally destinations are rejected, including either Emperor world', () => {
  const { context, custody } = fixture();
  for (const destination of ['homeworld:emperor', 'homeworld:emperor:salusa'])
    rejected(context, custody, {
      ...invasion,
      destination,
      sources: { 'homeworld:atreides': { normal: 1, elite: 0 } },
    });
  context.players[0].ally = 'a';
  context.players[1].ally = 'e';
  rejected(context, custody, {
    ...invasion,
    destination: 'homeworld:atreides',
  });
  for (const destination of ['homeworld:emperor', 'homeworld:emperor:salusa'])
    rejected(context, custody, {
      player: 'a',
      destination,
      sources: { 'homeworld:atreides': { normal: 1, elite: 0 } },
    });
});

void test('unrelated multi-source shipments, repeated source destinations and inactive worlds cannot bypass custody', () => {
  const { context, custody } = fixture();
  for (const sources of [
    {},
    {
      'homeworld:emperor': { normal: 1, elite: 0 },
      'homeworld:atreides': { normal: 1, elite: 0 },
    },
    {
      'homeworld:emperor': { normal: 1, elite: 0 },
      'homeworld:emperor:salusa': { normal: 1, elite: 0 },
      'homeworld:atreides': { normal: 1, elite: 0 },
    },
    { 'homeworld:guild': { normal: 1, elite: 0 } },
    { 'homeworld:harkonnen': { normal: 1, elite: 0 } },
    { arrakeen: { normal: 1, elite: 0 } },
  ])
    rejected(context, custody, { ...invasion, sources });
  rejected(context, custody, {
    ...invasion,
    player: 'a',
    sources: {
      'homeworld:emperor': { normal: 1, elite: 0 },
      'homeworld:emperor:salusa': { normal: 1, elite: 0 },
    },
  });
  const basic = { ...context, advanced: false };
  rejected(
    basic,
    { ...custody, salusa: null },
    {
      ...invasion,
      sources: {
        'homeworld:emperor': { normal: 1, elite: 0 },
        'homeworld:emperor:salusa': { normal: 1, elite: 0 },
      },
    },
  );
  assert.equal(quote(basic, { ...custody, salusa: null }, invasion).amount, 4);
});

void test('malformed and unavailable typed orders reject immutably without pooling or substituting counters', () => {
  const { context, custody } = fixture();
  for (const intent of [
    null,
    [],
    {},
    { ...invasion, payment: 0 },
    { ...invasion, player: 'absent' },
    { ...invasion, destination: 'arrakeen' },
    { ...invasion, sources: [] },
    ...[
      null,
      {},
      { normal: 0, elite: 0 },
      { normal: 1 },
      { normal: 1, elite: 0, advisors: true },
      { normal: '1', elite: 0 },
      { normal: -1, elite: 1 },
      { normal: 0.5, elite: 0 },
      { normal: NaN, elite: 0 },
      { normal: Infinity, elite: 0 },
      { normal: Number.MAX_SAFE_INTEGER, elite: 1 },
      { normal: 21, elite: 0 },
      { normal: 10, elite: 0 },
      { normal: 0, elite: 2 },
    ].map((forces) => ({
      ...invasion,
      sources: { 'homeworld:emperor': forces },
    })),
    {
      ...invasion,
      sources: {
        'homeworld:emperor': { normal: 19, elite: 0 },
        'homeworld:emperor:salusa': { normal: 1, elite: 1 },
      },
    },
  ])
    rejected(context, custody, intent);
});

void test('entire custody is validated before transport, including duplicate reserves and foreign physical totals', () => {
  for (const mutate of [
    (c: HomeworldShipmentContext) => {
      c.players.push({ ...c.players[0] });
    },
    (c: HomeworldShipmentContext) => {
      c.players[0].reserves += 1;
    },
    (c: HomeworldShipmentContext) => {
      c.players[0].ally = 'absent';
    },
    (_c: HomeworldShipmentContext, s: HomeworldCustody) => {
      s.salusa!.elite = 5;
    },
    (_c: HomeworldShipmentContext, s: HomeworldCustody) => {
      s.visitors['homeworld:atreides'].e.elite = 2;
    },
    (_c: HomeworldShipmentContext, s: HomeworldCustody) => {
      s.visitors['homeworld:atreides'].a = { normal: 1, elite: 0 };
    },
    (_c: HomeworldShipmentContext, s: HomeworldCustody) => {
      s.visitors['homeworld:harkonnen'] = { g: { normal: 1, elite: 0 } };
    },
  ]) {
    const { context, custody } = fixture();
    mutate(context, custody);
    rejected(context, custody);
  }
});

void test('quote reads no secret cards, spice, RNG or transport usage and commits no payment', () => {
  const { context, custody } = fixture();
  const expected = quote(context, custody, invasion);
  for (const object of [context, ...context.players])
    for (const key of [
      'hand',
      'spice',
      'rng',
      'shipped',
      'payment',
      'response',
    ])
      Object.defineProperty(object, key, {
        enumerable: true,
        get() {
          throw new Error('private or caller-owned context read');
        },
      });
  assert.deepEqual(quote(context, custody, invasion), expected);
});
