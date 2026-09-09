import test from 'node:test';
import assert from 'node:assert/strict';
import { MOBILE_LOCATION } from '../game/board';
import {
  quoteGuildHomeworldShipment as quote,
  type GuildHomeworldShipmentContext,
  type GuildHomeworldShipmentIntent,
} from '../game/guild-homeworld-shipment';
import {
  HomeworldCustodyError,
  homeworldForceGroups,
  type HomeworldCustody,
} from '../game/homeworld-custody';

function fixture(): {
  context: GuildHomeworldShipmentContext;
  custody: HomeworldCustody;
} {
  return {
    context: {
      advanced: true,
      storm: 12,
      players: [
        {
          id: 'g',
          faction: 'guild',
          reserves: 10,
          eliteReserves: 0,
          ally: null,
        },
        {
          id: 'e',
          faction: 'emperor',
          reserves: 20,
          eliteReserves: 5,
          ally: null,
        },
        {
          id: 'a',
          faction: 'atreides',
          reserves: 20,
          eliteReserves: 0,
          ally: null,
        },
      ],
      board: {
        g: {
          forces: {
            'false_wall_south:4': 3,
            'false_wall_south:5': 4,
            'arrakeen:10': 1,
          },
          eliteForces: {},
        },
        e: { forces: {}, eliteForces: {} },
        a: { forces: {}, eliteForces: {} },
      },
    },
    custody: {
      visitors: { 'homeworld:emperor': { g: { normal: 2, elite: 0 } } },
      salusa: { normal: 0, elite: 5 },
    },
  };
}
const intent: GuildHomeworldShipmentIntent = {
  player: 'g',
  destination: 'homeworld:atreides',
  sources: {
    'false_wall_south:4': { normal: 3, elite: 0 },
    'false_wall_south:5': { normal: 2, elite: 0 },
  },
};
function reject(
  context: GuildHomeworldShipmentContext,
  custody: HomeworldCustody,
  action: unknown = intent,
) {
  const before = structuredClone({ context, custody, action });
  assert.throws(
    () => quote(context, custody, action as GuildHomeworldShipmentIntent),
    HomeworldCustodyError,
  );
  assert.deepEqual({ context, custody, action }, before);
}
function total(
  context: GuildHomeworldShipmentContext,
  custody: HomeworldCustody,
) {
  return (
    homeworldForceGroups(context, custody).reduce(
      (sum, w) => sum + (w.forces.g?.normal ?? 0),
      0,
    ) + Object.values(context.board.g.forces).reduce((sum, n) => sum + n, 0)
  );
}

void test('Guild combines canonical sectors from one territory and conserves detached physical custody', () => {
  const { context, custody } = fixture();
  const before = structuredClone({ context, custody, intent });
  const result = quote(context, custody, intent);
  assert.equal(result.origin, 'false_wall_south');
  assert.equal(result.amount, 5);
  assert.equal(result.elite, 0);
  assert.equal(result.cost, 3);
  assert.deepEqual(result.boardSources, [
    {
      key: 'false_wall_south:4',
      before: { normal: 3, elite: 0 },
      after: { normal: 0, elite: 0 },
    },
    {
      key: 'false_wall_south:5',
      before: { normal: 4, elite: 0 },
      after: { normal: 2, elite: 0 },
    },
  ]);
  assert.deepEqual(result.boardForces, {
    'false_wall_south:5': 2,
    'arrakeen:10': 1,
  });
  assert.deepEqual(result.state.visitors['homeworld:atreides'].g, {
    normal: 5,
    elite: 0,
  });
  assert.deepEqual(result.receipts, [
    {
      homeworld: 'homeworld:atreides',
      player: 'g',
      before: { normal: 0, elite: 0 },
      after: { normal: 5, elite: 0 },
    },
  ]);
  assert.equal(
    total(
      {
        ...context,
        players: result.players.map((p) => ({ ...p, ally: null })),
        board: {
          ...context.board,
          g: {
            forces: result.boardForces,
            eliteForces: result.boardEliteForces,
          },
        },
      },
      result.state,
    ),
    total(context, custody),
  );
  assert.deepEqual({ context, custody, intent }, before);
  result.boardSources[0].before.normal = 17;
  result.boardForces['arrakeen:10'] = 0;
  result.state.visitors['homeworld:emperor'].g.normal = 0;
  result.state.salusa!.elite = 0;
  result.players[0].reserves = 0;
  assert.deepEqual({ context, custody, intent }, before);
});

void test('Junction return increases native reserves while either Emperor world accepts foreign arrivals', () => {
  for (const destination of [
    'homeworld:guild',
    'homeworld:emperor',
    'homeworld:emperor:salusa',
  ]) {
    const { context, custody } = fixture();
    const result = quote(context, custody, { ...intent, destination });
    assert.equal(
      result.players[0].reserves,
      destination === 'homeworld:guild' ? 15 : 10,
    );
    assert.deepEqual(result.state.salusa, custody.salusa);
    assert.equal(result.state.visitors['homeworld:guild'], undefined);
    if (destination !== 'homeworld:guild')
      assert.equal(
        result.state.visitors[destination].g.normal,
        destination === 'homeworld:emperor' ? 7 : 5,
      );
  }
});

void test('Guild tariff rounds the combined group once from one through twenty physical counters', () => {
  for (const amount of [1, 2, 3, 4, 5, 19, 20]) {
    const { context, custody } = fixture();
    context.players[0].reserves = 20 - amount;
    custody.visitors = {};
    context.board.g.forces = { 'arrakeen:10': amount };
    const result = quote(context, custody, {
      ...intent,
      sources: { 'arrakeen:10': { normal: amount, elite: 0 } },
    });
    assert.equal(result.amount, amount);
    assert.equal(result.cost, Math.ceil(amount / 2));
  }
});

void test('Arrakis transport is Guild-only and mutual allies cannot become Homeworld destinations', () => {
  const { context, custody } = fixture();
  context.players[0].ally = 'e';
  context.players[1].ally = 'g';
  for (const destination of ['homeworld:emperor', 'homeworld:emperor:salusa'])
    reject(context, custody, { ...intent, destination });
  reject(context, custody, { ...intent, player: 'e' });
  assert.equal(quote(context, custody, intent).amount, 5);
  context.players[1].ally = null;
  assert.equal(
    quote(context, custody, { ...intent, destination: 'homeworld:emperor' })
      .amount,
    5,
  );
});

void test('storm sectors cannot join a group while other sectors in the territory remain legal', () => {
  const { context, custody } = fixture();
  context.storm = 4;
  reject(context, custody);
  assert.equal(
    quote(context, custody, {
      ...intent,
      sources: { 'false_wall_south:5': { normal: 4, elite: 0 } },
    }).amount,
    4,
  );
  reject(context, custody, {
    ...intent,
    sources: {
      'false_wall_south:5': { normal: 1, elite: 0 },
      'arrakeen:10': { normal: 1, elite: 0 },
    },
  });
});

void test('mobile stronghold interior requires its active pointer and stays storm protected', () => {
  const { context, custody } = fixture();
  context.board.g.forces = { [MOBILE_LOCATION]: 8 };
  const action = {
    ...intent,
    sources: { [MOBILE_LOCATION]: { normal: 5, elite: 0 } },
  };
  reject(context, custody, action);
  context.mobileStronghold = 'false_wall_south:4';
  context.storm = 4;
  assert.equal(quote(context, custody, action).amount, 5);
  for (const pointer of [
    MOBILE_LOCATION,
    'false_wall_south:04',
    'homeworld:guild',
    'false_wall_south:99',
    '',
  ]) {
    context.mobileStronghold = pointer;
    reject(context, custody, action);
  }
});

void test('malformed sources, alias sectors and unavailable force identities reject without mutation', () => {
  const { context, custody } = fixture();
  for (const action of [
    null,
    [],
    {},
    { ...intent, amount: 5 },
    { ...intent, sources: {} },
    { ...intent, sources: [] },
    { ...intent, player: 'absent' },
    { ...intent, destination: 'homeworld:harkonnen' },
    ...[
      'false_wall_south:04',
      'false_wall_south:4:extra',
      'false_wall_south:4.0',
      'false_wall_south:99',
      'homeworld:guild',
      'false_wall_south',
    ].map((key) => ({
      ...intent,
      sources: { [key]: { normal: 1, elite: 0 } },
    })),
    ...[
      null,
      {},
      { normal: 0, elite: 0 },
      { normal: 1 },
      { normal: 1, elite: 0, extra: 0 },
      { normal: '1', elite: 0 },
      { normal: NaN, elite: 0 },
      { normal: Infinity, elite: 0 },
      { normal: 0.5, elite: 0 },
      { normal: -1, elite: 0 },
      { normal: 21, elite: 0 },
      { normal: 4, elite: 0 },
      { normal: 1, elite: 1 },
    ].map((selected) => ({
      ...intent,
      sources: { 'false_wall_south:4': selected },
    })),
  ])
    reject(context, custody, action);
});

void test('corrupt board, reserve and visitor counters cannot be laundered into a valid destination', () => {
  for (const mutate of [
    (c: GuildHomeworldShipmentContext) => {
      c.board.g.forces['arrakeen:10']++;
    },
    (c: GuildHomeworldShipmentContext) => {
      c.board.g.forces['arrakeen:010'] = 0;
    },
    (c: GuildHomeworldShipmentContext) => {
      c.board.g.forces['arrakeen:10'] = -1;
    },
    (c: GuildHomeworldShipmentContext) => {
      c.board.g.eliteForces['false_wall_south:4'] = 1;
    },
    (c: GuildHomeworldShipmentContext) => {
      c.players[0].ally = 'absent';
    },
    (c: GuildHomeworldShipmentContext) => {
      c.storm = 19;
    },
    (_c: GuildHomeworldShipmentContext, s: HomeworldCustody) => {
      s.visitors['homeworld:emperor'].e = { normal: 1, elite: 0 };
    },
    (_c: GuildHomeworldShipmentContext, s: HomeworldCustody) => {
      s.salusa!.elite = 6;
    },
  ]) {
    const { context, custody } = fixture();
    mutate(context, custody);
    reject(context, custody);
  }
});

void test('JSON restoration preserves a second partial shipment and exact custody', () => {
  const { context, custody } = fixture();
  const result = JSON.parse(
    JSON.stringify(quote(context, custody, intent)),
  ) as ReturnType<typeof quote>;
  const next = {
    ...context,
    players: result.players.map((p) => ({ ...p, ally: null })),
    board: {
      ...context.board,
      g: { forces: result.boardForces, eliteForces: result.boardEliteForces },
    },
  };
  const second = quote(next, result.state, {
    ...intent,
    destination: 'homeworld:guild',
    sources: { 'false_wall_south:5': { normal: 2, elite: 0 } },
  });
  assert.equal(second.players[0].reserves, 12);
  assert.deepEqual(second.boardForces, { 'arrakeen:10': 1 });
  assert.equal(second.state.visitors['homeworld:atreides'].g.normal, 5);
});

void test('quote does not inspect secret cards, resources, phase usage or other players’ hidden board values', () => {
  const { context, custody } = fixture();
  const expected = quote(context, custody, intent);
  for (const object of [context, ...context.players, context.board.e])
    for (const key of [
      'hand',
      'spice',
      'rng',
      'shipped',
      'noField',
      'payment',
      'response',
    ])
      Object.defineProperty(object, key, {
        enumerable: true,
        get() {
          throw new Error('Caller-owned private field read.');
        },
      });
  Object.defineProperty(context.board.e, 'forces', {
    get() {
      throw new Error('Unrelated board read.');
    },
  });
  assert.deepEqual(quote(context, custody, intent), expected);
});
