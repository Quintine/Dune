import test from 'node:test';
import assert from 'node:assert/strict';
import { casualtyOptions, type CombatForces } from '../game/combat';
import {
  stoneBurnerComparison,
  stoneBurnerPlanBlock,
  stoneBurnerCompulsionBlock,
  type StoneBurnerSide,
} from '../game/stone-burner';

const ordinary = (normal: number, freeSupport = true): CombatForces => ({
  normal,
  elite: 0,
  eliteStrength: 1,
  freeSupport,
});
const emperor: CombatForces = {
  normal: 5,
  elite: 1,
  eliteStrength: 2,
  freeSupport: false,
};

void test('printed Emperor dial3 support1 yields both three and one undialed tokens and can change the winner', () => {
  assert.deepEqual(stoneBurnerComparison(emperor, 3, 1, ordinary(3), 1, 0), {
    winner: null,
    attacker: [1, 2, 3],
    defender: [2],
  });
  assert.match(
    stoneBurnerPlanBlock(emperor, 3, 1, ordinary(3), 'attacker')!,
    /different legal force allocations/,
  );
});

void test('different physical allocations remain legal when every pair gives the same winner, including tie boundaries', () => {
  assert.deepEqual(stoneBurnerComparison(emperor, 3, 1, ordinary(1), 1, 0), {
    winner: 'attacker',
    attacker: [1, 2, 3],
    defender: [0],
  });
  assert.equal(
    stoneBurnerComparison(emperor, 3, 1, ordinary(5), 0, 0).winner,
    'defender',
  );
  assert.equal(
    stoneBurnerComparison(emperor, 3, 1, ordinary(1), 0, 0).winner,
    'attacker',
  );
  assert.equal(
    stoneBurnerComparison(emperor, 3, 1, ordinary(1), 0, 0, 'defender').winner,
    null,
  );
  assert.equal(
    stoneBurnerPlanBlock(emperor, 3, 1, ordinary(0), 'attacker'),
    null,
  );
});

void test('Basic Ix mixed units use physical tokens while Advanced ordinary support does not create spurious ambiguity', () => {
  const ix: CombatForces = {
    normal: 6,
    elite: 2,
    eliteStrength: 2,
    normalFixedHalf: true,
    freeSupport: true,
  };
  assert.deepEqual(stoneBurnerComparison(ix, 2, 0, ordinary(7), 1, 0), {
    winner: null,
    attacker: [4, 7],
    defender: [6],
  });
  assert.match(
    stoneBurnerPlanBlock(ix, 2, 0, ordinary(7), 'attacker')!,
    /allocation timing/,
  );
  assert.deepEqual(
    stoneBurnerComparison(ordinary(10, false), 4, 2, ordinary(6, false), 2, 1),
    { winner: 'attacker', attacker: [4], defender: [3] },
  );
  assert.equal(
    stoneBurnerPlanBlock(
      ordinary(10, false),
      4,
      2,
      ordinary(6, false),
      'attacker',
    ),
    null,
  );
});

void test('aggressor identity determines physical ties independently of card-holder side', () => {
  for (const aggressor of ['attacker', 'defender'] as const) {
    assert.equal(
      stoneBurnerComparison(ordinary(5), 3, 0, ordinary(3), 1, 0, aggressor)
        .winner,
      aggressor,
    );
    for (const side of ['attacker', 'defender'] as const)
      assert.equal(
        stoneBurnerPlanBlock(ordinary(5), 3, 0, ordinary(3), side, aggressor),
        null,
      );
  }
  assert.equal(
    stoneBurnerComparison(ordinary(1), 0, 0, emperor, 3, 1, 'defender').winner,
    'defender',
  );
  assert.equal(
    stoneBurnerComparison(ordinary(1), 0, 0, emperor, 3, 1, 'attacker').winner,
    null,
  );
});

void test('preflight matches an exhaustive public opposing-plan oracle for all force modes and both roles', () => {
  for (const freeSupport of [true, false])
    for (const normalFixedHalf of [true, false])
      for (const eliteStrength of [1, 2] as const) {
        const opponent: CombatForces = {
          normal: 3,
          elite: 2,
          eliteStrength,
          freeSupport,
          normalFixedHalf,
        };
        const own = ordinary(4, false);
        for (const side of ['attacker', 'defender'] as const)
          for (const aggressor of ['attacker', 'defender'] as const) {
            let ambiguous = false;
            for (let halfDial = 0; halfDial <= 14; halfDial++)
              for (let support = 0; support <= 5; support++) {
                if (!casualtyOptions(opponent, halfDial / 2, support).length)
                  continue;
                const comparison =
                  side === 'attacker'
                    ? stoneBurnerComparison(
                        own,
                        2,
                        0,
                        opponent,
                        halfDial / 2,
                        support,
                        aggressor,
                      )
                    : stoneBurnerComparison(
                        opponent,
                        halfDial / 2,
                        support,
                        own,
                        2,
                        0,
                        aggressor,
                      );
                if (comparison.winner === null) ambiguous = true;
              }
            assert.equal(
              stoneBurnerPlanBlock(own, 2, 0, opponent, side, aggressor) !==
                null,
              ambiguous,
              JSON.stringify({ opponent, side, aggressor }),
            );
          }
      }
});

void test('no hidden budget or selected opponent plan enters preflight and cached repeated JSON inputs remain immutable', () => {
  const own = ordinary(3),
    opponent = { ...emperor };
  const original = structuredClone({ own, opponent });
  const block = stoneBurnerPlanBlock(own, 1, 0, opponent, 'attacker');
  assert.ok(block);
  for (let i = 0; i < 10; i++)
    assert.equal(
      stoneBurnerPlanBlock(
        JSON.parse(JSON.stringify(own)),
        1,
        0,
        JSON.parse(JSON.stringify(opponent)),
        'attacker',
      ),
      block,
    );
  const comparison = stoneBurnerComparison(emperor, 3, 1, ordinary(3), 1, 0);
  comparison.attacker.push(999);
  assert.deepEqual(
    stoneBurnerComparison(emperor, 3, 1, ordinary(3), 1, 0).attacker,
    [1, 2, 3],
  );
  assert.deepEqual({ own, opponent }, original);
});

void test('invalid plans, malformed restored pools and unsupported huge token counts fail closed without enumeration', () => {
  for (const [dial, support] of [
    [NaN, 0],
    [Infinity, 0],
    [-1, 0],
    [0.25, 0],
    [2, -1],
    [2, 0.5],
    [2, NaN],
    [2, 4],
    [9, 0],
  ]) {
    assert.equal(
      stoneBurnerComparison(ordinary(3), dial, support, ordinary(3), 0, 0)
        .winner,
      null,
    );
    assert.match(
      stoneBurnerPlanBlock(
        ordinary(3),
        dial,
        support,
        ordinary(3),
        'attacker',
      )!,
      /legal Stone Burner force allocation/,
    );
  }
  for (const patch of [
    { normal: -1 },
    { elite: 0.5 },
    { normal: Number.MAX_SAFE_INTEGER },
    { normal: 21 },
    { eliteStrength: 3 },
    { freeSupport: undefined },
    { normalFixedHalf: 'yes' },
  ]) {
    const bad = { ...ordinary(3), ...patch } as CombatForces;
    assert.deepEqual(stoneBurnerComparison(bad, 0, 0, ordinary(1), 0, 0), {
      winner: null,
      attacker: [],
      defender: [1],
    });
    assert.match(
      stoneBurnerPlanBlock(ordinary(3), 0, 0, bad, 'attacker')!,
      /physical force pools/,
    );
  }
  assert.equal(
    stoneBurnerComparison(
      ordinary(1),
      0,
      0,
      ordinary(1),
      0,
      0,
      'bad' as StoneBurnerSide,
    ).winner,
    null,
  );
  assert.match(
    stoneBurnerPlanBlock(
      ordinary(1),
      0,
      0,
      ordinary(1),
      'bad' as StoneBurnerSide,
    )!,
    /roles/,
  );
});

void test('public compulsion matches existence of a supported zero-spice plan without assuming any hidden budget', () => {
  for (const own of [ordinary(0), ordinary(2), ordinary(4, false), emperor])
    for (const opponent of [
      ordinary(2),
      emperor,
      {
        normal: 6,
        elite: 2,
        eliteStrength: 2,
        normalFixedHalf: true,
        freeSupport: true,
      } as CombatForces,
    ])
      for (const side of ['attacker', 'defender'] as const)
        for (const aggressor of ['attacker', 'defender'] as const) {
          const any = Array.from(
            { length: own.normal * 2 + own.elite * 4 + 1 },
            (_, halfDial) => halfDial / 2,
          ).some(
            (dial) =>
              casualtyOptions(own, dial, 0).length &&
              stoneBurnerPlanBlock(own, dial, 0, opponent, side, aggressor) ===
                null,
          );
          assert.equal(
            stoneBurnerCompulsionBlock(own, opponent, side, aggressor) === null,
            any,
          );
        }
  assert.equal(
    stoneBurnerCompulsionBlock(
      ordinary(4, false),
      ordinary(4, false),
      'attacker',
    ),
    null,
  );
  assert.match(
    stoneBurnerCompulsionBlock(ordinary(0), emperor, 'attacker')!,
    /no supported zero-spice plan/,
  );
  assert.equal(
    stoneBurnerCompulsionBlock(ordinary(0), emperor, 'defender'),
    null,
  );
  assert.match(
    stoneBurnerCompulsionBlock(
      { ...ordinary(1), normal: 21 },
      emperor,
      'attacker',
    )!,
    /physical force pools/,
  );
});
