import test from 'node:test';
import assert from 'node:assert/strict';
import {
  casualtyOptions,
  maxCombatDial,
  maxCombatSupport,
  validCombatForces,
  type CombatForces,
} from '../game/combat';
import {
  stoneBurnerComparison,
  stoneBurnerPlanBlock,
} from '../game/stone-burner';
import {
  quoteBattleResolution,
  type BattleResolutionInput,
} from '../game/battle-resolution-quote';
import { leaders } from '../game/cards';

const pool = (patch: Partial<CombatForces> = {}): CombatForces => ({
  normal: 7,
  elite: 0,
  temporaryElite: 5,
  eliteStrength: 2,
  freeSupport: false,
  ...patch,
});

void test('temporary Sardaukar produce alternative ordinary casualties and pay only for physical counters', () => {
  const forces = pool(),
    before = structuredClone(forces);
  assert.deepEqual(casualtyOptions(forces, 2, 0), [
    { normal: 2, elite: 0, paidNormal: 0, paidElite: 0 },
    { normal: 3, elite: 0, paidNormal: 0, paidElite: 0 },
  ]);
  assert.deepEqual(casualtyOptions(forces, 2, 1), [
    { normal: 1, elite: 0, paidNormal: 1, paidElite: 0 },
    { normal: 2, elite: 0, paidNormal: 1, paidElite: 0 },
  ]);
  assert.deepEqual(casualtyOptions(forces, 12, 7), [
    { normal: 7, elite: 0, paidNormal: 7, paidElite: 0 },
  ]);
  assert.equal(maxCombatDial(forces), 12);
  assert.equal(maxCombatSupport(forces), 7);
  assert.deepEqual(forces, before);
});

void test('Salusa support, ordinary free support and canceled Sardaukar strength retain distinct role arithmetic', () => {
  const salusa = pool({ eliteFreeSupport: true });
  assert.equal(maxCombatSupport(salusa), 2);
  assert.equal(maxCombatDial(salusa), 12);
  assert.deepEqual(casualtyOptions(salusa, 12, 2), [
    { normal: 7, elite: 0, paidNormal: 2, paidElite: 0 },
  ]);
  assert.deepEqual(casualtyOptions(salusa, 12, 7), []);
  const normalFree = pool({ normalFreeSupport: true });
  assert.equal(maxCombatSupport(normalFree), 5);
  assert.deepEqual(casualtyOptions(normalFree, 12, 5), [
    { normal: 7, elite: 0, paidNormal: 5, paidElite: 0 },
  ]);
  const suppressed = pool({ eliteStrength: 1 });
  assert.equal(maxCombatDial(suppressed), 7);
  for (let half = 0; half <= 14; half++)
    for (let support = 0; support <= 7; support++) {
      assert.deepEqual(
        casualtyOptions(suppressed, half / 2, support),
        casualtyOptions(
          { ...suppressed, temporaryElite: undefined },
          half / 2,
          support,
        ),
      );
    }
  assert.equal(maxCombatSupport(pool({ freeSupport: true })), 0);
  assert.deepEqual(casualtyOptions(pool({ freeSupport: true }), 12, 0), [
    { normal: 7, elite: 0, paidNormal: 0, paidElite: 0 },
  ]);
});

/** Independent labeled-counter choices: survive, die unsupported, die supported. */
function assignments(forces: CombatForces) {
  let states = new Set(['0:0:0']);
  for (let counter = 0; counter < forces.normal; counter++) {
    const temporary = counter < (forces.temporaryElite ?? 0);
    const strength = temporary ? forces.eliteStrength : 1;
    const free =
      forces.freeSupport ||
      (temporary ? forces.eliteFreeSupport : forces.normalFreeSupport);
    const fixedHalf =
      !temporary && forces.normalFixedHalf && !forces.normalFreeSupport;
    const choices = [
      [0, 0, 0],
      [1, strength * (free && !fixedHalf ? 2 : 1), 0],
    ];
    if (!free && !fixedHalf) choices.push([1, strength * 2, 1]);
    const next = new Set<string>();
    for (const previous of states) {
      const [loss, half, paid] = previous.split(':').map(Number);
      for (const [n, h, p] of choices)
        next.add(`${loss + n}:${half + h}:${paid + p}`);
    }
    states = next;
  }
  return [...states].map((state) => state.split(':').map(Number));
}

void test('mapped losses match independent counter enumeration across mixed roles and every support exemption', () => {
  for (const normal of [0, 1, 2, 4, 6])
    for (let temporaryElite = 0; temporaryElite <= normal; temporaryElite++)
      for (const eliteStrength of [1, 2] as const)
        for (const flags of [
          {},
          { eliteFreeSupport: true },
          { normalFreeSupport: true },
          { normalFixedHalf: true },
          { normalFixedHalf: true, normalFreeSupport: true },
          { freeSupport: true },
          { freeSupport: true, normalFixedHalf: true },
          { eliteFreeSupport: true, normalFreeSupport: true },
        ]) {
          const forces = pool({
            normal,
            temporaryElite,
            eliteStrength,
            ...flags,
          });
          const expected = assignments(forces);
          assert.equal(
            maxCombatDial(forces),
            Math.max(...expected.map(([, half]) => half)) / 2,
          );
          assert.equal(
            maxCombatSupport(forces),
            Math.max(...expected.map(([, , paid]) => paid)),
          );
          for (let half = 0; half <= normal * 4; half++)
            for (let support = 0; support <= normal; support++) {
              const losses = expected
                .filter(([, h, p]) => h === half && p === support)
                .map(([n]) => n)
                .sort((a, b) => a - b);
              assert.deepEqual(
                casualtyOptions(forces, half / 2, support),
                losses.map((normal) => ({
                  normal,
                  elite: 0,
                  paidNormal: support,
                  paidElite: 0,
                })),
                JSON.stringify([forces, half, support]),
              );
            }
        }
});

void test('Stone Burner compares physical survivors and separates temporary-role cache entries', () => {
  const own: CombatForces = {
    normal: 4,
    elite: 0,
    eliteStrength: 1,
    freeSupport: true,
  };
  const temporary = pool({ normal: 3, temporaryElite: 2 });
  const ordinary = { ...temporary, temporaryElite: 0 };
  assert.deepEqual(stoneBurnerComparison(temporary, 2, 0, own, 2, 0), {
    winner: 'defender',
    attacker: [1],
    defender: [2],
  });
  assert.deepEqual(stoneBurnerComparison(temporary, 2, 1, own, 2, 0), {
    winner: null,
    attacker: [1, 2],
    defender: [2],
  });
  for (let repeat = 0; repeat < 3; repeat++) {
    assert.equal(stoneBurnerPlanBlock(own, 3, 0, ordinary, 'attacker'), null);
    assert.match(
      stoneBurnerPlanBlock(own, 3, 0, temporary, 'attacker')!,
      /different legal force allocations/,
    );
  }
});

function resolution(): BattleResolutionInput {
  const a = leaders('emperor')[0],
    d = leaders('guild')[0];
  return {
    advanced: true,
    turn: 2,
    territory: 'pasty_mesa',
    attacker: {
      id: 'e',
      faction: 'emperor',
      spice: 7,
      hand: [],
      leader: a,
      forces: pool(),
      plan: { dial: 12, support: 7, leader: a.id, weapon: null, defense: null },
    },
    defender: {
      id: 'g',
      faction: 'guild',
      spice: 0,
      hand: [],
      leader: d,
      forces: { normal: 1, elite: 0, eliteStrength: 1, freeSupport: false },
      plan: { dial: 0, support: 0, leader: d.id, weapon: null, defense: null },
    },
    voters: [
      { id: 'e', beneficiary: 'e', called: false, traitors: [] },
      { id: 'g', beneficiary: 'g', called: false, traitors: [] },
    ],
    participants: [
      { id: 'e', faction: 'emperor' },
      { id: 'g', faction: 'guild' },
    ],
    physicalCards: [],
    pendingAuditorPresent: false,
    pendingRetentionPresent: false,
  };
}

void test('battle quote retains the physical pool, ordinary casualties and exact support payment', () => {
  const input = resolution(),
    before = structuredClone(input),
    quote = quoteBattleResolution(input);
  assert.equal(quote.winner, 'e');
  assert.equal(quote.payments.find((p) => p.player === 'e')!.cost, 7);
  assert.deepEqual(quote.casualties!.forces, input.attacker.forces);
  assert.deepEqual(quote.casualties!.options, [
    { normal: 7, elite: 0, paidNormal: 7, paidElite: 0 },
  ]);
  assert.deepEqual(input, before);
});

void test('invalid temporary populations reject before calculation without changing physical custody', () => {
  for (const temporaryElite of [-1, 0.5, 8, 21, NaN, Infinity, '5', null]) {
    const forces = { ...pool(), temporaryElite } as unknown as CombatForces;
    assert.equal(validCombatForces(forces), false);
    assert.deepEqual(casualtyOptions(forces, 2, 0), []);
    assert.equal(maxCombatDial(forces), 0);
    assert.equal(maxCombatSupport(forces), 0);
    assert.match(
      stoneBurnerPlanBlock(forces, 2, 0, pool(), 'attacker')!,
      /valid supported physical/,
    );
    const input = resolution();
    input.attacker.forces = forces;
    const before = structuredClone(input);
    assert.throws(() => quoteBattleResolution(input), /valid force/);
    assert.deepEqual(input, before);
  }
  assert.equal(validCombatForces(pool({ elite: 1 })), false);
  assert.equal(validCombatForces(pool({ normal: 21 })), false);
  assert.equal(
    validCombatForces(pool({ normal: 20, temporaryElite: 20 })),
    true,
  );
  assert.equal(maxCombatDial(pool({ normal: 20, temporaryElite: 20 })), 40);
});
