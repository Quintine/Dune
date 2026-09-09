import test from 'node:test';
import assert from 'node:assert/strict';
import { casualtyOptions, type CombatForces } from '../game/combat';
import {
  stoneBurnerComparison,
  stoneBurnerPlanBlock,
  stoneBurnerCompulsionBlock,
} from '../game/stone-burner';

const mixed: CombatForces = {
  normal: 2,
  elite: 1,
  eliteStrength: 2,
  freeSupport: false,
  eliteFreeSupport: true,
};
const ordinary = (normal: number): CombatForces => ({
  normal,
  elite: 0,
  eliteStrength: 1,
  freeSupport: true,
});

void test('free special counters retain full strength while normal counters need their own support', () => {
  assert.deepEqual(casualtyOptions(mixed, 2, 0), [
    { normal: 0, elite: 1, paidNormal: 0, paidElite: 0 },
  ]);
  assert.deepEqual(casualtyOptions(mixed, 3, 0), [
    { normal: 2, elite: 1, paidNormal: 0, paidElite: 0 },
  ]);
  assert.deepEqual(casualtyOptions(mixed, 3, 1), [
    { normal: 1, elite: 1, paidNormal: 1, paidElite: 0 },
  ]);
  assert.deepEqual(casualtyOptions(mixed, 4, 2), [
    { normal: 2, elite: 1, paidNormal: 2, paidElite: 0 },
  ]);
  assert.deepEqual(casualtyOptions(mixed, 4, 0), []);
  assert.deepEqual(casualtyOptions(mixed, 2, 1), []);
  assert.deepEqual(casualtyOptions(mixed, 4, 3), []);
});

void test('all-special armies never pay support and the strength-one exception remains strength one', () => {
  for (const eliteStrength of [1, 2] as const) {
    const forces = { ...mixed, normal: 0, elite: 3, eliteStrength };
    assert.deepEqual(casualtyOptions(forces, eliteStrength * 3, 0), [
      { normal: 0, elite: 3, paidNormal: 0, paidElite: 0 },
    ]);
    assert.deepEqual(casualtyOptions(forces, eliteStrength * 3, 1), []);
    assert.deepEqual(casualtyOptions(forces, 0.5, 0), []);
  }
  assert.deepEqual(casualtyOptions({ ...mixed, eliteStrength: 1 }, 1, 0), [
    { normal: 2, elite: 0, paidNormal: 0, paidElite: 0 },
    { normal: 0, elite: 1, paidNormal: 0, paidElite: 0 },
  ]);
});

void test('fixed-half normals cannot receive support and whole-army free support remains authoritative', () => {
  for (const freeSupport of [false, true]) {
    const forces = { ...mixed, normalFixedHalf: true, freeSupport };
    assert.deepEqual(casualtyOptions(forces, 3, 0), [
      { normal: 2, elite: 1, paidNormal: 0, paidElite: 0 },
    ]);
    assert.deepEqual(casualtyOptions(forces, 3, 1), []);
  }
  assert.deepEqual(casualtyOptions({ ...mixed, freeSupport: true }, 4, 0), [
    { normal: 2, elite: 1, paidNormal: 0, paidElite: 0 },
  ]);
  assert.deepEqual(casualtyOptions({ ...mixed, freeSupport: true }, 4, 1), []);
});

void test('missing or false flag preserves legacy commitments, while a frozen JSON snapshot preserves accepted free support', () => {
  const legacy = { ...mixed };
  delete legacy.eliteFreeSupport;
  for (let halfDial = 0; halfDial <= 8; halfDial++)
    for (let support = 0; support <= 3; support++)
      assert.deepEqual(
        casualtyOptions(legacy, halfDial / 2, support),
        casualtyOptions(
          { ...legacy, eliteFreeSupport: false },
          halfDial / 2,
          support,
        ),
      );
  const snapshot: CombatForces = Object.freeze(
    JSON.parse(JSON.stringify(mixed)),
  );
  const before = structuredClone(snapshot);
  assert.deepEqual(casualtyOptions(snapshot, 2, 0), [
    { normal: 0, elite: 1, paidNormal: 0, paidElite: 0 },
  ]);
  assert.notDeepEqual(
    casualtyOptions(legacy, 2, 0),
    casualtyOptions(snapshot, 2, 0),
  );
  assert.deepEqual(snapshot, before);
});

void test('malformed restored flags and force counts fail closed before enumeration', () => {
  const invalid = [
    null,
    [],
    ...[
      { eliteFreeSupport: 'true' },
      { eliteFreeSupport: 1 },
      { eliteFreeSupport: null },
      { normal: -1 },
      { normal: Infinity },
      { normal: Number.MAX_SAFE_INTEGER },
      { normal: 20 },
      { elite: 0.5 },
      { eliteStrength: 3 },
      { freeSupport: undefined },
      { normalFixedHalf: 1 },
    ].map((patch) => ({ ...mixed, ...patch })),
  ];
  for (const value of invalid) {
    const forces = value as CombatForces;
    const before = structuredClone(value);
    assert.deepEqual(casualtyOptions(forces, 0, 0), []);
    assert.deepEqual(
      stoneBurnerComparison(forces, 0, 0, ordinary(1), 0, 0).attacker,
      [],
    );
    assert.match(
      stoneBurnerPlanBlock(ordinary(1), 0, 0, forces, 'attacker')!,
      /physical force pools/,
    );
    assert.deepEqual(value, before);
  }
});

void test('Stone Burner compares undialed physical counters under the accepted per-type support rule', () => {
  assert.deepEqual(stoneBurnerComparison(mixed, 3, 1, ordinary(2), 1, 0), {
    winner: 'attacker',
    attacker: [1],
    defender: [1],
  });
  assert.deepEqual(stoneBurnerComparison(mixed, 3, 0, ordinary(2), 1, 0), {
    winner: 'defender',
    attacker: [0],
    defender: [1],
  });
  assert.deepEqual(stoneBurnerComparison(mixed, 2, 1, ordinary(2), 1, 0), {
    winner: null,
    attacker: [],
    defender: [1],
  });
  assert.equal(
    stoneBurnerCompulsionBlock(
      { ...mixed, normal: 0 },
      ordinary(2),
      'attacker',
    ),
    null,
  );
});

void test('Stone Burner preflight cache distinguishes free special support and matches all legal opposing plans', () => {
  let distinct = false;
  for (const normalFixedHalf of [false, true])
    for (const eliteStrength of [1, 2] as const)
      for (let normal = 0; normal <= 4; normal++) {
        const own = ordinary(normal);
        for (let dial = 0; dial <= normal; dial++)
          for (const side of ['attacker', 'defender'] as const) {
            const results: boolean[] = [];
            for (const eliteFreeSupport of [false, true, false, true]) {
              const opponent = Object.freeze({
                ...mixed,
                normal: 3,
                elite: 2,
                normalFixedHalf,
                eliteStrength,
                eliteFreeSupport,
              });
              let ambiguous = false;
              for (let halfDial = 0; halfDial <= 14; halfDial++)
                for (let support = 0; support <= 5; support++) {
                  if (!casualtyOptions(opponent, halfDial / 2, support).length)
                    continue;
                  const result =
                    side === 'attacker'
                      ? stoneBurnerComparison(
                          own,
                          dial,
                          0,
                          opponent,
                          halfDial / 2,
                          support,
                        )
                      : stoneBurnerComparison(
                          opponent,
                          halfDial / 2,
                          support,
                          own,
                          dial,
                          0,
                        );
                  if (result.winner === null) ambiguous = true;
                }
              const blocked =
                stoneBurnerPlanBlock(
                  own,
                  dial,
                  0,
                  JSON.parse(JSON.stringify(opponent)),
                  side,
                ) !== null;
              assert.equal(
                blocked,
                ambiguous,
                JSON.stringify({ opponent, normal, dial, side }),
              );
              results.push(blocked);
            }
            assert.equal(results[0], results[2]);
            assert.equal(results[1], results[3]);
            distinct ||= results[0] !== results[1];
          }
      }
  assert.equal(
    distinct,
    true,
    'At least one legal-plan frontier must differ with elite free support.',
  );
});
