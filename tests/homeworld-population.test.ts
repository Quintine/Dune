import test from 'node:test';
import assert from 'node:assert/strict';
import { HOMEWORLD_CARDS } from '../game/homeworld-cards';
import {
  createHomeworldCustody,
  quoteHomeworldCustody,
  type HomeworldCustodyContext,
} from '../game/homeworld-custody';
import { homeworldPopulations } from '../game/homeworld-population';

void test('all 13 worlds project both population boundaries with native bonuses and printed occupied income', () => {
  for (const card of HOMEWORLD_CARDS) {
    for (const count of [
      0,
      card.high.reserves.min - 1,
      card.high.reserves.min,
      card.high.reserves.max,
    ]) {
      const context: HomeworldCustodyContext = {
        advanced: card.id === 'salusa_secundus',
        players: [
          {
            id: 'native',
            faction: card.faction,
            reserves: count,
            eliteReserves: card.id === 'salusa_secundus' ? count : 0,
          },
          {
            id: 'other',
            faction: card.faction === 'atreides' ? 'guild' : 'atreides',
            reserves: 20,
            eliteReserves: 0,
          },
        ],
      };
      const custody = createHomeworldCustody(context);
      const before = JSON.stringify({ context, custody });
      const actual = homeworldPopulations(context, custody).find(
        (p) => p.card === card.id,
      )!;
      const high = count >= card.high.reserves.min;
      assert.equal(actual.population, count, card.id);
      assert.equal(actual.side, high ? 'high' : 'low', card.id);
      assert.equal(
        actual.nativeBattleStrength,
        card[high ? 'high' : 'low'].battleStrength,
      );
      assert.equal(actual.printedOccupiedSpice, card.occupied.spiceIcons);
      assert.equal(
        actual.extraFreeRevival,
        high || card.id === 'salusa_secundus' ? 0 : 1,
      );
      assert.equal(actual.extraCharity, actual.extraFreeRevival);
      assert.equal(JSON.stringify({ context, custody }), before);
    }
  }
});

void test('Emperor movement counts all Kaitain native forces but only Sardaukar on Salusa', () => {
  const context: HomeworldCustodyContext = {
    advanced: true,
    players: [
      { id: 'e', faction: 'emperor', reserves: 8, eliteReserves: 2 },
      { id: 'a', faction: 'atreides', reserves: 20, eliteReserves: 0 },
    ],
  };
  const custody = createHomeworldCustody(context);
  const transfer = quoteHomeworldCustody(context, custody, [
    {
      homeworld: 'homeworld:emperor',
      player: 'e',
      withdraw: { normal: 3, elite: 0 },
      deposit: { normal: 0, elite: 1 },
    },
    {
      homeworld: 'homeworld:emperor:salusa',
      player: 'e',
      withdraw: { normal: 0, elite: 1 },
      deposit: { normal: 3, elite: 0 },
    },
  ]);
  const views = homeworldPopulations(
    { advanced: true, players: transfer.players },
    transfer.state,
  );
  assert.deepEqual(
    views
      .filter((p) => p.native === 'e')
      .map((p) => [p.card, p.population, p.side, p.nativeBattleStrength]),
    [
      ['kaitain', 4, 'low', 3],
      ['salusa_secundus', 1, 'low', 2],
    ],
  );
  const original = homeworldPopulations(context, custody);
  assert.equal(
    original.find((p) => p.card === 'salusa_secundus')!.side,
    'high',
    'two Sardaukar selects high despite printed overlap',
  );
});

void test('foreign armies do not raise native population and Basic starred counters retain identity', () => {
  const context: HomeworldCustodyContext = {
    advanced: false,
    players: [
      { id: '__proto__', faction: 'fremen', reserves: 3, eliteReserves: 3 },
      { id: 'h', faction: 'harkonnen', reserves: 6, eliteReserves: 0 },
    ],
  };
  const moved = quoteHomeworldCustody(
    context,
    createHomeworldCustody(context),
    [
      {
        homeworld: 'homeworld:fremen',
        player: '__proto__',
        withdraw: { normal: 0, elite: 1 },
        deposit: { normal: 0, elite: 0 },
      },
      {
        homeworld: 'homeworld:harkonnen',
        player: '__proto__',
        withdraw: { normal: 0, elite: 0 },
        deposit: { normal: 0, elite: 1 },
      },
    ],
  );
  const nextContext = { advanced: false, players: moved.players };
  Object.defineProperty(nextContext.players[0], 'hand', {
    get() {
      throw new Error('private hand accessed');
    },
  });
  const views = homeworldPopulations(nextContext, moved.state);
  assert.equal(views.length, 2);
  assert.equal(
    views.find((p) => p.card === 'southern_hemisphere')!.population,
    2,
  );
  assert.equal(views.find((p) => p.card === 'giedi_prime')!.population, 6);
  assert.ok(views.every((p) => p.side === 'low'));
  assert.ok(views.every((p) => !('occupier' in p)));
  assert.deepEqual(
    homeworldPopulations(
      JSON.parse(JSON.stringify(nextContext)),
      JSON.parse(JSON.stringify(moved.state)),
    ),
    views,
  );
});

void test('population projection rejects corrupt custody rather than masking invalid native counts', () => {
  const context: HomeworldCustodyContext = {
    advanced: true,
    players: [
      { id: 'e', faction: 'emperor', reserves: 3, eliteReserves: 1 },
      { id: 'g', faction: 'guild', reserves: 20, eliteReserves: 0 },
    ],
  };
  assert.throws(
    () =>
      homeworldPopulations(context, {
        visitors: {},
        salusa: { normal: 3, elite: 1 },
      }),
    /within Emperor/,
  );
  assert.throws(
    () =>
      homeworldPopulations(context, {
        visitors: { invented: {} },
        salusa: { normal: 0, elite: 1 },
      }),
    /active Homeworld/,
  );
});
