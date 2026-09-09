import test from 'node:test';
import assert from 'node:assert/strict';
import { newPlayer } from '../game/engine';
import type { FactionId } from '../game/catalog';
import { HOMEWORLD_CARDS } from '../game/homeworld-cards';
import { createHomeworldCustody } from '../game/homeworld-custody';
import { homeworldContext } from '../game/homeworld-game';
import {
  HomeworldBenefitError,
  homeworldLowBonus,
  snapshotHomeworldRevival,
  tleilaxuHomeworldFreeIncomeBlocked,
  type HomeworldRevivalOpening,
} from '../game/homeworld-benefits';

function fixture(
  faction: FactionId = 'tleilaxu',
  reserves = 0,
  advanced = true,
) {
  const players = [
    newPlayer('native', 'Native', faction),
    newPlayer('other', 'Other', faction === 'atreides' ? 'guild' : 'atreides'),
  ];
  players[0].reserves = reserves;
  if (players[0].elites) players[0].elites.reserves = 0;
  const base = { advanced, players };
  return {
    ...base,
    turn: 3,
    phase: 4,
    homeworlds: { custody: createHomeworldCustody(homeworldContext(base)) },
    homeworldRevival: null as HomeworldRevivalOpening | null,
  };
}
function frozen<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) frozen(item);
    Object.freeze(value);
  }
  return value;
}
const tlMinimum = HOMEWORLD_CARDS.find((card) => card.id === 'tleilax')!.high
  .reserves.min;

void test('all primary Homeworlds grant exactly one native bonus below their printed minimum in Basic and Advanced', () => {
  for (const card of HOMEWORLD_CARDS.filter(
    (candidate) => candidate.id !== 'salusa_secundus',
  ))
    for (const advanced of [false, true])
      for (const reserves of [
        0,
        card.high.reserves.min - 1,
        card.high.reserves.min,
        20,
      ]) {
        const context = fixture(card.faction, reserves, advanced);
        const before = structuredClone(context);
        assert.equal(
          homeworldLowBonus(context, 'native'),
          reserves < card.high.reserves.min ? 1 : 0,
          `${card.id}/${advanced}/${reserves}`,
        );
        assert.equal(homeworldLowBonus(context, 'missing'), 0);
        assert.deepEqual(context, before);
      }
});

void test('foreign forces neither raise native population nor receive the native bonus', () => {
  const context = fixture('tleilaxu', tlMinimum - 1);
  context.players[1].reserves = 5;
  context.homeworlds.custody.visitors['homeworld:tleilaxu'] = {
    other: { normal: 15, elite: 0 },
  };
  assert.equal(homeworldLowBonus(context, 'native'), 1);
  const ownOther = homeworldLowBonus(context, 'other');
  delete context.homeworlds.custody.visitors['homeworld:tleilaxu'];
  assert.equal(homeworldLowBonus(context, 'native'), 1);
  assert.equal(homeworldLowBonus(context, 'other'), ownOther);
});

void test('low Salusa adds no bonus and Emperor never receives two bonuses when both worlds are low', () => {
  const context = fixture('emperor', 8);
  context.players[0].elites = { reserves: 1, tanks: 0, forces: {}, revived: 0 };
  context.homeworlds.custody.salusa = { normal: 0, elite: 1 };
  assert.equal(homeworldLowBonus(context, 'native'), 0);
  context.players[0].reserves = 3;
  assert.equal(homeworldLowBonus(context, 'native'), 1);
});

void test('absent module or uninitialized custody grants no bonus or revival snapshot without reading other state', () => {
  for (const homeworlds of [undefined, null, { custody: null }]) {
    const context = { ...fixture(), homeworlds };
    Object.defineProperty(context, 'players', {
      get() {
        throw new Error('unneeded roster read');
      },
    });
    assert.equal(homeworldLowBonus(context, 'native'), 0);
    assert.equal(snapshotHomeworldRevival(context), null);
  }
  assert.equal(snapshotHomeworldRevival(fixture('emperor', 4)), null);
});

void test('snapshots record only the seated Tleilaxu opening side, turn and identity across JSON and frozen inputs', () => {
  for (const advanced of [false, true])
    for (const reserves of [tlMinimum - 1, tlMinimum]) {
      const context = frozen(fixture('tleilaxu', reserves, advanced));
      const before = JSON.stringify(context);
      const snapshot = snapshotHomeworldRevival(context);
      assert.deepEqual(snapshot, {
        turn: 3,
        tleilaxu: { player: 'native', low: reserves < tlMinimum },
      });
      assert.deepEqual(snapshotHomeworldRevival(JSON.parse(before)), snapshot);
      assert.equal(JSON.stringify(context), before);
      assert.ok(snapshot);
      snapshot.tleilaxu.low = !snapshot.tleilaxu.low;
      assert.equal(
        JSON.stringify(context),
        before,
        'receipt has no mutable source aliases',
      );
    }
});

void test('the phase-four income gate preserves opening low or high after actual current population crosses either way', () => {
  for (const openingLow of [false, true]) {
    const context = fixture('tleilaxu', openingLow ? tlMinimum - 1 : tlMinimum);
    context.homeworldRevival = snapshotHomeworldRevival(context);
    context.players[0].reserves = openingLow ? tlMinimum : tlMinimum - 1;
    assert.equal(homeworldLowBonus(context, 'native'), openingLow ? 0 : 1);
    assert.equal(
      tleilaxuHomeworldFreeIncomeBlocked(frozen(context)),
      openingLow,
    );
    assert.equal(
      tleilaxuHomeworldFreeIncomeBlocked(JSON.parse(JSON.stringify(context))),
      openingLow,
    );
  }
});

void test('missing, stale and malformed revival receipts throw the dedicated error without mutation or reconstruction', () => {
  const malformed: unknown[] = [
    undefined,
    null,
    false,
    [],
    {},
    { turn: 2, tleilaxu: { player: 'native', low: true } },
    { turn: 4, tleilaxu: { player: 'native', low: true } },
    { turn: '3', tleilaxu: { player: 'native', low: true } },
    { turn: 3, tleilaxu: { player: 'other', low: true } },
    { turn: 3, tleilaxu: { player: '', low: false } },
    { turn: 3, tleilaxu: { player: 'native', low: 1 } },
    { turn: 3, tleilaxu: { player: 'native' } },
    { turn: 3, tleilaxu: null },
    { turn: 3, tleilaxu: { player: 'native', low: true, extra: true } },
    { turn: 3, tleilaxu: { player: 'native', low: true }, extra: true },
  ];
  for (const receipt of malformed) {
    const context = {
      ...fixture(),
      homeworldRevival: receipt as HomeworldRevivalOpening,
    };
    const before = structuredClone(context);
    assert.throws(
      () => tleilaxuHomeworldFreeIncomeBlocked(context),
      HomeworldBenefitError,
    );
    assert.deepEqual(context, before);
  }
  for (const turn of [0, -1, 1.5, NaN, Infinity]) {
    const context = { ...fixture(), turn };
    assert.throws(
      () => snapshotHomeworldRevival(context),
      HomeworldBenefitError,
    );
    assert.throws(
      () => tleilaxuHomeworldFreeIncomeBlocked(context),
      HomeworldBenefitError,
    );
  }
});

void test('outside revival or without module/Tleilaxu the income gate ignores receipts and irrelevant fields', () => {
  for (const phase of [0, 1, 2, 3, 5, 6, 7, 8]) {
    const context = { ...fixture(), phase };
    for (const key of ['players', 'homeworlds', 'homeworldRevival', 'turn'])
      Object.defineProperty(context, key, {
        get() {
          throw new Error('inactive receipt path read');
        },
      });
    assert.equal(tleilaxuHomeworldFreeIncomeBlocked(context), false);
  }
  assert.equal(
    tleilaxuHomeworldFreeIncomeBlocked({ ...fixture(), homeworlds: null }),
    false,
  );
  assert.equal(
    tleilaxuHomeworldFreeIncomeBlocked(fixture('emperor', 4)),
    false,
  );
  assert.throws(
    () =>
      tleilaxuHomeworldFreeIncomeBlocked({
        ...fixture(),
        homeworlds: { custody: null },
      }),
    HomeworldBenefitError,
    'enabled phase-four Tleilaxu cannot reconstruct a missing opening',
  );
});

void test('bonuses and snapshots never read private fields, and the saved income gate does not read current population', () => {
  const context = fixture();
  for (const object of [context, ...context.players])
    for (const key of [
      'hand',
      'deck',
      'traitors',
      'prediction',
      'plans',
      'rng',
    ])
      Object.defineProperty(object, key, {
        get() {
          throw new Error('private field read');
        },
      });
  assert.equal(homeworldLowBonus(context, 'native'), 1);
  context.homeworldRevival = snapshotHomeworldRevival(context);
  for (const player of context.players)
    for (const key of ['reserves', 'elites', 'forces', 'tanks', 'spice'])
      Object.defineProperty(player, key, {
        get() {
          throw new Error('current population read');
        },
      });
  Object.defineProperty(context.homeworlds, 'custody', {
    get() {
      throw new Error('current custody read');
    },
  });
  assert.equal(tleilaxuHomeworldFreeIncomeBlocked(context), true);
});
