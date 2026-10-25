import test from 'node:test';
import assert from 'node:assert/strict';
import { newPlayer, type Game } from '../game/engine';
import { createHomeworldCustody, quoteHomeworldCustody } from '../game/homeworld-custody';
import { homeworldContext } from '../game/homeworld-game';
import {
  ixHomeworldRevivalEnabled, quoteIxSuboidBonus, IxHomeworldRevivalError,
  type IxSuboidBonusInput,
} from '../game/ix-homeworld-revival';

/** Controlled physical population context, not an earned game chronology. */
function populationContext(population = 5, advanced = false): Pick<Game, 'advanced' | 'players' | 'homeworlds'> {
  const players = [newPlayer('ix', 'Ixians', 'ixians'), newPlayer('other', 'Guild', 'guild')];
  const native = players[0];
  native.reserves = population;
  native.tanks = 20 - population;
  native.elites!.reserves = Math.min(population, 2);
  native.elites!.tanks = 7 - native.elites!.reserves;
  return { advanced, players, homeworlds: { custody: createHomeworldCustody(homeworldContext({ advanced, players })) } };
}

void test('native Ix High activates at five current counters in Basic and Advanced without another gate', () => {
  for (const advanced of [false, true]) for (const population of [0, 4, 5, 6, 14]) {
    const context = populationContext(population, advanced), before = structuredClone(context);
    assert.equal(ixHomeworldRevivalEnabled(context, 'ix'), population >= 5);
    assert.deepEqual(context, before);
  }
});

void test('absent Homeworld custody and nonnative viewers do not receive the Ix revival benefit', () => {
  const context = populationContext();
  assert.equal(ixHomeworldRevivalEnabled(context, 'other'), false);
  assert.equal(ixHomeworldRevivalEnabled(context, 'missing'), false);
  assert.equal(ixHomeworldRevivalEnabled({ ...context, homeworlds: undefined }, 'ix'), false);
  assert.equal(ixHomeworldRevivalEnabled({ ...context, homeworlds: { custody: null } }, 'ix'), false);
});

void test('foreign visitors do not raise Ix population and native counters visiting elsewhere do not count', () => {
  const context = populationContext(4);
  const visit = quoteHomeworldCustody(homeworldContext(context), context.homeworlds!.custody!, [
    { homeworld: 'homeworld:guild', player: 'other', withdraw: { normal: 8, elite: 0 }, deposit: { normal: 0, elite: 0 } },
    { homeworld: 'homeworld:ixians', player: 'other', withdraw: { normal: 0, elite: 0 }, deposit: { normal: 8, elite: 0 } },
  ]);
  for (const next of visit.players) context.players.find(player => player.id === next.id)!.reserves = next.reserves;
  context.homeworlds!.custody = visit.state;
  assert.equal(ixHomeworldRevivalEnabled(context, 'ix'), false);
  assert.equal(ixHomeworldRevivalEnabled(context, 'other'), false);

  const high = populationContext(5);
  const departed = quoteHomeworldCustody(homeworldContext(high), high.homeworlds!.custody!, [
    { homeworld: 'homeworld:ixians', player: 'ix', withdraw: { normal: 1, elite: 0 }, deposit: { normal: 0, elite: 0 } },
    { homeworld: 'homeworld:guild', player: 'ix', withdraw: { normal: 0, elite: 0 }, deposit: { normal: 1, elite: 0 } },
  ]);
  for (const next of departed.players) high.players.find(player => player.id === next.id)!.reserves = next.reserves;
  high.homeworlds!.custody = departed.state;
  assert.equal(ixHomeworldRevivalEnabled(high, 'ix'), false);
});

const group = (patch: Partial<IxSuboidBonusInput> = {}): IxSuboidBonusInput => ({
  enabled: true, amount: 1, elite: 1, free: 0, freeElite: 0, normalTanks: 6, ...patch,
});

void test('each paid Cyborg adds two physical Suboids while free Cyborgs and ordinary returns add none', () => {
  assert.equal(quoteIxSuboidBonus(group()), 2);
  assert.equal(quoteIxSuboidBonus(group({ amount: 2, elite: 2 })), 4);
  assert.equal(quoteIxSuboidBonus(group({ amount: 1, elite: 1, free: 1, freeElite: 1 })), 0);
  assert.equal(quoteIxSuboidBonus(group({ amount: 3, elite: 0, free: 1, normalTanks: 6 })), 0);
  assert.equal(quoteIxSuboidBonus(group({ enabled: false })), 0);
});

void test('mixed free type allocation counts only paid Cyborgs and reserves the declared ordinary returns first', () => {
  const input = group({ amount: 4, elite: 3, free: 2, freeElite: 1, normalTanks: 7 });
  const before = structuredClone(input);
  assert.equal(quoteIxSuboidBonus(input), 4);
  assert.deepEqual(input, before);
  assert.equal(quoteIxSuboidBonus(group({ amount: 3, elite: 2, free: 1, freeElite: 0, normalTanks: 5 })), 4);
  assert.equal(quoteIxSuboidBonus(group({ amount: 4, elite: 2, free: 1, freeElite: 1, normalTanks: 5 })), 2);
});

void test('physical Suboid shortages give a partial or zero bonus without replacing the declared group', () => {
  assert.equal(quoteIxSuboidBonus(group({ normalTanks: 1 })), 1);
  assert.equal(quoteIxSuboidBonus(group({ normalTanks: 0 })), 0);
  assert.equal(quoteIxSuboidBonus(group({ amount: 3, elite: 1, normalTanks: 3 })), 1);
  assert.equal(quoteIxSuboidBonus(group({ amount: 3, elite: 1, normalTanks: 2 })), 0);
  assert.equal(quoteIxSuboidBonus(group({ amount: 20, elite: 7, free: 1, normalTanks: 13 })), 0);
});

void test('malformed counts and impossible free type allocations reject even when the benefit is disabled', () => {
  const invalid: Partial<IxSuboidBonusInput>[] = [
    { amount: 0 }, { amount: 21 }, { elite: 2 }, { free: 2 },
    { freeElite: 1 }, { amount: 2, elite: 0, free: 1, freeElite: 1 },
    { amount: 2, elite: 2, free: 1, freeElite: 0 },
    { amount: 3, elite: 1, normalTanks: 1 },
  ];
  for (const field of ['amount', 'elite', 'free', 'freeElite', 'normalTanks'] as const)
    for (const value of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) invalid.push({ [field]: value });
  for (const enabled of [false, true]) for (const patch of invalid) {
    const input = group({ ...patch, enabled }), before = structuredClone(input);
    assert.throws(() => quoteIxSuboidBonus(input), IxHomeworldRevivalError);
    assert.deepEqual(input, before);
  }
  assert.throws(() => quoteIxSuboidBonus({ ...group(), enabled: 'yes' as unknown as boolean }), IxHomeworldRevivalError);
});
