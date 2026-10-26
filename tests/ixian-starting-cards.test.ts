import assert from 'node:assert/strict';
import test from 'node:test';
import {
  IxStartingCardError,
  ixStartingCardDealPlan,
  ixStartingCardPoolSize,
  type IxStartingCardGame,
} from '../game/ixian-starting-cards';

function game(advanced: boolean, factions: readonly string[]): IxStartingCardGame {
  return { advanced, players: factions.map((faction, index) => ({ id: `seat-${index}`, faction })) };
}
const otherFactions = ['atreides', 'emperor', 'guild', 'fremen'] as const;

void test('fresh Ix pools add Harkonnen only in Advanced, from two through six seats', () => {
  for (let count = 2; count <= 6; count++) {
    for (const advanced of [false, true]) {
      const harkonnen = game(advanced, ['ixians', 'harkonnen', ...otherFactions.slice(0, count - 2)]);
      assert.equal(ixStartingCardPoolSize(harkonnen), count + (advanced ? 1 : 0));
      const ordinary = game(advanced, ['ixians', ...otherFactions, 'beneGesserit'].slice(0, count));
      assert.equal(ixStartingCardPoolSize(ordinary), count);
    }
  }
});

void test('new Advanced pools deal Harkonnen two from the shuffled remainder in original seat order', () => {
  for (let count = 2; count <= 6; count++) {
    for (const ixFirst of [false, true]) {
      const factions = ixFirst ? ['ixians', 'harkonnen'] : ['harkonnen', 'ixians'];
      const native = game(true, [...factions, ...otherFactions.slice(0, count - 2)]);
      const before = structuredClone(native);
      Object.freeze(native.players);
      Object.freeze(native);
      const plan = ixStartingCardDealPlan(native, count + 1);
      assert.deepEqual(plan, {
        kind: 'advanced-pool',
        seats: native.players.filter(player => player.faction !== 'ixians').map(player => ({
          player: player.id, amount: player.faction === 'harkonnen' ? 2 : 1,
        })),
        deckBonus: null,
      });
      assert.equal(plan.seats.reduce((amount, seat) => amount + seat.amount, 0), count);
      assert.deepEqual(native, before);
      plan.seats[0].amount = 99;
      assert.deepEqual(native, before);
    }
  }
});

void test('Basic and old Advanced N-card or short pools keep one-per-other then the Harkonnen deck bonus', () => {
  for (let count = 2; count <= 6; count++) {
    for (const advanced of [false, true]) {
      const native = game(advanced, ['harkonnen', ...otherFactions.slice(0, count - 2), 'ixians']);
      for (const poolCount of new Set([1, count - 1, count])) {
        assert.deepEqual(ixStartingCardDealPlan(native, poolCount), {
          kind: 'legacy-deck-bonus',
          seats: native.players.filter(player => player.faction !== 'ixians').map(player => ({ player: player.id, amount: 1 })),
          deckBonus: 'seat-0',
        });
      }
    }
  }
});

void test('without Harkonnen both modes deal one per other seat with no extra deck draw', () => {
  for (const advanced of [false, true]) {
    const native = game(advanced, ['atreides', 'ixians', 'fremen', 'guild']);
    for (const count of [1, 3, 4]) {
      assert.deepEqual(ixStartingCardDealPlan(native, count), {
        kind: 'legacy-deck-bonus',
        seats: [{ player: 'seat-0', amount: 1 }, { player: 'seat-2', amount: 1 }, { player: 'seat-3', amount: 1 }],
        deckBonus: null,
      });
    }
  }
});

void test('a pool larger than its native source or an invalid count cannot select a new deal mode', () => {
  const advanced = game(true, ['ixians', 'harkonnen']);
  const basic = game(false, ['ixians', 'harkonnen']);
  const noHarkonnen = game(true, ['ixians', 'atreides']);
  for (const count of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1, 4])
    assert.throws(() => ixStartingCardDealPlan(advanced, count), IxStartingCardError);
  assert.throws(() => ixStartingCardDealPlan(basic, 3), IxStartingCardError);
  assert.throws(() => ixStartingCardDealPlan(noHarkonnen, 3), IxStartingCardError);
});

void test('the planner rejects missing Ixians, unregistered or duplicate seats and invalid native roster bounds', () => {
  const valid = game(true, ['ixians', 'harkonnen']);
  const invalid: unknown[] = [
    null,
    { ...valid, advanced: 'advanced' },
    { ...valid, players: undefined },
    game(true, ['ixians']),
    game(true, ['ixians', 'harkonnen', ...otherFactions, 'beneGesserit']),
    game(true, ['atreides', 'harkonnen']),
    game(true, ['ixians', 'ixians']),
    game(true, ['ixians', 'unknown']),
    { ...valid, players: [{ id: 'seat', faction: 'ixians' }, { id: 'seat', faction: 'harkonnen' }] },
    { ...valid, players: [{ id: '', faction: 'ixians' }, valid.players[1]] },
    { ...valid, players: [valid.players[0], { id: ' seat ', faction: 'harkonnen' }] },
  ];
  for (const native of invalid) {
    assert.throws(() => ixStartingCardPoolSize(native as IxStartingCardGame), IxStartingCardError);
    assert.throws(() => ixStartingCardDealPlan(native as IxStartingCardGame, 2), IxStartingCardError);
  }
});
