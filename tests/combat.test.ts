import test from 'node:test';
import assert from 'node:assert/strict';
import { casualtyOptions, type CombatForces } from '../game/combat';

void test('printed advanced battle example permits retaining either ordinary or elite forces', () => {
  const options = casualtyOptions(
    { normal: 5, elite: 1, eliteStrength: 2, freeSupport: false },
    3,
    1,
  );
  assert.ok(
    options.some((o) => o.normal === 2 && o.elite === 1 && o.paidElite === 1),
  );
  assert.ok(
    options.some((o) => o.normal === 5 && o.elite === 0 && o.paidNormal === 1),
  );
});
void test('unsupported strength, Fremen exemption, and Sardaukar versus Fremen remain distinct', () => {
  assert.deepEqual(
    casualtyOptions(
      { normal: 10, elite: 0, eliteStrength: 2, freeSupport: false },
      4,
      2,
    ),
    [{ normal: 6, elite: 0, paidNormal: 2, paidElite: 0 }],
  );
  const fremen: CombatForces = {
    normal: 4,
    elite: 3,
    eliteStrength: 2,
    freeSupport: true,
  };
  assert.ok(
    casualtyOptions(fremen, 4, 0).some((o) => o.elite === 2 && o.normal === 0),
  );
  assert.deepEqual(casualtyOptions(fremen, 3.5, 0), []);
  assert.deepEqual(casualtyOptions(fremen, 4, 1), []);
  assert.deepEqual(
    casualtyOptions(
      { normal: 0, elite: 1, eliteStrength: 1, freeSupport: false },
      2,
      1,
    ),
    [],
  );
  assert.equal(
    casualtyOptions(
      { normal: 0, elite: 1, eliteStrength: 1, freeSupport: false },
      1,
      1,
    ).length,
    1,
  );
});
void test('casualty solver matches exhaustive independent token assignments', () => {
  for (const eliteStrength of [1, 2] as const)
    for (let support = 0; support <= 5; support++)
      for (let halfDial = 0; halfDial <= 14; halfDial++) {
        const brute = new Set<string>();
        for (let code = 0; code < 3 ** 5; code++) {
          let remaining = code,
            paid = 0,
            half = 0,
            normal = 0,
            elite = 0;
          for (let token = 0; token < 5; token++) {
            const state = remaining % 3;
            remaining = Math.floor(remaining / 3);
            if (!state) continue;
            const value = token < 3 ? 1 : eliteStrength;
            half += value * state;
            if (state === 2) paid++;
            if (token < 3) normal++;
            else elite++;
          }
          if (paid === support && half === halfDial)
            brute.add(`${normal}:${elite}`);
        }
        const actual = new Set(
          casualtyOptions(
            { normal: 3, elite: 2, eliteStrength, freeSupport: false },
            halfDial / 2,
            support,
          ).map((o) => `${o.normal}:${o.elite}`),
        );
        assert.deepEqual(
          actual,
          brute,
          `${eliteStrength}/${halfDial}/${support}`,
        );
      }
});
