import test from 'node:test';
import assert from 'node:assert/strict';
import {
  quoteHomeworldCombatLoss,
  type HomeworldCombatLossContext,
  type HomeworldCombatLossRequest,
} from '../game/homeworld-combat-loss';
import { createHomeworldCustody } from '../game/homeworld-custody';

function fixture(advanced = true) {
  const context: HomeworldCombatLossContext = {
    advanced,
    players: [
      {
        id: 'e',
        faction: 'emperor',
        reserves: 8,
        eliteReserves: 2,
        tanks: 2,
        eliteTanks: 1,
        battleLosses: 4,
        boardForces: { normal: 8, elite: 2 },
      },
      {
        id: 'f',
        faction: 'fremen',
        reserves: 6,
        eliteReserves: 1,
        tanks: 2,
        eliteTanks: 0,
        battleLosses: 1,
        boardForces: { normal: 7, elite: 0 },
      },
      {
        id: 'a',
        faction: 'atreides',
        reserves: 6,
        eliteReserves: 0,
        tanks: 0,
        eliteTanks: 0,
        battleLosses: 0,
        boardForces: { normal: 14, elite: 0 },
      },
    ],
  };
  const custody = createHomeworldCustody(context);
  custody.visitors['homeworld:emperor'] = { f: { normal: 2, elite: 2 } };
  custody.visitors['homeworld:atreides'] = { f: { normal: 1, elite: 0 } };
  return { context, custody };
}
const reload = <T>(value: T): T => JSON.parse(JSON.stringify(value));

void test('Salusa casualties remove exact native counters and preserve Kaitain, visitors and board armies', () => {
  const { context, custody } = fixture();
  // A previous transfer put one normal defender on Salusa.
  custody.salusa!.normal = 1;
  const before = structuredClone({ context, custody });
  const quote = quoteHomeworldCombatLoss(context, custody, {
    location: 'homeworld:emperor:salusa',
    player: 'e',
    losses: { normal: 1, elite: 1 },
  });
  assert.deepEqual({ context, custody }, before);
  assert.deepEqual(quote.receipt, {
    location: 'homeworld:emperor:salusa',
    player: 'e',
    before: { normal: 1, elite: 2 },
    after: { normal: 0, elite: 1 },
    losses: { normal: 1, elite: 1 },
  });
  assert.deepEqual(quote.players[0], {
    ...context.players[0],
    reserves: 6,
    eliteReserves: 1,
    tanks: 4,
    eliteTanks: 2,
    battleLosses: 6,
  });
  assert.deepEqual(quote.custody.visitors, custody.visitors);
  assert.deepEqual(quote.players.slice(1), context.players.slice(1));
  // Result and receipt must not share nested pools with callers or each other.
  quote.custody.salusa!.elite = 0;
  quote.players[1].boardForces.normal = 0;
  quote.receipt.losses.elite = 0;
  assert.deepEqual({ context, custody }, before);
  assert.equal(quote.receipt.after.elite, 1);
});

void test('visitor wipe goes to its own Tanks, preserves native reserves and other visitor locations, and survives JSON', () => {
  const { context, custody } = reload(fixture());
  const request = {
    location: 'homeworld:emperor',
    player: 'f',
    losses: { normal: 2, elite: 2 },
  };
  const quote = quoteHomeworldCombatLoss(context, custody, request);
  assert.equal(quote.custody.visitors['homeworld:emperor'], undefined);
  assert.deepEqual(
    quote.custody.visitors['homeworld:atreides'],
    custody.visitors['homeworld:atreides'],
  );
  assert.deepEqual(quote.players[0], context.players[0]);
  assert.deepEqual(quote.players[1], {
    ...context.players[1],
    tanks: 6,
    eliteTanks: 2,
    battleLosses: 5,
  });
  assert.deepEqual(reload(quote), quote);
  const next = quoteHomeworldCombatLoss(
    { advanced: true, players: reload(quote.players) },
    reload(quote.custody),
    {
      location: 'homeworld:atreides',
      player: 'f',
      losses: { normal: 1, elite: 0 },
    },
  );
  assert.equal(next.players[1].tanks, 7);
  assert.deepEqual(next.custody.visitors, {});
});

void test('Basic native casualty choices preserve star identity and permit a zero-loss quote', () => {
  const { context, custody } = fixture(false);
  const quote = quoteHomeworldCombatLoss(context, custody, {
    location: 'homeworld:emperor',
    player: 'e',
    losses: { normal: 1, elite: 2 },
  });
  assert.equal(quote.custody.salusa, null);
  assert.equal(quote.players[0].eliteReserves, 0);
  assert.equal(quote.players[0].eliteTanks, 3);
  assert.equal(quote.players[0].reserves, 5);
  const zero = quoteHomeworldCombatLoss(context, custody, {
    location: 'homeworld:emperor',
    player: 'e',
    losses: { normal: 0, elite: 0 },
  });
  assert.deepEqual(zero.players, context.players);
  assert.deepEqual(zero.custody, custody);
});

void test('rejects wrong location, player, force types and malformed losses without changing inputs', () => {
  const { context, custody } = fixture();
  const baseline = structuredClone({ context, custody });
  const requests: unknown[] = [
    { location: 'arrakeen:10', player: 'e', losses: { normal: 1, elite: 0 } },
    {
      location: 'homeworld:emperor:0',
      player: 'e',
      losses: { normal: 1, elite: 0 },
    },
    {
      location: 'homeworld:emperor',
      player: 'missing',
      losses: { normal: 0, elite: 0 },
    },
    {
      location: 'homeworld:emperor',
      player: 'a',
      losses: { normal: 1, elite: 0 },
    },
    {
      location: 'homeworld:emperor',
      player: 'e',
      losses: { normal: 0, elite: 1 },
    },
    ...[
      { normal: -1, elite: 0 },
      { normal: 0.5, elite: 0 },
      { normal: 0, elite: 3 },
      { normal: 0, elite: 1, total: 1 },
      { normal: 0, elite: NaN },
      null,
      [0, 1],
    ].map((losses) => ({
      location: 'homeworld:emperor:salusa',
      player: 'e',
      losses,
    })),
  ];
  for (const request of requests) {
    assert.throws(() =>
      quoteHomeworldCombatLoss(
        context,
        custody,
        request as HomeworldCombatLossRequest,
      ),
    );
    assert.deepEqual({ context, custody }, baseline);
  }
});

void test('rejects missing or duplicated counters anywhere, wrong star custody and invalid loss history', () => {
  const mutations: ((state: ReturnType<typeof fixture>) => void)[] = [
    ({ context }) => {
      context.players[0].boardForces.normal++;
    },
    ({ context }) => {
      context.players[2].boardForces.normal--;
    },
    ({ custody }) => {
      custody.visitors['homeworld:atreides'].f.normal++;
    },
    ({ context }) => {
      context.players[0].boardForces.normal++;
      context.players[0].boardForces.elite--;
    },
    ({ context }) => {
      context.players[0].eliteTanks = 3;
    },
    ({ context }) => {
      context.players[0].battleLosses = -1;
    },
    ({ context }) => {
      context.players[0].battleLosses = Number.MAX_SAFE_INTEGER;
    },
    ({ custody }) => {
      custody.salusa!.elite = 3;
    },
  ];
  for (const mutate of mutations) {
    const state = fixture();
    mutate(state);
    const before = structuredClone(state);
    assert.throws(() =>
      quoteHomeworldCombatLoss(state.context, state.custody, {
        location: 'homeworld:emperor:salusa',
        player: 'e',
        losses: { normal: 0, elite: 1 },
      }),
    );
    assert.deepEqual(state, before);
  }
});
