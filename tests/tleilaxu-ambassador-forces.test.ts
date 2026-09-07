import test from 'node:test';
import assert from 'node:assert/strict';
import { FACTIONS } from '../game/catalog';
import {
  quoteTleilaxuAmbassadorForces as quote,
  TleilaxuAmbassadorForceError,
  type TleilaxuAmbassadorForceContext as Context,
} from '../game/tleilaxu-ambassador-forces';

const ordinary = (): Context => ({ faction: 'ecaz', reserves: 12, tanks: 8 });
const typed = (
  faction: 'fremen' | 'emperor' | 'ixians' = 'fremen',
): Context => ({
  faction,
  reserves: 12,
  tanks: 8,
  elites: { reserves: 1, tanks: 3, revived: 0 },
});
function reject(player: Context, amount = 1, elite?: number) {
  const before = structuredClone(player);
  assert.throws(
    () => quote(player, amount, elite),
    TleilaxuAmbassadorForceError,
  );
  assert.deepEqual(player, before);
}
void test('all twelve factions can return one through four ordinary physical forces without normal-rate or quota inputs', () => {
  for (const { id } of FACTIONS)
    for (const amount of [1, 2, 3, 4]) {
      const player = { ...ordinary(), faction: id };
      const before = structuredClone(player);
      const result = quote(player, amount);
      assert.deepEqual(result, {
        amount,
        ordinary: amount,
        elite: 0,
        before: { reserves: 12, tanks: 8, eliteReserves: 0, eliteTanks: 0 },
        after: {
          reserves: 12 + amount,
          tanks: 8 - amount,
          eliteReserves: 0,
          eliteTanks: 0,
        },
        eliteRevivedNext: 0,
      });
      assert.deepEqual(player, before);
    }
});
void test('mixed force selection conserves ordinary and elite custody and uses only necessary elites by default', () => {
  const player: Context = {
    faction: 'fremen',
    reserves: 16,
    tanks: 4,
    elites: { reserves: 2, tanks: 1, revived: 0 },
  };
  assert.equal(quote(player, 3).elite, 0);
  assert.equal(quote(player, 4).elite, 1);
  const result = quote(player, 2, 1);
  assert.equal(result.ordinary, 1);
  assert.equal(result.eliteRevivedNext, 1);
  assert.equal(
    result.before.reserves + result.before.tanks,
    result.after.reserves + result.after.tanks,
  );
  assert.equal(
    result.before.eliteReserves + result.before.eliteTanks,
    result.after.eliteReserves + result.after.eliteTanks,
  );
  reject(player, 4, 0);
  reject(player, 2, 2);
});
void test('Fedaykin and Sardaukar share their existing elite turn usage across independent returns', () => {
  for (const faction of ['fremen', 'emperor'] as const) {
    const first = quote(typed(faction), 4, 1);
    const next: Context = {
      faction,
      reserves: first.after.reserves,
      tanks: first.after.tanks,
      elites: {
        reserves: first.after.eliteReserves,
        tanks: first.after.eliteTanks,
        revived: first.eliteRevivedNext,
      },
    };
    reject(next, 1, 1);
    assert.equal(quote(next, 1, 0).eliteRevivedNext, 1);
    reject(typed(faction), 2, 2);
  }
});
void test('the automatic minimum elite selection cannot bypass already exhausted turn usage', () => {
  const player: Context = {
    faction: 'fremen',
    reserves: 16,
    tanks: 4,
    elites: { reserves: 2, tanks: 3, revived: 1 },
  };
  reject(player, 2);
  assert.equal(quote(player, 1).elite, 0);
});
void test('Ixian cyborgs count once and are not subject to the Sardaukar or Fedaykin cap', () => {
  const player: Context = {
    faction: 'ixians',
    reserves: 16,
    tanks: 4,
    elites: { reserves: 3, tanks: 4, revived: 3 },
  };
  const result = quote(player, 4);
  assert.equal(result.elite, 4);
  assert.equal(result.ordinary, 0);
  assert.equal(result.after.reserves, 20);
  assert.equal(result.after.eliteReserves, 7);
  assert.equal(result.eliteRevivedNext, 7);
});
void test('missing elite state permits ordinary returns but cannot supply a selected elite', () => {
  for (const faction of ['ecaz', 'fremen', 'emperor', 'ixians'] as const) {
    const player = { ...ordinary(), faction };
    assert.equal(quote(player, 4).elite, 0);
    reject(player, 1, 1);
  }
});
void test('malformed amounts, elite selections and empty Tanks reject rather than coercing or clamping', () => {
  for (const value of [
    -1,
    0,
    5,
    9,
    1.5,
    NaN,
    Infinity,
    Number.MAX_SAFE_INTEGER + 1,
    '1',
    null,
  ])
    reject(ordinary(), value as number);
  reject({ ...ordinary(), tanks: 0 });
  for (const value of [
    -1,
    1.5,
    NaN,
    Infinity,
    Number.MAX_SAFE_INTEGER + 1,
    '1',
    false,
    null,
  ])
    reject(typed(), 1, value as number);
});
void test('invalid before custody, unsupported elite factions and unsafe numeric inventories reject', () => {
  for (const value of [
    -1,
    1.5,
    NaN,
    Infinity,
    Number.MAX_SAFE_INTEGER + 1,
    '2',
    null,
  ]) {
    for (const field of ['reserves', 'tanks'] as const)
      reject({ ...ordinary(), [field]: value } as Context);
    for (const field of ['reserves', 'tanks', 'revived'] as const)
      reject({
        ...typed(),
        elites: { ...typed().elites!, [field]: value },
      } as Context);
  }
  reject({ ...typed(), elites: { reserves: 13, tanks: 3, revived: 0 } });
  reject({ ...typed(), elites: { reserves: 1, tanks: 9, revived: 0 } });
  reject({ ...typed(), faction: 'ecaz' });
  reject({ ...ordinary(), elites: null } as unknown as Context);
  reject({ ...ordinary(), elites: [] } as unknown as Context);
  reject({ ...ordinary(), faction: 'unknown' } as unknown as Context);
});
void test('unsafe post-return reserves and elite usage reject while safe boundaries stay exact', () => {
  const max = Number.MAX_SAFE_INTEGER;
  reject({ ...ordinary(), reserves: max }, 1);
  reject(
    { ...typed('ixians'), elites: { reserves: 1, tanks: 3, revived: max } },
    1,
    1,
  );
  assert.equal(
    quote({ ...ordinary(), reserves: max - 1 }, 1).after.reserves,
    max,
  );
  assert.equal(
    quote(
      {
        ...typed('ixians'),
        elites: { reserves: 1, tanks: 3, revived: max - 1 },
      },
      1,
      1,
    ).eliteRevivedNext,
    max,
  );
});
void test('quotes are detached and cannot mutate their input or later quotes', () => {
  const player = typed();
  const before = structuredClone(player);
  const first = quote(player, 4, 1);
  first.before.tanks = 100;
  first.after.eliteTanks = 100;
  assert.deepEqual(player, before);
  assert.equal(quote(player, 4, 1).before.tanks, 8);
  assert.equal(quote(player, 4, 1).after.eliteTanks, 2);
});
void test('only physical inputs are read; private data, ordinary allowances and random state are irrelevant', () => {
  const base = typed('ixians');
  const guarded = new Proxy(base, {
    get(target, key, receiver) {
      assert.ok(
        ['faction', 'reserves', 'tanks', 'elites'].includes(String(key)),
        String(key),
      );
      return Reflect.get(target, key, receiver);
    },
  });
  const random = Math.random;
  try {
    Math.random = () => {
      throw new Error('Randomness is not part of a physical return quote');
    };
    const expected = quote(base, 4, 2);
    for (let i = 0; i < 5; i++)
      assert.deepEqual(quote(guarded, 4, 2), expected);
  } finally {
    Math.random = random;
  }
});
