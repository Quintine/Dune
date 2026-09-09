import test from 'node:test';
import assert from 'node:assert/strict';
import { MOBILE_LOCATION } from '../game/board';
import {
  homeworldForceGroups,
  HomeworldCustodyError,
  type HomeworldCustody,
} from '../game/homeworld-custody';
import {
  junctionSponsorEligible,
  quoteJunctionTransport as quote,
  type JunctionTransportContext,
  type JunctionTransportIntent,
} from '../game/junction-transport';

function fixture(): {
  context: JunctionTransportContext;
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
          reserves: 15,
          eliteReserves: 0,
          ally: null,
        },
        {
          id: 'e',
          faction: 'emperor',
          reserves: 12,
          eliteReserves: 3,
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
        e: {
          forces: { 'false_wall_south:4': 3, 'false_wall_south:5': 2 },
          eliteForces: { 'false_wall_south:4': 1 },
        },
      },
    },
    custody: {
      visitors: { 'homeworld:atreides': { e: { normal: 2, elite: 1 } } },
      salusa: { normal: 0, elite: 3 },
    },
  };
}
function action(
  patch: Partial<JunctionTransportIntent> = {},
): JunctionTransportIntent {
  return {
    player: 'e',
    sponsor: 'g',
    destination: 'homeworld:guild',
    rate: 'half',
    sources: {
      'false_wall_south:4': { normal: 2, elite: 1 },
      'false_wall_south:5': { normal: 2, elite: 0 },
    },
    ...patch,
  };
}
function rejected(
  context: JunctionTransportContext,
  custody: HomeworldCustody,
  intent: unknown,
) {
  const before = structuredClone({ context, custody, intent });
  assert.throws(
    () => quote(context, custody, intent as JunctionTransportIntent),
    HomeworldCustodyError,
  );
  assert.deepEqual({ context, custody, intent }, before);
}
function total(
  context: JunctionTransportContext,
  custody: HomeworldCustody,
  player = 'e',
) {
  return (
    homeworldForceGroups(context, custody).reduce((sum, w) => {
      const f = w.forces[player];
      return sum + (f?.normal ?? 0) + (f?.elite ?? 0);
    }, 0) +
    Object.values(context.board[player].forces).reduce((sum, n) => sum + n, 0)
  );
}

void test('Junction board-to-world quotes preserve total and elite identity across canonical sectors', () => {
  const { context, custody } = fixture();
  const intent = action();
  const before = structuredClone({ context, custody, intent });
  const q = quote(context, custody, intent);
  assert.equal(q.cost, 3);
  assert.equal(q.amount, 5);
  assert.equal(q.elite, 1);
  assert.equal(q.originKind, 'arrakis');
  assert.equal(q.destinationKind, 'homeworld');
  assert.equal(q.origin, 'false_wall_south');
  assert.deepEqual(q.boardForces, {});
  assert.deepEqual(q.boardEliteForces, {});
  assert.deepEqual(q.state.visitors['homeworld:guild'].e, {
    normal: 4,
    elite: 1,
  });
  assert.deepEqual(q.sources, [
    {
      key: 'false_wall_south:4',
      before: { normal: 2, elite: 1 },
      after: { normal: 0, elite: 0 },
    },
    {
      key: 'false_wall_south:5',
      before: { normal: 2, elite: 0 },
      after: { normal: 0, elite: 0 },
    },
  ]);
  assert.equal(
    total(
      {
        ...context,
        players: q.players.map((p) => ({ ...p, ally: null })),
        board: {
          e: { forces: q.boardForces, eliteForces: q.boardEliteForces },
        },
      },
      q.state,
    ),
    20,
  );
  assert.deepEqual({ context, custody, intent }, before);
  q.state.visitors['homeworld:atreides'].e.normal = 0;
  q.players[0].reserves = 0;
  assert.deepEqual({ context, custody, intent }, before);
});

void test('Junction foreign-world return credits exact Emperor native Salusa allocation', () => {
  const { context, custody } = fixture();
  const q = quote(
    context,
    custody,
    action({
      destination: 'homeworld:emperor:salusa',
      sources: { 'homeworld:atreides': { normal: 2, elite: 1 } },
      rate: 'full',
    }),
  );
  assert.equal(q.cost, 3);
  assert.equal(q.players.find((p) => p.id === 'e')!.reserves, 15);
  assert.deepEqual(q.state.salusa, { normal: 2, elite: 4 });
  assert.deepEqual(q.state.visitors, {});
  assert.deepEqual(q.sources, [
    {
      key: 'homeworld:atreides',
      before: { normal: 2, elite: 1 },
      after: { normal: 0, elite: 0 },
    },
  ]);
});

void test('Junction Emperor may combine native worlds without inventing foreign reserves', () => {
  const { context, custody } = fixture();
  const q = quote(
    context,
    custody,
    action({
      destination: 'homeworld:atreides',
      sources: {
        'homeworld:emperor': { normal: 2, elite: 0 },
        'homeworld:emperor:salusa': { normal: 0, elite: 2 },
      },
    }),
  );
  assert.equal(q.cost, 2);
  assert.equal(q.players.find((p) => p.id === 'e')!.reserves, 8);
  assert.deepEqual(q.state.salusa, { normal: 0, elite: 1 });
  assert.deepEqual(q.state.visitors['homeworld:atreides'].e, {
    normal: 4,
    elite: 3,
  });
  assert.equal(q.sources.length, 2);
});

void test('Junction foreign-world-to-Arrakis subtracts visitors, leaving native reserves and arrival to engine', () => {
  const { context, custody } = fixture();
  for (const [destination, rate, cost] of [
    ['arrakeen:10', 'full', 3],
    ['arrakeen:10', 'half', 2],
    ['false_wall_south:4', 'full', 6],
    ['false_wall_south:4', 'half', 3],
  ] as const) {
    const q = quote(
      context,
      custody,
      action({
        destination,
        rate,
        sources: { 'homeworld:atreides': { normal: 2, elite: 1 } },
      }),
    );
    assert.equal(q.cost, cost);
    assert.equal(q.originKind, 'homeworld');
    assert.equal(q.destinationKind, 'arrakis');
    assert.deepEqual(
      q.players,
      context.players.map(({ ally: _ally, ...p }) => p),
    );
    assert.deepEqual(q.boardForces, context.board.e.forces);
    assert.deepEqual(q.state.visitors, {});
    assert.equal(total(context, q.state) + q.amount, total(context, custody));
  }
});

void test('Junction cross-planet transport returns only board withdrawals and exact price', () => {
  const { context, custody } = fixture();
  const q = quote(context, custody, action({ destination: 'arrakeen:10' }));
  assert.equal(q.cost, 3);
  assert.equal(q.destinationKind, 'arrakis');
  assert.deepEqual(q.boardForces, {});
  assert.deepEqual(q.state, custody);
  rejected(context, custody, action({ destination: 'false_wall_south:6' }));
});

void test('Junction rejects absent, self, incorrect and low-population sponsorship without mutation', () => {
  const { context, custody } = fixture();
  for (const sponsor of ['absent', 'e', 'a'])
    rejected(context, custody, action({ sponsor }));
  context.players[0].reserves = 4;
  assert.equal(junctionSponsorEligible(context, custody, 'g'), false);
  rejected(context, custody, action());
  custody.visitors['homeworld:guild'] = { a: { normal: 0, elite: 0 } };
  context.players[0].reserves = 5;
  assert.equal(junctionSponsorEligible(context, custody, 'g'), true);
  assert.equal(quote(context, custody, action()).cost, 3);
});

void test('Junction mutual ally Homeworld is forbidden even when the ally provides the grant', () => {
  const { context, custody } = fixture();
  context.players[0].ally = 'e';
  context.players[1].ally = 'g';
  rejected(context, custody, action());
  assert.equal(
    quote(context, custody, action({ destination: 'homeworld:emperor' }))
      .amount,
    5,
  );
});

void test('Junction source and destination validation rejects aliases, world sectors and mixed origins', () => {
  const { context, custody } = fixture();
  for (const key of [
    'false_wall_south:04',
    'false_wall_south:4:extra',
    'homeworld:guild:0',
    'nowhere:1',
  ]) {
    rejected(
      context,
      custody,
      action({ sources: { [key]: { normal: 1, elite: 0 } } }),
    );
    rejected(context, custody, action({ destination: key }));
  }
  rejected(
    context,
    custody,
    action({
      sources: {
        'false_wall_south:4': { normal: 1, elite: 0 },
        'arrakeen:10': { normal: 1, elite: 0 },
      },
    }),
  );
  rejected(
    context,
    custody,
    action({
      sources: {
        'homeworld:atreides': { normal: 1, elite: 0 },
        'homeworld:emperor': { normal: 1, elite: 0 },
      },
    }),
  );
  rejected(
    context,
    custody,
    action({
      sources: {
        'homeworld:atreides': { normal: 1, elite: 0 },
        'false_wall_south:4': { normal: 1, elite: 0 },
      },
    }),
  );
});

void test('Junction source storm rejection is sector-specific and rejects storm arrivals', () => {
  const { context, custody } = fixture();
  context.storm = 4;
  rejected(context, custody, action());
  assert.equal(
    quote(
      context,
      custody,
      action({ sources: { 'false_wall_south:5': { normal: 2, elite: 0 } } }),
    ).amount,
    2,
  );
  rejected(
    context,
    custody,
    action({
      destination: 'false_wall_south:4',
      sources: { 'homeworld:atreides': { normal: 1, elite: 0 } },
    }),
  );
});

void test('Junction protects HMS interior source and destination even with its pointer in storm', () => {
  const { context, custody } = fixture();
  context.storm = 4;
  context.mobileStronghold = 'false_wall_south:4';
  context.board.e.forces = { [MOBILE_LOCATION]: 5 };
  context.board.e.eliteForces = { [MOBILE_LOCATION]: 1 };
  const q = quote(
    context,
    custody,
    action({ sources: { [MOBILE_LOCATION]: { normal: 4, elite: 1 } } }),
  );
  assert.equal(q.amount, 5);
  assert.equal(
    quote(
      context,
      custody,
      action({
        destination: MOBILE_LOCATION,
        sources: { 'homeworld:atreides': { normal: 2, elite: 1 } },
      }),
    ).cost,
    2,
  );
  context.storm = 0;
  assert.equal(
    quote(
      context,
      custody,
      action({ sources: { [MOBILE_LOCATION]: { normal: 4, elite: 1 } } }),
    ).amount,
    5,
  );
  context.mobileStronghold = null;
  rejected(
    context,
    custody,
    action({ sources: { [MOBILE_LOCATION]: { normal: 4, elite: 1 } } }),
  );
});

void test('Junction rejects unavailable or malformed typed physical counts and overfull combined supply', () => {
  for (const selected of [
    { normal: 3, elite: 0 },
    { normal: 0, elite: 2 },
    { normal: 0, elite: 0 },
    { normal: 1.5, elite: 0 },
    { normal: -1, elite: 1 },
    { normal: 1, elite: 0, concealed: 1 },
  ]) {
    const { context, custody } = fixture();
    rejected(
      context,
      custody,
      action({ sources: { 'false_wall_south:4': selected } }),
    );
  }
  const { context, custody } = fixture();
  context.board.e.forces['arrakeen:10'] = 1;
  rejected(context, custody, action());
  delete context.board.e.forces['arrakeen:10'];
  context.board.e.eliteForces['false_wall_south:5'] = 1;
  rejected(context, custody, action());
});

void test('Junction never upgrades BG advisors to Homeworld fighters but permits their Arrakis transport quote', () => {
  const { context, custody } = fixture();
  context.players[1] = {
    id: 'e',
    faction: 'beneGesserit',
    reserves: 15,
    eliteReserves: 0,
    ally: null,
  };
  custody.salusa = null;
  custody.visitors = {};
  context.board.e.eliteForces = {};
  context.board.e.advisors = { false_wall_south: {} };
  const intent = action({
    sources: { 'false_wall_south:4': { normal: 3, elite: 0 } },
  });
  rejected(context, custody, intent);
  assert.equal(
    quote(context, custody, { ...intent, destination: 'arrakeen:10' }).amount,
    3,
  );
  context.board.e.advisors = {};
  assert.equal(quote(context, custody, intent).amount, 3);
});

void test('Junction rejects unrecognized intent fields and rate values; no concealed count is accepted', () => {
  const { context, custody } = fixture();
  rejected(context, custody, { ...action(), rate: 'free' });
  rejected(context, custody, { ...action(), noField: 'secret' });
  rejected(context, custody, { ...action(), sponsor: undefined });
});

void test('Junction reads only actor board and public reserve/custody fields', () => {
  const { context, custody } = fixture();
  Object.defineProperty(context.board, 'a', {
    enumerable: true,
    get() {
      throw new Error('other board read');
    },
  });
  for (const p of context.players)
    Object.defineProperty(p, 'hand', {
      get() {
        throw new Error('private hand read');
      },
    });
  assert.equal(quote(context, custody, action()).amount, 5);
});
