import test from 'node:test';
import assert from 'node:assert/strict';
import type { GameView } from '../game/engine';
import {
  homeworldForceGroups,
  type HomeworldCustody,
} from '../game/homeworld-custody';
import { homeworldPopulations } from '../game/homeworld-population';
import { quoteNativeReserveWithdrawal } from '../game/homeworld-native-reserves';
import {
  quoteEmperorHomeworldMove,
  type EmperorHomeworld,
} from '../game/homeworld-emperor-move';
import {
  nativeShipmentSources,
  nativeReserveSources,
  withNativeShipmentSources,
  emperorHomeworldMoveActions,
} from '../game/homeworld-options';

function fixture(reserves = 12, eliteReserves = 3, normal = 2, elite = 1) {
  const context = {
    advanced: true,
    players: [
      { id: 'e', faction: 'emperor' as const, reserves, eliteReserves },
      { id: 'a', faction: 'atreides' as const, reserves: 18, eliteReserves: 0 },
    ],
  };
  const custody: HomeworldCustody = {
    salusa: { normal, elite },
    visitors: { 'homeworld:emperor': { a: { normal: 2, elite: 0 } } },
  };
  const populations = homeworldPopulations(context, custody);
  const view = {
    me: 'e',
    active: 'e',
    advanced: true,
    status: 'playing',
    phase: 5,
    homeworldMove: { event: 'movement:1', remaining: 2, blocked: null },
    players: context.players.map((p) => ({
      ...p,
      elites: { reserves: p.eliteReserves },
    })),
    homeworlds: {
      worlds: homeworldForceGroups(context, custody).map((home) => ({
        ...home,
        ...populations.find((p) => p.location === home.id)!,
      })),
    },
  } as unknown as GameView;
  return { context, custody, view };
}

void test('shipment source allocations preserve both physical types, exclude visitors, and remain deterministic', () => {
  const { context, custody, view } = fixture();
  const before = structuredClone(view);
  const sources = nativeShipmentSources(view, 10, 3)!;
  assert.deepEqual(sources, {
    'homeworld:emperor': { normal: 7, elite: 2 },
    'homeworld:emperor:salusa': { normal: 0, elite: 1 },
  });
  const quoted = quoteNativeReserveWithdrawal(
    context,
    custody,
    'e',
    { normal: 7, elite: 3 },
    sources,
  );
  assert.equal(quoted.players[0].reserves, 2);
  assert.equal(quoted.players[0].eliteReserves, 0);
  assert.deepEqual(quoted.state.visitors, custody.visitors);
  assert.deepEqual(view, before);
  view.homeworlds!.worlds!.reverse();
  assert.deepEqual(nativeShipmentSources(view, 10, 3), sources);
  assert.equal(
    nativeShipmentSources(view, 10, 0),
    null,
    'visitors cannot fund native normals',
  );
  assert.equal(nativeShipmentSources(view, 4, 4), null);
});

void test('server shipment witnesses share source choices without projecting a GameView and reject corrupt custody immutably', () => {
  const { context, custody, view } = fixture();
  assert.deepEqual(
    nativeReserveSources(context, custody, 'e', { normal: 7, elite: 3 }),
    nativeShipmentSources(view, 10, 3),
  );
  custody.salusa!.elite = 4;
  const before = structuredClone({ context, custody });
  assert.equal(
    nativeReserveSources(context, custody, 'e', { normal: 1, elite: 0 }),
    null,
  );
  assert.deepEqual({ context, custody }, before);
});

void test('zero and single-home native allocations are explicit while disabled and malformed requests are unavailable', () => {
  const { view } = fixture();
  assert.deepEqual(nativeShipmentSources(view, 0), {
    'homeworld:emperor': { normal: 0, elite: 0 },
    'homeworld:emperor:salusa': { normal: 0, elite: 0 },
  });
  view.me = 'a';
  assert.deepEqual(nativeShipmentSources(view, 3), {
    'homeworld:atreides': { normal: 3, elite: 0 },
  });
  for (const [amount, elite] of [
    [-1, 0],
    [1.5, 0],
    [21, 0],
    [3, 4],
    [2, -1],
    [NaN, 0],
  ])
    assert.equal(nativeShipmentSources(view, amount, elite), null);
  view.homeworlds = null;
  assert.equal(nativeShipmentSources(view, 0), null);
});

void test('shipment action decoration matches engine elite defaults and preserves valid explicit player allocations', () => {
  const { view } = fixture();
  const implicit = withNativeShipmentSources(view, {
    type: 'ship',
    amount: 11,
  });
  assert.deepEqual(implicit?.homeworldSources, {
    'homeworld:emperor': { normal: 7, elite: 2 },
    'homeworld:emperor:salusa': { normal: 2, elite: 0 },
  });
  const explicit = {
    type: 'ship',
    amount: 1,
    elite: 0,
    homeworldSources: { 'homeworld:emperor:salusa': { normal: 1, elite: 0 } },
  };
  assert.deepEqual(withNativeShipmentSources(view, explicit), explicit);
  assert.equal(
    withNativeShipmentSources(view, { ...explicit, homeworldSources: null }),
    null,
  );
  assert.equal(
    withNativeShipmentSources(view, {
      ...explicit,
      homeworldSources: { 'homeworld:atreides': { normal: 1, elite: 0 } },
    }),
    null,
  );
  for (const action of [
    { type: 'move' },
    { type: 'ship', noField: 'token' },
    { type: 'noFieldAllyOffer' },
  ])
    assert.equal(withNativeShipmentSources(view, action), action);
  view.homeworlds = null;
  const ordinary = { type: 'ship', amount: 3 };
  assert.equal(withNativeShipmentSources(view, ordinary), ordinary);
});

void test('Emperor restores Salusa with the minimum Sardaukar and spends one movement without touching visitors or native totals', () => {
  const { context, custody, view } = fixture();
  const before = structuredClone(view);
  const actions = emperorHomeworldMoveActions(view);
  assert.deepEqual(actions, [
    {
      type: 'emperorHomeworldMove',
      event: 'movement:1',
      origin: 'homeworld:emperor',
      normal: 0,
      elite: 1,
    },
  ]);
  const action = actions[0];
  const result = quoteEmperorHomeworldMove(
    {
      ...context,
      status: 'playing',
      phase: 5,
      currentPlayer: 'e',
      movesLeft: 2,
    },
    custody,
    'e',
    {
      origin: action.origin as EmperorHomeworld,
      forces: {
        normal: action.normal as number,
        elite: action.elite as number,
      },
    },
  );
  assert.equal(result.movesLeft, 1);
  assert.deepEqual(result.players, context.players);
  assert.deepEqual(result.state.visitors, custody.visitors);
  assert.equal(
    result.populations.after.filter(
      (p) => p.native === 'e' && p.side === 'high',
    ).length,
    2,
  );
  assert.deepEqual(view, before);
  assert.deepEqual(emperorHomeworldMoveActions(fixture(12, 3, 2, 2).view), []);
});

void test('normal returns restore Kaitain without reducing Salusa; competing deficits favor Salusa and never oscillate', () => {
  assert.deepEqual(emperorHomeworldMoveActions(fixture(9, 3, 3, 2).view), [
    {
      type: 'emperorHomeworldMove',
      event: 'movement:1',
      origin: 'homeworld:emperor:salusa',
      normal: 1,
      elite: 0,
    },
  ]);
  assert.deepEqual(emperorHomeworldMoveActions(fixture(9, 3, 1, 2).view), []);
  const first = emperorHomeworldMoveActions(fixture(7, 3, 2, 1).view);
  assert.equal(first[0].origin, 'homeworld:emperor');
  const second = emperorHomeworldMoveActions(fixture(7, 3, 2, 2).view);
  assert.equal(second[0].normal, 2);
  assert.equal(second[0].elite, 0);
  assert.deepEqual(emperorHomeworldMoveActions(fixture(7, 3, 0, 2).view), []);
  assert.deepEqual(
    emperorHomeworldMoveActions(fixture(6, 3, 2, 2).view),
    [],
    'insufficient normal return never undoes a repaired Salusa',
  );
  assert.deepEqual(
    emperorHomeworldMoveActions(fixture(4, 1, 2, 0).view),
    [],
    'a move must actually restore a high threshold',
  );
});

void test('blocked, Basic, other actor, exhausted and wrong phase views produce no Emperor candidates', () => {
  for (const patch of [
    { advanced: false },
    { active: 'a' },
    { me: 'a' },
    { phase: 4 },
    { status: 'setup' },
    { homeworlds: null },
    { homeworldMove: null },
    { homeworldMove: { event: 'movement:1', remaining: 0, blocked: null } },
    {
      homeworldMove: {
        event: 'movement:1',
        remaining: 2,
        blocked: 'A response is pending.',
      },
    },
  ]) {
    const { view } = fixture();
    assert.deepEqual(
      emperorHomeworldMoveActions({ ...view, ...patch } as GameView),
      [],
    );
  }
});

void test('public-view options are invariant to private hands and unrelated state and never read randomness', () => {
  const { view } = fixture();
  const expectedSources = nativeShipmentSources(view, 5, 1);
  const expectedMoves = emperorHomeworldMoveActions(view);
  for (const object of [view, ...view.players])
    for (const key of [
      'hand',
      'deck',
      'rng',
      'prediction',
      'traitors',
      'plans',
    ])
      Object.defineProperty(object, key, {
        get() {
          throw new Error('private field read');
        },
      });
  const random = Math.random;
  Math.random = () => {
    throw new Error('randomness read');
  };
  try {
    assert.deepEqual(nativeShipmentSources(view, 5, 1), expectedSources);
    assert.deepEqual(emperorHomeworldMoveActions(view), expectedMoves);
  } finally {
    Math.random = random;
  }
});
