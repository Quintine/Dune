import test from 'node:test';
import assert from 'node:assert/strict';
import { newPlayer } from '../game/engine';
import { createHomeworldCustody } from '../game/homeworld-custody';
import { homeworldContext } from '../game/homeworld-game';
import {
  quoteGrummanCollection,
  quoteGrummanCollectionAction,
  type GrummanCollectionAction,
  type GrummanCollectionContext,
} from '../game/grumman-collection';
import {
  createTerrorState,
  placeTerror,
  projectTerror,
  revealTerror,
  TERROR_KINDS,
  type TerrorState,
} from '../game/moritani-terror';

function fixture(native = 8, advanced = true): GrummanCollectionContext {
  const players = [
    newPlayer('m', 'Moritani', 'moritani'),
    newPlayer('v', 'Visitor', 'harkonnen'),
  ];
  players[0].reserves = native;
  const context = { advanced, players };
  const state = placeTerror(
    createTerrorState(() => 0),
    'terror-1',
    'arrakeen',
    2,
  );
  state.supplyEpoch = 4;
  return {
    ...context,
    homeworlds: { custody: createHomeworldCustody(homeworldContext(context)) },
    moritaniTerror: state,
  };
}
const add = {
  mode: 'add',
  token: 'terror-2',
  destination: 'arrakeen',
} as const;

void test('Grumman quotes the exact current high threshold in both rules modes; foreign visitors never qualify', () => {
  for (const advanced of [false, true])
    for (const native of [0, 7, 8, 20]) {
      const g = fixture(native, advanced);
      g.players[1].reserves = 0;
      g.homeworlds!.custody!.visitors['homeworld:moritani'] = {
        v: { normal: 20, elite: 0 },
      };
      const quote = quoteGrummanCollection(g, 'm');
      assert.equal(quote.population, native);
      assert.equal(quote.high, native >= 8);
      assert.equal(quote.blocked === null, native >= 8);
      assert.deepEqual(quote.destinations, native >= 8 ? ['arrakeen'] : []);
      assert.equal(quote.tokens.length, native >= 8 ? 5 : 0);
    }
  const g = fixture();
  delete g.homeworlds;
  assert.equal(quoteGrummanCollection(g, 'm').population, null);
  assert.throws(() => quoteGrummanCollectionAction(g, 'm', add));
  assert.throws(() => quoteGrummanCollection(g, 'v'));
});

void test('one available token adds to an existing stack for four bank spice without consuming Mentat or changing identities', () => {
  const g = fixture();
  const original = structuredClone(g);
  const first = quoteGrummanCollectionAction(g, 'm', add);
  assert.equal(first.amount, 4);
  assert.equal(first.state.placementTurn, 2);
  assert.equal(first.state.supplyEpoch, 4);
  assert.deepEqual(g, original);
  assert.equal(
    first.state.tokens.filter((token) => token.location === 'arrakeen').length,
    2,
  );
  assert.deepEqual(
    first.state.tokens.map((token) => token.id),
    g.moritaniTerror!.tokens.map((token) => token.id),
  );
  assert.deepEqual(
    first.state.tokens.map((token) => token.kind).sort(),
    [...TERROR_KINDS].sort(),
  );
  assert.ok(
    first.state.tokens.every(
      (token, index) => token !== g.moritaniTerror!.tokens[index],
    ),
  );
  // A subsequent independent opportunity can add to an existing stack, while
  // ordinary Mentat still requires an empty stronghold and its own turn.
  g.moritaniTerror = first.state;
  const second = quoteGrummanCollectionAction(g, 'm', {
    ...add,
    token: 'terror-3',
  });
  assert.equal(
    second.state.tokens.filter((token) => token.location === 'arrakeen').length,
    3,
  );
  assert.throws(() => placeTerror(second.state, 'terror-4', 'arrakeen', 3));
  assert.equal(
    placeTerror(second.state, 'terror-4', 'carthag', 3).placementTurn,
    3,
  );
  assert.deepEqual(JSON.parse(JSON.stringify(second.state)), second.state);
});

void test('offers need available supply and an existing ordinary stronghold token; storm is not a placement input', () => {
  const g = fixture();
  Object.defineProperty(g, 'storm', {
    get() {
      throw new Error('Storm is irrelevant to Terror placement');
    },
  });
  assert.equal(quoteGrummanCollectionAction(g, 'm', add).amount, 4);
  for (const destination of [
    'carthag',
    'homeworld:moritani',
    'mobile_stronghold',
    'arrakeen:10',
    'hagga_basin',
  ])
    assert.throws(() =>
      quoteGrummanCollectionAction(g, 'm', { ...add, destination }),
    );
  g.moritaniTerror = createTerrorState(() => 0);
  assert.match(quoteGrummanCollection(g, 'm').blocked!, /already containing/);
  g.moritaniTerror.tokens.forEach((token) => {
    token.status = 'placed';
    token.location = 'arrakeen';
  });
  assert.match(quoteGrummanCollection(g, 'm').blocked!, /no available/);
});

void test('decline gives zero with cloned unchanged custody; unresolved removal never spends or reveals a token', () => {
  for (const native of [7, 8]) {
    const g = fixture(native);
    const before = JSON.stringify(g);
    const declined = quoteGrummanCollectionAction(g, 'm', { mode: 'decline' });
    assert.equal(declined.amount, 0);
    assert.deepEqual(declined.state, g.moritaniTerror);
    assert.notEqual(declined.state, g.moritaniTerror);
    assert.match(quoteGrummanCollection(g, 'm').removeBlocked, /custody zone/);
    for (const token of ['terror-1', 'terror-2', 'atomics-aftermath', 'absent'])
      assert.throws(
        () => quoteGrummanCollectionAction(g, 'm', { mode: 'remove', token }),
        /custody zone/,
      );
    assert.equal(JSON.stringify(g), before);
  }
});

void test('adding never relocates, recovers a spent token or accepts stale high eligibility', () => {
  const g = fixture();
  const offered = quoteGrummanCollection(g, 'm');
  offered.tokens[0].status = 'removed';
  assert.equal(g.moritaniTerror!.tokens[1].status, 'available');
  g.players[0].reserves = 7;
  assert.throws(() => quoteGrummanCollectionAction(g, 'm', add));
  g.players[0].reserves = 8;
  for (const token of ['terror-1', 'missing'])
    assert.throws(() =>
      quoteGrummanCollectionAction(g, 'm', { ...add, token }),
    );
  g.moritaniTerror = revealTerror(g.moritaniTerror!, 'terror-1');
  assert.throws(() =>
    quoteGrummanCollectionAction(g, 'm', { ...add, token: 'terror-1' }),
  );
});

void test('malformed physical inventories and operation shapes reject without mutation', () => {
  const original = fixture();
  const corruptions: ((s: TerrorState) => void)[] = [
    (s) => {
      s.tokens.pop();
    },
    (s) => {
      s.tokens[1].id = s.tokens[0].id;
    },
    (s) => {
      s.tokens[1].kind = s.tokens[0].kind;
    },
    (s) => {
      s.tokens[1].location = 'carthag';
    },
    (s) => {
      s.tokens[0].location = 'homeworld:moritani';
    },
    (s) => {
      s.tokens[0].status = 'removed';
    },
    (s) => {
      s.tokens.find((t) => t.kind !== 'extortion')!.status = 'extortion';
    },
    (s) => {
      s.supplyEpoch = -1;
    },
    (s) => {
      s.placementTurn = 1.5;
    },
  ];
  for (const corrupt of corruptions) {
    const g = structuredClone(original);
    corrupt(g.moritaniTerror!);
    const before = JSON.stringify(g);
    assert.throws(() => quoteGrummanCollection(g, 'm'));
    assert.throws(() => quoteGrummanCollectionAction(g, 'm', add));
    assert.equal(JSON.stringify(g), before);
  }
  for (const action of [
    null,
    {},
    { mode: 'add' },
    { ...add, amount: 4 },
    { mode: 'decline', token: 'terror-2' },
  ])
    assert.throws(() =>
      quoteGrummanCollectionAction(
        original,
        'm',
        action as GrummanCollectionAction,
      ),
    );
});

void test('the owner quote reads no hands, balances or force positions and stacked public views retain hidden faces', () => {
  const g = fixture();
  for (const player of g.players)
    for (const field of [
      'hand',
      'spice',
      'tanks',
      'forces',
      'traitors',
      'noField',
    ])
      Object.defineProperty(player, field, {
        get() {
          throw new Error(`Private ${field}`);
        },
      });
  const result = quoteGrummanCollectionAction(g, 'm', add);
  const view = projectTerror(result.state, false);
  assert.deepEqual(view.tokens, [
    { id: 'terror-1', location: 'arrakeen', status: 'placed' },
    { id: 'terror-2', location: 'arrakeen', status: 'placed' },
  ]);
  for (const token of g.moritaniTerror!.tokens) Object.freeze(token);
  Object.freeze(g.moritaniTerror!.tokens);
  Object.freeze(g.moritaniTerror);
  assert.equal(quoteGrummanCollectionAction(g, 'm', add).amount, 4);
});
